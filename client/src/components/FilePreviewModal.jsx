import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Image, Video, File, CheckCircle2 } from 'lucide-react';
import { formatBytes } from '../utils/formatters.js';

export default function FilePreviewModal({ decryptedFile, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [textContent, setTextContent] = useState('');

  useEffect(() => {
    if (!decryptedFile || !decryptedFile.buffer) return;

    const mime = decryptedFile.mimeType || 'application/octet-stream';
    const blob = new Blob([decryptedFile.buffer], { type: mime });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);

    // If text file, read text
    if (
      mime.startsWith('text/') ||
      mime.includes('json') ||
      mime.includes('javascript') ||
      mime.includes('xml') ||
      ['txt', 'csv', 'md', 'log'].some(ext => (decryptedFile.fileName || '').endsWith('.' + ext))
    ) {
      const reader = new FileReader();
      reader.onload = () => setTextContent(reader.result);
      reader.readAsText(blob);
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [decryptedFile]);

  if (!decryptedFile) return null;

  const mime = (decryptedFile.mimeType || '').toLowerCase();
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const isPdf = mime.includes('pdf');
  const isText = Boolean(textContent);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = decryptedFile.fileName || 'decrypted-file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-vault-900 border border-vault-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-vault-800 flex items-center justify-between bg-vault-950/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white truncate">
                {decryptedFile.fileName}
              </h3>
              <p className="text-xs text-slate-400">
                {formatBytes(decryptedFile.size)} • {decryptedFile.mimeType || 'Binary'} • Decrypted In-Memory
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-vault-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-vault-950/40 flex items-center justify-center min-h-[250px]">
          {isImage && blobUrl && (
            <img
              src={blobUrl}
              alt={decryptedFile.fileName}
              className="max-h-[60vh] max-w-full rounded-lg object-contain border border-vault-800 shadow-md"
            />
          )}

          {isVideo && blobUrl && (
            <video
              src={blobUrl}
              controls
              className="max-h-[60vh] max-w-full rounded-lg border border-vault-800 shadow-md"
            />
          )}

          {isPdf && blobUrl && (
            <iframe
              src={blobUrl}
              title="Decrypted PDF"
              className="w-full h-[60vh] rounded-lg border border-vault-800"
            />
          )}

          {isText && (
            <pre className="w-full max-h-[60vh] overflow-auto p-4 rounded-xl bg-vault-950 border border-vault-800 font-mono text-xs text-slate-200 whitespace-pre-wrap">
              {textContent}
            </pre>
          )}

          {!isImage && !isVideo && !isPdf && !isText && (
            <div className="text-center p-8 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-vault-800 flex items-center justify-center text-cyan-400">
                <File className="w-8 h-8" />
              </div>
              <p className="text-sm text-slate-300 font-medium">
                Binary or document format ready for download.
              </p>
              <p className="text-xs text-slate-500">
                This file format ({decryptedFile.mimeType || 'unknown'}) cannot be rendered in-browser preview, but has been verified and fully decrypted in browser memory.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-vault-800 bg-vault-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            🔒 File decrypted strictly in client memory. Never sent to server.
          </span>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="vault-btn-secondary flex-1 sm:flex-initial"
            >
              Clear & Close
            </button>
            <button
              onClick={handleDownload}
              className="vault-btn-primary flex-1 sm:flex-initial"
            >
              <Download className="w-4 h-4" />
              <span>Download Original File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
