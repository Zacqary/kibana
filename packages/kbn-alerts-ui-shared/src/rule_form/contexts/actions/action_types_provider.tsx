/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useLoadActionTypesApi } from '../../apis';
import type { ActionTypeModel } from '../../types';

const ActionTypesContext = createContext<{
  actionTypes: Array<ActionTypeModel & { name: string }>;
  isLoading: boolean;
  isSuccess: boolean;
}>({
  actionTypes: [],
  isLoading: true,
  isSuccess: false,
});

export const ActionTypesProvider: React.FC<{ registeredActionTypes: ActionTypeModel[] }> = ({
  children,
  registeredActionTypes,
}) => {
  const { actionTypes: loadedActionTypes, isSuccess, isLoading } = useLoadActionTypesApi();
  const availableActionTypes = useMemo(() => {
    if (isLoading || !isSuccess || !loadedActionTypes) return [];

    const loadedActionTypesMap = new Map<string, ActionType>(
      loadedActionTypes.map((actionType) => [actionType.id, actionType])
    );

    return registeredActionTypes
      .filter((registeredActionType) => {
        if (registeredActionType.hideInUi) return false;
        const matchingActionType = loadedActionTypesMap.get(registeredActionType.id);
        if (!matchingActionType) return false;
        return (
          matchingActionType.enabled &&
          matchingActionType.enabledInConfig &&
          matchingActionType.enabledInLicense
        );
      })
      .map((actionType) => ({
        ...actionType,
        name: loadedActionTypesMap.get(actionType.id)!.name,
      }));
  }, [registeredActionTypes, loadedActionTypes, isSuccess, isLoading]);

  console.log('availableActionTypes:', availableActionTypes);

  return (
    <ActionTypesContext.Provider
      value={{
        actionTypes: availableActionTypes,
        isSuccess,
        isLoading,
      }}
    >
      {children}
    </ActionTypesContext.Provider>
  );
};
export const useActionTypes = () => useContext(ActionTypesContext);
