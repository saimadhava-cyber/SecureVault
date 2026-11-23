/**
 * SecureVault Envelope (.svault)
 * 
 * Self-contained, portable binary format for encrypted files.
 * Contains:
 * - 8 bytes: Magic header "SVAULT1\0"
 * - 16 bytes: Cryptographic Salt
 * - 12 bytes: AES-GCM Initialization Vector (IV)
 * - 4 bytes: Big-Endian UInt32 JSON metadata length
 * - N bytes: UTF-8 JSON metadata
 * - M bytes: AES-256-GCM Ciphertext + 16-byte authentication tag
 */

import { bufferToHex, hexToBuffer } from './webcrypto.js';

const MAGIC_BYTES = new Uint8Array([0x53, 0x56, 0x41, 0x55, 0x4c, 0x54, 0x31, 0x00]); // "SVAULT1\0"

export function packVaultEnvelope({
  ciphertext,
  salt,
  iv,
  metadata = {}
}) {
  const encoder = new TextEncoder();
  const metadataString = JSON.stringify(metadata);
  const metadataBytes = encoder.encode(metadataString);

  const metaLength = metadataBytes.length;
  const totalLength = 8 + 16 + 12 + 4 + metaLength + ciphertext.length;

  const buffer = new Uint8Array(totalLength);
  let offset = 0;

  // 1. Magic
  buffer.set(MAGIC_BYTES, offset);
  offset += 8;

  // 2. Salt (16 bytes)
  const saltBytes = typeof salt === 'string' ? hexToBuffer(salt) : salt;
  buffer.set(saltBytes, offset);
  offset += 16;

  // 3. IV (12 bytes)
  const ivBytes = typeof iv === 'string' ? hexToBuffer(iv) : iv;
  buffer.set(ivBytes, offset);
  offset += 12;

  // 4. Meta length (4 bytes UInt32BE)
  const view = new DataView(buffer.buffer);
  view.setUint32(offset, metaLength, false);
  offset += 4;

  // 5. Metadata JSON bytes
  buffer.set(metadataBytes, offset);
  offset += metaLength;

  // 6. Ciphertext
  buffer.set(ciphertext, offset);

  return buffer;
}

export function unpackVaultEnvelope(envelopeBytes) {
  const bytes = envelopeBytes instanceof Uint8Array ? envelopeBytes : new Uint8Array(envelopeBytes);

  if (bytes.length < 8 + 16 + 12 + 4) {
    throw new Error('File is too small to be a valid SecureVault (.svault) package.');
  }

  // Verify magic header
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== MAGIC_BYTES[i]) {
      throw new Error('Invalid SecureVault file header. File may not be an encrypted .svault package.');
    }
  }

  let offset = 8;

  const salt = bytes.slice(offset, offset + 16);
  offset += 16;

  const iv = bytes.slice(offset, offset + 12);
  offset += 12;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const metaLength = view.getUint32(offset, false);
  offset += 4;

  if (offset + metaLength > bytes.length) {
    throw new Error('Corrupted SecureVault envelope: metadata length exceeds file size.');
  }

  const metaBytes = bytes.slice(offset, offset + metaLength);
  offset += metaLength;

  const decoder = new TextDecoder();
  let metadata = {};
  try {
    metadata = JSON.parse(decoder.decode(metaBytes));
  } catch (err) {
    console.warn('Failed to parse envelope metadata:', err);
  }

  const ciphertext = bytes.slice(offset);

  return {
    salt,
    iv,
    saltHex: bufferToHex(salt),
    ivHex: bufferToHex(iv),
    metadata,
    ciphertext
  };
}
