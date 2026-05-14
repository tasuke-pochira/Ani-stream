// Polyfill for Node 18 compatibility with modern libraries
if (typeof global.File === 'undefined') {
  const { Blob } = require('buffer');
  global.File = class File extends Blob {
    constructor(parts, filename, options = {}) {
      super(parts, options);
      this.name = filename;
      this.lastModified = options.lastModified || Date.now();
    }
  };
}

const { server } = require('./server');
const { initTray } = require('./tray');
const settings = require('./services/settings');
const open = require('open');

const PORT = settings.get('port') || 6969;
const path = require('path');

async function main() {
  // Inject portable vendor paths if they exist
  const baseDir = process.pkg ? path.dirname(process.execPath) : process.cwd();
  const vendorDir = path.join(baseDir, 'vendor');
  
  if (require('fs').existsSync(vendorDir)) {
    const folders = [
      path.join(vendorDir, 'git', 'usr', 'bin'),
      path.join(vendorDir, 'git', 'mingw64', 'bin'),
      path.join(vendorDir, 'mpv'),

      path.join(vendorDir, 'fzf'),
      path.join(vendorDir, 'ani-cli')
    ];
    
    folders.forEach(f => {
      if (require('fs').existsSync(f)) {
        console.log(`Injecting portable PATH: ${f}`);
        process.env.PATH = `${f}${path.delimiter}${process.env.PATH}`;
      }
    });
  }

  // Dependency check (will be implemented in scripts/setup.js)
  console.log('Starting AniStream...');
  
  const anicli = require('./services/anicli');
  // Trigger update in background so it doesn't block startup
  anicli.updateAniCli();
  
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Server listening at http://localhost:${PORT}`);
    
    // Launch tray icon
    try {
      initTray(PORT);
    } catch (e) {
      console.warn('Tray icon failed to start:', e.message);
    }

    // Open browser on first run
    if (settings.get('firstRun')) {
      open(`http://localhost:${PORT}`);
      settings.set('firstRun', false);
    }
  });
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
