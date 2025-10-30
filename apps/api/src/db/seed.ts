import * as dotenv from 'dotenv';
import { Database } from './database';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

dotenv.config();

async function seed() {
  try {
    console.log('Seeding database...');

    // Create a demo organization
    const apiKey = `vapi_${crypto.randomBytes(32).toString('hex')}`;

    const orgResult = await Database.query(
      `INSERT INTO organizations (name, api_key)
       VALUES ($1, $2)
       RETURNING id`,
      ['Demo Organization', apiKey]
    );

    const orgId = orgResult.rows[0].id;

    console.log('Created demo organization:');
    console.log('Organization ID:', orgId);
    console.log('API Key:', apiKey);
    console.log('\nSave this API key - you will need it to authenticate API requests!');

    // Create a demo assistant
    const assistantResult = await Database.query(
      `INSERT INTO assistants (
        org_id, name, first_message, system_prompt,
        voice_provider, voice_id, model_provider, model_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        orgId,
        'Customer Support Assistant',
        'Hello! I\'m your customer support assistant. How can I help you today?',
        'You are a helpful customer support assistant. Be friendly, professional, and concise. Help users with their questions and issues.',
        'elevenlabs',
        'EXAVITQu4vr4xnSDxMaL', // Sarah voice
        'openai',
        'gpt-4'
      ]
    );

    console.log('Created demo assistant:');
    console.log('Assistant ID:', assistantResult.rows[0].id);

    console.log('\nDatabase seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
