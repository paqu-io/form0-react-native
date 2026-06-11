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
import { useTheme } from '../theme-context.jsx';
import { Text } from '../typography.jsx';

const DEFAULT_CANVAS_WIDTH = 320;
const DEFAULT_CANVAS_HEIGHT = 160;
const DEFAULT_MODAL_CANVAS_HEIGHT = 240;
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
  const signatureSvgRef = useRef(null);
  const currentPointsRef = useRef([]);
  const [isExportingSignature, setIsExportingSignature] = useState(false);
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
  }, [signatureValueKey]);

  const exportSignaturePng = useCallback(() => {
    return new Promise((resolve) => {
      const svgNode = signatureSvgRef.current;
      if (!svgNode || typeof svgNode.toDataURL !== 'function') {
        resolve(null);
        return;
      }

      requestAnimationFrame(() => {
        try {
          svgNode.toDataURL((data) => {
            const normalizedData = stripPngDataPrefix(data);
            resolve(normalizedData || null);
          });
        } catch (error) {
          console.warn('form0-react-native: failed to export signature as PNG.', error);
          resolve(null);
        }
      });
    });
  }, []);

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
      setDraftStrokes((prev) => [...prev, { d: `M ${x.toFixed(2)} ${y.toFixed(2)}` }]);
    },
    []
  );

  const appendPoint = useCallback((x, y) => {
    currentPointsRef.current = [...currentPointsRef.current, { x, y }];
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
    if (typeof onChange === 'function') {
      onChange(null);
    }
  }, [isReadOnly, onChange]);

  const handleClearPad = useCallback(() => {
    currentPointsRef.current = [];
    setDraftStrokes([]);
    setIsExportingSignature(false);
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
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 18,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: theme.color.border,
              gap: 12,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Pressable
                onPress={handleClosePad}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: pressed ? theme.color.cancelHoverBg : theme.color.cancelBg,
                })}
              >
                <Text style={{ color: theme.color.cancelFg, fontSize: theme.fontSize.sm }}>
                  Cancel
                </Text>
              </Pressable>
              <Text
                style={{
                  color: theme.color.foreground,
                  fontSize: theme.fontSize.base,
                  fontWeight: theme.fontWeight.bold,
                  flex: 1,
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {field?.label || 'Capture signature'}
              </Text>
              <Pressable
                onPress={handleSaveSignature}
                disabled={!draftHasStrokes || isExportingSignature}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: draftHasStrokes && !isExportingSignature
                    ? pressed
                      ? theme.color.buttonHoverBg
                      : theme.color.buttonBg
                    : theme.color.buttonDisabledBg || theme.color.inputDisabledBg,
                })}
              >
                <Text
                  style={{
                    color: draftHasStrokes && !isExportingSignature
                      ? theme.color.buttonFg
                      : theme.color.buttonDisabledFg || theme.color.inputDisabledFg,
                    fontSize: theme.fontSize.sm,
                  }}
                >
                  {isExportingSignature ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>
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
                    ref={signatureSvgRef}
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
        </View>
      </Modal>
    </View>
  );
}
