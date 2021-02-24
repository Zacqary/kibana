/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import uuid from 'uuid';
import Boom from '@hapi/boom';
import { i18n } from '@kbn/i18n';
import { SavedObjectsClientContract, SavedObject } from 'src/core/server';
import { EnrollmentAPIKey, EnrollmentAPIKeySOAttributes } from '../../types';
import { ENROLLMENT_API_KEYS_SAVED_OBJECT_TYPE } from '../../constants';
import { createAPIKey, invalidateAPIKeys } from './security';
import { agentPolicyService } from '../agent_policy';
import { appContextService } from '../app_context';
import { normalizeKuery, escapeSearchQueryPhrase } from '../saved_object';

const uuidRegex = /^\([0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}\)$/;

export async function listEnrollmentApiKeys(
  soClient: SavedObjectsClientContract,
  options: {
    page?: number;
    perPage?: number;
    kuery?: string;
    showInactive?: boolean;
  }
): Promise<{ items: EnrollmentAPIKey[]; total: any; page: any; perPage: any }> {
  const { page = 1, perPage = 20, kuery } = options;

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { saved_objects, total } = await soClient.find<EnrollmentAPIKeySOAttributes>({
    type: ENROLLMENT_API_KEYS_SAVED_OBJECT_TYPE,
    page,
    perPage,
    sortField: 'created_at',
    sortOrder: 'desc',
    filter:
      kuery && kuery !== ''
        ? normalizeKuery(ENROLLMENT_API_KEYS_SAVED_OBJECT_TYPE, kuery)
        : undefined,
  });

  const items = saved_objects.map(savedObjectToEnrollmentApiKey);

  return {
    items,
    total,
    page,
    perPage,
  };
}

export async function getEnrollmentAPIKey(soClient: SavedObjectsClientContract, id: string) {
  const so = await appContextService
    .getEncryptedSavedObjects()
    .getDecryptedAsInternalUser<EnrollmentAPIKeySOAttributes>(
      ENROLLMENT_API_KEYS_SAVED_OBJECT_TYPE,
      id
    );
  return savedObjectToEnrollmentApiKey(so);
}

/**
 * Invalidate an api key and mark it as inactive
 * @param soClient
 * @param id
 */
export async function deleteEnrollmentApiKey(soClient: SavedObjectsClientContract, id: string) {
  const enrollmentApiKey = await getEnrollmentAPIKey(soClient, id);

  await invalidateAPIKeys(soClient, [enrollmentApiKey.api_key_id]);

  await soClient.update(ENROLLMENT_API_KEYS_SAVED_OBJECT_TYPE, id, {
    active: false,
  });
}

export async function deleteEnrollmentApiKeyForAgentPolicyId(
  soClient: SavedObjectsClientContract,
  agentPolicyId: string
) {
  let hasMore = true;
  let page = 1;
  while (hasMore) {
    const { items } = await listEnrollmentApiKeys(soClient, {
      page: page++,
      perPage: 100,
      kuery: `${ENROLLMENT_API_KEYS_SAVED_OBJECT_TYPE}.policy_id:${agentPolicyId}`,
    });

    if (items.length === 0) {
      hasMore = false;
    }

    for (const apiKey of items) {
      await deleteEnrollmentApiKey(soClient, apiKey.id);
    }
  }
}

export async function generateEnrollmentAPIKey(
  soClient: SavedObjectsClientContract,
  data: {
    name?: string;
    expiration?: string;
    agentPolicyId?: string;
  }
) {
  const id = uuid.v4();
  const { name: providedKeyName } = data;
  if (data.agentPolicyId) {
    await validateAgentPolicyId(soClient, data.agentPolicyId);
  }
  const agentPolicyId =
    data.agentPolicyId ?? (await agentPolicyService.getDefaultAgentPolicyId(soClient));

  if (providedKeyName) {
    let hasMore = true;
    let page = 1;
    let keys: EnrollmentAPIKey[] = [];
    while (hasMore) {
      const { items } = await listEnrollmentApiKeys(soClient, {
        page: page++,
        perPage: 100,
        kuery: `${ENROLLMENT_API_KEYS_SAVED_OBJECT_TYPE}.policy_id:${agentPolicyId} and ${ENROLLMENT_API_KEYS_SAVED_OBJECT_TYPE}.name:${providedKeyName.replace(
          / /g,
          '*'
        )}*`,
      });
      if (items.length === 0) {
        hasMore = false;
      } else {
        keys = keys.concat(items);
      }
    }

    if (
      keys.length > 0 &&
      keys.some((k: EnrollmentAPIKey) =>
        // Prevent false positives when the providedKeyName is a prefix of a token name that already exists
        // After removing the providedKeyName and trimming whitespace, the only string left should be a uuid in parens.
        k.name?.replace(providedKeyName, '').trim().match(uuidRegex)
      )
    ) {
      throw new Error(
        i18n.translate('xpack.fleet.serverError.enrollmentKeyDuplicate', {
          defaultMessage:
            'An enrollment key named {providedKeyName} already exists for agent policy {agentPolicyId}',
          values: {
            providedKeyName,
            agentPolicyId,
          },
        })
      );
    }
  }

  const name = providedKeyName ? `${providedKeyName} (${id})` : id;

  const key = await createAPIKey(soClient, name, {
    // Useless role to avoid to have the privilege of the user that created the key
    'fleet-apikey-enroll': {
      cluster: [],
      applications: [
        {
          application: '.fleet',
          privileges: ['no-privileges'],
          resources: ['*'],
        },
      ],
    },
  });

  if (!key) {
    throw new Error(
      i18n.translate('xpack.fleet.serverError.unableToCreateEnrollmentKey', {
        defaultMessage: 'Unable to create an enrollment api key',
      })
    );
  }

  const apiKey = Buffer.from(`${key.id}:${key.api_key}`).toString('base64');

  const so = await soClient.create<EnrollmentAPIKeySOAttributes>(
    ENROLLMENT_API_KEYS_SAVED_OBJECT_TYPE,
    {
      active: true,
      api_key_id: key.id,
      api_key: apiKey,
      name,
      policy_id: agentPolicyId,
      created_at: new Date().toISOString(),
    }
  );

  return getEnrollmentAPIKey(soClient, so.id);
}

async function validateAgentPolicyId(soClient: SavedObjectsClientContract, agentPolicyId: string) {
  try {
    await agentPolicyService.get(soClient, agentPolicyId);
  } catch (e) {
    if (e.isBoom && e.output.statusCode === 404) {
      throw Boom.badRequest(
        i18n.translate('xpack.fleet.serverError.agentPolicyDoesNotExist', {
          defaultMessage: 'Agent policy {agentPolicyId} does not exist',
          values: { agentPolicyId },
        })
      );
    }
    throw e;
  }
}

export async function getEnrollmentAPIKeyById(
  soClient: SavedObjectsClientContract,
  apiKeyId: string
) {
  const [enrollmentAPIKey] = (
    await soClient.find<EnrollmentAPIKeySOAttributes>({
      type: ENROLLMENT_API_KEYS_SAVED_OBJECT_TYPE,
      searchFields: ['api_key_id'],
      search: escapeSearchQueryPhrase(apiKeyId),
    })
  ).saved_objects.map(savedObjectToEnrollmentApiKey);

  if (enrollmentAPIKey?.api_key_id !== apiKeyId) {
    throw new Error(
      i18n.translate('xpack.fleet.serverError.returnedIncorrectKey', {
        defaultMessage: 'find enrollmentKeyById returned an incorrect key',
      })
    );
  }

  return enrollmentAPIKey;
}

function savedObjectToEnrollmentApiKey({
  error,
  attributes,
  id,
}: SavedObject<EnrollmentAPIKeySOAttributes>): EnrollmentAPIKey {
  if (error) {
    throw new Error(error.message);
  }

  return {
    id,
    ...attributes,
  };
}
