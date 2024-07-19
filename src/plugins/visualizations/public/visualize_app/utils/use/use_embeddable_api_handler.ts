/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import type { OverlayRef } from '@kbn/core-mount-utils-browser';
import { TimefilterContract } from '@kbn/data-plugin/public';
import type { SerializedPanelState } from '@kbn/presentation-containers';
import { useState } from 'react';
import { NavigateToLensContext, SerializedVis } from '../../../../common';
import type { VisualizeOutputState, VisualizeRuntimeState } from '../../../react_embeddable/types';
import type Vis from '../../../vis';

export type OpenInspectorFn = () => OverlayRef | undefined;
export type NavigateToLensFn = (
  timefilter: TimefilterContract
) => Promise<NavigateToLensContext | undefined | null> | undefined;
export type SerializeStateFn = () => SerializedPanelState<VisualizeOutputState>;
export type GetVisFn = () => Vis;
export type UpdateVisFn = (newVis: Partial<SerializedVis>) => void;

export interface EmbeddableApiHandler {
  openInspector: ReturnType<typeof useState<OpenInspectorFn>>;
  navigateToLens: ReturnType<typeof useState<NavigateToLensFn>>;
  serializeState: ReturnType<typeof useState<SerializeStateFn>>;
  snapshotState: ReturnType<typeof useState<() => VisualizeRuntimeState>>;
  getVis: ReturnType<typeof useState<GetVisFn>>;
  updateVis: ReturnType<typeof useState<UpdateVisFn>>;
}

export const useEmbeddableApiHandler = () => {
  const openInspector = useState();
  const navigateToLens = useState();
  const serializeState = useState();
  const snapshotState = useState();
  const getVis = useState();
  const updateVis = useState();

  return {
    openInspector,
    navigateToLens,
    serializeState,
    snapshotState,
    getVis,
    updateVis,
  } as EmbeddableApiHandler;
};
