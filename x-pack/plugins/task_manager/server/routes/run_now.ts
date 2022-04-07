/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { IRouter, IKibanaResponse, ElasticsearchClient } from 'kibana/server';
import { pick } from 'lodash';
import { schema } from '@kbn/config-schema';
import { logger } from 'elastic-apm-node';
import { RunNowResult, TaskScheduling } from '../task_scheduling';
import { TaskStatus } from '../task';
import { parseIntervalAsMillisecond } from '../lib/intervals';

export interface RunNowRouteParams {
  router: IRouter;
  taskScheduling: TaskScheduling;
  esClient: ElasticsearchClient;
  index: string;
}

const bodySchema = schema.any();

export function runNowRoute(params: RunNowRouteParams) {
  const { router, taskScheduling } = params;

  router.post(
    {
      path: '/api/task_manager/_run_now',
      validate: {
        body: bodySchema,
      },
    },
    async function (context, req, res): Promise<IKibanaResponse> {
      const scheduledAt = Date.now();
      taskScheduling
        .ephemeralRunNow(pick(req.body, ['taskType', 'params', 'state', 'scope']))
        .then(async (result) => {
          await markTaskFinished(params.esClient, params.index, result, req.body, scheduledAt);
        })
        .catch((e) => logger.error('Error running task', req.body.id, e));

      return res.noContent();
    }
  );
}

async function markTaskFinished(
  esClient: ElasticsearchClient,
  index: string,
  result: RunNowResult,
  task: { id: string; schedule?: { interval: string } },
  scheduledAt: number
) {
  const { id, schedule } = task;
  if (schedule) {
    const intervalAsMS = parseIntervalAsMillisecond(schedule.interval);
    const runAt = new Date(scheduledAt + intervalAsMS).toISOString();
    try {
      await esClient.update({
        index,
        id,
        doc: {
          task: {
            state: JSON.stringify(result.state),
            status: TaskStatus.Idle,
            scheduledAt: null,
            retryAt: null,
            startedAt: null,
            runAt,
            attempts: 0,
          },
        },
      });
    } catch (e) {
      logger.error(`FAILED TO RESCHEDULE ${id}: ${e}`);
    }
  } else {
    await esClient.delete({
      index,
      id,
    });
  }
}
