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
export type Record = { record: NativeAttributeValue; event: 'INSERT' | 'MODIFY' | 'REMOVE' };

type FlexSearchIndex = Document<unknown, false>;
export class IndexService {
  documentIndex: FlexSearchIndex;
  indexDirty = false;
  initialized = false;

  constructor(
    private originRepository: OriginRepository,
    private indexPersistenceAdapater: IndexPersistenceAdapter,
    private indexName: string,
    private idField: string,
    private fields: string[],
  ) {
    this.documentIndex = this.createIndex();
  }

  private importIndex = async () => {
    const indexData = await this.indexPersistenceAdapater.load(this.indexName);
    if (indexData) {
      indexData.searchIndexData.forEach(({ key, data }) => {
        this.documentIndex.import(key, data);
      });
      console.log('Imported index', indexData.searchIndexData.length);
    } else {
      console.log('No index found. Using empty index.');
    }
  };

  private createIndex = (): FlexSearchIndex =>
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

  init = async () => {
    if (this.initialized) {
      return;
    }
    await measureTime(async () => await this.importIndex(), putIndexLoadTime);
    this.indexDirty = false;
    this.initialized = true;
  };

  exportIndexData = async (): Promise<DynoSearchIndex> => {
    const indexData: FlexSearchIndexExport = [];
    return new Promise((resolve) => {
      const perIndexKeys = 1;
      const perFieldKeys = 3;
      const expectedKeys = this.fields.length * perFieldKeys + perIndexKeys;
      let received = 0;

      this.documentIndex.export(async (key, data) => {
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

  private getIds = async (dynoSearchIndex: DynoSearchIndex | undefined) => {
    const searchData = dynoSearchIndex?.searchIndexData ?? (await this.exportIndexData())?.searchIndexData;
    return Object.keys(JSON.parse(searchData.find((part) => part.key === 'reg')?.data ?? '{}'));
  };

  persist = async (): Promise<DynoSearchIndex> => {
    if (!this.indexDirty) {
      throw new Error('Index not dirty');
    }
    const start = performance.now();
    const dynoSearchIndex = await this.exportIndexData();
    await this.indexPersistenceAdapater.save(dynoSearchIndex);
    const end = performance.now();

    const millis = end - start;
    putIndexSaveTime(millis);

    const items = (await this.getIds(dynoSearchIndex)).length;
    putIndexItemCount(items);

    return dynoSearchIndex;
  };

  reindex = async (pkPrefixes: string[] | undefined) => {
    await measureTime(async () => {
      const data = await this.originRepository.getAll(pkPrefixes);
      await this.indexRecords(data.map((record) => ({ record, event: 'INSERT' })));
      this.indexDirty = true;
      await this.persist();
    }, putReIndexTime);
  };

  private filterRecords = (records: Record[]): ({ object: { [key: string]: any } } & Omit<Record, 'record'>)[] =>
    records
      .map(({ record, event }) => ({
        object: unmarshall(record),
        event,
      }))
      .filter((object) => {
        const entity = dynamoDBZodObjectSchema.parse(object);
        if (entity.pk.startsWith('dynosearch-')) {
          return false;
        }
        // TODO: Check PK prefixes
        return true;
      });

  indexRecords = async (records: Record[]): Promise<{ success: number; skipped: number }> => {
    const existingIds = await this.getIds(await this.exportIndexData());
    const successful = await Promise.all(
      this.filterRecords(records).map(async ({ object, event }) => {
        const id = object[this.idField];
        const exists = existingIds.includes(id);
        if (event === 'REMOVE' && exists) {
          await this.delete(object);
          return true;
        }
        if (exists) {
          await this.update(object);
        } else {
          await this.add(object);
        }
        return true;
      }),
    );
    const success = successful.filter((r) => r).length;
    return {
      success,
      skipped: records.length - success,
    };
  };

  private add = async (doc: object) => {
    this.documentIndex.add(doc);
    this.indexDirty = true;
  };

  private update = async (doc: object) => {
    this.documentIndex.update(doc);
    this.indexDirty = true;
  };

  private delete = async (doc: object) => {
    this.documentIndex.remove(doc);
    this.indexDirty = true;
  };

  search = async (searchOptions: SearchOptions): Promise<SimpleDocumentSearchResultSetUnit[]> => {
    const [result] = await measureTime(async () => {
      const result = searchOptions.options
        ? this.documentIndex?.search(searchOptions.query, searchOptions.options)
        : this.documentIndex?.search(searchOptions.query);
      return result;
    }, putSearchTime(!!this.documentIndex));
    return result ?? [];
  };
}
