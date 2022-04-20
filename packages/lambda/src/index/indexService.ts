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
import { NativeAttributeValue, unmarshall } from '@aws-sdk/util-dynamodb';
import { Document, DocumentSearchOptions, SimpleDocumentSearchResultSetUnit } from 'flexsearch';
import { performance } from 'perf_hooks';
import {
  measureTime,
  putIndexItemCount,
  putIndexLoadTime,
  putIndexSaveTime,
  putReIndexTime,
  putSearchTime,
} from '../metricWriter';
import { OriginRepository } from '../origin/originRepository';
import { dynamoDBZodObjectSchema } from '../utils/dynamoDbObject';
import { DynoSearchIndex, FlexSearchIndexExport } from './dynoSearchIndex';
import { IndexPersistenceAdapter } from './persistence/indexPersistenceAdapter';

export type SearchOptions = {
  query: string;
  options?: string[] | Partial<DocumentSearchOptions<boolean>>;
};

type FlexSearchIndex = Document<unknown, false>;
export class IndexService {
  documentIndex: FlexSearchIndex | undefined;
  indexDirty = false;

  constructor(
    private originRepository: OriginRepository,
    private indexPersistenceAdapater: IndexPersistenceAdapter,
    private indexName: string,
    private idField: string,
    private fields: string[],
  ) {}

  private importIndex = async (index: FlexSearchIndex): Promise<FlexSearchIndex> => {
    const indexData = await this.indexPersistenceAdapater.load(this.indexName);
    if (indexData) {
      indexData.searchIndexData.forEach(({ key, data }) => {
        index.import(key, data);
      });
      console.log('Imported index', indexData.searchIndexData.length);
    } else {
      console.log('No index found. Using empty index.');
    }
    return index;
  };

  private createIndex = (): Document<unknown, false> =>
    new Document({
      tokenize: 'full',
      charset: 'latin:advanced',
      preset: 'performance',
      cache: true,
      document: {
        id: this.idField,
        index: this.fields,
      },
    });

  getOrLoadIndex = async (): Promise<Document<unknown, false>> => {
    if (this.documentIndex) {
      return this.documentIndex;
    }
    const [index] = await measureTime(async () => await this.importIndex(this.createIndex()), putIndexLoadTime);
    this.documentIndex = index;
    this.indexDirty = false;
    return this.documentIndex;
  };

  exportIndexData = async (): Promise<DynoSearchIndex> => {
    if (!this.documentIndex) {
      throw new Error('Index not initialized');
    }
    const indexData: FlexSearchIndexExport = [];
    return new Promise((resolve) => {
      const perIndexKeys = 1;
      const perFieldKeys = 3;
      const expectedKeys = this.fields.length * perFieldKeys + perIndexKeys;
      let received = 0;

      this.documentIndex!.export(async (key, data) => {
        if (!key || !data) {
          return;
        }
        received = received + 1;
        indexData.push({
          key: key.toString(),
          data: (data as any).toString(),
        });
        if (received >= expectedKeys) {
          resolve({
            name: this.indexName,
            searchIndexData: indexData,
          });
        }
      });
    });
  };

  persist = async (): Promise<DynoSearchIndex> => {
    if (!this.documentIndex) {
      throw new Error('Index not initialized');
    }
    if (!this.indexDirty) {
      throw new Error('Index not dirty');
    }
    const start = performance.now();
    const dynoSearchIndex = await this.exportIndexData();
    await this.indexPersistenceAdapater.save(dynoSearchIndex);
    const end = performance.now();

    const millis = end - start;
    putIndexSaveTime(millis);

    const items = Object.keys(
      JSON.parse(dynoSearchIndex.searchIndexData.find((part) => part.key === 'reg')?.data ?? '{}'),
    ).length;
    putIndexItemCount(items);

    return dynoSearchIndex;
  };

  reindex = async (pkPrefixes: string[] | undefined) => {
    await measureTime(async () => {
      const tempIndex = this.createIndex();
      const data = await this.originRepository.getAll(pkPrefixes);
      await Promise.all(data.map(async (item) => await this.indexRecord(item, tempIndex)));
      this.documentIndex = tempIndex;
      this.indexDirty = true;
      await this.persist();
    }, putReIndexTime);
  };

  indexRecord = async (
    record: NativeAttributeValue,
    flexSearchIndex: Document<unknown, false> | undefined = undefined,
  ) => {
    const object = unmarshall(record);
    const entity = dynamoDBZodObjectSchema.parse(object);
    if (entity.pk.startsWith('dynosearch-')) {
      return false;
    }
    // TODO: Check PK prefixes
    await this.add(object, flexSearchIndex);
    return true;
  };

  private add = async (doc: object, flexSearchIndex: Document<unknown, false> | undefined = undefined) => {
    const index = flexSearchIndex ?? (await this.getOrLoadIndex());
    index.add(doc);
    this.indexDirty = true;
  };

  search = async (searchOptions: SearchOptions): Promise<SimpleDocumentSearchResultSetUnit[]> => {
    const [result] = await measureTime(async () => {
      const index = await this.getOrLoadIndex();
      const result = searchOptions.options
        ? index.search(searchOptions.query, searchOptions.options)
        : index.search(searchOptions.query);
      return result;
    }, putSearchTime(!!this.documentIndex));
    return result;
  };
}
