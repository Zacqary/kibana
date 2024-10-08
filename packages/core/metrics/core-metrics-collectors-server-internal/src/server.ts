/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ResponseObject, Server as HapiServer } from '@hapi/hapi';
import type { OpsServerMetrics, MetricsCollector } from '@kbn/core-metrics-server';

interface ServerResponseTime {
  count: number;
  total: number;
  max: number;
}

export class ServerMetricsCollector implements MetricsCollector<OpsServerMetrics> {
  private requests: OpsServerMetrics['requests'] = {
    disconnects: 0,
    total: 0,
    statusCodes: {},
  };
  private responseTimes: ServerResponseTime = {
    count: 0,
    total: 0,
    max: 0,
  };

  constructor(private readonly server: HapiServer) {
    this.server.ext('onRequest', (request, h) => {
      this.requests.total++;
      request.events.once('disconnect', () => {
        this.requests.disconnects++;
      });
      return h.continue;
    });
    this.server.events.on('response', (request) => {
      const statusCode = (request.response as ResponseObject)?.statusCode;
      if (statusCode) {
        if (!this.requests.statusCodes[statusCode]) {
          this.requests.statusCodes[statusCode] = 0;
        }
        this.requests.statusCodes[statusCode]++;
      }

      const duration = Date.now() - request.info.received;
      this.responseTimes.count++;
      this.responseTimes.total += duration;
      this.responseTimes.max = Math.max(this.responseTimes.max, duration);
    });
  }

  public async collect(): Promise<OpsServerMetrics> {
    const connections = await new Promise<number>((resolve) => {
      this.server.listener.getConnections((_, count) => {
        resolve(count);
      });
    });

    return {
      requests: this.requests,
      response_times: {
        avg_in_millis: this.responseTimes.total / Math.max(this.responseTimes.count, 1),
        max_in_millis: this.responseTimes.max,
      },
      concurrent_connections: connections,
    };
  }

  public reset() {
    this.requests = {
      disconnects: 0,
      total: 0,
      statusCodes: {},
    };
    this.responseTimes = {
      count: 0,
      total: 0,
      max: 0,
    };
  }
}
