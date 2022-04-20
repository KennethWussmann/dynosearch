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

import { Table, TableProps } from 'aws-cdk-lib/aws-dynamodb';
import { FileSystemProps } from 'aws-cdk-lib/aws-efs';
import { FileSystem } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSourceProps } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket, BucketProps } from 'aws-cdk-lib/aws-s3';

/**
 * search: Search through the index
 * reindex: Reindex the originTable. Recreates the entire index by scanning though the entire origin table and reindexing all entries.
 * archive: Archive the existing index by copying it to S3. When S3 is used as PersistenceProvider it will be copyied to another directory. If not, a new S3 bucket will be created especially for the archive.
 */
export type HelperLambdaType = 'search' | 'reindex' | 'archive';
export type LambdaType = 'index' | HelperLambdaType;
export type IndexSize = 'small' | 'medium' | 'large';
export type PersistenceProvider = 's3' | 'dynamodb' | 'efs' | 'none';

export type IndexProps = {
  /**
   * Unique name of the index.
   */
  name: string;
  /**
   * The name of the ID field.
   * Every indexed document needs a unique identifier. This is the name of the field where to retrieve this unique identifier.
   */
  id: string;
  /**
   * Fields to index from a document.
   * Notice that a change of the fields will not automatically trigger a reindex. Only new or updated documents will have the new fields indexed.
   * Trigger a reindex manually by calling the `reindex` function if you need all documents reindexed.
   * Nested fields can be declared with colons, e.g. `nested:field`. Nested array fields can be declared with brackets, e.g. `array[]:field`.
   */
  fields: string[];
  /**
   * The index size helps to preconfigure the AWS resources to account for the index size.
   * Based on the preset and other measures resources will be dynamically calculated and provisioned accordingly.
   * You can switch the index size at any time. Tip: Use the metrics provided by DynoSearch to estimate your index size.
   * @default medium
   */
  estimatedSize?: IndexSize;
};

export type DynoSearchPropOverwrites = {
  /**
   * Overwrite properties of the event source that triggers a lambda on origin table updates.
   */
  originTableEventSource?: Partial<DynamoEventSourceProps>;
  /**
   * Overwrite properties of the table where the index is stored when persistenceProvider is set to `dynamodb`.
   */
  indexTable?: Partial<TableProps>;
  /**
   * Overwrite properties of the bucket where the index is stored when persistenceProvider is set to `s3`.
   */
  indexBucket?: Partial<BucketProps>;
  /**
   * Overwrite properties of the archive bucket where index archives are saved when persistenceProvider is NOT set to `s3`.
   */
  archiveBucket?: Partial<BucketProps>;
  /**
   * Overwrite properties of the EFS FileSystem where the index is stored when persistenceProvider is set to `efs`.
   */
  indexFileSystem?: Partial<FileSystemProps>;
  /**
   * Overwrite properties of all individual lambda functions that are deployed.
   * This may be necessary to tweak for best performance.
   */
  lambda?: Partial<Record<LambdaType, Partial<NodejsFunctionProps>>>;
};

export type DynoSearchProps = {
  /**
   * Options for the index.
   */
  index: IndexProps;
  /**
   * Where to persist the index data.
   * Required ressources will be created automatically.
   */
  persistenceProvider: PersistenceProvider;
  /**
   * The table to build the index from.
   */
  originTable: Table;
  /**
   * The name of the [originTable]'s PartitionKey attribute.
   */
  originPartitionKeyName: string;
  /**
   * Only index DynamoDB entries with PartiionKeys that start with this prefix.
   * @optional
   * @default undefined = Index all entries
   */
  originPartitionKeyFilter?: string[] | undefined;
  /**
   * Deploy lambda functions that allow to search & maintain the index. They don't have a trigger by default.
   * @optional
   * @default false
   */
  helpers?: Partial<Record<HelperLambdaType, boolean>> | boolean;
  /**
   * When using EFS as storage option the file system gets deployed in an private VPC which is not accessible from the internet.
   * This option allows to optionally deploy a small EC2 instance that acts as a bastion host.
   * Using SSM to connect securily via IAM to the bastion host, the EFS file system can be mounted.
   *
   * The EFS will be mounted automatically under `mnt/dynosearch-<index-name>-efs/`
   * @optional
   * @default false
   */
  efsBastionHost?: boolean;
  /**
   * Enable detailed performance and maintenance metrics to be written to CloudWatch.
   * @optional
   * @default false
   */
  writeMetrics?: boolean;
  /**
   * Existing table to persist the index to.
   * While not encouraged, you could strive for a one table design like this to save the index along with the origin data.
   * Not encouraged, because this might cause confusion and conflicts when not used with special care!
   * @optional
   * @default none = Create new index table when needed
   */
  reuseIndexTable?: Table;
  /**
   * Existing bucket to persist the index to.
   * @optional
   * @default none = Create new bucket when needed
   */
  reuseIndexBucket?: Bucket;
  /**
   * Wire an existing EFS FileSystem to persist the index to.
   * @optional
   * @default none = Create new EFS FileSystem, AccessPoint and mounts it when needed
   */
  reuseLambdaFileSystem?: FileSystem;
  /**
   * Overwrite default property values.
   * Usually you don't need to overwrite these, but for larger indcies this might be usuful.
   * Can be used to increase the Lambda memory for example.
   * @optional
   */
  propertyOverwrites?: DynoSearchPropOverwrites;
};
