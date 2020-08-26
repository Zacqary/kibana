/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { schema } from '@kbn/config-schema';
import { createMetricAnomalyExecutor, FIRED_ACTIONS } from './metric_anomaly_executor';
import { METRIC_ANOMALY_ALERT_TYPE_ID, Severity } from './types';
import { InfraBackendLibs } from '../../infra_types';
import { oneOfLiterals, validateIsStringElasticsearchJSONFilter } from '../common/utils';
import {
  groupActionVariableDescription,
  alertStateActionVariableDescription,
  reasonActionVariableDescription,
  timestampActionVariableDescription,
  // valueActionVariableDescription,
  // metricActionVariableDescription,
  // thresholdActionVariableDescription,
} from '../common/messages';

export function registerMetricAnomalyAlertType(libs: InfraBackendLibs) {
  return {
    id: METRIC_ANOMALY_ALERT_TYPE_ID,
    name: 'Metric anomaly',
    validate: {
      params: schema.object(
        {
          condition: schema.object({
            severity: oneOfLiterals(Object.values(Severity)),
            metric: schema.string(),
            nodeType: schema.string(),
          }),
          filterQuery: schema.maybe(
            schema.string({ validate: validateIsStringElasticsearchJSONFilter })
          ),
          sourceId: schema.string(),
          alertOnNoData: schema.maybe(schema.boolean()),
        },
        { unknowns: 'allow' }
      ),
    },
    defaultActionGroupId: FIRED_ACTIONS.id,
    actionGroups: [FIRED_ACTIONS],
    executor: createMetricAnomalyExecutor(libs),
    actionVariables: {
      context: [
        { name: 'group', description: groupActionVariableDescription },
        { name: 'alertState', description: alertStateActionVariableDescription },
        { name: 'reason', description: reasonActionVariableDescription },
        { name: 'timestamp', description: timestampActionVariableDescription },
        // { name: 'value', description: valueActionVariableDescription },
        // { name: 'metric', description: metricActionVariableDescription },
        // { name: 'threshold', description: thresholdActionVariableDescription },
      ],
    },
    producer: 'infrastructure',
  };
}
