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
const baseConfig = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  coveragePathIgnorePatterns: ['/node_modules/', '/test/'],
};

module.exports = {
  collectCoverage: false,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [['lcov', { projectRoot: '../..' }]],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts'],
  projects: [
    {
      ...baseConfig,
      displayName: 'unit',
      testMatch: ['<rootDir>/**/*.spec.ts'],
      testPathIgnorePatterns: ['it.spec.ts'],
      setupFiles: ['<rootDir>/test/setupUnit.ts'],
    },
    {
      ...baseConfig,
      displayName: 'integration',
      testMatch: ['<rootDir>/**/*.it.spec.ts'],
      setupFiles: ['<rootDir>/test/setupUnit.ts'],
      setupFilesAfterEnv: ['<rootDir>/test/setupIntegration.ts'],
    },
  ],
};
