/**
 * SecureVault Production Configuration & Environment Security Unit Tests
 */

import assert from 'assert';
import path from 'path';
import { execSync } from 'child_process';

console.log('--- Starting SecureVault Production Config Verification ---');

// Test 1: Production refuses to start if JWT_SECRET is empty
try {
  execSync('node -e "process.env.NODE_ENV=\'production\'; process.env.JWT_SECRET=\'\'; import(\'./server/src/config.js\');"', {
    stdio: 'pipe'
  });
  assert.fail('Should fail when JWT_SECRET is empty in production');
} catch (err) {
  const stderr = err.stderr ? err.stderr.toString() : err.message;
  assert.ok(
    stderr.includes('JWT_SECRET must be explicitly set'),
    'Must refuse startup when JWT_SECRET is empty in production: ' + stderr
  );
  console.log('✅ Test 1 Passed: Production refuses startup when JWT_SECRET is empty.');
}

// Test 2: Production refuses to start with development default JWT_SECRET
try {
  execSync('node -e "process.env.NODE_ENV=\'production\'; process.env.JWT_SECRET=\'securevault-super-secret-dev-key-change-in-production-2026\'; import(\'./server/src/config.js\');"', {
    stdio: 'pipe'
  });
  assert.fail('Should fail when dev secret is used in production');
} catch (err) {
  const stderr = err.stderr ? err.stderr.toString() : err.message;
  assert.ok(
    stderr.includes('using the default development JWT_SECRET is strictly prohibited'),
    'Must refuse startup when default dev secret is used in production: ' + stderr
  );
  console.log('✅ Test 2 Passed: Production refuses startup when default development secret is used.');
}

// Test 3: Production refuses to start if JWT_SECRET is weak (< 32 chars)
try {
  execSync('node -e "process.env.NODE_ENV=\'production\'; process.env.JWT_SECRET=\'short-weak-secret-123\'; import(\'./server/src/config.js\');"', {
    stdio: 'pipe'
  });
  assert.fail('Should fail when JWT_SECRET is too short');
} catch (err) {
  const stderr = err.stderr ? err.stderr.toString() : err.message;
  assert.ok(
    stderr.includes('must be at least 32 characters long'),
    'Must refuse startup when secret is less than 32 characters: ' + stderr
  );
  console.log('✅ Test 3 Passed: Production refuses startup when secret is under 32 characters.');
}

// Test 4: Production starts successfully with a strong 32+ character JWT_SECRET
try {
  const out = execSync('node -e "process.env.NODE_ENV=\'production\'; process.env.JWT_SECRET=\'c4d6f8a2e1b30579a8d7e6f5c4b3a291e0f8d7c6b5a4938271605e4d3c2b1a0f\'; import(\'./server/src/config.js\').then(m => console.log(\'CONFIG_OK\'));"', {
    stdio: 'pipe'
  }).toString();
  assert.ok(out.includes('CONFIG_OK'), 'Should output CONFIG_OK');
  console.log('✅ Test 4 Passed: Production accepts strong 64-hex-character JWT secret.');
} catch (err) {
  assert.fail('Should succeed with valid 64-character secret in production: ' + err.message);
}

// Test 5: Path resolution for custom relative and absolute VAULT_STORAGE_DIR
try {
  const output = execSync('node -e "process.env.VAULT_STORAGE_DIR=\'custom_vault_dir\'; import(\'./server/src/config.js\').then(m => console.log(m.config.storageDir));"', {
    stdio: 'pipe'
  }).toString().trim();
  assert.ok(path.isAbsolute(output), 'Storage directory must resolve to an absolute path');
  assert.ok(output.endsWith('custom_vault_dir'), 'Storage directory must reflect configured path');
  console.log('✅ Test 5 Passed: Custom VAULT_STORAGE_DIR properly resolved to absolute path.');
} catch (err) {
  assert.fail('Failed to resolve custom VAULT_STORAGE_DIR: ' + err.message);
}

console.log('\n🎉 ALL PRODUCTION CONFIGURATION SECURITY TESTS PASSED 100%!\n');
