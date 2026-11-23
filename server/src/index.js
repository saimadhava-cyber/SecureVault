import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDatabase } from './db/index.js';
import { ensureVaultStorage } from './services/vaultStorage.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

import authRoutes from './routes/auth.routes.js';
import filesRoutes from './routes/files.routes.js';
import activityRoutes from './routes/activity.routes.js';
import userRoutes from './routes/user.routes.js';

const app = express();

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false // Handled in client or headers if required
  })
);

// CORS configuration
const allowedLocalhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., same-origin, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // In production mode, strictly allow only the exact configured CLIENT_URL
      if (config.isProduction) {
        if (origin === config.clientUrl) {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy: Origin ${origin} not allowed.`));
      }

      // In development / test mode, allow configured CLIENT_URL or any localhost / 127.0.0.1 port
      if (origin === config.clientUrl || allowedLocalhostRegex.test(origin)) {
        return callback(null, true);
      }

      // Reject all other unapproved origins
      return callback(new Error(`CORS policy: Origin ${origin} not allowed.`));
    },
    credentials: true,
    exposedHeaders: [
      'X-Vault-Salt',
      'X-Vault-IV',
      'X-Vault-AuthTag',
      'X-Vault-Original-Name',
      'X-Vault-Mime-Type',
      'X-Vault-Checksum',
      'Content-Disposition'
    ]
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Apply general API rate limiter
app.use('/api', apiLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'SecureVault Backend',
    timestamp: new Date().toISOString(),
    cryptoSupported: ['AES-256-GCM', 'PBKDF2-SHA-256', 'WebAuthn']
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/user', userRoutes);

// Central error handler
app.use(errorHandler);

// Initialize DB and Storage, then start server if executed directly
try {
  initDatabase();
  ensureVaultStorage();

  const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
  if (isMain) {
    app.listen(config.port, () => {
      console.log(`=================================================`);
      console.log(`🛡️  SecureVault API Server Running`);
      console.log(`📡 URL: http://localhost:${config.port}`);
      console.log(`🔒 Vault Storage: ${config.storageDir}`);
      console.log(`💾 Database: ${config.dbPath}`);
      console.log(`=================================================`);
    });
  }
} catch (err) {
  console.error('Fatal initialization error:', err);
  process.exit(1);
}

export default app;
