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

import { S3 } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { streamToString } from '../../../utils/utils';
import { DynoSearchIndex, dynoSearchIndexSchema, emptyIndex } from '../../dynoSearchIndex';
import { IndexPersistenceAdapter } from '../indexPersistenceAdapter';

const getKey = (name: string) => `flexsearch/${name}.json`;

export const s3IndexPersistenceAdapter = (s3Client: S3, bucketName: string): IndexPersistenceAdapter => ({
  load: async (name: string) => {
    try {
      const s3Object = await s3Client.getObject({
        Bucket: bucketName,
        Key: getKey(name),
      });

      if (!s3Object.Body) {
        console.log('S3 object had empty body. Returning empty index.');
        return emptyIndex(name);
      }

      if (!(s3Object.Body instanceof Readable)) {
        throw new Error('Cannot return object of non readable type');
      }

      return dynoSearchIndexSchema.parse(JSON.parse(await streamToString(s3Object.Body)));
    } catch (e) {
      const error = e as any;
      if (error.message === 'NoSuchKey') {
        return emptyIndex(name);
      }
      console.error("Couldn't load index from S3. Returning empty index.", e);
      return emptyIndex(name);
    }
  },
  save: async (index: DynoSearchIndex) => {
    await s3Client.putObject({
      Bucket: bucketName,
      Key: getKey(index.name),
      Body: JSON.stringify(index),
    });
    console.log('Saved index to S3.');
  },
  drop: async (name: string) => {
    await s3Client.deleteObject({
      Bucket: bucketName,
      Key: getKey(name),
    });
    console.log('Dropped index from S3.');
  },
});
