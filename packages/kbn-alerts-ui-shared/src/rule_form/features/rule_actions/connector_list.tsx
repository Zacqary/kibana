/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { countBy } from 'lodash';
import React, { useMemo, useCallback, useState } from 'react';
import { i18n } from '@kbn/i18n';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiFacetGroup,
  EuiFacetButton,
  EuiCard,
  EuiSpacer,
  EuiText,
  EuiEmptyPrompt,
  EuiButton,
  EuiFieldSearch,
  useEuiTheme,
  EuiIcon,
} from '@elastic/eui';
import { omit } from 'lodash';
import { useActionTypes, useConnectors } from '../../contexts';

const actionTypeIdToDisplayName = (
  actionTypeId: string,
  actionTypes: ReturnType<typeof useActionTypes>['actionTypes']
) => {
  return actionTypes.find((actionType) => actionType.id === actionTypeId)?.name ?? actionTypeId;
};

const actionTypeIdToIconClass = (
  actionTypeId: string,
  actionTypes: ReturnType<typeof useActionTypes>['actionTypes']
) => {
  return actionTypes.find((actionType) => actionType.id === actionTypeId)?.iconClass ?? null;
};

interface ConnectorListProps {
  onSelectConnector: (connectorId: string) => void;
}
export const ConnectorList: React.FC<ConnectorListProps> = ({ onSelectConnector }) => {
  const [selectedActionType, setSelectedActionType] = useState<string | null>(null);
  const [searchString, setSearchString] = useState('');
  const onFilterByActionType = useCallback(
    (actionType: string | null) => setSelectedActionType(actionType),
    []
  );
  const onClearFilters = useCallback(() => {
    setSelectedActionType(null);
    setSearchString('');
  }, []);

  const { euiTheme } = useEuiTheme();
  const { actionTypes } = useActionTypes();
  const { connectors } = useConnectors();

  const connectorsList = [...connectors]
    .sort((a, b) => a.actionTypeId.localeCompare(b.actionTypeId) || a.name.localeCompare(b.name))
    .filter((connector) => connector.name.toLowerCase().includes(searchString.toLowerCase()));

  const connectorCountsByActionType: {
    total: number;
    [x: string]: number;
  } = useMemo(
    () => ({
      ...countBy(connectors, 'actionTypeId'),
      total: connectors.length,
    }),
    [connectors]
  );

  const facetList = useMemo(
    () =>
      Object.entries(omit(connectorCountsByActionType, 'total'))
        .sort(([, aCount], [, bCount]) => bCount - aCount)
        .map(([actionTypeId, count]) => (
          <EuiFacetButton
            key={actionTypeId}
            fullWidth
            quantity={count}
            onClick={() => onFilterByActionType(actionTypeId)}
            isSelected={selectedActionType === actionTypeId}
          >
            {actionTypeIdToDisplayName(actionTypeId, actionTypes)}
          </EuiFacetButton>
        )),
    [connectorCountsByActionType, onFilterByActionType, selectedActionType, actionTypes]
  );

  return (
    <>
      <EuiFieldSearch
        placeholder={i18n.translate('alertsUIShared.ruleForm.connectorsList.searchPlaceholder', {
          defaultMessage: 'Search',
        })}
        value={searchString}
        onChange={({ target: { value } }) => setSearchString(value)}
      />
      <EuiFlexGroup
        style={{
          height: '100%',
        }}
      >
        <EuiFlexItem
          grow={1}
          style={{
            paddingTop: euiTheme.size.base /* Match drop shadow padding in the right column */,
          }}
        >
          <EuiFacetGroup>
            <EuiFacetButton
              fullWidth
              quantity={connectorCountsByActionType.total}
              onClick={useCallback(() => onFilterByActionType(null), [onFilterByActionType])}
              isSelected={!selectedActionType}
            >
              {i18n.translate('alertsUIShared.ruleForm.connectorList.allConnectors', {
                defaultMessage: 'All',
              })}
            </EuiFacetButton>
            {facetList}
          </EuiFacetGroup>
        </EuiFlexItem>
        <EuiFlexItem
          grow={3}
          style={{
            overflowY: 'auto',
            padding: `${euiTheme.size.base} ${euiTheme.size.base} ${euiTheme.size.xl}`, // Add padding to prevent drop shadow from hovered cards from being cut off
          }}
        >
          {connectorsList.length === 0 && (
            <EuiEmptyPrompt
              color="subdued"
              iconType="search"
              title={
                <h2>
                  {i18n.translate('alertsUIShared.ruleForm.connectorList.noConnectorsError', {
                    defaultMessage: 'No connectors found',
                  })}
                </h2>
              }
              body={
                <p>
                  {i18n.translate('alertsUIShared.ruleForm.connectorList.noRuleTypesErrorBody', {
                    defaultMessage: 'Try a different search or change your filter settings',
                  })}
                  .
                </p>
              }
              actions={
                <EuiButton size="s" color="primary" fill onClick={onClearFilters}>
                  {i18n.translate('alertsUIShared.ruleForm.connectorList.clearFilters', {
                    defaultMessage: 'Clear filters',
                  })}
                </EuiButton>
              }
            />
          )}
          {connectorsList.map((connector) => (
            <React.Fragment key={connector.id}>
              <EuiCard
                titleSize="xs"
                layout="horizontal"
                icon={
                  <EuiIcon
                    size="l"
                    type={actionTypeIdToIconClass(connector.actionTypeId, actionTypes)}
                  />
                }
                hasBorder
                title={connector.name}
                onClick={() => onSelectConnector(connector.id)}
                description={
                  <EuiText
                    color="subdued"
                    size="xs"
                    style={{ textTransform: 'uppercase', fontWeight: euiTheme.font.weight.bold }}
                  >
                    {actionTypeIdToDisplayName(connector.actionTypeId, actionTypes)}
                  </EuiText>
                }
                style={{ marginRight: '8px', flexGrow: 0 }}
                data-test-subj={`${connector.id}-SelectOption`}
              />
              <EuiSpacer size="s" />
            </React.Fragment>
          ))}
        </EuiFlexItem>
      </EuiFlexGroup>
    </>
  );
};
