import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api.js';
import { useNotification } from '../context/NotificationContext.jsx';
import { decryptBuffer } from '../crypto/webcrypto.js';
import { packVaultEnvelope } from '../crypto/envelope.js';
import { formatBytes, formatDate } from '../utils/formatters.js';
import FilePreviewModal from '../components/FilePreviewModal.jsx';
import {
  FolderLock,
  Search,
  Filter,
  FileText,
  Image as ImageIcon,
  Video,
  Archive,
  File,
  Download,
  Trash2,
  Unlock,
  Info,
  ShieldCheck,
  RefreshCw,
  Lock,
  X,
  AlertTriangle,
  Key
} from 'lucide-react';

export default function SecureVaultPage({ initialFileToDecryptId = null, onClearDecryptTarget }) {
  const notify = useNotification();

  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Selected file for Decryption Modal
  const [decryptModalFile, setDecryptModalFile] = useState(null);
  const [decryptPassword, setDecryptPassword] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedFileResult, setDecryptedFileResult] = useState(null);

  // Selected file for Metadata Modal
  const [infoModalFile, setInfoModalFile] = useState(null);

  // Selected file for Delete Confirmation Modal
  const [deleteModalFile, setDeleteModalFile] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch files from server
  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        category: selectedCategory,
        sortBy,
        sortOrder
      });
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const res = await apiRequest(`/files?${params.toString()}`);
      setFiles(res.files || []);

      // If initialFileToDecryptId was passed, trigger its decryption modal
      if (initialFileToDecryptId && res.files) {
        const target = res.files.find(f => f.id === initialFileToDecryptId);
        if (target) {
          setDecryptModalFile(target);
          if (onClearDecryptTarget) onClearDecryptTarget();
        }
      }
    } catch (err) {
      console.error('Failed to load files:', err);
      notify.error('Failed to load vault files: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [selectedCategory, sortBy, sortOrder]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadFiles();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle in-memory Decryption of vault file
  const handleDecryptSubmit = async (e) => {
    e.preventDefault();
    if (!decryptModalFile || !decryptPassword) return;

    setIsDecrypting(true);
    try {
      // 1. Fetch raw encrypted blob from authenticated endpoint
      const blob = await apiRequest(`/files/${decryptModalFile.id}/download-encrypted`, {
        asBlob: true
      });
      const ciphertextBuffer = await blob.arrayBuffer();

      // 2. Perform AES-256-GCM Decryption locally using stored Salt & IV
      const decryptedPlaintext = await decryptBuffer(
        ciphertextBuffer,
        decryptPassword,
        decryptModalFile.salt_hex,
        decryptModalFile.iv_hex,
        decryptModalFile.pbkdf2_iterations || 100000
      );

      // 3. Log client decryption event to server audit trail (no secrets logged!)
      apiRequest('/activity/log', {
        method: 'POST',
        body: JSON.stringify({
          actionType: 'FILE_DECRYPTED',
          details: {
            fileId: decryptModalFile.id,
            fileName: decryptModalFile.file_name,
            size: decryptModalFile.original_size_bytes
          }
        })
      }).catch(() => {});

      notify.success('File successfully decrypted in memory!');
      setDecryptedFileResult({
        fileName: decryptModalFile.file_name,
        mimeType: decryptModalFile.original_mime_type,
        size: decryptModalFile.original_size_bytes,
        buffer: decryptedPlaintext
      });
      setDecryptModalFile(null);
      setDecryptPassword('');
    } catch (err) {
      console.error('Decryption failed:', err);
      notify.error(err.message || 'Decryption failed. Incorrect password or corrupted payload.');
    } finally {
      setIsDecrypting(false);
    }
  };

  // Download raw encrypted file or .svault package
  const handleDownloadEncrypted = async (file) => {
    try {
      const blob = await apiRequest(`/files/${file.id}/download-encrypted`, { asBlob: true });
      const buffer = await blob.arrayBuffer();

      // Package into standalone .svault format
      const envelope = packVaultEnvelope({
        ciphertext: new Uint8Array(buffer),
        salt: file.salt_hex,
        iv: file.iv_hex,
        metadata: {
          fileName: file.file_name,
          mimeType: file.original_mime_type,
          originalSizeBytes: file.original_size_bytes,
          algorithm: file.encryption_algorithm,
          kdf: file.key_derivation,
          iterations: file.pbkdf2_iterations,
          checksum: file.sha256_checksum,
          vaultId: file.id
        }
      });

      const exportBlob = new Blob([envelope], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(exportBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.file_name}.svault`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notify.success(`Downloaded portable encrypted ${file.file_name}.svault package`);
    } catch (err) {
      notify.error('Download failed: ' + err.message);
    }
  };

  // Delete file permanently
  const handleDeleteConfirm = async () => {
    if (!deleteModalFile) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/files/${deleteModalFile.id}`, { method: 'DELETE' });
      notify.success(`"${deleteModalFile.file_name}" permanently deleted from vault.`);
      setFiles(prev => prev.filter(f => f.id !== deleteModalFile.id));
      setDeleteModalFile(null);
    } catch (err) {
      notify.error('Failed to delete file: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'image': return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case 'video': return <Video className="w-4 h-4 text-purple-400" />;
      case 'archive': return <Archive className="w-4 h-4 text-amber-400" />;
      default: return <FileText className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-vault-850">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FolderLock className="w-6 h-6 text-cyan-400" />
            <span>Secure Vault</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Private encrypted repository. All files are stored as AES-256-GCM ciphertexts.
          </p>
        </div>

        <button
          onClick={loadFiles}
          className="vault-btn-secondary text-xs self-start sm:self-auto"
          title="Refresh vault contents"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="vault-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search encrypted files by name..."
            className="vault-input pl-10"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: 'all', label: 'All Files' },
            { id: 'document', label: 'Documents' },
            { id: 'image', label: 'Images' },
            { id: 'video', label: 'Videos' },
            { id: 'archive', label: 'Archives' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedCategory === cat.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-vault-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [col, dir] = e.target.value.split(':');
              setSortBy(col);
              setSortOrder(dir);
            }}
            className="vault-input py-1.5 px-3 text-xs"
          >
            <option value="created_at:DESC">Date: Newest First</option>
            <option value="created_at:ASC">Date: Oldest First</option>
            <option value="file_name:ASC">Name: A to Z</option>
            <option value="file_name:DESC">Name: Z to A</option>
            <option value="encrypted_size_bytes:DESC">Size: Largest</option>
            <option value="encrypted_size_bytes:ASC">Size: Smallest</option>
          </select>
        </div>
      </div>

      {/* Files Display */}
      {isLoading ? (
        <div className="p-12 text-center text-cyan-400 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading encrypted file index...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="vault-card p-12 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-vault-800 flex items-center justify-center text-slate-500">
            <FolderLock className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-200">No Encrypted Files Found</h3>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? 'No files match your query.' : 'Your vault is ready. Upload and encrypt your first file.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="vault-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-vault-950/80 border-b border-vault-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Plaintext / Encrypted Size</th>
                  <th className="py-3 px-4">Encryption Spec</th>
                  <th className="py-3 px-4">Date Vaulted</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vault-850 text-slate-300">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-vault-850/50 transition-colors group">
                    <td className="py-3.5 px-4 font-medium text-white flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-vault-800 border border-vault-700">
                        {getCategoryIcon(file.file_category)}
                      </div>
                      <div className="min-w-0">
                        <span className="block font-semibold text-slate-200 truncate max-w-[180px] sm:max-w-xs">
                          {file.file_name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ID: {file.id.substring(0, 8)}...
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 capitalize text-slate-400">
                      {file.file_category}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <div>{formatBytes(file.original_size_bytes)}</div>
                      <div className="text-[10px] text-slate-500">
                        Encrypted: {formatBytes(file.encrypted_size_bytes)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                        <ShieldCheck className="w-3 h-3" />
                        <span>AES-256-GCM</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400">
                      {formatDate(file.created_at)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Decrypt Button */}
                        <button
                          onClick={() => setDecryptModalFile(file)}
                          title="Decrypt with password in browser memory"
                          className="px-2.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 font-medium transition-colors"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Decrypt</span>
                        </button>

                        {/* Download Encrypted Package */}
                        <button
                          onClick={() => handleDownloadEncrypted(file)}
                          title="Download encrypted .svault package"
                          className="p-1.5 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-300 hover:text-white border border-vault-700 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* File Info */}
                        <button
                          onClick={() => setInfoModalFile(file)}
                          title="Cryptographic Metadata"
                          className="p-1.5 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-300 hover:text-cyan-400 border border-vault-700 transition-colors"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteModalFile(file)}
                          title="Permanently erase from vault"
                          className="p-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Decryption Password Prompt Modal */}
      {decryptModalFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-2xl bg-vault-900 border border-vault-700 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-vault-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-600/20 text-cyan-400">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Decrypt Vault File</h3>
                  <p className="text-xs text-slate-400 truncate max-w-[240px]">
                    {decryptModalFile.file_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setDecryptModalFile(null);
                  setDecryptPassword('');
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDecryptSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Enter Encryption Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    autoFocus
                    required
                    value={decryptPassword}
                    onChange={(e) => setDecryptPassword(e.target.value)}
                    placeholder="Enter file password"
                    className="vault-input pl-10 font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Decryption verifies the 128-bit GCM authentication tag locally in browser memory.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDecryptModalFile(null);
                    setDecryptPassword('');
                  }}
                  className="vault-btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDecrypting || !decryptPassword}
                  className="vault-btn-primary flex-1"
                >
                  {isDecrypting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Decrypting...</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>Authenticate & Decrypt</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cryptographic Metadata Info Modal */}
      {infoModalFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-vault-900 border border-vault-700 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-vault-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-vault-800 text-cyan-400">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Cryptographic Envelope Metadata</h3>
                  <p className="text-xs text-slate-400">{infoModalFile.file_name}</p>
                </div>
              </div>
              <button
                onClick={() => setInfoModalFile(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs text-slate-300">
              <div className="p-2.5 rounded-lg bg-vault-950 border border-vault-800">
                <span className="text-slate-500 block text-[10px] uppercase">File ID (UUID):</span>
                <span className="text-cyan-400 break-all">{infoModalFile.id}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-vault-950 border border-vault-800">
                <span className="text-slate-500 block text-[10px] uppercase">Algorithm & Key Derivation:</span>
                <span>{infoModalFile.encryption_algorithm} • {infoModalFile.key_derivation} ({infoModalFile.pbkdf2_iterations} iter)</span>
              </div>

              <div className="p-2.5 rounded-lg bg-vault-950 border border-vault-800">
                <span className="text-slate-500 block text-[10px] uppercase">Unique Salt (Hex, 16 bytes):</span>
                <span className="break-all text-slate-200">{infoModalFile.salt_hex}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-vault-950 border border-vault-800">
                <span className="text-slate-500 block text-[10px] uppercase">Unique IV (Hex, 12 bytes):</span>
                <span className="break-all text-slate-200">{infoModalFile.iv_hex}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-vault-950 border border-vault-800">
                <span className="text-slate-500 block text-[10px] uppercase">Ciphertext SHA-256 Checksum:</span>
                <span className="break-all text-emerald-400">{infoModalFile.sha256_checksum}</span>
              </div>
            </div>

            <div className="text-right">
              <button
                onClick={() => setInfoModalFile(null)}
                className="vault-btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-2xl bg-vault-900 border border-red-500/40 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Permanently Delete File?</h3>
              <p className="text-xs text-slate-300 mt-2">
                Are you sure you want to delete <span className="text-white font-semibold">{deleteModalFile.file_name}</span>?
              </p>
              <p className="text-[11px] text-red-400 mt-1">
                This will permanently shred and erase the encrypted ciphertext from private disk storage. This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteModalFile(null)}
                className="vault-btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="vault-btn-danger flex-1"
              >
                {isDeleting ? 'Deleting...' : 'Erase File'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Memory Decrypted File Preview Modal */}
      {decryptedFileResult && (
        <FilePreviewModal
          decryptedFile={decryptedFileResult}
          onClose={() => setDecryptedFileResult(null)}
        />
      )}
    </div>
  );
}
