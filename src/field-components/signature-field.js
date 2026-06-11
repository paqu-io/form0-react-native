import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image as RNImage, PanResponder, Pressable, View } from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';
import { generateUuidV7 } from 'form0-core';
import { useTheme } from '../theme-context.jsx';
import { Text } from '../typography.jsx';

const DEFAULT_CANVAS_WIDTH = 320;
const DEFAULT_CANVAS_HEIGHT = 160;
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

function serializeSvgMarkup(strokes, width, height) {
  const resolvedWidth = Number.isFinite(width) && width > 0 ? width : DEFAULT_CANVAS_WIDTH;
  const resolvedHeight = Number.isFinite(height) && height > 0 ? height : DEFAULT_CANVAS_HEIGHT;
  const pathMarkup = strokes
    .filter((stroke) => stroke && typeof stroke.d === 'string' && stroke.d.length > 0)
    .map(
      (stroke) =>
        `<path d="${stroke.d}" fill="none" stroke="#111111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`
    )
    .join('');

  if (!pathMarkup) {
    return '';
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${resolvedWidth} ${resolvedHeight}" width="${resolvedWidth}" height="${resolvedHeight}">`,
    '<rect width="100%" height="100%" fill="#ffffff" />',
    pathMarkup,
    '</svg>',
  ].join('');
}

export function SignatureFieldComponent({ field, value, onChange, readOnly, inputProps = {} }) {
  const { theme } = useTheme();
  const normalizedValue = useMemo(() => normalizeSignatureValue(value), [value]);
  const signatureValueKey = useMemo(
    () => computeSignatureValueKey(normalizedValue),
    [normalizedValue]
  );
  const preview = useMemo(() => buildExistingPreview(normalizedValue), [normalizedValue]);
  const [strokes, setStrokes] = useState([]);
  const [layout, setLayout] = useState({
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
  });
  const strokesRef = useRef(strokes);
  const currentPointsRef = useRef([]);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    setStrokes([]);
    currentPointsRef.current = [];
  }, [signatureValueKey]);

  const emitSignatureValue = useCallback(
    (nextStrokes) => {
      if (typeof onChange !== 'function' || readOnly) {
        return;
      }

      if (!Array.isArray(nextStrokes) || nextStrokes.length === 0) {
        onChange(null);
        return;
      }

      const svgMarkup = serializeSvgMarkup(nextStrokes, layout.width, layout.height);
      if (!svgMarkup) {
        onChange(null);
        return;
      }

      const signedAtClient =
        normalizedValue?.signed_at_client ?? normalizedValue?.attached_at_client ?? new Date().toISOString();
      const signatureId = normalizedValue?.signature_id ?? createClientSignatureId();

      onChange({
        ...(normalizedValue && typeof normalizedValue === 'object' ? { ...normalizedValue } : {}),
        signature_id: signatureId,
        media_id: normalizedValue?.media_id ?? signatureId,
        data: svgMarkup,
        mime_type: 'image/svg+xml',
        field_key: field?.key || field?.data_name || null,
        field_data_name: field?.data_name || field?.key || null,
        signed_at_client: signedAtClient,
        attached_at_client: normalizedValue?.attached_at_client ?? signedAtClient,
        upload_status: normalizedValue?.upload_status ?? 'local',
      });
    },
    [field?.data_name, field?.key, layout.height, layout.width, normalizedValue, onChange, readOnly]
  );

  const beginStroke = useCallback(
    (x, y) => {
      const nextPoints = [{ x, y }];
      currentPointsRef.current = nextPoints;
      setStrokes((prev) => [...prev, { d: `M ${x.toFixed(2)} ${y.toFixed(2)}` }]);
    },
    []
  );

  const appendPoint = useCallback((x, y) => {
    currentPointsRef.current = [...currentPointsRef.current, { x, y }];
    setStrokes((prev) => {
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
    emitSignatureValue(strokesRef.current);
  }, [emitSignatureValue]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !readOnly,
        onMoveShouldSetPanResponder: () => !readOnly,
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
    [appendPoint, beginStroke, finalizeStroke, readOnly]
  );

  const handleClear = useCallback(() => {
    if (readOnly) {
      return;
    }
    currentPointsRef.current = [];
    setStrokes([]);
    if (typeof onChange === 'function') {
      onChange(null);
    }
  }, [onChange, readOnly]);

  const showExistingPreview = strokes.length === 0 && (preview.svgXml || preview.imageUri);
  const showEmptyState = strokes.length === 0 && !showExistingPreview;
  const agreementText =
    typeof field?.agreement_text === 'string' && field.agreement_text.trim().length > 0
      ? field.agreement_text.trim()
      : null;
  const canvasBackground =
    readOnly || inputProps.readOnly ? theme.color.inputDisabledBg : theme.color.inputBg;
  const canvasForeground = readOnly ? theme.color.inputDisabledFg : theme.color.foreground;

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
          {...(!readOnly ? panResponder.panHandlers : {})}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout || {};
            if (width > 0 && height > 0) {
              setLayout({ width, height });
            }
          }}
          style={{
            minHeight: DEFAULT_CANVAS_HEIGHT,
            justifyContent: 'center',
          }}
          accessibilityLabel={field?.label || 'Signature'}
          accessibilityRole="image"
        >
          {showExistingPreview && preview.svgXml ? (
            <SvgXml
              xml={preview.svgXml}
              width="100%"
              height="100%"
            />
          ) : null}
          {showExistingPreview && preview.imageUri ? (
            <RNImage
              source={{ uri: preview.imageUri }}
              resizeMode="contain"
              style={{
                width: '100%',
                height: DEFAULT_CANVAS_HEIGHT,
              }}
            />
          ) : null}
          {showEmptyState ? (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: DEFAULT_CANVAS_HEIGHT,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ color: theme.color.description, fontSize: theme.fontSize.sm }}>
                {readOnly ? 'No signature captured.' : 'Sign here with your finger or stylus.'}
              </Text>
            </View>
          ) : null}
          {strokes.length > 0 ? (
            <Svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${layout.width || DEFAULT_CANVAS_WIDTH} ${layout.height || DEFAULT_CANVAS_HEIGHT}`}
            >
              {strokes.map((stroke, index) => (
                <Path
                  key={`stroke-${index}`}
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
      {!readOnly ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
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
        </View>
      ) : null}
    </View>
  );
}
