import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BookmarkFolder, VideoInfo, VideoSearchResult } from '../types';
import {
  apiGetFolders,
  apiCreateFolder,
  apiAddFolderItem,
  apiMoveFolderItem,
  apiCheckVideoSaved,
} from '../utils/yodoApi';
import {
  X,
  Bookmark,
  FolderPlus,
  Check,
  Loader2,
  Folder,
  LogIn,
  AlertCircle,
  ArrowRightLeft,
} from 'lucide-react';

interface AddToBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoInfo | VideoSearchResult | { url: string; title: string; id?: string; thumbnailUrl?: string; author?: string; duration?: string };
  lang?: 'cs' | 'en';
}

export const AddToBookmarkModal: React.FC<AddToBookmarkModalProps> = ({
  isOpen,
  onClose,
  video,
  lang = 'cs',
}) => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [savedFolderIds, setSavedFolderIds] = useState<number[]>([]);
  const [savedInfoList, setSavedInfoList] = useState<Array<{ folderId: number; folderName: string; itemId: number; note?: string }>>([]);
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick inline folder creation
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderComment, setNewFolderComment] = useState('');
  const [isFolderSubmitting, setIsFolderSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;

    const loadData = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      try {
        const [userFolders, savedList] = await Promise.all([
          apiGetFolders(),
          apiCheckVideoSaved(video.url),
        ]);

        setFolders(userFolders);
        setSavedInfoList(savedList);
        const alreadyIn = savedList.map((s) => s.folderId);
        setSavedFolderIds(alreadyIn);

        // Select first available folder if not selected
        if (userFolders.length > 0 && selectedFolderId === null) {
          setSelectedFolderId(userFolders[0].id);
        }
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Nepodařilo se načíst záložky.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, isAuthenticated, video.url]);

  if (!isOpen) return null;

  const handleCreateNewFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newFolderName.trim()) return;

    setIsFolderSubmitting(true);
    setErrorMsg(null);
    try {
      const created = await apiCreateFolder(newFolderName.trim(), newFolderComment.trim() || undefined);
      setFolders((prev) => [...prev, created]);
      setSelectedFolderId(created.id);
      setIsCreatingFolder(false);
      setNewFolderName('');
      setNewFolderComment('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Nepodařilo se vytvořit záložku.');
    } finally {
      setIsFolderSubmitting(false);
    }
  };

  const handleSaveToFolder = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    let targetFolderId = selectedFolderId;

    try {
      // If user typed a new folder name while the inline form is open, create it first
      if (isCreatingFolder && newFolderName.trim()) {
        const created = await apiCreateFolder(newFolderName.trim(), newFolderComment.trim() || undefined);
        setFolders((prev) => [...prev, created]);
        setSelectedFolderId(created.id);
        targetFolderId = created.id;
        setIsCreatingFolder(false);
        setNewFolderName('');
        setNewFolderComment('');
      }

      if (!targetFolderId) {
        setErrorMsg(lang === 'cs' ? 'Vyberte prosím záložku.' : 'Please select a folder.');
        setIsSaving(false);
        return;
      }

      const vId = 'id' in video && video.id ? video.id : '';
      const thumb = video.thumbnailUrl || (vId ? `https://i.ytimg.com/vi/${vId}/hqdefault.jpg` : '');

      await apiAddFolderItem(targetFolderId, {
        url: video.url,
        videoId: vId || undefined,
        title: video.title || 'Video',
        author: video.author,
        thumbnailUrl: thumb,
        duration: video.duration,
        note: note.trim() || undefined,
      });

      setSavedFolderIds((prev) => [...prev, targetFolderId!]);
      setSuccessMsg(lang === 'cs' ? 'Video bylo úspěšně uloženo do záložky!' : 'Saved to bookmarks!');
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Uložení selhalo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveToFolder = async () => {
    if (savedInfoList.length === 0) return;
    setIsMoving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    let targetFolderId = selectedFolderId;

    try {
      if (isCreatingFolder && newFolderName.trim()) {
        const created = await apiCreateFolder(newFolderName.trim(), newFolderComment.trim() || undefined);
        setFolders((prev) => [...prev, created]);
        setSelectedFolderId(created.id);
        targetFolderId = created.id;
        setIsCreatingFolder(false);
        setNewFolderName('');
        setNewFolderComment('');
      }

      if (!targetFolderId) {
        setErrorMsg(lang === 'cs' ? 'Vyberte prosím cílovou záložku.' : 'Please select a target folder.');
        setIsMoving(false);
        return;
      }

      const sourceInfo = savedInfoList[0];
      await apiMoveFolderItem(sourceInfo.folderId, sourceInfo.itemId, targetFolderId);

      setSavedFolderIds((prev) => prev.filter((id) => id !== sourceInfo.folderId).concat(targetFolderId!));
      setSuccessMsg(
        lang === 'cs'
          ? `Video bylo úspěšně přesunuto ze složky "${sourceInfo.folderName}"!`
          : `Moved from "${sourceInfo.folderName}"!`
      );
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Přesun selhal.');
    } finally {
      setIsMoving(false);
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
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--accent-primary)' }}
          >
            <Bookmark className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base">{lang === 'cs' ? 'Uložit do záložky' : 'Save to Bookmarks'}</h3>
            <p className="text-xs text-slate-400 truncate max-w-[260px]">{video.title}</p>
          </div>
        </div>

        {/* If user is not logged in */}
        {!isAuthenticated ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <LogIn className="w-6 h-6 text-[var(--accent-primary)]" />
            </div>
            <p className="text-sm font-semibold mb-1">
              {lang === 'cs' ? 'Přihlaste se ke svému účtu' : 'Sign in to save bookmarks'}
            </p>
            <p className="text-xs text-slate-400 mb-5 max-w-xs mx-auto">
              {lang === 'cs'
                ? 'Pro vytváření vlastních záložek, složek a synchronizaci historie se prosím přihlaste nebo zaregistrujte.'
                : 'Log in or sign up to create custom folders and organize your saved videos.'}
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                openAuthModal('login');
              }}
              className="py-2.5 px-6 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast, #000)',
              }}
            >
              {lang === 'cs' ? 'Přihlásit se / Vytvořit účet' : 'Log In / Sign Up'}
            </button>
          </div>
        ) : (
          <div>
            {/* Feedback Messages */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
                <span className="text-xs">{lang === 'cs' ? 'Načítám vaše záložky...' : 'Loading folders...'}</span>
              </div>
            ) : (
              <div>
                {/* Folder Selection */}
                <label className="block text-xs font-semibold mb-2 text-slate-300">
                  {lang === 'cs' ? 'Zvolte složku / záložku:' : 'Select folder:'}
                </label>

                <div className="max-h-48 overflow-y-auto space-y-1.5 mb-4 pr-1">
                  {folders.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">
                      {lang === 'cs' ? 'Zatím nemáte žádné složky. Vytvořte níže svou první.' : 'No folders yet. Create your first one below.'}
                    </p>
                  ) : (
                    folders.map((folder) => {
                      const isSelected = selectedFolderId === folder.id;
                      const isAlreadySaved = savedFolderIds.includes(folder.id);

                      return (
                        <div
                          key={folder.id}
                          onClick={() => setSelectedFolderId(folder.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[var(--accent-primary)] bg-[var(--badge-bg)]'
                              : 'border-[var(--panel-border)] bg-black/20 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[var(--accent-primary)]' : 'text-slate-400'}`} />
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{folder.name}</p>
                              {folder.comment && (
                                <p className="text-[10px] text-slate-400 truncate">{folder.comment}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {isAlreadySaved && (
                              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                {lang === 'cs' ? 'Již uloženo' : 'Saved'}
                              </span>
                            )}
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]' : 'border-slate-500'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Inline New Folder Form */}
                {isCreatingFolder ? (
                  <form onSubmit={handleCreateNewFolder} className="p-3 rounded-xl border mb-4 bg-black/30 space-y-2.5" style={{ borderColor: 'var(--panel-border)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--accent-primary)]">
                        {lang === 'cs' ? 'Nová záložka' : 'New Folder'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCreatingFolder(false)}
                        className="text-[10px] text-slate-400 hover:text-white"
                      >
                        {lang === 'cs' ? 'Zrušit' : 'Cancel'}
                      </button>
                    </div>

                    <input
                      type="text"
                      required
                      placeholder={lang === 'cs' ? 'Název složky (např. Pohádky dětem)' : 'Folder name'}
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border bg-black/40 text-white focus:outline-none focus:border-[var(--accent-primary)]"
                      style={{ borderColor: 'var(--panel-border)' }}
                    />

                    <input
                      type="text"
                      placeholder={lang === 'cs' ? 'Vlastní komentář k záložce (volitelné)' : 'Optional comment'}
                      value={newFolderComment}
                      onChange={(e) => setNewFolderComment(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border bg-black/40 text-white focus:outline-none focus:border-[var(--accent-primary)]"
                      style={{ borderColor: 'var(--panel-border)' }}
                    />

                    <button
                      type="submit"
                      disabled={isFolderSubmitting || !newFolderName.trim()}
                      className="w-full py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'var(--accent-contrast, #000)',
                      }}
                    >
                      {isFolderSubmitting ? (lang === 'cs' ? 'Vytvářím...' : 'Creating...') : (lang === 'cs' ? 'Vytvořit a vybrat' : 'Create & Select')}
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCreatingFolder(true)}
                    className="w-full mb-4 py-2 px-3 rounded-xl border border-dashed text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    style={{ borderColor: 'var(--panel-border)' }}
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>{lang === 'cs' ? '+ Vytvořit novou záložku' : '+ Create new folder'}</span>
                  </button>
                )}

                {/* Optional Note for this video */}
                <div className="mb-5">
                  <label className="block text-xs font-semibold mb-1 text-slate-300">
                    {lang === 'cs' ? 'Poznámka k tomuto videu (volitelná):' : 'Note for this video (optional):'}
                  </label>
                  <input
                    type="text"
                    placeholder={lang === 'cs' ? 'např. poslech v autě, oblíbená scéna...' : 'e.g. favorite scene...'}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-black/30 text-xs focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                    style={{ borderColor: 'var(--panel-border)' }}
                  />
                </div>

                {/* Submit / Move Actions */}
                <div className="space-y-2">
                  {savedInfoList.length > 0 &&
                    selectedFolderId &&
                    !savedFolderIds.includes(selectedFolderId) && (
                      <button
                        type="button"
                        onClick={handleMoveToFolder}
                        disabled={isSaving || isMoving}
                        className="w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border shadow-sm transition-all cursor-pointer hover:bg-white/10"
                        style={{
                          borderColor: 'var(--accent-primary)',
                          color: 'var(--accent-primary)',
                          backgroundColor: 'var(--badge-bg)',
                        }}
                      >
                        {isMoving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{lang === 'cs' ? 'Přesouvám video...' : 'Moving video...'}</span>
                          </>
                        ) : (
                          <>
                            <ArrowRightLeft className="w-4 h-4" />
                            <span>
                              {lang === 'cs'
                                ? `Přesunout ze záložky "${savedInfoList[0].folderName}" sem`
                                : `Move here from "${savedInfoList[0].folderName}"`}
                            </span>
                          </>
                        )}
                      </button>
                    )}

                  {/* Submit Save Button */}
                  <button
                    type="button"
                    onClick={handleSaveToFolder}
                    disabled={isSaving || isMoving || (!selectedFolderId && !(isCreatingFolder && newFolderName.trim()))}
                    className="w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: 'var(--accent-contrast, #000)',
                    }}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>
                          {isCreatingFolder && newFolderName.trim()
                            ? (lang === 'cs' ? 'Vytvářím záložku a ukládám...' : 'Creating folder & saving...')
                            : (lang === 'cs' ? 'Ukládám do záložky...' : 'Saving...')}
                        </span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-4 h-4" />
                        <span>
                          {isCreatingFolder && newFolderName.trim()
                            ? (lang === 'cs' ? 'Vytvořit záložku a uložit video' : 'Create Folder & Save Video')
                            : (savedFolderIds.includes(selectedFolderId || 0)
                                ? (lang === 'cs' ? 'Aktualizovat v této záložce' : 'Update in this folder')
                                : (lang === 'cs' ? 'Uložit video do záložky' : 'Save to Bookmark'))}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
