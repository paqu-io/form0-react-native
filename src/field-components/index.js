import { TextFieldComponent } from './text-field.js';
import { NumericFieldComponent } from './numeric-field.js';
import { CalculatedFieldComponent } from './calculated-field.js';
import { SingleChoiceFieldComponent } from './single-choice-field.js';
import { MultiChoiceFieldComponent } from './multi-choice-field.js';
import { BooleanFieldComponent } from './boolean-field.js';
import { DateFieldComponent } from './date-field.js';
import { TimeFieldComponent } from './time-field.js';
import { LabelFieldComponent } from './label-field.js';
import { TitleFieldComponent } from './title-field.js';
import { StatusFieldComponent } from './status-field.js';
import { PlaceholderFieldComponent } from './placeholder-field.js';

export {
  TextFieldComponent,
  NumericFieldComponent,
  CalculatedFieldComponent,
  SingleChoiceFieldComponent,
  MultiChoiceFieldComponent,
  BooleanFieldComponent,
  DateFieldComponent,
  TimeFieldComponent,
  LabelFieldComponent,
  TitleFieldComponent,
  StatusFieldComponent,
  PlaceholderFieldComponent,
};

export const defaultFieldComponents = {
  TextField: TextFieldComponent,
  NumericField: NumericFieldComponent,
  CalculatedField: CalculatedFieldComponent,
  SingleChoiceField: SingleChoiceFieldComponent,
  MultiChoiceField: MultiChoiceFieldComponent,
  BooleanField: BooleanFieldComponent,
  DateField: DateFieldComponent,
  TimeField: TimeFieldComponent,
  LabelField: LabelFieldComponent,
  TitleField: TitleFieldComponent,
  StatusField: StatusFieldComponent,
  PhotoField: PlaceholderFieldComponent,
  VideoField: PlaceholderFieldComponent,
  SignatureField: PlaceholderFieldComponent,
  FormLinkField: PlaceholderFieldComponent,
};
