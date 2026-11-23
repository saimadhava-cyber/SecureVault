import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api.js';
import { useNotification } from '../context/NotificationContext.jsx';
import { decryptBuffer } from '../crypto/webcrypto.js';
import { unpackVaultEnvelope } from '../crypto/envelope.js';
import { formatBytes } from '../utils/formatters.js';
import FilePreviewModal from '../components/FilePreviewModal.jsx';
import {
  Unlock,
  Key,
  Upload,
  FolderLock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  RefreshCw,
  ShieldCheck,
  FileCheck2,
  HardDrive
} from 'lucide-react';

export default function FileDecryptionPage({ initialVaultFileId = null }) {
  const notify = useNotification();

  const [mode, setMode] = useState('standalone'); // 'standalone' | 'vault'
  const [vaultFiles, setVaultFiles] = useState([]);
  const [selectedVaultFileId, setSelectedVaultFileId] = useState(initialVaultFileId || '');

  // Standalone file state
  const [standaloneFile, setStandaloneFile] = useState(null);
  const [unpackedPackage, setUnpackedPackage] = useState(null);

  // Common password and state
  const [password, setPassword] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [decryptedResult, setDecryptedResult] = useState(null);

  // Load user's vault files for mode === 'vault'
  useEffect(() => {
    async function loadVault() {
      try {
        const res = await apiRequest('/files');
        setVaultFiles(res.files || []);
        if (initialVaultFileId) {
          setSelectedVaultFileId(initialVaultFileId);
          setMode('vault');
        } else if (res.files && res.files.length > 0) {
          setSelectedVaultFileId(res.files[0].id);
        }
      } catch (err) {
        console.warn('Could not fetch vault files:', err);
      }
    }
    loadVault();
  }, [initialVaultFileId]);

  // Handle standalone .svault file drop / select
  const handleStandaloneSelect = async (selected) => {
    if (!selected) return;
    setStandaloneFile(selected);
    setErrorMsg('');
    setDecryptedResult(null);

    try {
      const buffer = await selected.arrayBuffer();
      // Try unpacking .svault envelope
      const unpacked = unpackVaultEnvelope(buffer);
      setUnpackedPackage(unpacked);
      notify.info(`Loaded .svault package: "${unpacked.metadata.fileName || selected.name}"`);
    } catch (err) {
      // If not .svault envelope, user will need to provide raw file + manual salt/iv if known, or notify
      setUnpackedPackage(null);
      notify.warning('Selected file does not contain a standard .svault magic header. Standalone envelope recommended.');
    }
  };

  // Perform Decryption
  const handleDecrypt = async (e) => {
    e.preventDefault();
    if (!password) {
      notify.error('Please enter the decryption password.');
      return;
    }

    setIsDecrypting(true);
    setErrorMsg('');
    setDecryptedResult(null);

    try {
      let plaintextBuffer = null;
      let targetName = 'decrypted-file';
      let targetMime = 'application/octet-stream';
      let targetSize = 0;

      if (mode === 'vault') {
        const fileObj = vaultFiles.find(f => f.id === selectedVaultFileId);
        if (!fileObj) throw new Error('Selected vault file not found.');

        targetName = fileObj.file_name;
        targetMime = fileObj.original_mime_type;
        targetSize = fileObj.original_size_bytes;

        // Fetch ciphertext from server
        const blob = await apiRequest(`/files/${fileObj.id}/download-encrypted`, { asBlob: true });
        const ciphertextBuffer = await blob.arrayBuffer();

        // Decrypt with AES-256-GCM
        plaintextBuffer = await decryptBuffer(
          ciphertextBuffer,
          password,
          fileObj.salt_hex,
          fileObj.iv_hex,
          fileObj.pbkdf2_iterations || 100000
        );

        // Audit log
        apiRequest('/activity/log', {
          method: 'POST',
          body: JSON.stringify({
            actionType: 'FILE_DECRYPTED',
            details: { fileId: fileObj.id, fileName: fileObj.file_name }
          })
        }).catch(() => {});
      } else {
        // Standalone mode
        if (!standaloneFile) throw new Error('Please select an encrypted .svault file.');

        if (unpackedPackage) {
          targetName = unpackedPackage.metadata.fileName || standaloneFile.name.replace('.svault', '');
          targetMime = unpackedPackage.metadata.mimeType || 'application/octet-stream';
          targetSize = unpackedPackage.metadata.originalSizeBytes || 0;

          plaintextBuffer = await decryptBuffer(
            unpackedPackage.ciphertext,
            password,
            unpackedPackage.salt,
            unpackedPackage.iv,
            unpackedPackage.metadata.iterations || 100000
          );
        } else {
          throw new Error('Please select a valid .svault envelope file containing cryptographic headers.');
        }
      }

      notify.success('Authentication Tag Verified! File Decrypted Successfully.');
      setDecryptedResult({
        fileName: targetName,
        mimeType: targetMime,
        size: targetSize || plaintextBuffer.byteLength,
        buffer: plaintextBuffer
      });
    } catch (err) {
      console.error('Decryption failed:', err);
      setErrorMsg(
        err.message ||
        'Decryption failed: Incorrect encryption password or the encrypted file was tampered with.'
      );
      notify.error('Decryption failed. Please check password.');
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Unlock className="w-6 h-6 text-cyan-400" />
          <span>File Decryption Center</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Decrypt encrypted files directly in your browser memory. Decrypted plaintext is never sent to the server.
        </p>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex border-b border-vault-800 gap-4 text-sm font-semibold">
        <button
          onClick={() => {
            setMode('standalone');
            setErrorMsg('');
          }}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-all ${
            mode === 'standalone'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Offline .svault Package Decryptor</span>
        </button>

        <button
          onClick={() => {
            setMode('vault');
            setErrorMsg('');
          }}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-all ${
            mode === 'vault'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderLock className="w-4 h-4" />
          <span>Decrypt from Secure Vault</span>
        </button>
      </div>

      <div className="vault-card p-6 space-y-5">
        {/* Mode 1: Offline / Standalone Envelope File */}
        {mode === 'standalone' && (
          <div className="space-y-4">
            <label className="block text-xs font-semibold text-slate-300">
              Select Encrypted .svault File
            </label>
            <div className="border-2 border-dashed border-vault-700 hover:border-cyan-500/60 p-6 rounded-xl text-center cursor-pointer transition-colors bg-vault-950/40 relative">
              <input
                type="file"
                accept=".svault,.enc"
                onChange={(e) => handleStandaloneSelect(e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="w-12 h-12 mx-auto rounded-xl bg-vault-800 text-cyan-400 flex items-center justify-center mb-2">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white">
                {standaloneFile ? standaloneFile.name : 'Choose or drop .svault file here'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Self-contained envelope created with SecureVault
              </p>
            </div>

            {unpackedPackage && (
              <div className="p-3.5 rounded-xl bg-vault-950 border border-vault-800 text-xs font-mono space-y-1 text-slate-300">
                <div className="text-cyan-400 font-bold">Envelope Headers Verified:</div>
                <div>Original Name: <span className="text-white">{unpackedPackage.metadata.fileName}</span></div>
                <div>Algorithm: <span className="text-emerald-400">{unpackedPackage.metadata.algorithm || 'AES-256-GCM'}</span></div>
                <div>Iterations: <span className="text-slate-400">{unpackedPackage.metadata.iterations || 100000}</span></div>
              </div>
            )}
          </div>
        )}

        {/* Mode 2: From Cloud Vault */}
        {mode === 'vault' && (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              Select Encrypted File from Your Vault
            </label>
            {vaultFiles.length === 0 ? (
              <div className="p-4 rounded-xl bg-vault-950 border border-vault-800 text-xs text-slate-400 text-center">
                Your vault is currently empty. Upload a file first.
              </div>
            ) : (
              <select
                value={selectedVaultFileId}
                onChange={(e) => setSelectedVaultFileId(e.target.value)}
                className="vault-input font-medium text-xs"
              >
                {vaultFiles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.file_name} ({formatBytes(f.encrypted_size_bytes)}) - Uploaded {new Date(f.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Password input form */}
        <form onSubmit={handleDecrypt} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Decryption Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Key className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password used when encrypting the file"
                className="vault-input pl-10 font-mono text-sm"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Cryptographic Decryption Error</p>
                <p className="mt-1 leading-relaxed">{errorMsg}</p>
                <p className="mt-2 text-[11px] text-red-300/80">
                  AES-256-GCM uses a 128-bit authentication tag. If the password is wrong or even a single byte of ciphertext was altered, the decryption will be rejected immediately.
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isDecrypting || !password || (mode === 'standalone' && !standaloneFile)}
            className="w-full vault-btn-primary py-3 text-sm shadow-xl"
          >
            {isDecrypting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Verifying Authentication Tag & Decrypting...</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span>Decrypt File in Memory</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Success Result Card */}
      {decryptedResult && (
        <div className="vault-card p-6 border-emerald-500/40 bg-emerald-950/20 space-y-4 animate-in slide-in-from-bottom-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Decryption Successful</h3>
                <p className="text-xs text-slate-300">
                  {decryptedResult.fileName} • {formatBytes(decryptedResult.size)} • Verified Authentic
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const blob = new Blob([decryptedResult.buffer], { type: decryptedResult.mimeType });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = decryptedResult.fileName;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="vault-btn-primary"
              >
                <Download className="w-4 h-4" />
                <span>Download File</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Memory Preview Modal */}
      {decryptedResult && (
        <FilePreviewModal
          decryptedFile={decryptedResult}
          onClose={() => setDecryptedResult(null)}
        />
      )}
    </div>
  );
}
