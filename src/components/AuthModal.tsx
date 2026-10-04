import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Lock, Mail, User, LogIn, UserPlus, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'register';
  lang?: 'cs' | 'en';
}

declare global {
  interface Window {
    google?: any;
  }
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'login',
  lang = 'cs',
}) => {
  const { login, register, loginWithGoogle } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTab(initialTab);
    setError(null);
    setSuccessMsg(null);
  }, [initialTab, isOpen]);

  // Initialize Google Identity Services button
  useEffect(() => {
    if (!isOpen) return;

    // Real Google OAuth Client ID for KiYoDo from Google Cloud Console
    const clientId = '335921016939-4m6fn0mv3ik1l0ttj1gbkgob6b1gs04q.apps.googleusercontent.com';

    const loadGsiScript = () => {
      if (window.google?.accounts?.id) {
        renderGoogleButton();
        return;
      }

      const existingScript = document.getElementById('google-gsi-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'google-gsi-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => renderGoogleButton();
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener('load', () => renderGoogleButton());
      }
    };

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: { credential?: string }) => {
            if (response.credential) {
              setIsLoading(true);
              setError(null);
              try {
                await loginWithGoogle(response.credential);
                onClose();
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Přihlášení přes Google selhalo.');
              } finally {
                setIsLoading(false);
              }
            }
          },
        });

        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: tab === 'login' ? 'signin_with' : 'signup_with',
          locale: lang === 'cs' ? 'cs' : 'en',
          shape: 'rectangular',
        });
      } catch (err) {
        console.debug('Google GSI render error:', err);
      }
    };

    const timer = setTimeout(loadGsiScript, 100);
    return () => clearTimeout(timer);
  }, [isOpen, tab, lang, loginWithGoogle, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (tab === 'login') {
        await login(email, password, rememberMe);
        onClose();
      } else {
        await register(email, password, displayName);
        setSuccessMsg(lang === 'cs' ? 'Registrace úspěšná! Účet byl vytvořen.' : 'Registration successful!');
        setTimeout(() => onClose(), 800);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operace selhala.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md p-6 rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Tabs */}
        <div className="flex border-b mb-6 pb-2" style={{ borderColor: 'var(--panel-border)' }}>
          <button
            type="button"
            onClick={() => { setTab('login'); setError(null); }}
            className={`flex items-center gap-2 pb-2 px-3 font-bold text-sm transition-all border-b-2 cursor-pointer ${
              tab === 'login'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>{lang === 'cs' ? 'Přihlášení' : 'Log In'}</span>
          </button>

          <button
            type="button"
            onClick={() => { setTab('register'); setError(null); }}
            className={`flex items-center gap-2 pb-2 px-3 font-bold text-sm transition-all border-b-2 cursor-pointer ${
              tab === 'register'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>{lang === 'cs' ? 'Nová registrace' : 'Create Account'}</span>
          </button>
        </div>

        {/* Subtitle */}
        <p className="text-xs text-slate-400 mb-5">
          {tab === 'login'
            ? (lang === 'cs' ? 'Přihlaste se ke svým záložkám a historii videí.' : 'Sign in to access your video bookmarks and history.')
            : (lang === 'cs' ? 'Založte si účet pro ukládání oblíbených videí a vlastních složek.' : 'Create an account to save bookmarks and organize folders.')}
        </p>

        {/* Google One-Click Button */}
        <div className="mb-5 flex flex-col items-center justify-center">
          <div ref={googleBtnRef} className="min-h-[40px] flex items-center justify-center" />
          <div className="flex items-center gap-3 w-full my-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              {lang === 'cs' ? 'nebo e-mailem' : 'or with email'}
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
        </div>

        {/* Error / Success message */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'register' && (
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-300">
                {lang === 'cs' ? 'Jméno nebo přezdívka' : 'Display Name'}
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={lang === 'cs' ? 'např. Honza' : 'e.g. Alex'}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-black/30 text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                  style={{ borderColor: 'var(--panel-border)' }}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-300">
              {lang === 'cs' ? 'E-mailová adresa' : 'Email Address'} *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vas@email.cz"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-black/30 text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                style={{ borderColor: 'var(--panel-border)' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-300">
              {lang === 'cs' ? 'Heslo' : 'Password'} *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-black/30 text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                style={{ borderColor: 'var(--panel-border)' }}
              />
            </div>
            {tab === 'register' && (
              <span className="text-[10px] text-slate-500 mt-1 block">
                {lang === 'cs' ? 'Minimálně 6 znaků' : 'At least 6 characters'}
              </span>
            )}
          </div>

          {tab === 'login' && (
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded accent-[var(--accent-primary)]"
                />
                <span>{lang === 'cs' ? 'Pamatovat přihlášení' : 'Remember me'}</span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast, #000)',
            }}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{lang === 'cs' ? 'Zpracovávám...' : 'Processing...'}</span>
              </>
            ) : tab === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>{lang === 'cs' ? 'Přihlásit se' : 'Sign In'}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{lang === 'cs' ? 'Vytvořit účet' : 'Create Account'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
