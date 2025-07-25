/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type http from 'http';
import type https from 'https';
import getPort from 'get-port';
import type { Agent as SuperTestAgent } from 'supertest';
import expect from '@kbn/expect';
import { URL, format as formatUrl } from 'url';
import {
  getWebhookServer,
  getHttpsWebhookServer,
} from '@kbn/actions-simulators-plugin/server/plugin';
import type { FtrProviderContext } from '../../../../../common/ftr_provider_context';
import { createTlsWebhookServer } from '../../../../../common/lib/get_tls_webhook_servers';

export default function webhookTest({ getService }: FtrProviderContext) {
  const supertest = getService('supertest');

  async function getPortOfConnector(connectorId: string): Promise<string> {
    const response = await supertest.get(`/api/actions/connectors`).expect(200);
    const connector = response.body.find((conn: { id: string }) => conn.id === connectorId);
    if (connector === undefined) {
      throw new Error(`unable to find connector with id ${connectorId}`);
    }

    // server URL is the connector name
    const url = connector.name;
    const parsedUrl = new URL(url);
    return parsedUrl.port;
  }

  describe('webhook connector', () => {
    describe('with http endpoint', () => {
      let webhookSimulatorURL: string = '';
      let webhookServer: http.Server;
      before(async () => {
        webhookServer = await getWebhookServer();
        const availablePort = await getPort({ port: 9000 });
        webhookServer.listen(availablePort);
        webhookSimulatorURL = `http://localhost:${availablePort}`;
      });

      it('webhook can be executed without username and password', async () => {
        const webhookConnectorId = await createWebhookConnector(supertest, webhookSimulatorURL);
        const { body: result } = await supertest
          .post(`/api/actions/connector/${webhookConnectorId}/_execute`)
          .set('kbn-xsrf', 'test')
          .send({
            params: {
              body: 'success',
            },
          })
          .expect(200);

        expect(result.status).to.eql('ok');
      });

      after(() => {
        webhookServer.close();
      });
    });

    describe('with https endpoint and rejectUnauthorized=false', () => {
      let webhookSimulatorURL: string = '';
      let webhookServer: https.Server;

      before(async () => {
        webhookServer = await getHttpsWebhookServer();
        const availablePort = await getPort({ port: getPort.makeRange(9000, 9100) });
        webhookServer.listen(availablePort);
        webhookSimulatorURL = `https://localhost:${availablePort}`;
      });

      it('should support the POST method against webhook target', async () => {
        const webhookConnectorId = await createWebhookConnector(supertest, webhookSimulatorURL, {
          method: 'post',
        });
        const { body: result } = await supertest
          .post(`/api/actions/connector/${webhookConnectorId}/_execute`)
          .set('kbn-xsrf', 'test')
          .send({
            params: {
              body: 'success_post_method',
            },
          })
          .expect(200);

        expect(result.status).to.eql('ok');
      });

      after(() => {
        webhookServer.close();
      });
    });

    describe('ssl customization', () => {
      it('should handle the customized rejectUnauthorized: false', async () => {
        const connectorId = 'custom.ssl.rejectUnauthorizedFalse';
        const port = await getPortOfConnector(connectorId);
        const server = await createTlsWebhookServer(port);
        const { status, body } = await supertest
          .post(`/api/actions/connector/custom.ssl.rejectUnauthorizedFalse/_execute`)
          .set('kbn-xsrf', 'test')
          .send({
            params: {
              body: 'foo',
            },
          });
        expect(status).to.eql(200);
        server.close();

        expect(body.status).to.eql('ok');
      });

      it('should handle the customized rejectUnauthorized: true', async () => {
        const connectorId = 'custom.ssl.rejectUnauthorizedTrue';
        const port = await getPortOfConnector(connectorId);
        const server = await createTlsWebhookServer(port);
        const { status, body } = await supertest
          .post(`/api/actions/connector/custom.ssl.rejectUnauthorizedTrue/_execute`)
          .set('kbn-xsrf', 'test')
          .send({
            params: {
              body: 'foo',
            },
          });
        expect(status).to.eql(200);
        server.close();

        expect(body.status).to.eql('error');
        expect(body.service_message.indexOf('certificate')).to.be.greaterThan(0);
      });

      it('should handle the customized ca file', async () => {
        const connectorId = 'custom.ssl.caFile';
        const port = await getPortOfConnector(connectorId);
        const server = await createTlsWebhookServer(port);
        const { status, body } = await supertest
          .post(`/api/actions/connector/custom.ssl.caFile/_execute`)
          .set('kbn-xsrf', 'test')
          .send({
            params: {
              body: 'foo',
            },
          });
        expect(status).to.eql(200);
        server.close();

        expect(body.status).to.eql('ok');
      });
    });
  });
}

export async function createWebhookConnector(
  supertest: SuperTestAgent,
  webhookSimulatorURL: string,
  config: Record<string, string | Record<string, string>> = {}
): Promise<string> {
  const url = formatUrl(new URL(webhookSimulatorURL), { auth: false });
  const composedConfig = {
    headers: {
      'Content-Type': 'text/plain',
    },
    ...config,
    url,
  };

  const { body: createdConnector } = await supertest
    .post('/api/actions/connector')
    .set('kbn-xsrf', 'test')
    .send({
      name: 'A generic Webhook connector',
      connector_type_id: '.webhook',
      secrets: {},
      config: composedConfig,
    })
    .expect(200);

  return createdConnector.id;
}
