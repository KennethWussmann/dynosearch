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
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class DynosearchStack extends Stack {
  constructor(scope: Construct, id: string, props?: Partial<StackProps>) {
    super(scope, id, {
      stackName: 'dynosearch-test',
      description: 'Test stack for the dynosearch cdk construct',
      ...props,
    });
  }
}