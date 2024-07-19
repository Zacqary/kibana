/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
import { Reference } from '@kbn/content-management-utils';
import { DATA_VIEW_SAVED_OBJECT_TYPE } from '@kbn/data-views-plugin/common';
import { i18n } from '@kbn/i18n';
import { decode } from '@kbn/rison';
import { parse } from 'query-string';
import { useMemo } from 'react';
import { STATE_STORAGE_KEY } from '../../../../common/constants';
import { VisualizeRuntimeState, VisualizeSerializedState } from '../../../react_embeddable/types';
import { getTypes } from '../../../services';
import { VisualizeServices } from '../../types';

const INDEX_REF_NAME = 'kibanaSavedObjectMeta.searchSourceJSON.index';

export const useInitialVisState: (opts: {
  services: VisualizeServices;
  visualizationIdFromUrl?: string;
}) => [VisualizeSerializedState, Reference[]] = ({ visualizationIdFromUrl, services }) =>
  useMemo(() => {
    const { history } = services;

    const searchParams = history.location.search ? parse(history.location.search) : {};
    const appState =
      typeof searchParams[STATE_STORAGE_KEY] === 'string'
        ? decode(searchParams[STATE_STORAGE_KEY])
        : {};
    const initialStateFromURL = appState as unknown as VisualizeRuntimeState;

    if (history.location.pathname === '/create') {
      const visType = getTypes()
        .all()
        .find(({ name }) => name === searchParams.type);

      if (!visType) {
        throw new Error(
          i18n.translate('visualizations.createVisualization.noVisTypeErrorMessage', {
            defaultMessage: 'You must provide a valid visualization type',
          })
        );
      }

      const shouldHaveIndex = visType.requiresSearch && visType.options.showIndexSelection;
      const hasIndex = searchParams.indexPattern || searchParams.savedSearchId;

      if (shouldHaveIndex && !hasIndex) {
        throw new Error(
          i18n.translate(
            'visualizations.createVisualization.noIndexPatternOrSavedSearchIdErrorMessage',
            {
              defaultMessage: 'You must provide either an indexPattern or a savedSearchId',
            }
          )
        );
      }

      const references: Reference[] = [];

      if (searchParams.savedSearchId) {
        references.push({
          name: 'search_0',
          type: 'search',
          id: String(searchParams.savedSearchId),
        });
      }

      if (searchParams.indexPattern) {
        references.push({
          name: INDEX_REF_NAME,
          id: String(searchParams.indexPattern),
          type: DATA_VIEW_SAVED_OBJECT_TYPE,
        });
      }

      return [
        {
          title: initialStateFromURL?.title ?? '',
          description: initialStateFromURL?.description ?? '',
          savedVis: {
            title: '',
            description: '',
            type: String(searchParams.type),
            data: {
              aggs: [],
              searchSource: {
                filter: [],
                query: { language: 'kuery', query: '' },
                ...(searchParams.indexPattern ? { indexRefName: INDEX_REF_NAME } : {}),
              },
            },
            params: {},
            ...(appState ? appState.serializedVis : {}),
          },
        } as VisualizeSerializedState,
        references,
      ];
    } else {
      return [
        {
          savedObjectId: visualizationIdFromUrl,
        } as VisualizeSerializedState,
        [],
      ];
    }
  }, [visualizationIdFromUrl, services]);
