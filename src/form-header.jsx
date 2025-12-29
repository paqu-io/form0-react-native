import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { XCircle, SendHorizontal, Pencil, ChevronLeft, Plus, Save } from 'lucide-react-native';
import { useTheme } from './theme-context.jsx';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

// Safe area context is optional - will use it if available
let useSafeAreaInsets;
try {
  const safeAreaModule = require('react-native-safe-area-context');
  useSafeAreaInsets = safeAreaModule.useSafeAreaInsets;
} catch {
  useSafeAreaInsets = null;
}

// Map action IDs to icons
const ACTION_ICONS = {
  back: ChevronLeft,
  'cancel-section': XCircle,
  'cancel-root': XCircle,
  cancel: XCircle,
  submit: SendHorizontal,
  'save-section': Save,
  save: Save,
  'add-repeatable': Plus,
  add: Plus,
  'enter-edit-mode': Pencil,
  edit: Pencil,
};

/**
 * Get button style based on action variant and theme
 */
function getButtonStyle(variant, theme, isDisabled) {
  if (isDisabled) {
    return {
      backgroundColor: theme.color.inputDisabledBg,
      borderColor: theme.color.inputDisabledBg,
      textColor: theme.color.inputDisabledFg,
    };
  }

  switch (variant) {
    case 'primary':
      return {
        backgroundColor: theme.color.buttonBg,
        borderColor: theme.color.buttonBorder,
        textColor: theme.color.buttonFg,
        hoverBg: theme.color.buttonHoverBg,
      };
    case 'back':
      return {
        backgroundColor: theme.color.backButtonBg || theme.color.cancelBg,
        borderColor: theme.color.backButtonBg || theme.color.cancelBorder,
        textColor: theme.color.backButtonFg || theme.color.cancelFg,
        hoverBg: theme.color.cancelHoverBg,
      };
    case 'edit':
      return {
        backgroundColor: theme.color.editBg,
        borderColor: theme.color.editBorder,
        textColor: theme.color.editFg,
        hoverBg: theme.color.editHoverBg || theme.color.editBg,
      };
    case 'cancel':
    default:
      return {
        backgroundColor: theme.color.cancelBg,
        borderColor: theme.color.cancelBorder,
        textColor: theme.color.cancelFg,
        hoverBg: theme.color.cancelHoverBg || theme.color.cancelBg,
      };
  }
}

/**
 * Render an action button based on action configuration
 */
function ActionButton({ action, theme, position }) {
  if (!action || typeof action.onPress !== 'function') {
    return <View style={styles.actionSlot} />;
  }

  const { id, label, variant = 'cancel', disabled = false, icon: CustomIcon } = action;
  const Icon = CustomIcon || ACTION_ICONS[id] || null;
  const buttonStyle = getButtonStyle(variant, theme, disabled);
  const iconPosition = position === 'left' ? 'left' : 'right';

  return (
    <Pressable
      onPress={disabled ? undefined : action.onPress}
      hitSlop={HIT_SLOP}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: buttonStyle.backgroundColor,
          borderColor: buttonStyle.borderColor,
          borderWidth: 1,
          opacity: disabled ? 0.5 : 1,
        },
        pressed && !disabled && buttonStyle.hoverBg && { backgroundColor: buttonStyle.hoverBg },
      ]}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {iconPosition === 'left' && Icon && (
        <Icon size={16} color={buttonStyle.textColor} strokeWidth={2} />
      )}
      <Text style={[styles.buttonText, { color: buttonStyle.textColor }]}>{label}</Text>
      {iconPosition === 'right' && Icon && (
        <Icon size={16} color={buttonStyle.textColor} strokeWidth={2} />
      )}
    </Pressable>
  );
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
          {formName ? (
            <Text style={[styles.title, { color: titleColor }]} numberOfLines={1} ellipsizeMode="tail">
              {formName}
            </Text>
          ) : null}
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
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionSlot: {
    minWidth: 80,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 80,
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 80,
    gap: 6,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
