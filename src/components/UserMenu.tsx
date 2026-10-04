import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, LogIn, LogOut, Bookmark, ChevronDown } from 'lucide-react';

interface UserMenuProps {
  lang: 'cs' | 'en';
  onNavigateToBookmarks: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ lang, onNavigateToBookmarks }) => {
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!isAuthenticated || !user) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal('login')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all hover:bg-white/10 cursor-pointer shadow-sm"
        style={{
          backgroundColor: 'var(--panel-surface)',
          borderColor: 'var(--panel-border)',
          color: 'var(--text-primary)',
        }}
        title={lang === 'cs' ? 'Přihlásit se nebo vytvořit účet' : 'Sign in or register'}
      >
        <LogIn className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
        <span className="hidden sm:inline">{lang === 'cs' ? 'Přihlásit se' : 'Sign In'}</span>
      </button>
    );
  }

  const initials = (user.displayName || user.email || 'U')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all hover:bg-white/10 cursor-pointer shadow-sm"
        style={{
          backgroundColor: 'var(--panel-surface)',
          borderColor: 'var(--panel-border)',
          color: 'var(--text-primary)',
        }}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className="w-5 h-5 rounded-full object-cover border border-white/20"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast, #000)',
            }}
          >
            {initials}
          </div>
        )}
        <span className="max-w-[100px] truncate hidden sm:inline">{user.displayName}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-2xl border shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
          style={{
            backgroundColor: 'var(--panel-bg)',
            borderColor: 'var(--panel-border)',
            color: 'var(--text-primary)',
          }}
        >
          {/* User Info Header */}
          <div className="px-4 py-2.5 border-b mb-1" style={{ borderColor: 'var(--panel-border)' }}>
            <p className="font-bold text-xs truncate">{user.displayName}</p>
            <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
          </div>

          {/* Bookmarks navigation */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onNavigateToBookmarks();
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium hover:bg-white/5 transition-colors cursor-pointer text-left"
          >
            <Bookmark className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>{lang === 'cs' ? 'Moje záložky a složky' : 'My Bookmarks & Folders'}</span>
          </button>

          {/* Logout */}
          <div className="pt-1 mt-1 border-t" style={{ borderColor: 'var(--panel-border)' }}>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>{lang === 'cs' ? 'Odhlásit se' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
