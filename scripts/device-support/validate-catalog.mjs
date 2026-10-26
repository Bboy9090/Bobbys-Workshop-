#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalogDigest, validateCatalog } from './catalog-lib.mjs';
const path=resolve(process.argv[2] || 'resources/device-support/catalog.json');
const catalog=JSON.parse(await readFile(path,'utf8'));
const errors=validateCatalog(catalog);
if(errors.length){ console.error(errors.join('\n')); process.exit(2); }
console.log(JSON.stringify({catalogSha256:catalogDigest(catalog),entries:catalog.entries.length,executionAuthorized:false}));
