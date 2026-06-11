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
};

export type FormRendererEngineOperation = Record<string, any> & {
  type?: string;
  operation?: string;
  params?: Record<string, any>;
};

export type FormRendererEngineOptions = {
  helpers?: Record<string, (...args: any[]) => unknown>;
  security?: unknown;
  onWarning?: (warning: unknown) => void;
  onOperations?: (
    operations: FormRendererEngineOperation[],
    meta: Record<string, any>,
    fallback: (
      operations: FormRendererEngineOperation[],
      meta?: Record<string, any>,
    ) => void,
  ) => void;
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
  schema: Record<string, any>;
  initialValues?: Record<string, any>;
  initialSnapshot?: FormRendererSnapshot;
  overrideValues?: Record<string, any>;
  onSubmit?: (
    structuredRecord: Record<string, any>,
    meta?: FormRendererSubmitMeta,
  ) => void | Promise<void>;
  onSnapshotChange?: (
    snapshot: FormRendererSnapshot,
    meta: FormRendererSnapshotChangeMeta,
  ) => void;
  fieldKeyMode?: 'prefer-key' | 'data-name';
  mode?: 'edit' | 'readonly';
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
  forceShowNavigationPanel?: boolean;
  colorMode?: 'light' | 'dark';
  customTheme?: Record<string, any> | null;
  imageResolver?: ((path: string) => any) | null;
  engineOptions?: FormRendererEngineOptions;
};

export const FormRenderer: ComponentType<FormRendererProps>;
export const FormHeader: ComponentType<Record<string, any>>;

export const ThemeProvider: ComponentType<{
  colorMode?: 'light' | 'dark';
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
