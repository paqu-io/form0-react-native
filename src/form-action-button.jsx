import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { XCircle, SendHorizontal, Pencil, ChevronLeft, Plus, Save } from 'lucide-react-native';
import { Text } from './typography.jsx';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

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
  'enter-entry-edit-mode': Pencil,
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
export function FormActionButton({ action, theme, position }) {
  if (!action || typeof action.onPress !== 'function') {
    return <View style={styles.actionSlot} />;
  }

  const { id, label, variant = 'cancel', disabled = false, icon: CustomIcon } = action;
  const Icon = Object.prototype.hasOwnProperty.call(action, 'icon')
    ? CustomIcon
    : ACTION_ICONS[id] || null;
  const buttonStyle = getButtonStyle(variant, theme, disabled);
  const iconPosition =
    position === 'right' && (id === 'add-repeatable' || id === 'add')
      ? 'left'
      : position === 'left'
        ? 'left'
        : 'right';

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
      <Text
        style={[styles.buttonText, { color: buttonStyle.textColor, fontSize: theme.fontSize.base }]}
      >
        {label}
      </Text>
      {iconPosition === 'right' && Icon && (
        <Icon size={16} color={buttonStyle.textColor} strokeWidth={2} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionSlot: { minWidth: 80 },
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
    fontWeight: '500',
  },
});
