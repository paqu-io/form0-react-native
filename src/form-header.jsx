import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { XCircle, SendHorizontal, Pencil } from 'lucide-react-native';
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

/**
 * Mobile-native form header with action buttons.
 * Fixed at the top with Cancel on left, title in center, and Submit/Edit on right.
 *
 * The header background color changes based on mode:
 * - View mode: Amber background (same as web bannerViewBg)
 * - Edit mode: Light blue background (same as web bannerEditBg)
 *
 * Button styling matches the web version:
 * - Submit button: Vivid pink (#ff007a) in light mode, vivid green (#00ffae) in dark mode
 * - Cancel button: Soft neutral styling
 * - Edit button: Soft blue styling
 *
 * Icons match the web version:
 * - Cancel: XCircle
 * - Submit: SendHorizontal
 * - Edit: Pencil
 */
export function FormHeader({
  formName,
  mode = 'edit',
  onCancel,
  onSubmit,
  onEnterEditMode,
  canSubmit = true,
  showPrimaryActionsInViewMode = true,
  style,
  includeSafeArea = true,
}) {
  // Get theme from context
  const { theme } = useTheme();

  // Get safe area insets if available
  const insets = useSafeAreaInsets ? useSafeAreaInsets() : { top: 0 };
  const topPadding = includeSafeArea ? insets.top : 0;

  const isReadOnly = mode === 'readonly';
  const showSubmit = !isReadOnly && typeof onSubmit === 'function';
  const showEdit = isReadOnly && typeof onEnterEditMode === 'function';

  // Mode-based header colors
  const headerBg = isReadOnly ? theme.color.bannerViewBg : theme.color.bannerEditBg;
  const headerBorderColor = isReadOnly
    ? theme.color.bannerViewBorder
    : theme.color.bannerEditBorder;
  const titleColor = isReadOnly ? theme.color.bannerViewFg : theme.color.bannerEditFg;

  const renderLeftAction = () => {
    if (typeof onCancel !== 'function') {
      return <View style={styles.actionSlot} />;
    }

    return (
      <Pressable
        onPress={onCancel}
        hitSlop={HIT_SLOP}
        style={({ pressed }) => [
          styles.actionButton,
          {
            backgroundColor: theme.color.cancelBg,
            borderColor: theme.color.cancelBorder,
            borderWidth: 1,
          },
          pressed && { backgroundColor: theme.color.cancelHoverBg || theme.color.cancelBg },
        ]}
        accessibilityLabel="Cancel"
        accessibilityRole="button"
      >
        <XCircle size={18} color={theme.color.cancelFg} strokeWidth={2} />
        <Text style={[styles.buttonText, { color: theme.color.cancelFg }]}>Cancel</Text>
      </Pressable>
    );
  };

  const renderRightAction = () => {
    // In view mode, show Edit button
    if (showEdit) {
      return (
        <Pressable
          onPress={onEnterEditMode}
          hitSlop={HIT_SLOP}
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: theme.color.editBg,
              borderColor: theme.color.editBorder,
              borderWidth: 1,
            },
            pressed && { backgroundColor: theme.color.editHoverBg || theme.color.editBg },
          ]}
          accessibilityLabel="Edit"
          accessibilityRole="button"
        >
          <Pencil size={16} color={theme.color.editFg} strokeWidth={2} />
          <Text style={[styles.buttonText, { color: theme.color.editFg }]}>Edit</Text>
        </Pressable>
      );
    }

    // In edit mode, show Submit button
    if (showSubmit) {
      const isDisabled = !canSubmit;
      return (
        <Pressable
          onPress={isDisabled ? undefined : onSubmit}
          hitSlop={HIT_SLOP}
          disabled={isDisabled}
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: isDisabled ? theme.color.inputDisabledBg : theme.color.buttonBg,
              borderColor: isDisabled ? theme.color.inputDisabledBg : theme.color.buttonBorder,
              borderWidth: 1,
            },
            pressed && !isDisabled && { backgroundColor: theme.color.buttonHoverBg },
          ]}
          accessibilityLabel="Submit"
          accessibilityRole="button"
          accessibilityState={{ disabled: isDisabled }}
        >
          <Text
            style={[
              styles.buttonText,
              {
                color: isDisabled ? theme.color.inputDisabledFg : theme.color.buttonFg,
              },
            ]}
          >
            Submit
          </Text>
          <SendHorizontal
            size={16}
            color={isDisabled ? theme.color.inputDisabledFg : theme.color.buttonFg}
            strokeWidth={2}
          />
        </Pressable>
      );
    }

    return <View style={styles.actionSlot} />;
  };

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
        {renderLeftAction()}

        <View style={styles.titleContainer}>
          {formName ? (
            <Text style={[styles.title, { color: titleColor }]} numberOfLines={1} ellipsizeMode="tail">
              {formName}
            </Text>
          ) : null}
        </View>

        {renderRightAction()}
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
