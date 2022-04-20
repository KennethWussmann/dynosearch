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
import { SearchOptions } from '../index/indexService';

export const searchHandler = async (input: SearchOptions) => {
  const { indexService } = defaultApplicationContext;
  const result = await indexService.search(input);
  const resultJson = JSON.stringify(result, null, 2);
  console.log(resultJson);
  return resultJson;
};
