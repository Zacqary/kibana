/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createMemoryHistory } from 'history';
import type { FC, PropsWithChildren } from 'react';
import React from 'react';
import { Router } from '@kbn/shared-ux-router';
import { mountHook } from '@kbn/test-jest-helpers';
import { CoreScopedHistory } from '@kbn/core/public';
import { useMetricsTime } from './use_metrics_time';

describe('useMetricsTime hook', () => {
  describe('timeRange state', () => {
    it('has a default value', () => {
      const { getLastHookValue } = mountHook(
        () => useMetricsTime().timeRange,
        createProviderWrapper()
      );
      const hookValue = getLastHookValue();
      expect(hookValue).toHaveProperty('from');
      expect(hookValue).toHaveProperty('to');
      expect(hookValue.interval).toBe('>=1m');
    });

    it('can be updated', () => {
      const { act, getLastHookValue } = mountHook(() => useMetricsTime(), createProviderWrapper());

      const timeRange = {
        from: 'now-15m',
        to: 'now',
        interval: '>=2m',
      };

      act(({ setTimeRange }) => {
        setTimeRange(timeRange);
      });

      expect(getLastHookValue().timeRange).toEqual(timeRange);
    });
  });

  describe('AutoReloading state', () => {
    it('has a default value', () => {
      const { getLastHookValue } = mountHook(
        () => useMetricsTime().isAutoReloading,
        createProviderWrapper()
      );
      expect(getLastHookValue()).toBe(false);
    });

    it('can be updated', () => {
      const { act, getLastHookValue } = mountHook(() => useMetricsTime(), createProviderWrapper());

      act(({ setAutoReload }) => {
        setAutoReload(true);
      });

      expect(getLastHookValue().isAutoReloading).toBe(true);
    });
  });
});

const createProviderWrapper = () => {
  const INITIAL_URL = '/test-basepath/s/test-space/app/metrics';
  const history = createMemoryHistory();

  history.push(INITIAL_URL);
  const scopedHistory = new CoreScopedHistory(history, INITIAL_URL);

  const ProviderWrapper: FC<PropsWithChildren<unknown>> = ({ children }) => {
    return <Router history={scopedHistory}>{children}</Router>;
  };

  return ProviderWrapper;
};
