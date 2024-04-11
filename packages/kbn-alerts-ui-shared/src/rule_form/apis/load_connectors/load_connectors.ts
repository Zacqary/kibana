/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
import { HttpSetup } from '@kbn/core/public';
import { AsApiContract, RewriteRequestCase } from '@kbn/actions-types';
import { BASE_ACTION_API_PATH } from '../../common/constants';
import type { ActionConnector, ActionConnectorProps } from '../../../types';

const rewriteResponseRes = (
  results: Array<
    AsApiContract<ActionConnectorProps<Record<string, unknown>, Record<string, unknown>>>
  >
): Array<ActionConnectorProps<Record<string, unknown>, Record<string, unknown>>> => {
  return results.map((item) => transformConnector(item));
};

const transformConnector: RewriteRequestCase<
  ActionConnectorProps<Record<string, unknown>, Record<string, unknown>>
> = ({
  connector_type_id: actionTypeId,
  is_preconfigured: isPreconfigured,
  is_deprecated: isDeprecated,
  referenced_by_count: referencedByCount,
  is_missing_secrets: isMissingSecrets,
  is_system_action: isSystemAction,
  ...res
}) => ({
  actionTypeId,
  isPreconfigured,
  isDeprecated,
  referencedByCount,
  isMissingSecrets,
  isSystemAction,
  ...res,
});

export async function loadConnectors({
  http,
  includeSystemActions = false,
}: {
  http: HttpSetup;
  includeSystemActions?: boolean;
}): Promise<ActionConnector[]> {
  // Use the internal get_all_system route to load all action connectors and preconfigured system action connectors
  // This is necessary to load UI elements that require system action connectors, even if they're not selectable and
  // editable from the connector selection UI like a normal action connector.
  const path = `${BASE_ACTION_API_PATH}/connectors`;

  const res = await http.get<Parameters<typeof rewriteResponseRes>[0]>(path);

  return rewriteResponseRes(res) as ActionConnector[];
}
