#!/usr/bin/env node

/**
 * Package Readiness Check Script
 *
 * Verifies that the package is ready for npm publication
 */

/* eslint-disable */

const fs = require('fs');
const { execSync } = require('child_process');

const REQUIRED_FILES = [
  'package.json',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'tsconfig.json',
];

const REQUIRED_DIRECTORIES = [
  'src',
  'docs',
];

const REQUIRED_PACKAGE_FIELDS = [
  'name',
  'version',
  'description',
  'main',
  'types',
  'keywords',
  'author',
  'license',
  'repository',
  'files',
];

function checkFile(file) {
  const exists = fs.existsSync(file);
  console.log(`${exists ? '✓' : '✗'} ${file}`);
  return exists;
}

function checkDirectory(dir) {
  const exists = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  console.log(`${exists ? '✓' : '✗'} ${dir}/`);
  return exists;
}

function checkPackageJson() {
  console.log('\n📦 Checking package.json...');

  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    let allGood = true;

    for (const field of REQUIRED_PACKAGE_FIELDS) {
      const exists = pkg[field] !== undefined;
      console.log(`${exists ? '✓' : '✗'} ${field}: ${exists ? '✓' : 'MISSING'}`);
      if (!exists) allGood = false;
    }

    // Check engines
    if (pkg.engines) {
      console.log(`✓ engines: node ${pkg.engines.node || 'not specified'}`);
    } else {
      console.log('⚠ engines: not specified (recommended)');
    }

    // Check exports field
    if (pkg.exports) {
      console.log('✓ exports: configured (ESM/CommonJS)');
    } else {
      console.log('⚠ exports: not configured (optional)');
    }

    return allGood;
  } catch (error) {
    console.error('✗ Error reading package.json:', error.message);
    return false;
  }
}

function checkBuild() {
  console.log('\n🔨 Checking build...');

  try {
    if (!fs.existsSync('dist')) {
      console.log('⚠ dist/ folder does not exist. Running build...');
      execSync('npm run build', { stdio: 'inherit' });
    }

    const distFiles = fs.readdirSync('dist');
    const hasJs = distFiles.some(f => f.endsWith('.js'));
    const hasDts = distFiles.some(f => f.endsWith('.d.ts'));

    console.log(`${hasJs ? '✓' : '✗'} .js files generated`);
    console.log(`${hasDts ? '✓' : '✗'} .d.ts files generated`);

    return hasJs && hasDts;
  } catch (error) {
    console.error('✗ Build error:', error.message);
    return false;
  }
}

function checkTests() {
  console.log('\n🧪 Checking tests...');

  try {
    const output = execSync('npm test -- --passWithNoTests 2>&1', { encoding: 'utf8' });
    // Check for test suite summary: "Test Suites: X passed, X total"
    const suiteMatch = output.match(/Test Suites:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    const testMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);

    if (suiteMatch && testMatch) {
      const suitePassed = parseInt(suiteMatch[1]);
      const suiteTotal = parseInt(suiteMatch[2]);
      const testPassed = parseInt(testMatch[1]);
      const testTotal = parseInt(testMatch[2]);

      if (suitePassed === suiteTotal && testPassed === testTotal) {
        console.log(`✓ All tests passing (${testPassed}/${testTotal} tests, ${suitePassed}/${suiteTotal} suites)`);
        return true;
      }
    }

    console.log('✗ Some tests failing');
    return false;
  } catch (error) {
    // Check stderr/stdout for test summary
    const output = error.stdout ? error.stdout.toString() : '';
    const suiteMatch = output.match(/Test Suites:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    const testMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);

    if (suiteMatch && testMatch) {
      const suitePassed = parseInt(suiteMatch[1]);
      const suiteTotal = parseInt(suiteMatch[2]);
      const testPassed = parseInt(testMatch[1]);
      const testTotal = parseInt(testMatch[2]);

      if (suitePassed === suiteTotal && testPassed === testTotal) {
        console.log(`✓ All tests passing (${testPassed}/${testTotal} tests, ${suitePassed}/${suiteTotal} suites)`);
        return true;
      }
    }

    console.log('✗ Some tests failing');
    return false;
  }
}

function checkLint() {
  console.log('\n🔍 Checking linting...');

  try {
    execSync('npm run lint', { stdio: 'pipe' });
    console.log('✓ No lint errors');
    return true;
  } catch (error) {
    console.log('⚠ Lint errors detected (run: npm run lint:fix)');
    return false;
  }
}

function checkPackageSize() {
  console.log('\n📊 Estimating package size...');

  try {
    const output = execSync('npm pack --dry-run 2>&1', { encoding: 'utf8' });
    const sizeMatch = output.match(/package size:\s+([0-9.]+\s+[A-Z]+)/i);
    const fileCountMatch = output.match(/(\d+)\s+files/i);

    if (sizeMatch) {
      console.log(`✓ Estimated size: ${sizeMatch[1]}`);
    }
    if (fileCountMatch) {
      console.log(`✓ File count: ${fileCountMatch[1]}`);
    }

    return true;
  } catch (error) {
    console.log('⚠ Unable to estimate size');
    return false;
  }
}

function main() {
  console.log('🚀 Checking SocietyAI package readiness\n');
  console.log('═══════════════════════════════════════════════════════\n');

  let allChecks = true;

  // 1. Check required files
  console.log('📄 Required files:');
  for (const file of REQUIRED_FILES) {
    if (!checkFile(file)) allChecks = false;
  }

  // 2. Check required directories
  console.log('\n📁 Required directories:');
  for (const dir of REQUIRED_DIRECTORIES) {
    if (!checkDirectory(dir)) allChecks = false;
  }

  // 3. Check package.json
  if (!checkPackageJson()) allChecks = false;

  // 4. Check build
  if (!checkBuild()) allChecks = false;

  // 5. Check tests
  if (!checkTests()) allChecks = false;

  // 6. Check lint
  if (!checkLint()) allChecks = false;

  // 7. Check size
  checkPackageSize();

  // Summary
  console.log('\n═══════════════════════════════════════════════════════\n');

  if (allChecks) {
    console.log('✅ Package is ready for publication!\n');
    console.log('To publish:');
    console.log('  npm publish --dry-run  # Test publication');
    console.log('  npm publish            # Actual publication');
    process.exit(0);
  } else {
    console.log('❌ Package is NOT ready for publication.\n');
    console.log('Please fix the issues above.');
    process.exit(1);
  }
}

main();
