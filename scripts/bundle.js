const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

async function bundle() {
  console.log('Bundling application with esbuild...');
  
  const entryPoint = path.join(__dirname, '..', 'src', 'main.js');
  const outfile = path.join(__dirname, '..', 'dist-bundle', 'index.js');

  if (!fs.existsSync(path.join(__dirname, '..', 'dist-bundle'))) {
    fs.mkdirSync(path.join(__dirname, '..', 'dist-bundle'));
  }

  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    target: 'es2018',
    outfile: outfile,
    external: [
      'fsevents', 
      'better-sqlite3', 
      'node:sqlite', // Exclude the problematic native module
      'child_process',
      'fs',
      'path',
      'os',
      'http',
      'https',
      'crypto',
      'stream',
      'util',
      'url',
      'zlib',
      'events',
      'net',
      'tls',
      'buffer',
      'string_decoder',
      'querystring',
      'timers'
    ],
    alias: {
      'node:sqlite': path.join(__dirname, 'empty.js')
    },
    loader: { '.html': 'text', '.css': 'text' },
    minify: false,
    sourcemap: true,
    define: {
      'process.env.NODE_ENV': '"production"'
    }
  });

  console.log('Bundle complete: dist-bundle/index.js');

  // Create a clean package.json for pkg
  const pkgConfig = {
    name: 'anistream-bundle',
    main: 'index.js',
    bin: 'index.js',
    pkg: {
      assets: [
        '../src/frontend/**/*',
        '../assets/**/*',
        '../node_modules/systray2/traybin/tray_windows_release.exe',
        '../node_modules/puppeteer-core/**/*'
      ],
      targets: ['node18-win-x64']
    }
  };

  fs.writeFileSync(
    path.join(__dirname, '..', 'dist-bundle', 'package.json'),
    JSON.stringify(pkgConfig, null, 2)
  );
  console.log('Clean package.json created in dist-bundle/');
}

bundle().catch(err => {
  console.error('Bundle failed:', err);
  process.exit(1);
});
