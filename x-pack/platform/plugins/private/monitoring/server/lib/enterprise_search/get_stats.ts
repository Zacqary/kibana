/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import moment from 'moment';
import { TimeRange } from '../../../common/http_api/shared';
import { ElasticsearchResponse } from '../../../common/types/es';
import { Globals } from '../../static_globals';
import { LegacyRequest } from '../../types';
import { getIndexPatterns } from '../../../common/get_index_patterns';
import { createEnterpriseSearchQuery } from './create_enterprise_search_query';
import {
  entSearchAggFilterPath,
  entSearchAggResponseHandler,
  entSearchUuidsAgg,
} from './_enterprise_search_stats';

export async function getStats(
  req: LegacyRequest<unknown, unknown, { ccs?: string; timeRange: TimeRange }>,
  clusterUuid: string
) {
  const config = req.server.config;
  const start = moment.utc(req.payload.timeRange.min).valueOf();
  const end = moment.utc(req.payload.timeRange.max).valueOf();
  const maxBucketSize = config.ui.max_bucket_size;

  const indexPattern = getIndexPatterns({
    moduleType: 'enterprisesearch',
    config: Globals.app.config,
    ccs: req.payload.ccs,
  });

  const params = {
    index: indexPattern,
    filter_path: entSearchAggFilterPath,
    size: 0,
    ignore_unavailable: true,
    query: createEnterpriseSearchQuery({
      start,
      end,
      uuid: clusterUuid,
    }),
    aggs: entSearchUuidsAgg(maxBucketSize),
  };

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  const response: ElasticsearchResponse = await callWithRequest(req, 'search', params);

  return entSearchAggResponseHandler(response);
}
