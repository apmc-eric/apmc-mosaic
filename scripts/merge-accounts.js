#!/usr/bin/env node
/**
 * Merge two user accounts that belong to the same person across different email domains.
 *
 * Usage (dry run first — recommended):
 *   node scripts/merge-accounts.js --keep eric@aparentmedia.com --remove eric@kidoodle.tv --dry-run
 *
 * When you're happy with the output, run for real:
 *   node scripts/merge-accounts.js --keep eric@aparentmedia.com --remove eric@kidoodle.tv
 *
 * What it does:
 *   1. Finds both auth users by email
 *   2. Reassigns the Google token from --remove to --keep
 *   3. Deletes the --remove auth user (and its profile, cascade)
 *
 * All other data (posts, tickets, comments, etc.) already belongs to --keep
 * because that's the account you've been using.
 */

const { readFileSync } = require('fs')
const { join } = require('path')
const { Client } = require('pg')

function loadEnv(path) {
  try {
    const content = readFileSync(path, 'utf8')
    const env = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const eq = trimmed.indexOf('=')
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim()
          let val = trimmed.slice(eq + 1).trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
            val = val.slice(1, -1).replace(/\\n/g, '\n')
          env[key] = val
        }
      }
    }
    return env
  } catch {
    return {}
  }
}

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag) => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] : null
  }
  return {
    keep: get('--keep'),
    remove: get('--remove'),
    dryRun: args.includes('--dry-run'),
  }
}

async function main() {
  const { keep, remove, dryRun } = parseArgs()

  if (!keep || !remove) {
    console.error('Usage: node scripts/merge-accounts.js --keep <email> --remove <email> [--dry-run]')
    process.exit(1)
  }

  if (keep === remove) {
    console.error('--keep and --remove must be different emails')
    process.exit(1)
  }

  const root = join(__dirname, '..')
  const env = loadEnv(join(root, '.env.local'))
  const url = process.env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL_NON_POOLING

  if (!url) {
    console.error('Missing POSTGRES_URL_NON_POOLING in .env.local')
    process.exit(1)
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    // 1. Look up both auth users
    const { rows: keepRows } = await client.query(
      `SELECT id, email FROM auth.users WHERE email = $1`, [keep]
    )
    const { rows: removeRows } = await client.query(
      `SELECT id, email FROM auth.users WHERE email = $1`, [remove]
    )

    if (keepRows.length === 0) {
      console.error(`No auth user found for --keep: ${keep}`)
      process.exit(1)
    }
    if (removeRows.length === 0) {
      console.error(`No auth user found for --remove: ${remove}`)
      process.exit(1)
    }

    const keepId = keepRows[0].id
    const removeId = removeRows[0].id

    console.log(`\nKeep  : ${keep} (id: ${keepId})`)
    console.log(`Remove: ${remove} (id: ${removeId})`)

    // 2. Check what data the remove account owns
    const tables = [
      { table: 'profiles', col: 'id' },
      { table: 'user_google_tokens', col: 'user_id' },
      { table: 'user_teams', col: 'user_id' },
    ]

    for (const { table, col } of tables) {
      const { rows } = await client.query(
        `SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = $1`, [removeId]
      )
      console.log(`  ${table}: ${rows[0].n} row(s) owned by --remove`)
    }

    // 3. Check if --keep already has a Google token
    const { rows: keepToken } = await client.query(
      `SELECT id FROM user_google_tokens WHERE user_id = $1`, [keepId]
    )
    const { rows: removeToken } = await client.query(
      `SELECT id, access_token, refresh_token, token_expires_at FROM user_google_tokens WHERE user_id = $1`, [removeId]
    )

    if (dryRun) {
      console.log('\n--- DRY RUN (no changes made) ---')
      if (removeToken.length > 0 && keepToken.length === 0) {
        console.log('Would reassign Google token from --remove to --keep')
      } else if (removeToken.length > 0 && keepToken.length > 0) {
        console.log('Both accounts have Google tokens — would overwrite --keep token with --remove token')
      } else {
        console.log('--remove has no Google token, nothing to reassign')
      }
      console.log(`Would delete auth user ${removeId} (${remove}) and cascade their profile`)
      console.log('\nRun without --dry-run to apply.')
      return
    }

    // 4. Reassign Google token if present
    if (removeToken.length > 0) {
      if (keepToken.length > 0) {
        console.log('\nOverwriting existing Google token on --keep with --remove token...')
        await client.query(
          `UPDATE user_google_tokens
           SET access_token = $1, refresh_token = $2, token_expires_at = $3, updated_at = NOW()
           WHERE user_id = $4`,
          [removeToken[0].access_token, removeToken[0].refresh_token, removeToken[0].token_expires_at, keepId]
        )
        await client.query(`DELETE FROM user_google_tokens WHERE user_id = $1`, [removeId])
      } else {
        console.log('\nReassigning Google token to --keep...')
        await client.query(
          `UPDATE user_google_tokens SET user_id = $1, updated_at = NOW() WHERE user_id = $2`,
          [keepId, removeId]
        )
      }
      console.log('Google token reassigned.')
    } else {
      console.log('\nNo Google token on --remove account, skipping token reassignment.')
    }

    // 5. Delete the remove auth user (cascades to profiles, user_teams, etc.)
    console.log(`\nDeleting auth user ${removeId} (${remove})...`)
    await client.query(`DELETE FROM auth.users WHERE id = $1`, [removeId])
    console.log('Done. Account merged successfully.')
    console.log(`\nYou can now sign in with Google (${remove}) and it will be linked to ${keep}.`)

  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
