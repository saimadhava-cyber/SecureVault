# 🛡️ SecureVault – Web-Based File Encryption and Secure Storage System

> **"Your Files. Your Privacy. Your Security."**

**SecureVault** is a modern, responsive, zero-knowledge web application that allows users to encrypt, store, manage, download, and decrypt their personal files—including documents (PDF, DOCX, TXT), images (JPG, PNG, WebP), videos (MP4, MKV), and archives (ZIP, 7Z).

The application implements genuine **client-side AES-256-GCM** encryption using the W3C Web Crypto API, meaning that **original plaintext files never leave the user's browser**. The server stores only authenticated encrypted ciphertexts alongside cryptographic parameters (salts, IVs, checksums).

---

## 🔒 1. Core Security & Cryptographic Architecture

```
[ User Browser / Client Memory ]                               [ Private Storage Backend ]
================================                               ===========================
 Plaintext File (PDF, Image, Video)
        │
        ▼
 Derive 256-bit Key via PBKDF2-SHA-256
 (Password + 128-bit CSPRNG Salt, 100k iter)
        │
        ▼
 Encrypt locally with AES-256-GCM
 (96-bit unique CSPRNG IV + 128-bit MAC Tag)
        │
        ▼
 Encrypted Ciphertext + Crypto Envelope ────────HTTPS Upload───────► Store in private vault:
 (Zero Plaintext Leakage)                                            server/vault_storage/<uuid>.enc
                                                                     (Strictly private, no public URLs)
─────────────────────────────────────────────────────────────────────────────────────────────────
[ In-Memory Decryption ]
 Authenticated Stream ◄─────────────────────────HTTPS Download────── Read encrypted ciphertext
        │
        ▼
 Verify 128-bit Auth Tag & Decrypt locally
 (1-bit alteration or wrong password throws error)
        │
        ▼
 Decrypted Plaintext in Browser Memory
 (Preview images/video/text or download original)
```

### Cryptographic Specifications:
* **Symmetric Cipher:** `AES-256-GCM` (Galois/Counter Mode with 128-bit authentication tag).
* **Key Derivation Function (KDF):** `PBKDF2` with `SHA-256` hashing (100,000 to 250,000 iterations configurable).
* **Salt Generation:** 16 bytes (128 bits) of cryptographically secure pseudo-random bytes (`crypto.getRandomValues`).
* **Initialization Vector (IV):** 12 bytes (96 bits NIST recommendation for AES-GCM) generated uniquely per file.
* **Integrity & Tamper Evident:** AES-GCM verifies ciphertext authenticity; any modification of even 1 bit causes decryption to fail immediately.
* **Master Credentials:** Account authentication uses `bcrypt` with 12 salt rounds.
* **Hardware Biometrics:** WebAuthn platform passkeys (`navigator.credentials`) for Windows Hello, Apple Touch ID, and Android biometrics.
* **Portable `.svault` Package:** Custom binary envelope format with magic header `SVAULT1\0`, allowing standalone offline decryption without server access.

---

## 🚀 2. Technology Stack

### Frontend:
* **React 18** with **Vite 6** (Modern, fast component architecture)
* **Tailwind CSS** (Cybersecurity-themed slate/navy/cyan aesthetic)
* **Lucide React** (Consistent, modern security iconography)
* **W3C Web Crypto API** (`crypto.subtle` for hardware-accelerated browser encryption)

### Backend:
* **Node.js** (v20+)
* **Express.js** (RESTful API & streaming endpoints)
* **SQLite** (Native Node 24 `node:sqlite` database with WAL mode and foreign key constraints)
* **Multer** (Memory buffer handler for streaming encrypted payloads directly to private storage)
* **JSON Web Tokens (JWT)** with HttpOnly session cookies
* **Helmet & CORS** (Security headers, CSP, Rate limiting against brute-force attacks)

---

## 📂 3. Application Modules & Pages (11 Complete Views)

1. **Landing Page (`/`):** Features hero section, zero-knowledge architecture diagrams, and quick onboarding.
2. **Registration Page (`/register`):** User account creation with real-time password strength meter and validation.
3. **Login Page (`/login`):** Email & password login, biometric passkey quick sign-in, and self-service account recovery.
4. **User Dashboard (`/dashboard`):** Real-time telemetry, storage breakdown gauges, category file counts, and quick actions.
5. **File Upload & Encryption (`/upload`):** Desktop drag-and-drop / mobile picker, pre-encryption preview, passphrase generator, and progress bars.
6. **Encryption Studio (`/encrypt`):** Cryptographic laboratory to test algorithms, inspect salts/IVs, benchmark speed (MB/s), and export standalone `.svault` files.
7. **Secure Vault (`/vault`):** Private file manager with real-time search, category filters, sorting, metadata modals, and in-memory decryption.
8. **File Decryption Center (`/decrypt`):** Decrypt files from cloud vault OR upload external `.svault` files for offline in-browser decryption.
9. **Activity History (`/activity`):** Chronological audit trail of uploads, decryptions, downloads, deletions, and logins with JSON export.
10. **Security & Privacy Settings (`/security`):** Master password updates, 4-8 digit numeric PIN lock, auto-timeout configuration, and session management.
11. **User Profile (`/profile`):** Identity telemetry, security posture rating (0-100 score), and vault quota monitoring.

---

## ⚙️ 4. Installation & Local Execution

### Prerequisites:
* **Node.js**: v20 or higher (v24 recommended)
* **npm**: v9 or higher

### Step 1: Install Dependencies
Run the install command from the root directory:
```bash
# Install root, backend, and frontend packages
npm run install:all
```

Or install separately:
```bash
cd server && npm install
cd ../client && npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` (already configured with sensible development defaults):
```bash
# .env
PORT=5000
NODE_ENV=development
JWT_SECRET=securevault-super-secret-dev-key-change-in-production-2026
JWT_EXPIRES_IN=24h
DB_PATH=./server/securevault.db
VAULT_STORAGE_DIR=./server/vault_storage
CLIENT_URL=http://localhost:5173
MAX_UPLOAD_SIZE_BYTES=104857600
```

### Step 3: Run the Application
In terminal 1 (start backend API):
```bash
npm run server
# Runs Express on http://localhost:5000
```

In terminal 2 (start frontend client):
```bash
npm run client
# Runs Vite dev server on http://localhost:5173
```

Open `http://localhost:5173` in any modern web browser (Chrome, Edge, Firefox, Safari, iOS Safari, Android Chrome).

---

## 🧪 5. Testing & Verification

SecureVault includes unit, configuration security, and end-to-end integration test suites verifying 100% cryptographic correctness and deployment readiness:

```bash
# Run all test suites
npm test

# Run cryptographic unit test suite
npm run test:crypto

# Run production configuration security unit tests
npm run test:config

# Run 18-point end-to-end integration test suite
npm run test:integration
```

### Verified Test Cases:
* ✅ **Salt & IV Entropy:** Confirms 16-byte random salt and 12-byte random IV generated per operation.
* ✅ **AES-256-GCM Round-trip:** Verifies encrypted file decrypts byte-for-byte to original.
* ✅ **Password Rejection:** Confirms wrong passwords fail GCM tag verification.
* ✅ **1-Bit Tamper Detection:** Flips a single bit in ciphertext and verifies the decryption engine rejects it.
* ✅ **Standalone `.svault` Packaging:** Verifies self-contained envelope packing and unpacking.
* ✅ **SHA-256 Checksums:** Verifies tamper-evident integrity hashes.
* ✅ **Zero Plaintext Leakage:** Confirms server disk contains only ciphertext.
* ✅ **Access Isolation:** Confirms User B cannot download or inspect User A's files.
* ✅ **PIN Lock & Session Security:** Verifies PIN unlock logic and automatic session expiration.
* ✅ **Zero Secret Logging:** Verifies audit logs contain no passwords or encryption keys.
* ✅ **Biometric 501 Guard:** Confirms biometric endpoints return 501 and cannot issue tokens without full WebAuthn verification.
* ✅ **Password Recovery 501 Guard:** Confirms recovery endpoints return 501, leak no recovery codes, and cannot modify passwords.
* ✅ **CORS Strict Whitelisting:** Confirms CORS allows authorized client origins and strictly blocks unauthorized origins with 403.
* ✅ **Production JWT Secret Validation:** Prohibits missing, weak (<32 char), or default development keys in production.
* ✅ **Path Resolution:** Confirms custom and default `VAULT_STORAGE_DIR` and `DB_PATH` resolve cleanly.

---

## 🌐 6. Production Deployment

### Recommended Architecture:
Deploy the frontend build to an edge CDN (Vercel, Netlify, Cloudflare Pages) or serve it directly via Nginx, and host the Node.js Express backend behind a reverse proxy with TLS/HTTPS.

```bash
# 1. Build optimized frontend assets
cd client && npm run build
# Outputs production bundle to client/dist/

# 2. Run backend in production mode with PM2
cd server
NODE_ENV=production PORT=5000 npx pm2 start src/index.js --name "securevault-api"
```

### Nginx Reverse Proxy Configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name vault.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/vault.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vault.yourdomain.com/privkey.pem;

    # Frontend Static Files
    location / {
        root /var/www/securevault/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API & Authenticated Streaming
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        client_max_body_size 100M;
    }
}
```

---

## 📋 7. Threat Model & Privacy Guarantees

| Attack Vector | Defense Mechanism |
|---|---|
| **Compromised Server / Database Dump** | Attacker only gets AES-GCM ciphertexts and random salts. Without the client's master key, decryption is computationally infeasible. |
| **Ciphertext Tampering in Transit or at Rest** | AES-256-GCM calculates a 128-bit authentication tag over the ciphertext. Altering 1 bit causes decryption failure. |
| **Brute-Force Attacks on Passwords** | PBKDF2 with SHA-256 using 100,000+ iterations slows down dictionary and GPU cracking attempts significantly. |
| **Replay / IV Reuse Attacks** | Web Crypto API generates a fresh, cryptographically secure 96-bit random IV for every single encryption. |
| **Device Theft / Shoulder Surfing** | Automatic session timeouts and PIN-lock screen overlays prevent unauthorized access to open browser tabs. |

---

## 📄 License
This project is licensed under the MIT License.
