/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { HttpSetup } from '@kbn/core-http-browser';
import { AsApiContract } from '@kbn/actions-types';
import { INTERNAL_BASE_ALERTING_API_PATH } from '../../common/constants';
import { transformResolvedRule } from '../common_transformations';
import { RuleFormRule } from '../../types';

export async function resolveRule({
  http,
  ruleId,
}: {
  http: HttpSetup;
  ruleId: string;
}): Promise<RuleFormRule> {
  const res = await http.get<AsApiContract<RuleFormRule>>(
    `${INTERNAL_BASE_ALERTING_API_PATH}/rule/${encodeURIComponent(ruleId)}/_resolve`
  );
  return transformResolvedRule(res);
}
