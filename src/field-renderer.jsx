import React, { useState, useCallback, useMemo } from 'react';
import { View, Pressable, Modal, ScrollView, Platform, Image as RNImage } from 'react-native';
import { Info, X, ImageIcon } from 'lucide-react-native';
import { useFieldRegistry } from './field-registry-context.jsx';
import { useTheme } from './theme-context.jsx';
import { useImageResolver } from './image-resolver-context.jsx';
import { Text } from './typography.jsx';

const LABEL_SIDE = 'side';

export function FieldRenderer({
  field,
  value,
  onChange,
  readOnly,
  required,
  error,
  labelPosition = 'top',
  labelWidthPercent = 30,
  onKeyDown,
  onFocus,
  inputRef,
  showError = true,
}) {
  const registry = useFieldRegistry();
  const { theme } = useTheme();
  const resolveImage = useImageResolver();
  const [isDescriptionModalOpen, setDescriptionModalOpen] = useState(false);
  const [isImageModalOpen, setImageModalOpen] = useState(false);

  const FieldComponent = registry.getFieldComponent(field.type);
  const isLabelField = field.type === 'LabelField';
  const effectiveLabelPosition = isLabelField ? 'top' : labelPosition;
  const isLabelSide = effectiveLabelPosition === LABEL_SIDE;

  // Description mode handling (matches web behavior)
  const descriptionMode = field.description_mode || 'default';
  const hasDescription = field.description && typeof field.description === 'string';
  const hasSubtextDescription = hasDescription && descriptionMode === 'subtext';
  const hasDialogDescription = hasDescription && descriptionMode !== 'subtext';

  // Supporting image handling
  const supportingImage = useMemo(() => {
    if (!field.supporting_image) return null;
    if (!field.supporting_image_path) return null;
    const displayMode = field.supporting_image_display || 'default';
    return { path: field.supporting_image_path, displayMode };
  }, [field.supporting_image, field.supporting_image_path, field.supporting_image_display]);

  const hasDialogImage = supportingImage && supportingImage.displayMode === 'dialog';
  const hasInlineImage = supportingImage && supportingImage.displayMode !== 'dialog';

  // Resolve the image source using the image resolver
  const resolvedImageSource = useMemo(() => {
    if (!supportingImage) return null;
    return resolveImage(supportingImage.path);
  }, [supportingImage, resolveImage]);

  const openDescriptionModal = useCallback(() => {
    setDescriptionModalOpen(true);
  }, []);

  const closeDescriptionModal = useCallback(() => {
    setDescriptionModalOpen(false);
  }, []);

  const openImageModal = useCallback(() => {
    setImageModalOpen(true);
  }, []);

  const closeImageModal = useCallback(() => {
    setImageModalOpen(false);
  }, []);

  if (!FieldComponent) {
    return (
      <View style={{ marginBottom: 16 }}>
        <View style={styles.labelRow}>
          <Text style={{ fontWeight: theme.fontWeight.medium, color: theme.color.label, flex: 1 }}>
            {field.label} {required ? '*' : ''}
          </Text>
        </View>
        <Text style={{ color: theme.color.error }}>Unsupported field type: {field.type}</Text>
      </View>
    );
  }

  const label = field.label || field.data_name || '';

  // Render label control icons (info, image, etc.)
  const renderLabelControls = () => {
    const controls = [];

    // Supporting image icon (when display mode is 'dialog' and image is resolvable)
    if (hasDialogImage && resolvedImageSource) {
      controls.push(
        <Pressable
          key="supporting-image"
          onPress={openImageModal}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          accessibilityLabel={`View supporting image for ${label}`}
          accessibilityRole="button"
        >
          <ImageIcon size={16} color={theme.color.icon} strokeWidth={2} />
        </Pressable>
      );
    }

    // Description info icon (when display mode is not 'subtext')
    if (hasDialogDescription) {
      controls.push(
        <Pressable
          key="description"
          onPress={openDescriptionModal}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          accessibilityLabel={`View description for ${label}`}
          accessibilityRole="button"
        >
          <Info size={16} color={theme.color.icon} strokeWidth={2} />
        </Pressable>
      );
    }

    if (controls.length === 0) return null;

    return <View style={styles.controlsContainer}>{controls}</View>;
  };

  const fieldContainerStyle = {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    marginBottom: theme.spacing.xs,
  };

  // Label row with text and controls
  const labelNode = (
    <View style={styles.labelRow}>
      <Text
        style={{
          fontWeight: theme.fontWeight.medium,
          color: theme.color.label,
          flex: 1,
          fontSize: theme.fontSize.base,
        }}
      >
        {label} {required ? '*' : ''}
      </Text>
      {renderLabelControls()}
    </View>
  );

  // Subtext description (shown below label)
  const subtextNode = hasSubtextDescription ? (
    <Text
      style={[
        styles.subtextDescription,
        { color: theme.color.description, fontSize: theme.fontSize.subtext || theme.fontSize.sm },
      ]}
    >
      {field.description}
    </Text>
  ) : null;

  // Inline supporting image (when display mode is 'default' or not 'dialog')
  const inlineImageNode =
    hasInlineImage && resolvedImageSource ? (
      <View style={styles.inlineImageContainer}>
        <RNImage
          source={resolvedImageSource}
          style={styles.inlineImage}
          resizeMode="contain"
          accessibilityLabel={`Supporting image for ${label}`}
        />
      </View>
    ) : null;

  const inputProps = {
    name: field.data_name,
    readOnly,
    required,
    onFocus,
    ref: inputRef,
  };

  const fieldInput = isLabelField ? null : (
    <FieldComponent
      field={field}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      readOnly={readOnly}
      inputProps={inputProps}
    />
  );

  // Error container with reserved height to prevent layout shifts
  const errorNode = showError ? (
    <View style={{ minHeight: 18, marginTop: 4 }}>
      {error ? (
        <Text style={{ color: theme.color.error, fontSize: theme.fontSize.xs, lineHeight: 16 }}>
          {error}
        </Text>
      ) : null}
    </View>
  ) : null;

  // Description modal (for default mode)
  const descriptionModal = hasDialogDescription ? (
    <Modal
      visible={isDescriptionModalOpen}
      transparent
      animationType="fade"
      onRequestClose={closeDescriptionModal}
      statusBarTranslucent
    >
      <Pressable style={styles.modalBackdrop} onPress={closeDescriptionModal}>
        <Pressable
          style={[styles.modalContent, { backgroundColor: theme.color.background }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.color.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Info size={18} color={theme.color.primary} strokeWidth={2} />
              <Text
                style={[
                  styles.modalTitle,
                  { color: theme.color.foreground, fontSize: theme.fontSize.md || theme.fontSize.base },
                ]}
              >
                Field Information
              </Text>
            </View>
            <Pressable
              onPress={closeDescriptionModal}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <X size={20} color={theme.color.icon} strokeWidth={2} />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView
            style={{ maxHeight: 300 }}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={[
                styles.modalFieldLabel,
                { color: theme.color.foreground, fontSize: theme.fontSize.base },
              ]}
            >
              {label}
            </Text>
            <Text
              style={[
                styles.modalDescription,
                { color: theme.color.description, fontSize: theme.fontSize.sm },
              ]}
            >
              {field.description}
            </Text>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.modalFooter, { borderTopColor: theme.color.border }]}>
            <Pressable
              onPress={closeDescriptionModal}
              style={({ pressed }) => [
                styles.modalButton,
                {
                  backgroundColor: pressed ? theme.color.buttonHoverBg : theme.color.buttonBg,
                },
              ]}
            >
              <Text style={{ color: theme.color.buttonFg, fontWeight: '600' }}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  ) : null;

  // Image modal (for supporting images in dialog mode)
  const imageModal =
    hasDialogImage && resolvedImageSource ? (
      <Modal
        visible={isImageModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeImageModal}
        statusBarTranslucent
      >
        <Pressable style={styles.modalBackdrop} onPress={closeImageModal}>
          <Pressable
            style={[styles.imageModalContent, { backgroundColor: theme.color.background }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.color.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <ImageIcon size={18} color={theme.color.primary} strokeWidth={2} />
                <Text
                  style={[
                    styles.modalTitle,
                    { color: theme.color.foreground, fontSize: theme.fontSize.md || theme.fontSize.base },
                  ]}
                >
                  Supporting Image
                </Text>
              </View>
              <Pressable
                onPress={closeImageModal}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <X size={20} color={theme.color.icon} strokeWidth={2} />
              </Pressable>
            </View>

            {/* Image Content */}
            <View style={styles.imageModalBody}>
              <RNImage
                source={resolvedImageSource}
                style={styles.modalImage}
                resizeMode="contain"
                accessibilityLabel={`Supporting image for ${label}`}
              />
              <Text
                style={[
                  styles.imageCaption,
                  {
                    color: theme.color.description,
                    borderTopColor: theme.color.border,
                    fontSize: theme.fontSize.sm,
                  },
                ]}
              >
                {label}
              </Text>
            </View>

            {/* Footer */}
            <View style={[styles.modalFooter, { borderTopColor: theme.color.border }]}>
              <Pressable
                onPress={closeImageModal}
                style={({ pressed }) => [
                  styles.modalButton,
                  {
                    backgroundColor: pressed ? theme.color.buttonHoverBg : theme.color.buttonBg,
                  },
                ]}
              >
                <Text style={{ color: theme.color.buttonFg, fontWeight: '600' }}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    ) : null;

  // LabelField content (no input, just label)
  if (isLabelField) {
    return (
      <View style={fieldContainerStyle}>
        {labelNode}
        {subtextNode}
        {inlineImageNode}
        {descriptionModal}
        {imageModal}
      </View>
    );
  }

  // Side label layout
  if (isLabelSide) {
    return (
      <View style={[fieldContainerStyle, { flexDirection: 'row' }]}>
        <View style={{ width: `${labelWidthPercent}%`, marginRight: 12 }}>
          {labelNode}
          {subtextNode}
        </View>
        <View style={{ flex: 1 }}>
          {inlineImageNode}
          {fieldInput}
          {errorNode}
        </View>
        {descriptionModal}
        {imageModal}
      </View>
    );
  }

  // Top label layout (default)
  return (
    <View style={fieldContainerStyle}>
      {labelNode}
      {subtextNode}
      {inlineImageNode}
      {fieldInput}
      {errorNode}
      {descriptionModal}
      {imageModal}
    </View>
  );
}

// Styles
const styles = {
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  iconButton: {
    padding: 4,
    borderRadius: 4,
  },
  iconButtonPressed: {
    opacity: 0.6,
  },
  subtextDescription: {
    marginTop: 2,
    marginBottom: 4,
    lineHeight: 18,
  },
  inlineImageContainer: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  inlineImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 12,
    maxWidth: 400,
    width: '100%',
    maxHeight: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  imageModalContent: {
    borderRadius: 12,
    maxWidth: 500,
    width: '100%',
    maxHeight: '85%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontWeight: '600',
    marginLeft: 8,
  },
  modalFieldLabel: {
    fontWeight: '600',
    marginBottom: 8,
  },
  modalDescription: {
    lineHeight: 20,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  imageModalBody: {
    padding: 16,
  },
  modalImage: {
    width: '100%',
    height: 250,
    borderRadius: 8,
  },
  imageCaption: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    textAlign: 'center',
  },
};
