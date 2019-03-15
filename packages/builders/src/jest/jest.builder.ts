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
  jestConfig: string;
  testDirectory?: string;
  testFile?: string;
  setupFile?: string;
  tsConfig: string;
  bail?: number | boolean;
  ci?: boolean;
  color?: boolean;
  json?: boolean;
  maxWorkers?: number;
  onlyChanged?: boolean;
  outputFile?: string;
  passWithNoTests?: boolean;
  runInBand?: boolean;
  silent?: boolean;
  testNamePattern?: string;
  updateSnapshot?: boolean;
  useStderr?: boolean;
  watch?: boolean;
  watchAll?: boolean;
}

export default class JestBuilder implements Builder<JestBuilderOptions> {
  run(
    builderConfig: BuilderConfiguration<JestBuilderOptions>
  ): Observable<BuildEvent> {
    const options = builderConfig.options;

    if (options.testFile) {
      const filePath = options.testDirectory
        ? path.resolve(options.testDirectory, options.testFile)
        : realpathSync(options.testFile);

      if (filePath && !this._isInFolder(builderConfig.root, filePath)) {
        return of({
          success: true
        });
      }
    }

    const tsJestConfig = {
      tsConfig: path.join(
        '<rootDir>',
        path.relative(builderConfig.root, options.tsConfig)
      )
    };

    // TODO: This is hacky, We should probably just configure it in the user's workspace
    // If jest-preset-angular is installed, apply settings
    try {
      require.resolve('jest-preset-angular');
      Object.assign(tsJestConfig, {
        stringifyContentPathRegex: '\\.html$',
        astTransformers: [
          'jest-preset-angular/InlineHtmlStripStylesTransformer'
        ]
      });
    } catch (e) {}

    const config: any = {
      coverage: options.codeCoverage,
      bail: options.bail,
      ci: options.ci,
      color: options.color,
      json: options.json,
      maxWorkers: options.maxWorkers,
      onlyChanged: options.onlyChanged,
      outputFile: options.outputFile,
      passWithNoTests: options.passWithNoTests,
      runInBand: options.runInBand,
      silent: options.silent,
      testNamePattern: options.testNamePattern,
      updateSnapshot: options.updateSnapshot,
      useStderr: options.useStderr,
      watch: options.watch,
      watchAll: options.watchAll,
      globals: JSON.stringify({
        'ts-jest': tsJestConfig
      })
    };

    if (options.setupFile) {
      config.setupFilesAfterEnv = [
        path.join(
          '<rootDir>',
          path.relative(builderConfig.root, options.setupFile)
        )
      ];
    }

    if (options.testFile) {
      config._ = [options.testFile];
    }

    return from(runCLI(config, [options.jestConfig])).pipe(
      map((results: any) => {
        return {
          success: results.results.success
        };
      })
    );
  }

  private _isInFolder(parent: string, child: string): boolean {
    const relative = path.relative(parent, child);

    return (
      !!relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    );
  }
}
