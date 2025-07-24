/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { DataViewField } from '@kbn/data-views-plugin/common';
import { FieldFormatConvertFunction } from '@kbn/field-formats-plugin/common';
import {
  HasEditCapabilities,
  PublishesDataViews,
  PublishesTitle,
  PublishingSubject,
} from '@kbn/presentation-publishing';

import { PublishesESQLVariable } from '@kbn/esql-types';
import { ControlInputOption, ControlOutputOption, DefaultDataControlState } from '../../../common';
import { ControlGroupApi } from '../../control_group/types';
import { ControlFactory, DefaultControlApi } from '../types';
import { PublishesAsyncFilters } from './publishes_async_filters';

export type DataControlFieldFormatter = FieldFormatConvertFunction | ((toFormat: any) => string);

export interface PublishesField {
  field$: PublishingSubject<DataViewField | undefined>;
  fieldFormatter: PublishingSubject<DataControlFieldFormatter>;
}

export interface PublishesControlInputOutput {
  input$: PublishingSubject<ControlInputOption>;
  output$: PublishingSubject<ControlOutputOption>;
}

export interface PublishesESQLQuery {
  esqlQuery$: PublishingSubject<string | undefined>;
}

export interface PublishesStaticValues {
  staticValues$: PublishingSubject<Array<{ value: string; text: string }> | undefined>;
}

export type DataControlApi = DefaultControlApi &
  Omit<PublishesTitle, 'hideTitle$'> & // control titles cannot be hidden
  HasEditCapabilities &
  PublishesDataViews &
  PublishesField &
  PublishesAsyncFilters &
  PublishesESQLVariable &
  PublishesESQLQuery &
  PublishesControlInputOutput &
  PublishesStaticValues;

export interface CustomOptionsComponentProps<
  State extends DefaultDataControlState = DefaultDataControlState
> {
  initialState: Partial<State>;
  field?: DataViewField;
  updateState: (newState: Partial<State>) => void;
  setControlEditorValid: (valid: boolean) => void;
  controlGroupApi: ControlGroupApi;
  output: ControlOutputOption;
  input: ControlInputOption;
}

export interface DataControlFactory<
  State extends DefaultDataControlState = DefaultDataControlState,
  Api extends DataControlApi = DataControlApi
> extends ControlFactory<State, Api> {
  isFieldCompatible: (field: DataViewField) => boolean;
  CustomOptionsComponent?: React.FC<CustomOptionsComponentProps<State>>;
}

export const isDataControlFactory = (
  factory: ControlFactory<object, any>
): factory is DataControlFactory<any, any> => {
  return typeof (factory as DataControlFactory).isFieldCompatible === 'function';
};

interface DataControlField {
  field: DataViewField;
  compatibleControlTypes: string[];
}

export interface DataControlFieldRegistry {
  [fieldName: string]: DataControlField;
}
