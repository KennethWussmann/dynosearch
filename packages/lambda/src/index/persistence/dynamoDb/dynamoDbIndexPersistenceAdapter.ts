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
import { groupBy } from 'lodash';
import { DynoSearchIndex, emptyIndex } from '../../dynoSearchIndex';
import { IndexPersistenceAdapter } from '../indexPersistenceAdapter';
import { DynamoDbIndexRepository } from './dynamoDbIndexRepository';

export const dynamoDbIndexPersistenceAdapter = (indexRepository: DynamoDbIndexRepository): IndexPersistenceAdapter => ({
  load: async (name: string) => {
    const index = await indexRepository.getIndex(name);
    return index
      ? {
          name: name,
          elements: 0, // TODO: Add actual count
          searchIndexData: Object.entries(groupBy(index, (part) => part.id.split('#')[0])).map(([id, parts]) => {
            if (id.endsWith('.map')) {
              return {
                key: id,
                data: JSON.stringify(parts.map((part) => JSON.parse(part.data))),
              };
            } else {
              return {
                key: id,
                data: parts[0].data,
              };
            }
          }),
        }
      : emptyIndex(name);
  },
  save: async (index: DynoSearchIndex) => {
    index.searchIndexData.map(async ({ key, data }) => {
      const chunks: string[] = key.endsWith('.map')
        ? JSON.parse(data)
            .filter((obj: object) => Object.keys(obj).length > 0)
            .map((part: object) => JSON.stringify(part))
        : [data];
      await Promise.all(
        chunks.map(async (chunk, i) => {
          await indexRepository.save({
            id: `${key}#${i}`,
            name: index.name,
            data: chunk,
          });
        }),
      );
    });
  },
  drop: async (name: string) => {
    await indexRepository.drop(name);
  },
});
