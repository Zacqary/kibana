/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { FC } from 'react';
import React, { useEffect, useState } from 'react';

import {
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from '@elastic/eui';

import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import {
  getDependentVar,
  getPredictionFieldName,
  type DataFrameAnalyticsConfig,
  type DataFrameTaskStateType,
  ANALYSIS_CONFIG_TYPE,
} from '@kbn/ml-data-frame-analytics-utils';

import type { estypes } from '@elastic/elasticsearch';
import { useMlApi, useMlKibana } from '../../../../../contexts/kibana';

import type { Eval } from '../../../../common';
import { getValuesFromResponse, loadEvalData, loadDocsCount } from '../../../../common';
import {
  isResultsSearchBoolQuery,
  isRegressionEvaluateResponse,
  REGRESSION_STATS,
  EMPTY_STAT,
} from '../../../../common/analytics';

import { ExpandableSection } from '../expandable_section';

import { EvaluateStat } from './evaluate_stat';

interface Props {
  jobConfig: DataFrameAnalyticsConfig;
  jobStatus?: DataFrameTaskStateType;
  searchQuery: estypes.QueryDslQueryContainer;
}

const EMPTY_STATS = {
  mse: EMPTY_STAT,
  msle: EMPTY_STAT,
  huber: EMPTY_STAT,
  rSquared: EMPTY_STAT,
};

const defaultEval: Eval = {
  ...EMPTY_STATS,
  error: null,
};

export const EvaluatePanel: FC<Props> = ({ jobConfig, jobStatus, searchQuery }) => {
  const {
    services: { docLinks },
  } = useMlKibana();
  const mlApi = useMlApi();
  const docLink = docLinks.links.ml.regressionEvaluation;
  const [trainingEval, setTrainingEval] = useState<Eval>(defaultEval);
  const [generalizationEval, setGeneralizationEval] = useState<Eval>(defaultEval);
  const [isLoadingTraining, setIsLoadingTraining] = useState<boolean>(false);
  const [isLoadingGeneralization, setIsLoadingGeneralization] = useState<boolean>(false);
  const [isTrainingFilter, setIsTrainingFilter] = useState<boolean | undefined>(undefined);
  const [trainingDocsCount, setTrainingDocsCount] = useState<null | number>(null);
  const [generalizationDocsCount, setGeneralizationDocsCount] = useState<null | number>(null);

  const index = jobConfig.dest.index;
  const dependentVariable = getDependentVar(jobConfig.analysis);
  const predictionFieldName = getPredictionFieldName(jobConfig.analysis);
  // default is 'ml'
  const resultsField = jobConfig.dest.results_field ?? 'ml';

  const loadGeneralizationData = async (ignoreDefaultQuery: boolean = true) => {
    setIsLoadingGeneralization(true);

    const genErrorEval = await loadEvalData({
      mlApi,
      isTraining: false,
      index,
      dependentVariable,
      resultsField,
      predictionFieldName,
      searchQuery,
      ignoreDefaultQuery,
      jobType: ANALYSIS_CONFIG_TYPE.REGRESSION,
    });

    if (
      genErrorEval.success === true &&
      genErrorEval.eval &&
      isRegressionEvaluateResponse(genErrorEval.eval)
    ) {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { mse, msle, huber, r_squared } = getValuesFromResponse(genErrorEval.eval);
      setGeneralizationEval({
        mse,
        msle,
        huber,
        rSquared: r_squared,
        error: null,
      });
      setIsLoadingGeneralization(false);
    } else {
      setIsLoadingGeneralization(false);
      setGeneralizationEval({
        ...EMPTY_STATS,
        error: genErrorEval.error,
      });
    }
  };

  const loadTrainingData = async (ignoreDefaultQuery: boolean = true) => {
    setIsLoadingTraining(true);

    const trainingErrorEval = await loadEvalData({
      mlApi,
      isTraining: true,
      index,
      dependentVariable,
      resultsField,
      predictionFieldName,
      searchQuery,
      ignoreDefaultQuery,
      jobType: ANALYSIS_CONFIG_TYPE.REGRESSION,
    });

    if (
      trainingErrorEval.success === true &&
      trainingErrorEval.eval &&
      isRegressionEvaluateResponse(trainingErrorEval.eval)
    ) {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { mse, msle, huber, r_squared } = getValuesFromResponse(trainingErrorEval.eval);
      setTrainingEval({
        mse,
        msle,
        huber,
        rSquared: r_squared,
        error: null,
      });
      setIsLoadingTraining(false);
    } else {
      setIsLoadingTraining(false);
      setTrainingEval({
        ...EMPTY_STATS,
        error: trainingErrorEval.error,
      });
    }
  };

  const loadData = async () => {
    loadGeneralizationData(false);
    const genDocsCountResp = await loadDocsCount({
      mlApi,
      ignoreDefaultQuery: false,
      isTraining: false,
      searchQuery,
      resultsField,
      destIndex: jobConfig.dest.index,
    });
    if (genDocsCountResp.success === true) {
      setGeneralizationDocsCount(genDocsCountResp.docsCount);
    } else {
      setGeneralizationDocsCount(null);
    }

    loadTrainingData(false);
    const trainDocsCountResp = await loadDocsCount({
      mlApi,
      ignoreDefaultQuery: false,
      isTraining: true,
      searchQuery,
      resultsField,
      destIndex: jobConfig.dest.index,
    });
    if (trainDocsCountResp.success === true) {
      setTrainingDocsCount(trainDocsCountResp.docsCount);
    } else {
      setTrainingDocsCount(null);
    }
  };

  useEffect(() => {
    let isTraining: boolean | undefined;
    const query =
      isResultsSearchBoolQuery(searchQuery) && (searchQuery.bool.should || searchQuery.bool.filter);

    if (query !== undefined && query !== false) {
      for (let i = 0; i < query.length; i++) {
        const clause = query[i];

        if (clause.match && clause.match[`${resultsField}.is_training`] !== undefined) {
          isTraining = clause.match[`${resultsField}.is_training`];
          break;
        } else if (
          clause.bool &&
          (clause.bool.should !== undefined || clause.bool.filter !== undefined)
        ) {
          const innerQuery = clause.bool.should || clause.bool.filter;
          if (innerQuery !== undefined) {
            for (let j = 0; j < innerQuery.length; j++) {
              const innerClause = innerQuery[j];
              if (
                innerClause.match &&
                innerClause.match[`${resultsField}.is_training`] !== undefined
              ) {
                isTraining = innerClause.match[`${resultsField}.is_training`];
                break;
              }
            }
          }
        }
      }
    }

    setIsTrainingFilter(isTraining);
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(searchQuery)]);

  return (
    <>
      <ExpandableSection
        urlStateKey={'evaluation'}
        dataTestId="RegressionEvaluation"
        title={
          <FormattedMessage
            id="xpack.ml.dataframe.analytics.regressionExploration.evaluateSectionTitle"
            defaultMessage="Model evaluation"
          />
        }
        docsLink={
          <EuiButtonEmpty
            target="_blank"
            iconType="question"
            iconSide="left"
            size="xs"
            color="primary"
            href={docLink}
          >
            <EuiText size="xs" color="primary">
              <FormattedMessage
                id="xpack.ml.dataframe.analytics.regressionExploration.regressionDocsLink"
                defaultMessage="Regression evaluation docs "
              />
            </EuiText>
          </EuiButtonEmpty>
        }
        headerItems={
          jobStatus !== undefined
            ? [
                {
                  id: 'jobStatus',
                  label: i18n.translate(
                    'xpack.ml.dataframe.analytics.classificationExploration.evaluateJobStatusLabel',
                    {
                      defaultMessage: 'Job status',
                    }
                  ),
                  value: jobStatus,
                },
              ]
            : []
        }
        contentPadding={true}
        content={
          <EuiFlexGroup justifyContent="spaceBetween">
            <EuiFlexItem>
              <EuiTitle size="xxs">
                <span>
                  {i18n.translate(
                    'xpack.ml.dataframe.analytics.regressionExploration.generalizationErrorTitle',
                    {
                      defaultMessage: 'Generalization error',
                    }
                  )}
                </span>
              </EuiTitle>
              {generalizationDocsCount !== null && (
                <EuiText size="xs" color="subdued">
                  <FormattedMessage
                    id="xpack.ml.dataframe.analytics.regressionExploration.generalizationDocsCount"
                    defaultMessage="{docsCount, plural, one {# doc} other {# docs}} evaluated"
                    values={{ docsCount: generalizationDocsCount }}
                  />
                  {isTrainingFilter === true && generalizationDocsCount === 0 && (
                    <FormattedMessage
                      id="xpack.ml.dataframe.analytics.regressionExploration.generalizationFilterText"
                      defaultMessage=". Filtering for training data."
                    />
                  )}
                </EuiText>
              )}
              <EuiSpacer />
              <EuiFlexGroup direction="column" gutterSize="none">
                <EuiFlexItem>
                  <EuiFlexGroup direction="column" gutterSize="s">
                    {/* First row stats */}
                    <EuiFlexItem>
                      <EuiFlexGroup>
                        <EuiFlexItem>
                          <EvaluateStat
                            dataTestSubj={'mlDFAnalyticsRegressionGenMSEstat'}
                            isLoading={isLoadingGeneralization}
                            title={generalizationEval.mse}
                            statType={REGRESSION_STATS.MSE}
                          />
                        </EuiFlexItem>
                        <EuiFlexItem>
                          <EvaluateStat
                            dataTestSubj={'mlDFAnalyticsRegressionGenRSquaredStat'}
                            isLoading={isLoadingGeneralization}
                            title={generalizationEval.rSquared}
                            statType={REGRESSION_STATS.R_SQUARED}
                          />
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </EuiFlexItem>
                    {/* Second row stats */}
                    <EuiFlexItem>
                      <EuiFlexGroup>
                        <EuiFlexItem>
                          <EvaluateStat
                            dataTestSubj={'mlDFAnalyticsRegressionGenMsleStat'}
                            isLoading={isLoadingGeneralization}
                            title={generalizationEval.msle}
                            statType={REGRESSION_STATS.MSLE}
                          />
                        </EuiFlexItem>
                        <EuiFlexItem>
                          <EvaluateStat
                            dataTestSubj={'mlDFAnalyticsRegressionGenHuberStat'}
                            isLoading={isLoadingGeneralization}
                            title={generalizationEval.huber}
                            statType={REGRESSION_STATS.HUBER}
                          />
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiFlexItem>
                {generalizationEval.error !== null && (
                  <EuiFlexItem grow={false}>
                    <EuiText size="xs" color="danger">
                      {isTrainingFilter === true &&
                      generalizationDocsCount === 0 &&
                      generalizationEval.error.includes('No documents found')
                        ? i18n.translate(
                            'xpack.ml.dataframe.analytics.regressionExploration.evaluateNoTestingDocsError',
                            {
                              defaultMessage: 'No testing documents found',
                            }
                          )
                        : generalizationEval.error}
                    </EuiText>
                  </EuiFlexItem>
                )}
              </EuiFlexGroup>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiTitle size="xxs">
                <span>
                  {i18n.translate(
                    'xpack.ml.dataframe.analytics.regressionExploration.trainingErrorTitle',
                    {
                      defaultMessage: 'Training error',
                    }
                  )}
                </span>
              </EuiTitle>
              {trainingDocsCount !== null && (
                <EuiText size="xs" color="subdued">
                  <FormattedMessage
                    id="xpack.ml.dataframe.analytics.regressionExploration.trainingDocsCount"
                    defaultMessage="{docsCount, plural, one {# doc} other {# docs}} evaluated"
                    values={{ docsCount: trainingDocsCount }}
                  />
                  {isTrainingFilter === false && trainingDocsCount === 0 && (
                    <FormattedMessage
                      id="xpack.ml.dataframe.analytics.regressionExploration.trainingFilterText"
                      defaultMessage=". Filtering for testing data."
                    />
                  )}
                </EuiText>
              )}
              <EuiSpacer />
              <EuiFlexGroup direction="column" gutterSize="none">
                <EuiFlexItem>
                  <EuiFlexGroup direction="column" gutterSize="s">
                    {/* First row stats */}
                    <EuiFlexItem>
                      <EuiFlexGroup>
                        <EuiFlexItem>
                          <EvaluateStat
                            dataTestSubj={'mlDFAnalyticsRegressionTrainingMSEstat'}
                            isLoading={isLoadingTraining}
                            title={trainingEval.mse}
                            statType={REGRESSION_STATS.MSE}
                          />
                        </EuiFlexItem>
                        <EuiFlexItem>
                          <EvaluateStat
                            dataTestSubj={'mlDFAnalyticsRegressionTrainingRSquaredStat'}
                            isLoading={isLoadingTraining}
                            title={trainingEval.rSquared}
                            statType={REGRESSION_STATS.R_SQUARED}
                          />
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </EuiFlexItem>
                    {/* Second row stats */}
                    <EuiFlexItem>
                      <EuiFlexGroup>
                        <EuiFlexItem>
                          <EvaluateStat
                            dataTestSubj={'mlDFAnalyticsRegressionTrainingMsleStat'}
                            isLoading={isLoadingTraining}
                            title={trainingEval.msle}
                            statType={REGRESSION_STATS.MSLE}
                          />
                        </EuiFlexItem>
                        <EuiFlexItem>
                          <EvaluateStat
                            dataTestSubj={'mlDFAnalyticsRegressionTrainingHuberStat'}
                            isLoading={isLoadingTraining}
                            title={trainingEval.huber}
                            statType={REGRESSION_STATS.HUBER}
                          />
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiFlexItem>
                {trainingEval.error !== null && (
                  <EuiFlexItem grow={false}>
                    <EuiText size="xs" color="danger">
                      {isTrainingFilter === false &&
                      trainingDocsCount === 0 &&
                      trainingEval.error.includes('No documents found')
                        ? i18n.translate(
                            'xpack.ml.dataframe.analytics.regressionExploration.evaluateNoTrainingDocsError',
                            {
                              defaultMessage: 'No training documents found',
                            }
                          )
                        : trainingEval.error}
                    </EuiText>
                  </EuiFlexItem>
                )}
              </EuiFlexGroup>
            </EuiFlexItem>
          </EuiFlexGroup>
        }
      />
      <EuiSpacer size="m" />
    </>
  );
};
