import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function getTargetTriple() {
  // Priority 1: Environment variable set by Tauri CLI
  if (process.env.TAURI_ENV_TARGET_TRIPLE) {
    return process.env.TAURI_ENV_TARGET_TRIPLE;
  }
  // Priority 2: Try to get it from rustc (host triple as fallback)
  try {
    const output = execSync('rustc -vV').toString();
    const hostLine = output.split('\n').find(line => line.startsWith('host:'));
    return hostLine ? hostLine.split(':')[1].trim() : null;
  } catch (e) {
    console.error('Failed to determine target triple via rustc. Ensure Rust is installed.');
    process.exit(1);
  }
}

const triple = getTargetTriple();
const isWindows = process.platform === 'win32';
const ext = isWindows ? '.exe' : '';

console.log(`Target Triple: ${triple}`);

// Check if building for desktop platform
const isDesktop = triple && !triple.includes('android') && !triple.includes('ios') && !triple.includes('wasm') && !triple.includes('mobile');
if (!isDesktop) {
  console.log('Skipping sidecar builds for non-desktop platform.');
  process.exit(0);
}

// 1. Build Bun Sidecar
const bunDir = path.join(rootDir, 'src-sidecars', 'src-bun');
console.log('Building Bun sidecar...');
try {
  execSync('bun install', { cwd: bunDir, stdio: 'inherit' });
  execSync(`bun build --compile ./index.ts --outfile ./bun-sidecar`, { cwd: bunDir, stdio: 'inherit' });
  
  const src = path.join(bunDir, `bun-sidecar${ext}`);
  const dst = path.join(bunDir, `bun-sidecar-${triple}${ext}`);
  
  if (fs.existsSync(dst)) fs.unlinkSync(dst);
  fs.renameSync(src, dst);
  console.log(`Bun sidecar built: ${dst}`);
} catch (e) {
  console.warn('Skipping Bun sidecar build (Bun might not be installed).');
}

// 2. Build Python Sidecar
const pythonDir = path.join(rootDir, 'src-sidecars', 'src-python');
console.log('Building Python sidecar...');
try {
  // Using pyinstaller
  execSync(`pip install pyinstaller`, { stdio: 'inherit' });
  execSync(`pyinstaller --onefile ./main.py --name python-sidecar`, { cwd: pythonDir, stdio: 'inherit' });
  
  const src = path.join(pythonDir, 'dist', `python-sidecar${ext}`);
  const dst = path.join(pythonDir, `python-sidecar-${triple}${ext}`);
  
  if (fs.existsSync(dst)) fs.unlinkSync(dst);
  fs.renameSync(src, dst);
  console.log(`Python sidecar built: ${dst}`);
} catch (e) {
  console.warn('Skipping Python sidecar build (Python or PyInstaller might not be available).');
}
