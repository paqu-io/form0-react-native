import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme, mergeThemes, getThemeByName } from './theme.js';

/**
 * Theme Context for form0-react-native
 *
 * Provides theme values to all form components via React Context.
 * Supports light/dark/system color modes and custom theme overrides.
 */

const ThemeContext = createContext(null);

/**
 * Theme Provider component
 *
 * @param {Object} props
 * @param {'light' | 'dark' | 'system'} props.colorMode - Color mode preference
 * @param {Object} props.customTheme - Optional custom theme overrides
 * @param {React.ReactNode} props.children
 */
export function ThemeProvider({
  colorMode = 'light',
  customTheme = null,
  children,
}) {
  // Get system color scheme
  const systemColorScheme = useColorScheme();

  // Resolve the effective color mode
  const effectiveMode = useMemo(() => {
    if (colorMode === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return colorMode === 'dark' ? 'dark' : 'light';
  }, [colorMode, systemColorScheme]);

  // Build the final theme
  const theme = useMemo(() => {
    const baseTheme = getThemeByName(effectiveMode);

    // Apply custom overrides if provided
    if (customTheme) {
      return mergeThemes(baseTheme, customTheme);
    }

    return baseTheme;
  }, [effectiveMode, customTheme]);

  // Context value includes theme and metadata
  const contextValue = useMemo(
    () => ({
      theme,
      colorMode: effectiveMode,
      isDark: effectiveMode === 'dark',
    }),
    [theme, effectiveMode]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access the current theme
 *
 * @returns {{ theme: Object, colorMode: string, isDark: boolean }}
 */
export function useTheme() {
  const context = useContext(ThemeContext);

  // If no provider, return default light theme
  if (!context) {
    return {
      theme: lightTheme,
      colorMode: 'light',
      isDark: false,
    };
  }

  return context;
}

/**
 * Re-export ThemeContext for advanced use cases
 */
export { ThemeContext };

