#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { analyzeFile, sanitizeFile } from 'core';
import fs from 'fs/promises';
import path from 'path';

yargs(hideBin(process.argv))
  .command(
    'analyze <file>',
    'Analyze a file for metadata',
    (yargs) => {
      return yargs.positional('file', {
        describe: 'Path to the file to analyze',
        type: 'string',
      });
    },
    async (argv) => {
      if (argv.file) {
        try {
          const filePath = path.resolve(argv.file);
          const buffer = await fs.readFile(filePath);
          const result = await analyzeFile(buffer);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error('Error analyzing file:', error);
        }
      }
    }
  )
  .command(
    'sanitize <file>',
    'Sanitize a file to remove metadata',
    (yargs) => {
      return yargs.positional('file', {
        describe: 'Path to the file to sanitize',
        type: 'string',
      });
    },
    async (argv) => {
      if (argv.file) {
        try {
          const filePath = path.resolve(argv.file);
          const buffer = await fs.readFile(filePath);
          const sanitizedBuffer = await sanitizeFile(buffer);

          const dir = path.dirname(filePath);
          const ext = path.extname(filePath);
          const base = path.basename(filePath, ext);
          const newFilePath = path.join(dir, `${base}.sanitized${ext}`);

          await fs.writeFile(newFilePath, sanitizedBuffer);
          console.log(`Sanitized file saved to: ${newFilePath}`);
        } catch (error) {
          console.error('Error sanitizing file:', error);
        }
      }
    }
  )
  .demandCommand(1, 'You need at least one command before moving on')
  .help().argv;
