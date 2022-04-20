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
import { BatchWriteItemCommandInput, DynamoDB } from '@aws-sdk/client-dynamodb';
import { chunk, times } from 'lodash';
import {
  randFullName,
  randStreetAddress,
  randCountry,
  randPhoneNumber,
  randEmail,
  randPastDate,
  randColor,
  randText,
  rand,
  randUuid,
} from '@ngneat/falso';
import { marshall } from '@aws-sdk/util-dynamodb';

(async () => {
  const dynamoDb = new DynamoDB({});

  const data: { [key: string]: string }[] = times(1, () => {
    const id = randUuid();
    return {
      pk: `user#${id}`,
      sk: 'none',
      id,
      group: rand(['user', 'admin', 'moderator', 'support']),
      fullName: randFullName(),
      birthday: randPastDate().toISOString(),
      street: randStreetAddress(),
      //zipCode: randZipCode(),
      country: randCountry(),
      phoneNumber: randPhoneNumber(),
      email: randEmail(),
      //height: randNumber({ min: 100, max: 200 }),
      //weight: randNumber({ min: 50, max: 150 }),
      eyeColor: randColor(),
      biography: randText({ length: 1000 }).join(' '),
    };
  });

  const requests = chunk(data, 25).map(
    (chunk: object[]): BatchWriteItemCommandInput => ({
      RequestItems: {
        'dynosearch-test-origin-table': chunk.map((item: object) => ({
          PutRequest: {
            Item: marshall(item),
          },
        })),
      },
    }),
  );

  await Promise.all(requests.map(async (request) => await dynamoDb.batchWriteItem(request)));
  console.log('Inserted test seed');
})();
