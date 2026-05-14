const { execSync } = require('child_process');

/**
 * Check if required system dependencies are installed.
 */
async function checkDependencies() {
  const status = {
    ok: true,
    anicli: false,
    mpv: false,
    missing: []
  };

  // Check ani-cli
  try {
    execSync('ani-cli --version', { stdio: 'ignore' });
    status.anicli = true;
  } catch (e) {
    status.ok = false;
    status.missing.push('ani-cli');
  }

  // Check mpv
  try {
    execSync('mpv --version', { stdio: 'ignore' });
    status.mpv = true;
  } catch (e) {
    // mpv might not be in PATH but in vendor/, but for now we check PATH
    status.ok = false;
    status.missing.push('mpv');
  }

  return status;
}

module.exports = { checkDependencies };
