/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { UsageCollectionSetup } from '@kbn/usage-collection-plugin/server';
import { fetchProvider } from './fetch';

export interface CollectedUsage {
  successCount: number;
  errorCount: number;
  totalDuration: number;
}

export interface ReportedUsage {
  successCount: number;
  errorCount: number;
  averageDuration: number | null;
}

export function registerUsageCollector(
  usageCollection: UsageCollectionSetup,
  getIndexForType: (type: string) => Promise<string>
) {
  try {
    const collector = usageCollection.makeUsageCollector<ReportedUsage>({
      type: 'search',
      isReady: () => true,
      fetch: fetchProvider(getIndexForType),
      schema: {
        successCount: { type: 'long' },
        errorCount: { type: 'long' },
        averageDuration: { type: 'float' },
      },
    });
    usageCollection.registerCollector(collector);
  } catch (err) {
    return; // kibana plugin is not enabled (test environment)
  }
}
