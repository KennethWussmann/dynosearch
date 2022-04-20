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
import { AttributeValue, BatchWriteItemCommandInput, DynamoDB } from '@aws-sdk/client-dynamodb';
import { chunk } from 'lodash';
import { NativeAttributeValue } from '@aws-sdk/util-dynamodb';

const dynamoDb = new DynamoDB({});

const getAllItems = async (): Promise<NativeAttributeValue[]> => {
  const fetch = async (
    lastEvaluatedKey: { [key: string]: AttributeValue } | undefined = undefined,
    items: NativeAttributeValue[] = [],
  ) => {
    const response = await dynamoDb.scan({
      TableName: 'dynosearch-test-origin-table',
      AttributesToGet: ['pk', 'sk'],
      ExclusiveStartKey: lastEvaluatedKey,
    });

    items.push(...(response.Items ?? []));
    if (response.LastEvaluatedKey) {
      await fetch(response.LastEvaluatedKey, items);
    }
    return items;
  };
  return await fetch();
};

(async () => {
  console.log(`Scanning table ...`);

  const items = await getAllItems();

  const requests = chunk(items, 25).map(
    (chunk): BatchWriteItemCommandInput => ({
      RequestItems: {
        'dynosearch-test-origin-table': chunk.map((item) => ({
          DeleteRequest: {
            Key: item,
          },
        })),
      },
    }),
  );

  console.log(`Removing ${items.length} items in ${requests.length} requests ...`);
  await Promise.all(requests.map(async (command) => await dynamoDb.batchWriteItem(command)));
  console.log(`Removed ${items.length} items`);
})();
