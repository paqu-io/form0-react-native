/**
 * Form0 React Native Theme System
 *
 * Provides consistent theming across the mobile form experience,
 * matching the colors and styles from the web version (form0-react).
 *
 * Color values are taken directly from form0-react/src/theme.css.js
 */

/**
 * Default light theme - matches form0-react standardThemeLight
 */
export const lightTheme = {
  color: {
    // Core colors (from web theme.css.js)
    background: '#ffffff',
    foreground: '#111111',
    border: '#e5e7eb',
    primary: '#111111',
    error: '#e11d48',

    // Section colors
    section: '#f9fafb',
    sectionBorder: '#e5e7eb',
    sectionHeader: '#111111',

    // Primary button (Submit) - vivid pink/magenta
    buttonBg: '#ff007a',
    buttonFg: '#ffffff',
    buttonBorder: '#ff007a',
    buttonHoverBg: '#d6006b',
    buttonHoverFg: '#ffffff',

    // Cancel button - soft neutral
    cancelBg: '#f3f4f6',
    cancelFg: '#374151',
    cancelBorder: '#e5e7eb',
    cancelHoverBg: '#e5e7eb',

    // Edit button - soft blue
    editBg: '#eff6ff',
    editFg: '#2563eb',
    editBorder: '#bfdbfe',
    editHoverBg: '#dbeafe',

    // Special button variants (from web)
    drilldownButtonBg: '#00c2ff', // vivid cyan
    drilldownButtonFg: '#ffffff',
    backButtonBg: '#ffe600', // vivid yellow
    backButtonFg: '#111111',

    // Icon colors
    icon: '#6b7280',
    iconHover: '#111111',

    // Mode banner/header colors (View mode - Amber)
    bannerViewBg: '#fef3c7',
    bannerViewFg: '#92400e',
    bannerViewBorder: '#fcd34d',

    // Mode banner/header colors (Edit mode - Light Blue)
    bannerEditBg: '#dbeafe',
    bannerEditFg: '#1e40af',
    bannerEditBorder: '#60a5fa',

    // Field states
    inputBg: '#ffffff',
    inputBorder: '#d1d5db',
    inputFocusBorder: '#2563eb',
    inputDisabledBg: '#f3f4f6',
    inputDisabledFg: '#9ca3af',

    // Text colors
    label: '#111111',
    placeholder: '#9ca3af',
    description: '#6b7280',
  },

  // Spacing (in pixels, converted from rem)
  spacing: {
    xs: 2, // 0.125rem
    sm: 4, // 0.25rem
    md: 8, // 0.5rem
    lg: 16, // 1rem
    xl: 24, // 1.5rem
  },

  // Border radius
  borderRadius: {
    sm: 4,
    md: 6, // 0.375rem
    lg: 8,
    full: 999,
  },

  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14, // 0.875rem (base)
    base: 15,
    lg: 17,
    xl: 20,
  },

  // Font weights
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Line heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.625,
  },
};

/**
 * Default dark theme - matches form0-react standardThemeDark
 */
export const darkTheme = {
  color: {
    // Core colors (from web theme.css.js)
    background: '#18181b',
    foreground: '#f3f4f6',
    border: '#27272a',
    primary: '#38bdf8',
    error: '#f87171',

    // Section colors
    section: '#232326',
    sectionBorder: '#27272a',
    sectionHeader: '#38bdf8',

    // Primary button (Submit) - vivid green
    buttonBg: '#00ffae',
    buttonFg: '#18181b',
    buttonBorder: '#00ffae',
    buttonHoverBg: '#00c98a',
    buttonHoverFg: '#18181b',

    // Cancel button - dark neutral
    cancelBg: '#27272a',
    cancelFg: '#f3f4f6',
    cancelBorder: '#3f3f46',
    cancelHoverBg: '#3f3f46',

    // Edit button - blue accent
    editBg: '#1e3a5f',
    editFg: '#38bdf8',
    editBorder: '#38bdf8',
    editHoverBg: '#1e4976',

    // Special button variants (from web)
    drilldownButtonBg: '#ff5e00', // vivid orange
    drilldownButtonFg: '#ffffff',
    backButtonBg: '#ff00e6', // vivid magenta
    backButtonFg: '#ffffff',

    // Icon colors
    icon: '#9ca3af',
    iconHover: '#f3f4f6',

    // Mode banner/header colors (View mode - Amber with transparency)
    bannerViewBg: 'rgba(251, 191, 36, 0.2)',
    bannerViewFg: '#fde68a',
    bannerViewBorder: '#fbbf24',

    // Mode banner/header colors (Edit mode - Blue)
    bannerEditBg: '#1e3a5f',
    bannerEditFg: '#93c5fd',
    bannerEditBorder: '#60a5fa',

    // Field states
    inputBg: '#27272a',
    inputBorder: '#3f3f46',
    inputFocusBorder: '#38bdf8',
    inputDisabledBg: '#18181b',
    inputDisabledFg: '#71717a',

    // Text colors
    label: '#f3f4f6',
    placeholder: '#71717a',
    description: '#a1a1aa',
  },

  // Spacing (same as light theme)
  spacing: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 16,
    xl: 24,
  },

  // Border radius
  borderRadius: {
    sm: 4,
    md: 6,
    lg: 8,
    full: 999,
  },

  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 15,
    lg: 17,
    xl: 20,
  },

  // Font weights
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Line heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.625,
  },
};

/**
 * Deep merge utility for theme customization
 */
export function mergeThemes(base, override) {
  if (!override) return base;

  const result = { ...base };

  for (const key of Object.keys(override)) {
    if (
      override[key] &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      base[key] &&
      typeof base[key] === 'object'
    ) {
      result[key] = mergeThemes(base[key], override[key]);
    } else if (override[key] !== undefined) {
      result[key] = override[key];
    }
  }

  return result;
}

/**
 * Get theme by name
 */
export function getThemeByName(name) {
  switch (name) {
    case 'dark':
      return darkTheme;
    case 'light':
    default:
      return lightTheme;
  }
}
