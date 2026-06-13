import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormEngine } from './use-form-engine';
import { FieldRenderer } from './field-renderer';
import { FieldRegistryProvider } from './field-registry-context.jsx';
import { Text } from './typography.jsx';
import {
  ScrollView,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  UIManager,
  findNodeHandle,
  useWindowDimensions,
  Alert,
  Modal,
} from 'react-native';
import {
  buildRepeatableInfo,
  cloneDeep,
  createEmptyRepeatableInstance,
} from './utils/repeatable-manager.js';
import { useRepeatableInstanceEngine } from './use-repeatable-instance.js';
import { FormHeader } from './form-header.jsx';
import { ThemeProvider, useTheme } from './theme-context.jsx';
import { ImageResolverProvider } from './image-resolver-context.jsx';
import { ChevronRight } from 'lucide-react-native';
import {
  addRepeatableInstanceToState,
  buildRepeatableParentValues,
  getRepeatableInstances as getRepeatableInstancesFromState,
  getRepeatableInstance as getRepeatableInstanceFromState,
  removeRepeatableInstanceFromState,
  setRepeatableInstancesInState,
  updateRepeatableInstanceInState,
} from './utils/repeatable-state.js';
import {
  buildValidationSummary,
  collectValidatableFields,
  getFirstValidationIssue,
  getRepeatableAddLabel,
} from './utils/repeatable-validation.js';
import { isFieldValueEmpty } from './helpers/is-field-value-empty.js';
import {
  buildStructuredSubmission,
  buildSubmissionRawValues,
  buildSubmissionTimestampSnapshot,
  DEFAULT_FIELD_KEY_MODE,
} from './utils/submission.js';

const SECTION_TYPES = new Set(['Section', 'BuildingPlanSection']);
const SECTION_LIKE_TYPES = new Set(['Section', 'RepeatableSection', 'BuildingPlanSection']);
const SPECIAL_SECTION_TYPES = new Set(['RepeatableSection', 'BuildingPlanSection']);
const REPEATABLE_TYPE = 'RepeatableSection';
const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';
const KEYBOARD_DISMISS_MODE = Platform.OS === 'ios' ? 'interactive' : 'on-drag';
const DEFAULT_SCROLL_OFFSET = 24;

/**
 * Build section hierarchy metadata for drilldown navigation.
 * Computes drilldownPath for each section to enable navigation state management.
 * @param {Array} elements - Form schema elements
 * @param {Function} resolveRepeatableKey - Optional function to resolve repeatable keys
 * @returns {{ sectionTree: Array, sectionMetadata: Object, fieldToSectionPath: Object }}
 */
function buildSectionHierarchy(elements = [], resolveRepeatableKey) {
  const metadata = {};
  const fieldPathMap = {};

  const traverse = (nodes, sectionPath = [], drilldownPath = []) => {
    if (!Array.isArray(nodes)) {
      return [];
    }

    const treeNodes = [];

    nodes.forEach((el) => {
      if (!el) {
        return;
      }

      if (SECTION_LIKE_TYPES.has(el.type)) {
        const sectionId = el.data_name || el.key;
        const hasSectionId = typeof sectionId === 'string' && sectionId.length > 0;
        // RepeatableSection and BuildingPlanSection always use drilldown display
        const display =
          el.type === 'RepeatableSection' || el.type === 'BuildingPlanSection'
            ? 'drilldown'
            : el.display || 'inline';
        const nextSectionPath = hasSectionId ? [...sectionPath, sectionId] : sectionPath;
        const shouldExtendDrilldown = display === 'drilldown' && hasSectionId;
        const nextDrilldownPath = shouldExtendDrilldown
          ? [...drilldownPath, sectionId]
          : drilldownPath;

        if (hasSectionId) {
          const repeatableKey =
            el.type === 'RepeatableSection' && typeof resolveRepeatableKey === 'function'
              ? resolveRepeatableKey(el)
              : null;
          metadata[sectionId] = {
            id: sectionId,
            label: el.label || el.data_name || 'Unnamed Section',
            type: el.type,
            display,
            path: nextSectionPath,
            drilldownPath: nextDrilldownPath,
            repeatableKey,
            field: el,
          };
        }

        // For BuildingPlanSection we intentionally hide its inner repeatables from navigation
        const shouldDescend = el.type !== 'BuildingPlanSection';
        const childNodes = shouldDescend
          ? traverse(el.elements || [], nextSectionPath, nextDrilldownPath)
          : [];

        if (
          hasSectionId &&
          (el.type === 'Section' || el.type === 'RepeatableSection' || el.type === 'BuildingPlanSection')
        ) {
          treeNodes.push({
            id: sectionId,
            label: el.label || el.data_name || 'Unnamed Section',
            display,
            type: el.type,
            children: childNodes,
          });
        } else {
          treeNodes.push(...childNodes);
        }
      } else if (el.data_name) {
        fieldPathMap[el.data_name] = sectionPath;
      }
    });

    return treeNodes;
  };

  const sectionTree = traverse(elements);
  return { sectionTree, sectionMetadata: metadata, fieldToSectionPath: fieldPathMap };
}

/**
 * Check if pathA is a prefix of pathB (or equal to it).
 * Used for determining if a section is on the active drilldown path.
 */
function isPathPrefix(pathA, pathB) {
  if (!Array.isArray(pathA) || pathA.length === 0) {
    return false;
  }
  if (!Array.isArray(pathB)) {
    return false;
  }
  if (pathA.length > pathB.length) {
    return false;
  }
  return pathA.every((segment, index) => segment === pathB[index]);
}

const FormScrollView = React.forwardRef(function FormScrollView(
  { children, contentContainerStyle, onScroll, onLayout, style, ...props },
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
      style={style}
      contentContainerStyle={[{ padding: 16, paddingBottom: 32 }, contentContainerStyle]}
      {...props}
    >
      {children}
    </ScrollView>
  );
});

const KeyboardFormScrollView = React.forwardRef(function KeyboardFormScrollView(
  { children, contentContainerStyle, style, ...props },
  ref
) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
      <FormScrollView ref={ref} contentContainerStyle={contentContainerStyle} style={style} {...props}>
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
    scrollToTarget,
  };
}

/**
 * Simple deep equality check for change detection.
 * Handles primitives, arrays, and plain objects.
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) => deepEqual(a[key], b[key]));
}

function hasSectionNodes(sectionTree = []) {
  return Array.isArray(sectionTree) && sectionTree.length > 0;
}

function buildNavigationIssues(summary, sectionMetadata = {}, fieldToSectionPath = {}) {
  if (!summary?.hasErrors) {
    return [];
  }

  const issues = Array.isArray(summary.orderedIssues)
    ? summary.orderedIssues
    : [
        ...(Array.isArray(summary.requiredFieldErrors) ? summary.requiredFieldErrors : []),
        ...(Array.isArray(summary.generalErrors) ? summary.generalErrors : []),
      ];

  return issues.map((issue, index) => {
    const fieldName = issue?.fieldName || issue?.field?.data_name || null;
    const sectionPath = fieldName ? fieldToSectionPath?.[fieldName] : null;
    const sectionId =
      Array.isArray(sectionPath) && sectionPath.length > 0
        ? sectionPath[sectionPath.length - 1]
        : null;
    const sectionLabel = sectionId ? sectionMetadata?.[sectionId]?.label || sectionId : null;

    return {
      id: `${fieldName || 'issue'}-${index}`,
      fieldName,
      label: issue?.field?.label || fieldName || `Issue ${index + 1}`,
      message: issue?.message || 'Validation issue',
      sectionId,
      sectionLabel,
      issue,
    };
  });
}

function buildSnapshotSeedSignature(rawValues = {}, repeatable = {}) {
  return JSON.stringify({
    raw_values: rawValues || {},
    repeatable: repeatable || {},
  });
}

function snapshotSeedMatchesLiveState(rawValues = {}, repeatable = {}, snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return false;
  }

  return (
    deepEqual(snapshot.raw_values || {}, rawValues || {}) &&
    deepEqual(snapshot.repeatable || {}, repeatable || {})
  );
}

function isObjectLike(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toNullableString(value) {
  return value === null || typeof value === 'string' ? value : null;
}

function getTimestampSourceValue(source, key) {
  if (!isObjectLike(source)) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(source, key)) {
    return source[key];
  }

  if (key === 'created_at_client' && Object.prototype.hasOwnProperty.call(source, 'created_at')) {
    return source.created_at;
  }

  if (key === 'updated_at_client' && Object.prototype.hasOwnProperty.call(source, 'updated_at')) {
    return source.updated_at;
  }

  return undefined;
}

function deriveInitialTimestamps(initialValues, overrideValues) {
  const now = new Date().toISOString();
  const resolveValue = (key, fallback) => {
    const overrideValue = getTimestampSourceValue(overrideValues, key);
    if (overrideValue !== undefined) {
      return toNullableString(overrideValue) ?? fallback;
    }

    const initialValue = getTimestampSourceValue(initialValues, key);
    if (initialValue !== undefined) {
      return toNullableString(initialValue) ?? fallback;
    }

    return fallback;
  };

  return {
    created_at_client: resolveValue('created_at_client', now),
    updated_at_client: resolveValue('updated_at_client', now),
    created_at_server: resolveValue('created_at_server', null),
    updated_at_server: resolveValue('updated_at_server', null),
  };
}

function areTimestampValuesEqual(a, b) {
  if (a === b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return (
    a.created_at_client === b.created_at_client &&
    a.updated_at_client === b.updated_at_client &&
    a.created_at_server === b.created_at_server &&
    a.updated_at_server === b.updated_at_server
  );
}

function useRecordTimestamps({ initialValues, overrideValues, values }) {
  const [timestamps, setTimestamps] = useState(() =>
    deriveInitialTimestamps(initialValues, overrideValues)
  );
  const timestampsRef = useRef(timestamps);
  const sourcesRef = useRef({ initialValues, overrideValues });
  const valuesRef = useRef(values);
  const updateTimerRef = useRef(null);

  const cancelScheduledUpdate = useCallback(() => {
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => cancelScheduledUpdate(), [cancelScheduledUpdate]);

  useEffect(() => {
    const previousSources = sourcesRef.current;
    if (
      previousSources.initialValues === initialValues &&
      previousSources.overrideValues === overrideValues
    ) {
      return;
    }

    sourcesRef.current = { initialValues, overrideValues };
    cancelScheduledUpdate();
    const next = deriveInitialTimestamps(initialValues, overrideValues);
    setTimestamps((previous) => (areTimestampValuesEqual(previous, next) ? previous : next));
  }, [cancelScheduledUpdate, initialValues, overrideValues]);

  useEffect(() => {
    timestampsRef.current = timestamps;
  }, [timestamps]);

  useEffect(() => {
    if (valuesRef.current === values) {
      return undefined;
    }

    valuesRef.current = values;
    cancelScheduledUpdate();
    updateTimerRef.current = setTimeout(() => {
      updateTimerRef.current = null;
      setTimestamps((previous) => {
        const nextUpdatedAt = new Date().toISOString();
        if (previous.updated_at_client === nextUpdatedAt) {
          return previous;
        }

        return {
          ...previous,
          updated_at_client: nextUpdatedAt,
        };
      });
    }, 500);

    return cancelScheduledUpdate;
  }, [cancelScheduledUpdate, values]);

  const touchUpdatedAt = useCallback((nextTimestamp = new Date().toISOString()) => {
    setTimestamps((previous) => {
      if (previous.updated_at_client === nextTimestamp) {
        return previous;
      }

      const next = {
        ...previous,
        updated_at_client: nextTimestamp,
      };
      timestampsRef.current = next;
      return next;
    });
  }, []);

  return { timestamps, timestampsRef, touchUpdatedAt };
}

function useOperationAlertBridge(externalOnOperations) {
  const [alertQueue, setAlertQueue] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);
  const nextAlertIdRef = useRef(0);

  useEffect(() => {
    if (activeAlert || alertQueue.length === 0) {
      return;
    }

    setActiveAlert(alertQueue[0]);
    setAlertQueue((previous) => previous.slice(1));
  }, [activeAlert, alertQueue]);

  const closeAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  const handleOperations = useCallback(
    (operations = [], meta = {}, fallback = () => {}) => {
      if (!Array.isArray(operations) || operations.length === 0) {
        return;
      }

      let passthroughOperations = [];
      const flushPassthroughOperations = () => {
        if (passthroughOperations.length === 0) {
          return;
        }

        if (typeof externalOnOperations === 'function') {
          externalOnOperations(passthroughOperations, meta, fallback);
        } else {
          fallback(passthroughOperations, meta);
        }

        passthroughOperations = [];
      };

      operations.forEach((operation) => {
        if (
          operation?.type === 'UI_OPERATION' &&
          operation?.operation === 'ALERT'
        ) {
          flushPassthroughOperations();
          nextAlertIdRef.current += 1;
          setAlertQueue((previous) => [
            ...previous,
            {
              id: `operation-alert-${nextAlertIdRef.current}`,
              title: operation?.params?.title != null ? String(operation.params.title) : '',
              message: operation?.params?.message != null ? String(operation.params.message) : '',
            },
          ]);
          return;
        }

        passthroughOperations.push(operation);
      });

      flushPassthroughOperations();
    },
    [externalOnOperations]
  );

  return {
    activeAlert,
    closeAlert,
    handleOperations,
  };
}

export function FormRenderer({
  schema,
  initialValues = {},
  initialSnapshot,
  overrideValues,
  onSubmit,
  onSnapshotChange,
  forceShowNavigationPanel = false,
  fieldKeyMode = DEFAULT_FIELD_KEY_MODE,
  mode: modeProp = 'edit',
  keyboardScrollOffset = DEFAULT_SCROLL_OFFSET,
  debug = false,
  onSchemaReady,
  labelPosition = 'top',
  labelWidthPercent = 30,
  renderers,
  registry,
  onRequestClose,
  showPrimaryActionsInViewMode = true,
  showHeader = true,
  primaryActionMode = 'submit',
  primaryActionLabel,
  colorMode = 'light',
  customTheme = null,
  imageResolver = null,
  engineOptions,
}) {
  const mainScroll = useKeyboardAwareScroll({ scrollOffset: keyboardScrollOffset });
  const initialSnapshotRawValues = useMemo(() => {
    if (!initialSnapshot) {
      return null;
    }

    return isObjectLike(initialSnapshot.raw_values) ? initialSnapshot.raw_values : {};
  }, [initialSnapshot]);
  const initialSnapshotRepeatable = useMemo(() => {
    if (!initialSnapshot) {
      return {};
    }

    return isObjectLike(initialSnapshot.repeatable) ? initialSnapshot.repeatable : {};
  }, [initialSnapshot]);
  const initialTimestampSeedValues = useMemo(() => {
    if (!initialSnapshot) {
      return initialValues;
    }

    const timestampValues = isObjectLike(initialSnapshot.timestamps)
      ? initialSnapshot.timestamps
      : {};

    return {
      ...(initialSnapshotRawValues || {}),
      ...timestampValues,
    };
  }, [initialSnapshot, initialSnapshotRawValues, initialValues]);
  const rendererInitialValues = initialSnapshot ? initialSnapshotRawValues || {} : initialValues;
  const initialRepeatableSeed = useMemo(
    () => cloneDeep(initialSnapshotRepeatable || {}),
    [initialSnapshotRepeatable]
  );
  const [appliedRendererInitialValues, setAppliedRendererInitialValues] = useState(() =>
    cloneDeep(rendererInitialValues || {})
  );
  const [appliedInitialTimestampSeedValues, setAppliedInitialTimestampSeedValues] = useState(() =>
    cloneDeep(initialTimestampSeedValues || {})
  );
  const [appliedRepeatableSeed, setAppliedRepeatableSeed] = useState(() =>
    cloneDeep(initialRepeatableSeed || {})
  );
  const { activeAlert, closeAlert, handleOperations } = useOperationAlertBridge(
    engineOptions?.onOperations
  );
  const effectiveEngineOptions = useMemo(
    () => ({
      ...(engineOptions || {}),
      onOperations: handleOperations,
    }),
    [engineOptions, handleOperations]
  );
  const {
    values,
    visible,
    read_only,
    required,
    errors,
    setValue,
    submit,
    schema: finalSchema,
    triggerEvent,
    engineReadyVersion,
  } = useFormEngine(schema, appliedRendererInitialValues, overrideValues, effectiveEngineOptions);
  const [submitCount, setSubmitCount] = useState(0);
  const [repeatableState, setRepeatableState] = useState(appliedRepeatableSeed);
  const [repeatableStack, setRepeatableStack] = useState([]);
  const [pendingRepeatableRemoval, setPendingRepeatableRemoval] = useState(null);
  const repeatableScreenIdRef = useRef(0);
  const repeatableStateRef = useRef(appliedRepeatableSeed);
  const valuesRef = useRef(values);
  const fieldContainerRefs = useRef(new Map());
  const fieldInputRefs = useRef(new Map());
  const sectionContainerRefs = useRef(new Map());
  const loadEventTriggeredRef = useRef(false);
  const previousInteractionModeRef = useRef(null);
  const rootChangesRef = useRef(false);
  const snapshotBaselineRef = useRef(null);
  const onSnapshotChangeRef = useRef(onSnapshotChange);
  const appliedSnapshotSeedSignatureRef = useRef(null);
  const appliedSchemaRef = useRef(schema);
  const submissionSnapshotRef = useRef(null);

  // Interaction mode state (allows switching between edit/readonly at runtime)
  const normalizedInitialMode = modeProp === 'readonly' ? 'readonly' : 'edit';
  const [interactionMode, setInteractionMode] = useState(normalizedInitialMode);

  // Track changes for discard prompt
  const initialValuesRef = useRef(cloneDeep(appliedRendererInitialValues || {}));
  const initialRepeatableStateRef = useRef(cloneDeep(appliedRepeatableSeed));
  const [hasChanges, setHasChanges] = useState(false);

  // Sync interaction mode when prop changes
  useEffect(() => {
    const nextMode = modeProp === 'readonly' ? 'readonly' : 'edit';
    setInteractionMode(nextMode);
  }, [modeProp]);

  // Detect changes by comparing current values to initial values
  useEffect(() => {
    const changed =
      !deepEqual(values, initialValuesRef.current) ||
      !deepEqual(repeatableState, initialRepeatableStateRef.current);
    setHasChanges(changed);
  }, [repeatableState, values]);

  useEffect(() => {
    repeatableStateRef.current = repeatableState;
  }, [repeatableState]);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    onSnapshotChangeRef.current = onSnapshotChange;
  }, [onSnapshotChange]);

  const markRootDirty = useCallback(() => {
    rootChangesRef.current = true;
  }, []);

  const resetRootChanges = useCallback(() => {
    rootChangesRef.current = false;
  }, []);

  const enterEditMode = useCallback(() => {
    setInteractionMode('edit');
  }, []);

  const isReadOnly = interactionMode === 'readonly';

  useEffect(() => {
    if (onSchemaReady) onSchemaReady(finalSchema);
  }, [finalSchema]);

  const elements = finalSchema?.form?.elements || [];
  const repeatableMetadata = useMemo(
    () => buildRepeatableInfo(elements),
    [elements]
  );
  const statusField = finalSchema?.form?.status_field || null;
  const statusFieldName = statusField?.data_name || null;
  const statusValue = statusFieldName
    ? values?.[statusFieldName] ?? statusField?.default_value ?? null
    : null;
  const { timestamps, timestampsRef, touchUpdatedAt } = useRecordTimestamps({
    initialValues: appliedInitialTimestampSeedValues,
    overrideValues,
    values,
  });
  const validatableRootFields = useMemo(
    () =>
      collectValidatableFields(elements, {
        includeRepeatableChildren: false,
      }),
    [elements]
  );

  // Resolve repeatable key helper for section hierarchy
  const resolveRepeatableKey = useCallback((field) => {
    if (!field) return null;
    if (field.key && typeof field.key === 'string' && field.key.trim().length > 0) {
      return field.key;
    }
    return field.data_name || null;
  }, []);

  // Build section hierarchy for drilldown navigation
  const { sectionTree, sectionMetadata, fieldToSectionPath } = useMemo(
    () => buildSectionHierarchy(elements, resolveRepeatableKey),
    [elements, resolveRepeatableKey]
  );

  // Drilldown navigation state
  const [activeDrilldownPath, setActiveDrilldownPath] = useState([]);

  useEffect(() => {
    const nextInitialValues = cloneDeep(rendererInitialValues || {});
    const nextTimestampSeedValues = cloneDeep(initialTimestampSeedValues || {});
    const nextRepeatableState = cloneDeep(initialRepeatableSeed || {});
    const nextSeedSignature = buildSnapshotSeedSignature(
      nextInitialValues,
      nextRepeatableState
    );
    const schemaChanged = appliedSchemaRef.current !== schema;

    if (
      !schemaChanged &&
      appliedSnapshotSeedSignatureRef.current === nextSeedSignature
    ) {
      return;
    }

    if (
      !schemaChanged &&
      appliedSnapshotSeedSignatureRef.current !== null &&
      snapshotSeedMatchesLiveState(
        nextInitialValues,
        nextRepeatableState,
        submissionSnapshotRef.current
      )
    ) {
      appliedSnapshotSeedSignatureRef.current = nextSeedSignature;
      return;
    }

    appliedSchemaRef.current = schema;
    appliedSnapshotSeedSignatureRef.current = nextSeedSignature;
    setAppliedRendererInitialValues(nextInitialValues);
    setAppliedInitialTimestampSeedValues(nextTimestampSeedValues);
    setAppliedRepeatableSeed(nextRepeatableState);

    initialValuesRef.current = nextInitialValues;
    initialRepeatableStateRef.current = nextRepeatableState;
    repeatableStateRef.current = nextRepeatableState;

    setRepeatableState(nextRepeatableState);
    setRepeatableStack([]);
    setPendingRepeatableRemoval(null);
    setSubmitCount(0);
    setActiveDrilldownPath([]);
    fieldContainerRefs.current.clear();
    fieldInputRefs.current.clear();
    sectionContainerRefs.current.clear();
    resetRootChanges();
    snapshotBaselineRef.current = null;
  }, [
    initialRepeatableSeed,
    initialTimestampSeedValues,
    rendererInitialValues,
    resetRootChanges,
    schema,
  ]);

  useEffect(() => {
    loadEventTriggeredRef.current = false;
    previousInteractionModeRef.current = null;
  }, [engineReadyVersion]);

  useEffect(() => {
    if (!engineReadyVersion || loadEventTriggeredRef.current) {
      return;
    }

    triggerEvent('load-record');
    loadEventTriggeredRef.current = true;
  }, [engineReadyVersion, triggerEvent]);

  useEffect(() => {
    if (!engineReadyVersion) {
      return;
    }

    const previousMode = previousInteractionModeRef.current;
    const enteringEditMode = interactionMode === 'edit' && previousMode !== 'edit';
    if (enteringEditMode) {
      triggerEvent('edit-record');
    }

    previousInteractionModeRef.current = interactionMode;
  }, [engineReadyVersion, interactionMode, triggerEvent]);

  // Derived drilldown state values
  const activeDrilldownSectionId =
    activeDrilldownPath.length > 0 ? activeDrilldownPath[activeDrilldownPath.length - 1] : null;
  const activeDrilldownSectionInfo = activeDrilldownSectionId
    ? sectionMetadata[activeDrilldownSectionId]
    : null;
  const isSpecialSectionActive =
    activeDrilldownSectionInfo && SPECIAL_SECTION_TYPES.has(activeDrilldownSectionInfo.type);
  const drilldownDepth = activeDrilldownPath.length;
  const isRootPage = drilldownDepth === 0;
  const isFirstSpecialPage = drilldownDepth === 1 && isSpecialSectionActive;
  const isNestedDrilldownPage = drilldownDepth > 0 && (!isSpecialSectionActive || drilldownDepth > 1);
  const isRepeatableFirstPage =
    isFirstSpecialPage && activeDrilldownSectionInfo?.type === 'RepeatableSection';

  // Drilldown navigation functions
  const pushDrilldownSection = useCallback((sectionId) => {
    const section = sectionMetadata[sectionId];
    if (!section) return;
    setActiveDrilldownPath(section.drilldownPath);
  }, [sectionMetadata]);

  const popDrilldownLevel = useCallback(() => {
    if (!activeDrilldownSectionId) {
      setActiveDrilldownPath([]);
      return;
    }
    const info = sectionMetadata[activeDrilldownSectionId];
    if (!info) {
      setActiveDrilldownPath([]);
      return;
    }
    const nextDrilldownPath = info.drilldownPath.slice(0, -1);
    setActiveDrilldownPath(nextDrilldownPath);
  }, [activeDrilldownSectionId, sectionMetadata]);

  const registerRootFieldContainer = useCallback((fieldName, node) => {
    if (!fieldName) return;
    if (node) {
      fieldContainerRefs.current.set(fieldName, node);
      return;
    }
    fieldContainerRefs.current.delete(fieldName);
  }, []);

  const registerRootFieldInput = useCallback((fieldName, node) => {
    if (!fieldName) return;
    if (node) {
      fieldInputRefs.current.set(fieldName, node);
      return;
    }
    fieldInputRefs.current.delete(fieldName);
  }, []);

  const registerRootSectionContainer = useCallback((sectionId, node) => {
    if (!sectionId) return;
    if (node) {
      sectionContainerRefs.current.set(sectionId, node);
      return;
    }
    sectionContainerRefs.current.delete(sectionId);
  }, []);

  const focusRootFieldByName = useCallback(
    (fieldName) => {
      if (!fieldName) {
        return;
      }
      const input = fieldInputRefs.current.get(fieldName) || null;
      const container = fieldContainerRefs.current.get(fieldName) || null;
      const target = input || container;
      if (!target) {
        return;
      }
      mainScroll.scrollToTarget(target);
      if (typeof input?.focus === 'function') {
        requestAnimationFrame(() => {
          input.focus();
        });
      }
    },
    [mainScroll]
  );

  const focusRootSectionById = useCallback(
    (sectionId) => {
      if (!sectionId) {
        return;
      }
      const target = sectionContainerRefs.current.get(sectionId) || null;
      if (target) {
        mainScroll.scrollToTarget(target);
      }
    },
    [mainScroll]
  );

  const navigateToRootSection = useCallback(
    (sectionId) => {
      if (!sectionId) {
        return;
      }

      const sectionInfo = sectionMetadata?.[sectionId];
      if (!sectionInfo) {
        return;
      }

      const drilldownPath = Array.isArray(sectionInfo.drilldownPath) ? sectionInfo.drilldownPath : [];
      const opensDrilldown = drilldownPath[drilldownPath.length - 1] === sectionId;
      if (opensDrilldown) {
        setActiveDrilldownPath(drilldownPath);
        return;
      }

      if (drilldownPath.length > 0) {
        setActiveDrilldownPath(drilldownPath);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            focusRootSectionById(sectionId);
          });
        });
        return;
      }

      requestAnimationFrame(() => {
        focusRootSectionById(sectionId);
      });
    },
    [focusRootSectionById, sectionMetadata]
  );

  const navigateToRootValidationIssue = useCallback(
    (issue) => {
      if (!issue?.fieldName) {
        return;
      }
      const sectionPath = fieldToSectionPath[issue.fieldName];
      if (Array.isArray(sectionPath) && sectionPath.length > 0) {
        const targetSectionId = sectionPath[sectionPath.length - 1];
        const sectionInfo = sectionMetadata[targetSectionId];
        if (sectionInfo) {
          setActiveDrilldownPath(sectionInfo.drilldownPath || []);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              focusRootFieldByName(issue.fieldName);
            });
          });
          return;
        }
      }
      requestAnimationFrame(() => {
        focusRootFieldByName(issue.fieldName);
      });
    },
    [fieldToSectionPath, focusRootFieldByName, sectionMetadata]
  );

  const buildRootValidationSummary = useCallback(
    () =>
      buildValidationSummary(validatableRootFields, {
        getValue: (field) => {
          if (!field?.data_name) {
            return null;
          }
          if (field.data_name === statusFieldName) {
            return statusValue ?? null;
          }
          return values[field.data_name];
        },
        isVisible: (field) => !field?.data_name || visible?.[field.data_name] !== false,
        isRequired: (field) => Boolean(field?.data_name && required?.[field.data_name]),
        getError: (field) => (field?.data_name ? errors?.[field.data_name] : null),
      }),
    [errors, required, statusFieldName, statusValue, validatableRootFields, values, visible]
  );

  const rootValidationSummary = useMemo(
    () => buildRootValidationSummary(),
    [buildRootValidationSummary]
  );
  const showRootValidationList = submitCount > 0 && rootValidationSummary?.hasErrors;
  const rootNavigationIssues = useMemo(
    () => buildNavigationIssues(rootValidationSummary, sectionMetadata, fieldToSectionPath),
    [fieldToSectionPath, rootValidationSummary, sectionMetadata]
  );
  const rootNavigationPanelAvailable =
    forceShowNavigationPanel || hasSectionNodes(sectionTree) || showRootValidationList;

  const handleRootFieldValueChange = useCallback(
    (fieldDef, nextValue, applyValue = setValue) => {
      if (!fieldDef?.data_name) {
        return;
      }

      const dataName = fieldDef.data_name;
      applyValue(dataName, nextValue);
      markRootDirty();
      triggerEvent('change', dataName, {
        value: nextValue,
        field: fieldDef,
      });
    },
    [markRootDirty, setValue, triggerEvent]
  );

  const getRepeatableInstances = useCallback(
    (repeatableKey, parentPath = []) => {
      return getRepeatableInstancesFromState(repeatableStateRef.current, repeatableKey, parentPath);
    },
    []
  );

  const getRepeatableInstance = useCallback(
    (repeatableKey, instanceId, parentPath = []) => {
      return getRepeatableInstanceFromState(
        repeatableStateRef.current,
        repeatableKey,
        instanceId,
        parentPath
      );
    },
    []
  );

  const updateRepeatableState = useCallback((updater) => {
    setRepeatableState((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = typeof updater === 'function' ? updater(base) : base;
      repeatableStateRef.current = next;
      return next;
    });
  }, []);

  const setRepeatableInstances = useCallback(
    (repeatableKey, instances = [], parentPath = []) => {
      updateRepeatableState((prev) =>
        setRepeatableInstancesInState(prev, repeatableKey, instances, parentPath)
      );
    },
    [updateRepeatableState]
  );

  const addRepeatableInstance = useCallback(
    (repeatableKey, { parentPath = [], seedValues = {}, instanceId } = {}) => {
      const repInfo = repeatableMetadata.byPreferredKey.get(repeatableKey);
      if (!repInfo) {
        console.warn(`form0-react-native: unknown RepeatableSection "${repeatableKey}"`);
        return null;
      }

      const newInstance = createEmptyRepeatableInstance(repInfo);
      if (instanceId) {
        newInstance.id = instanceId;
      }
      newInstance.values = { ...newInstance.values, ...(seedValues || {}) };

      updateRepeatableState((prev) =>
        addRepeatableInstanceToState(prev, repeatableKey, newInstance, parentPath)
      );

      return newInstance;
    },
    [repeatableMetadata, updateRepeatableState]
  );

  const updateRepeatableInstance = useCallback(
    (repeatableKey, instanceId, updater, parentPath = []) => {
      updateRepeatableState((prev) =>
        updateRepeatableInstanceInState(prev, repeatableKey, instanceId, updater, parentPath)
      );
    },
    [updateRepeatableState]
  );

  const removeRepeatableInstance = useCallback(
    (repeatableKey, instanceId, parentPath = []) => {
      updateRepeatableState((prev) =>
        removeRepeatableInstanceFromState(prev, repeatableKey, instanceId, parentPath)
      );
    },
    [updateRepeatableState]
  );

  const buildParentValuesForPath = useCallback(
    (path = []) => {
      return buildRepeatableParentValues({
        seedValues: valuesRef.current,
        repeatableState: repeatableStateRef.current,
        path,
      });
    },
    []
  );

  const formRepeatableController = useMemo(
    () => ({
      repeatableMetadata,
      addInstance: addRepeatableInstance,
      updateInstance: updateRepeatableInstance,
      removeInstance: removeRepeatableInstance,
      getInstances: getRepeatableInstances,
      setInstances: setRepeatableInstances,
      getInstance: getRepeatableInstance,
      buildParentValues: buildParentValuesForPath,
    }),
    [
      addRepeatableInstance,
      buildParentValuesForPath,
      getRepeatableInstance,
      getRepeatableInstances,
      removeRepeatableInstance,
      repeatableMetadata,
      setRepeatableInstances,
      updateRepeatableInstance,
    ]
  );

  const submissionSnapshot = useMemo(() => {
    const timestampSnapshot = buildSubmissionTimestampSnapshot(timestamps);

    return {
      raw_values: buildSubmissionRawValues({
        values,
        timestampSnapshot,
        statusFieldName,
        statusValue,
      }),
      repeatable: cloneDeep(repeatableState),
      timestamps: timestampSnapshot,
    };
  }, [repeatableState, statusFieldName, statusValue, timestamps, values]);

  useEffect(() => {
    submissionSnapshotRef.current = submissionSnapshot;
  }, [submissionSnapshot]);

  useEffect(() => {
    const handleSnapshotChange = onSnapshotChangeRef.current;
    if (typeof handleSnapshotChange !== 'function') {
      return;
    }

    const nextSnapshot = cloneDeep(submissionSnapshot);
    if (!rootChangesRef.current || snapshotBaselineRef.current === null) {
      snapshotBaselineRef.current = nextSnapshot;
      handleSnapshotChange(nextSnapshot, {
        kind: 'seed',
        dirty: false,
      });
      return;
    }

    handleSnapshotChange(nextSnapshot, {
      kind: 'change',
      dirty: !deepEqual(snapshotBaselineRef.current, nextSnapshot),
    });
  }, [submissionSnapshot]);

  const resolveRepeatableInfo = useCallback((field, metadata) => {
    if (!field || !metadata?.repeatableSectionTree) {
      return { repeatableKey: null, repInfo: null };
    }
    const repInfo = field.data_name ? metadata.repeatableSectionTree.get(field.data_name) : null;
    const repeatableKey = repInfo?.preferredKey || field.key || field.data_name;
    return { repeatableKey, repInfo };
  }, []);

  const pushRepeatableScreen = useCallback((screen) => {
    repeatableScreenIdRef.current += 1;
    setRepeatableStack((prev) => [
      ...prev,
      {
        ...screen,
        screenId: `repeatable-screen-${repeatableScreenIdRef.current}`,
      },
    ]);
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
      const frozenParentPath = Array.isArray(parentPath) ? cloneDeep(parentPath) : [];
      const resolvedInitialInstance =
        mode === 'edit'
          ? cloneDeep(
              controller?.getInstance?.(repeatableKey, instanceId, frozenParentPath) ||
                draft ||
                createEmptyRepeatableInstance(repInfo)
            )
          : cloneDeep(draft || createEmptyRepeatableInstance(repInfo));
      const frozenParentValues = cloneDeep(
        controller?.buildParentValues?.(frozenParentPath) || {}
      );

      pushRepeatableScreen({
        type: 'edit',
        field,
        controller,
        parentPath: frozenParentPath,
        repeatableKey,
        repInfo,
        instanceId,
        mode,
        draft: resolvedInitialInstance,
        initialInstance: resolvedInitialInstance,
        parentValues: frozenParentValues,
        engineOptions,
      });
    },
    [engineOptions, pushRepeatableScreen]
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
        registerFieldContainer,
        registerFieldInput,
        registerSectionContainer,
        theme,
        onFieldChange,
        // Drilldown state passed from parent
        activeDrilldownPath: drilldownPath = [],
        sectionMetadata: sectionMeta = {},
        onDrilldownNavigate,
        parentSectionPath = [],
      }
    ) => {
      const activeDrilldownSectionId =
        drilldownPath.length > 0 ? drilldownPath[drilldownPath.length - 1] : null;
      const activeDrilldownFullPath = activeDrilldownSectionId
        ? sectionMeta?.[activeDrilldownSectionId]?.path || []
        : [];

      // Use a fallback theme if not provided (for backwards compatibility)
      const t = theme || {
        color: {
          background: '#ffffff',
          border: '#e5e7eb',
          section: '#f9fafb',
          sectionBorder: '#e5e7eb',
          sectionHeader: '#111111',
          foreground: '#111111',
          description: '#6b7280',
          buttonBg: '#ff007a',
          buttonFg: '#ffffff',
          buttonHoverBg: '#d6006b',
          cancelBg: '#f3f4f6',
          cancelFg: '#374151',
          cancelHoverBg: '#e5e7eb',
          primary: '#111111',
        },
        spacing: {
          xs: 2,
          sm: 4,
          md: 8,
          lg: 16,
          xl: 24,
        },
        fontSize: {
          xs: 12,
          subtext: 13,
          sm: 14,
          base: 15,
          md: 16,
          lg: 17,
          section: 18,
          xl: 20,
          xxl: 24,
        },
        borderRadius: {
          md: 6,
          lg: 8,
          full: 999,
        },
        fontWeight: {
          bold: '700',
        },
      };

      const sectionBorderColor = t.color.sectionBorder || t.color.border;
      const sectionCardStyle = {
        borderWidth: 1,
        borderColor: sectionBorderColor,
        borderRadius: t.borderRadius?.md ?? 6,
        backgroundColor: t.color.background,
        marginBottom: t.spacing.lg,
        overflow: 'hidden',
      };
      const sectionHeaderBandStyle = {
        backgroundColor: t.color.section,
        paddingVertical: 12,
        paddingHorizontal: t.spacing.md,
        minHeight: 44,
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: sectionBorderColor,
      };
      const sectionBodyStyle = {
        paddingVertical: t.spacing.sm,
        paddingHorizontal: t.spacing.md,
      };

      return items.map((field) => {
        if (!field) return null;

        if (activeDrilldownSectionId) {
          const isWithinActiveFieldBranch =
            parentSectionPath.includes(activeDrilldownSectionId) ||
            isPathPrefix(activeDrilldownFullPath, parentSectionPath);
          if (SECTION_LIKE_TYPES.has(field.type)) {
            const sectionId = field.data_name || field.key;
            if (!sectionId) {
              return null;
            }
            const sectionPath = [...parentSectionPath, sectionId];
            const isAncestorOfActive =
              sectionId !== activeDrilldownSectionId &&
              activeDrilldownFullPath.includes(sectionId);
            const isWithinActiveBranch = sectionPath.includes(activeDrilldownSectionId);

            if (!isAncestorOfActive && !isWithinActiveBranch) {
              return null;
            }

            if (isAncestorOfActive) {
              return (
                <React.Fragment key={sectionId}>
                  {renderElements(field.elements || [], {
                    state,
                    setValue: applyValue,
                    readOnly,
                    submitCount: localSubmitCount,
                    controller,
                    parentPath,
                    onFieldFocus,
                    registerFieldContainer,
                    registerFieldInput,
                    registerSectionContainer,
                    theme,
                    onFieldChange,
                    activeDrilldownPath: drilldownPath,
                    sectionMetadata: sectionMeta,
                    onDrilldownNavigate,
                    parentSectionPath: sectionPath,
                  })}
                </React.Fragment>
              );
            }
          } else if (!isWithinActiveFieldBranch) {
            return null;
          }
        }

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
            backgroundColor: count === 0 ? t.color.cancelBg : t.color.bannerEditBg || '#e0e7ff',
          };
          const countTextStyle = {
            fontSize: t.fontSize.xs,
            color: count === 0 ? t.color.description : t.color.bannerEditFg || '#1f2937',
            fontWeight: '600',
          };
          const repeatableSectionId = field.data_name || field.key || null;
          // Drilldown card style - matches web's drilldownInactive
          return (
            <View
              key={field.key || field.data_name}
              ref={
                repeatableSectionId && typeof registerSectionContainer === 'function'
                  ? (node) => registerSectionContainer(repeatableSectionId, node)
                  : undefined
              }
              style={{
                borderWidth: 1,
                borderColor: t.color.sectionBorder || t.color.border,
                borderLeftWidth: 5,
                borderLeftColor: t.color.primary,
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                backgroundColor: t.color.section,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                {/* Left side: label and count pill */}
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                  <Text
                    style={{
                      fontWeight: '600',
                      fontSize: t.fontSize.base,
                      color: t.color.sectionHeader || t.color.foreground,
                    }}
                    numberOfLines={1}
                  >
                    {field.label || 'Repeatable Section'}
                  </Text>
                  <View style={countPillStyle}>
                    <Text style={countTextStyle}>{countLabel}</Text>
                  </View>
                </View>
                {/* Right side: View button */}
                <Pressable
                  onPress={() => openRepeatableList({ field, controller, parentPath })}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 6,
                    backgroundColor: pressed
                      ? (t.color.drilldownButtonBg || t.color.buttonBg)
                      : 'transparent',
                    borderWidth: 1,
                    borderColor: t.color.border,
                    gap: 4,
                  })}
                >
                  <Text style={{ color: t.color.foreground, fontWeight: '500', fontSize: t.fontSize.sm }}>
                    View
                  </Text>
                  <ChevronRight size={16} color={t.color.foreground} strokeWidth={2} />
                </Pressable>
              </View>
            </View>
          );
        }

        if (SECTION_TYPES.has(field.type)) {
          const sectionId = field.data_name || field.key;
          const display = field.display || 'inline';
          const sectionPath = sectionId ? [...parentSectionPath, sectionId] : parentSectionPath;
          const sectionRef =
            sectionId && typeof registerSectionContainer === 'function'
              ? (node) => registerSectionContainer(sectionId, node)
              : undefined;

          // Handle drilldown sections
          if (display === 'drilldown' && sectionId) {
            const sectionInfo = sectionMeta[sectionId];
            const sectionDrilldownPath = sectionInfo?.drilldownPath ?? [];
            const isDescendantOfActive =
              drilldownPath.length > 0
                ? isPathPrefix(drilldownPath, sectionDrilldownPath)
                : false;
            const isOnActivePath = isPathPrefix(sectionDrilldownPath, drilldownPath);
            const isCurrentLevelActive = isOnActivePath && sectionDrilldownPath.length === drilldownPath.length;

            // If there's an active drilldown and this section is not on the path, hide it
            if (drilldownPath.length > 0 && !isOnActivePath && !isDescendantOfActive) {
              return null;
            }

            const shouldRenderPreviewState =
              !isOnActivePath && (!drilldownPath.length || isDescendantOfActive);

            // If not active, render as drilldown card
            if (shouldRenderPreviewState) {
              return (
                <View
                  key={sectionId}
                  ref={sectionRef}
                  style={{
                    borderWidth: 1,
                    borderColor: t.color.sectionBorder || t.color.border,
                    borderLeftWidth: 5,
                    borderLeftColor: t.color.primary,
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 12,
                    backgroundColor: t.color.section,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: '600',
                        fontSize: t.fontSize.base,
                        color: t.color.sectionHeader || t.color.foreground,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {field.label || 'Section'}
                    </Text>
                    <Pressable
                      onPress={() => onDrilldownNavigate?.(sectionId)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 6,
                        backgroundColor: pressed
                          ? (t.color.drilldownButtonBg || t.color.buttonBg)
                          : 'transparent',
                        borderWidth: 1,
                        borderColor: t.color.border,
                        gap: 4,
                      })}
                    >
                      <Text style={{ color: t.color.foreground, fontWeight: '500', fontSize: t.fontSize.sm }}>
                        View
                      </Text>
                      <ChevronRight size={16} color={t.color.foreground} strokeWidth={2} />
                    </Pressable>
                  </View>
                </View>
              );
            }

            if (!isCurrentLevelActive) {
              // Ancestor of active - just render children without section wrapper
              return (
                <React.Fragment key={sectionId}>
                  {renderElements(field.elements || [], {
                    state,
                    setValue: applyValue,
                    readOnly,
                    submitCount: localSubmitCount,
                    controller,
                    parentPath,
                    onFieldFocus,
                    registerFieldContainer,
                    registerFieldInput,
                    registerSectionContainer,
                    theme,
                    onFieldChange,
                    activeDrilldownPath: drilldownPath,
                    sectionMetadata: sectionMeta,
                    onDrilldownNavigate,
                    parentSectionPath: sectionPath,
                  })}
                </React.Fragment>
              );
            }

            // If this section is active render with header and content
            if (isCurrentLevelActive) {
              // Active drilldown section - render with header and content
              return (
                <View key={sectionId} ref={sectionRef} style={sectionCardStyle}>
                  {field.label || field.description ? (
                    <View style={sectionHeaderBandStyle}>
                      {field.label ? (
                        <Text
                          style={{
                            fontWeight: t.fontWeight.bold,
                            fontSize: t.fontSize.section || t.fontSize.lg,
                            color: t.color.sectionHeader || t.color.foreground,
                          }}
                        >
                          {field.label}
                        </Text>
                      ) : null}
                      {field.description ? (
                        <Text
                          style={{
                            color: t.color.description,
                            marginTop: t.spacing.xs,
                            fontSize: t.fontSize.sm,
                          }}
                        >
                          {field.description}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  <View style={sectionBodyStyle}>
                    {renderElements(field.elements || [], {
                      state,
                      setValue: applyValue,
                      readOnly,
                      submitCount: localSubmitCount,
                      controller,
                      parentPath,
                      onFieldFocus,
                      registerFieldContainer,
                      registerFieldInput,
                      registerSectionContainer,
                      theme,
                      onFieldChange,
                      activeDrilldownPath: drilldownPath,
                      sectionMetadata: sectionMeta,
                      onDrilldownNavigate,
                      parentSectionPath: sectionPath,
                    })}
                  </View>
                </View>
              );
            }
          }

          // Inline section (default) - render normally
          return (
            <View
              key={sectionId || Math.random().toString(36)}
              ref={sectionRef}
              style={sectionCardStyle}
            >
              {field.label || field.description ? (
                <View style={sectionHeaderBandStyle}>
                  {field.label ? (
                    <Text
                      style={{
                        fontWeight: t.fontWeight.bold,
                        fontSize: t.fontSize.base,
                        color: t.color.sectionHeader || t.color.foreground,
                      }}
                    >
                      {field.label}
                    </Text>
                  ) : null}
                  {field.description ? (
                    <Text
                      style={{
                        color: t.color.description,
                        marginTop: t.spacing.xs,
                        fontSize: t.fontSize.sm,
                      }}
                    >
                      {field.description}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              <View style={sectionBodyStyle}>
                {renderElements(field.elements || [], {
                  state,
                  setValue: applyValue,
                  readOnly,
                  submitCount: localSubmitCount,
                  controller,
                  parentPath,
                  onFieldFocus,
                  registerFieldContainer,
                  registerFieldInput,
                  registerSectionContainer,
                  theme,
                  onFieldChange,
                  activeDrilldownPath: drilldownPath,
                  sectionMetadata: sectionMeta,
                  onDrilldownNavigate,
                  parentSectionPath: sectionPath,
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
          <View
            key={field.key || dataName}
            ref={
              dataName && typeof registerFieldContainer === 'function'
                ? (node) => registerFieldContainer(dataName, node)
                : undefined
            }
          >
            <FieldRenderer
              field={field}
              value={fieldValue}
              readOnly={fieldReadOnly}
              required={fieldRequired}
              error={fieldError}
              labelPosition={labelPosition}
              labelWidthPercent={labelWidthPercent}
              onFocus={onFieldFocus}
              inputRef={
                dataName && typeof registerFieldInput === 'function'
                  ? (node) => registerFieldInput(dataName, node)
                  : undefined
              }
              onChange={(val) => {
                if (!dataName) {
                  return;
                }
                if (typeof onFieldChange === 'function') {
                  onFieldChange(field, val, applyValue);
                  return;
                }
                applyValue(dataName, val);
              }}
            />
          </View>
        );
      });
    },
    [labelPosition, labelWidthPercent, openRepeatableEditor, openRepeatableList, resolveRepeatableInfo, sectionMetadata]
  );

  const canSubmit = !isReadOnly && typeof onSubmit === 'function';
  const hasSubmitHandler = typeof onSubmit === 'function';
  const activeRepeatableScreen = repeatableStack[repeatableStack.length - 1] || null;
  const resolvedPrimaryActionLabel =
    typeof primaryActionLabel === 'string' && primaryActionLabel.trim().length > 0
      ? primaryActionLabel.trim()
      : primaryActionMode === 'save'
        ? 'Save'
        : 'Submit';

  // Request cancel with discard confirmation if there are changes
  const requestCancel = useCallback(() => {
    if (typeof onRequestClose !== 'function') {
      return;
    }

    if (hasChanges) {
      Alert.alert(
        'Discard changes?',
        'You have unsaved changes that will be lost.',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => onRequestClose({ reason: 'cancel' }),
          },
        ]
      );
    } else {
      onRequestClose({ reason: 'cancel' });
    }
  }, [hasChanges, onRequestClose]);

  // Handle form submission
  const handleFormSubmit = useCallback(() => {
    setSubmitCount((count) => count + 1);

    const validationSummary = rootValidationSummary;
    if (validationSummary?.hasErrors || !onSubmit) {
      if (validationSummary?.hasErrors) {
        navigateToRootValidationIssue(getFirstValidationIssue(validationSummary));
      }
      return;
    }

    const submittedAt = new Date().toISOString();
    touchUpdatedAt(submittedAt);
    const submissionValues = submit();
    const timestampSnapshot = buildSubmissionTimestampSnapshot(
      timestampsRef.current,
      submittedAt
    );
    const submission = buildStructuredSubmission({
      schema: finalSchema,
      values: submissionValues,
      repeatable: repeatableStateRef.current,
      fieldKeyMode,
      timestamps: timestampSnapshot,
    });

    onSubmit(submission.structuredRecord, {
      repeatable: submission.repeatable,
      rawValues: submission.rawValues,
      validationSummary,
      timestamps: submission.timestamps,
    });
  }, [
    fieldKeyMode,
    finalSchema,
    navigateToRootValidationIssue,
    onSubmit,
    rootValidationSummary,
    submit,
    timestampsRef,
    touchUpdatedAt,
  ]);

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

  const handleRepeatableSave = useCallback(
    (screen, payload) => {
      if (!screen?.controller) {
        return;
      }
      const { repeatableKey, parentPath, mode: saveMode, instanceId } = screen;
      if (saveMode === 'edit' && typeof screen.controller.updateInstance === 'function') {
        screen.controller.updateInstance(
          repeatableKey,
          instanceId,
          () => payload,
          parentPath
        );
      } else if (saveMode !== 'edit' && typeof screen.controller.addInstance === 'function') {
        screen.controller.addInstance(repeatableKey, {
          parentPath,
          instanceId: payload.id,
          seedValues: payload.values,
        });
        if (payload.repeatable && typeof screen.controller.updateInstance === 'function') {
          screen.controller.updateInstance(
            repeatableKey,
            payload.id,
            (current) => ({
              ...current,
              ...payload,
            }),
            parentPath
          );
        }
      } else {
        const existing = screen.controller.getInstances(repeatableKey, parentPath);
        if (saveMode === 'edit') {
          const next = existing.map((instance) =>
            instance.id === instanceId ? payload : instance
          );
          screen.controller.setInstances(repeatableKey, next, parentPath);
        } else {
          screen.controller.setInstances(repeatableKey, [...existing, payload], parentPath);
        }
      }
      markRootDirty();
      touchUpdatedAt();
      popRepeatableScreen();
    },
    [markRootDirty, popRepeatableScreen, touchUpdatedAt]
  );

  const requestRepeatableRemoval = useCallback(
    (screen, instanceId) => {
      if (!screen?.controller || !instanceId) {
        return;
      }
      const instance = screen.controller.getInstance?.(
        screen.repeatableKey,
        instanceId,
        screen.parentPath
      );
      const instances = screen.controller.getInstances?.(screen.repeatableKey, screen.parentPath) || [];
      const index = instances.findIndex((entry) => entry.id === instanceId);

      setPendingRepeatableRemoval({
        controller: screen.controller,
        repeatableKey: screen.repeatableKey,
        parentPath: screen.parentPath,
        instanceId,
        entryTitle: getRepeatableEntryTitle(screen.field, instance, Math.max(index, 0)),
      });
    },
    [getRepeatableEntryTitle]
  );

  const dismissRepeatableRemoval = useCallback(() => {
    setPendingRepeatableRemoval(null);
  }, []);

  const confirmRepeatableRemoval = useCallback(() => {
    if (!pendingRepeatableRemoval?.controller) {
      setPendingRepeatableRemoval(null);
      return;
    }

    if (typeof pendingRepeatableRemoval.controller.removeInstance === 'function') {
      pendingRepeatableRemoval.controller.removeInstance(
        pendingRepeatableRemoval.repeatableKey,
        pendingRepeatableRemoval.instanceId,
        pendingRepeatableRemoval.parentPath
      );
    } else {
      const currentInstances =
        pendingRepeatableRemoval.controller.getInstances?.(
          pendingRepeatableRemoval.repeatableKey,
          pendingRepeatableRemoval.parentPath
        ) || [];
      pendingRepeatableRemoval.controller.setInstances?.(
        pendingRepeatableRemoval.repeatableKey,
        currentInstances.filter((instance) => instance.id !== pendingRepeatableRemoval.instanceId),
        pendingRepeatableRemoval.parentPath
      );
    }

    markRootDirty();
    touchUpdatedAt();
    setPendingRepeatableRemoval(null);
  }, [markRootDirty, pendingRepeatableRemoval, touchUpdatedAt]);

  const formName = finalSchema?.form?.name || null;

  // Render the main form content (with themed background)
  const renderMainFormContent = (theme) => (
    <KeyboardFormScrollView
      ref={mainScroll.scrollRef}
      onScroll={mainScroll.onScroll}
      onLayout={mainScroll.onLayout}
      contentContainerStyle={{ padding: 16 }}
      style={{ backgroundColor: theme.color.background }}
    >
      {renderElements(elements, {
        state: { values, visible, required, read_only, errors },
        setValue,
        readOnly: isReadOnly,
        submitCount,
        controller: formRepeatableController,
        parentPath: [],
        onFieldFocus: mainScroll.onFieldFocus,
        registerFieldContainer: registerRootFieldContainer,
        registerFieldInput: registerRootFieldInput,
        registerSectionContainer: registerRootSectionContainer,
        theme,
        onFieldChange: handleRootFieldValueChange,
        // Drilldown state for section rendering
        activeDrilldownPath,
        sectionMetadata,
        onDrilldownNavigate: pushDrilldownSection,
        parentSectionPath: [],
      })}
    </KeyboardFormScrollView>
  );

  const renderRepeatableScreens = (theme) => (
    <View style={{ flex: 1 }}>
      {repeatableStack.map((screen, index) => {
        const isActive = index === repeatableStack.length - 1;
        const screenNode =
          screen.type === 'list' ? (
            <RepeatableListScreen
              screen={screen}
              onBack={popRepeatableScreen}
              onEdit={(instanceId) =>
                openRepeatableEditor({
                  ...screen,
                  instanceId,
                  mode: 'edit',
                })
              }
              onAdd={() => {
                const draft = createEmptyRepeatableInstance(screen.repInfo);
                openRepeatableEditor({
                  ...screen,
                  instanceId: draft.id,
                  mode: 'create',
                  draft,
                });
              }}
              onRemove={(instanceId) => requestRepeatableRemoval(screen, instanceId)}
              getEntryTitle={getRepeatableEntryTitle}
              readOnly={isReadOnly}
              theme={theme}
            />
          ) : (
            <RepeatableEditorScreen
              screen={screen}
              schema={finalSchema}
              onBack={popRepeatableScreen}
              onSave={handleRepeatableSave}
              renderElements={renderElements}
              labelPosition={labelPosition}
              labelWidthPercent={labelWidthPercent}
              readOnly={isReadOnly}
              validateBeforeSave
              keyboardScrollOffset={keyboardScrollOffset}
              theme={theme}
              forceShowNavigationPanel={forceShowNavigationPanel}
            />
          );

        return (
          <View
            key={screen.screenId}
            style={{
              flex: 1,
              display: isActive ? 'flex' : 'none',
            }}
          >
            {screenNode}
          </View>
        );
      })}
      <RepeatableRemoveDialog
        visible={Boolean(pendingRepeatableRemoval)}
        entryTitle={pendingRepeatableRemoval?.entryTitle || null}
        onCancel={dismissRepeatableRemoval}
        onConfirm={confirmRepeatableRemoval}
      />
    </View>
  );

  return (
    <ThemeProvider colorMode={colorMode} customTheme={customTheme}>
      <ImageResolverProvider resolver={imageResolver}>
        <FieldRegistryProvider registry={registry} renderers={renderers}>
          <FormRendererInner
            showHeader={showHeader}
            activeRepeatableScreen={activeRepeatableScreen}
            formName={formName}
            interactionMode={interactionMode}
            requestCancel={typeof onRequestClose === 'function' ? requestCancel : undefined}
            handleFormSubmit={hasSubmitHandler ? handleFormSubmit : undefined}
            enterEditMode={enterEditMode}
            canSubmit={canSubmit}
            primaryActionMode={primaryActionMode}
            primaryActionLabel={resolvedPrimaryActionLabel}
            showPrimaryActionsInViewMode={showPrimaryActionsInViewMode}
            canOpenNavigationSheet={rootNavigationPanelAvailable}
            navigationSections={sectionTree}
            navigationIssues={showRootValidationList ? rootNavigationIssues : []}
            navigationValidationEnabled={submitCount > 0}
            onNavigateToSection={navigateToRootSection}
            onSelectValidationIssue={navigateToRootValidationIssue}
            activeNavigationSectionId={activeDrilldownSectionId}
            renderRepeatableScreens={renderRepeatableScreens}
            renderMainFormContent={renderMainFormContent}
            // Drilldown state props
            isRootPage={isRootPage}
            isFirstSpecialPage={isFirstSpecialPage}
            isNestedDrilldownPage={isNestedDrilldownPage}
            isRepeatableFirstPage={isRepeatableFirstPage}
            activeDrilldownSectionInfo={activeDrilldownSectionInfo}
            popDrilldownLevel={popDrilldownLevel}
          />
          <OperationAlertDialog
            visible={Boolean(activeAlert)}
            alert={activeAlert}
            onClose={closeAlert}
          />
        </FieldRegistryProvider>
      </ImageResolverProvider>
    </ThemeProvider>
  );
}

/**
 * Inner component that has access to theme context
 */
function FormRendererInner({
  showHeader,
  activeRepeatableScreen,
  formName,
  interactionMode,
  requestCancel,
  handleFormSubmit,
  enterEditMode,
  canSubmit,
  primaryActionMode,
  primaryActionLabel,
  showPrimaryActionsInViewMode,
  canOpenNavigationSheet,
  navigationSections,
  navigationIssues,
  navigationValidationEnabled,
  onNavigateToSection,
  onSelectValidationIssue,
  activeNavigationSectionId,
  renderRepeatableScreens,
  renderMainFormContent,
  // Drilldown state props
  isRootPage,
  isFirstSpecialPage,
  isNestedDrilldownPage,
  isRepeatableFirstPage,
  activeDrilldownSectionInfo,
  popDrilldownLevel,
}) {
  const { theme } = useTheme();
  const isReadOnly = interactionMode === 'readonly';
  const [navigationSheetVisible, setNavigationSheetVisible] = useState(false);

  // Compute header actions based on drilldown state (matching web logic)
  const headerActions = useMemo(() => {
    let leftAction = null;
    let rightAction = null;
    let secondaryRightAction = null;

    // Left action: Back or Cancel based on drilldown state
    if (isNestedDrilldownPage || isRepeatableFirstPage) {
      // Nested drilldown or repeatable first page: show Back button
      leftAction = {
        id: 'back',
        label: 'Back',
        variant: 'back',
        onPress: popDrilldownLevel,
      };
    } else if (isFirstSpecialPage) {
      // First special page (non-repeatable): show Cancel
      leftAction = {
        id: 'cancel-section',
        label: 'Cancel',
        variant: 'cancel',
        onPress: popDrilldownLevel,
      };
    } else if (isRootPage && typeof requestCancel === 'function') {
      // Root page: show Cancel
      leftAction = {
        id: 'cancel-root',
        label: 'Cancel',
        variant: 'cancel',
        onPress: requestCancel,
      };
    }

    if (isReadOnly && typeof enterEditMode === 'function') {
      rightAction = {
        id: 'enter-edit-mode',
        label: 'Edit',
        variant: 'edit',
        onPress: enterEditMode,
      };
      return { leftAction, rightAction, secondaryRightAction };
    }

    // Right action: Submit or Save based on context (edit mode only)
    if (isRootPage && typeof handleFormSubmit === 'function') {
      rightAction = {
        id: primaryActionMode === 'save' ? 'save' : 'submit',
        label: primaryActionLabel,
        variant: 'primary',
        onPress: handleFormSubmit,
        disabled: !canSubmit,
      };
    } else if (
      isFirstSpecialPage &&
      !isRepeatableFirstPage &&
      typeof handleFormSubmit === 'function'
    ) {
      // Drilldown section (non-repeatable): show Save
      rightAction = {
        id: 'save-section',
        label: 'Save',
        variant: 'primary',
        onPress: handleFormSubmit,
        disabled: !canSubmit,
      };
    }
    // Note: Add button for repeatable first page is handled in RepeatableListScreen

    return { leftAction, rightAction, secondaryRightAction };
  }, [
    canSubmit,
    enterEditMode,
    handleFormSubmit,
    isFirstSpecialPage,
    isNestedDrilldownPage,
    isReadOnly,
    isRepeatableFirstPage,
    isRootPage,
    primaryActionLabel,
    primaryActionMode,
    popDrilldownLevel,
    requestCancel,
  ]);

  // Get the title to show in header (section name when drilled down, form name otherwise)
  const headerTitle = activeDrilldownSectionInfo?.label || formName;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.background }}>
      {/* Fixed Header - always visible at top */}
      {showHeader && !activeRepeatableScreen && (
        <FormHeader
          formName={headerTitle}
          mode={interactionMode}
          leftAction={headerActions.leftAction}
          rightAction={headerActions.rightAction}
          secondaryRightAction={headerActions.secondaryRightAction}
          canSubmit={canSubmit}
          showPrimaryActionsInViewMode={showPrimaryActionsInViewMode}
          onTitlePress={
            canOpenNavigationSheet ? () => setNavigationSheetVisible(true) : undefined
          }
        />
      )}

      {/* Form Content */}
      {activeRepeatableScreen ? renderRepeatableScreens(theme) : renderMainFormContent(theme)}
      <FormNavigationSheet
        visible={navigationSheetVisible}
        title={formName || headerTitle || 'Form navigation'}
        sections={navigationSections}
        issues={navigationIssues}
        validationEnabled={navigationValidationEnabled}
        activeSectionId={activeNavigationSectionId}
        onClose={() => setNavigationSheetVisible(false)}
        onSelectSection={(sectionId) => {
          setNavigationSheetVisible(false);
          onNavigateToSection?.(sectionId);
        }}
        onSelectIssue={(issue) => {
          setNavigationSheetVisible(false);
          onSelectValidationIssue?.(issue);
        }}
      />
    </View>
  );
}

function FormNavigationSheet({
  visible,
  title,
  sections = [],
  issues = [],
  validationEnabled = false,
  activeSectionId = null,
  onClose,
  onSelectSection,
  onSelectIssue,
}) {
  const { theme } = useTheme();
  const hasSections = hasSectionNodes(sections);
  const hasIssues = Array.isArray(issues) && issues.length > 0;
  const [activeTab, setActiveTab] = useState(hasSections ? 'sections' : 'issues');

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (!hasSections && (validationEnabled || hasIssues)) {
      setActiveTab('issues');
      return;
    }

    if (hasSections && activeTab !== 'sections' && !validationEnabled && !hasIssues) {
      setActiveTab('sections');
    }
  }, [activeTab, hasIssues, hasSections, validationEnabled, visible]);

  const validationCount = hasIssues ? issues.length : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          justifyContent: 'flex-end',
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: theme.color.background,
            borderTopLeftRadius: theme.borderRadius.lg ?? 16,
            borderTopRightRadius: theme.borderRadius.lg ?? 16,
            borderWidth: 1,
            borderColor: theme.color.border,
            borderBottomWidth: 0,
            maxHeight: '72%',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              alignItems: 'center',
              paddingTop: 10,
              paddingBottom: 6,
            }}
          >
            <View
              style={{
                width: 44,
                height: 4,
                borderRadius: 999,
                backgroundColor: theme.color.border,
              }}
            />
          </View>
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottomWidth: 1,
              borderBottomColor: theme.color.border,
            }}
          >
            <Text
              style={{
                color: theme.color.foreground,
                fontWeight: theme.fontWeight.bold,
                fontSize: theme.fontSize.lg,
                flex: 1,
                marginRight: 12,
              }}
              numberOfLines={1}
            >
              {title || 'Form navigation'}
            </Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: pressed ? theme.color.cancelHoverBg : theme.color.cancelBg,
              })}
            >
              <Text style={{ color: theme.color.cancelFg, fontWeight: '600' }}>Done</Text>
            </Pressable>
          </View>
          <View
            style={{
              padding: 12,
              flexDirection: 'row',
              gap: 8,
              borderBottomWidth: 1,
              borderBottomColor: theme.color.border,
            }}
          >
            <Pressable
              onPress={() => setActiveTab('sections')}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor:
                  activeTab === 'sections' ? theme.color.buttonBorder : theme.color.border,
                backgroundColor:
                  activeTab === 'sections'
                    ? theme.color.buttonBg
                    : pressed
                      ? theme.color.cancelHoverBg
                      : theme.color.section,
                opacity: hasSections ? 1 : 0.9,
              })}
            >
              <Text
                style={{
                  color:
                    activeTab === 'sections' ? theme.color.buttonFg : theme.color.foreground,
                  textAlign: 'center',
                  fontWeight: '600',
                }}
              >
                Sections
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('issues')}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor:
                  activeTab === 'issues' ? theme.color.buttonBorder : theme.color.border,
                backgroundColor:
                  activeTab === 'issues'
                    ? theme.color.buttonBg
                    : pressed
                      ? theme.color.cancelHoverBg
                      : theme.color.section,
              })}
            >
              <Text
                style={{
                  color: activeTab === 'issues' ? theme.color.buttonFg : theme.color.foreground,
                  textAlign: 'center',
                  fontWeight: '600',
                }}
              >
                {`Issues${validationCount > 0 ? ` (${validationCount})` : ''}`}
              </Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{
              padding: 16,
              paddingBottom: 28,
              gap: 10,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {activeTab === 'issues' ? (
              validationEnabled ? (
                hasIssues ? (
                  issues.map((issue) => (
                    <Pressable
                      key={issue.id}
                      onPress={() => onSelectIssue?.(issue)}
                      style={({ pressed }) => ({
                        borderWidth: 1,
                        borderColor: theme.color.border,
                        borderRadius: theme.borderRadius.md ?? 10,
                        padding: 14,
                        backgroundColor: pressed ? theme.color.cancelHoverBg : theme.color.section,
                      })}
                    >
                      <Text
                        style={{
                          color: theme.color.foreground,
                          fontWeight: '600',
                          marginBottom: 4,
                        }}
                      >
                        {issue.label}
                      </Text>
                      <Text
                        style={{
                          color: theme.color.error,
                          marginBottom: issue.sectionLabel ? 6 : 0,
                        }}
                      >
                        {issue.message}
                      </Text>
                      {issue.sectionLabel ? (
                        <Text style={{ color: theme.color.description, fontSize: theme.fontSize.sm }}>
                          {issue.sectionLabel}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))
                ) : (
                  <Text style={{ color: theme.color.description }}>
                    No validation issues.
                  </Text>
                )
              ) : (
                <Text style={{ color: theme.color.description }}>
                  Submit or validate the form to view validation issues.
                </Text>
              )
            ) : hasSections ? (
              <NavigationSectionTree
                sections={sections}
                activeSectionId={activeSectionId}
                onSelectSection={onSelectSection}
              />
            ) : (
              <Text style={{ color: theme.color.description }}>
                This form has no sections.
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NavigationSectionTree({ sections = [], activeSectionId = null, onSelectSection }) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: 8 }}>
      {sections.map((section) => (
        <NavigationSectionNode
          key={section.id}
          node={section}
          level={0}
          activeSectionId={activeSectionId}
          onSelectSection={onSelectSection}
          theme={theme}
        />
      ))}
    </View>
  );
}

function NavigationSectionNode({
  node,
  level,
  activeSectionId,
  onSelectSection,
  theme,
}) {
  if (!node?.id) {
    return null;
  }

  const isActive = node.id === activeSectionId;
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={() => onSelectSection?.(node.id)}
        style={({ pressed }) => ({
          marginLeft: level * 14,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isActive ? theme.color.buttonBorder : theme.color.border,
          backgroundColor: isActive
            ? theme.color.buttonBg
            : pressed
              ? theme.color.cancelHoverBg
              : theme.color.section,
        })}
      >
        <Text
          style={{
            color: isActive ? theme.color.buttonFg : theme.color.foreground,
            fontWeight: '600',
          }}
        >
          {node.label || 'Section'}
        </Text>
      </Pressable>
      {hasChildren ? (
        <View style={{ gap: 8 }}>
          {node.children.map((child) => (
            <NavigationSectionNode
              key={child.id}
              node={child}
              level={level + 1}
              activeSectionId={activeSectionId}
              onSelectSection={onSelectSection}
              theme={theme}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function RepeatableListScreen({
  screen,
  onBack,
  onEdit,
  onAdd,
  onRemove,
  getEntryTitle,
  readOnly,
  theme,
}) {
  const instances =
    screen.controller?.getInstances(screen.repeatableKey, screen.parentPath) || [];
  const label = screen.field?.label || 'Repeatable Section';
  const description = screen.field?.description || null;
  const addLabel = `+ ${getRepeatableAddLabel(screen.field)}`;
  const leftAction = {
    id: 'back',
    label: 'Back',
    variant: 'back',
    onPress: onBack,
  };
  const rightAction = !readOnly
    ? {
        id: 'add-repeatable',
        label: addLabel,
        variant: 'primary',
        onPress: onAdd,
        icon: null,
      }
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.background }}>
      <FormHeader
        formName={label}
        mode={readOnly ? 'readonly' : 'edit'}
        leftAction={leftAction}
        rightAction={rightAction}
        showPrimaryActionsInViewMode={false}
      />
      <FormScrollView
        contentContainerStyle={{ paddingHorizontal: 16 }}
        style={{ backgroundColor: theme.color.background }}
      >
        <View style={{ marginBottom: 16 }}>
          {description ? (
            <Text style={{ color: theme.color.description, marginBottom: 4 }}>{description}</Text>
          ) : null}
          <Text style={{ color: theme.color.description }}>
            {instances.length} item{instances.length === 1 ? '' : 's'}
          </Text>
        </View>
        {instances.length === 0 ? (
          <Text style={{ color: theme.color.description }}>No entries yet.</Text>
        ) : (
          instances.map((instance, index) => (
            <View
              key={instance.id}
              style={{
                borderWidth: 1,
                borderColor: theme.color.border,
                borderRadius: 14,
                padding: 14,
                marginBottom: 12,
                backgroundColor: theme.color.section,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{ fontWeight: '600', color: theme.color.foreground, flex: 1, marginRight: 12 }}
                numberOfLines={1}
              >
                {getEntryTitle(screen.field, instance, index)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable
                  onPress={() => onEdit(instance.id)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: pressed ? theme.color.cancelHoverBg : theme.color.cancelBg,
                    marginRight: 8,
                  })}
                >
                  <Text style={{ color: theme.color.cancelFg, marginRight: 4 }}>View</Text>
                  <ChevronRight size={14} color={theme.color.cancelFg} strokeWidth={2} />
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
                    <Text style={{ color: theme.color.error }}>Remove</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
      </FormScrollView>
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
  validateBeforeSave = true,
  keyboardScrollOffset,
  theme,
  forceShowNavigationPanel = false,
}) {
  const editorScroll = useKeyboardAwareScroll({ scrollOffset: keyboardScrollOffset });
  const fieldContainerRefs = useRef(new Map());
  const fieldInputRefs = useRef(new Map());
  const sectionContainerRefs = useRef(new Map());
  const initialInstance = useMemo(
    () =>
      cloneDeep(
        screen.initialInstance || screen.draft || createEmptyRepeatableInstance(screen.repInfo)
      ),
    [screen.screenId]
  );
  const baseValues = useMemo(() => cloneDeep(screen.parentValues || {}), [screen.screenId]);
  const { activeAlert, closeAlert, handleOperations } = useOperationAlertBridge(
    screen.engineOptions?.onOperations
  );
  const effectiveEngineOptions = useMemo(
    () => ({
      ...(screen.engineOptions || {}),
      onOperations: handleOperations,
    }),
    [handleOperations, screen.engineOptions]
  );
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
    addRepeatableInstance,
    updateRepeatableInstance,
    removeRepeatableInstance,
    getRepeatableInstances,
    setRepeatableInstances,
    getRepeatableInstance,
    buildParentValues,
    triggerEvent,
    engineReadyVersion,
  } = useRepeatableInstanceEngine({
    schema,
    repInfo: screen.repInfo,
    baseValues,
    initialInstance: initialInstance || createEmptyRepeatableInstance(screen.repInfo),
    options: effectiveEngineOptions,
  });
  const [submitCount, setSubmitCount] = useState(0);
  const [discardDialogVisible, setDiscardDialogVisible] = useState(false);
  const initialSnapshotRef = useRef({
    values: initialInstance?.values || {},
    repeatable: initialInstance?.repeatable || {},
  });
  const loadEventTriggeredRef = useRef(false);
  const previousInteractionModeRef = useRef(null);

  const initialTimestampSeedValues = useMemo(
    () => ({
      ...(initialInstance?.values || {}),
      created_at_client: initialInstance?.created_at_client ?? initialInstance?.created_at,
      updated_at_client: initialInstance?.updated_at_client ?? initialInstance?.updated_at,
      created_at_server: initialInstance?.created_at_server ?? null,
      updated_at_server: initialInstance?.updated_at_server ?? null,
    }),
    [initialInstance]
  );
  const { timestampsRef, touchUpdatedAt } = useRecordTimestamps({
    initialValues: initialTimestampSeedValues,
    overrideValues: null,
    values,
  });

  const instanceId = initialInstance?.id || screen.instanceId;
  const nestedRepeatableParentPath = useMemo(() => [], []);
  const controller = useMemo(
    () => ({
      repeatableMetadata,
      addInstance: addRepeatableInstance,
      updateInstance: updateRepeatableInstance,
      removeInstance: removeRepeatableInstance,
      getInstances: getRepeatableInstances,
      setInstances: setRepeatableInstances,
      getInstance: getRepeatableInstance,
      buildParentValues,
    }),
    [
      addRepeatableInstance,
      buildParentValues,
      getRepeatableInstance,
      getRepeatableInstances,
      removeRepeatableInstance,
      repeatableMetadata,
      setRepeatableInstances,
      updateRepeatableInstance,
    ]
  );
  const resolveNestedRepeatableKey = useCallback((field) => {
    if (!field) return null;
    if (field.key && typeof field.key === 'string' && field.key.trim().length > 0) {
      return field.key;
    }
    return field.data_name || null;
  }, []);
  const {
    sectionTree: editorSectionTree,
    sectionMetadata: editorSectionMetadata,
    fieldToSectionPath: editorFieldToSectionPath,
  } = useMemo(
    () => buildSectionHierarchy(screen.repInfo?.field?.elements || [], resolveNestedRepeatableKey),
    [resolveNestedRepeatableKey, screen.repInfo?.field?.elements]
  );
  const [activeDrilldownPath, setActiveDrilldownPath] = useState([]);
  const [navigationSheetVisible, setNavigationSheetVisible] = useState(false);
  const activeDrilldownSectionId =
    activeDrilldownPath.length > 0 ? activeDrilldownPath[activeDrilldownPath.length - 1] : null;
  const activeDrilldownSectionInfo = activeDrilldownSectionId
    ? editorSectionMetadata[activeDrilldownSectionId]
    : null;
  const validationFields = useMemo(
    () =>
      collectValidatableFields(screen.repInfo?.field?.elements || [], {
        includeRepeatableChildren: false,
      }),
    [screen.repInfo]
  );

  useEffect(() => {
    setSubmitCount(0);
    setDiscardDialogVisible(false);
    setNavigationSheetVisible(false);
    setActiveDrilldownPath([]);
    fieldContainerRefs.current.clear();
    fieldInputRefs.current.clear();
    sectionContainerRefs.current.clear();
    loadEventTriggeredRef.current = false;
    previousInteractionModeRef.current = null;
    initialSnapshotRef.current = {
      values: cloneDeep(initialInstance?.values || {}),
      repeatable: cloneDeep(initialInstance?.repeatable || {}),
    };
  }, [initialInstance, screen.screenId]);

  useEffect(() => {
    loadEventTriggeredRef.current = false;
    previousInteractionModeRef.current = null;
  }, [engineReadyVersion]);

  useEffect(() => {
    if (!engineReadyVersion || loadEventTriggeredRef.current) {
      return;
    }

    triggerEvent('load-record');
    loadEventTriggeredRef.current = true;
  }, [engineReadyVersion, triggerEvent]);

  useEffect(() => {
    if (!engineReadyVersion) {
      return;
    }

    const interactionMode = readOnly ? 'readonly' : 'edit';
    const previousMode = previousInteractionModeRef.current;
    if (interactionMode === 'edit' && previousMode !== 'edit') {
      triggerEvent('edit-record');
    }

    previousInteractionModeRef.current = interactionMode;
  }, [engineReadyVersion, readOnly, triggerEvent]);

  const hasEntryChanges = useMemo(
    () =>
      !deepEqual(values, initialSnapshotRef.current.values) ||
      !deepEqual(repeatable, initialSnapshotRef.current.repeatable),
    [repeatable, values]
  );

  const handleRepeatableFieldValueChange = useCallback(
    (fieldDef, nextValue, applyValue = setValue) => {
      if (!fieldDef?.data_name) {
        return;
      }

      const dataName = fieldDef.data_name;
      applyValue(dataName, nextValue);
      triggerEvent('change', dataName, {
        value: nextValue,
        field: fieldDef,
      });
    },
    [setValue, triggerEvent]
  );

  const registerFieldContainer = useCallback((fieldName, node) => {
    if (!fieldName) return;
    if (node) {
      fieldContainerRefs.current.set(fieldName, node);
      return;
    }
    fieldContainerRefs.current.delete(fieldName);
  }, []);

  const registerFieldInput = useCallback((fieldName, node) => {
    if (!fieldName) return;
    if (node) {
      fieldInputRefs.current.set(fieldName, node);
      return;
    }
    fieldInputRefs.current.delete(fieldName);
  }, []);

  const registerSectionContainer = useCallback((sectionId, node) => {
    if (!sectionId) return;
    if (node) {
      sectionContainerRefs.current.set(sectionId, node);
      return;
    }
    sectionContainerRefs.current.delete(sectionId);
  }, []);

  const focusFieldByName = useCallback(
    (fieldName) => {
      if (!fieldName) {
        return;
      }
      const input = fieldInputRefs.current.get(fieldName) || null;
      const container = fieldContainerRefs.current.get(fieldName) || null;
      const target = input || container;
      if (!target) {
        return;
      }
      editorScroll.scrollToTarget(target);
      if (typeof input?.focus === 'function') {
        requestAnimationFrame(() => {
          input.focus();
        });
      }
    },
    [editorScroll]
  );

  const pushEditorDrilldownSection = useCallback(
    (sectionId) => {
      const section = editorSectionMetadata[sectionId];
      if (!section) return;
      setActiveDrilldownPath(section.drilldownPath);
    },
    [editorSectionMetadata]
  );

  const focusSectionById = useCallback(
    (sectionId) => {
      if (!sectionId) {
        return;
      }
      const target = sectionContainerRefs.current.get(sectionId) || null;
      if (target) {
        editorScroll.scrollToTarget(target);
      }
    },
    [editorScroll]
  );

  const popEditorDrilldownLevel = useCallback(() => {
    if (!activeDrilldownSectionId) {
      setActiveDrilldownPath([]);
      return;
    }
    const info = editorSectionMetadata[activeDrilldownSectionId];
    if (!info) {
      setActiveDrilldownPath([]);
      return;
    }
    setActiveDrilldownPath(info.drilldownPath.slice(0, -1));
  }, [activeDrilldownSectionId, editorSectionMetadata]);

  const navigateToEditorSection = useCallback(
    (sectionId) => {
      if (!sectionId) {
        return;
      }

      const sectionInfo = editorSectionMetadata?.[sectionId];
      if (!sectionInfo) {
        return;
      }

      const drilldownPath = Array.isArray(sectionInfo.drilldownPath) ? sectionInfo.drilldownPath : [];
      const opensDrilldown = drilldownPath[drilldownPath.length - 1] === sectionId;
      if (opensDrilldown) {
        setActiveDrilldownPath(drilldownPath);
        return;
      }

      if (drilldownPath.length > 0) {
        setActiveDrilldownPath(drilldownPath);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            focusSectionById(sectionId);
          });
        });
        return;
      }

      requestAnimationFrame(() => {
        focusSectionById(sectionId);
      });
    },
    [editorSectionMetadata, focusSectionById]
  );

  const navigateToValidationIssue = useCallback(
    (issue) => {
      if (!issue?.fieldName) {
        return;
      }
      const sectionPath = editorFieldToSectionPath[issue.fieldName];
      if (Array.isArray(sectionPath) && sectionPath.length > 0) {
        const targetSectionId = sectionPath[sectionPath.length - 1];
        const sectionInfo = editorSectionMetadata[targetSectionId];
        if (sectionInfo) {
          setActiveDrilldownPath(sectionInfo.drilldownPath);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              focusFieldByName(issue.fieldName);
            });
          });
          return;
        }
      }
      requestAnimationFrame(() => {
        focusFieldByName(issue.fieldName);
      });
    },
    [editorFieldToSectionPath, editorSectionMetadata, focusFieldByName]
  );

  const buildEntryValidationSummary = useCallback(
    () =>
      buildValidationSummary(validationFields, {
        getValue: (field) => (field?.data_name ? values?.[field.data_name] : null),
        isVisible: (field) => !field?.data_name || visible?.[field.data_name] !== false,
        isRequired: (field) => Boolean(field?.data_name && required?.[field.data_name]),
        getError: (field) => (field?.data_name ? errors?.[field.data_name] : null),
      }),
    [errors, required, validationFields, values, visible]
  );
  const entryValidationSummary = useMemo(
    () => buildEntryValidationSummary(),
    [buildEntryValidationSummary]
  );
  const showEntryValidationList = submitCount > 0 && entryValidationSummary?.hasErrors;
  const entryNavigationIssues = useMemo(
    () =>
      buildNavigationIssues(
        entryValidationSummary,
        editorSectionMetadata,
        editorFieldToSectionPath
      ),
    [editorFieldToSectionPath, editorSectionMetadata, entryValidationSummary]
  );
  const canOpenNavigationSheet =
    forceShowNavigationPanel || hasSectionNodes(editorSectionTree) || showEntryValidationList;

  const handleSave = () => {
    if (validateBeforeSave) {
      setSubmitCount((count) => count + 1);
      const validationSummary = entryValidationSummary;
      if (validationSummary.hasErrors) {
        navigateToValidationIssue(getFirstValidationIssue(validationSummary));
        return;
      }
    }
    const savedAt = new Date().toISOString();
    touchUpdatedAt(savedAt);
    const timestampSnapshot = buildSubmissionTimestampSnapshot(
      timestampsRef.current,
      savedAt
    );
    const payload = {
      ...(initialInstance || {}),
      id: instanceId,
      values: cloneDeep(submit()),
      repeatable: cloneDeep(repeatable),
      ...timestampSnapshot,
    };
    onSave(screen, payload);
  };
  const handleCancelRequest = useCallback(() => {
    if (activeDrilldownPath.length > 0) {
      popEditorDrilldownLevel();
      return;
    }
    if (!hasEntryChanges) {
      onBack();
      return;
    }
    setDiscardDialogVisible(true);
  }, [activeDrilldownPath.length, hasEntryChanges, onBack, popEditorDrilldownLevel]);

  const leftAction =
    activeDrilldownPath.length > 0
      ? {
          id: 'back',
          label: 'Back',
          variant: 'back',
          onPress: popEditorDrilldownLevel,
        }
      : {
          id: 'cancel',
          label: 'Cancel',
          variant: 'cancel',
          onPress: handleCancelRequest,
        };
  const rightAction =
    !readOnly && activeDrilldownPath.length === 0
      ? {
          id: 'save',
          label: 'Save',
          variant: 'primary',
          onPress: handleSave,
        }
      : null;
  const headerTitle = activeDrilldownSectionInfo?.label || screen.field?.label || 'Entry';

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.background }}>
      <FormHeader
        formName={headerTitle}
        mode={readOnly ? 'readonly' : 'edit'}
        leftAction={leftAction}
        rightAction={rightAction}
        showPrimaryActionsInViewMode={false}
        onTitlePress={
          canOpenNavigationSheet ? () => setNavigationSheetVisible(true) : undefined
        }
      />
      <KeyboardFormScrollView
        ref={editorScroll.scrollRef}
        onScroll={editorScroll.onScroll}
        onLayout={editorScroll.onLayout}
        contentContainerStyle={{ padding: 16 }}
        style={{ backgroundColor: theme.color.background }}
      >
        {renderElements(screen.repInfo?.field?.elements || [], {
          state: { values, visible, required, read_only, errors },
          setValue,
          readOnly,
          submitCount,
          controller,
          parentPath: nestedRepeatableParentPath,
          onFieldFocus: editorScroll.onFieldFocus,
          registerFieldContainer,
          registerFieldInput,
          registerSectionContainer,
          theme,
          onFieldChange: handleRepeatableFieldValueChange,
          activeDrilldownPath,
          sectionMetadata: editorSectionMetadata,
          onDrilldownNavigate: pushEditorDrilldownSection,
          parentSectionPath: [],
        })}
      </KeyboardFormScrollView>
      <FormNavigationSheet
        visible={navigationSheetVisible}
        title={screen.field?.label || 'Entry navigation'}
        sections={editorSectionTree}
        issues={showEntryValidationList ? entryNavigationIssues : []}
        validationEnabled={submitCount > 0}
        activeSectionId={activeDrilldownSectionId}
        onClose={() => setNavigationSheetVisible(false)}
        onSelectSection={(sectionId) => {
          setNavigationSheetVisible(false);
          navigateToEditorSection(sectionId);
        }}
        onSelectIssue={(issue) => {
          setNavigationSheetVisible(false);
          navigateToValidationIssue(issue);
        }}
      />
      <OperationAlertDialog
        visible={Boolean(activeAlert)}
        alert={activeAlert}
        onClose={closeAlert}
      />
      <RepeatableDiscardDialog
        visible={discardDialogVisible}
        onKeepEditing={() => setDiscardDialogVisible(false)}
        onDiscard={() => {
          setDiscardDialogVisible(false);
          onBack();
        }}
      />
    </View>
  );
}

function RepeatableDiscardDialog({ visible, onKeepEditing, onDiscard }) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onKeepEditing}
      statusBarTranslucent
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          justifyContent: 'center',
          padding: 24,
        }}
        onPress={onKeepEditing}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: theme.color.background,
            borderRadius: theme.borderRadius.lg ?? 12,
            padding: 20,
          }}
        >
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                color: theme.color.foreground,
                fontWeight: theme.fontWeight.bold,
                fontSize: theme.fontSize.lg,
                marginBottom: 8,
              }}
            >
              Discard changes?
            </Text>
            <Text style={{ color: theme.color.description }}>
              You have unsaved changes in this entry that will be lost.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Pressable
              onPress={onKeepEditing}
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: pressed ? theme.color.cancelHoverBg : theme.color.cancelBg,
                marginRight: 10,
              })}
            >
              <Text style={{ color: theme.color.cancelFg }}>Keep editing</Text>
            </Pressable>
            <Pressable
              onPress={onDiscard}
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: pressed ? '#fce8e8' : '#fdecec',
              })}
            >
              <Text style={{ color: theme.color.error, fontWeight: '600' }}>Discard</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RepeatableRemoveDialog({ visible, entryTitle, onCancel, onConfirm }) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          justifyContent: 'center',
          padding: 24,
        }}
        onPress={onCancel}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: theme.color.background,
            borderRadius: theme.borderRadius.lg ?? 12,
            padding: 20,
          }}
        >
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                color: theme.color.foreground,
                fontWeight: theme.fontWeight.bold,
                fontSize: theme.fontSize.lg,
                marginBottom: 8,
              }}
            >
              Remove this entry?
            </Text>
            <Text style={{ color: theme.color.description }}>
              {entryTitle ? `${entryTitle}\n\n` : ''}
              This cannot be undone.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: pressed ? theme.color.cancelHoverBg : theme.color.cancelBg,
                marginRight: 10,
              })}
            >
              <Text style={{ color: theme.color.cancelFg }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: pressed ? '#fce8e8' : '#fdecec',
              })}
            >
              <Text style={{ color: theme.color.error, fontWeight: '600' }}>Remove</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function OperationAlertDialog({ visible, alert, onClose }) {
  const { theme } = useTheme();
  const title =
    typeof alert?.title === 'string' && alert.title.trim().length > 0
      ? alert.title.trim()
      : 'Notice';
  const message =
    typeof alert?.message === 'string' && alert.message.trim().length > 0
      ? alert.message.trim()
      : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          justifyContent: 'center',
          padding: 24,
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: theme.color.background,
            borderRadius: theme.borderRadius.lg ?? 12,
            padding: 20,
          }}
        >
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                color: theme.color.foreground,
                fontWeight: theme.fontWeight.bold,
                fontSize: theme.fontSize.lg,
                marginBottom: message ? 8 : 0,
              }}
            >
              {title}
            </Text>
            {message ? (
              <Text style={{ color: theme.color.description }}>
                {message}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: pressed ? theme.color.buttonHoverBg : theme.color.buttonBg,
              })}
            >
              <Text style={{ color: theme.color.buttonFg, fontWeight: '600' }}>OK</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
