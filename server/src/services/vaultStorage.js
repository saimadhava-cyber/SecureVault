import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config.js';

// Ensure vault storage directory exists with restricted permissions
export function ensureVaultStorage() {
  if (!fs.existsSync(config.storageDir)) {
    fs.mkdirSync(config.storageDir, { recursive: true, mode: 0o700 });
  }
}

export const vaultStorage = {
  // Store an encrypted file buffer / stream in private vault
  saveEncryptedBlob(fileId, buffer) {
    ensureVaultStorage();
    const filePath = path.join(config.storageDir, `${fileId}.enc`);
    fs.writeFileSync(filePath, buffer, { mode: 0o600 });
    
    // Calculate SHA-256 checksum of encrypted file for integrity validation
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    return {
      filePath: `${fileId}.enc`,
      sizeBytes: buffer.length,
      checksum: hash
    };
  },

  // Get path for streaming download
  getEncryptedFilePath(fileName) {
    const filePath = path.join(config.storageDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error('Encrypted file not found on disk');
    }
    return filePath;
  },

  // Delete an encrypted file permanently
  deleteEncryptedFile(fileName) {
    const filePath = path.join(config.storageDir, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  },

  // Verify integrity of stored encrypted file
  verifyFileIntegrity(fileName, expectedChecksum) {
    const filePath = path.join(config.storageDir, fileName);
    if (!fs.existsSync(filePath)) return false;
    const buffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    return hash === expectedChecksum;
  }
};
