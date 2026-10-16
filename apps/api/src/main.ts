import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createApp } from './bootstrap.js';
import { readConfig } from './config.js';

loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });
const config = readConfig();
const app = await createApp(config);
await app.listen(config.API_PORT, '0.0.0.0');
