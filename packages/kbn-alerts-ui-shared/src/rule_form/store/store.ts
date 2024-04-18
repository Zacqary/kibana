/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { useRef } from 'react';
import { combineReducers, configureStore, type Store } from '@reduxjs/toolkit';
import { RuleCreationValidConsumer } from '@kbn/rule-data-utils';
import { ruleDetailsSlice, ruleDefinitionSlice, initializeAndValidateConsumer } from '../features';
import { metaSlice } from './meta_slice';
import { ruleActionsSlice } from '../features/rule_actions';

export type PreloadedState = { [K in keyof RuleFormRootState]?: Partial<RuleFormRootState[K]> };

export const initializeStore = (
  partialInitialState: PreloadedState,
  authorizedConsumers?: RuleCreationValidConsumer[]
) => {
  // Call combineReducers inside this function to avoid Webpack import order problems
  const rootReducer = combineReducers({
    ruleDefinition: ruleDefinitionSlice.reducer,
    ruleDetails: ruleDetailsSlice.reducer,
    ruleActions: ruleActionsSlice.reducer,
    meta: metaSlice.reducer,
  });
  const preloadedState: RuleFormRootState = rootReducer(undefined, { type: 'INIT' });
  if (partialInitialState.ruleDefinition) {
    preloadedState.ruleDefinition = {
      ...preloadedState.ruleDefinition,
      ...partialInitialState.ruleDefinition,
    };
  }
  if (partialInitialState.ruleDetails) {
    preloadedState.ruleDetails = {
      ...preloadedState.ruleDetails,
      ...partialInitialState.ruleDetails,
    };
  }
  if (partialInitialState.ruleActions) {
    preloadedState.ruleActions = {
      ...preloadedState.ruleActions,
      ...partialInitialState.ruleActions,
    };
  }

  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
  });
  // Dispatch an initial action for reducers to correct the preloadedState
  store.dispatch(initializeAndValidateConsumer(authorizedConsumers));
  return store;
};

export const useInitializeStore = (...args: Parameters<typeof initializeStore>) =>
  useRef(initializeStore(...args)).current;

export interface RuleFormRootState {
  ruleDefinition: ReturnType<typeof ruleDefinitionSlice.reducer>;
  ruleDetails: ReturnType<typeof ruleDetailsSlice.reducer>;
  ruleActions: ReturnType<typeof ruleActionsSlice.reducer>;
  meta: ReturnType<typeof metaSlice.reducer>;
}
export type RuleFormStore = Store;
export type RuleFormDispatch = ReturnType<typeof initializeStore>['dispatch'];

export const selectRuleForSave = ({ meta, ruleDetails, ruleDefinition }: RuleFormRootState) => {
  const processedRuleDefinition = meta.areAdvancedOptionsVisible
    ? ruleDefinition
    : {
        ...ruleDefinition,
        alertDelay: null,
      };
  return {
    ...ruleDetails,
    ...processedRuleDefinition,
    actions: [],
  };
};
