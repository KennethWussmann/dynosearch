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

import { Annotations, Aws, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { GatewayVpcEndpointAwsService, Vpc } from 'aws-cdk-lib/aws-ec2';
import { AccessPoint, FileSystem } from 'aws-cdk-lib/aws-efs';
import {
  FunctionProps,
  Function as LambdaFn,
  Runtime,
  Architecture,
  StartingPosition,
  FileSystem as LambdaFileSystem,
} from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket, BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { join } from 'path';
import { DynoSearchProps, IndexSize, LambdaType } from './dynoSearchProps';
import { EfsBastionHost } from './efsBastionHost';

const persistenceRemovalPolicy = RemovalPolicy.DESTROY;
const efsMountPath = '/mnt/efs';
export class DynoSearch extends Construct {
  public readonly indexTable: Table | undefined;
  public readonly indexBucket: Bucket | undefined;
  public readonly indexArchiveBucket: Bucket | undefined;
  public readonly indexFileSystem: FileSystem | undefined;
  public readonly indexFileSystemAccessPoint: AccessPoint | undefined;
  public readonly lambdaFunctions: Partial<Record<LambdaType, NodejsFunction>> & { index: NodejsFunction };
  public readonly vpc: Vpc | undefined;
  public readonly indexEfsBastionHost: EfsBastionHost | undefined;

  constructor(scope: Construct, id: string, private props: DynoSearchProps) {
    super(scope, id);
    const {
      helpers,
      originTable,
      persistenceProvider,
      index: { name },
      propertyOverwrites: overwrites,
      reuseIndexBucket,
      reuseIndexTable,
    } = props;
    const prefix = `dynosearch-${name}`;

    if (persistenceProvider === 'dynamodb') {
      this.indexTable =
        reuseIndexTable ??
        new Table(this, 'DynoSearchIndexTable', {
          billingMode: BillingMode.PAY_PER_REQUEST,
          removalPolicy: persistenceRemovalPolicy,
          encryption: TableEncryption.DEFAULT,
          tableName: prefix,
          ...overwrites?.indexTable,
          partitionKey: {
            name: 'pk',
            type: AttributeType.STRING,
          },
          sortKey: {
            name: 'sk',
            type: AttributeType.STRING,
          },
        });
    }
    if (persistenceProvider === 's3') {
      this.indexBucket =
        reuseIndexBucket ??
        new Bucket(this, 'DynoSearchIndexBucket', {
          bucketName: `${Aws.ACCOUNT_ID}-${prefix}-index`,
          removalPolicy: persistenceRemovalPolicy,
          enforceSSL: true,
          accessControl: BucketAccessControl.PRIVATE,
          ...overwrites?.indexBucket,
        });
      this.indexArchiveBucket = this.indexBucket;
    }
    if (persistenceProvider === 'efs' && !this.props.reuseLambdaFileSystem) {
      this.vpc = new Vpc(this, 'DynoSearchVpc', {
        vpcName: `${prefix}-vpc`,
        natGateways: 0,
        maxAzs: 2,
        gatewayEndpoints: {
          dynamodb: {
            service: GatewayVpcEndpointAwsService.DYNAMODB,
          },
          s3: {
            service: GatewayVpcEndpointAwsService.S3,
          },
        },
      });
      this.indexFileSystem = new FileSystem(this, 'DynoSearchIndexFileSystem', {
        removalPolicy: persistenceRemovalPolicy,
        encrypted: true,
        fileSystemName: prefix,
        vpc: this.vpc,
        ...overwrites?.indexFileSystem,
      });
      this.indexFileSystemAccessPoint = this.indexFileSystem.addAccessPoint('DynoSearchIndexAccessPoint', {
        createAcl: {
          ownerGid: '1000',
          ownerUid: '1000',
          permissions: '750',
        },
        posixUser: {
          gid: '1000',
          uid: '1000',
        },
        path: '/lambda',
      });
      if (this.props.efsBastionHost) {
        this.indexEfsBastionHost = new EfsBastionHost(this, 'DynoSearchEfsBastionHost', {
          indexName: this.props.index.name,
          vpc: this.vpc,
          efs: this.indexFileSystem,
        });
      }
    }
    if (typeof helpers !== 'undefined') {
      const deployDefault = typeof helpers === 'boolean' ? helpers : false;
      const deployHelpersRecord = typeof helpers === 'object' ? helpers : undefined;

      const deploySearch = deployHelpersRecord?.search ?? deployDefault;
      const deployReindex = deployHelpersRecord?.reindex ?? deployDefault;
      const deployArchive = deployHelpersRecord?.archive ?? deployDefault;

      if (deployArchive) {
        this.indexArchiveBucket =
          this.indexArchiveBucket ??
          new Bucket(this, 'DynoSearchIndexArchiveBucket', {
            bucketName: `${Aws.ACCOUNT_ID}-${prefix}-archive`,
            removalPolicy: persistenceRemovalPolicy,
            enforceSSL: true,
            accessControl: BucketAccessControl.PRIVATE,
            ...overwrites?.archiveBucket,
          });
      }

      this.lambdaFunctions = {
        search: deploySearch
          ? this.lambdaFunction(`${prefix}-search`, 'searchHandler', overwrites?.lambda?.search)
          : undefined,
        reindex: deployReindex
          ? this.lambdaFunction(`${prefix}-reindex`, 'reindexHandler', {
              ...overwrites?.lambda?.reindex,
            })
          : undefined,
        archive: deployArchive
          ? this.lambdaFunction(`${prefix}-archive`, 'archiveHandler', {
              ...overwrites?.lambda?.archive,
            })
          : undefined,
        index: this.createIndexHandler(),
      };
    } else {
      this.lambdaFunctions = {
        index: this.createIndexHandler(),
      };
    }

    if (this.lambdaFunctions?.reindex) {
      // only when we reindex we need access to the origin table directly.
      // we want minimal permissions here, because this is the production data of the construct user.
      this.props.originTable.grantReadData(this.lambdaFunctions.reindex);
    }
    if (this.lambdaFunctions?.archive && this.indexArchiveBucket) {
      this.indexArchiveBucket.grantReadWrite(this.lambdaFunctions.archive);
    }

    if (!originTable?.tableStreamArn) {
      Annotations.of(originTable).addError(
        'DynoSearch requires an origin table with a stream. Please set the stream property to StreamViewType.NEW_IMAGE.',
      );
      return;
    }
  }

  private createIndexHandler = (): NodejsFunction => {
    const indexHandler = this.lambdaFunction(`dynosearch-${this.props.index.name}-index`, 'indexHandler', {
      reservedConcurrentExecutions: 1,
      ...this.props.propertyOverwrites?.lambda?.index,
    });
    indexHandler.addEventSource(
      new DynamoEventSource(this.props.originTable, {
        startingPosition: StartingPosition.TRIM_HORIZON,
        batchSize: 1000,
        maxBatchingWindow: Duration.seconds(20),
        bisectBatchOnError: true,
        retryAttempts: 0,
        ...this.props.propertyOverwrites?.originTableEventSource,
      }),
    );
    return indexHandler;
  };

  private grantLambdaAccess = (fn: LambdaFn) => {
    this.indexTable?.grantReadWriteData(fn);
    this.indexBucket?.grantReadWrite(fn);
  };

  private lambdaFunction = (
    name: string,
    handler: string,
    functionPropsOverride: Partial<FunctionProps> = {},
  ): LambdaFn => {
    const fields = this.props.index.fields.length;
    const maxMemory = 10240;
    const defaultLambdaPropsMap: Record<IndexSize, Partial<NodejsFunctionProps>> = {
      small: { memorySize: Math.min(512 * fields, maxMemory), timeout: Duration.minutes(Math.min(1 * fields, 10)) },
      medium: { memorySize: Math.min(1024 * fields, maxMemory), timeout: Duration.minutes(Math.min(2 * fields, 10)) },
      large: { memorySize: Math.min(2048 * fields, maxMemory), timeout: Duration.minutes(Math.min(3 * fields, 10)) },
    };
    const defaultLambdaProps = defaultLambdaPropsMap[this.props.index.estimatedSize || 'medium'];

    const filesystem = this.props.reuseLambdaFileSystem
      ? this.props.reuseLambdaFileSystem
      : this.indexFileSystemAccessPoint
      ? LambdaFileSystem.fromEfsAccessPoint(this.indexFileSystemAccessPoint, efsMountPath)
      : undefined;
    const f = new NodejsFunction(this, name, {
      functionName: name,
      runtime: Runtime.NODEJS_14_X,
      entry: join(__dirname, '..', '..', 'lambda', 'src', 'index.ts'),
      handler,
      timeout: Duration.seconds(30),
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node14',
        tsconfig: 'tsconfig.json',
      },
      environment: Object.fromEntries(
        Object.entries({
          AWS_EMF_NAMESPACE: 'DynoSearch',
          AWS_EMF_SERVICE_NAME: 'dynosearch',
          NODE_OPTIONS: `--enable-source-maps --max-old-space-size=${(defaultLambdaProps.memorySize ?? 1024) / 2}`,
          LOG_LEVEL: 'debug',
          WRITE_METRICS: this.props.writeMetrics ? 'true' : 'false',
          INDEX_NAME: this.props.index.name,
          INDEX_ID_FIELD: this.props.index.id,
          INDEX_FIELDS: this.props.index.fields.join(','),
          INDEX_PERSISTENCE_PROVIDER: this.props.persistenceProvider,
          INDEX_FILE_SYSTEM_BASE_PATH: efsMountPath,
          ORIGIN_DYNAMODB_PK_FIELD_NAME: this.props.originPartitionKeyName,
          ORIGIN_DYNAMODB_PK_PREFIXES: this.props.originPartitionKeyFilter?.join(','),
          ORIGIN_DYNAMODB_TABLE_NAME: this.props.originTable.tableName,
          INDEX_DYNAMODB_TABLE_NAME: this.indexTable?.tableName,
          INDEX_S3_BUCKET_NAME: this.indexBucket?.bucketName,
          INDEX_ARCHIVE_S3_BUCKET_NAME: this.indexArchiveBucket?.bucketName,
        }).filter((entry): entry is [string, string] => !!entry[1]),
      ),
      architecture: Architecture.ARM_64,
      vpc: this.vpc,
      filesystem,
      ...defaultLambdaProps,
      ...functionPropsOverride,
    });
    this.grantLambdaAccess(f);
    return f;
  };
}
