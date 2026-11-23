-- SecureVault Database Schema
-- Strict access control, user isolation, and tamper-evident metadata tracking

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  pin_hash TEXT,
  pin_enabled INTEGER DEFAULT 0,
  session_timeout_minutes INTEGER DEFAULT 15,
  biometric_enabled INTEGER DEFAULT 0,
  biometric_credential_id TEXT,
  biometric_public_key TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS encrypted_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  original_mime_type TEXT NOT NULL,
  original_size_bytes INTEGER NOT NULL,
  encrypted_size_bytes INTEGER NOT NULL,
  file_category TEXT NOT NULL,
  encryption_algorithm TEXT DEFAULT 'AES-256-GCM',
  key_derivation TEXT DEFAULT 'PBKDF2-SHA-256',
  pbkdf2_iterations INTEGER DEFAULT 100000,
  salt_hex TEXT NOT NULL,
  iv_hex TEXT NOT NULL,
  auth_tag_hex TEXT,
  storage_path TEXT NOT NULL,
  sha256_checksum TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_files_user_id ON encrypted_files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_category ON encrypted_files(file_category);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON encrypted_files(created_at);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_action ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON activity_logs(created_at);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  device_info TEXT,
  ip_address TEXT,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
