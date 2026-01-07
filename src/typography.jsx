import React from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';
import { useTheme } from './theme-context.jsx';

function getStyleProp(style, prop) {
  if (!style) return undefined;
  if (Array.isArray(style)) {
    for (let i = style.length - 1; i >= 0; i -= 1) {
      const value = getStyleProp(style[i], prop);
      if (value !== undefined) return value;
    }
    return undefined;
  }
  if (typeof style !== 'object') return undefined;
  return style[prop];
}

function normalizeFontWeight(weight) {
  if (weight === undefined || weight === null) return null;
  const value = typeof weight === 'number' ? String(weight) : String(weight);
  if (value === 'normal') return '400';
  if (value === 'bold') return '700';
  return value;
}

function stripStyleProps(style, propsToStrip) {
  if (!style) return style;
  if (Array.isArray(style)) {
    return style.map((entry) => stripStyleProps(entry, propsToStrip));
  }
  if (typeof style !== 'object') return style;
  const next = { ...style };
  propsToStrip.forEach((prop) => {
    if (prop in next) {
      delete next[prop];
    }
  });
  return next;
}

function resolveFontFamily(theme, style) {
  if (!theme) {
    return { fontFamily: null, stripWeight: false, stripStyle: false };
  }

  const typography = theme.typography || {};
  const styleFontFamily = getStyleProp(style, 'fontFamily');
  if (styleFontFamily) {
    return { fontFamily: null, stripWeight: false, stripStyle: false };
  }

  const fontStyle = getStyleProp(style, 'fontStyle');
  const isItalic = fontStyle === 'italic';
  const fontWeight = normalizeFontWeight(getStyleProp(style, 'fontWeight'));
  const weightMap = isItalic
    ? typography.fontFamilyByWeightItalic
    : typography.fontFamilyByWeight;

  if (fontWeight && weightMap && weightMap[fontWeight]) {
    return {
      fontFamily: weightMap[fontWeight],
      stripWeight: true,
      stripStyle: isItalic,
    };
  }

  const baseFamily = isItalic ? typography.fontFamilyItalic : typography.fontFamily;
  return {
    fontFamily: baseFamily || typography.fontFamily || theme.fontFamily || null,
    stripWeight: false,
    stripStyle: false,
  };
}

function mergeFontFamily(style, fontFamily) {
  if (!fontFamily) return style;
  const baseStyle = { fontFamily };
  if (!style) return baseStyle;
  if (Array.isArray(style)) return [baseStyle, ...style];
  return [baseStyle, style];
}

function prependBaseStyle(style, baseStyle) {
  if (!baseStyle) return style;
  if (!style) return baseStyle;
  if (Array.isArray(style)) return [baseStyle, ...style];
  return [baseStyle, style];
}

export function Text({ style, ...props }) {
  const { theme } = useTheme();
  const { fontFamily, stripWeight, stripStyle } = resolveFontFamily(theme, style);
  const cleanedStyle =
    stripWeight || stripStyle
      ? stripStyleProps(style, [
          ...(stripWeight ? ['fontWeight'] : []),
          ...(stripStyle ? ['fontStyle'] : []),
        ])
      : style;
  const mergedStyle = mergeFontFamily(cleanedStyle, fontFamily);
  const baseStyle = theme?.fontSize?.base ? { fontSize: theme.fontSize.base } : null;
  const withBaseStyle = prependBaseStyle(mergedStyle, baseStyle);

  return <RNText {...props} style={withBaseStyle} />;
}

export function TextInput({ style, ...props }) {
  const { theme } = useTheme();
  const { fontFamily, stripWeight, stripStyle } = resolveFontFamily(theme, style);
  const cleanedStyle =
    stripWeight || stripStyle
      ? stripStyleProps(style, [
          ...(stripWeight ? ['fontWeight'] : []),
          ...(stripStyle ? ['fontStyle'] : []),
        ])
      : style;
  const mergedStyle = mergeFontFamily(cleanedStyle, fontFamily);
  const baseStyle = theme?.fontSize?.base ? { fontSize: theme.fontSize.base } : null;
  const withBaseStyle = prependBaseStyle(mergedStyle, baseStyle);

  return <RNTextInput {...props} style={withBaseStyle} />;
}
