/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { EsArchiver } from '@kbn/es-archiver';
import { FtrProviderContext } from './ftr_provider_context';
import { extendEsArchiver } from './kibana_server';

export function EsArchiverProvider({ getService }: FtrProviderContext): EsArchiver {
  const config = getService('config');
  const client = getService('es');
  const log = getService('log');
  const kibanaServer = getService('kibanaServer');
  const retry = getService('retry');

  const esArchiver = new EsArchiver({
    baseDir: config.get('esArchiver.baseDirectory'),
    client,
    log,
    kbnClient: kibanaServer,
  });

  extendEsArchiver({
    esArchiver,
    kibanaServer,
    retry,
    defaults: config.get('uiSettings.defaults'),
  });

  return esArchiver;
}
