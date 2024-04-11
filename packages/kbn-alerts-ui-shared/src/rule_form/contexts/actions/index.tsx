/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React from 'react';
import { ActionTypeModel } from '../../types';
import { ActionTypesProvider } from './action_types_provider';
import { ConnectorsProvider } from './connectors_provider';

export const ActionContextsProvider: React.FC<{ registeredActionTypes: ActionTypeModel[] }> = ({
  children,
  registeredActionTypes,
}) => {
  return (
    <ActionTypesProvider registeredActionTypes={registeredActionTypes}>
      <ConnectorsProvider>{children}</ConnectorsProvider>
    </ActionTypesProvider>
  );
};
export { useActionTypes } from './action_types_provider';
export { useConnectors } from './connectors_provider';
