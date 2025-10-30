import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export class Database {
  private static pool: Pool;

  static initialize() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });
  }

  static getPool(): Pool {
    if (!this.pool) {
      this.initialize();
    }
    return this.pool;
  }

  static async query(text: string, params?: any[]) {
    const pool = this.getPool();
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  static async migrate() {
    const pool = this.getPool();

    // Run migrations in order
    const migrations = [
      'schema.sql',
      'schema-v2.sql',
      'schema-v3.sql',
      'schema-v4-users.sql',
      'schema-v5-rate-limits.sql',
      'schema-v6-phone-enhancements.sql',
      'schema-v7-tools.sql',
    ];

    try {
      for (const migrationFile of migrations) {
        const migrationPath = path.join(__dirname, migrationFile);

        if (fs.existsSync(migrationPath)) {
          console.log(`Running migration: ${migrationFile}`);
          const schema = fs.readFileSync(migrationPath, 'utf8');
          await pool.query(schema);
          console.log(`✓ ${migrationFile} completed`);
        }
      }

      console.log('All database migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  static async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}
