import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';
const DEV_DEFAULT_SECRET = 'securevault-super-secret-dev-key-change-in-production-2026';

function resolveSafePath(userPath, defaultPath) {
  if (!userPath || !userPath.trim()) return defaultPath;
  const trimmed = userPath.trim();
  return path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(process.cwd(), trimmed);
}

// Validate JWT Secret in production
let jwtSecret = process.env.JWT_SECRET;
if (isProduction) {
  if (!jwtSecret || jwtSecret.trim() === '') {
    throw new Error(
      '[FATAL CONFIG] In production mode (NODE_ENV=production), JWT_SECRET must be explicitly set.'
    );
  }
  if (jwtSecret === DEV_DEFAULT_SECRET) {
    throw new Error(
      '[FATAL CONFIG] In production mode, using the default development JWT_SECRET is strictly prohibited.'
    );
  }
  if (jwtSecret.length < 32) {
    throw new Error(
      '[FATAL CONFIG] In production mode, JWT_SECRET must be at least 32 characters long to ensure cryptographic security.'
    );
  }
} else {
  jwtSecret = jwtSecret || DEV_DEFAULT_SECRET;
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  storageDir: resolveSafePath(
    process.env.VAULT_STORAGE_DIR,
    path.resolve(__dirname, '../vault_storage')
  ),
  dbPath: resolveSafePath(
    process.env.DB_PATH,
    path.resolve(__dirname, '../securevault.db')
  ),
  clientUrl: (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  isProduction,
  maxUploadSizeBytes: parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || '104857600', 10), // 100MB
};
