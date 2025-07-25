/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiBadge, EuiToolTip, RIGHT_ALIGNMENT, LEFT_ALIGNMENT, EuiIconTip } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import styled from '@emotion/styled';
import React, { useMemo } from 'react';
import { Timestamp } from '@kbn/apm-ui-shared';
import { NOT_AVAILABLE_LABEL } from '../../../../../../common/i18n';
import { asInteger } from '../../../../../../common/utils/formatters';
import { useApmParams } from '../../../../../hooks/use_apm_params';
import type { APIReturnType } from '../../../../../services/rest/create_call_apm_api';
import { truncate, unit } from '../../../../../utils/style';
import {
  ChartType,
  getTimeSeriesColor,
} from '../../../../shared/charts/helper/get_timeseries_color';
import { SparkPlot } from '../../../../shared/charts/spark_plot';
import { ErrorDetailLink } from '../../../../shared/links/apm/mobile/error_detail_link';
import { ErrorOverviewLink } from '../../../../shared/links/apm/mobile/error_overview_link';
import type { ITableColumn } from '../../../../shared/managed_table';
import { ManagedTable } from '../../../../shared/managed_table';
import { isTimeComparison } from '../../../../shared/time_comparison/get_comparison_options';

const GroupIdLink = styled(ErrorDetailLink)`
  font-family: ${({ theme }) => theme.euiTheme.font.familyCode};
`;

const MessageAndCulpritCell = styled.div`
  ${truncate('100%')};
`;

const ErrorLink = styled(ErrorOverviewLink)`
  ${truncate('100%')};
`;

const MessageLink = styled(ErrorDetailLink)`
  font-family: ${({ theme }) => theme.euiTheme.font.familyCode};
  ${truncate('100%')};
`;

type ErrorGroupItem =
  APIReturnType<'GET /internal/apm/mobile-services/{serviceName}/errors/groups/main_statistics'>['errorGroups'][0];
type ErrorGroupDetailedStatistics =
  APIReturnType<'POST /internal/apm/mobile-services/{serviceName}/errors/groups/detailed_statistics'>;

interface Props {
  mainStatistics: ErrorGroupItem[];
  serviceName: string;
  detailedStatisticsLoading: boolean;
  detailedStatistics: ErrorGroupDetailedStatistics;
  initialSortField: string;
  initialSortDirection: 'asc' | 'desc';
  comparisonEnabled?: boolean;
  isLoading: boolean;
}

function MobileErrorGroupList({
  mainStatistics,
  serviceName,
  detailedStatisticsLoading,
  detailedStatistics,
  comparisonEnabled,
  initialSortField,
  initialSortDirection,
  isLoading,
}: Props) {
  const { query } = useApmParams('/mobile-services/{serviceName}/errors-and-crashes');
  const { offset } = query;
  const columns = useMemo(() => {
    return [
      {
        name: (
          <>
            {i18n.translate('xpack.apm.errorsTable.groupIdColumnLabel', {
              defaultMessage: 'Group ID',
            })}{' '}
            <EuiIconTip
              size="s"
              type="question"
              color="subdued"
              iconProps={{
                className: 'eui-alignTop',
              }}
              content={i18n.translate('xpack.apm.errorsTable.groupIdColumnDescription', {
                defaultMessage:
                  'Hash of the stack trace. Groups similar errors together, even when the error message is different due to dynamic parameters.',
              })}
            />
          </>
        ),
        field: 'groupId',
        sortable: false,
        width: `${unit * 6}px`,
        render: (_, item: ErrorGroupItem) => {
          return (
            <GroupIdLink serviceName={serviceName} groupId={item.groupId} query={query}>
              {item.groupId.slice(0, 5) || NOT_AVAILABLE_LABEL}
            </GroupIdLink>
          );
        },
      },
      {
        name: i18n.translate('xpack.apm.errorsTable.typeColumnLabel', {
          defaultMessage: 'Type',
        }),
        field: 'type',
        sortable: false,
        render: (_, { type }) => {
          return (
            <ErrorLink
              title={type}
              serviceName={serviceName}
              query={{
                ...query,
                kuery: `error.exception.type:"${type}"`,
              }}
            >
              {type}
            </ErrorLink>
          );
        },
      },
      {
        name: i18n.translate('xpack.apm.errorsTable.errorMessageColumnLabel', {
          defaultMessage: 'Error message',
        }),
        field: 'message',
        sortable: false,
        width: '30%',
        render: (_, item: ErrorGroupItem) => {
          return (
            <MessageAndCulpritCell>
              <EuiToolTip id="error-message-tooltip" content={item.name || NOT_AVAILABLE_LABEL}>
                <MessageLink serviceName={serviceName} groupId={item.groupId} query={query}>
                  {item.name || NOT_AVAILABLE_LABEL}
                </MessageLink>
              </EuiToolTip>
            </MessageAndCulpritCell>
          );
        },
      },
      {
        name: '',
        field: 'handled',
        sortable: false,
        align: RIGHT_ALIGNMENT,
        render: (_, { handled }) =>
          handled === false && (
            <EuiBadge color="warning">
              {i18n.translate('xpack.apm.errorsTable.unhandledLabel', {
                defaultMessage: 'Unhandled',
              })}
            </EuiBadge>
          ),
      },
      {
        field: 'lastSeen',
        sortable: true,
        name: i18n.translate('xpack.apm.errorsTable.lastSeenColumnLabel', {
          defaultMessage: 'Last seen',
        }),
        align: LEFT_ALIGNMENT,
        render: (_, { lastSeen }) =>
          lastSeen ? (
            <Timestamp timestamp={lastSeen} timeUnit="minutes" renderMode="tooltip" />
          ) : (
            NOT_AVAILABLE_LABEL
          ),
      },
      {
        field: 'occurrences',
        name: i18n.translate('xpack.apm.errorsTable.occurrencesColumnLabel', {
          defaultMessage: 'Occurrences',
        }),
        sortable: true,
        dataType: 'number',
        align: RIGHT_ALIGNMENT,
        render: (_, { occurrences, groupId }) => {
          const currentPeriodTimeseries = detailedStatistics?.currentPeriod?.[groupId]?.timeseries;
          const previousPeriodTimeseries =
            detailedStatistics?.previousPeriod?.[groupId]?.timeseries;
          const { currentPeriodColor, previousPeriodColor } = getTimeSeriesColor(
            ChartType.FAILED_TRANSACTION_RATE
          );

          return (
            <SparkPlot
              type="bar"
              color={currentPeriodColor}
              isLoading={detailedStatisticsLoading}
              series={currentPeriodTimeseries}
              valueLabel={i18n.translate('xpack.apm.serviceOverview.errorsTableOccurrences', {
                defaultMessage: `{occurrences} occ.`,
                values: {
                  occurrences: asInteger(occurrences),
                },
              })}
              comparisonSeries={
                comparisonEnabled && isTimeComparison(offset) ? previousPeriodTimeseries : undefined
              }
              comparisonSeriesColor={previousPeriodColor}
            />
          );
        },
      },
    ] as Array<ITableColumn<ErrorGroupItem>>;
  }, [
    serviceName,
    query,
    detailedStatistics,
    comparisonEnabled,
    detailedStatisticsLoading,
    offset,
  ]);
  return (
    <ManagedTable
      noItemsMessage={
        isLoading
          ? i18n.translate('xpack.apm.errorsTable.loading', {
              defaultMessage: 'Loading...',
            })
          : i18n.translate('xpack.apm.errorsTable.noErrorsLabel', {
              defaultMessage: 'No errors found',
            })
      }
      items={mainStatistics}
      columns={columns}
      initialSortField={initialSortField}
      initialSortDirection={initialSortDirection}
      sortItems={false}
      initialPageSize={25}
      isLoading={isLoading}
    />
  );
}

export { MobileErrorGroupList };
