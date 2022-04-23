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

import { defaultApplicationContext } from '../applicationContext';

export const reindexHandler = async (pkPrefixes: string[] | undefined) => {
  const { indexService } = defaultApplicationContext;
  console.log('Starting entire reindex of all pks starting with', pkPrefixes);
  await indexService.init();
  await indexService.reindex(pkPrefixes);
  console.log('Finished reindexing and exported index');
};
