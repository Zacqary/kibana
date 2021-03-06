/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { FunctionComponent } from 'react';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n/react';
import { EuiEmptyPrompt, EuiLink, EuiPageContent, EuiButton } from '@elastic/eui';
import { useHistory } from 'react-router-dom';
import { ScopedHistory } from 'kibana/public';
import { reactRouterNavigate } from '../../../../../../../src/plugins/kibana_react/public';
import { useKibana } from '../../../shared_imports';
import { getCreatePath } from '../../services/navigation';

export const EmptyList: FunctionComponent = () => {
  const { services } = useKibana();
  const history = useHistory() as ScopedHistory;

  return (
    <EuiPageContent verticalPosition="center" horizontalPosition="center" color="subdued">
      <EuiEmptyPrompt
        iconType="managementApp"
        data-test-subj="emptyList"
        title={
          <h2 data-test-subj="title">
            {i18n.translate('xpack.ingestPipelines.list.table.emptyPromptTitle', {
              defaultMessage: 'Start by creating a pipeline',
            })}
          </h2>
        }
        body={
          <p>
            <FormattedMessage
              id="xpack.ingestPipelines.list.table.emptyPromptDescription"
              defaultMessage="For example, you might create a pipeline with one processor that removes a field and another processor that renames a field."
            />{' '}
            <EuiLink href={services.documentation.getIngestNodeUrl()} target="_blank" external>
              {i18n.translate('xpack.ingestPipelines.list.table.emptyPromptDocumentionLink', {
                defaultMessage: 'Learn more',
              })}
            </EuiLink>
          </p>
        }
        actions={
          <EuiButton
            data-test-subj="emptyStateCreatePipelineButton"
            {...reactRouterNavigate(history, getCreatePath())}
            iconType="plusInCircle"
            fill
          >
            {i18n.translate('xpack.ingestPipelines.list.table.emptyPrompt.createButtonLabel', {
              defaultMessage: 'Create a pipeline',
            })}
          </EuiButton>
        }
      />
    </EuiPageContent>
  );
};
