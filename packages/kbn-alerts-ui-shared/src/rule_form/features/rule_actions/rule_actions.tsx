/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { i18n } from '@kbn/i18n';
import React, { useState } from 'react';
import { EuiEmptyPrompt, EuiLoadingSpinner, EuiButton } from '@elastic/eui';
import { useActionTypes } from '../../contexts';
import { useRuleFormDispatch, useRuleFormSelector } from '../../hooks';
import { AddActionModal } from './add_action_modal';

export const RuleActions: React.FC = () => {
  const dispatch = useRuleFormDispatch();
  const actions = useRuleFormSelector((state) => state.ruleActions.actions);
  const { isLoading: areActionTypesLoading, isSuccess: haveActionTypesSuccessfullyLoaded } =
    useActionTypes();

  const [isAddActionModalVisible, setIsAddActionModalVisible] = useState(false);

  if (areActionTypesLoading) {
    return (
      <EuiEmptyPrompt
        icon={<EuiLoadingSpinner />}
        title={
          <h4>
            {i18n.translate('alertsUIShared.ruleForm.ruleActions.loadingActions', {
              defaultMessage: 'Loading actions',
            })}
          </h4>
        }
      />
    );
  }

  if (!haveActionTypesSuccessfullyLoaded) {
    return (
      <EuiEmptyPrompt
        iconType="error"
        color="danger"
        title={
          <h4>
            {i18n.translate('alertsUIShared.ruleForm.ruleActions.errorLoadingActions', {
              defaultMessage: 'Error loading actions',
            })}
          </h4>
        }
      />
    );
  }

  return (
    <>
      <EuiButton iconType="push" color="primary" onClick={() => setIsAddActionModalVisible(true)}>
        {i18n.translate('alertsUIShared.ruleForm.ruleActions.addAction', {
          defaultMessage: 'Add action',
        })}
      </EuiButton>
      {isAddActionModalVisible && (
        <AddActionModal onClose={() => setIsAddActionModalVisible(false)} />
      )}
    </>
  );
};
