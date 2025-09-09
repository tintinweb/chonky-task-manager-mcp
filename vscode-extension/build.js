#!/usr/bin/env node

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').BuildOptions}
 */
const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node16',
  
  // Production optimizations
  minify: production,
  treeShaking: true,
  sourcemap: !production,
  
  // Define environment variables
  define: {
    'process.env.NODE_ENV': production ? '"production"' : '"development"'
  },
  
  // Additional optimizations
  drop: production ? ['console', 'debugger'] : [],
  
  // Handle problematic patterns
  logLevel: 'warning'
};

/**
 * Clean the output directory
 */
function cleanOutputDir() {
  const outDir = path.dirname(buildOptions.outfile);
  if (fs.existsSync(outDir)) {
    console.log(`🧹 Cleaning ${outDir}/...`);
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });
}

/**
 * Compile tests using TypeScript compiler (development only)
 */
async function compileTests() {
  if (production) {
    console.log('⏭️  Skipping test compilation in production mode');
    return;
  }
  
  console.log('🧪 Compiling test files...');
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const tsc = spawn('npx', ['tsc'], { stdio: 'inherit' });
    tsc.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Test compilation complete!');
        resolve();
      } else {
        reject(new Error(`TypeScript compilation failed with code ${code}`));
      }
    });
  });
}

async function build() {
  try {
    if (watch) {
      console.log('👀 Watching for changes...');
      const context = await esbuild.context(buildOptions);
      await context.watch();
    } else {
      // Clean output directory for production builds
      if (production) {
        cleanOutputDir();
      }
      
      console.log(production ? '🏗️  Building for production...' : '🛠️  Building for development...');
      await esbuild.build(buildOptions);
      console.log('✅ Build complete!');
      
      // Compile tests in development mode
      if (!production) {
        await compileTests();
      }
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
