# Setup Guide

## Step-by-Step Installation

### 1. System Requirements

- Node.js 18+ ([Download](https://nodejs.org))
- PostgreSQL 14+ ([Download](https://www.postgresql.org/download/))
- Git
- A code editor (VS Code recommended)

### 2. Get API Keys

#### OpenAI (Required)
1. Go to https://platform.openai.com
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Save it securely

#### ElevenLabs (Optional)
1. Go to https://elevenlabs.io
2. Sign up for free account
3. Navigate to Profile → API Keys
4. Copy your API key
5. Free tier includes 10,000 characters/month

### 3. Install PostgreSQL

#### macOS (Homebrew)
```bash
brew install postgresql@14
brew services start postgresql@14

# Create database
createdb voice_ai
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
sudo -u postgres createdb voice_ai
```

#### Windows
1. Download installer from https://www.postgresql.org/download/windows/
2. Run installer and follow prompts
3. Remember your postgres password
4. Use pgAdmin or command line to create database:
```sql
CREATE DATABASE voice_ai;
```

### 4. Clone and Install

```bash
# Navigate to your projects folder
cd ~/projects

# If you don't have the code yet, it's in /Users/abhishekbatchu/voice-ai-platform
cd /Users/abhishekbatchu/voice-ai-platform

# Install dependencies
npm install
```

### 5. Configure Environment

```bash
cd apps/api
cp .env.example .env
```

Edit `apps/api/.env`:

```env
# Database - Update with your credentials
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/voice_ai

# OpenAI - Required
OPENAI_API_KEY=sk-proj-xxxxx

# ElevenLabs - Optional but recommended for better voices
ELEVENLABS_API_KEY=your_elevenlabs_key

# Server ports - Usually don't need to change
PORT=3000
WS_PORT=8080
NODE_ENV=development
```

### 6. Initialize Database

```bash
# Still in apps/api directory
npm run migrate
```

You should see:
```
Running database migrations...
Database migration completed successfully
```

### 7. Seed Demo Data

```bash
npm run seed
```

**IMPORTANT**: Copy the API key shown in the output! You'll need it to access the dashboard.

Example output:
```
Created demo organization:
Organization ID: 123e4567-e89b-12d3-a456-426614174000
API Key: vapi_a1b2c3d4e5f6...

Save this API key - you will need it to authenticate API requests!
```

### 8. Start Development Servers

```bash
# Go back to root directory
cd ../..

# Start both API and Dashboard
npm run dev
```

You should see:
```
🚀 API server running on http://localhost:3000
📊 Health check: http://localhost:3000/health
🔌 WebSocket server running on ws://localhost:8080

VITE v5.0.12  ready in 500 ms
➜  Local:   http://localhost:5173/
```

### 9. Access Dashboard

1. Open http://localhost:5173 in your browser
2. You'll see "Welcome to Voice AI Platform"
3. Paste the API key from step 7
4. Click "Continue"

### 10. Create Your First Assistant

1. Click "Create New Assistant" or go to "Assistants" → "Create Assistant"
2. Fill in the form:
   - **Name**: "My First Assistant"
   - **First Message**: "Hello! How can I help you today?"
   - **System Prompt**: "You are a helpful assistant. Be friendly and concise."
   - **Model Provider**: OpenAI
   - **Model**: gpt-4 (or gpt-3.5-turbo for faster/cheaper)
   - **Voice Provider**: elevenlabs (if you have key) or openai
   - **Voice ID**:
     - ElevenLabs: `EXAVITQu4vr4xnSDxMaL` (Sarah)
     - OpenAI: `alloy`
3. Click "Create"

### 11. Test Your Assistant

1. From the assistants list, click "Test" next to your assistant
2. Click "Start Session"
3. Type a message and press Enter
4. You should see the assistant's response
5. If using ElevenLabs or OpenAI TTS, audio will play automatically

## Verification Checklist

✅ PostgreSQL is running
```bash
pg_isready
# Should output: accepting connections
```

✅ Database exists
```bash
psql -l | grep voice_ai
# Should show voice_ai database
```

✅ API server is running
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

✅ WebSocket is running
```bash
# Should not give connection refused
curl -I http://localhost:8080
```

✅ Dashboard is accessible
```bash
curl http://localhost:5173
# Should return HTML
```

## Common Setup Issues

### Issue: `npm install` fails

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Database connection failed

**Solution**:
```bash
# Check PostgreSQL is running
brew services list  # macOS
sudo systemctl status postgresql  # Linux

# Test connection manually
psql -U postgres -d voice_ai

# Check DATABASE_URL in .env matches your setup
```

### Issue: Port already in use

**Solution**:
```bash
# Find what's using the port
lsof -i :3000  # Check API port
lsof -i :8080  # Check WebSocket port
lsof -i :5173  # Check Dashboard port

# Kill the process or change port in .env and vite.config.ts
```

### Issue: API key not working

**Solution**:
```bash
# Generate a new API key
cd apps/api
npm run seed

# Or query database
psql voice_ai -c "SELECT api_key FROM organizations;"
```

### Issue: OpenAI API errors

**Solutions**:
- Verify API key is correct
- Check you have credits: https://platform.openai.com/usage
- Ensure no extra spaces in .env file
- Try using gpt-3.5-turbo instead of gpt-4

### Issue: ElevenLabs errors

**Solutions**:
- Verify API key is correct
- Check quota: https://elevenlabs.io/subscription
- Try using OpenAI TTS instead (set voice_provider to 'openai')

### Issue: Audio not playing

**Solutions**:
- Check browser console for errors
- Ensure you're using Chrome, Firefox, or Safari (latest version)
- Check system volume is not muted
- Try a different browser

## Development Tips

### Resetting Database

```bash
# Drop and recreate
dropdb voice_ai
createdb voice_ai

# Run migrations and seed
cd apps/api
npm run migrate
npm run seed
```

### Viewing Logs

```bash
# API logs are in terminal where you ran npm run dev
# Look for any ERROR messages

# Database logs (macOS with Homebrew)
tail -f /opt/homebrew/var/log/postgresql@14.log
```

### Testing API Manually

```bash
# Get your API key from dashboard or database
export API_KEY="vapi_..."

# Test creating assistant
curl -X POST http://localhost:3000/api/v1/assistants \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Test Bot",
    "system_prompt": "You are helpful",
    "voice_provider": "openai",
    "voice_id": "alloy",
    "model_provider": "openai",
    "model_name": "gpt-3.5-turbo"
  }'
```

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update all packages
npm update

# Update specific package
npm install package-name@latest
```

## Next Steps

After successful setup:

1. ✅ Create multiple assistants with different personalities
2. ✅ Test different voice providers and models
3. ✅ Experiment with system prompts
4. ✅ Try different temperature settings
5. ✅ Build a custom integration using the API

## Getting Help

If you're still stuck:

1. Check the main README.md for troubleshooting
2. Review error messages in terminal
3. Check browser console (F12) for frontend errors
4. Verify all environment variables are set correctly
5. Try the setup from scratch in a new directory

## Production Deployment

For production deployment, see DEPLOYMENT.md (coming soon).

Key considerations:
- Use environment variables for secrets
- Set up SSL/TLS for HTTPS and WSS
- Use a process manager (PM2, systemd)
- Set up proper PostgreSQL backups
- Implement monitoring and logging
- Use a reverse proxy (nginx, Caddy)
- Consider using Docker for easier deployment
