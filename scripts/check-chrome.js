import { execSync } from 'child_process'
import { existsSync } from 'fs'

const paths = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/local/bin/chromium',
]

console.log('Checking for Chromium installations...')
for (const p of paths) {
  console.log(`${p}: ${existsSync(p) ? 'FOUND' : 'not found'}`)
}

// Try which
try {
  const result = execSync('which chromium || which chromium-browser || which google-chrome 2>/dev/null', { encoding: 'utf8' })
  console.log('Found via which:', result.trim())
} catch {
  console.log('None found via which')
}

// Check if puppeteer (full) is available - it bundles Chromium
try {
  execSync('node -e "require(\'puppeteer\')"', { encoding: 'utf8' })
  console.log('puppeteer (full) is available')
} catch {
  console.log('puppeteer (full) not available')
}

// Try installing chromium via apt
try {
  console.log('Attempting: apt-get install -y chromium...')
  execSync('apt-get install -y chromium 2>&1 | tail -5', { encoding: 'utf8', stdio: 'pipe' })
  console.log('chromium installed successfully')
} catch (e) {
  console.log('apt install failed:', e.message?.slice(0, 200))
}

// Check again
for (const p of paths) {
  console.log(`After install - ${p}: ${existsSync(p) ? 'FOUND' : 'not found'}`)
}
