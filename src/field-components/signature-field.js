import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image as RNImage,
  Modal,
  PanResponder,
  Pressable,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';
import { generateUuidV7 } from 'form0-core';
import { FormHeader } from '../form-header.jsx';
import { useTheme } from '../theme-context.jsx';
import { Text } from '../typography.jsx';

const DEFAULT_CANVAS_WIDTH = 320;
const DEFAULT_CANVAS_HEIGHT = 160;
const DEFAULT_MODAL_CANVAS_HEIGHT = 240;
const SIGNATURE_STROKE_WIDTH = 2.5;
const SIGNATURE_EXPORT_PADDING = 18;
const SIGNATURE_MIN_EXPORT_WIDTH = 120;
const SIGNATURE_MIN_EXPORT_HEIGHT = 72;
const PNG_DATA_PREFIX = /^data:image\/png;base64,/i;

function createClientSignatureId() {
  return `signature-${generateUuidV7()}`;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toNullableString(value) {
  return value === null || typeof value === 'string' ? value : null;
}

function stripPngDataPrefix(value = '') {
  return typeof value === 'string' ? value.replace(PNG_DATA_PREFIX, '').trim() : '';
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function extendBounds(bounds, x, y, radius = 0) {
  const pointRadius = Number.isFinite(radius) ? Math.max(radius, 0) : 0;
  const minX = x - pointRadius;
  const maxX = x + pointRadius;
  const minY = y - pointRadius;
  const maxY = y + pointRadius;

  if (!bounds) {
    return { minX, maxX, minY, maxY };
  }

  return {
    minX: Math.min(bounds.minX, minX),
    maxX: Math.max(bounds.maxX, maxX),
    minY: Math.min(bounds.minY, minY),
    maxY: Math.max(bounds.maxY, maxY),
  };
}

function expandRangeToMinimum(min, max, minSize, limit) {
  const safeLimit = Math.max(Number.isFinite(limit) ? limit : 0, 1);
  let start = clamp(min, 0, safeLimit);
  let end = clamp(max, 0, safeLimit);

  if (end <= start) {
    end = Math.min(safeLimit, start + 1);
  }

  const targetSize = Math.min(Math.max(Math.ceil(minSize), 1), safeLimit);
  const currentSize = end - start;
  if (currentSize >= targetSize) {
    return { start, end };
  }

  const center = (start + end) / 2;
  let nextStart = center - targetSize / 2;
  let nextEnd = center + targetSize / 2;

  if (nextStart < 0) {
    nextEnd = Math.min(safeLimit, nextEnd - nextStart);
    nextStart = 0;
  }

  if (nextEnd > safeLimit) {
    const overflow = nextEnd - safeLimit;
    nextStart = Math.max(0, nextStart - overflow);
    nextEnd = safeLimit;
  }

  return {
    start: clamp(nextStart, 0, safeLimit),
    end: clamp(nextEnd, 0, safeLimit),
  };
}

function buildSignatureExportSpec(bounds, canvasWidth, canvasHeight) {
  if (!bounds) {
    return null;
  }

  const safeCanvasWidth = Math.max(Math.round(canvasWidth || DEFAULT_CANVAS_WIDTH), 1);
  const safeCanvasHeight = Math.max(Math.round(canvasHeight || DEFAULT_MODAL_CANVAS_HEIGHT), 1);
  const left = clamp(bounds.minX - SIGNATURE_EXPORT_PADDING, 0, safeCanvasWidth);
  const right = clamp(bounds.maxX + SIGNATURE_EXPORT_PADDING, 0, safeCanvasWidth);
  const top = clamp(bounds.minY - SIGNATURE_EXPORT_PADDING, 0, safeCanvasHeight);
  const bottom = clamp(bounds.maxY + SIGNATURE_EXPORT_PADDING, 0, safeCanvasHeight);
  const horizontalRange = expandRangeToMinimum(
    left,
    right,
    SIGNATURE_MIN_EXPORT_WIDTH,
    safeCanvasWidth
  );
  const verticalRange = expandRangeToMinimum(
    top,
    bottom,
    SIGNATURE_MIN_EXPORT_HEIGHT,
    safeCanvasHeight
  );

  return {
    x: horizontalRange.start,
    y: verticalRange.start,
    width: Math.max(horizontalRange.end - horizontalRange.start, 1),
    height: Math.max(verticalRange.end - verticalRange.start, 1),
  };
}

function normalizeSignatureValue(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    return {
      signature_id: null,
      media_id: null,
      data: trimmed,
      mime_type: trimmed.startsWith('<svg') ? 'image/svg+xml' : 'image/png',
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  return {
    ...value,
    signature_id: value.signature_id ?? value.media_id ?? value.asset_id ?? null,
    media_id: value.media_id ?? value.signature_id ?? value.asset_id ?? null,
    data: typeof value.data === 'string' ? value.data.trim() : '',
    mime_type: typeof value.mime_type === 'string' ? value.mime_type : null,
  };
}

function computeSignatureValueKey(value) {
  if (!value) {
    return 'null';
  }

  return JSON.stringify([
    value.signature_id ?? null,
    value.media_id ?? null,
    value.mime_type ?? null,
    value.data ?? null,
    value.url ?? null,
    value.preview_url ?? null,
  ]);
}

function buildExistingPreview(value) {
  if (!value) {
    return { svgXml: null, imageUri: null };
  }

  const data = typeof value.data === 'string' ? value.data.trim() : '';
  const mimeType = typeof value.mime_type === 'string' ? value.mime_type : null;

  if (data.startsWith('<svg')) {
    return { svgXml: data, imageUri: null };
  }

  if (data) {
    const normalizedMimeType = mimeType || 'image/png';
    if (normalizedMimeType === 'image/svg+xml') {
      return { svgXml: data, imageUri: null };
    }
    return {
      svgXml: null,
      imageUri: `data:${normalizedMimeType};base64,${stripPngDataPrefix(data)}`,
    };
  }

  const fallbackUri =
    toNullableString(value.url) ??
    toNullableString(value.preview_url) ??
    toNullableString(value.thumbnail_url) ??
    null;

  return {
    svgXml: null,
    imageUri: fallbackUri,
  };
}

export function SignatureFieldComponent({ field, value, onChange, readOnly, inputProps = {} }) {
  const { theme } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isReadOnly = readOnly || inputProps.readOnly;
  const normalizedValue = useMemo(() => normalizeSignatureValue(value), [value]);
  const signatureValueKey = useMemo(
    () => computeSignatureValueKey(normalizedValue),
    [normalizedValue]
  );
  const preview = useMemo(() => buildExistingPreview(normalizedValue), [normalizedValue]);
  const [isPadVisible, setIsPadVisible] = useState(false);
  const [draftStrokes, setDraftStrokes] = useState([]);
  const [draftLayout, setDraftLayout] = useState({
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_MODAL_CANVAS_HEIGHT,
  });
  const draftStrokesRef = useRef(draftStrokes);
  const draftBoundsRef = useRef(null);
  const exportSvgRef = useRef(null);
  const exportResolverRef = useRef(null);
  const currentPointsRef = useRef([]);
  const [isExportingSignature, setIsExportingSignature] = useState(false);
  const [exportSpec, setExportSpec] = useState(null);
  const signingCanvasHeight = useMemo(
    () => Math.min(Math.max(Math.round(windowHeight * 0.38), 220), 320),
    [windowHeight]
  );
  const previewHeight = Math.max(
    DEFAULT_CANVAS_HEIGHT,
    Math.min(Math.round(signingCanvasHeight * 0.62), 180)
  );

  useEffect(() => {
    draftStrokesRef.current = draftStrokes;
  }, [draftStrokes]);

  useEffect(() => {
    setDraftStrokes([]);
    currentPointsRef.current = [];
    draftBoundsRef.current = null;
    setExportSpec(null);
  }, [signatureValueKey]);

  const exportSignaturePng = useCallback(() => {
    const nextExportSpec = buildSignatureExportSpec(
      draftBoundsRef.current,
      draftLayout.width,
      draftLayout.height
    );
    if (!nextExportSpec) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      exportResolverRef.current = resolve;
      setExportSpec(nextExportSpec);
    });
  }, [draftLayout.height, draftLayout.width]);

  useEffect(() => {
    if (!exportSpec || typeof exportResolverRef.current !== 'function') {
      return undefined;
    }

    let cancelled = false;
    const resolveExport = (data) => {
      const resolver = exportResolverRef.current;
      exportResolverRef.current = null;
      setExportSpec(null);
      if (typeof resolver === 'function') {
        resolver(data);
      }
    };

    requestAnimationFrame(() => {
      if (cancelled) {
        return;
      }

      const svgNode = exportSvgRef.current;
      if (!svgNode || typeof svgNode.toDataURL !== 'function') {
        resolveExport(null);
        return;
      }

      try {
        svgNode.toDataURL(
          (data) => {
            if (cancelled) {
              return;
            }
            const normalizedData = stripPngDataPrefix(data);
            resolveExport(normalizedData || null);
          },
          {
            width: Math.max(Math.round(exportSpec.width), 1),
            height: Math.max(Math.round(exportSpec.height), 1),
          }
        );
      } catch (error) {
        console.warn('form0-react-native: failed to export signature as PNG.', error);
        resolveExport(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [exportSpec]);

  useEffect(
    () => () => {
      if (typeof exportResolverRef.current === 'function') {
        exportResolverRef.current(null);
        exportResolverRef.current = null;
      }
    },
    []
  );

  const commitSignatureValue = useCallback(async () => {
    if (typeof onChange !== 'function' || isReadOnly) {
      return false;
    }

    const nextStrokes = draftStrokesRef.current;
    if (!Array.isArray(nextStrokes) || nextStrokes.length === 0) {
      return false;
    }

    const pngData = await exportSignaturePng();
    if (!pngData) {
      return false;
    }

    const signedAtClient =
      normalizedValue?.signed_at_client ?? normalizedValue?.attached_at_client ?? new Date().toISOString();
    const signatureId = normalizedValue?.signature_id ?? createClientSignatureId();

    onChange({
      ...(normalizedValue && typeof normalizedValue === 'object' ? { ...normalizedValue } : {}),
      signature_id: signatureId,
      media_id: normalizedValue?.media_id ?? signatureId,
      data: pngData,
      mime_type: 'image/png',
      field_key: field?.key || field?.data_name || null,
      field_data_name: field?.data_name || field?.key || null,
      signed_at_client: signedAtClient,
      attached_at_client: normalizedValue?.attached_at_client ?? signedAtClient,
      upload_status: normalizedValue?.upload_status ?? 'local',
    });

    return true;
  }, [exportSignaturePng, field?.data_name, field?.key, isReadOnly, normalizedValue, onChange]);

  const beginStroke = useCallback(
    (x, y) => {
      const nextPoints = [{ x, y }];
      currentPointsRef.current = nextPoints;
      draftBoundsRef.current = extendBounds(
        draftBoundsRef.current,
        x,
        y,
        SIGNATURE_STROKE_WIDTH
      );
      setDraftStrokes((prev) => [...prev, { d: `M ${x.toFixed(2)} ${y.toFixed(2)}` }]);
    },
    []
  );

  const appendPoint = useCallback((x, y) => {
    currentPointsRef.current = [...currentPointsRef.current, { x, y }];
    draftBoundsRef.current = extendBounds(draftBoundsRef.current, x, y, SIGNATURE_STROKE_WIDTH);
    setDraftStrokes((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const next = prev.slice();
      const lastStroke = next[next.length - 1];
      next[next.length - 1] = {
        ...lastStroke,
        d: `${lastStroke.d} L ${x.toFixed(2)} ${y.toFixed(2)}`,
      };
      return next;
    });
  }, []);

  const finalizeStroke = useCallback(() => {
    currentPointsRef.current = [];
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isReadOnly,
        onMoveShouldSetPanResponder: () => !isReadOnly,
        onPanResponderGrant: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          beginStroke(locationX, locationY);
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          appendPoint(locationX, locationY);
        },
        onPanResponderRelease: finalizeStroke,
        onPanResponderTerminate: finalizeStroke,
      }),
    [appendPoint, beginStroke, finalizeStroke, isReadOnly]
  );

  const handleOpenPad = useCallback(() => {
    if (isReadOnly) {
      return;
    }

    currentPointsRef.current = [];
    setDraftStrokes([]);
    setIsExportingSignature(false);
    draftBoundsRef.current = null;
    setExportSpec(null);
    setDraftLayout({
      width: Math.max(windowWidth - 32, DEFAULT_CANVAS_WIDTH),
      height: signingCanvasHeight,
    });
    setIsPadVisible(true);
  }, [isReadOnly, signingCanvasHeight, windowWidth]);

  const handleClosePad = useCallback(() => {
    currentPointsRef.current = [];
    setDraftStrokes([]);
    setIsExportingSignature(false);
    draftBoundsRef.current = null;
    setExportSpec(null);
    setIsPadVisible(false);
  }, []);

  const handleSaveSignature = useCallback(() => {
    if (draftStrokesRef.current.length === 0 || isExportingSignature) {
      return;
    }

    setIsExportingSignature(true);
    commitSignatureValue()
      .then((didSave) => {
        if (didSave) {
          handleClosePad();
        }
      })
      .finally(() => {
        setIsExportingSignature(false);
      });
  }, [commitSignatureValue, handleClosePad, isExportingSignature]);

  const handleClear = useCallback(() => {
    if (isReadOnly) {
      return;
    }

    currentPointsRef.current = [];
    setDraftStrokes([]);
    draftBoundsRef.current = null;
    setExportSpec(null);
    if (typeof onChange === 'function') {
      onChange(null);
    }
  }, [isReadOnly, onChange]);

  const handleClearPad = useCallback(() => {
    currentPointsRef.current = [];
    setDraftStrokes([]);
    setIsExportingSignature(false);
    draftBoundsRef.current = null;
    setExportSpec(null);
  }, []);

  const showExistingPreview = Boolean(preview.svgXml || preview.imageUri);
  const showEmptyState = !showExistingPreview;
  const agreementText =
    typeof field?.agreement_text === 'string' && field.agreement_text.trim().length > 0
      ? field.agreement_text.trim()
      : null;
  const canvasBackground = isReadOnly ? theme.color.inputDisabledBg : theme.color.inputBg;
  const canvasForeground = isReadOnly ? theme.color.inputDisabledFg : theme.color.foreground;
  const draftHasStrokes = draftStrokes.length > 0;
  const primaryButtonLabel = normalizedValue ? 'Replace signature' : 'Add signature';
  const rotateHint =
    windowWidth < windowHeight ? 'Rotate your device for a wider signing surface.' : null;

  return (
    <View style={{ gap: 8 }}>
      {agreementText ? (
        <Text style={{ color: theme.color.description, fontSize: theme.fontSize.sm }}>
          {agreementText}
        </Text>
      ) : null}
      <View
        style={{
          borderWidth: 1,
          borderColor: theme.color.inputBorder,
          borderRadius: theme.borderRadius.md,
          overflow: 'hidden',
          backgroundColor: canvasBackground,
        }}
      >
        <View
          style={{
            minHeight: previewHeight,
            justifyContent: 'center',
            paddingVertical: 8,
          }}
          accessibilityLabel={field?.label || 'Signature preview'}
          accessibilityRole="image"
        >
          {showExistingPreview && preview.svgXml ? (
            <SvgXml xml={preview.svgXml} width="100%" height={previewHeight} />
          ) : null}
          {showExistingPreview && preview.imageUri ? (
            <RNImage
              source={{ uri: preview.imageUri }}
              resizeMode="contain"
              style={{
                width: '100%',
                height: previewHeight,
              }}
            />
          ) : null}
          {showEmptyState ? (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: previewHeight,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ color: theme.color.description, fontSize: theme.fontSize.sm }}>
                {isReadOnly
                  ? 'No signature captured.'
                  : 'Open the signature pad to capture a signature.'}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {!isReadOnly ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Pressable
            onPress={handleOpenPad}
            style={({ pressed }) => [
              {
                borderWidth: 1,
                borderColor: theme.color.primary,
                borderRadius: theme.borderRadius.full,
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: pressed ? theme.color.buttonHoverBg : theme.color.buttonBg,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={primaryButtonLabel}
          >
            <Text style={{ color: theme.color.buttonFg, fontSize: theme.fontSize.sm }}>
              {primaryButtonLabel}
            </Text>
          </Pressable>
          {normalizedValue ? (
            <Pressable
              onPress={handleClear}
              style={({ pressed }) => [
                {
                  borderWidth: 1,
                  borderColor: theme.color.inputBorder,
                  borderRadius: theme.borderRadius.full,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: pressed ? theme.color.cancelHoverBg : theme.color.cancelBg,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Clear signature"
            >
              <Text style={{ color: theme.color.cancelFg, fontSize: theme.fontSize.sm }}>
                Clear signature
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Modal
        visible={isPadVisible}
        animationType="slide"
        onRequestClose={handleClosePad}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: theme.color.background }}>
          <FormHeader
            formName={field?.label || 'Capture signature'}
            mode="edit"
            leftAction={{
              id: 'cancel',
              label: 'Cancel',
              variant: 'cancel',
              onPress: handleClosePad,
            }}
            rightAction={{
              id: 'save',
              label: isExportingSignature ? 'Saving...' : 'Save',
              variant: 'primary',
              onPress: handleSaveSignature,
              disabled: !draftHasStrokes || isExportingSignature,
            }}
            showPrimaryActionsInViewMode={false}
          />
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 4,
              gap: 8,
            }}
          >
            {agreementText ? (
              <Text style={{ color: theme.color.description, fontSize: theme.fontSize.sm }}>
                {agreementText}
              </Text>
            ) : null}
            <Text style={{ color: theme.color.description, fontSize: theme.fontSize.sm }}>
              Draw your signature in the capture area below. Saving replaces the current signature.
            </Text>
            {rotateHint ? (
              <Text style={{ color: theme.color.description, fontSize: theme.fontSize.xs }}>
                {rotateHint}
              </Text>
            ) : null}
          </View>
          <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <View
              style={{
                borderWidth: 1,
                borderColor: theme.color.inputBorder,
                borderRadius: theme.borderRadius.md,
                backgroundColor: theme.color.inputBg,
                overflow: 'hidden',
              }}
            >
              <View
                {...(!isReadOnly ? panResponder.panHandlers : {})}
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout || {};
                  if (width > 0 && height > 0) {
                    setDraftLayout({ width, height });
                  }
                }}
                style={{
                  minHeight: signingCanvasHeight,
                  justifyContent: 'center',
                }}
                accessibilityLabel={field?.label || 'Signature capture'}
                accessibilityRole="image"
              >
                {!draftHasStrokes ? (
                  <View
                    style={{
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: signingCanvasHeight,
                      paddingHorizontal: 16,
                    }}
                  >
                    <Text style={{ color: theme.color.description, fontSize: theme.fontSize.sm }}>
                      Sign here with your finger or stylus.
                    </Text>
                  </View>
                ) : null}
                {draftHasStrokes ? (
                  <Svg
                    collapsable={false}
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${draftLayout.width || DEFAULT_CANVAS_WIDTH} ${draftLayout.height || DEFAULT_MODAL_CANVAS_HEIGHT}`}
                  >
                    {draftStrokes.map((stroke, index) => (
                      <Path
                        key={`draft-stroke-${index}`}
                        d={stroke.d}
                        fill="none"
                        stroke={canvasForeground}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                  </Svg>
                ) : null}
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Pressable
                onPress={handleClearPad}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: theme.color.inputBorder,
                  borderRadius: theme.borderRadius.full,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: pressed ? theme.color.cancelHoverBg : theme.color.cancelBg,
                })}
              >
                <Text style={{ color: theme.color.cancelFg, fontSize: theme.fontSize.sm }}>
                  Clear pad
                </Text>
              </Pressable>
            </View>
          </View>
          {exportSpec ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: -10000,
                top: -10000,
                opacity: 0,
              }}
            >
              <Svg
                ref={exportSvgRef}
                collapsable={false}
                width={exportSpec.width}
                height={exportSpec.height}
                viewBox={`${exportSpec.x} ${exportSpec.y} ${exportSpec.width} ${exportSpec.height}`}
              >
                {draftStrokes.map((stroke, index) => (
                  <Path
                    key={`export-stroke-${index}`}
                    d={stroke.d}
                    fill="none"
                    stroke={canvasForeground}
                    strokeWidth={SIGNATURE_STROKE_WIDTH}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </Svg>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
