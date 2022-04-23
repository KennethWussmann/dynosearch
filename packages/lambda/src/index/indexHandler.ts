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
import { Record } from './indexService';

export const indexHandler = async (event: DynamoDBStreamEvent) => {
  const { indexService } = defaultApplicationContext;
  await indexService.init();
  const recordsToIndex = event.Records.map((record) => {
    const newImage = record.dynamodb?.NewImage;
    if (record) {
      return {
        record: newImage,
        event: record.eventName,
      };
    } else {
      return undefined;
    }
  }).filter((record): record is Record => !!record);

  if (recordsToIndex.length === 0) {
    return;
  }

  const { success, skipped } = await indexService.indexRecords(recordsToIndex);
  console.log(`Indexed ${success} of ${recordsToIndex.length} records and skipped ${skipped}.`);

  if (success > 0) {
    await indexService.persist();
    console.log('Exported index');
  }
};
