import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api.js';
import { useNotification } from '../context/NotificationContext.jsx';
import { formatDate } from '../utils/formatters.js';
import {
  History,
  Download,
  Filter,
  RefreshCw,
  Lock,
  Unlock,
  Upload,
  Trash2,
  LogIn,
  LogOut,
  ShieldAlert,
  Key,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export default function ActivityHistoryPage() {
  const notify = useNotification();

  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('ALL');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const url = filterAction !== 'ALL' ? `/activity?action=${filterAction}` : '/activity';
      const res = await apiRequest(url);
      setLogs(res.logs || []);
    } catch (err) {
      console.error(err);
      notify.error('Failed to load activity logs: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterAction]);

  const handleExport = async () => {
    try {
      const res = await apiRequest('/activity/export');
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `securevault-activity-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify.success('Audit log export downloaded successfully.');
    } catch (err) {
      notify.error('Export failed: ' + err.message);
    }
  };

  const getActionBadge = (type) => {
    switch (type) {
      case 'FILE_UPLOADED':
        return {
          icon: Upload,
          label: 'File Uploaded',
          color: 'text-blue-400 bg-blue-950/80 border-blue-500/30'
        };
      case 'FILE_DECRYPTED':
        return {
          icon: Unlock,
          label: 'File Decrypted',
          color: 'text-emerald-400 bg-emerald-950/80 border-emerald-500/30'
        };
      case 'FILE_DOWNLOADED':
        return {
          icon: Download,
          label: 'File Downloaded',
          color: 'text-cyan-400 bg-cyan-950/80 border-cyan-500/30'
        };
      case 'FILE_DELETED':
        return {
          icon: Trash2,
          label: 'File Shredded',
          color: 'text-red-400 bg-red-950/80 border-red-500/30'
        };
      case 'LOGIN_SUCCESS':
      case 'BIOMETRIC_LOGIN':
        return {
          icon: LogIn,
          label: 'Login Success',
          color: 'text-emerald-400 bg-emerald-950/80 border-emerald-500/30'
        };
      case 'LOGIN_FAILED':
        return {
          icon: ShieldAlert,
          label: 'Failed Login',
          color: 'text-red-400 bg-red-950/80 border-red-500/30'
        };
      case 'PASSWORD_CHANGED':
      case 'PIN_CHANGED':
      case 'BIOMETRIC_REGISTERED':
        return {
          icon: Key,
          label: 'Security Updated',
          color: 'text-amber-400 bg-amber-950/80 border-amber-500/30'
        };
      default:
        return {
          icon: CheckCircle2,
          label: type.replace(/_/g, ' '),
          color: 'text-slate-300 bg-vault-850 border-vault-700'
        };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-vault-850">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <History className="w-6 h-6 text-cyan-400" />
            <span>Activity History & Audit Trail</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tamper-evident chronological audit log of cryptographic actions, vault operations, and authentication.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={fetchLogs}
            className="vault-btn-secondary text-xs"
            title="Refresh logs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExport}
            className="vault-btn-primary text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit Trail (JSON)</span>
          </button>
        </div>
      </div>

      {/* Privacy guarantee banner */}
      <div className="p-4 rounded-xl bg-vault-900 border border-vault-800 flex items-center gap-3 text-xs text-slate-400">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <div>
          <strong className="text-white">Strict Zero-Knowledge Policy:</strong> Passwords, unencrypted file bytes, and derived encryption keys are <span className="text-cyan-400">never logged, saved, or transmitted</span>.
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Filter by:
        </span>
        {[
          { id: 'ALL', label: 'All Activities' },
          { id: 'FILE_UPLOADED', label: 'Uploads' },
          { id: 'FILE_DECRYPTED', label: 'Decryptions' },
          { id: 'FILE_DOWNLOADED', label: 'Downloads' },
          { id: 'FILE_DELETED', label: 'Deletions' },
          { id: 'LOGIN_SUCCESS', label: 'Logins' }
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterAction(f.id)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterAction === f.id
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-vault-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Activity Table */}
      {isLoading ? (
        <div className="p-12 text-center text-cyan-400 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading audit log...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="vault-card p-12 text-center space-y-3">
          <History className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No activity logged yet</p>
          <p className="text-xs text-slate-500">Activities will be tracked as you upload, encrypt, and manage files.</p>
        </div>
      ) : (
        <div className="vault-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-vault-950/80 border-b border-vault-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4">IP & Client Device</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vault-850 text-slate-300">
                {logs.map((log) => {
                  const badge = getActionBadge(log.actionType);
                  const Icon = badge.icon;
                  return (
                    <tr key={log.id} className="hover:bg-vault-850/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${badge.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-200">
                        {log.details.fileName ? (
                          <div>
                            <span className="font-semibold text-white">{log.details.fileName}</span>
                            {log.details.size && (
                              <span className="text-slate-400 ml-2">({log.details.size} bytes)</span>
                            )}
                          </div>
                        ) : log.details.email ? (
                          <span>{log.details.email}</span>
                        ) : log.details.reason ? (
                          <span className="text-red-400">{log.details.reason}</span>
                        ) : (
                          <span className="text-slate-400">Standard operation executed</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        <div>{log.ipAddress}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-xs">{log.userAgent}</div>
                      </td>

                      <td className="py-3.5 px-4 text-right text-slate-400 font-medium">
                        {formatDate(log.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
