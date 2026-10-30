import type { ComponentType, Context, ReactNode } from 'react';

export type Form0Field = Record<string, any> & {
  type: string;
  key?: string;
  data_name?: string;
  label?: string;
};

export type Form0FieldRendererProps = {
  field: Form0Field;
  value?: unknown;
  onChange?: (nextValue: unknown) => void;
  onKeyDown?: (event: unknown) => void;
  readOnly?: boolean;
  required?: boolean;
  error?: string | null;
  labelPosition?: 'top' | 'side';
  labelWidthPercent?: number;
  onFocus?: (event: unknown) => void;
  inputRef?: unknown;
  inputProps?: Record<string, any>;
};

export type Form0FieldRenderer = ComponentType<Form0FieldRendererProps>;

export type FormRendererSnapshotTimestamps = {
  created_at_client: string | null;
  updated_at_client: string | null;
  created_at_server: string | null;
  updated_at_server: string | null;
};

export type FormRendererSnapshot = {
  raw_values: Record<string, unknown>;
  repeatable: Record<string, unknown>;
  timestamps: FormRendererSnapshotTimestamps;
};

export type FormRendererSnapshotChangeMeta = {
  kind: 'seed' | 'change';
  dirty: boolean;
};

export type FormRendererValidationIssue = {
  field?: Form0Field | null;
  fieldName?: string | null;
  message?: string | null;
  kind?: string;
  instancePath?: FormRendererDiagnosticInstancePath;
};

export type FormRendererValidationSummary = {
  hasErrors: boolean;
  requiredFieldErrors: FormRendererValidationIssue[];
  generalErrors: FormRendererValidationIssue[];
  orderedIssues?: FormRendererValidationIssue[];
};

export type FormRendererSubmitMeta = {
  repeatable?: Record<string, unknown>;
  rawValues?: Record<string, unknown>;
  validationSummary?: FormRendererValidationSummary;
  timestamps?: FormRendererSnapshotTimestamps;
  preparationId?: string;
  freshness?: FormRendererFreshness;
};

export type FormRendererSaveMeta = {
  preparationId?: string;
  freshness?: FormRendererFreshness;
  validationSummary: FormRendererValidationSummary;
  dirty: boolean;
};

export type FormRendererEngineOperation = Record<string, any> & {
  type?: string;
  operation?: string;
  params?: Record<string, any>;
};

export type FormRendererDiagnosticInstancePath = {
  repeatableKey: string;
  instanceId: string | number | null;
  index: number;
  identity: 'id' | 'position';
}[];

export type FormRendererCalculationDiagnostic = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  fieldName: string;
  phase?: string;
  suggestion: string | null;
  context: Record<string, unknown> & {
    instancePath: FormRendererDiagnosticInstancePath;
  };
};

export type FormRendererDiagnosticsMeta = {
  scopeId: string;
  instancePath: FormRendererDiagnosticInstancePath;
  evaluationId: number;
  kind: 'evaluation' | 'scope-ended';
};

export type FormRendererEventRequest = {
  type: string;
  fieldKey?: string;
  instancePath?: FormRendererDiagnosticInstancePath;
  scopeId?: string;
  metadata?: Record<string, unknown>;
};

export type FormRendererEventIssue = {
  code: string;
  message: string;
  eventType?: string | null;
  instancePath: FormRendererDiagnosticInstancePath;
};

export type FormRendererEventResult = {
  status: 'completed' | 'failed';
  operations: FormRendererEngineOperation[];
  validationIssues: {
    message: string;
    instancePath: FormRendererDiagnosticInstancePath;
  }[];
  issues: FormRendererEventIssue[];
};

export type FormRendererSavePreparation = {
  status: 'completed' | 'failed' | 'requires_decision' | 'cancelled';
  preparationId?: string;
  reviewId?: string;
  choices?: ('refresh' | 'retain' | 'cancel')[];
  changeCount?: number;
  childChangeCount?: number;
  freshness?: FormRendererFreshness;
  diagnostics?: FormRendererCalculationDiagnostic[];
  eligible: boolean;
  payload: Record<string, unknown> | null;
  meta?: Record<string, unknown>;
  validationSummary?: FormRendererValidationSummary;
  issues: FormRendererEventIssue[];
};

export type FormRendererFreshness = {
  version: 1;
  status: 'current' | 'pending';
  schemaRevision: string;
  affected: {
    instancePath: FormRendererDiagnosticInstancePath;
    fields: { fieldName: string; fieldKey: string }[];
  }[];
};

export type FormRendererEventController = {
  getSaveChanges: (request: { preparationId: string; offset?: number; limit?: number }) => Promise<{
    status: string;
    total?: number;
    offset?: number;
    changes?: {
      instancePath: FormRendererDiagnosticInstancePath;
      fieldName: string;
      fieldKey: string;
      before: unknown;
      after: unknown;
    }[];
    issues: FormRendererEventIssue[];
  }>;
  acknowledgeSave: (request: { preparationId: string }) => {
    status: string;
    issues: FormRendererEventIssue[];
    freshness?: FormRendererFreshness;
  };

  dispatch: (request: FormRendererEventRequest) => Promise<FormRendererEventResult>;
  prepareSave: (request: {
    intent: 'submit' | 'draft';
    signal?: AbortSignal;
    decision?: { reviewId: string; action: 'refresh' | 'retain' | 'cancel' };
    instancePath?: FormRendererDiagnosticInstancePath;
    scopeId?: string;
  }) => Promise<FormRendererSavePreparation>;
};

export type FormRendererEventOptions =
  | {
      lifecycle?: boolean;
      recordKind: 'new' | 'existing';
      fieldInteractions?: ('focus' | 'blur' | 'click')[];
    }
  | {
      lifecycle: false;
      recordKind?: 'new' | 'existing';
      fieldInteractions?: ('focus' | 'blur' | 'click')[];
    };

export type FormRendererEngineOptions = {
  events?: FormRendererEventOptions;
  onEventController?: (controller: FormRendererEventController | null) => void | Promise<void>;
  diagnostics?: { console?: boolean };
  onDiagnostics?: (
    snapshot: FormRendererCalculationDiagnostic[],
    meta: FormRendererDiagnosticsMeta
  ) => void | Promise<void>;
  helpers?: Record<string, (...args: any[]) => unknown>;
  security?: unknown;
  onWarning?: (warning: unknown) => void;
  onOperations?: (
    operations: FormRendererEngineOperation[],
    meta: Record<string, any>,
    fallback: (
      operations: FormRendererEngineOperation[],
      meta?: Record<string, any>
    ) => void | Promise<void>
  ) => void | Promise<void>;
  onUpdate?: (state: Record<string, any>, engine: unknown) => void;
};

export type Form0FieldRegistry = {
  registerFieldComponent: (type: string, component: Form0FieldRenderer) => void;
  unregisterFieldComponent: (type: string) => void;
  resetFieldComponents: () => void;
  getFieldComponent: (type: string) => Form0FieldRenderer | undefined;
  listRegisteredFieldTypes: () => string[];
  getMissingFieldComponentTypes: () => string[];
};

export type FormRendererProps = {
  /** Managed event failures are reported by default; does not change validation or evaluation. */
  eventDiagnostics?: { failures?: boolean };
  /** Console reporting only; independent of calculation diagnostics and lifecycle settings. */
  submissionDiagnostics?: {
    /** Report save/preparation failures; callback errors retain their original object. Defaults to true. */
    saveFailures?: boolean;
    /** Log blocked Submit and row Save attempts; defaults to false. */
    validationBlocks?: boolean;
  };
  submissionOptions?: {
    mode?: 'automatic' | 'confirm';
    allowRetain?: boolean;
    messages?: Partial<
      Record<
        | 'title'
        | 'refresh'
        | 'retain'
        | 'cancel'
        | 'previous'
        | 'next'
        | 'pending'
        | 'explanation'
        | 'childCalculations'
        | 'totalChanges',
        string
      >
    >;
  };
  initialFreshness?: FormRendererFreshness | null;
  schema: Record<string, any>;
  initialValues?: Record<string, any>;
  initialSnapshot?: FormRendererSnapshot;
  overrideValues?: Record<string, any>;
  onSubmit?: (
    structuredRecord: Record<string, any>,
    meta?: FormRendererSubmitMeta
  ) => void | Promise<void>;
  onSave?: (snapshot: FormRendererSnapshot, meta: FormRendererSaveMeta) => void | Promise<void>;
  onSnapshotChange?: (snapshot: FormRendererSnapshot, meta: FormRendererSnapshotChangeMeta) => void;
  fieldKeyMode?: 'prefer-key' | 'data-name';
  mode?: 'edit' | 'readonly';
  /** Opening mode for existing repeatable rows; new rows always start in edit mode. */
  repeatableEntryMode?: 'edit' | 'readonly';
  keyboardScrollOffset?: number;
  debug?: boolean;
  onSchemaReady?: (schema: Record<string, any>) => void;
  labelPosition?: 'top' | 'side';
  labelWidthPercent?: number;
  renderers?: Record<string, Form0FieldRenderer>;
  registry?: Form0FieldRegistry;
  onRequestClose?: (input?: { reason?: string }) => void;
  showPrimaryActionsInViewMode?: boolean;
  showHeader?: boolean;
  primaryActionMode?: 'submit' | 'save';
  primaryActionLabel?: string;
  headerAccessory?: ReactNode;
  forceShowNavigationPanel?: boolean;
  colorMode?: 'light' | 'dark' | 'system';
  customTheme?: Record<string, any> | null;
  imageResolver?: ((path: string) => any) | null;
  engineOptions?: FormRendererEngineOptions;
};

export const FormRenderer: ComponentType<FormRendererProps>;
export const FormHeader: ComponentType<Record<string, any>>;

export const ThemeProvider: ComponentType<{
  colorMode?: 'light' | 'dark' | 'system';
  customTheme?: Record<string, any> | null;
  children?: ReactNode;
}>;
export const useTheme: () => {
  theme: any;
};
export const ThemeContext: Context<any>;

export const lightTheme: Record<string, any>;
export const darkTheme: Record<string, any>;
export const mergeThemes: (...themes: Array<Record<string, any>>) => Record<string, any>;
export const getThemeByName: (name?: string | null) => Record<string, any>;

export const ImageResolverProvider: ComponentType<{
  resolver?: ((path: string) => any) | null;
  children?: ReactNode;
}>;
export const useImageResolver: () => ((path: string) => any) | null;
export const ImageResolverContext: Context<any>;

export const registerFieldComponent: (type: string, component: Form0FieldRenderer) => void;
export const unregisterFieldComponent: (type: string) => void;
export const resetFieldComponents: () => void;
export const getFieldComponent: (type: string) => Form0FieldRenderer | undefined;
export const listRegisteredFieldTypes: () => string[];
export const getMissingFieldComponentTypes: () => string[];
export const createFieldRegistry: (options?: {
  includeDefaults?: boolean;
  trackMissingTypes?: boolean;
  warnOnUnregisteredTypes?: boolean;
  renderers?: Record<string, Form0FieldRenderer>;
}) => Form0FieldRegistry;
export const defaultFieldRegistry: Form0FieldRegistry;
export const KNOWN_FIELD_TYPES: string[];

export const FieldRegistryProvider: ComponentType<{
  registry?: Form0FieldRegistry;
  renderers?: Record<string, Form0FieldRenderer>;
  children?: ReactNode;
}>;
export const useFieldRegistry: () => Form0FieldRegistry;
export const FieldRegistryContext: Context<any>;

export const Text: ComponentType<Record<string, any>>;
export const TextInput: ComponentType<Record<string, any>>;

export const form0Fonts: Record<string, unknown>;
export const FORM0_FONT_FAMILY: string;
export const FORM0_FONT_FAMILY_ITALIC: string;
export const FORM0_FONT_FAMILY_BY_WEIGHT: Record<string, string>;
export const FORM0_FONT_FAMILY_BY_WEIGHT_ITALIC: Record<string, string>;
