/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { i18n } from '@kbn/i18n';
import React, { useCallback } from 'react';
import {
  EuiPageHeader,
  EuiModal,
  EuiPanel,
  EuiPageHeaderSection,
  EuiTitle,
  useEuiTheme,
  useCurrentEuiBreakpoint,
  EuiFlexGroup,
  EuiFlexItem,
  EuiTabs,
  EuiTab,
  EuiSpacer,
} from '@elastic/eui';
import { ConnectorList } from './connector_list';
import { useRuleFormDispatch } from '../../hooks';
import { addAction } from './slice';

export interface AddActionModalProps {
  onClose: () => void;
}

export const AddActionModal: React.FC<AddActionModalProps> = ({ onClose }) => {
  const { euiTheme } = useEuiTheme();
  const currentBreakpoint = useCurrentEuiBreakpoint() ?? 'm';
  const isFullscreenPortrait = ['s', 'xs'].includes(currentBreakpoint);

  const dispatch = useRuleFormDispatch();
  const onSelectConnector = useCallback(
    (connectorId: string) => {
      dispatch(addAction({ connectorId }));
      onClose();
    },
    [dispatch, onClose]
  );

  return (
    <EuiModal
      onClose={onClose}
      maxWidth={euiTheme.breakpoint[currentBreakpoint]}
      style={{
        width: euiTheme.breakpoint[currentBreakpoint],
        maxHeight: isFullscreenPortrait ? 'initial' : '960px',
        height: isFullscreenPortrait ? 'initial' : '80vh',
        overflow: isFullscreenPortrait ? 'auto' : 'hidden',
      }}
      data-test-subj="addActionModal"
    >
      <EuiPanel paddingSize="m" style={!isFullscreenPortrait ? { maxHeight: '100%' } : {}}>
        <EuiFlexGroup direction="column" style={{ height: '100%' }}>
          <EuiFlexItem grow={0}>
            <EuiPageHeader bottomBorder="extended" paddingSize="none">
              <EuiPageHeaderSection
                style={{ width: '100%', padding: euiTheme.size.m, paddingBottom: 0 }}
              >
                <EuiTitle size="s">
                  <h1>
                    {i18n.translate('alertsUIShared.ruleForm.addActionModal.title', {
                      defaultMessage: 'Select connector',
                    })}
                  </h1>
                </EuiTitle>
                <EuiSpacer size="m" />
                <EuiTabs bottomBorder={false} style={{ marginBottom: -1 }}>
                  <EuiTab isSelected>
                    {i18n.translate('alertsUIShared.ruleForm.addActionModal.existingConnectorTab', {
                      defaultMessage: 'Existing',
                    })}
                  </EuiTab>

                  <EuiTab>
                    {i18n.translate(
                      'alertsUIShared.ruleForm.addActionModal.createNewConnectorTab',
                      {
                        defaultMessage: 'Create new',
                      }
                    )}
                  </EuiTab>
                </EuiTabs>
              </EuiPageHeaderSection>
            </EuiPageHeader>
          </EuiFlexItem>
          <EuiFlexItem
            style={{
              overflow: 'hidden',
              marginTop: -euiTheme.size.base /* Offset extra padding for card hover drop shadow */,
            }}
          >
            <ConnectorList onSelectConnector={onSelectConnector} />
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    </EuiModal>
  );
};
