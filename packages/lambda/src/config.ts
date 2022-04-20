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
import { IndexPersistenceProvider } from './index/persistence/indexPersistenceAdapter';

const assertEnv = (name: string, defaultValue: string | undefined = undefined): string => {
  const value = process.env[name] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
};

export const config = {
  get logLevel(): string {
    return assertEnv('LOG_LEVEL', 'info');
  },
  get writeMetrics(): boolean {
    return process.env.WRITE_METRICS === 'true';
  },
  get indexName() {
    return assertEnv('INDEX_NAME');
  },
  get indexIdField() {
    return assertEnv('INDEX_ID_FIELD', 'id');
  },
  get indexFields(): string[] {
    return assertEnv('INDEX_FIELDS').split(',');
  },
  get originDynamoDbTableName() {
    return assertEnv('ORIGIN_DYNAMODB_TABLE_NAME');
  },
  get originDynamoDbPkFieldName() {
    return assertEnv('ORIGIN_DYNAMODB_PK_FIELD_NAME', 'pk');
  },
  get originDynamoDbPkPrefixes(): string[] | undefined {
    return process.env.ORIGIN_DYNAMODB_PK_PREFIXES?.split(',');
  },
  get indexDynamoDbTableName() {
    return assertEnv('INDEX_DYNAMODB_TABLE_NAME', this.originDynamoDbTableName);
  },
  get indexS3BucketName() {
    return assertEnv('INDEX_S3_BUCKET_NAME', '');
  },
  get indexPersistenceProvider(): IndexPersistenceProvider {
    const value = assertEnv('INDEX_PERSISTENCE_PROVIDER', 'noop');
    const map: Record<string, IndexPersistenceProvider> = {
      s3: 's3',
      dynamodb: 'dynamodb',
      filesystem: 'filesystem',
      efs: 'filesystem',
      noop: 'noop',
      none: 'noop',
    };
    const provider: IndexPersistenceProvider = map[value] ?? 'noop';
    return provider;
  },
  get indexFileSystemBasePath() {
    return assertEnv('INDEX_FILE_SYSTEM_BASE_PATH');
  },
  get indexArchiveS3BucketName() {
    return assertEnv('INDEX_ARCHIVE_S3_BUCKET_NAME');
  },
};
