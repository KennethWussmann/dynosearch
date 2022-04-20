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

import { AttributeValue, DynamoDB, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, NativeAttributeValue } from '@aws-sdk/util-dynamodb';

export class OriginRepository {
  constructor(private dynamoDbClient: DynamoDB, private tableName: string, private pkFieldName: string) {}

  getAll = async (pkPrefixes: string[] | undefined = undefined): Promise<NativeAttributeValue[]> => {
    const prefixesPresent = pkPrefixes && pkPrefixes.length > 0;
    const fetch = async (
      lastEvaluatedKey: { [key: string]: AttributeValue } | undefined = undefined,
      items: NativeAttributeValue[] = [],
    ) => {
      const { Items, LastEvaluatedKey } = await this.dynamoDbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: prefixesPresent
            ? pkPrefixes.map((_, i) => `begins_with(#pk, :pkPrefix${i})`).join(' or ')
            : undefined,
          ExpressionAttributeNames: prefixesPresent
            ? {
                '#pk': this.pkFieldName,
              }
            : undefined,
          ExpressionAttributeValues: prefixesPresent
            ? marshall(Object.fromEntries(pkPrefixes.map((prefix, i) => [`:pkPrefix${i}`, prefix])))
            : undefined,
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      items.push(...(Items ?? []));

      if (LastEvaluatedKey) {
        await fetch(LastEvaluatedKey, items);
      }
      return items;
    };
    return await fetch();
  };
}
