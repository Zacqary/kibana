/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { MockedKeys } from '@kbn/utility-types-jest';
import { TutorialsRegistry } from './tutorials_registry';
import { coreMock } from '@kbn/core/server/mocks';
import { CoreSetup } from '@kbn/core/server';
import { httpServerMock } from '@kbn/core/server/mocks';

import {
  TutorialProvider,
  TutorialSchema,
  TutorialsCategory,
  ScopedTutorialContextFactory,
} from './lib/tutorials_registry_types';
import { CustomIntegrationsPluginSetup } from '@kbn/custom-integrations-plugin/server';
import { customIntegrationsMock } from '@kbn/custom-integrations-plugin/server/mocks';

const INVALID_TUTORIAL: TutorialSchema = {
  id: 'test',
  category: 'logging' as TutorialsCategory,
  name: '',
  isBeta: false,
  shortDescription: 'short description',
  euiIconType: 'warning',
  longDescription: 'long description with lots of text',
  completionTimeMinutes: 10,
  previewImagePath: 'path',
  onPrem: { instructionSets: [] },
  elasticCloud: { instructionSets: [] },
  onPremElasticCloud: { instructionSets: [] },
  artifacts: {
    exportedFields: { documentationUrl: 'url' },
    dashboards: [],
    application: { path: 'path', label: 'path' },
  },
};
const VALID_TUTORIAL: TutorialSchema = {
  id: 'test',
  category: 'logging' as TutorialsCategory,
  name: 'new tutorial provider',
  moduleName: 'test',
  isBeta: false,
  shortDescription: 'short description',
  euiIconType: 'warning',
  longDescription: 'long description with lots of text',
  completionTimeMinutes: 10,
  previewImagePath: 'path',
  onPrem: { instructionSets: [] },
  elasticCloud: { instructionSets: [] },
  onPremElasticCloud: { instructionSets: [] },
  artifacts: {
    exportedFields: { documentationUrl: 'url' },
    dashboards: [],
    application: { path: 'path', label: 'path' },
  },
};
const invalidTutorialProvider = INVALID_TUTORIAL;
const validTutorialProvider = VALID_TUTORIAL;

describe('TutorialsRegistry', () => {
  let mockCoreSetup: MockedKeys<CoreSetup>;
  let mockInitContext: ReturnType<typeof coreMock.createPluginInitializerContext>;
  let testProvider: TutorialProvider;
  let testScopedTutorialContextFactory: ScopedTutorialContextFactory;
  let mockCustomIntegrationsPluginSetup: jest.Mocked<CustomIntegrationsPluginSetup>;

  beforeEach(() => {
    mockCustomIntegrationsPluginSetup = customIntegrationsMock.createSetup();
  });

  describe('GET /api/kibana/home/tutorials', () => {
    beforeEach(() => {
      mockCoreSetup = coreMock.createSetup();
      mockInitContext = coreMock.createPluginInitializerContext();
    });

    test('has a router that retrieves registered tutorials', () => {
      const mockResponse = httpServerMock.createResponseFactory();
      expect(mockResponse.ok.mock.calls).toMatchInlineSnapshot(`Array []`);
    });
  });

  describe('setup', () => {
    test('exposes proper contract', () => {
      const setup = new TutorialsRegistry(mockInitContext).setup(
        mockCoreSetup,
        mockCustomIntegrationsPluginSetup
      );
      expect(setup).toHaveProperty('registerTutorial');
      expect(setup).toHaveProperty('addScopedTutorialContextFactory');
    });

    test('registerTutorial throws when registering a tutorial with an invalid schema', () => {
      const setup = new TutorialsRegistry(mockInitContext).setup(
        mockCoreSetup,
        mockCustomIntegrationsPluginSetup
      );
      testProvider = ({}) => invalidTutorialProvider;
      expect(() => setup.registerTutorial(testProvider)).toThrowErrorMatchingInlineSnapshot(
        `"Unable to register tutorial spec because its invalid. Error: [name]: is not allowed to be empty"`
      );
    });

    test('registerTutorial registers a tutorial with a valid schema', () => {
      const setup = new TutorialsRegistry(mockInitContext).setup(
        mockCoreSetup,
        mockCustomIntegrationsPluginSetup
      );
      testProvider = ({}) => validTutorialProvider;
      expect(() => setup.registerTutorial(testProvider)).not.toThrowError();
      expect(mockCustomIntegrationsPluginSetup.registerCustomIntegration.mock.calls).toEqual([
        [
          {
            id: 'test',
            title: 'new tutorial provider',
            categories: [],
            uiInternalPath: '/app/home#/tutorial/test',
            description: 'short description',
            icons: [
              {
                src: 'warning',
                type: 'eui',
              },
            ],
            shipper: 'tutorial',
            isBeta: false,
          },
        ],
      ]);
    });

    test('addScopedTutorialContextFactory throws when given a scopedTutorialContextFactory that is not a function', () => {
      const setup = new TutorialsRegistry(mockInitContext).setup(
        mockCoreSetup,
        mockCustomIntegrationsPluginSetup
      );
      const testItem = {} as TutorialProvider;
      expect(() =>
        setup.addScopedTutorialContextFactory(testItem)
      ).toThrowErrorMatchingInlineSnapshot(
        `"Unable to add scoped(request) context factory because you did not provide a function"`
      );
    });

    test('addScopedTutorialContextFactory adds a scopedTutorialContextFactory when given a function', () => {
      const setup = new TutorialsRegistry(mockInitContext).setup(
        mockCoreSetup,
        mockCustomIntegrationsPluginSetup
      );
      testScopedTutorialContextFactory = ({}) => 'string';
      expect(() =>
        setup.addScopedTutorialContextFactory(testScopedTutorialContextFactory)
      ).not.toThrowError();
    });
  });

  describe('start', () => {
    test('exposes proper contract', () => {
      const registry = new TutorialsRegistry(mockInitContext);
      registry.setup(mockCoreSetup, mockCustomIntegrationsPluginSetup);
      const start = registry.start(coreMock.createStart(), mockCustomIntegrationsPluginSetup);
      expect(start).toBeDefined();
    });
  });
});
