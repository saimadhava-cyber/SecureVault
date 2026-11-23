import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api.js';
import { formatBytes, formatDate } from '../utils/formatters.js';
import {
  FileText,
  Image as ImageIcon,
  Video,
  Archive,
  HardDrive,
  Upload,
  Lock,
  Unlock,
  FolderLock,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  FileCheck2
} from 'lucide-react';

export default function DashboardPage({ onNavigate, onQuickDecrypt }) {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const data = await apiRequest('/files/stats');
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-cyan-400">
          <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-400">Loading Secure Vault Dashboard...</span>
        </div>
      </div>
    );
  }

  const totalFiles = stats?.totalFiles || 0;
  const totalEncryptedBytes = stats?.totalEncryptedSizeBytes || 0;
  const totalOriginalBytes = stats?.totalOriginalSizeBytes || 0;
  const recentFiles = stats?.recentFiles || [];

  const metrics = [
    {
      title: 'Total Files Stored',
      value: totalFiles,
      desc: 'Encrypted with AES-256-GCM',
      icon: FolderLock,
      color: 'from-blue-600 to-indigo-600',
      iconColor: 'text-blue-400'
    },
    {
      title: 'Encrypted Storage',
      value: formatBytes(totalEncryptedBytes),
      desc: `Raw plaintext: ${formatBytes(totalOriginalBytes)}`,
      icon: HardDrive,
      color: 'from-cyan-600 to-blue-600',
      iconColor: 'text-cyan-400'
    },
    {
      title: 'Documents',
      value: stats?.documentCount || 0,
      desc: 'PDF, Word, Text, Code',
      icon: FileText,
      color: 'from-blue-500 to-cyan-500',
      iconColor: 'text-blue-400'
    },
    {
      title: 'Images',
      value: stats?.imageCount || 0,
      desc: 'JPG, PNG, WebP, SVG',
      icon: ImageIcon,
      color: 'from-emerald-500 to-teal-500',
      iconColor: 'text-emerald-400'
    },
    {
      title: 'Videos',
      value: stats?.videoCount || 0,
      desc: 'MP4, MKV, MOV, WebM',
      icon: Video,
      color: 'from-purple-500 to-indigo-500',
      iconColor: 'text-purple-400'
    },
    {
      title: 'Archives & Other',
      value: (stats?.archiveCount || 0) + (stats?.otherCount || 0),
      desc: 'ZIP, 7Z, Binary blobs',
      icon: Archive,
      color: 'from-amber-500 to-orange-500',
      iconColor: 'text-amber-400'
    }
  ];

  // Calculate percentage for storage visualization
  const maxStorageEst = 100 * 1024 * 1024; // 100MB standard quota
  const storagePercentage = Math.min(100, Math.round((totalEncryptedBytes / maxStorageEst) * 100));

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome & Quick Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-vault-850">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Security Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of your client-side encrypted vault and storage telemetry.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate('upload')}
            className="vault-btn-primary"
          >
            <Upload className="w-4 h-4" />
            <span>Upload & Encrypt</span>
          </button>
          <button
            onClick={() => onNavigate('decrypt')}
            className="vault-btn-secondary"
          >
            <Unlock className="w-4 h-4" />
            <span>Decrypt File</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="vault-card p-5 space-y-3 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {m.title}
                </span>
                <div className="p-2 rounded-xl bg-vault-800 border border-vault-700/60 group-hover:scale-110 transition-transform">
                  <Icon className={`w-4 h-4 ${m.iconColor}`} />
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {m.value}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {m.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Storage Usage Visualization */}
      <div className="vault-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              <span>Encrypted Storage Utilization</span>
            </h3>
            <p className="text-xs text-slate-400">
              {formatBytes(totalEncryptedBytes)} used of 100 MB standard vault allowance ({storagePercentage}%)
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-full border border-cyan-500/30">
            {formatBytes(Math.max(0, maxStorageEst - totalEncryptedBytes))} Available
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-vault-950 rounded-full overflow-hidden p-0.5 border border-vault-800">
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400 rounded-full transition-all duration-500 shadow-md"
            style={{ width: `${Math.max(3, storagePercentage)}%` }}
          />
        </div>

        {/* Breakdown by category badges */}
        <div className="flex flex-wrap gap-4 text-xs text-slate-300 pt-1 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Documents ({stats?.documentCount || 0})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>Images ({stats?.imageCount || 0})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            <span>Videos ({stats?.videoCount || 0})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Archives ({stats?.archiveCount || 0})</span>
          </span>
        </div>
      </div>

      {/* Recent Uploaded Files */}
      <div className="vault-card overflow-hidden">
        <div className="p-5 border-b border-vault-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Recent Vault Activity</h3>
            <p className="text-xs text-slate-400">Your latest encrypted files in private storage</p>
          </div>
          <button
            onClick={() => onNavigate('vault')}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            <span>View All Files</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentFiles.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-vault-800/80 border border-vault-700/60 flex items-center justify-center text-slate-500">
              <FolderLock className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300">Your vault is currently empty</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Select your documents, images, or videos to encrypt with AES-256-GCM before uploading.
              </p>
            </div>
            <button
              onClick={() => onNavigate('upload')}
              className="vault-btn-primary"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Your First File</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-vault-950/60 border-b border-vault-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Encrypted Size</th>
                  <th className="py-3 px-4">Algorithm</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vault-850 text-slate-300">
                {recentFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-vault-850/40 transition-colors">
                    <td className="py-3 px-4 font-medium text-white flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-vault-800 text-cyan-400">
                        {file.file_category === 'image' ? (
                          <ImageIcon className="w-3.5 h-3.5" />
                        ) : file.file_category === 'video' ? (
                          <Video className="w-3.5 h-3.5" />
                        ) : file.file_category === 'archive' ? (
                          <Archive className="w-3.5 h-3.5" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <span className="truncate max-w-[200px] sm:max-w-xs">{file.file_name}</span>
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-400">{file.file_category}</td>
                    <td className="py-3 px-4 font-mono">{formatBytes(file.encrypted_size_bytes)}</td>
                    <td className="py-3 px-4 font-mono text-cyan-400">AES-256-GCM</td>
                    <td className="py-3 px-4 text-slate-400">{formatDate(file.created_at)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onQuickDecrypt(file.id)}
                        className="px-2.5 py-1 rounded bg-vault-800 hover:bg-cyan-600/20 text-cyan-400 hover:text-cyan-300 border border-vault-700 font-medium transition-colors"
                      >
                        Decrypt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
