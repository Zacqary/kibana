/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { once, debounce } from 'lodash';
import type { CoreSetup, Logger } from '@kbn/core/server';
import { ISearchOptions, IEsSearchResponse } from '@kbn/search-types';
import { isRunningResponse } from '../../../../common';
import { CollectedUsage } from './register';

const SAVED_OBJECT_ID = 'search-telemetry';

export interface SearchUsage {
  trackError(): Promise<void>;
  trackSuccess(duration: number): Promise<void>;
}

export function usageProvider(core: CoreSetup): SearchUsage {
  const getRepository = once(async () => {
    const [coreStart] = await core.getStartServices();
    return coreStart.savedObjects.createInternalRepository();
  });

  const collectedUsage: CollectedUsage = {
    successCount: 0,
    errorCount: 0,
    totalDuration: 0,
  };

  // Instead of updating the search count every time a search completes, we update some in-memory
  // counts and only update the saved object every ~5 seconds
  const updateSearchUsage = debounce(
    async () => {
      const repository = await getRepository();
      const { successCount, errorCount, totalDuration } = collectedUsage;
      const counterFields = Object.entries(collectedUsage)
        .map(([fieldName, incrementBy]) => ({ fieldName, incrementBy }))
        // Filter out any zero values because `incrementCounter` will still increment them
        .filter(({ incrementBy }) => incrementBy > 0);

      try {
        await repository.incrementCounter<CollectedUsage>(
          SAVED_OBJECT_ID,
          SAVED_OBJECT_ID,
          counterFields
        );

        // Since search requests may have completed while the saved object was being updated, we minus
        // what was just updated in the saved object rather than resetting the values to 0
        collectedUsage.successCount -= successCount;
        collectedUsage.errorCount -= errorCount;
        collectedUsage.totalDuration -= totalDuration;
      } catch (e) {
        // We didn't reset the counters so we'll retry when the next search request completes
      }
    },
    5000,
    { maxWait: 5000 }
  );

  const trackSuccess = async (duration: number) => {
    collectedUsage.successCount++;
    collectedUsage.totalDuration += duration;
    return await updateSearchUsage();
  };

  const trackError = async () => {
    collectedUsage.errorCount++;
    return await updateSearchUsage();
  };

  return { trackSuccess, trackError };
}

/**
 * Rxjs observer for easily doing `tap(searchUsageObserver(logger, usage))` in an rxjs chain.
 */
export function searchUsageObserver(
  logger: Logger,
  usage?: SearchUsage,
  { isRestore }: ISearchOptions = {}
) {
  return {
    next(response: IEsSearchResponse) {
      if (isRestore || isRunningResponse(response)) return;
      logger.debug(`trackSearchStatus:success, took:${response.rawResponse.took}`);
      void usage?.trackSuccess(response.rawResponse.took);
    },
    error(e: Error) {
      logger.debug(`trackSearchStatus:error, ${e}`);
      void usage?.trackError();
    },
  };
}
