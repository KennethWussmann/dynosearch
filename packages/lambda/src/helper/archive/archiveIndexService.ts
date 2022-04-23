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
import { S3 } from '@aws-sdk/client-s3';
import { format } from 'date-fns';
import { IndexService } from '../../index/indexService';

export class ArchiveIndexService {
  constructor(private indexService: IndexService, private s3Client: S3, private bucketName: string) {}

  uploadIndex = async () => {
    try {
      await this.indexService.init();
      const index = await this.indexService.exportIndexData();
      const now = new Date();
      const key = `archive/${format(now, 'yyyy/MM/dd')}/${index.name}-${now.getTime()}.json`;
      await this.s3Client.putObject({
        Key: key,
        Bucket: this.bucketName,
        Body: JSON.stringify(index),
      });
      console.log(`Uploaded index to s3://${this.bucketName}/${key}`);
    } catch (e) {
      console.error('Failed to upload index to S3', e);
    }
  };
}
