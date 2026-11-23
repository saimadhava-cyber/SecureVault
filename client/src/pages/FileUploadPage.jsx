import React, { useState, useRef } from 'react';
import { useNotification } from '../context/NotificationContext.jsx';
import { encryptBuffer, computeSha256 } from '../crypto/webcrypto.js';
import { apiRequest } from '../utils/api.js';
import { formatBytes, generateRandomPassphrase } from '../utils/formatters.js';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx';
import {
  Upload,
  Lock,
  FileText,
  Image as ImageIcon,
  Video,
  Archive,
  File,
  CheckCircle2,
  X,
  Key,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Cpu
} from 'lucide-react';

export default function FileUploadPage({ onUploadSuccess }) {
  const notify = useNotification();
  const fileInputRef = useRef(null);

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [password, setPassword] = useState('');
  const [iterations, setIterations] = useState(100000);
  const [previews, setPreviews] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [uploadResults, setUploadResults] = useState([]);

  // Handle files selected via file input or drag-and-drop
  const handleFileSelect = (filesList) => {
    const validFiles = Array.from(filesList).filter(f => {
      if (f.size > 100 * 1024 * 1024) {
        notify.error(`File "${f.name}" exceeds maximum allowed 100MB limit.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setSelectedFiles(prev => [...prev, ...validFiles]);

    // Generate previews for images
    validFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviews(prev => ({ ...prev, [file.name]: e.target.result }));
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleGeneratePassphrase = () => {
    const pass = generateRandomPassphrase(20);
    setPassword(pass);
    notify.info('Generated cryptographically secure 20-character passphrase.');
  };

  // Perform client-side encryption and upload for each file
  const handleEncryptAndUpload = async () => {
    if (selectedFiles.length === 0) {
      notify.error('Please select at least one file to encrypt.');
      return;
    }

    if (!password || password.length < 8) {
      notify.error('Please provide an encryption password (minimum 8 characters).');
      return;
    }

    setIsProcessing(true);
    const results = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setProgressStatus(`Encrypting ${file.name} locally with AES-256-GCM (${i + 1}/${selectedFiles.length})...`);

        // 1. Read plaintext into ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // 2. Encrypt locally in browser with Web Crypto API
        const encryptedData = await encryptBuffer(arrayBuffer, password, { iterations });

        setProgressStatus(`Uploading encrypted payload for ${file.name} to private vault...`);

        // 3. Prepare FormData containing ONLY the encrypted ciphertext blob and cryptographic parameters
        const formData = new FormData();
        const encryptedBlob = new Blob([encryptedData.ciphertext], { type: 'application/octet-stream' });

        formData.append('encryptedFile', encryptedBlob, `${file.name}.enc`);
        formData.append('fileName', file.name);
        formData.append('originalMimeType', file.type || 'application/octet-stream');
        formData.append('originalSizeBytes', file.size.toString());
        formData.append('saltHex', encryptedData.saltHex);
        formData.append('ivHex', encryptedData.ivHex);
        formData.append('authTagHex', encryptedData.authTagHex);
        formData.append('algorithm', 'AES-256-GCM');
        formData.append('keyDerivation', 'PBKDF2-SHA-256');
        formData.append('pbkdf2Iterations', iterations.toString());

        // 4. Send to authenticated API
        const response = await apiRequest('/files/upload-encrypted', {
          method: 'POST',
          body: formData
        });

        results.push({
          file: response.file,
          originalName: file.name,
          originalSize: file.size,
          saltHex: encryptedData.saltHex,
          ivHex: encryptedData.ivHex,
          authTagHex: encryptedData.authTagHex
        });
      }

      setUploadResults(results);
      setSelectedFiles([]);
      setPreviews({});
      notify.success(`Successfully encrypted and vaulted ${results.length} file(s)!`);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      console.error('Encryption or upload failed:', err);
      notify.error(err.message || 'Encryption or upload failed.');
    } finally {
      setIsProcessing(false);
      setProgressStatus('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Upload & Client-Side Encryption</h1>
        <p className="text-xs text-slate-400 mt-1">
          Files are encrypted directly in your browser memory before any network transfer.
        </p>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className="vault-card border-2 border-dashed border-vault-700/80 hover:border-cyan-500/60 p-8 sm:p-12 text-center cursor-pointer transition-all group"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        <div className="w-16 h-16 mx-auto rounded-2xl bg-vault-800/80 border border-vault-700 group-hover:scale-110 group-hover:border-cyan-500/50 flex items-center justify-center text-cyan-400 transition-all shadow-lg">
          <Upload className="w-8 h-8" />
        </div>

        <h3 className="text-base font-bold text-white mt-4">
          Drag & Drop Files Here or <span className="text-cyan-400 underline">Browse</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto">
          Supports PDF, DOC/DOCX, TXT, JPG, PNG, MP4, ZIP and other binary formats up to 100MB per file.
        </p>
        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>AES-256-GCM • Plaintext never leaves device</span>
        </div>
      </div>

      {/* Selected Files Preview List */}
      {selectedFiles.length > 0 && (
        <div className="vault-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-vault-800 pb-3">
            <h3 className="text-sm font-bold text-white">
              Selected Files for Encryption ({selectedFiles.length})
            </h3>
            <button
              onClick={() => {
                setSelectedFiles([]);
                setPreviews({});
              }}
              className="text-xs text-slate-400 hover:text-red-400 transition-colors"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
            {selectedFiles.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl bg-vault-850 border border-vault-700/60 relative group"
              >
                {previews[f.name] ? (
                  <img
                    src={previews[f.name]}
                    alt={f.name}
                    className="w-10 h-10 rounded-lg object-cover border border-vault-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-vault-800 flex items-center justify-center text-cyan-400 flex-shrink-0">
                    {f.type.startsWith('video/') ? (
                      <Video className="w-5 h-5" />
                    ) : f.type.includes('pdf') || f.type.includes('document') ? (
                      <FileText className="w-5 h-5" />
                    ) : (
                      <File className="w-5 h-5" />
                    )}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">{f.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{formatBytes(f.size)}</p>
                </div>

                <button
                  onClick={() => removeFile(i)}
                  className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-vault-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Cryptographic Key Parameters Setup */}
          <div className="pt-4 border-t border-vault-800 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Encryption Password / Key
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassphrase}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Strong Key</span>
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter or generate a secret encryption password"
                  className="vault-input pl-10 font-mono text-sm"
                />
              </div>
              <PasswordStrengthMeter password={password} />
            </div>

            {/* Configurable Iterations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  PBKDF2 SHA-256 Iterations
                </label>
                <select
                  value={iterations}
                  onChange={(e) => setIterations(parseInt(e.target.value, 10))}
                  className="vault-input font-mono text-xs"
                >
                  <option value={100000}>100,000 Iterations (Recommended standard)</option>
                  <option value={150000}>150,000 Iterations (High security)</option>
                  <option value={250000}>250,000 Iterations (Maximum security)</option>
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <div className="p-2.5 rounded-lg bg-vault-950/80 border border-vault-800 text-[11px] text-slate-400 font-mono">
                  AES-256-GCM • Unique 96-bit IV generated per file • Unique 128-bit Salt
                </div>
              </div>
            </div>

            {/* Execute Button */}
            <button
              onClick={handleEncryptAndUpload}
              disabled={isProcessing || !password || password.length < 8}
              className="w-full vault-btn-primary py-3 text-base shadow-xl"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>{progressStatus || 'Processing...'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>Encrypt & Upload to Secure Vault</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Card when Encryption Completed */}
      {uploadResults.length > 0 && (
        <div className="vault-card p-6 border-emerald-500/40 bg-emerald-950/20 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Client-Side Encryption Successful
              </h3>
              <p className="text-xs text-slate-300">
                {uploadResults.length} file(s) encrypted with AES-256-GCM and saved in private storage.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {uploadResults.map((r, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-vault-900 border border-vault-800 text-xs space-y-2">
                <div className="flex justify-between items-center font-bold text-slate-200">
                  <span>{r.originalName}</span>
                  <span className="font-mono text-cyan-400">{formatBytes(r.originalSize)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                  <div>
                    <span className="text-slate-500">Salt (128-bit): </span>
                    <span className="text-slate-300 break-all">{r.saltHex}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">IV (96-bit): </span>
                    <span className="text-slate-300 break-all">{r.ivHex}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500">Auth Tag (128-bit): </span>
                    <span className="text-emerald-400 break-all">{r.authTagHex}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-right">
            <button
              onClick={() => setUploadResults([])}
              className="vault-btn-secondary text-xs"
            >
              Dismiss Confirmation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
