const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function build() {
  console.log('Building AniStream...');

  const distDir = path.join(__dirname, '../dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }

  // 1. Run pkg
  console.log('Packaging with pkg...');
  try {
    execSync('npx pkg . --out-path dist/', { stdio: 'inherit' });
  } catch (err) {
    console.error('Packaging failed:', err.message);
    process.exit(1);
  }

  // 2. Create INSTALL.bat
  console.log('Generating INSTALL.bat...');
  const installBat = `
@echo off
echo AniStream Installer - Dependencies
echo ----------------------------------
echo This will install ani-cli via winget.
echo.
winget install ani-cli --accept-source-agreements --accept-package-agreements
if %ERRORLEVEL% EQU 0 (
  echo.
  echo ani-cli installed successfully!
) else (
  echo.
  echo Failed to install ani-cli. Please install it manually.
)
echo.
echo You can now run AniStream.exe
pause
`;
  fs.writeFileSync(path.join(distDir, 'INSTALL.bat'), installBat);

  console.log('Build complete! Find your executable and INSTALL.bat in the dist/ folder.');
}

build().catch(console.error);
