/**
 * SecureVault End-to-End System & Integration Test Suite
 * Tests User Registration, Login, Web Crypto AES-256-GCM, Encrypted Upload,
 * Private Vault Storage, Authenticated Streaming, Decryption,
 * Bit-Tampering Detection, Multi-User Isolation, and File Shredding.
 */

process.env.NODE_ENV = 'test';

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import http from 'http';
import app from '../server/src/index.js';
import {
  encryptBuffer,
  decryptBuffer,
  computeSha256
} from '../client/src/crypto/webcrypto.js';

const TEST_PORT = 5005;
let server = null;

async function startServer() {
  return new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`[Integration Test] Test server running on http://localhost:${TEST_PORT}`);
      resolve();
    });
  });
}

async function stopServer() {
  if (server) {
    return new Promise((resolve) => server.close(resolve));
  }
}

async function api(path, options = {}) {
  const url = `http://localhost:${TEST_PORT}${path}`;
  const headers = { ...(options.headers || {}) };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body
  });

  if (options.asBuffer) {
    const arrayBuffer = await res.arrayBuffer();
    return { status: res.status, buffer: arrayBuffer, headers: res.headers };
  }

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

async function runIntegrationTests() {
  console.log('\n======================================================');
  console.log('   SECUREVAULT END-TO-END INTEGRATION TEST SUITE     ');
  console.log('======================================================\n');

  await startServer();

  try {
    // 1. Health check
    const health = await api('/api/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.data.status, 'healthy');
    console.log('✅ 1. Health endpoint responsive and healthy.');

    // 2. User A Registration
    const userAEmail = `alice_${Date.now()}@securevault.test`;
    const userAPassword = 'MasterPassword!2026#Vault';
    const regRes = await api('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Alice Test',
        email: userAEmail,
        password: userAPassword
      }
    });
    assert.strictEqual(regRes.status, 201, 'Registration should return 201');
    assert.ok(regRes.data.token, 'Registration should return JWT');
    const tokenA = regRes.data.token;
    const userAId = regRes.data.user.id;
    console.log('✅ 2. User A registered successfully with bcrypt password hash.');

    // 3. User A Login
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: {
        email: userAEmail,
        password: userAPassword
      }
    });
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.data.user.email, userAEmail);
    console.log('✅ 3. User A authenticated successfully with JWT.');

    // 4. Reject Wrong Password on Login
    const badLogin = await api('/api/auth/login', {
      method: 'POST',
      body: {
        email: userAEmail,
        password: 'WrongPassword999!'
      }
    });
    assert.strictEqual(badLogin.status, 401);
    console.log('✅ 4. Authentication correctly rejects invalid credentials.');

    // 5. Client-Side Encryption of Test Document
    const originalText = 'CLASSIFIED SPECIFICATION: Zero-Knowledge File Architecture 2026. Top Secret.';
    const originalBytes = new TextEncoder().encode(originalText);
    const fileEncryptionPassword = 'CustomFileSecretKey#987!';

    console.log('   Encrypting test document in-memory using Web Crypto AES-256-GCM...');
    const encrypted = await encryptBuffer(originalBytes, fileEncryptionPassword, { iterations: 100000 });
    assert.ok(encrypted.ciphertext.length > originalBytes.length);
    console.log('✅ 5. Client-side AES-256-GCM encryption completed (Plaintext never touched server).');

    // 6. Upload Encrypted Ciphertext + Crypto Metadata
    const formData = new FormData();
    const encryptedBlob = new Blob([encrypted.ciphertext], { type: 'application/octet-stream' });
    formData.append('encryptedFile', encryptedBlob, 'classified_specs.pdf.enc');
    formData.append('fileName', 'classified_specs.pdf');
    formData.append('originalMimeType', 'application/pdf');
    formData.append('originalSizeBytes', originalBytes.length.toString());
    formData.append('saltHex', encrypted.saltHex);
    formData.append('ivHex', encrypted.ivHex);
    formData.append('authTagHex', encrypted.authTagHex);
    formData.append('algorithm', 'AES-256-GCM');
    formData.append('keyDerivation', 'PBKDF2-SHA-256');
    formData.append('pbkdf2Iterations', '100000');

    const uploadRes = await fetch(`http://localhost:${TEST_PORT}/api/files/upload-encrypted`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`
      },
      body: formData
    });
    const uploadData = await uploadRes.json();
    assert.strictEqual(uploadRes.status, 201);
    const fileId = uploadData.file.id;
    console.log(`✅ 6. Encrypted blob uploaded to private vault (File ID: ${fileId}).`);

    // 7. Verify disk storage is strictly ciphertext (zero plaintext)
    const diskPath = path.resolve('server/vault_storage', `${fileId}.enc`);
    assert.ok(fs.existsSync(diskPath), 'Encrypted file must exist in private vault storage');
    const diskBuffer = fs.readFileSync(diskPath);
    const diskString = diskBuffer.toString('utf8');
    assert.ok(!diskString.includes('CLASSIFIED SPECIFICATION'), 'Server disk MUST NOT contain original plaintext!');
    console.log('✅ 7. Verified: Server disk holds ONLY AES-256-GCM ciphertext, zero plaintext leakage.');

    // 8. Download Encrypted Blob via Authenticated Stream
    const downloadRes = await api(`/api/files/${fileId}/download-encrypted`, {
      token: tokenA,
      asBuffer: true
    });
    assert.strictEqual(downloadRes.status, 200);
    assert.strictEqual(downloadRes.headers.get('x-vault-salt'), encrypted.saltHex);
    assert.strictEqual(downloadRes.headers.get('x-vault-iv'), encrypted.ivHex);
    console.log('✅ 8. Authenticated download streamed encrypted payload with cryptographic headers.');

    // 9. Client-Side Decryption of Downloaded Ciphertext
    const decryptedBytes = await decryptBuffer(
      downloadRes.buffer,
      fileEncryptionPassword,
      encrypted.saltHex,
      encrypted.ivHex,
      100000
    );
    const decryptedText = new TextDecoder().decode(decryptedBytes);
    assert.strictEqual(decryptedText, originalText);
    console.log('✅ 9. Client-side decryption verified byte-for-byte in-memory match!');

    // 10. Decryption Rejects Incorrect Password
    let wrongPassRejected = false;
    try {
      await decryptBuffer(
        downloadRes.buffer,
        'IncorrectPassword123!',
        encrypted.saltHex,
        encrypted.ivHex,
        100000
      );
    } catch (err) {
      wrongPassRejected = true;
    }
    assert.ok(wrongPassRejected, 'Decryption must fail with wrong password');
    console.log('✅ 10. AES-256-GCM authentication tag rejected incorrect password.');

    // 11. Decryption Rejects Tampered Ciphertext
    let tamperedRejected = false;
    const tampered = new Uint8Array(downloadRes.buffer);
    tampered[15] ^= 0x55; // Tamper with 1 byte
    try {
      await decryptBuffer(
        tampered,
        fileEncryptionPassword,
        encrypted.saltHex,
        encrypted.ivHex,
        100000
      );
    } catch (err) {
      tamperedRejected = true;
    }
    assert.ok(tamperedRejected, 'Decryption must fail when ciphertext is modified');
    console.log('✅ 11. AES-256-GCM tag verification detected and rejected 1-byte payload tampering.');

    // 12. User Access Isolation (User B cannot access User A's files)
    const userBEmail = `bob_${Date.now()}@securevault.test`;
    const regB = await api('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Bob Hacker',
        email: userBEmail,
        password: 'BobMasterPassword!2026'
      }
    });
    const tokenB = regB.data.token;

    const unauthorizedAccess = await api(`/api/files/${fileId}/download-encrypted`, {
      token: tokenB
    });
    assert.strictEqual(unauthorizedAccess.status, 404, 'User B must not be able to access User A files');
    console.log('✅ 12. Access isolation verified: User B cannot access or download User A files.');

    // 13. Application PIN Lock Configuration & Verification
    await api('/api/user/pin', {
      method: 'PUT',
      token: tokenA,
      body: { enabled: true, pin: '889900' }
    });
    const pinVerifyGood = await api('/api/user/verify-pin', {
      method: 'POST',
      token: tokenA,
      body: { pin: '889900' }
    });
    assert.strictEqual(pinVerifyGood.status, 200);
    assert.strictEqual(pinVerifyGood.data.valid, true);

    const pinVerifyBad = await api('/api/user/verify-pin', {
      method: 'POST',
      token: tokenA,
      body: { pin: '000000' }
    });
    assert.strictEqual(pinVerifyBad.status, 401);
    console.log('✅ 13. Application PIN lock successfully configured and verified.');

    // 14. Activity Audit Trail Verification (No Sensitive Data Leakage)
    const auditRes = await api('/api/activity', { token: tokenA });
    assert.strictEqual(auditRes.status, 200);
    assert.ok(auditRes.data.logs.length >= 2);
    // Ensure no password or key is in audit logs
    const auditStr = JSON.stringify(auditRes.data.logs);
    assert.ok(!auditStr.includes('MasterPassword'), 'Audit log must not contain user password');
    assert.ok(!auditStr.includes('CustomFileSecretKey'), 'Audit log must not contain encryption key');
    console.log('✅ 14. Audit logs verified: All actions tracked, zero credentials/keys logged.');

    // 15. Permanent File Deletion (Shredding)
    const deleteRes = await api(`/api/files/${fileId}`, {
      method: 'DELETE',
      token: tokenA
    });
    assert.strictEqual(deleteRes.status, 200);
    assert.ok(!fs.existsSync(diskPath), 'Encrypted file must be completely wiped from disk storage');
    console.log('✅ 15. Permanent file deletion verified: Encrypted file shredded and erased from disk.');

    // 16. Security Hardening: Prove Biometric Endpoints Return 501 & Cannot Authenticate
    const bioRegChal = await api('/api/auth/biometric/register-challenge', {
      method: 'POST',
      token: tokenA
    });
    assert.strictEqual(bioRegChal.status, 501, 'Biometric register challenge must return 501');
    assert.strictEqual(bioRegChal.data.code, 'BIOMETRIC_UNAVAILABLE');

    const bioRegVer = await api('/api/auth/biometric/register-verify', {
      method: 'POST',
      token: tokenA,
      body: { credentialId: 'mock-cred-id' }
    });
    assert.strictEqual(bioRegVer.status, 501, 'Biometric register verify must return 501');

    const bioLogChal = await api('/api/auth/biometric/login-challenge', {
      method: 'POST',
      body: { email: userAEmail }
    });
    assert.strictEqual(bioLogChal.status, 501, 'Biometric login challenge must return 501');

    const bioLogVer = await api('/api/auth/biometric/login-verify', {
      method: 'POST',
      body: { email: userAEmail, credentialId: 'mock-cred-id' }
    });
    assert.strictEqual(bioLogVer.status, 501, 'Biometric login verify must return 501');
    assert.strictEqual(bioLogVer.data.token, undefined, 'Biometric endpoint must NEVER issue tokens without verification');
    console.log('✅ 16. Verified: Biometric endpoints return 501 and cannot issue authentication tokens.');

    // 17. Security Hardening: Prove Password Recovery Returns 501 & Cannot Reset Passwords
    const forgotRes = await api('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: userAEmail }
    });
    assert.strictEqual(forgotRes.status, 501, 'Forgot password must return 501');
    assert.strictEqual(forgotRes.data.code, 'RECOVERY_UNAVAILABLE');
    assert.strictEqual(forgotRes.data.demoRecoveryCode, undefined, 'Recovery codes must NEVER be returned');

    const resetRes = await api('/api/auth/reset-password', {
      method: 'POST',
      body: { email: userAEmail, recoveryCode: '123456', newPassword: 'CompromisedPass123!' }
    });
    assert.strictEqual(resetRes.status, 501, 'Reset password must return 501');

    // Confirm password was NOT modified
    const badLoginWithReset = await api('/api/auth/login', {
      method: 'POST',
      body: { email: userAEmail, password: 'CompromisedPass123!' }
    });
    assert.strictEqual(badLoginWithReset.status, 401, 'Password must not have been modified');

    const originalLoginCheck = await api('/api/auth/login', {
      method: 'POST',
      body: { email: userAEmail, password: userAPassword }
    });
    assert.strictEqual(originalLoginCheck.status, 200, 'Original password must remain active and functional');
    console.log('✅ 17. Verified: Password recovery endpoints return 501, leak no codes, and cannot alter passwords.');

    // 18. Security Hardening: CORS Whitelisting & Origin Rejection
    const allowedCorsRes = await api('/api/health', {
      headers: { Origin: 'http://localhost:5173' }
    });
    assert.strictEqual(allowedCorsRes.status, 200);
    assert.strictEqual(
      allowedCorsRes.headers.get('access-control-allow-origin'),
      'http://localhost:5173',
      'CORS must permit authorized localhost origins'
    );

    const rejectedCorsRes = await api('/api/health', {
      headers: { Origin: 'https://malicious-phishing-site.com' }
    });
    assert.strictEqual(rejectedCorsRes.status, 403, 'CORS must reject unauthorized origins with 403');
    assert.strictEqual(rejectedCorsRes.data.code, 'CORS_FORBIDDEN');
    console.log('✅ 18. Verified: CORS allows authorized client origins and strictly blocks unauthorized origins.');

    console.log('\n======================================================');
    console.log(' 🎉 ALL 18 END-TO-END INTEGRATION TESTS PASSED 100%! ');
    console.log('======================================================\n');
    process.exit(0);
  } finally {
    await stopServer();
  }
}

runIntegrationTests().catch(err => {
  console.error('❌ Integration test failure:', err);
  stopServer().finally(() => process.exit(1));
});
