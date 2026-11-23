import React from 'react';
import {
  Shield,
  Lock,
  Key,
  Unlock,
  HardDrive,
  Fingerprint,
  FileCheck2,
  Cpu,
  ArrowRight,
  CheckCircle,
  EyeOff
} from 'lucide-react';

export default function LandingPage({ onGetStarted, onLogin }) {
  const securityFeatures = [
    {
      icon: Lock,
      title: 'AES-256-GCM Encryption',
      desc: 'Industry-standard Galois/Counter Mode provides both confidentiality and cryptographic integrity verification.'
    },
    {
      icon: Cpu,
      title: 'Browser-Side Web Crypto',
      desc: 'All encryption and decryption execute locally using the native W3C Web Crypto API. Plaintext never leaves your device.'
    },
    {
      icon: Key,
      title: 'PBKDF2 with SHA-256',
      desc: 'Password-based key derivation using 100,000+ iterations with unique cryptographically random 128-bit salts.'
    },
    {
      icon: EyeOff,
      title: 'Zero-Knowledge Architecture',
      desc: 'The server never sees your encryption keys, passwords, or unencrypted file contents. Your privacy is mathematically guaranteed.'
    },
    {
      icon: Fingerprint,
      title: 'Biometric Authentication',
      desc: 'Hardware-backed passkeys via WebAuthn (Touch ID, Face ID, Windows Hello) for seamless, passwordless identity verification.'
    },
    {
      icon: HardDrive,
      title: 'Private Isolated Vaults',
      desc: 'Files are stored in private encrypted storage with strict row-level authorization and authenticated streaming.'
    }
  ];

  return (
    <div className="min-h-screen bg-vault-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-vault-800/80 bg-vault-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">SecureVault</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="text-sm font-medium text-slate-300 hover:text-white px-3.5 py-2 rounded-lg hover:bg-vault-850 transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={onGetStarted}
              className="vault-btn-primary"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/80 border border-cyan-500/30 text-cyan-400 text-xs font-semibold tracking-wide uppercase">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Zero-Knowledge File Security</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Your Files. <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Your Privacy.</span> Your Security.
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-300">
            SecureVault empowers you to encrypt, store, manage, and decrypt personal documents, photos, and videos with client-side <strong>AES-256-GCM</strong>. Plaintext files never touch the server.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={onGetStarted}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-base shadow-xl shadow-cyan-900/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span>Create Free Secure Vault</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={onLogin}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-vault-850 hover:bg-vault-800 text-slate-200 font-semibold text-base border border-vault-700 transition-all"
            >
              Access Existing Vault
            </button>
          </div>

          {/* Cryptographic Architecture Badge Strip */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>AES-256-GCM (128-bit Tag)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>PBKDF2-SHA-256 (100k iter)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Unique 96-bit IV per file</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>WebAuthn Biometrics</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Diagram / Process */}
      <section className="py-16 bg-vault-900/40 border-y border-vault-850 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">How Zero-Knowledge Encryption Works</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Mathematical guarantees ensure complete isolation between your plaintext data and the storage backend.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="vault-card p-6 space-y-3 relative">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold font-mono">
                01
              </div>
              <h3 className="text-base font-bold text-white">1. Client-Side Encryption</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                You select any document, image, or video. Your browser derives a 256-bit AES key using PBKDF2-SHA-256 and encrypts the file locally with AES-256-GCM.
              </p>
            </div>

            <div className="vault-card p-6 space-y-3 relative">
              <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold font-mono">
                02
              </div>
              <h3 className="text-base font-bold text-white">2. Private Storage</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Only the encrypted binary ciphertext, random salt, and IV are transmitted over HTTPS to private storage. The server never holds keys or passwords.
              </p>
            </div>

            <div className="vault-card p-6 space-y-3 relative">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold font-mono">
                03
              </div>
              <h3 className="text-base font-bold text-white">3. In-Memory Decryption</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                When downloaded, your browser decrypts the payload in memory, verifies the 128-bit authentication tag, and produces the original file safely.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center space-y-2 mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Enterprise-Grade Security Features</h2>
          <p className="text-slate-400 text-sm">Designed for high assurance, privacy, and compliance.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {securityFeatures.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <div key={i} className="vault-card vault-card-hover p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-vault-800 text-cyan-400 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">{feat.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-vault-850 py-8 bg-vault-950/90 text-center text-xs text-slate-500 space-y-2">
        <p>SecureVault – Web-Based File Encryption & Secure Storage System</p>
        <p className="font-mono text-[11px] text-slate-600">
          AES-256-GCM • PBKDF2-SHA-256 • W3C Web Crypto • Zero-Knowledge
        </p>
      </footer>
    </div>
  );
}
