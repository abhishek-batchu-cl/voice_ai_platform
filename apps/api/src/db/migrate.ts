import * as dotenv from 'dotenv';
import { Database } from './database';

dotenv.config();

async function migrate() {
  try {
    console.log('Running database migrations...');
    await Database.migrate();
    console.log('Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
