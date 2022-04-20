/*
 * Copyright 2022 Kenneth Wußmann
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and limitations under the License.
 *
 */
import { config } from './config';
import { metricScope, Unit } from 'aws-embedded-metrics';
import { performance } from 'perf_hooks';

export enum MetricName {
  SearchTime = 'search-time',
  IndexLoadTime = 'index-load-time',
  IndexSaveTime = 'index-save-time',
  ReIndexTime = 're-index-time',
  IndexItemCount = 'index-item-count',
}

const writeMetrics = config.writeMetrics;
const defaultDimensions = {
  persistenceProvider: config.indexPersistenceProvider,
  indexName: config.indexName,
};

export const measureTime = async <T>(
  fn: () => Promise<T>,
  metricWriter: ((millis: number) => void) | undefined = undefined,
): Promise<[T, number]> => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const millis = end - start;
  metricWriter?.(millis);
  return [result, millis];
};

const putMillisMetric = (metric: MetricName, dimensions: Record<string, string> | undefined = undefined) =>
  metricScope((metrics) => (millis: number) => {
    if (writeMetrics) {
      metrics.setDimensions({});
      metrics.putMetric(metric, millis, Unit.Milliseconds).putDimensions({
        ...dimensions,
        ...defaultDimensions,
      });
    }
  });

export const putSearchTime = (cached: boolean) =>
  putMillisMetric(MetricName.SearchTime, {
    cached: cached?.toString(),
  });

export const putIndexLoadTime = putMillisMetric(MetricName.IndexLoadTime);
export const putIndexSaveTime = putMillisMetric(MetricName.IndexSaveTime);
export const putReIndexTime = putMillisMetric(MetricName.ReIndexTime);
export const putIndexItemCount = metricScope((metrics) => (count: number) => {
  if (writeMetrics) {
    metrics.setDimensions({});
    metrics.putMetric(MetricName.IndexItemCount, count, Unit.Count).putDimensions({
      ...defaultDimensions,
    });
  }
});
