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
import { AttributeValue, BatchWriteItemCommandInput, DynamoDB, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, NativeAttributeValue, unmarshall } from '@aws-sdk/util-dynamodb';
import { chunk, omit } from 'lodash';
import { z } from 'zod';
import { DynamoDBObject, DynamoDBObjectToDomainObject, dynamoDBZodObjectShape } from '../../../utils/dynamoDbObject';

const indexPartSchema = z
  .object({
    id: z.string(),
    data: z.string(),
    name: z.string(),
    updatedAt: z.string(),
    ...dynamoDBZodObjectShape,
  })
  .passthrough();

type IndexPartEntity = z.infer<typeof indexPartSchema>;
type IndexPart = DynamoDBObjectToDomainObject<IndexPartEntity>;
type Index = IndexPart[];

export class DynamoDbIndexRepository {
  constructor(private dynamoDbClient: DynamoDB, private tableName: string) {}

  private keyMap = (indexName: string, id: string): Pick<IndexPartEntity, 'pk' | 'sk'> => ({
    pk: `dynosearch-index#${indexName}`,
    sk: id,
  });

  public drop = async (indexName: string): Promise<void> => {
    const index = await this.getIndex(indexName);
    const requests = chunk(index, 25).map(
      (chunk): BatchWriteItemCommandInput => ({
        RequestItems: {
          [this.tableName]: chunk.map((item) => ({
            DeleteRequest: {
              Key: marshall(this.keyMap(item.name, item.id)),
            },
          })),
        },
      }),
    );
    await Promise.all(requests.map(async (command) => await this.dynamoDbClient.batchWriteItem(command)));
  };

  public getIndex = async (indexName: string): Promise<Index | undefined> => {
    const fetch = async (
      lastEvaluatedKey: { [key: string]: AttributeValue } | undefined = undefined,
      parts: IndexPart[] = [],
    ) => {
      const { Items, LastEvaluatedKey } = await this.dynamoDbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: marshall({
            ':pk': this.keyMap(indexName, 'none').pk,
          }),
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );
      parts.push(...(Items?.map((item) => DynamoDbIndexRepository.toIndexPart(unmarshall(item))) ?? []));

      if (LastEvaluatedKey) {
        await fetch(LastEvaluatedKey, parts);
      }
      return parts;
    };
    return await fetch();
  };

  public save = async (index: Omit<IndexPart, 'updatedAt'>): Promise<IndexPart> => {
    const fullIndexPart: IndexPart = {
      ...index,
      updatedAt: new Date().toISOString(),
    };
    const input: DynamoDBObject<IndexPart> = {
      ...this.keyMap(index.name, index.id),
      ...fullIndexPart,
    };

    const result = await this.dynamoDbClient.putItem({
      TableName: this.tableName,
      Item: marshall(input, { removeUndefinedValues: true }),
    });

    if (result.$metadata.httpStatusCode !== 200) {
      throw new Error('Failed to save index');
    }

    return fullIndexPart;
  };

  public static toIndexPart = (index: NativeAttributeValue): IndexPart =>
    omit(indexPartSchema.parse(index), ['pk', 'sk']);
}
