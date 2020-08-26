/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { AlertStates } from '../common/types';
import { InventoryItemType, SnapshotMetricType } from '../../../../common/inventory_models/types';

type NodeType = InventoryItemType;
export { AlertStates, NodeType };
export const METRIC_ANOMALY_ALERT_TYPE_ID = 'metrics.alert.anomaly';

export enum Severity {
  WARNING = 'warning',
  MINOR = 'minor',
  MAJOR = 'major',
  CRITICAL = 'critical',
}

export interface MetricAnomalyExpressionParams {
  nodeType: NodeType;
  metric: SnapshotMetricType;
  severity: Severity;
}
