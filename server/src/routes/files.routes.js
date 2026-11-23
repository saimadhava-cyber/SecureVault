import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { dbOperations } from '../db/index.js';
import { vaultStorage } from '../services/vaultStorage.js';
import { auditLogger } from '../services/auditLogger.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config.js';

const router = express.Router();

// Memory storage so we can compute checksum, save to encrypted vault, and ensure zero unencrypted disk footprint
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxUploadSizeBytes
  }
});

// Helper to deduce category if not specified
function detectCategory(mimeType, fileName) {
  const mime = (mimeType || '').toLowerCase();
  const ext = (fileName || '').split('.').pop().toLowerCase();

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ['mp4', 'mkv', 'webm', 'mov', 'avi'].includes(ext)) {
    return 'video';
  }
  if (
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('document') ||
    mime.includes('text') ||
    ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'csv', 'md'].includes(ext)
  ) {
    return 'document';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
    return 'archive';
  }
  return 'other';
}

// 1. Upload Encrypted File
// IMPORTANT: Encryption happens in the browser before upload.
// The server only receives ciphertext + cryptographic parameters (salt, IV, auth tag).
router.post('/upload-encrypted', authenticate, upload.single('encryptedFile'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Encrypted file payload is required.' });
    }

    const {
      fileName,
      originalMimeType,
      originalSizeBytes,
      saltHex,
      ivHex,
      authTagHex,
      algorithm = 'AES-256-GCM',
      keyDerivation = 'PBKDF2-SHA-256',
      pbkdf2Iterations = 100000
    } = req.body;

    if (!fileName || !saltHex || !ivHex) {
      return res.status(400).json({
        error: 'Missing required cryptographic metadata (fileName, saltHex, ivHex are required).'
      });
    }

    const fileId = uuidv4();
    const encryptedBuffer = req.file.buffer;
    const encryptedSize = encryptedBuffer.length;
    const origSize = parseInt(originalSizeBytes || encryptedSize, 10);
    const mime = originalMimeType || 'application/octet-stream';
    const category = detectCategory(mime, fileName);

    // Save encrypted blob to private vault directory
    const saved = vaultStorage.saveEncryptedBlob(fileId, encryptedBuffer);

    // Insert metadata into database
    dbOperations.run(
      `INSERT INTO encrypted_files (
        id, user_id, file_name, original_mime_type, original_size_bytes, encrypted_size_bytes,
        file_category, encryption_algorithm, key_derivation, pbkdf2_iterations,
        salt_hex, iv_hex, auth_tag_hex, storage_path, sha256_checksum, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        fileId,
        req.user.id,
        fileName.trim(),
        mime,
        origSize,
        encryptedSize,
        category,
        algorithm,
        keyDerivation,
        parseInt(pbkdf2Iterations, 10),
        saltHex,
        ivHex,
        authTagHex || '',
        saved.filePath,
        saved.checksum
      ]
    );

    auditLogger.log({
      userId: req.user.id,
      actionType: 'FILE_UPLOADED',
      details: {
        fileId,
        fileName: fileName.trim(),
        encryptedSize,
        originalSize: origSize,
        category
      },
      req
    });

    res.status(201).json({
      message: 'Encrypted file uploaded and secured successfully.',
      file: {
        id: fileId,
        fileName: fileName.trim(),
        originalMimeType: mime,
        originalSizeBytes: origSize,
        encryptedSizeBytes: encryptedSize,
        fileCategory: category,
        algorithm,
        keyDerivation,
        pbkdf2Iterations,
        saltHex,
        ivHex,
        checksum: saved.checksum,
        createdAt: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

// 2. Get User Dashboard File & Storage Stats
router.get('/stats', authenticate, (req, res, next) => {
  try {
    const userId = req.user.id;

    // Total counts and size
    const totals = dbOperations.get(
      `SELECT 
        COUNT(*) as totalFiles,
        COALESCE(SUM(encrypted_size_bytes), 0) as totalEncryptedSizeBytes,
        COALESCE(SUM(original_size_bytes), 0) as totalOriginalSizeBytes
       FROM encrypted_files
       WHERE user_id = ?`,
      [userId]
    );

    // Counts by category
    const categoryRows = dbOperations.all(
      `SELECT file_category, COUNT(*) as count, COALESCE(SUM(encrypted_size_bytes), 0) as size
       FROM encrypted_files
       WHERE user_id = ?
       GROUP BY file_category`,
      [userId]
    );

    const categories = {
      document: 0,
      image: 0,
      video: 0,
      archive: 0,
      other: 0
    };
    categoryRows.forEach(row => {
      if (categories[row.file_category] !== undefined) {
        categories[row.file_category] = row.count;
      } else {
        categories.other += row.count;
      }
    });

    // Recent 5 files
    const recentFiles = dbOperations.all(
      `SELECT id, file_name, original_mime_type, original_size_bytes, encrypted_size_bytes,
              file_category, encryption_algorithm, created_at
       FROM encrypted_files
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    );

    res.json({
      stats: {
        totalFiles: totals.totalFiles || 0,
        totalEncryptedSizeBytes: totals.totalEncryptedSizeBytes || 0,
        totalOriginalSizeBytes: totals.totalOriginalSizeBytes || 0,
        documentCount: categories.document,
        imageCount: categories.image,
        videoCount: categories.video,
        archiveCount: categories.archive,
        otherCount: categories.other,
        recentFiles
      }
    });
  } catch (err) {
    next(err);
  }
});

// 3. List User Encrypted Files with Search, Filter & Sort
router.get('/', authenticate, (req, res, next) => {
  try {
    const userId = req.user.id;
    const { search, category, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

    const validSortColumns = ['created_at', 'file_name', 'encrypted_size_bytes', 'original_size_bytes'];
    const sortCol = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let sql = `SELECT id, file_name, original_mime_type, original_size_bytes, encrypted_size_bytes,
                      file_category, encryption_algorithm, key_derivation, pbkdf2_iterations,
                      salt_hex, iv_hex, auth_tag_hex, sha256_checksum, created_at, updated_at
               FROM encrypted_files
               WHERE user_id = ?`;
    const params = [userId];

    if (category && category !== 'all') {
      sql += ` AND file_category = ?`;
      params.push(category);
    }

    if (search && search.trim()) {
      sql += ` AND file_name LIKE ?`;
      params.push(`%${search.trim()}%`);
    }

    sql += ` ORDER BY ${sortCol} ${sortDir}`;

    const files = dbOperations.all(sql, params);

    res.json({ files });
  } catch (err) {
    next(err);
  }
});

// 4. Get File Metadata
router.get('/:id/metadata', authenticate, (req, res, next) => {
  try {
    const file = dbOperations.get(
      `SELECT id, user_id, file_name, original_mime_type, original_size_bytes, encrypted_size_bytes,
              file_category, encryption_algorithm, key_derivation, pbkdf2_iterations,
              salt_hex, iv_hex, auth_tag_hex, sha256_checksum, created_at, updated_at
       FROM encrypted_files
       WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found in your secure vault.' });
    }

    res.json({ file });
  } catch (err) {
    next(err);
  }
});

// 5. Download Encrypted Blob
// Never serves unencrypted data. The client downloads the raw encrypted blob and decrypts locally.
router.get('/:id/download-encrypted', authenticate, (req, res, next) => {
  try {
    const file = dbOperations.get(
      `SELECT id, user_id, file_name, storage_path, sha256_checksum, encrypted_size_bytes,
              salt_hex, iv_hex, auth_tag_hex, original_mime_type
       FROM encrypted_files
       WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found or access denied.' });
    }

    const filePath = vaultStorage.getEncryptedFilePath(file.storage_path);

    // Set custom cryptographic headers so frontend can inspect or construct package
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.file_name)}.enc"`);
    res.setHeader('X-Vault-Salt', file.salt_hex);
    res.setHeader('X-Vault-IV', file.iv_hex);
    res.setHeader('X-Vault-AuthTag', file.auth_tag_hex || '');
    res.setHeader('X-Vault-Original-Name', encodeURIComponent(file.file_name));
    res.setHeader('X-Vault-Mime-Type', file.original_mime_type);
    res.setHeader('X-Vault-Checksum', file.sha256_checksum);

    auditLogger.log({
      userId: req.user.id,
      actionType: 'FILE_DOWNLOADED',
      details: {
        fileId: file.id,
        fileName: file.file_name
      },
      req
    });

    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

// 6. Delete Encrypted File
router.delete('/:id', authenticate, (req, res, next) => {
  try {
    const file = dbOperations.get(
      `SELECT id, file_name, storage_path FROM encrypted_files WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found or access denied.' });
    }

    // Delete from disk
    vaultStorage.deleteEncryptedFile(file.storage_path);

    // Delete from database
    dbOperations.run(`DELETE FROM encrypted_files WHERE id = ?`, [file.id]);

    auditLogger.log({
      userId: req.user.id,
      actionType: 'FILE_DELETED',
      details: {
        fileId: file.id,
        fileName: file.file_name
      },
      req
    });

    res.json({ message: 'Encrypted file permanently erased from secure vault.' });
  } catch (err) {
    next(err);
  }
});

export default router;
