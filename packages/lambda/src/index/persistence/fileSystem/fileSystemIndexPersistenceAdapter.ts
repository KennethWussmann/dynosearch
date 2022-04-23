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

import { constants, createWriteStream } from 'fs';
import { access, readFile, unlink, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { DynoSearchIndex, dynoSearchIndexSchema, emptyIndex } from '../../dynoSearchIndex';
import { IndexPersistenceAdapter } from '../indexPersistenceAdapter';
import JsonStreamStringify from 'json-stream-stringify';

const getFileName = (basePath: string, name: string) => join(basePath, 'dynosearch', `${name}.json`);

// const fileWritable = async (path: string) => {
//   try {
//     await access(path, constants.F_OK | constants.W_OK);
//     return true;
//   } catch (e) {
//     return false;
//   }
// };

const fileReadable = async (path: string) => {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    return true;
  } catch (e) {
    return false;
  }
};

export const mkdirIfNotExists = async (path: string) => {
  if (!(await fileReadable(dirname(path)))) {
    await mkdir(dirname(path), { recursive: true });
  }
};

const streamJsonToFile = (filePath: string, object: unknown) => {
  const jsonStream = new JsonStreamStringify(object);
  const fileStream = createWriteStream(filePath);
  jsonStream.pipe(fileStream);

  return new Promise((resolve, reject) => {
    fileStream.on('end', () => resolve(undefined));
    fileStream.on('error', (err) => reject(err));
  });
};

export const fileSystemIndexPersistenceAdapater = (basePath: string): IndexPersistenceAdapter => ({
  load: async (name: string) => {
    if (await fileReadable(getFileName(basePath, name))) {
      try {
        const data = dynoSearchIndexSchema.parse(JSON.parse(await readFile(getFileName(basePath, name), 'utf8')));
        console.log('Loaded index from fs');
        return data;
      } catch (e) {
        console.error("Couldn't read index file from file system", e);
      }
    }
    return emptyIndex(name);
  },
  save: async (index: DynoSearchIndex) => {
    //if (await fileWritable(getFileName(basePath, index.name))) {

    try {
      const indexFile = getFileName(basePath, index.name);
      await mkdirIfNotExists(indexFile);
      await streamJsonToFile(indexFile, index);
    } catch (e) {
      console.error("Couldn't write index to file", e);
    }

    // } else {
    //   console.error('Failed to write index to file system. Destination is to writable.');
    // }
  },
  drop: async (name: string) => {
    //if (await fileWritable(getFileName(basePath, name))) {
    try {
      await unlink(getFileName(basePath, name));
    } catch (e) {
      console.error('Failed to remove index from file system', e);
    }
    // } else {
    //   console.error('Failed to remove index file from file system. Destination is to writable.');
    // }
  },
});
