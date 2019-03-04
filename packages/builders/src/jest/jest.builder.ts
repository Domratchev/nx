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
  bail?: boolean | number;
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
      globals: JSON.stringify({
        'ts-jest': {
          tsConfigFile: path.relative(builderConfig.root, options.tsConfig)
        },
        __TRANSFORM_HTML__: true
      })
    };

    if (options.setupFile) {
      config.setupTestFrameworkScriptFile = path.join(
        '<rootDir>',
        path.relative(builderConfig.root, options.setupFile)
      );
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

  protected getProjectForFile(filePath: string): any {
    // Load workspace configuration file.
    const configFileNames = [
      'angular.json',
      '.angular.json',
      'workspace.json',
      '.workspace.json'
    ];
    const configFilePath = this.findUp(configFileNames, filePath);
    const angularJson = this.readJsonFile(configFilePath);

    if (angularJson && angularJson.projects) {
      const project = Object.values<any>(angularJson.projects).find(project =>
        this.isInFolder(
          path.resolve(configFilePath, '..', project.root),
          filePath
        )
      );

      return project;
    }
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
    let jsonData = null;

    if (path && existsSync(path)) {
      const contents = readFileSync(path, { encoding: 'utf-8' });

      try {
        jsonData = JSON.parse(contents);
      } catch (e) {
        throw new Error(`Cannot parse ${path}: ${e.message}`);
      }
    }

    return jsonData;
  }
}
