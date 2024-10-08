/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { DataViewField } from '@kbn/data-views-plugin/common';
import { CollapseFunctions } from './constants';
import type { SupportedMetric } from './lib/convert/supported_metrics';
import type {
  CollapseFunction,
  Column,
  ColumnWithMeta,
  Layer,
  XYAnnotationsLayerConfig,
  XYLayerConfig,
} from './types';

export const isAnnotationsLayer = (
  layer: Pick<XYLayerConfig, 'layerType'>
): layer is XYAnnotationsLayerConfig => layer.layerType === 'annotations';

export const getIndexPatternIds = (layers: Layer[]) =>
  layers.map(({ indexPatternId }) => indexPatternId);

const isValidFieldType = (
  visType: string,
  { supportedDataTypes }: SupportedMetric,
  field: DataViewField
) => {
  const availableDataTypes = supportedDataTypes[visType] ?? supportedDataTypes.default;
  return availableDataTypes.includes(field.type);
};

export const isFieldValid = (
  visType: string,
  field: DataViewField | undefined,
  aggregation: SupportedMetric
): field is DataViewField => {
  if (!field && aggregation.isFieldRequired) {
    return false;
  }

  if (field && (!field.aggregatable || !isValidFieldType(visType, aggregation, field))) {
    return false;
  }

  return true;
};

export const isCollapseFunction = (candidate: string | undefined): candidate is CollapseFunction =>
  Boolean(candidate && CollapseFunctions.includes(candidate as CollapseFunction));

const isColumnWithMeta = (column: Column): column is ColumnWithMeta => {
  if ((column as ColumnWithMeta).meta) {
    return true;
  }
  return false;
};

export const excludeMetaFromColumn = (column: Column) => {
  if (isColumnWithMeta(column)) {
    const { meta, ...rest } = column;
    return rest;
  }
  return column;
};
