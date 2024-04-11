/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { i18n } from '@kbn/i18n';
import { useQuery } from '@tanstack/react-query';
import { useKibanaServices } from '../../contexts';
import { loadConnectors } from './load_connectors';

export const useLoadConnectorsApi = () => {
  const { http, toasts } = useKibanaServices();

  const { data, isSuccess, isLoading } = useQuery({
    enabled: true,
    queryKey: ['loadConnectors'],
    queryFn: async () => {
      const result = await loadConnectors({ http });
      return result;
    },
    onError: (errorRes: Error) => {
      if (errorRes) {
        toasts.addDanger(
          i18n.translate('alertsUIShared.ruleForm.loadConnectorsError', {
            defaultMessage: 'Unable to load connectors: {error}',
            values: { error: errorRes.message },
          })
        );
      }
    },
    refetchOnWindowFocus: false,
  });

  return { connectors: data, isSuccess, isLoading };
};
