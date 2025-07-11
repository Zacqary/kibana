/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { v4 as uuidv4 } from 'uuid';
import { type EuiThemeComputed, euiPaletteColorBlind } from '@elastic/eui';
import type { LayerDescriptor } from '@kbn/maps-plugin/common';
import { LAYER_TYPE, SCALING_TYPES, SOURCE_TYPES } from '@kbn/maps-plugin/common';
import type {
  IndexPatternMapping,
  LayerMapping,
  LayerMappingCollection,
  LayerMappingDetails,
} from './types';
import * as i18n from './translations';

// Update field mappings to modify what fields will be returned to map tooltip
const sourceFieldMappings: Record<string, string> = {
  'host.name': i18n.HOST,
  'source.ip': i18n.SOURCE_IP,
  'source.domain': i18n.SOURCE_DOMAIN,
  'source.geo.country_iso_code': i18n.LOCATION,
  'source.as.organization.name': i18n.ASN,
};
const destinationFieldMappings: Record<string, string> = {
  'host.name': i18n.HOST,
  'destination.ip': i18n.DESTINATION_IP,
  'destination.domain': i18n.DESTINATION_DOMAIN,
  'destination.geo.country_iso_code': i18n.LOCATION,
  'destination.as.organization.name': i18n.ASN,
};
const clientFieldMappings: Record<string, string> = {
  'host.name': i18n.HOST,
  'client.ip': i18n.CLIENT_IP,
  'client.domain': i18n.CLIENT_DOMAIN,
  'client.geo.country_iso_code': i18n.LOCATION,
  'client.as.organization.name': i18n.ASN,
};
const serverFieldMappings: Record<string, string> = {
  'host.name': i18n.HOST,
  'server.ip': i18n.SERVER_IP,
  'server.domain': i18n.SERVER_DOMAIN,
  'server.geo.country_iso_code': i18n.LOCATION,
  'server.as.organization.name': i18n.ASN,
};

// Mapping of field -> display name for use within map tooltip
export const sourceDestinationFieldMappings: Record<string, string> = {
  ...sourceFieldMappings,
  ...destinationFieldMappings,
  ...clientFieldMappings,
  ...serverFieldMappings,
};

// Field names of LineLayer props returned from Maps API
export const SUM_OF_SOURCE_BYTES = 'sum_of_source.bytes';
export const SUM_OF_DESTINATION_BYTES = 'sum_of_destination.bytes';
export const SUM_OF_CLIENT_BYTES = 'sum_of_client.bytes';
export const SUM_OF_SERVER_BYTES = 'sum_of_server.bytes';

const APM_LAYER_FIELD_MAPPING = {
  source: {
    metricField: 'client.bytes',
    geoField: 'client.geo.location',
    tooltipProperties: Object.keys(clientFieldMappings),
    label: i18n.CLIENT_LAYER,
  },
  destination: {
    metricField: 'server.bytes',
    geoField: 'server.geo.location',
    tooltipProperties: Object.keys(serverFieldMappings),
    label: i18n.SERVER_LAYER,
  },
};

// Mapping to fields for creating specific layers for a given index pattern
// e.g. The apm-* index pattern needs layers for client/server instead of source/destination
export const lmc: LayerMappingCollection = {
  default: {
    source: {
      metricField: 'source.bytes',
      geoField: 'source.geo.location',
      tooltipProperties: Object.keys(sourceFieldMappings),
      label: i18n.SOURCE_LAYER,
    },
    destination: {
      metricField: 'destination.bytes',
      geoField: 'destination.geo.location',
      tooltipProperties: Object.keys(destinationFieldMappings),
      label: i18n.DESTINATION_LAYER,
    },
  },
  'apm-*': APM_LAYER_FIELD_MAPPING,
  'traces-apm*,logs-apm*,metrics-apm*,apm-*': APM_LAYER_FIELD_MAPPING,
};

export const getRequiredMapsFields = (title: string): string[] => {
  const fieldMappings = lmc[title] ?? lmc.default;
  return [
    fieldMappings.source.metricField,
    fieldMappings.source.geoField,
    fieldMappings.destination.metricField,
    fieldMappings.destination.geoField,
  ];
};

export interface LayerProviderDependencies {
  euiTheme: EuiThemeComputed;
}

/**
 * Returns `Source/Destination Point-to-point` Map LayerList configuration, with a source,
 * destination, and line layer for each of the provided indexPatterns
 *
 * @param dependencies dependencies, such as theme, necessary to configure layers
 * @param indexPatternIds array of indexPatterns' title and id
 */
export const getLayerList = (
  dependencies: LayerProviderDependencies,
  indexPatternIds: IndexPatternMapping[]
) => {
  return [
    ...indexPatternIds.reduce((acc: object[], { title, id }) => {
      const layerGroupDescriptor = {
        id: uuidv4(),
        label: title,
        sourceDescriptor: null,
        type: LAYER_TYPE.LAYER_GROUP,
        visible: true,
      };
      return [
        ...acc,
        getLineLayer(title, id, layerGroupDescriptor.id, lmc[title] ?? lmc.default),
        getDestinationLayer(
          dependencies,
          title,
          id,
          layerGroupDescriptor.id,
          lmc[title]?.destination ?? lmc.default.destination
        ),
        getSourceLayer(
          dependencies,
          title,
          id,
          layerGroupDescriptor.id,
          lmc[title]?.source ?? lmc.default.source
        ),
        layerGroupDescriptor,
      ];
    }, []),
  ] as LayerDescriptor[];
};

/**
 * Returns Document Data Source layer configuration ('source.geo.location') for the given
 * indexPattern title/id
 *
 * @param indexPatternTitle used as layer name in LayerToC UI: "${indexPatternTitle} | Source point"
 * @param indexPatternId used as layer's indexPattern to query for data
 * @param parentId
 * @param layerDetails layer-specific field details
 */
export const getSourceLayer = (
  dependencies: LayerProviderDependencies,
  indexPatternTitle: string,
  indexPatternId: string,
  parentId: string,
  layerDetails: LayerMappingDetails
) => {
  return {
    sourceDescriptor: {
      id: uuidv4(),
      type: 'ES_SEARCH',
      applyGlobalQuery: true,
      geoField: layerDetails.geoField,
      filterByMapBounds: false,
      tooltipProperties: layerDetails.tooltipProperties,
      useTopHits: false,
      topHitsTimeField: '@timestamp',
      topHitsSize: 1,
      indexPatternId,
    },
    style: {
      type: 'VECTOR',
      properties: {
        fillColor: {
          type: 'STATIC',
          options: {
            color: dependencies.euiTheme.colors.vis.euiColorVis4,
          },
        },
        lineColor: {
          type: 'STATIC',
          options: { color: dependencies.euiTheme.colors.vis.euiColorVisBase0 },
        },
        lineWidth: { type: 'STATIC', options: { size: 2 } },
        iconSize: { type: 'STATIC', options: { size: 8 } },
        iconOrientation: {
          type: 'STATIC',
          options: { orientation: 0 },
        },
        symbolizeAs: {
          options: { value: 'icon' },
        },
        icon: {
          type: 'STATIC',
          options: { value: 'home' },
        },
      },
    },
    id: uuidv4(),
    parent: parentId,
    label: `${indexPatternTitle} | ${layerDetails.label}`,
    minZoom: 0,
    maxZoom: 24,
    alpha: 1,
    visible: true,
    type: LAYER_TYPE.GEOJSON_VECTOR,
    query: { query: '', language: 'kuery' },
    joins: [],
  };
};

/**
 * Returns Document Data Source layer configuration ('destination.geo.location') for the given
 * indexPattern title/id
 *
 * @param indexPatternTitle used as layer name in LayerToC UI: "${indexPatternTitle} | Destination point"
 * @param indexPatternId used as layer's indexPattern to query for data
 * @param parentId used as layer's indexPattern to query for data
 * @param layerDetails layer-specific field details
 *
 */
export const getDestinationLayer = (
  dependencies: LayerProviderDependencies,
  indexPatternTitle: string,
  indexPatternId: string,
  parentId: string,
  layerDetails: LayerMappingDetails
) => {
  return {
    sourceDescriptor: {
      id: uuidv4(),
      type: 'ES_SEARCH',
      scalingType: SCALING_TYPES.LIMIT,
      applyGlobalQuery: true,
      geoField: layerDetails.geoField,
      filterByMapBounds: true,
      tooltipProperties: layerDetails.tooltipProperties,
      useTopHits: false,
      topHitsTimeField: '@timestamp',
      topHitsSize: 1,
      indexPatternId,
    },
    style: {
      type: 'VECTOR',
      properties: {
        fillColor: {
          type: 'STATIC',
          options: { color: dependencies.euiTheme.colors.vis.euiColorVis2 },
        },
        lineColor: {
          type: 'STATIC',
          options: { color: dependencies.euiTheme.colors.vis.euiColorVisBase0 },
        },
        lineWidth: { type: 'STATIC', options: { size: 2 } },
        iconSize: { type: 'STATIC', options: { size: 8 } },
        iconOrientation: {
          type: 'STATIC',
          options: { orientation: 0 },
        },
        symbolizeAs: {
          options: { value: 'icon' },
        },
        icon: {
          type: 'STATIC',
          options: { value: 'marker' },
        },
      },
    },
    id: uuidv4(),
    parent: parentId,
    label: `${indexPatternTitle} | ${layerDetails.label}`,
    minZoom: 0,
    maxZoom: 24,
    alpha: 1,
    visible: true,
    type: LAYER_TYPE.GEOJSON_VECTOR,
    query: { query: '', language: 'kuery' },
  };
};

/**
 * Returns Point-to-point Data Source layer configuration ('source.geo.location' &
 * 'source.geo.location') for the given indexPattern title/id
 *
 * @param indexPatternTitle used as layer name in LayerToC UI: "${indexPatternTitle} | Line"
 * @param indexPatternId used as layer's indexPattern to query for data
 * @param parentId
 * @param layerDetails layer-specific field details
 */
export const getLineLayer = (
  indexPatternTitle: string,
  indexPatternId: string,
  parentId: string,
  layerDetails: LayerMapping
) => {
  const euiVisColorPalette = euiPaletteColorBlind();

  return {
    sourceDescriptor: {
      type: SOURCE_TYPES.ES_PEW_PEW,
      applyGlobalQuery: true,
      id: uuidv4(),
      indexPatternId,
      sourceGeoField: layerDetails.source.geoField,
      destGeoField: layerDetails.destination.geoField,
      metrics: [
        {
          type: 'sum',
          field: layerDetails.source.metricField,
          label: layerDetails.source.metricField,
        },
        {
          type: 'sum',
          field: layerDetails.destination.metricField,
          label: layerDetails.destination.metricField,
        },
      ],
    },
    style: {
      type: 'VECTOR',
      properties: {
        fillColor: {
          type: 'STATIC',
          options: { color: euiVisColorPalette[1] },
        },
        lineColor: {
          type: 'STATIC',
          options: { color: euiVisColorPalette[1] },
        },
        lineWidth: {
          type: 'DYNAMIC',
          options: {
            field: {
              label: 'count',
              name: 'doc_count',
              origin: 'source',
            },
            minSize: 1,
            maxSize: 8,
            fieldMetaOptions: {
              isEnabled: true,
              sigma: 3,
            },
          },
        },
        iconSize: { type: 'STATIC', options: { size: 10 } },
        iconOrientation: {
          type: 'STATIC',
          options: { orientation: 0 },
        },
        symbolizeAs: {
          options: { value: 'icon' },
        },
        icon: {
          type: 'STATIC',
          options: { value: 'airfield' },
        },
      },
    },
    id: uuidv4(),
    parent: parentId,
    label: `${indexPatternTitle} | ${i18n.LINE_LAYER}`,
    minZoom: 0,
    maxZoom: 24,
    alpha: 0.5,
    visible: true,
    type: LAYER_TYPE.GEOJSON_VECTOR,
    query: { query: '', language: 'kuery' },
  };
};
