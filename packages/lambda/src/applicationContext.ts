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
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { S3 } from '@aws-sdk/client-s3';
import { config } from './config';
import { ArchiveIndexService } from './helper/archive/archiveIndexService';
import { IndexService } from './index/indexService';
import { dynamoDbIndexPersistenceAdapter } from './index/persistence/dynamoDb/dynamoDbIndexPersistenceAdapter';
import { DynamoDbIndexRepository } from './index/persistence/dynamoDb/dynamoDbIndexRepository';
import { fileSystemIndexPersistenceAdapater } from './index/persistence/fileSystem/fileSystemIndexPersistenceAdapter';
import { noopIndexPersistenceAdapter } from './index/persistence/noop/noopIndexPersistenceAdapter';
import { s3IndexPersistenceAdapter } from './index/persistence/s3/s3IndexPersistenceAdapter';
import { OriginRepository } from './origin/originRepository';

export class ApplicationContext {
  private dynamoDbClient = new DynamoDB({});
  private s3Client = new S3({});
  public dynamoDbIndexRepository = new DynamoDbIndexRepository(this.dynamoDbClient, config.indexDynamoDbTableName);
  public selectedIndexPersistenceAdapter = {
    dynamodb: () => dynamoDbIndexPersistenceAdapter(this.dynamoDbIndexRepository),
    s3: () => s3IndexPersistenceAdapter(this.s3Client, config.indexS3BucketName),
    filesystem: () => fileSystemIndexPersistenceAdapater(config.indexFileSystemBasePath),
    noop: () => noopIndexPersistenceAdapter,
  }[config.indexPersistenceProvider]();
  public originRepository = new OriginRepository(
    this.dynamoDbClient,
    config.originDynamoDbTableName,
    config.originDynamoDbPkFieldName,
  );
  public indexService = new IndexService(
    this.originRepository,
    this.selectedIndexPersistenceAdapter,
    config.indexName,
    config.indexIdField,
    config.indexFields,
  );
  public archiveIndexService = new ArchiveIndexService(
    this.indexService,
    this.s3Client,
    config.indexArchiveS3BucketName,
  );
}

export const defaultApplicationContext = new ApplicationContext();
