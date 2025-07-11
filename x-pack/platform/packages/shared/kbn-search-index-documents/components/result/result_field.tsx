/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';

import {
  EuiButtonIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPopover,
  EuiTableRow,
  EuiTableRowCell,
  EuiText,
} from '@elastic/eui';

import { i18n } from '@kbn/i18n';
import { ResultFieldProps } from './result_types';
import { PERMANENTLY_TRUNCATED_FIELDS } from './constants';
import { ResultFieldValue } from './result_field_value';

const iconMap: Record<string, string> = {
  boolean: 'tokenBoolean',
  date: 'tokenDate',
  date_range: 'tokenDate',
  dense_vector: 'tokenVectorDense',
  double: 'tokenNumber',
  double_range: 'tokenDate',
  flattened: 'tokenObject',
  float: 'tokenNumber',
  float_range: 'tokenNumber',
  geo_point: 'tokenGeo',
  geo_shape: 'tokenGeo',
  half_float: 'tokenNumber',
  histogram: 'tokenHistogram',
  integer: 'tokenNumber',
  integer_range: 'tokenNumber',
  ip: 'tokenIp',
  ip_range: 'tokenIp',
  join: 'tokenJoin',
  keyword: 'tokenKeyword',
  long: 'tokenNumber',
  long_range: 'tokenNumber',
  nested: 'tokenObject',
  object: 'tokenObject',
  percolator: 'tokenPercolator',
  rank_feature: 'tokenRankFeature',
  rank_features: 'tokenRankFeatures',
  scaled_float: 'tokenNumber',
  search_as_you_type: 'tokenSearchType',
  semantic_text: 'tokenSemanticText',
  shape: 'tokenShape',
  short: 'tokenNumber',
  sparse_vector: 'tokenVectorSparse',
  text: 'tokenString',
  token_count: 'tokenTokenCount',
  unsigned_long: 'tokenNumber',
};
const defaultToken = 'question';

export const ResultField: React.FC<ResultFieldProps> = ({
  iconType,
  fieldName,
  fieldValue,
  fieldType = 'object',
  isExpanded,
}) => {
  const shouldTruncate = !isExpanded || PERMANENTLY_TRUNCATED_FIELDS.includes(fieldType);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const fieldTypeLabel = i18n.translate('xpack.searchIndexDocuments.result.fieldTypeAriaLabel', {
    defaultMessage: 'This field is of the type {fieldType}',
    values: { fieldType },
  });

  return (
    <EuiTableRow className="resultField">
      <EuiTableRowCell className="resultFieldRowCell" valign="middle" truncateText={!isExpanded}>
        <EuiFlexGroup direction="row" alignItems="center" gutterSize="xs" justifyContent="center">
          <EuiFlexItem grow={false}>
            <EuiPopover
              button={
                <EuiButtonIcon
                  aria-label={i18n.translate(
                    'xpack.searchIndexDocuments.result.fieldTypeButtonAriaLabel',
                    {
                      defaultMessage: "Show this field's type",
                    }
                  )}
                  onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                  iconType={iconType || (fieldType ? iconMap[fieldType] : defaultToken)}
                />
              }
              isOpen={isPopoverOpen}
            >
              {fieldTypeLabel}
            </EuiPopover>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiText size="s" color="default">
              {fieldName}
            </EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiTableRowCell>
      <EuiTableRowCell className="resultFieldRowCell" truncateText={shouldTruncate} valign="middle">
        <ResultFieldValue fieldValue={fieldValue} fieldType={fieldType} isExpanded={isExpanded} />
      </EuiTableRowCell>
    </EuiTableRow>
  );
};
