import React, { useState } from 'react';
import { useNotification } from '../context/NotificationContext.jsx';
import { encryptBuffer, computeSha256 } from '../crypto/webcrypto.js';
import { packVaultEnvelope } from '../crypto/envelope.js';
import { apiRequest } from '../utils/api.js';
import { formatBytes, generateRandomPassphrase } from '../utils/formatters.js';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx';
import {
  Lock,
  Cpu,
  Key,
  Download,
  UploadCloud,
  FileCheck2,
  Sparkles,
  Zap,
  Shield,
  File,
  Copy,
  Check
} from 'lucide-react';

export default function EncryptionPage() {
  const notify = useNotification();

  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [iterations, setIterations] = useState(100000);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptionResult, setEncryptionResult] = useState(null);
  const [copiedField, setCopiedField] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setEncryptionResult(null);
    }
  };

  const handleGenerateKey = () => {
    const key = generateRandomPassphrase(24);
    setPassword(key);
    notify.info('24-character high-entropy cryptographic key generated.');
  };

  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2000);
    notify.info(`Copied ${fieldName} to clipboard.`);
  };

  const handleRunEncryption = async () => {
    if (!file) {
      notify.error('Please choose a file to encrypt.');
      return;
    }
    if (!password || password.length < 8) {
      notify.error('Password must be at least 8 characters.');
      return;
    }

    setIsEncrypting(true);
    const startTime = performance.now();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const cryptoStartTime = performance.now();

      const enc = await encryptBuffer(arrayBuffer, password, { iterations });
      const cryptoEndTime = performance.now();

      const checksum = await computeSha256(enc.ciphertext);
      const totalTimeMs = Math.round(cryptoEndTime - cryptoStartTime);
      const speedMBs = ((file.size / (1024 * 1024)) / (totalTimeMs / 1000)).toFixed(1);

      setEncryptionResult({
        fileName: file.name,
        originalSize: file.size,
        encryptedSize: enc.ciphertext.length,
        mimeType: file.type || 'application/octet-stream',
        saltHex: enc.saltHex,
        ivHex: enc.ivHex,
        authTagHex: enc.authTagHex,
        salt: enc.salt,
        iv: enc.iv,
        ciphertext: enc.ciphertext,
        iterations: enc.iterations,
        checksum,
        timeMs: totalTimeMs,
        speedMBs: isFinite(speedMBs) && speedMBs > 0 ? speedMBs : 'Fast'
      });

      notify.success('AES-256-GCM encryption completed in ' + totalTimeMs + 'ms');
    } catch (err) {
      console.error(err);
      notify.error('Encryption failed: ' + err.message);
    } finally {
      setIsEncrypting(false);
    }
  };

  // Download portable .svault package
  const handleDownloadStandalone = () => {
    if (!encryptionResult) return;

    const envelope = packVaultEnvelope({
      ciphertext: encryptionResult.ciphertext,
      salt: encryptionResult.salt,
      iv: encryptionResult.iv,
      metadata: {
        fileName: encryptionResult.fileName,
        mimeType: encryptionResult.mimeType,
        originalSizeBytes: encryptionResult.originalSize,
        algorithm: 'AES-256-GCM',
        kdf: 'PBKDF2-SHA-256',
        iterations: encryptionResult.iterations,
        createdAt: new Date().toISOString()
      }
    });

    const blob = new Blob([envelope], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${encryptionResult.fileName}.svault`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    notify.success(`Exported portable ${encryptionResult.fileName}.svault package.`);
  };

  // Upload encrypted result to user's private vault
  const handleSaveToVault = async () => {
    if (!encryptionResult) return;
    try {
      const formData = new FormData();
      const encryptedBlob = new Blob([encryptionResult.ciphertext], { type: 'application/octet-stream' });

      formData.append('encryptedFile', encryptedBlob, `${encryptionResult.fileName}.enc`);
      formData.append('fileName', encryptionResult.fileName);
      formData.append('originalMimeType', encryptionResult.mimeType);
      formData.append('originalSizeBytes', encryptionResult.originalSize.toString());
      formData.append('saltHex', encryptionResult.saltHex);
      formData.append('ivHex', encryptionResult.ivHex);
      formData.append('authTagHex', encryptionResult.authTagHex);
      formData.append('algorithm', 'AES-256-GCM');
      formData.append('keyDerivation', 'PBKDF2-SHA-256');
      formData.append('pbkdf2Iterations', encryptionResult.iterations.toString());

      await apiRequest('/files/upload-encrypted', {
        method: 'POST',
        body: formData
      });

      notify.success('Saved encrypted file to your secure private vault!');
    } catch (err) {
      notify.error(err.message || 'Failed to save to vault.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Encryption Studio</h1>
        <p className="text-xs text-slate-400 mt-1">
          Cryptographic laboratory: inspect salts, initialization vectors, authentication tags, and export portable packages.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Input Form */}
        <div className="lg:col-span-2 space-y-5">
          <div className="vault-card p-6 space-y-4">
            {/* File selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Target File
              </label>
              <div className="relative">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="vault-input file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-vault-800 file:text-cyan-400 hover:file:bg-vault-700 cursor-pointer"
                />
              </div>
              {file && (
                <div className="mt-2 text-xs text-slate-400 font-mono flex items-center justify-between">
                  <span>Size: {formatBytes(file.size)}</span>
                  <span>Type: {file.type || 'Binary / Unknown'}</span>
                </div>
              )}
            </div>

            {/* Password input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Encryption Secret / Passphrase
                </label>
                <button
                  type="button"
                  onClick={handleGenerateKey}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Key</span>
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter or generate secret key"
                  className="vault-input pl-10 font-mono text-sm"
                />
              </div>
              <PasswordStrengthMeter password={password} />
            </div>

            {/* PBKDF2 Iteration Setting */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                PBKDF2 Key Derivation Iterations
              </label>
              <select
                value={iterations}
                onChange={(e) => setIterations(parseInt(e.target.value, 10))}
                className="vault-input font-mono text-xs"
              >
                <option value={100000}>100,000 Iterations (Recommended standard)</option>
                <option value={150000}>150,000 Iterations (High resistance)</option>
                <option value={250000}>250,000 Iterations (Maximum resistance)</option>
              </select>
            </div>

            <button
              onClick={handleRunEncryption}
              disabled={isEncrypting || !file || !password || password.length < 8}
              className="w-full vault-btn-primary py-3"
            >
              {isEncrypting ? (
                <span>Deriving Key & Encrypting...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Execute AES-256-GCM Encryption</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Cryptography Summary */}
        <div className="space-y-4">
          <div className="vault-card p-5 space-y-3 text-xs">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Cryptographic Specs</span>
            </h3>
            <div className="space-y-2 text-slate-300 font-mono text-[11px]">
              <div className="p-2 rounded bg-vault-950 border border-vault-800">
                <div className="text-slate-500">Algorithm</div>
                <div className="text-cyan-400 font-semibold">AES-256-GCM</div>
              </div>
              <div className="p-2 rounded bg-vault-950 border border-vault-800">
                <div className="text-slate-500">Key Derivation</div>
                <div className="text-slate-200">PBKDF2-HMAC-SHA-256</div>
              </div>
              <div className="p-2 rounded bg-vault-950 border border-vault-800">
                <div className="text-slate-500">Salt Entropy</div>
                <div className="text-emerald-400">128 bits (16 bytes random)</div>
              </div>
              <div className="p-2 rounded bg-vault-950 border border-vault-800">
                <div className="text-slate-500">GCM IV</div>
                <div className="text-emerald-400">96 bits (12 bytes unique)</div>
              </div>
              <div className="p-2 rounded bg-vault-950 border border-vault-800">
                <div className="text-slate-500">Auth Tag</div>
                <div className="text-emerald-400">128-bit MAC tag</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Cryptographic Result Inspection */}
      {encryptionResult && (
        <div className="vault-card p-6 border-cyan-500/40 space-y-5 animate-in slide-in-from-bottom-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-vault-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Encryption Verified</h3>
                <p className="text-xs text-slate-300">
                  {encryptionResult.fileName} • {formatBytes(encryptionResult.originalSize)} ➔ {formatBytes(encryptionResult.encryptedSize)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-2.5 py-1 rounded bg-vault-800 text-cyan-400 border border-vault-700">
                ⏱️ {encryptionResult.timeMs}ms
              </span>
              <span className="px-2.5 py-1 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-400">
                🚀 {encryptionResult.speedMBs} MB/s
              </span>
            </div>
          </div>

          {/* Cryptographic Inspector Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Salt */}
            <div className="p-3 rounded-xl bg-vault-950 border border-vault-800 space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span>Unique Random Salt (16 bytes / 128-bit):</span>
                <button
                  onClick={() => handleCopy(encryptionResult.saltHex, 'Salt')}
                  className="hover:text-cyan-400 text-slate-400"
                >
                  {copiedField === 'Salt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-slate-200 break-all text-[11px]">{encryptionResult.saltHex}</p>
            </div>

            {/* IV */}
            <div className="p-3 rounded-xl bg-vault-950 border border-vault-800 space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span>Unique IV (12 bytes / 96-bit NIST):</span>
                <button
                  onClick={() => handleCopy(encryptionResult.ivHex, 'IV')}
                  className="hover:text-cyan-400 text-slate-400"
                >
                  {copiedField === 'IV' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-slate-200 break-all text-[11px]">{encryptionResult.ivHex}</p>
            </div>

            {/* Auth Tag */}
            <div className="p-3 rounded-xl bg-vault-950 border border-vault-800 space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span>Authentication Tag (16 bytes / 128-bit):</span>
                <button
                  onClick={() => handleCopy(encryptionResult.authTagHex, 'Auth Tag')}
                  className="hover:text-cyan-400 text-slate-400"
                >
                  {copiedField === 'Auth Tag' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-emerald-400 break-all text-[11px]">{encryptionResult.authTagHex}</p>
            </div>

            {/* SHA-256 Checksum */}
            <div className="p-3 rounded-xl bg-vault-950 border border-vault-800 space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span>Ciphertext SHA-256 Checksum:</span>
                <button
                  onClick={() => handleCopy(encryptionResult.checksum, 'Checksum')}
                  className="hover:text-cyan-400 text-slate-400"
                >
                  {copiedField === 'Checksum' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-cyan-300 break-all text-[11px]">{encryptionResult.checksum}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
            <button
              onClick={handleSaveToVault}
              className="w-full sm:w-auto vault-btn-primary flex items-center justify-center gap-2"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Save to Secure Cloud Vault</span>
            </button>
            <button
              onClick={handleDownloadStandalone}
              className="w-full sm:w-auto vault-btn-secondary flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Export Portable .svault Package</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
