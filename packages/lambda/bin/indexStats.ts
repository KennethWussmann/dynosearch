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

import { config } from 'dotenv';
import { readFile } from 'fs/promises';
import { dynoSearchIndexSchema } from '../src/index/dynoSearchIndex';
config();

(async () => {
  //await defaultApplicationContext.indexService.getOrLoadIndex();
  //
  //const result = await defaultApplicationContext.indexService.search({ query: '' });
  //
  //console.log(JSON.stringify(result, null, 2));

  const file = '/Users/kenneth/SynologyDrive/Development/dynosearch/packages/lambda/efs/dynosearch/test.json';

  const data = dynoSearchIndexSchema.parse(JSON.parse(await readFile(file, 'utf8')));

  console.log(Object.keys(JSON.parse(data.searchIndexData.find((part) => part.key === 'reg')?.data ?? '{}')).length);
})();
