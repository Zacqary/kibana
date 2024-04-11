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
import { loadActionTypes } from './load_action_types';

export const useLoadActionTypesApi = () => {
  const { http, toasts } = useKibanaServices();

  const { data, isSuccess, isLoading } = useQuery({
    enabled: true,
    queryKey: ['loadActionTypes'],
    queryFn: async () => {
      const result = await loadActionTypes({ http });
      return result;
    },
    onError: (errorRes: Error) => {
      if (errorRes) {
        toasts.addDanger(
          i18n.translate('alertsUIShared.ruleForm.loadActionTypesError', {
            defaultMessage: 'Unable to load action types: {error}',
            values: { error: errorRes.message },
          })
        );
      }
    },
    refetchOnWindowFocus: false,
  });

  return { actionTypes: data, isSuccess, isLoading };
};
