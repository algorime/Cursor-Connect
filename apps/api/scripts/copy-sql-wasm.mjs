import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const source = require.resolve('sql.js/dist/sql-wasm.wasm');
const destination = path.resolve('bundle/sql-wasm.wasm');

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);
