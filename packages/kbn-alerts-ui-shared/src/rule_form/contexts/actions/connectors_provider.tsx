/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { createContext, useContext } from 'react';
import { useLoadConnectorsApi } from '../../apis';
import type { ActionTypeModel } from '../../types';

const ConnectorsContext = createContext<{
  connectors: ActionTypeModel[];
  isLoading: boolean;
  isSuccess: boolean;
}>({
  connectors: [],
  isLoading: true,
  isSuccess: false,
});

export const ConnectorsProvider: React.FC<{}> = ({ children }) => {
  const { connectors, isSuccess, isLoading } = useLoadConnectorsApi();

  return (
    <ConnectorsContext.Provider
      value={{
        connectors,
        isSuccess,
        isLoading,
      }}
    >
      {children}
    </ConnectorsContext.Provider>
  );
};
export const useConnectors = () => useContext(ConnectorsContext);
