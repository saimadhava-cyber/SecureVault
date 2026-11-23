/**
 * SecureVault Web Crypto Engine
 * 
 * Standards-compliant implementation of AES-256-GCM authenticated encryption
 * and PBKDF2-SHA-256 key derivation using the W3C Web Crypto API (crypto.subtle).
 */

const getCrypto = () => {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is not supported in this runtime environment.');
};

/**
 * Custom Error for Decryption failures (wrong password, tampered payload, corrupt tag)
 */
export class DecryptionError extends Error {
  constructor(message = 'Decryption failed: Incorrect password or corrupted file.') {
    super(message);
    this.name = 'DecryptionError';
    this.code = 'DECRYPTION_FAILED';
  }
}

/**
 * Generate cryptographically secure random salt (16 bytes = 128 bits)
 */
export function generateSalt(length = 16) {
  const crypto = getCrypto();
  const salt = new Uint8Array(length);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Generate cryptographically secure random Initialization Vector (12 bytes = 96 bits for GCM)
 */
export function generateIV(length = 12) {
  const crypto = getCrypto();
  const iv = new Uint8Array(length);
  crypto.getRandomValues(iv);
  return iv;
}

/**
 * Convert ArrayBuffer or Uint8Array to Hexadecimal String
 */
export function bufferToHex(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert Hexadecimal String to Uint8Array
 */
export function hexToBuffer(hexString) {
  if (!hexString || hexString.length % 2 !== 0) {
    throw new Error('Invalid hexadecimal string length.');
  }
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Derive AES-256-GCM Key using PBKDF2 with SHA-256
 * 
 * @param {string} password - User entered passphrase
 * @param {Uint8Array} salt - Unique 16-byte random salt
 * @param {number} iterations - PBKDF2 iteration count (default: 100,000)
 * @returns {Promise<CryptoKey>} - Derived 256-bit AES-GCM Key
 */
export async function deriveKey(password, salt, iterations = 100000) {
  const crypto = getCrypto();
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt arbitrary ArrayBuffer or Uint8Array using AES-256-GCM
 * 
 * @param {ArrayBuffer|Uint8Array} dataBuffer - Plaintext file data
 * @param {string} password - User password for key derivation
 * @param {Object} options - Custom options { iterations, salt, iv }
 * @returns {Promise<{ ciphertext: Uint8Array, salt: Uint8Array, iv: Uint8Array, saltHex: string, ivHex: string, authTagHex: string, iterations: number }>}
 */
export async function encryptBuffer(dataBuffer, password, options = {}) {
  const crypto = getCrypto();
  const iterations = options.iterations || 100000;
  const salt = options.salt || generateSalt(16);
  const iv = options.iv || generateIV(12);

  // 1. Derive 256-bit encryption key
  const aesKey = await deriveKey(password, salt, iterations);

  // 2. Encrypt plaintext using AES-GCM with 128-bit authentication tag
  // In Web Crypto API, the returned ArrayBuffer contains the ciphertext followed by the 16-byte auth tag.
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128
    },
    aesKey,
    dataBuffer
  );

  const ciphertextWithTag = new Uint8Array(encryptedBuffer);

  // Extract authentication tag (last 16 bytes) for verification inspection if needed
  const tagBytes = ciphertextWithTag.slice(ciphertextWithTag.length - 16);
  const authTagHex = bufferToHex(tagBytes);

  return {
    ciphertext: ciphertextWithTag,
    salt,
    iv,
    saltHex: bufferToHex(salt),
    ivHex: bufferToHex(iv),
    authTagHex,
    iterations
  };
}

/**
 * Decrypt AES-256-GCM Ciphertext
 * 
 * @param {ArrayBuffer|Uint8Array} ciphertextBuffer - Ciphertext including 16-byte auth tag
 * @param {string} password - User entered decryption password
 * @param {Uint8Array|string} salt - Salt as Uint8Array or Hex string
 * @param {Uint8Array|string} iv - IV as Uint8Array or Hex string
 * @param {number} iterations - PBKDF2 iteration count
 * @returns {Promise<ArrayBuffer>} - Decrypted original plaintext ArrayBuffer
 */
export async function decryptBuffer(ciphertextBuffer, password, salt, iv, iterations = 100000) {
  const crypto = getCrypto();

  const saltBytes = typeof salt === 'string' ? hexToBuffer(salt) : salt;
  const ivBytes = typeof iv === 'string' ? hexToBuffer(iv) : iv;
  const data = ciphertextBuffer instanceof Uint8Array ? ciphertextBuffer : new Uint8Array(ciphertextBuffer);

  try {
    // 1. Derive key with identical parameters
    const aesKey = await deriveKey(password, saltBytes, iterations);

    // 2. Decrypt and verify tag with AES-GCM
    // Web Crypto automatically authenticates the 128-bit tag; fails if modified or password wrong
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
        tagLength: 128
      },
      aesKey,
      data
    );

    return decryptedBuffer;
  } catch (err) {
    console.warn('[SecureVault Crypto] Decryption verification failed:', err);
    throw new DecryptionError(
      'Decryption failed. The entered password was incorrect, or the encrypted file has been corrupted or tampered with.'
    );
  }
}

/**
 * Compute SHA-256 Checksum of an ArrayBuffer
 */
export async function computeSha256(dataBuffer) {
  const crypto = getCrypto();
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return bufferToHex(hashBuffer);
}
