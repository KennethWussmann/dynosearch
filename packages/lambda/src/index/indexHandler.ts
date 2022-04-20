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
import type { DynamoDBStreamEvent } from 'aws-lambda';
import { defaultApplicationContext } from '../applicationContext';

export const indexHandler = async (event: DynamoDBStreamEvent) => {
  const { indexService } = defaultApplicationContext;
  let indexedItems = 0;
  await Promise.all(
    event.Records.map(async (record) => {
      if (!record.dynamodb?.NewImage || record.eventName !== 'INSERT') {
        return;
      }
      const result = await indexService.indexRecord(record.dynamodb.NewImage);
      if (result) {
        indexedItems++;
      }
    }),
  );

  console.log(`Indexed ${indexedItems} of ${event.Records.length} records.`);

  if (indexedItems > 0) {
    await indexService.persist();
    console.log('Exported index');
  }
};
