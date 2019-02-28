import {
  Builder,
  BuilderConfiguration,
  BuildEvent
} from '@angular-devkit/architect';

import { from, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { existsSync, readFileSync, realpathSync } from 'fs';
import * as path from 'path';

try {
  require('dotenv').config();
} catch (e) {}

const { runCLI } = require('jest');

export interface JestBuilderOptions {
  codeCoverage?: boolean;
  fileToTest?: string;
  jestConfig: string;
  pathToFileToTest?: string;
  setupFile?: string;
  tsConfig: string;
  all?: boolean;
  automock?: boolean;
  bail?: boolean | number;
  browser?: boolean;
  cache?: boolean;
  cacheDirectory?: string;
  changedFilesWithAncestor?: boolean;
  changedSince?: string;
  ci?: boolean;
  clearCache?: boolean;
  clearMocks?: boolean;
  collectCoverage?: boolean;
  collectCoverageFrom?: Array<string>;
  collectCoverageOnlyFrom?: Array<string>;
  config?: string;
  coverage?: boolean;
  coverageDirectory?: string;
  coveragePathIgnorePatterns?: Array<string>;
  coverageReporters?: Array<string>;
  coverageThreshold?: string;
  debug?: boolean;
  env?: string;
  expand?: boolean;
  findRelatedTests?: boolean;
  forceExit?: boolean;
  globals?: string;
  globalSetup?: string;
  globalTeardown?: string;
  haste?: string;
  help?: boolean;
  init?: boolean;
  json?: boolean;
  lastCommit?: boolean;
  logHeapUsage?: boolean;
  maxWorkers?: number;
  moduleDirectories?: Array<string>;
  moduleFileExtensions?: Array<string>;
  moduleLoader?: string;
  moduleNameMapper?: string;
  modulePathIgnorePatterns?: Array<string>;
  modulePaths?: Array<string>;
  name?: string;
  noSCM?: boolean;
  noStackTrace?: boolean;
  notify?: boolean;
  notifyMode?: string;
  onlyChanged?: boolean;
  outputFile?: string;
  passWithNoTests?: boolean;
  preset?: string;
  projects?: Array<string>;
  prettierPath?: string;
  replname?: string;
  resetMocks?: boolean;
  resetModules?: boolean;
  resolver?: string;
  restoreMocks?: boolean;
  rootDir?: string;
  roots?: Array<string>;
  runInBand?: boolean;
  setupFiles?: Array<string>;
  setupFilesAfterEnv?: Array<string>;
  showConfig?: boolean;
  silent?: boolean;
  snapshotSerializers?: Array<string>;
  testEnvironment?: string;
  testFailureExitCode?: string;
  testMatch?: Array<string>;
  testNamePattern?: string;
  testPathIgnorePatterns?: Array<string>;
  testPathPattern?: Array<string>;
  testRegex?: string | Array<string>;
  testResultsProcessor?: string;
  testRunner?: string;
  testURL?: string;
  timers?: 'real' | 'fake';
  transform?: string;
  transformIgnorePatterns?: Array<string>;
  unmockedModulePathPatterns?: Array<string>;
  updateSnapshot?: boolean;
  useStderr?: boolean;
  verbose?: boolean;
  version?: boolean;
  watch?: boolean;
  watchAll?: boolean;
  watchman?: boolean;
  watchPathIgnorePatterns?: Array<string>;
}

export default class JestBuilder implements Builder<JestBuilderOptions> {
  run(
    builderConfig: BuilderConfiguration<JestBuilderOptions>
  ): Observable<BuildEvent> {
    const options = builderConfig.options;
    const fileToTest = options.fileToTest;

    if (fileToTest) {
      const filePath = options.pathToFileToTest
        ? path.resolve(options.pathToFileToTest, fileToTest)
        : realpathSync(fileToTest);

      if (filePath) {
        const project = this.getProjectForFile(filePath);

        if (project && project.root !== builderConfig.root) {
          return of({
            success: true
          });
        }
      }
    }

    const config: any = {
      ...options,
      coverage: options.codeCoverage,
      globals: JSON.stringify({
        'ts-jest': {
          tsConfigFile: path.relative(builderConfig.root, options.tsConfig)
        },
        __TRANSFORM_HTML__: true
      })
    };

    delete config.codeCoverage;
    delete config.fileToTest;
    delete config.jestConfig;
    delete config.pathToFileToTest;
    delete config.setupFile;
    delete config.tsConfig;

    if (options.setupFile) {
      config.setupTestFrameworkScriptFile = path.join(
        '<rootDir>',
        path.relative(builderConfig.root, options.setupFile)
      );
    }

    if (fileToTest) {
      config._ = [fileToTest];
    }

    return from(runCLI(config, [options.jestConfig])).pipe(
      map((results: any) => {
        return {
          success: results.results.success
        };
      })
    );
  }

  private getProjectForFile(filePath: string): any {
    // Load workspace configuration file.
    const configFileNames = [
      'angular.json',
      '.angular.json',
      'workspace.json',
      '.workspace.json'
    ];
    const configFilePath = this.findUp(configFileNames, filePath);
    const angularJson = this.readJsonFile(configFilePath);
    const project = Object.values<any>(angularJson.projects).find(project =>
      this.isInFolder(
        path.resolve(configFilePath, '..', project.root),
        filePath
      )
    );

    return project;
  }

  private findUp(names: string | string[], from: string): string {
    if (!Array.isArray(names)) {
      names = [names];
    }
    const root = path.parse(from).root;

    let currentDir = from;
    while (currentDir && currentDir !== root) {
      for (const name of names) {
        const p = path.join(currentDir, name);
        if (existsSync(p)) {
          return p;
        }
      }

      currentDir = path.dirname(currentDir);
    }

    return null;
  }

  private isInFolder(parent: string, child: string): boolean {
    const relative = path.relative(parent, child);

    return (
      !!relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    );
  }

  /**
   * Read JSON file
   * @param path The path to the JSON file
   * @returns The JSON data in the file.
   */
  private readJsonFile<T = any>(path: string): T {
    const contents = readFileSync(path, { encoding: 'utf-8' });

    try {
      return JSON.parse(contents);
    } catch (e) {
      throw new Error(`Cannot parse ${path}: ${e.message}`);
    }
  }
}
