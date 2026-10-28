import React from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { FormActionButton as ActionButton } from './form-action-button.jsx';
import { useTheme } from './theme-context.jsx';
import { Text } from './typography.jsx';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

// Safe area context is optional - will use it if available
let useSafeAreaInsets;
try {
  const safeAreaModule = require('react-native-safe-area-context');
  useSafeAreaInsets = safeAreaModule.useSafeAreaInsets;
} catch {
  useSafeAreaInsets = null;
}

/**
 * Mobile-native form header with dynamic action buttons.
 * Supports different action configurations based on drilldown state.
 *
 * Action object shape:
 * {
 *   id: 'back' | 'cancel' | 'submit' | 'add' | 'save' | 'edit',
 *   label: string,
 *   variant: 'cancel' | 'primary' | 'back' | 'edit',
 *   onPress: () => void,
 *   disabled?: boolean,
 *   icon?: Component, // Optional custom icon
 * }
 *
 * The header background color changes based on mode:
 * - View mode: Amber background (same as web bannerViewBg)
 * - Edit mode: Light blue background (same as web bannerEditBg)
 */
export function FormHeader({
  formName,
  mode = 'edit',
  // Legacy props for backwards compatibility
  onCancel,
  onSubmit,
  onEnterEditMode,
  canSubmit = true,
  showPrimaryActionsInViewMode = true,
  // New dynamic action props
  leftAction,
  rightAction,
  secondaryRightAction,
  onTitlePress,
  titleAccessibilityHint = 'Open form navigation',
  style,
  includeSafeArea = true,
}) {
  // Get theme from context
  const { theme } = useTheme();

  // Get safe area insets if available
  const insets = useSafeAreaInsets ? useSafeAreaInsets() : { top: 0 };
  const topPadding = includeSafeArea ? insets.top : 0;

  const isReadOnly = mode === 'readonly';

  // Mode-based header colors
  const headerBg = isReadOnly ? theme.color.bannerViewBg : theme.color.bannerEditBg;
  const headerBorderColor = isReadOnly
    ? theme.color.bannerViewBorder
    : theme.color.bannerEditBorder;
  const titleColor = isReadOnly ? theme.color.bannerViewFg : theme.color.bannerEditFg;

  // Resolve left action (prefer new prop, fallback to legacy)
  const resolvedLeftAction = leftAction || (typeof onCancel === 'function' ? {
    id: 'cancel',
    label: 'Cancel',
    variant: 'cancel',
    onPress: onCancel,
  } : null);

  // Resolve right action (prefer new prop, fallback to legacy)
  let resolvedRightAction = rightAction;
  if (!resolvedRightAction) {
    if (isReadOnly && typeof onEnterEditMode === 'function' && showPrimaryActionsInViewMode) {
      resolvedRightAction = {
        id: 'edit',
        label: 'Edit',
        variant: 'edit',
        onPress: onEnterEditMode,
      };
    } else if (!isReadOnly && typeof onSubmit === 'function') {
      resolvedRightAction = {
        id: 'submit',
        label: 'Submit',
        variant: 'primary',
        onPress: onSubmit,
        disabled: !canSubmit,
      };
    }
  }

  // Handle secondary right action (e.g., Edit button when there's also a primary action)
  const resolvedSecondaryRightAction = secondaryRightAction;
  const canPressTitle = typeof onTitlePress === 'function' && Boolean(formName);
  const titleNode = formName ? (
    <Text
      style={[styles.title, { color: titleColor, fontSize: theme.fontSize.lg }]}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {formName}
    </Text>
  ) : null;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: topPadding,
          backgroundColor: headerBg,
          borderBottomColor: headerBorderColor,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        <ActionButton action={resolvedLeftAction} theme={theme} position="left" />

        <View style={styles.titleContainer}>
          {canPressTitle ? (
            <Pressable
              onPress={onTitlePress}
              hitSlop={HIT_SLOP}
              style={styles.titlePressable}
              accessibilityRole="button"
              accessibilityLabel={formName}
              accessibilityHint={titleAccessibilityHint}
            >
              {titleNode}
            </Pressable>
          ) : (
            titleNode
          )}
        </View>

        <View style={styles.rightActions}>
          {resolvedSecondaryRightAction && (
            <ActionButton action={resolvedSecondaryRightAction} theme={theme} position="right" />
          )}
          <ActionButton action={resolvedRightAction} theme={theme} position="right" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  titlePressable: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  title: {
    fontWeight: '600',
    textAlign: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 80,
    justifyContent: 'flex-end',
  },
});
