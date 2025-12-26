import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormEngine } from './use-form-engine';
import { FieldRenderer } from './field-renderer';
import { FieldRegistryProvider } from './field-registry-context.jsx';
import {
  ScrollView,
  Button,
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  UIManager,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import { isFieldValueEmpty } from './helpers/is-field-value-empty.js';
import {
  buildRepeatableInfo,
  cloneDeep,
  createEmptyRepeatableInstance,
} from './utils/repeatable-manager.js';
import { useRepeatableInstanceEngine } from './use-repeatable-instance.js';

const SECTION_TYPES = new Set(['Section', 'BuildingPlanSection']);
const REPEATABLE_TYPE = 'RepeatableSection';
const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';
const KEYBOARD_DISMISS_MODE = Platform.OS === 'ios' ? 'interactive' : 'on-drag';
const DEFAULT_SCROLL_OFFSET = 24;

const FormScrollView = React.forwardRef(function FormScrollView(
  { children, contentContainerStyle, onScroll, onLayout, ...props },
  ref
) {
  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={KEYBOARD_DISMISS_MODE}
      contentInsetAdjustmentBehavior="always"
      automaticallyAdjustKeyboardInsets
      onScroll={onScroll}
      onLayout={onLayout}
      scrollEventThrottle={16}
      contentContainerStyle={[{ padding: 16, paddingBottom: 32 }, contentContainerStyle]}
      {...props}
    >
      {children}
    </ScrollView>
  );
});

const KeyboardFormScrollView = React.forwardRef(function KeyboardFormScrollView(
  { children, contentContainerStyle, ...props },
  ref
) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
      <FormScrollView ref={ref} contentContainerStyle={contentContainerStyle} {...props}>
        {children}
      </FormScrollView>
    </KeyboardAvoidingView>
  );
});

function useKeyboardAwareScroll({ scrollOffset = DEFAULT_SCROLL_OFFSET } = {}) {
  const scrollRef = useRef(null);
  const scrollYRef = useRef(0);
  const keyboardHeightRef = useRef(0);
  const pendingTargetRef = useRef(null);
  const lastScrollRef = useRef({ target: null, keyboardHeight: 0 });
  const scrollLayoutRef = useRef({ y: 0, height: 0 });
  const { height: windowHeight } = useWindowDimensions();

  const updateScrollLayout = useCallback((callback) => {
    const nodeHandle = findNodeHandle(scrollRef.current);
    if (!nodeHandle) {
      if (typeof callback === 'function') callback();
      return;
    }
    UIManager.measureInWindow(nodeHandle, (x, y, width, height) => {
      scrollLayoutRef.current = { y, height };
      if (typeof callback === 'function') callback();
    });
  }, []);

  const scrollToTarget = useCallback(
    (target) => {
      if (!target || !scrollRef.current) return;
      const nodeHandle = typeof target === 'number' ? target : findNodeHandle(target);
      if (!nodeHandle) return;
      UIManager.measureInWindow(nodeHandle, (x, y, width, height) => {
        const keyboardHeight = keyboardHeightRef.current || 0;
        const scrollLayout = scrollLayoutRef.current;
        const containerBottom = scrollLayout?.height
          ? scrollLayout.y + scrollLayout.height
          : windowHeight;
        const layoutBottomGap = Math.max(0, windowHeight - containerBottom);
        const effectiveKeyboardHeight = Math.max(0, keyboardHeight - layoutBottomGap);
        const visibleBottom = containerBottom - effectiveKeyboardHeight - scrollOffset;
        const elementBottom = y + height + scrollOffset;
        if (elementBottom <= visibleBottom) return;
        const delta = elementBottom - visibleBottom;
        scrollRef.current?.scrollTo?.({
          y: Math.max(0, scrollYRef.current + delta),
          animated: true,
        });
      });
    },
    [scrollOffset, windowHeight]
  );

  useEffect(() => {
    const handleKeyboardShow = (event) => {
      keyboardHeightRef.current = event?.endCoordinates?.height ?? 0;
      updateScrollLayout(() => {
        if (!pendingTargetRef.current) return;
        const signature = {
          target: pendingTargetRef.current,
          keyboardHeight: keyboardHeightRef.current,
        };
        if (
          lastScrollRef.current.target === signature.target &&
          lastScrollRef.current.keyboardHeight === signature.keyboardHeight
        ) {
          return;
        }
        lastScrollRef.current = signature;
        scrollToTarget(pendingTargetRef.current);
      });
    };
    const showSub =
      Platform.OS === 'ios'
        ? Keyboard.addListener('keyboardWillShow', handleKeyboardShow)
        : Keyboard.addListener('keyboardDidShow', handleKeyboardShow);
    const changeSub =
      Platform.OS === 'ios'
        ? Keyboard.addListener('keyboardWillChangeFrame', handleKeyboardShow)
        : null;
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardHeightRef.current = 0;
    });
    return () => {
      showSub.remove();
      changeSub?.remove?.();
      hideSub.remove();
    };
  }, [scrollToTarget]);

  const handleScroll = useCallback((event) => {
    const offsetY = event?.nativeEvent?.contentOffset?.y;
    if (typeof offsetY === 'number') {
      scrollYRef.current = offsetY;
    }
  }, []);

  const handleFieldFocus = useCallback(
    (event) => {
      const target = event?.target ?? event?.nativeEvent?.target;
      if (!target) return;
      pendingTargetRef.current = target;
      lastScrollRef.current = { target: null, keyboardHeight: 0 };
      if (keyboardHeightRef.current > 0) {
        updateScrollLayout(() => {
          requestAnimationFrame(() => scrollToTarget(target));
        });
      }
    },
    [scrollToTarget, updateScrollLayout]
  );

  return {
    scrollRef,
    onScroll: handleScroll,
    onFieldFocus: handleFieldFocus,
    onLayout: updateScrollLayout,
  };
}

export function FormRenderer({
  schema,
  initialValues = {},
  overrideValues,
  onSubmit,
  mode = 'edit',
  keyboardScrollOffset = DEFAULT_SCROLL_OFFSET,
  debug = false,
  onSchemaReady,
  labelPosition = 'top',
  labelWidthPercent = 30,
  renderers,
  registry,
}) {
  const mainScroll = useKeyboardAwareScroll({ scrollOffset: keyboardScrollOffset });
  const {
    values,
    visible,
    read_only,
    required,
    errors,
    setValue,
    submit,
    schema: finalSchema,
  } = useFormEngine(schema, initialValues, overrideValues);
  const [submitCount, setSubmitCount] = useState(0);
  const [repeatableState, setRepeatableState] = useState({});
  const [repeatableStack, setRepeatableStack] = useState([]);

  useEffect(() => {
    if (onSchemaReady) onSchemaReady(finalSchema);
  }, [finalSchema]);

  const elements = finalSchema?.form?.elements || [];
  const repeatableMetadata = useMemo(
    () => buildRepeatableInfo(elements),
    [elements]
  );

  const resolveRepeatableContainer = useCallback(
    (state, path = [], { createIfMissing = false } = {}) => {
      let container = state || {};
      if (!Array.isArray(path) || path.length === 0) {
        return container;
      }
      for (const segment of path) {
        if (!segment || typeof segment.key !== 'string') {
          return null;
        }
        const list = container?.[segment.key];
        if (!Array.isArray(list)) {
          return null;
        }
        const targetIndex = list.findIndex((instance) => instance.id === segment.id);
        if (targetIndex === -1) {
          return null;
        }
        const target = list[targetIndex];
        if (!target.repeatable || typeof target.repeatable !== 'object') {
          if (createIfMissing) {
            target.repeatable = {};
          } else {
            return null;
          }
        }
        container = target.repeatable;
      }
      return container;
    },
    []
  );

  const getRepeatableInstances = useCallback(
    (repeatableKey, parentPath = []) => {
      const container = resolveRepeatableContainer(repeatableState, parentPath);
      const list = container?.[repeatableKey];
      return Array.isArray(list) ? list : [];
    },
    [repeatableState, resolveRepeatableContainer]
  );

  const getRepeatableInstance = useCallback(
    (repeatableKey, instanceId, parentPath = []) => {
      const list = getRepeatableInstances(repeatableKey, parentPath);
      return list.find((instance) => instance.id === instanceId) || null;
    },
    [getRepeatableInstances]
  );

  const setRepeatableInstances = useCallback(
    (repeatableKey, instances = [], parentPath = []) => {
      setRepeatableState((prev) => {
        const base = prev && typeof prev === 'object' ? prev : {};
        const draft = cloneDeep(base);
        const container =
          resolveRepeatableContainer(draft, parentPath, { createIfMissing: true }) || draft;
        container[repeatableKey] = Array.isArray(instances) ? cloneDeep(instances) : [];
        return draft;
      });
    },
    [resolveRepeatableContainer]
  );

  const addRepeatableInstance = useCallback(
    (repeatableKey, instance, parentPath = []) => {
      setRepeatableState((prev) => {
        const base = prev && typeof prev === 'object' ? prev : {};
        const draft = cloneDeep(base);
        const container =
          resolveRepeatableContainer(draft, parentPath, { createIfMissing: true }) || draft;
        if (!Array.isArray(container[repeatableKey])) {
          container[repeatableKey] = [];
        }
        container[repeatableKey].push(instance);
        return draft;
      });
    },
    [resolveRepeatableContainer]
  );

  const updateRepeatableInstance = useCallback(
    (repeatableKey, instanceId, payload, parentPath = []) => {
      setRepeatableState((prev) => {
        const base = prev && typeof prev === 'object' ? prev : {};
        const draft = cloneDeep(base);
        const container = resolveRepeatableContainer(draft, parentPath);
        if (!container) {
          return base;
        }
        const list = container[repeatableKey];
        if (!Array.isArray(list)) {
          return base;
        }
        const index = list.findIndex((instance) => instance.id === instanceId);
        if (index === -1) {
          return base;
        }
        list[index] = payload;
        return draft;
      });
    },
    [resolveRepeatableContainer]
  );

  const removeRepeatableInstance = useCallback(
    (repeatableKey, instanceId, parentPath = []) => {
      setRepeatableState((prev) => {
        const base = prev && typeof prev === 'object' ? prev : {};
        const draft = cloneDeep(base);
        const container = resolveRepeatableContainer(draft, parentPath);
        if (!container) {
          return base;
        }
        const list = container[repeatableKey];
        if (!Array.isArray(list)) {
          return base;
        }
        const index = list.findIndex((instance) => instance.id === instanceId);
        if (index === -1) {
          return base;
        }
        list.splice(index, 1);
        return draft;
      });
    },
    [resolveRepeatableContainer]
  );

  const buildParentValuesForPath = useCallback(
    (path = []) => {
      let merged = { ...values };
      const traversePath = [];
      path.forEach(({ key, id }) => {
        const instance = getRepeatableInstance(key, id, traversePath);
        if (instance?.values) {
          merged = { ...merged, ...instance.values };
        }
        traversePath.push({ key, id });
      });
      return merged;
    },
    [getRepeatableInstance, values]
  );

  const formRepeatableController = useMemo(
    () => ({
      repeatableMetadata,
      getInstances: getRepeatableInstances,
      setInstances: setRepeatableInstances,
      getInstance: getRepeatableInstance,
      buildParentValues: buildParentValuesForPath,
    }),
    [
      buildParentValuesForPath,
      getRepeatableInstance,
      getRepeatableInstances,
      repeatableMetadata,
      setRepeatableInstances,
    ]
  );

  const resolveRepeatableInfo = useCallback((field, metadata) => {
    if (!field || !metadata?.repeatableSectionTree) {
      return { repeatableKey: null, repInfo: null };
    }
    const repInfo = field.data_name ? metadata.repeatableSectionTree.get(field.data_name) : null;
    const repeatableKey = repInfo?.preferredKey || field.key || field.data_name;
    return { repeatableKey, repInfo };
  }, []);

  const pushRepeatableScreen = useCallback((screen) => {
    setRepeatableStack((prev) => [...prev, screen]);
  }, []);

  const popRepeatableScreen = useCallback(() => {
    setRepeatableStack((prev) => prev.slice(0, -1));
  }, []);

  const openRepeatableList = useCallback(
    ({ field, controller, parentPath }) => {
      const { repeatableKey, repInfo } = resolveRepeatableInfo(
        field,
        controller?.repeatableMetadata
      );
      if (!repeatableKey || !repInfo) {
        console.warn('form0-react-native: unable to resolve repeatable metadata.');
        return;
      }
      pushRepeatableScreen({
        type: 'list',
        field,
        repeatableKey,
        repInfo,
        controller,
        parentPath,
      });
    },
    [pushRepeatableScreen, resolveRepeatableInfo]
  );

  const openRepeatableEditor = useCallback(
    ({ field, controller, parentPath, repeatableKey, repInfo, instanceId, mode, draft }) => {
      pushRepeatableScreen({
        type: 'edit',
        field,
        controller,
        parentPath,
        repeatableKey,
        repInfo,
        instanceId,
        mode,
        draft,
      });
    },
    [pushRepeatableScreen]
  );

  const renderElements = useCallback(
    (
      items = [],
      {
        state,
        setValue: applyValue,
        readOnly,
        submitCount: localSubmitCount = 0,
        controller,
        parentPath = [],
        onFieldFocus,
      }
    ) =>
      items.map((field) => {
        if (!field) return null;

        if (field.type === REPEATABLE_TYPE) {
          const { repeatableKey, repInfo } = resolveRepeatableInfo(
            field,
            controller?.repeatableMetadata
          );
          if (!repeatableKey || !repInfo) {
            return null;
          }
          const instances = controller?.getInstances(repeatableKey, parentPath) || [];
          const count = instances.length;
          const countLabel = `${count} item${count === 1 ? '' : 's'}`;
          const countPillStyle = {
            paddingVertical: 2,
            paddingHorizontal: 8,
            borderRadius: 999,
            backgroundColor: count === 0 ? '#eef0f6' : '#e0e7ff',
            alignSelf: 'flex-start',
          };
          const countTextStyle = {
            fontSize: 12,
            color: count === 0 ? '#6b7280' : '#1f2937',
            fontWeight: '600',
          };
          return (
            <View
              key={field.key || field.data_name}
              style={{
                borderWidth: 1,
                borderColor: '#e1e1ea',
                borderRadius: 14,
                padding: 14,
                marginBottom: 16,
                backgroundColor: '#fff',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <Text style={{ fontWeight: '700', fontSize: 16 }}>
                  {field.label || 'Repeatable Section'}
                </Text>
                <View style={countPillStyle}>
                  <Text style={countTextStyle}>{countLabel}</Text>
                </View>
              </View>
              {field.description ? (
                <Text style={{ color: '#6b7280', marginBottom: 10 }}>
                  {field.description}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {!readOnly && (
                  <Pressable
                    onPress={() => {
                      const draft = createEmptyRepeatableInstance(repInfo);
                      openRepeatableEditor({
                        field,
                        controller,
                        parentPath,
                        repeatableKey,
                        repInfo,
                        instanceId: draft.id,
                        mode: 'create',
                        draft,
                      });
                    }}
                    style={({ pressed }) => ({
                      alignSelf: 'flex-start',
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: pressed ? '#1d4ed8' : '#2563eb',
                      marginRight: 8,
                    })}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Add entry</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() =>
                    openRepeatableList({ field, controller, parentPath })
                  }
                  style={({ pressed }) => ({
                    alignSelf: 'flex-start',
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: pressed ? '#e6e7f0' : '#eef0f7',
                  })}
                >
                  <Text style={{ color: '#374151' }}>
                    {readOnly ? 'View' : 'Manage'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }

        if (SECTION_TYPES.has(field.type)) {
          const sectionId = field.data_name || field.key || Math.random().toString(36);
          return (
            <View key={sectionId} style={{ marginBottom: 16 }}>
              {field.label ? (
                <Text style={{ fontWeight: '700', marginBottom: 8 }}>{field.label}</Text>
              ) : null}
              {field.description ? (
                <Text style={{ color: '#555', marginBottom: 8 }}>{field.description}</Text>
              ) : null}
              <View style={{ paddingLeft: 8 }}>
                {renderElements(field.elements || [], {
                  state,
                  setValue: applyValue,
                  readOnly,
                  submitCount: localSubmitCount,
                  controller,
                  parentPath,
                  onFieldFocus,
                })}
              </View>
            </View>
          );
        }

        const dataName = field.data_name;
        if (dataName && state?.visible?.[dataName] === false) {
          return null;
        }

        const fieldValue = dataName ? state?.values?.[dataName] : null;
        const fieldRequired = dataName ? Boolean(state?.required?.[dataName]) : false;
        const fieldReadOnly =
          readOnly ||
          (dataName ? Boolean(state?.read_only?.[dataName]) : false) ||
          field.type === 'TitleField';
        const engineError = dataName ? state?.errors?.[dataName] : null;
        const requiredError =
          fieldRequired && localSubmitCount > 0 && isFieldValueEmpty(field, fieldValue)
            ? 'This field is required'
            : null;
        const fieldError = engineError || requiredError;

        return (
          <FieldRenderer
            key={field.key || dataName}
            field={field}
            value={fieldValue}
            readOnly={fieldReadOnly}
            required={fieldRequired}
            error={fieldError}
            labelPosition={labelPosition}
            labelWidthPercent={labelWidthPercent}
            onFocus={onFieldFocus}
            onChange={(val) => {
              if (dataName) applyValue(dataName, val);
            }}
          />
        );
      }),
    [
      labelPosition,
      labelWidthPercent,
      openRepeatableEditor,
      openRepeatableList,
      resolveRepeatableInfo,
    ]
  );

  const canSubmit = mode !== 'readonly' && typeof onSubmit === 'function';
  const activeRepeatableScreen = repeatableStack[repeatableStack.length - 1] || null;

  const getRepeatableEntryTitle = (field, instance, index) => {
    const titleFieldDataName = field?.title_field?.data_name;
    if (titleFieldDataName && instance?.values?.[titleFieldDataName]) {
      return String(instance.values[titleFieldDataName]);
    }
    const fallbackKeys = ['title', 'name', 'label'];
    for (const key of fallbackKeys) {
      if (instance?.values?.[key]) {
        return String(instance.values[key]);
      }
    }
    return `${field?.label || 'Entry'} ${index + 1}`;
  };

  const getChoiceLabel = (field, choice) => {
    if (!choice) return '';
    if (typeof choice.label === 'string' && choice.label.trim() !== '') {
      return choice.label.trim();
    }
    if (choice.value != null) {
      const match = Array.isArray(field?.choices)
        ? field.choices.find((c) => c?.value === choice.value)
        : null;
      if (match && typeof match.label === 'string' && match.label.trim() !== '') {
        return match.label.trim();
      }
      return String(choice.value);
    }
    return '';
  };

  const formatFieldValue = (field, value) => {
    if (value == null) return '';
    switch (field.type) {
      case 'SingleChoiceField':
      case 'BooleanField': {
        const choiceLabels = Array.isArray(value?.choice)
          ? value.choice.map((choice) => getChoiceLabel(field, choice)).filter(Boolean)
          : [];
        const otherLabels = Array.isArray(value?.other)
          ? value.other
              .map((entry) => {
                if (typeof entry === 'string') return entry.trim();
                if (typeof entry?.label === 'string') return entry.label.trim();
                if (entry?.value != null) return String(entry.value);
                return '';
              })
              .filter(Boolean)
          : [];
        const combined = [...choiceLabels, ...otherLabels];
        return combined.join(', ');
      }
      case 'MultiChoiceField': {
        const choiceLabels = Array.isArray(value?.choices)
          ? value.choices.map((choice) => getChoiceLabel(field, choice)).filter(Boolean)
          : [];
        const otherLabels = Array.isArray(value?.other)
          ? value.other
              .map((entry) => {
                if (typeof entry === 'string') return entry.trim();
                if (typeof entry?.label === 'string') return entry.label.trim();
                if (entry?.value != null) return String(entry.value);
                return '';
              })
              .filter(Boolean)
          : [];
        const combined = [...choiceLabels, ...otherLabels];
        return combined.join(', ');
      }
      case 'PhotoField':
      case 'VideoField':
        if (Array.isArray(value)) {
          return `${value.length} item${value.length === 1 ? '' : 's'}`;
        }
        return '';
      case 'SignatureField':
        return 'Signed';
      default:
        if (Array.isArray(value)) {
          return value.map((entry) => String(entry)).join(', ');
        }
        if (typeof value === 'object') {
          if (value.label) return String(value.label);
          if (value.value != null) return String(value.value);
          return '';
        }
        return String(value);
    }
  };

  const buildRepeatableSummaryLines = (repInfo, instance, maxLines = 3) => {
    if (!repInfo?.fields) return [];
    const lines = [];
    repInfo.fields.forEach((fieldInfo, dataName) => {
      if (lines.length >= maxLines) {
        return;
      }
      const field = fieldInfo?.field;
      if (!field) return;
      const value = instance?.values?.[dataName];
      if (isFieldValueEmpty(field, value)) return;
      const formatted = formatFieldValue(field, value);
      if (!formatted) return;
      lines.push({
        label: field.label || dataName,
        value: formatted,
      });
    });
    return lines;
  };

  const handleRepeatableSave = useCallback(
    (screen, payload) => {
      if (!screen?.controller) {
        return;
      }
      const { repeatableKey, parentPath, mode: saveMode, instanceId } = screen;
      const existing = screen.controller.getInstances(repeatableKey, parentPath);
      if (saveMode === 'edit') {
        const next = existing.map((instance) =>
          instance.id === instanceId ? payload : instance
        );
        screen.controller.setInstances(repeatableKey, next, parentPath);
      } else {
        screen.controller.setInstances(repeatableKey, [...existing, payload], parentPath);
      }
      popRepeatableScreen();
    },
    [popRepeatableScreen]
  );

  return (
    <FieldRegistryProvider registry={registry} renderers={renderers}>
      {activeRepeatableScreen ? (
        activeRepeatableScreen.type === 'list' ? (
          <RepeatableListScreen
            screen={activeRepeatableScreen}
            onBack={popRepeatableScreen}
            onEdit={(instanceId) =>
              openRepeatableEditor({
                ...activeRepeatableScreen,
                instanceId,
                mode: 'edit',
              })
            }
            onAdd={() => {
              const draft = createEmptyRepeatableInstance(activeRepeatableScreen.repInfo);
              openRepeatableEditor({
                ...activeRepeatableScreen,
                instanceId: draft.id,
                mode: 'create',
                draft,
              });
            }}
            onRemove={(instanceId) =>
              activeRepeatableScreen.controller?.setInstances(
                activeRepeatableScreen.repeatableKey,
                activeRepeatableScreen.controller
                  ?.getInstances(
                    activeRepeatableScreen.repeatableKey,
                    activeRepeatableScreen.parentPath
                  )
                  .filter((instance) => instance.id !== instanceId),
                activeRepeatableScreen.parentPath
              )
            }
            getEntryTitle={getRepeatableEntryTitle}
            getEntrySummary={(instance) =>
              buildRepeatableSummaryLines(activeRepeatableScreen.repInfo, instance)
            }
            readOnly={mode === 'readonly'}
          />
        ) : (
          <RepeatableEditorScreen
            screen={activeRepeatableScreen}
            schema={finalSchema}
            onBack={popRepeatableScreen}
            onSave={handleRepeatableSave}
            renderElements={renderElements}
            labelPosition={labelPosition}
            labelWidthPercent={labelWidthPercent}
            readOnly={mode === 'readonly'}
            keyboardScrollOffset={keyboardScrollOffset}
          />
        )
      ) : (
        <KeyboardFormScrollView
          ref={mainScroll.scrollRef}
          onScroll={mainScroll.onScroll}
          onLayout={mainScroll.onLayout}
          contentContainerStyle={{ padding: 16 }}
        >
          {renderElements(elements, {
            state: { values, visible, required, read_only, errors },
            setValue,
            readOnly: mode === 'readonly',
            submitCount,
            controller: formRepeatableController,
            parentPath: [],
            onFieldFocus: mainScroll.onFieldFocus,
          })}
          {canSubmit && (
            <View style={{ marginTop: 24 }}>
              <Button
                title="Submit"
                onPress={() => {
                  setSubmitCount((count) => count + 1);
                  onSubmit?.(submit(), { repeatable: cloneDeep(repeatableState) });
                }}
              />
            </View>
          )}
        </KeyboardFormScrollView>
      )}
    </FieldRegistryProvider>
  );
}

function RepeatableListScreen({
  screen,
  onBack,
  onEdit,
  onAdd,
  onRemove,
  getEntryTitle,
  getEntrySummary,
  readOnly,
}) {
  const instances =
    screen.controller?.getInstances(screen.repeatableKey, screen.parentPath) || [];
  const label = screen.field?.label || 'Repeatable Section';

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16 }}>
        <Pressable onPress={onBack} style={{ marginBottom: 8 }}>
          <Text style={{ color: '#2563eb' }}>← Back</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '700', flex: 1 }}>{label}</Text>
          {readOnly ? (
            <View
              style={{
                paddingVertical: 2,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: '#fef3c7',
              }}
            >
              <Text style={{ fontSize: 12, color: '#92400e', fontWeight: '600' }}>
                View
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: '#666', marginTop: 4 }}>
          {instances.length} item{instances.length === 1 ? '' : 's'}
        </Text>
      </View>
      <FormScrollView contentContainerStyle={{ paddingHorizontal: 16 }}>
        {instances.length === 0 ? (
          <Text style={{ color: '#666' }}>No entries yet.</Text>
        ) : (
          instances.map((instance, index) => (
            <View
              key={instance.id}
              style={{
                borderWidth: 1,
                borderColor: '#e1e1ea',
                borderRadius: 14,
                padding: 14,
                marginBottom: 12,
                backgroundColor: '#fff',
              }}
            >
              <Text style={{ fontWeight: '600', marginBottom: 8 }}>
                {getEntryTitle(screen.field, instance, index)}
              </Text>
              {getEntrySummary ? (
                (() => {
                  const summary = getEntrySummary(instance);
                  if (!summary || summary.length === 0) {
                    return (
                      <Text style={{ color: '#9ca3af', marginBottom: 10 }}>
                        No details yet.
                      </Text>
                    );
                  }
                  return (
                    <View style={{ marginBottom: 10 }}>
                      {summary.map((line, idx) => (
                        <Text
                          key={`${instance.id}-summary-${idx}`}
                          style={{ color: '#4b5563' }}
                          numberOfLines={1}
                        >
                          {line.label}: {line.value}
                        </Text>
                      ))}
                    </View>
                  );
                })()
              ) : null}
              <View style={{ flexDirection: 'row' }}>
                <Pressable
                  onPress={() => onEdit(instance.id)}
                  style={({ pressed }) => ({
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: pressed ? '#e6e7f0' : '#eef0f7',
                    marginRight: 8,
                  })}
                >
                  <Text style={{ color: '#374151' }}>
                    {readOnly ? 'View' : 'Edit'}
                  </Text>
                </Pressable>
                {!readOnly && (
                  <Pressable
                    onPress={() => onRemove(instance.id)}
                    style={({ pressed }) => ({
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: pressed ? '#fce8e8' : '#fdecec',
                    })}
                  >
                    <Text style={{ color: '#b91c1c' }}>Delete</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
      </FormScrollView>
      {!readOnly && (
        <View style={{ padding: 16 }}>
          <Button title="Add entry" onPress={onAdd} />
        </View>
      )}
    </View>
  );
}

function RepeatableEditorScreen({
  screen,
  schema,
  onBack,
  onSave,
  renderElements,
  labelPosition,
  labelWidthPercent,
  readOnly,
  keyboardScrollOffset,
}) {
  const editorScroll = useKeyboardAwareScroll({ scrollOffset: keyboardScrollOffset });
  const initialInstance =
    screen.mode === 'edit'
      ? screen.controller?.getInstance(
          screen.repeatableKey,
          screen.instanceId,
          screen.parentPath
        )
      : screen.draft;
  const baseValues =
    screen.controller?.buildParentValues?.(screen.parentPath) || {};
  const {
    values,
    visible,
    required,
    read_only,
    errors,
    setValue,
    submit,
    repeatable,
    repeatableMetadata,
    getRepeatableInstances,
    setRepeatableInstances,
    getRepeatableInstance,
    buildParentValues,
  } = useRepeatableInstanceEngine({
    schema,
    repInfo: screen.repInfo,
    baseValues,
    initialInstance: initialInstance || createEmptyRepeatableInstance(screen.repInfo),
  });
  const [submitCount, setSubmitCount] = useState(0);

  const instanceId = initialInstance?.id || screen.instanceId;
  const contextPath = useMemo(
    () => [...(screen.parentPath || []), { key: screen.repeatableKey, id: instanceId }],
    [instanceId, screen.parentPath, screen.repeatableKey]
  );
  const controller = useMemo(
    () => ({
      repeatableMetadata,
      getInstances: getRepeatableInstances,
      setInstances: setRepeatableInstances,
      getInstance: getRepeatableInstance,
      buildParentValues,
    }),
    [
      buildParentValues,
      getRepeatableInstance,
      getRepeatableInstances,
      repeatableMetadata,
      setRepeatableInstances,
    ]
  );

  const handleSave = () => {
    setSubmitCount((count) => count + 1);
    const fields = screen.repInfo?.field?.elements || [];
    let hasErrors = false;
    fields.forEach((field) => {
      if (!field?.data_name) return;
      if (visible?.[field.data_name] === false) return;
      const isRequired = Boolean(required?.[field.data_name]);
      if (isRequired && isFieldValueEmpty(field, values?.[field.data_name])) {
        hasErrors = true;
      }
    });
    if (hasErrors) {
      return;
    }
    const payload = {
      ...(initialInstance || {}),
      id: instanceId,
      values: cloneDeep(submit()),
      repeatable: cloneDeep(repeatable),
    };
    onSave(screen, payload);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <Pressable onPress={onBack} style={{ marginBottom: 8 }}>
          <Text style={{ color: '#2563eb' }}>← Back</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '700', flex: 1 }}>
            {screen.field?.label || 'Entry'}
          </Text>
          {readOnly ? (
            <View
              style={{
                paddingVertical: 2,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: '#fef3c7',
              }}
            >
              <Text style={{ fontSize: 12, color: '#92400e', fontWeight: '600' }}>
                View
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <KeyboardFormScrollView
        ref={editorScroll.scrollRef}
        onScroll={editorScroll.onScroll}
        onLayout={editorScroll.onLayout}
        contentContainerStyle={{ padding: 16 }}
      >
        {renderElements(screen.repInfo?.field?.elements || [], {
          state: { values, visible, required, read_only, errors },
          setValue,
          readOnly,
          submitCount,
          controller,
          parentPath: contextPath,
          onFieldFocus: editorScroll.onFieldFocus,
        })}
        {!readOnly && (
          <View style={{ marginTop: 16 }}>
            <Button title="Save entry" onPress={handleSave} />
          </View>
        )}
      </KeyboardFormScrollView>
    </View>
  );
}
