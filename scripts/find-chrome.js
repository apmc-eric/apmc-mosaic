const { execSync } = require('child_process')

try {
  const result = execSync('find /usr -name "chromium*" -type f 2>/dev/null || true').toString()
  console.log('Found chromium files:', result)
} catch(e) {}

try {
  const result = execSync('find /snap -name "chromium*" -type f 2>/dev/null || true').toString()
  console.log('Found in snap:', result)
} catch(e) {}

try {
  const result = execSync('which chromium chromium-browser google-chrome 2>/dev/null || true').toString()
  console.log('which results:', result)
} catch(e) {}

try {
  const result = execSync('ls /usr/lib/chromium* 2>/dev/null || true').toString()
  console.log('ls /usr/lib/chromium*:', result)
} catch(e) {}

try {
  const result = execSync('dpkg -l | grep -i chrom 2>/dev/null || true').toString()
  console.log('dpkg chromium packages:', result)
} catch(e) {}
