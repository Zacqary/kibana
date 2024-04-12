/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { pick } from 'lodash';
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { hydrateState } from '../../common/constants';

const initialState: {
  actions: unknown[];
} = {
  actions: [],
};

export const ruleActionsSlice = createSlice({
  name: 'actions',
  initialState,
  reducers: {
    addAction: (state, action: PayloadAction<unknown>) => {
      state.actions.push(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(hydrateState, (state, action) => {
      Object.assign(state, pick(action.payload, Object.keys(initialState)));
    });
  },
});

export const { addAction } = ruleActionsSlice.actions;
