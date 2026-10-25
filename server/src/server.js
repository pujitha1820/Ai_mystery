import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { loadEnv } from './config/env.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
const { default: app } = await import('./app.js');

let config;
try { config = loadEnv(); } catch (error) {
  console.error(`${error.message} Copy server/.env.example to server/.env and configure it.`);
  process.exit(1);
}
try {
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  app.listen(config.PORT, () => console.log(`AI Mystery Room API listening on port ${config.PORT}`));
} catch (error) {
  console.error(`Could not connect to MongoDB: ${error.message}`);
  process.exit(1);
}
