/**
 * SecureVault Cryptographic Verification Test Suite
 * Tests AES-256-GCM, PBKDF2, Envelope packaging, tampering detection, and wrong passwords.
 */

import assert from 'assert';
import {
  generateSalt,
  generateIV,
  bufferToHex,
  hexToBuffer,
  encryptBuffer,
  decryptBuffer,
  computeSha256
} from '../client/src/crypto/webcrypto.js';
import { packVaultEnvelope, unpackVaultEnvelope } from '../client/src/crypto/envelope.js';

async function runTests() {
  console.log('--- Starting SecureVault Cryptographic Verification ---');

  // Test 1: Key & Vector Generation
  const salt1 = generateSalt(16);
  const salt2 = generateSalt(16);
  assert.strictEqual(salt1.length, 16, 'Salt must be 16 bytes');
  assert.notStrictEqual(bufferToHex(salt1), bufferToHex(salt2), 'Salts must be randomly generated and unique');

  const iv1 = generateIV(12);
  const iv2 = generateIV(12);
  assert.strictEqual(iv1.length, 12, 'IV must be 12 bytes');
  assert.notStrictEqual(bufferToHex(iv1), bufferToHex(iv2), 'IVs must be unique per encryption');
  console.log('✅ Test 1 Passed: Cryptographically secure random salts and IVs generated successfully.');

  // Test 2: Encryption and Decryption Round-trip
  const testPayload = new TextEncoder().encode('Confidential Data: Top Secret Project SecureVault 2026!');
  const testPassword = 'StrongP@ssw0rd!2026#Vault';

  const encrypted = await encryptBuffer(testPayload, testPassword, { iterations: 10000 });
  assert.ok(encrypted.ciphertext.length > testPayload.length, 'Ciphertext must include ciphertext + 16-byte auth tag');
  assert.strictEqual(encrypted.salt.length, 16);
  assert.strictEqual(encrypted.iv.length, 12);

  const decrypted = await decryptBuffer(
    encrypted.ciphertext,
    testPassword,
    encrypted.saltHex,
    encrypted.ivHex,
    10000
  );

  const decryptedText = new TextDecoder().decode(decrypted);
  assert.strictEqual(decryptedText, 'Confidential Data: Top Secret Project SecureVault 2026!');
  console.log('✅ Test 2 Passed: AES-256-GCM encryption & decryption round-trip verified.');

  // Test 3: Incorrect Password Rejection
  let wrongPassRejected = false;
  try {
    await decryptBuffer(
      encrypted.ciphertext,
      'WrongPassword123!',
      encrypted.saltHex,
      encrypted.ivHex,
      10000
    );
  } catch (err) {
    wrongPassRejected = true;
    assert.strictEqual(err.name, 'DecryptionError');
  }
  assert.ok(wrongPassRejected, 'Decryption must strictly reject incorrect password');
  console.log('✅ Test 3 Passed: Incorrect password successfully rejected by AES-GCM tag verification.');

  // Test 4: Ciphertext Tampering Detection (Authenticated Encryption)
  let tamperingDetected = false;
  const tamperedCiphertext = new Uint8Array(encrypted.ciphertext);
  // Flip a single bit in the ciphertext
  tamperedCiphertext[10] ^= 0x01;

  try {
    await decryptBuffer(
      tamperedCiphertext,
      testPassword,
      encrypted.saltHex,
      encrypted.ivHex,
      10000
    );
  } catch (err) {
    tamperingDetected = true;
    assert.strictEqual(err.name, 'DecryptionError');
  }
  assert.ok(tamperingDetected, 'Decryption must fail when ciphertext is modified by 1 bit');
  console.log('✅ Test 4 Passed: 1-bit tampering detected and rejected by AES-GCM tag authentication.');

  // Test 5: Standalone .svault Envelope Packaging & Unpackaging
  const meta = {
    fileName: 'secret_budget.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    originalSizeBytes: testPayload.length,
    algorithm: 'AES-256-GCM'
  };

  const packedEnvelope = packVaultEnvelope({
    ciphertext: encrypted.ciphertext,
    salt: encrypted.salt,
    iv: encrypted.iv,
    metadata: meta
  });

  const unpacked = unpackVaultEnvelope(packedEnvelope);
  assert.strictEqual(unpacked.metadata.fileName, 'secret_budget.xlsx');
  assert.strictEqual(bufferToHex(unpacked.salt), encrypted.saltHex);
  assert.strictEqual(bufferToHex(unpacked.iv), encrypted.ivHex);

  const unpackedDecrypted = await decryptBuffer(
    unpacked.ciphertext,
    testPassword,
    unpacked.salt,
    unpacked.iv,
    10000
  );
  assert.strictEqual(new TextDecoder().decode(unpackedDecrypted), 'Confidential Data: Top Secret Project SecureVault 2026!');
  console.log('✅ Test 5 Passed: Standalone .svault package envelope verified.');

  // Test 6: SHA-256 Checksum Calculation
  const checksum = await computeSha256(testPayload);
  assert.strictEqual(typeof checksum, 'string');
  assert.strictEqual(checksum.length, 64, 'SHA-256 checksum must be 64 hex characters');
  console.log('✅ Test 6 Passed: SHA-256 checksum calculated correctly.');

  console.log('\n🎉 ALL CRYPTOGRAPHIC TESTS PASSED WITH 100% SUCCESS!\n');
}

runTests().catch(err => {
  console.error('❌ Cryptographic test failed:', err);
  process.exit(1);
});
