/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo } from 'react';
import moment from 'moment';
import { EuiLink } from '@elastic/eui';
import { RuleAlertingOutcome } from '@kbn/alerting-plugin/common';
import { useHistory } from 'react-router-dom';
import { routeToRuleDetails } from '../../../constants';
import { formatRuleAlertCount } from '../../../../common/lib/format_rule_alert_count';
import { useSpacesData } from '../../../../common/lib/kibana';
import { RuleEventLogListStatus } from './rule_event_log_list_status';
import { RuleDurationFormat } from '../../rules_list/components/rule_duration_format';
import {
  RULE_EXECUTION_LOG_COLUMN_IDS,
  RULE_EXECUTION_LOG_DURATION_COLUMNS,
  RULE_EXECUTION_LOG_ALERT_COUNT_COLUMNS,
} from '../../../constants';

export const DEFAULT_DATE_FORMAT = 'MMM D, YYYY @ HH:mm:ss.SSS';

export type ColumnId = typeof RULE_EXECUTION_LOG_COLUMN_IDS[number];

interface RuleEventLogListCellRendererProps {
  columnId: ColumnId;
  version?: string;
  value?: string | string[];
  dateFormat?: string;
  ruleId?: string;
  spaceIds?: string[];
}

export const RuleEventLogListCellRenderer = (props: RuleEventLogListCellRendererProps) => {
  const { columnId, value, version, dateFormat = DEFAULT_DATE_FORMAT, ruleId, spaceIds } = props;
  const spacesData = useSpacesData();

  const history = useHistory();

  const activeSpace = useMemo(
    () => spacesData?.spacesMap.get(spacesData?.activeSpaceId),
    [spacesData]
  );

  const ruleOnDifferentSpace = useMemo(
    () => activeSpace && !spaceIds?.includes(activeSpace.id),
    [activeSpace, spaceIds]
  );

  const onClickRuleName = useCallback(() => {
    if (!ruleId) return;
    const ruleRoute = routeToRuleDetails.replace(':ruleId', ruleId);
    if (ruleOnDifferentSpace) {
      const [linkedSpaceId] = spaceIds ?? [];
      const spacePath = linkedSpaceId !== 'default' ? `/s/${linkedSpaceId}` : '';
      const historyPathname = history.location.pathname;
      const newPathname = `${spacePath}${window.location.pathname
        .replace(/^\/s\/([^/])+/, '')
        .replace(historyPathname, ruleRoute)}`;
      const newUrl = window.location.href.replace(window.location.pathname, newPathname);
      window.open(newUrl, '_blank');
      return;
    }
    history.push(ruleRoute);
  }, [ruleId, history, ruleOnDifferentSpace, spaceIds]);

  if (typeof value === 'undefined') {
    return null;
  }

  if (columnId === 'status') {
    return <RuleEventLogListStatus status={value as RuleAlertingOutcome} />;
  }

  if (columnId === 'timestamp') {
    return <>{moment(value).format(dateFormat)}</>;
  }

  if (columnId === 'rule_name' && ruleId) {
    return <EuiLink onClick={onClickRuleName}>{value}</EuiLink>;
  }

  if (columnId === 'space_ids') {
    if (activeSpace && value.includes(activeSpace.id)) return <>{activeSpace.name}</>;
    if (spacesData) return <>{spacesData.spacesMap.get(value[0])?.name ?? value[0]}</>;
  }

  if (RULE_EXECUTION_LOG_ALERT_COUNT_COLUMNS.includes(columnId)) {
    return <>{formatRuleAlertCount(value as string, version)}</>;
  }

  if (RULE_EXECUTION_LOG_DURATION_COLUMNS.includes(columnId)) {
    return <RuleDurationFormat duration={parseInt(value as string, 10)} />;
  }

  return <>{value}</>;
};
