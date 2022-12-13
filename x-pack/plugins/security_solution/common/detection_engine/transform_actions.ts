/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { RuleAction } from '@kbn/alerting-plugin/common';
import type { ResponseAction, RuleResponseAction } from './rule_response_actions/schemas';
import type { RuleAlertAction } from './types';

export const transformRuleToAlertAction = ({
  group,
  id,
  action_type_id, // eslint-disable-line @typescript-eslint/naming-convention
  params,
}: RuleAlertAction): RuleAction => ({
  group,
  id,
  params,
  actionTypeId: action_type_id,
});

export const transformAlertToRuleAction = ({
  group,
  id,
  actionTypeId,
  params,
  frequency,
}: RuleAction): RuleAlertAction => {
  const action = {
    group,
    id,
    params,
    action_type_id: actionTypeId,
  } as RuleAlertAction;
  if (frequency) action.frequency = frequency;
  return action;
};

export const transformRuleToAlertResponseAction = ({
  action_type_id: actionTypeId,
  params,
}: ResponseAction): RuleResponseAction => {
  const {
    saved_query_id: savedQueryId,
    ecs_mapping: ecsMapping,
    pack_id: packId,
    ...rest
  } = params;

  return {
    params: {
      ...rest,
      savedQueryId,
      ecsMapping,
      packId,
    },
    actionTypeId,
  };
};

export const transformAlertToRuleResponseAction = ({
  actionTypeId,
  params,
}: RuleResponseAction): ResponseAction => {
  const { savedQueryId, ecsMapping, packId, ...rest } = params;
  return {
    params: {
      ...rest,
      saved_query_id: savedQueryId,
      ecs_mapping: ecsMapping,
      pack_id: packId,
    },
    action_type_id: actionTypeId,
  };
};
