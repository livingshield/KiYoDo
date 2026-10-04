import React from 'react';
import { Download } from 'lucide-react';
import { Language } from '../utils/translations';

interface FooterProps {
  lang: Language;
}

export const Footer: React.FC<FooterProps> = () => {
  return (
    <footer 
      className="mt-16 border-t py-6 text-xs transition-colors"
      style={{
        backgroundColor: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        color: 'var(--text-muted)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div 
            className="w-6 h-6 rounded-md flex items-center justify-center border"
            style={{
              backgroundColor: 'var(--panel-surface)',
              borderColor: 'var(--panel-border)',
            }}
          >
            <Download className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
          </div>
          <span className="font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Kiki<span style={{ color: 'var(--accent-primary)' }} className="font-extrabold">YoDo</span>
          </span>
          <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>·</span>
          <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>Private Project</span>
        </div>
      </div>
    </footer>
  );
};
