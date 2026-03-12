import { execSync } from 'child_process'
import fs from 'fs'

const paths = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/local/bin/chromium',
]

for (const p of paths) {
  if (fs.existsSync(p)) {
    console.log(`Found Chrome at: ${p}`)
    try {
      const version = execSync(`${p} --version 2>&1`).toString().trim()
      console.log(`Version: ${version}`)
    } catch (e) {
      console.log('Could not get version')
    }
  }
}

// Try which
try {
  const which = execSync('which google-chrome chromium chromium-browser 2>&1').toString().trim()
  console.log('which result:', which)
} catch {
  console.log('No chrome found via which')
}

// Try apt list
try {
  const apt = execSync('apt list --installed 2>/dev/null | grep -i chrom').toString().trim()
  console.log('apt chromium packages:', apt)
} catch {
  console.log('apt check failed')
}

// Install chromium if not found
console.log('\nAttempting to install chromium...')
try {
  execSync('apt-get install -y chromium 2>&1', { stdio: 'inherit' })
  console.log('Installed chromium')
} catch {
  try {
    execSync('apt-get install -y chromium-browser 2>&1', { stdio: 'inherit' })
    console.log('Installed chromium-browser')
  } catch (e) {
    console.log('Install failed:', e.message)
  }
}
