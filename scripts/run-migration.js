#!/usr/bin/env node
/**
 * Run a SQL migration file against POSTGRES_URL_NON_POOLING from .env.local
 * Usage: pnpm migrate scripts/008_add_full_screenshot_url.sql
 * If you get SSL errors with Supabase: NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm migrate scripts/008_add_full_screenshot_url.sql
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
  } catch (e) {
    return {}
  }
}

async function main() {
  const scriptPath = process.argv[2] || 'scripts/008_add_full_screenshot_url.sql'
  const root = join(__dirname, '..')
  const envPath = join(root, '.env.local')
  const env = loadEnv(envPath)
  const url = process.env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL_NON_POOLING

  if (!url) {
    console.error('Missing POSTGRES_URL_NON_POOLING. Set it or add to .env.local')
    process.exit(1)
  }

  const sqlPath = scriptPath.startsWith('/') ? scriptPath : join(root, scriptPath)
  const sql = readFileSync(sqlPath, 'utf8')

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  })
  try {
    await client.connect()
    await client.query(sql)
    console.log('Migration OK:', scriptPath)
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
