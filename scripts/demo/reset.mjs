#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

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
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined.');
  console.error('Please configure them in scripts/demo/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// -----------------------------------------------------------------------------
// Reset Logic
// -----------------------------------------------------------------------------
async function main() {
  console.log('🧹 Starting Ausar Military Demo Reset...');
  
  // Load JSON datasets
  const institutions = JSON.parse(readFileSync(join(__dirname, 'institutions.json'), 'utf8'));
  const users = JSON.parse(readFileSync(join(__dirname, 'users.json'), 'utf8'));

  const userIds = users.map(u => u.id);
  const instIds = institutions.map(i => i.id);

  // 1. Delete user scopes
  console.log('\n🗑 Deleting User Scopes...');
  // Find admins corresponding to the users
  const { data: adminRows } = await supabase
    .from('admins')
    .select('id')
    .in('auth_user_id', userIds);

  if (adminRows && adminRows.length > 0) {
    const adminIds = adminRows.map(a => a.id);
    const { error: scopeErr } = await supabase
      .from('user_scopes')
      .delete()
      .in('admin_id', adminIds);

    if (scopeErr) {
      console.error('❌ Failed to delete user scopes:', scopeErr.message);
    } else {
      console.log(`  ✅ Deleted user scopes for ${adminIds.length} admins.`);
    }
  } else {
    console.log('  ℹ️ No scopes found to delete.');
  }

  // 2. Delete public.admins
  console.log('\n🗑 Deleting Admin Profiles...');
  const { error: adminErr } = await supabase
    .from('admins')
    .delete()
    .in('auth_user_id', userIds);

  if (adminErr) {
    console.error('❌ Failed to delete admin profiles:', adminErr.message);
  } else {
    console.log(`  ✅ Deleted ${userIds.length} admin profiles.`);
  }

  // 3. Delete auth.users
  console.log('\n🗑 Deleting Auth Users...');
  for (const uid of userIds) {
    const { error: authErr } = await supabase.auth.admin.deleteUser(uid);
    if (authErr) {
      if (authErr.message.includes('User not found')) {
        console.log(`  ℹ️ Auth user already deleted: ${uid}`);
      } else {
        console.error(`  ❌ Failed to delete auth user ${uid}:`, authErr.message);
      }
    } else {
      console.log(`  ✅ Auth user deleted: ${uid}`);
    }
  }

  // 4. Delete public.institutions
  console.log('\n🗑 Deleting Institutions...');
  const { error: instErr } = await supabase
    .from('institutions')
    .delete()
    .in('id', instIds);

  if (instErr) {
    console.error('❌ Failed to delete institutions:', instErr.message);
  } else {
    console.log(`  ✅ Deleted ${instIds.length} institutions.`);
  }

  console.log('\n🟢 Reset completed successfully!');
}

main().catch(err => {
  console.error('💥 Reset crashed with exception:', err);
  process.exit(1);
});
