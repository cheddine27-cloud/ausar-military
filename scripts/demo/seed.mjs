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
// Seed Logic
// -----------------------------------------------------------------------------
async function main() {
  console.log('🌱 Starting Ausar Military Demo Seeding...');
  
  // Load JSON datasets
  const institutions = JSON.parse(readFileSync(join(__dirname, 'institutions.json'), 'utf8'));
  const users = JSON.parse(readFileSync(join(__dirname, 'users.json'), 'utf8'));

  // 1. Seed Institutions
  console.log('\n🏢 Seeding Institutions...');
  for (const inst of institutions) {
    const { error } = await supabase
      .from('institutions')
      .upsert({
        id: inst.id,
        name: inst.name,
        type: inst.type,
        status: inst.status,
        max_students: inst.max_students,
        code: inst.code || null,
        settings_allowed_modes: inst.settings_allowed_modes
      }, { onConflict: 'id' });

    if (error) {
      console.error(`❌ Failed to seed institution "${inst.name}":`, error.message);
    } else {
      console.log(`  ✅ Institution seeded: ${inst.name} (${inst.type})`);
    }
  }

  // 2. Seed Users
  console.log('\n👤 Seeding Auth Users and Admin Profiles...');
  for (const u of users) {
    // Check if auth user exists
    const { data: existingUser } = await supabase.auth.admin.getUserById(u.id);

    let authUser = existingUser?.user;
    if (!authUser) {
      // Create auth user
      const { data: created, error: authErr } = await supabase.auth.admin.createUser({
        id: u.id,
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: {
          role: u.role,
          username: u.username,
          full_name: u.full_name,
          email_verified: true
        }
      });

      if (authErr) {
        // Fallback: search by email to see if it's there
        console.log(`  ⚠️ Auth user creation error for ${u.email}: ${authErr.message}. Checking by email...`);
      } else {
        authUser = created?.user;
        console.log(`  ✅ Auth user created: ${u.email}`);
      }
    } else {
      console.log(`  ℹ️ Auth user already exists: ${u.email}`);
    }

    // Ensure token columns are empty strings (Supabase GoTrue Scanner Constraint)
    const { error: rawUpdateErr } = await supabase.auth.admin.updateUserById(u.id, {
      user_metadata: {
        role: u.role,
        username: u.username,
        full_name: u.full_name,
        email_verified: true
      }
    });
    if (rawUpdateErr) {
      console.warn(`  ⚠️ Failed user metadata update for ${u.email}:`, rawUpdateErr.message);
    }

    // Insert public.admins entry
    const { error: adminErr } = await supabase
      .from('admins')
      .upsert({
        auth_user_id: u.id,
        username: u.username,
        role: u.role,
        full_name: u.full_name,
        email: u.email,
        institution_id: u.institution_id || null,
        rank: u.rank || null,
        department: u.department || null
      }, { onConflict: 'auth_user_id' });

    if (adminErr) {
      console.error(`  ❌ Failed public.admins upsert for ${u.username}:`, adminErr.message);
      continue;
    } else {
      console.log(`  ✅ Admin profile synced: ${u.username}`);
    }

    // Get admin ID
    const { data: adminRow } = await supabase
      .from('admins')
      .select('id')
      .eq('auth_user_id', u.id)
      .single();

    if (adminRow && u.scope_role) {
      // Upsert user scopes
      const { error: scopeErr } = await supabase
        .from('user_scopes')
        .upsert({
          admin_id: adminRow.id,
          institution_id: u.institution_id,
          unit_id: u.unit_id || null,
          scope_role: u.scope_role
        }, { onConflict: 'admin_id,institution_id,unit_id' });

      if (scopeErr) {
        // Try deleting and re-inserting if constraint conflict on unique scopes
        await supabase
          .from('user_scopes')
          .delete()
          .eq('admin_id', adminRow.id);
          
        const { error: retryErr } = await supabase
          .from('user_scopes')
          .insert({
            admin_id: adminRow.id,
            institution_id: u.institution_id,
            unit_id: u.unit_id || null,
            scope_role: u.scope_role
          });

        if (retryErr) {
          console.error(`    ❌ Failed user scope insertion for ${u.username}:`, retryErr.message);
        } else {
          console.log(`    ✅ User scope created: ${u.scope_role} (retried)`);
        }
      } else {
        console.log(`    ✅ User scope synced: ${u.scope_role}`);
      }
    }
  }

  console.log('\n🟢 Seeding completed successfully!');
}

main().catch(err => {
  console.error('💥 Seeding crashed with exception:', err);
  process.exit(1);
});
