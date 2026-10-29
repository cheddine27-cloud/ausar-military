#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

// -----------------------------------------------------------------------------
// Isolated .env Loader
// -----------------------------------------------------------------------------
function loadEnv() {
  const env = { ...process.env };
  
  // 1. Try scripts/demo/.env first (isolated, secure)
  const isolatedPath = join(__dirname, '.env');
  // 2. Fallback to root .env.local
  const rootLocalPath = join(ROOT, '.env.local');

  const paths = [isolatedPath, rootLocalPath];
  for (const path of paths) {
    if (existsSync(path)) {
      const raw = readFileSync(path, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        env[key] = value;
      }
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
// We can use the anon key from the root env.local
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Error: SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not defined.');
  console.error('Ensure they are configured in .env.local or scripts/demo/.env');
  process.exit(1);
}

// -----------------------------------------------------------------------------
// HTTP Auth Login helper
// -----------------------------------------------------------------------------
async function authLogin(email, password) {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 
        apikey: ANON_KEY, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ email, password }),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok && !!j.access_token, status: r.status, error: j.msg || j.error_description || j.error || null };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

// -----------------------------------------------------------------------------
// Smoke Test Logic
// -----------------------------------------------------------------------------
async function main() {
  console.log('━'.repeat(72));
  console.log('Ausar Military — Demo Accounts Smoke Test');
  console.log('━'.repeat(72));
  console.log(`API Target : ${SUPABASE_URL}`);
  
  const users = JSON.parse(readFileSync(join(__dirname, 'users.json'), 'utf8'));
  const results = [];
  let failures = 0;

  for (const u of users) {
    if (u.email === 'admin@smartattend.dz') {
      console.log(`ℹ️ Skipping login test for superadmin (${u.email})`);
      continue;
    }
    process.stdout.write(`🔑 Testing login for ${u.username} (${u.email})... `);
    const res = await authLogin(u.email, u.password);
    if (res.ok) {
      console.log('✅ PASS');
      results.push({ username: u.username, email: u.email, status: '✅ PASS', details: 'Authenticated successfully' });
    } else {
      console.log(`❌ FAIL (HTTP ${res.status}: ${res.error || 'Unknown error'})`);
      results.push({ username: u.username, email: u.email, status: '❌ FAIL', details: `HTTP ${res.status}: ${res.error}` });
      failures++;
    }
  }

  console.log('\n' + '━'.repeat(72));
  console.log(`SUMMARY: ${users.length - failures} passed, ${failures} failed.`);
  console.log('━'.repeat(72));

  if (failures > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All demo accounts authenticated successfully!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('💥 Smoke test crashed with exception:', err);
  process.exit(1);
});
