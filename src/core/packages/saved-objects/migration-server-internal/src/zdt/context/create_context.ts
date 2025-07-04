/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { getVirtualVersionMap } from '@kbn/core-saved-objects-base-server-internal';
import type { MigrateIndexOptions } from '../migrate_index';
import type { MigratorContext } from './types';

export type CreateContextOps = Omit<MigrateIndexOptions, 'logger'>;

/**
 * Create the context object that will be used for this index migration.
 */
export const createContext = ({
  kibanaVersion,
  types,
  docLinks,
  migrationConfig,
  documentMigrator,
  elasticsearchClient,
  indexPrefix,
  typeRegistry,
  serializer,
  nodeRoles,
  esCapabilities,
}: CreateContextOps): MigratorContext => {
  return {
    migrationConfig,
    documentMigrator,
    kibanaVersion,
    indexPrefix,
    types,
    typeVirtualVersions: getVirtualVersionMap({
      types: types.map((type) => typeRegistry.getType(type)!),
      // we store this Map(type=>modelVersion) in the meta
      // with this flag we default to 10.0.0 for types that do NOT define modelVersions
      useModelVersionsOnly: true,
    }),
    elasticsearchClient,
    typeRegistry,
    serializer,
    maxRetryAttempts: migrationConfig.retryAttempts,
    migrationDocLinks: docLinks.links.kibanaUpgradeSavedObjects,
    deletedTypes: typeRegistry.getLegacyTypes(),
    batchSize: migrationConfig.batchSize,
    discardCorruptObjects: Boolean(migrationConfig.discardCorruptObjects),
    nodeRoles,
    esCapabilities,
  };
};
