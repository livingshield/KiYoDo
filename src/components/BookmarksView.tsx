import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BookmarkFolder, BookmarkItem, DownloadHistoryItem } from '../types';
import {
  apiGetFolders,
  apiCreateFolder,
  apiUpdateFolder,
  apiDeleteFolder,
  apiGetFolderItems,
  apiAddFolderItem,
  apiDeleteFolderItem,
  apiUpdateFolderItem,
  apiMoveFolderItem,
  apiBatchMoveFolderItems,
  apiBatchDeleteFolderItems,
} from '../utils/yodoApi';
import {
  Folder,
  FolderPlus,
  Bookmark,
  Trash2,
  Edit2,
  ExternalLink,
  Plus,
  Play,
  Search,
  MoreVertical,
  MoveRight,
  MessageSquare,
  Clock,
  LogIn,
  Loader2,
  AlertCircle,
  CheckCircle2,
  DownloadCloud,
  CheckSquare,
  Square,
  GripVertical,
  ArrowRightLeft,
  Sparkles,
  FolderInput,
} from 'lucide-react';

interface BookmarksViewProps {
  lang: 'cs' | 'en';
  onSelectVideo: (url: string) => void;
  localHistory?: DownloadHistoryItem[];
}

export const BookmarksView: React.FC<BookmarksViewProps> = ({
  lang,
  onSelectVideo,
  localHistory = [],
}) => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-select state
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<number | null>(null);

  // Folder creation / edit modal
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<BookmarkFolder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderComment, setFolderComment] = useState('');
  const [isSavingFolder, setIsSavingFolder] = useState(false);

  // Manual Add video modal
  const [isAddVideoModalOpen, setIsAddVideoModalOpen] = useState(false);
  const [manualVideoUrl, setManualVideoUrl] = useState('');
  const [manualVideoNote, setManualVideoNote] = useState('');
  const [isAddingVideo, setIsAddingVideo] = useState(false);

  // Edit item note modal
  const [editingItem, setEditingItem] = useState<BookmarkItem | null>(null);
  const [itemNote, setItemNote] = useState('');

  // Move item modal (single or batch)
  const [movingItem, setMovingItem] = useState<BookmarkItem | null>(null);
  const [batchMovingItemIds, setBatchMovingItemIds] = useState<number[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<number | null>(null);
  const [isCreatingNewTarget, setIsCreatingNewTarget] = useState(false);
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetComment, setNewTargetComment] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  // Status notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Clear selections when switching folders
  useEffect(() => {
    setSelectedItemIds([]);
  }, [selectedFolderId]);

  // Load Folders
  const loadFolders = async () => {
    if (!isAuthenticated) return;
    setIsLoadingFolders(true);
    try {
      const data = await apiGetFolders();
      setFolders(data);
      if (data.length > 0 && selectedFolderId === null) {
        setSelectedFolderId(data[0].id);
      } else if (selectedFolderId && !data.some(f => f.id === selectedFolderId)) {
        setSelectedFolderId(data[0]?.id || null);
      }
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Nepodařilo se načíst složky.');
    } finally {
      setIsLoadingFolders(false);
    }
  };

  useEffect(() => {
    loadFolders();
  }, [isAuthenticated]);

  // Load Items when folder changes
  useEffect(() => {
    if (!isAuthenticated || selectedFolderId === null) {
      setItems([]);
      return;
    }

    const loadItems = async () => {
      setIsLoadingItems(true);
      try {
        const res = await apiGetFolderItems(selectedFolderId);
        setItems(res.items);
      } catch (err: unknown) {
        showNotification('error', err instanceof Error ? err.message : 'Nepodařilo se načíst odkazy ze složky.');
      } finally {
        setIsLoadingItems(false);
      }
    };

    loadItems();
  }, [selectedFolderId, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div
          className="p-8 sm:p-12 rounded-3xl border shadow-xl max-w-lg mx-auto"
          style={{
            backgroundColor: 'var(--panel-bg)',
            borderColor: 'var(--panel-border)',
            color: 'var(--text-primary)',
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"
            style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--accent-primary)' }}
          >
            <Bookmark className="w-8 h-8" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold mb-2">
            {lang === 'cs' ? 'Moje záložky a historie' : 'My Bookmarks & History'}
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
            {lang === 'cs'
              ? 'Přihlaste se ke svému účtu a organizujte si oblíbená videa do vlastních záložek s komentáři. Všechna vaše uložená videa budete mít po ruce z mobilu i počítače.'
              : 'Sign in to create custom bookmark folders with comments and synchronize your favorite videos across all your devices.'}
          </p>

          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="py-3 px-8 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer inline-flex items-center gap-2 hover:opacity-95"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast, #000)',
            }}
          >
            <LogIn className="w-4 h-4" />
            <span>{lang === 'cs' ? 'Přihlásit se / Vytvořit účet' : 'Sign In / Register'}</span>
          </button>
        </div>
      </div>
    );
  }

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  // Folder modal save
  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    setIsSavingFolder(true);
    try {
      if (editingFolder) {
        const updated = await apiUpdateFolder(editingFolder.id, {
          name: folderName.trim(),
          comment: folderComment.trim() || undefined,
        });
        setFolders((prev) => prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)));
        showNotification('success', lang === 'cs' ? 'Záložka byla upravena.' : 'Folder updated.');
      } else {
        const created = await apiCreateFolder(folderName.trim(), folderComment.trim() || undefined);
        setFolders((prev) => [...prev, created]);
        setSelectedFolderId(created.id);
        showNotification('success', lang === 'cs' ? 'Nová záložka byla vytvořena.' : 'Folder created.');
      }
      setIsFolderModalOpen(false);
      setEditingFolder(null);
      setFolderName('');
      setFolderComment('');
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Uložení složky selhalo.');
    } finally {
      setIsSavingFolder(false);
    }
  };

  // Delete folder
  const handleDeleteFolder = async (folder: BookmarkFolder) => {
    const confirmMsg = lang === 'cs'
      ? `Opravdu chcete smazat záložku "${folder.name}" a všechny její odkazy?`
      : `Are you sure you want to delete folder "${folder.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await apiDeleteFolder(folder.id);
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      if (selectedFolderId === folder.id) {
        const remaining = folders.filter((f) => f.id !== folder.id);
        setSelectedFolderId(remaining[0]?.id || null);
      }
      showNotification('success', lang === 'cs' ? 'Záložka byla smazána.' : 'Folder deleted.');
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Smazání selhalo.');
    }
  };

  // Delete item from folder
  const handleDeleteItem = async (itemId: number) => {
    if (!selectedFolderId) return;
    try {
      await apiDeleteFolderItem(selectedFolderId, itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setFolders((prev) =>
        prev.map((f) => (f.id === selectedFolderId ? { ...f, itemCount: Math.max(0, f.itemCount - 1) } : f))
      );
      showNotification('success', lang === 'cs' ? 'Odkaz byl odebrán.' : 'Item removed.');
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Odebrání selhalo.');
    }
  };

  // Save edited note
  const handleSaveItemNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !selectedFolderId) return;

    try {
      await apiUpdateFolderItem(selectedFolderId, editingItem.id, { note: itemNote.trim() });
      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? { ...i, note: itemNote.trim() } : i)));
      setEditingItem(null);
      showNotification('success', lang === 'cs' ? 'Poznámka byla uložena.' : 'Note saved.');
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Uložení poznámky selhalo.');
    }
  };

  // Open Single Move Modal
  const handleOpenSingleMove = (item: BookmarkItem) => {
    setMovingItem(item);
    setBatchMovingItemIds([]);
    const other = folders.find((f) => f.id !== selectedFolderId);
    setTargetFolderId(other?.id || null);
    setIsCreatingNewTarget(!other);
    setNewTargetName('');
    setNewTargetComment('');
  };

  // Open Batch Move Modal
  const handleOpenBatchMove = () => {
    if (selectedItemIds.length === 0 || !selectedFolderId) return;
    setBatchMovingItemIds([...selectedItemIds]);
    setMovingItem(null);
    const other = folders.find((f) => f.id !== selectedFolderId);
    setTargetFolderId(other?.id || null);
    setIsCreatingNewTarget(!other);
    setNewTargetName('');
    setNewTargetComment('');
  };

  // Execute Move (Single or Batch, with optional on-the-fly folder creation)
  const handleExecuteMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolderId) return;

    const idsToMove = batchMovingItemIds.length > 0
      ? batchMovingItemIds
      : (movingItem ? [movingItem.id] : []);

    if (idsToMove.length === 0) return;

    setIsMoving(true);
    try {
      let destFolderId = targetFolderId;

      if (isCreatingNewTarget && newTargetName.trim()) {
        const created = await apiCreateFolder(newTargetName.trim(), newTargetComment.trim() || undefined);
        setFolders((prev) => [...prev, created]);
        destFolderId = created.id;
      }

      if (!destFolderId) {
        showNotification('error', lang === 'cs' ? 'Zvolte nebo vytvořte cílovou záložku.' : 'Select or create target folder.');
        setIsMoving(false);
        return;
      }

      if (destFolderId === selectedFolderId) {
        showNotification('error', lang === 'cs' ? 'Cílová záložka musí být jiná než současná.' : 'Target folder must be different.');
        setIsMoving(false);
        return;
      }

      if (idsToMove.length === 1) {
        await apiMoveFolderItem(selectedFolderId, idsToMove[0], destFolderId);
      } else {
        await apiBatchMoveFolderItems(selectedFolderId, idsToMove, destFolderId);
      }

      const count = idsToMove.length;
      setItems((prev) => prev.filter((i) => !idsToMove.includes(i.id)));
      setFolders((prev) =>
        prev.map((f) => {
          if (f.id === selectedFolderId) return { ...f, itemCount: Math.max(0, f.itemCount - count) };
          if (f.id === destFolderId) return { ...f, itemCount: f.itemCount + count };
          return f;
        })
      );

      const targetFolderObj = folders.find((f) => f.id === destFolderId);
      const destName = targetFolderObj?.name || newTargetName.trim() || 'cílové záložky';

      showNotification(
        'success',
        lang === 'cs'
          ? `${count > 1 ? `Přesunuto ${count} videí` : 'Video bylo přesunuto'} do záložky "${destName}".`
          : `Moved ${count} video(s) to "${destName}".`
      );

      // Clean up modal state
      setMovingItem(null);
      setBatchMovingItemIds([]);
      setSelectedItemIds([]);
      setIsCreatingNewTarget(false);
      setNewTargetName('');
      setNewTargetComment('');
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Přesun selhal.');
    } finally {
      setIsMoving(false);
    }
  };

  // Drag & Drop to folder in sidebar
  const handleDropToFolder = async (destFolderId: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
    setDraggingItemId(null);

    if (!selectedFolderId || destFolderId === selectedFolderId) return;

    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (!rawData) return;
      const data = JSON.parse(rawData);
      const itemId = Number(data.itemId);
      const sourceId = Number(data.sourceFolderId);

      if (!itemId || sourceId !== selectedFolderId) return;

      await apiMoveFolderItem(selectedFolderId, itemId, destFolderId);

      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setFolders((prev) =>
        prev.map((f) => {
          if (f.id === selectedFolderId) return { ...f, itemCount: Math.max(0, f.itemCount - 1) };
          if (f.id === destFolderId) return { ...f, itemCount: f.itemCount + 1 };
          return f;
        })
      );

      const destFolder = folders.find((f) => f.id === destFolderId);
      showNotification(
        'success',
        lang === 'cs'
          ? `Video bylo přesunuto do záložky "${destFolder?.name || ''}".`
          : `Moved to "${destFolder?.name || ''}".`
      );
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Přesun selhal.');
    }
  };

  // Batch delete items
  const handleBatchDelete = async () => {
    if (selectedItemIds.length === 0 || !selectedFolderId) return;
    const count = selectedItemIds.length;
    const confirmMsg =
      lang === 'cs'
        ? `Opravdu chcete ze záložky odebrat ${count} vybraných videí?`
        : `Remove ${count} selected videos from this folder?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await apiBatchDeleteFolderItems(selectedFolderId, selectedItemIds);
      setItems((prev) => prev.filter((i) => !selectedItemIds.includes(i.id)));
      setFolders((prev) =>
        prev.map((f) =>
          f.id === selectedFolderId ? { ...f, itemCount: Math.max(0, f.itemCount - count) } : f
        )
      );
      setSelectedItemIds([]);
      showNotification('success', lang === 'cs' ? `Odebráno ${count} videí.` : `Removed ${count} videos.`);
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Odebrání selhalo.');
    }
  };

  // Toggle selection
  const handleToggleSelectItem = (id: number) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedItemIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredItems.map((i) => i.id));
    }
  };

  // Manual Add video
  const handleManualAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualVideoUrl.trim() || !selectedFolderId) return;

    setIsAddingVideo(true);
    try {
      const added = await apiAddFolderItem(selectedFolderId, {
        url: manualVideoUrl.trim(),
        title: manualVideoUrl.trim(),
        note: manualVideoNote.trim() || undefined,
      });

      setItems((prev) => [added, ...prev]);
      setFolders((prev) =>
        prev.map((f) => (f.id === selectedFolderId ? { ...f, itemCount: f.itemCount + 1 } : f))
      );
      setIsAddVideoModalOpen(false);
      setManualVideoUrl('');
      setManualVideoNote('');
      showNotification('success', lang === 'cs' ? 'Video bylo přidáno do záložky.' : 'Video added.');
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Přidání odkazu selhalo.');
    } finally {
      setIsAddingVideo(false);
    }
  };

  // Import local history into selected folder
  const handleImportHistory = async () => {
    if (!selectedFolderId || localHistory.length === 0) return;
    const confirmMsg = lang === 'cs'
      ? `Chcete importovat ${localHistory.length} položek z historie stahování do záložky "${selectedFolder?.name}"?`
      : `Import ${localHistory.length} items into folder "${selectedFolder?.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    setIsLoadingItems(true);
    let imported = 0;

    for (const h of localHistory) {
      try {
        const videoUrl = `https://www.youtube.com/watch?v=${h.videoId}`;
        await apiAddFolderItem(selectedFolderId, {
          url: videoUrl,
          videoId: h.videoId,
          title: h.title,
          author: h.author,
          thumbnailUrl: h.thumbnailUrl,
          note: `Importováno (${h.quality} ${h.format.toUpperCase()})`,
        });
        imported++;
      } catch {
        // ignore duplicate
      }
    }

    // Refresh items
    const res = await apiGetFolderItems(selectedFolderId);
    setItems(res.items);
    setFolders((prev) =>
      prev.map((f) => (f.id === selectedFolderId ? { ...f, itemCount: res.items.length } : f))
    );
    setIsLoadingItems(false);
    showNotification('success', lang === 'cs' ? `Úspěšně importováno ${imported} videí!` : `Imported ${imported} items!`);
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.author && item.author.toLowerCase().includes(q)) ||
      (item.note && item.note.toLowerCase().includes(q)) ||
      (item.url && item.url.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl border shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/90 border-red-500/40 text-red-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main Grid: Left Folders Sidebar / Right Video Items */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Folders List (4 cols) */}
        <div className="md:col-span-4 space-y-4">
          <div
            className="p-4 rounded-2xl border shadow-sm"
            style={{
              backgroundColor: 'var(--panel-bg)',
              borderColor: 'var(--panel-border)',
              color: 'var(--text-primary)',
            }}
          >
            {/* Folder Header */}
            <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b" style={{ borderColor: 'var(--panel-border)' }}>
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[var(--accent-primary)]" />
                <h3 className="font-bold text-sm">{lang === 'cs' ? 'Moje záložky' : 'My Folders'}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingFolder(null);
                  setFolderName('');
                  setFolderComment('');
                  setIsFolderModalOpen(true);
                }}
                className="flex items-center gap-1 py-1 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast, #000)',
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'cs' ? 'Nová' : 'New'}</span>
              </button>
            </div>

            {/* Folders List */}
            {isLoadingFolders ? (
              <div className="py-6 flex justify-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-primary)]" />
              </div>
            ) : folders.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                <p>{lang === 'cs' ? 'Zatím nemáte žádné složky.' : 'No folders yet.'}</p>
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(true)}
                  className="mt-2 text-xs font-semibold underline text-[var(--accent-primary)]"
                >
                  {lang === 'cs' ? 'Vytvořit první záložku' : 'Create first folder'}
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {folders.map((f) => {
                  const isSelected = selectedFolderId === f.id;
                  const isDragTarget = dragOverFolderId === f.id && f.id !== selectedFolderId;
                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFolderId(f.id)}
                      onDragOver={(e) => {
                        if (f.id !== selectedFolderId) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverFolderId !== f.id) setDragOverFolderId(f.id);
                        }
                      }}
                      onDragLeave={() => {
                        setDragOverFolderId((curr) => (curr === f.id ? null : curr));
                      }}
                      onDrop={(e) => handleDropToFolder(f.id, e)}
                      className={`group p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 relative ${
                        isDragTarget
                          ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/50 bg-[var(--badge-bg)] scale-[1.02]'
                          : isSelected
                          ? 'border-[var(--accent-primary)] bg-[var(--badge-bg)]'
                          : 'border-[var(--panel-border)] bg-black/20 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Folder className={`w-4 h-4 shrink-0 ${isDragTarget || isSelected ? 'text-[var(--accent-primary)]' : 'text-slate-400'}`} />
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate">{f.name}</p>
                          {isDragTarget ? (
                            <p className="text-[10px] text-[var(--accent-primary)] font-bold animate-pulse">
                              {lang === 'cs' ? '↓ Pusťte pro přesun' : '↓ Drop to move'}
                            </p>
                          ) : f.comment ? (
                            <p className="text-[10px] text-slate-400 truncate max-w-[170px]">{f.comment}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/40 text-slate-300">
                          {f.itemCount}
                        </span>

                        {/* Actions on folder */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFolder(f);
                            setFolderName(f.name);
                            setFolderComment(f.comment || '');
                            setIsFolderModalOpen(true);
                          }}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                          title={lang === 'cs' ? 'Upravit záložku' : 'Edit folder'}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(f);
                          }}
                          className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                          title={lang === 'cs' ? 'Smazat záložku' : 'Delete folder'}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Import Local History Button */}
            {localHistory.length > 0 && selectedFolder && (
              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--panel-border)' }}>
                <button
                  type="button"
                  onClick={handleImportHistory}
                  className="w-full py-2 px-3 rounded-xl border border-dashed text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{ borderColor: 'var(--panel-border)' }}
                >
                  <DownloadCloud className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>
                    {lang === 'cs'
                      ? `Importovat historii (${localHistory.length} videí)`
                      : `Import history (${localHistory.length} videos)`}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Folder Items & Header (8 cols) */}
        <div className="md:col-span-8 space-y-4">
          {selectedFolder ? (
            <div
              className="p-5 rounded-2xl border shadow-sm min-h-[400px] flex flex-col justify-between"
              style={{
                backgroundColor: 'var(--panel-bg)',
                borderColor: 'var(--panel-border)',
                color: 'var(--text-primary)',
              }}
            >
              <div>
                {/* Folder Top Bar */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 mb-4 border-b" style={{ borderColor: 'var(--panel-border)' }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <Folder className="w-5 h-5 text-[var(--accent-primary)]" />
                      <h2 className="text-lg font-bold">{selectedFolder.name}</h2>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-black/40 text-slate-300 font-mono">
                        {items.length} {lang === 'cs' ? 'videí' : 'videos'}
                      </span>
                    </div>
                    {selectedFolder.comment && (
                      <p className="text-xs text-slate-400 mt-1 max-w-xl italic flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />
                        <span>{selectedFolder.comment}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddVideoModalOpen(true)}
                      className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'var(--accent-contrast, #000)',
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{lang === 'cs' ? 'Vložit video' : 'Add Video'}</span>
                    </button>
                  </div>
                </div>

                {/* Search & Selection Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
                  {items.length > 0 && (
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                      <input
                        type="text"
                        placeholder={lang === 'cs' ? 'Hledat v této záložce...' : 'Search within this folder...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border bg-black/30 focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                        style={{ borderColor: 'var(--panel-border)' }}
                      />
                    </div>
                  )}

                  {filteredItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="px-3 py-2 rounded-xl border text-xs font-semibold hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5 shrink-0"
                      style={{ borderColor: 'var(--panel-border)' }}
                      title={lang === 'cs' ? 'Označit všechna videa pro hromadný přesun' : 'Select all videos for batch action'}
                    >
                      {selectedItemIds.length === filteredItems.length && filteredItems.length > 0 ? (
                        <>
                          <CheckSquare className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                          <span>{lang === 'cs' ? 'Zrušit výběr' : 'Deselect all'}</span>
                        </>
                      ) : (
                        <>
                          <Square className="w-3.5 h-3.5 text-slate-400" />
                          <span>{lang === 'cs' ? 'Vybrat vše' : 'Select all'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Batch Action Bar (when 1 or more items selected) */}
                {selectedItemIds.length > 0 && (
                  <div
                    className="mb-4 p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-200"
                    style={{
                      backgroundColor: 'var(--badge-bg)',
                      borderColor: 'var(--accent-primary)',
                    }}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <CheckSquare className="w-4 h-4 text-[var(--accent-primary)]" />
                      <span>
                        {lang === 'cs'
                          ? `Vybráno ${selectedItemIds.length} ${selectedItemIds.length === 1 ? 'video' : selectedItemIds.length < 5 ? 'videa' : 'videí'}`
                          : `Selected ${selectedItemIds.length} video(s)`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenBatchMove}
                        className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: 'var(--accent-contrast, #000)',
                        }}
                      >
                        <FolderInput className="w-3.5 h-3.5" />
                        <span>{lang === 'cs' ? 'Přesunout do jiné záložky' : 'Move to another folder'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleBatchDelete}
                        className="flex items-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors cursor-pointer border border-red-500/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{lang === 'cs' ? 'Odebrat' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Items List */}
                {isLoadingItems ? (
                  <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
                    <span className="text-xs">{lang === 'cs' ? 'Načítám videa...' : 'Loading videos...'}</span>
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <Bookmark className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold mb-1">
                      {lang === 'cs' ? 'Tato záložka je zatím prázdná' : 'This folder is empty'}
                    </p>
                    <p className="text-xs max-w-sm mx-auto mb-4">
                      {lang === 'cs'
                        ? 'Při vyhledávání nebo přehrávání videí klikněte na tlačítko "⭐ Uložit do záložky", nebo vložte odkaz ručně výše.'
                        : 'Click "⭐ Save to Bookmark" on any video or add a link manually above.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAddVideoModalOpen(true)}
                      className="py-2 px-4 rounded-xl text-xs font-bold border transition-colors cursor-pointer"
                      style={{
                        backgroundColor: 'var(--panel-surface)',
                        borderColor: 'var(--panel-border)',
                      }}
                    >
                      {lang === 'cs' ? '+ Vložit video odkazem' : '+ Add Video by URL'}
                    </button>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-xs">
                    {lang === 'cs' ? 'Žádné video neodpovídá vyhledávání.' : 'No videos match your search.'}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredItems.map((item) => {
                      const isItemSelected = selectedItemIds.includes(item.id);
                      const isItemDragging = draggingItemId === item.id;

                      return (
                        <div
                          key={item.id}
                          draggable={true}
                          onDragStart={(e) => {
                            setDraggingItemId(item.id);
                            e.dataTransfer.setData(
                              'application/json',
                              JSON.stringify({
                                itemId: item.id,
                                sourceFolderId: selectedFolderId,
                                title: item.title,
                              })
                            );
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => setDraggingItemId(null)}
                          className={`p-3 rounded-2xl border transition-all flex items-start gap-3 group ${
                            isItemDragging
                              ? 'opacity-40 border-dashed border-[var(--accent-primary)]'
                              : isItemSelected
                              ? 'border-[var(--accent-primary)] bg-[var(--badge-bg)] shadow-sm'
                              : 'border-[var(--panel-border)] bg-black/20 hover:bg-white/5'
                          }`}
                        >
                          {/* Left: Selection Checkbox & Drag Grip */}
                          <div className="flex flex-col items-center gap-2 pt-0.5 shrink-0">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSelectItem(item.id);
                              }}
                              className="p-1 rounded cursor-pointer text-slate-400 hover:text-white transition-colors"
                              title={lang === 'cs' ? 'Označit pro hromadnou akci' : 'Select'}
                            >
                              {isItemSelected ? (
                                <CheckSquare className="w-4 h-4 text-[var(--accent-primary)]" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-500 hover:text-slate-300" />
                              )}
                            </div>

                            <div
                              className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-300 hidden sm:flex items-center p-0.5"
                              title={lang === 'cs' ? 'Přetáhněte myší do jiné záložky vlevo' : 'Drag to folder on the left'}
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </div>
                          </div>

                          {/* Left: Thumbnail */}
                          <div
                            onClick={() => onSelectVideo(item.url)}
                            className="relative w-28 h-18 sm:w-32 sm:h-20 rounded-xl overflow-hidden bg-black/50 shrink-0 cursor-pointer group/thumb shadow-sm border border-white/5"
                          >
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl}
                                alt={item.title}
                                className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-600">
                                <Bookmark className="w-6 h-6" />
                              </div>
                            )}

                            {item.duration && (
                              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                                {item.duration}
                              </span>
                            )}

                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                              <Play className="w-6 h-6 text-white drop-shadow" />
                            </div>
                          </div>

                          {/* Right: Title, Metadata & Bottom Actions */}
                          <div className="min-w-0 flex-1 flex flex-col justify-between self-stretch gap-2">
                            <div>
                              {/* Title with full width - never squished by buttons */}
                              <h4
                                onClick={() => onSelectVideo(item.url)}
                                className="font-bold text-xs sm:text-sm leading-snug line-clamp-2 hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
                                title={item.title}
                              >
                                {item.title}
                              </h4>

                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1">
                                {item.author && <span className="truncate max-w-[200px]">{item.author}</span>}
                                {item.author && <span>•</span>}
                                <span className="capitalize text-[10px] px-1.5 py-0.2 rounded bg-white/5 border border-white/10">
                                  {item.platform || 'YouTube'}
                                </span>
                              </div>

                              {/* User note on video */}
                              {item.note && (
                                <p className="text-[11px] text-[var(--accent-primary)] mt-1 italic flex items-center gap-1 line-clamp-1">
                                  <MessageSquare className="w-2.5 h-2.5 shrink-0" />
                                  <span>{item.note}</span>
                                </p>
                              )}
                            </div>

                            {/* Bottom Actions Row (Below title, cleanly aligned) */}
                            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/5 mt-auto">
                              <button
                                type="button"
                                onClick={() => onSelectVideo(item.url)}
                                className="flex items-center gap-1 py-1 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm hover:opacity-95"
                                style={{
                                  backgroundColor: 'var(--accent-primary)',
                                  color: 'var(--accent-contrast, #000)',
                                }}
                                title={lang === 'cs' ? 'Přehrát nebo stáhnout video' : 'Play or download'}
                              >
                                <Play className="w-3 h-3" />
                                <span>{lang === 'cs' ? 'Otevřít' : 'Open'}</span>
                              </button>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingItem(item);
                                    setItemNote(item.note || '');
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                  title={lang === 'cs' ? 'Přidat / upravit poznámku' : 'Add/edit note'}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenSingleMove(item)}
                                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                  title={lang === 'cs' ? 'Přesunout do jiné záložky' : 'Move to another folder'}
                                >
                                  <MoveRight className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                  title={lang === 'cs' ? 'Odebrat ze záložky' : 'Remove from folder'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400">
              <Folder className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">{lang === 'cs' ? 'Zvolte nebo vytvořte záložku vlevo' : 'Select or create a folder on the left'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Create / Edit Folder */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsFolderModalOpen(false)}>
          <div className="relative w-full max-w-md p-6 rounded-2xl border shadow-2xl" style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-4 flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-[var(--accent-primary)]" />
              <span>{editingFolder ? (lang === 'cs' ? 'Upravit záložku' : 'Edit Folder') : (lang === 'cs' ? 'Nová záložka' : 'New Folder')}</span>
            </h3>

            <form onSubmit={handleSaveFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">
                  {lang === 'cs' ? 'Název záložky' : 'Folder Name'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={lang === 'cs' ? 'např. Pohádky, Oblíbená hudba, Cvičení...' : 'e.g. Music, Workout...'}
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-black/30 text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                  style={{ borderColor: 'var(--panel-border)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">
                  {lang === 'cs' ? 'Vlastní komentář k záložce (volitelný)' : 'Custom comment (optional)'}
                </label>
                <textarea
                  rows={3}
                  placeholder={lang === 'cs' ? 'K čemu tato záložka slouží, poznámka pro sebe...' : 'Description or personal note...'}
                  value={folderComment}
                  onChange={(e) => setFolderComment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-black/30 text-xs focus:outline-none focus:border-[var(--accent-primary)] resize-none"
                  style={{ borderColor: 'var(--panel-border)' }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="py-2 px-4 rounded-xl text-xs font-semibold hover:bg-white/5 transition-colors"
                >
                  {lang === 'cs' ? 'Zrušit' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingFolder || !folderName.trim()}
                  className="py-2 px-5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast, #000)' }}
                >
                  {isSavingFolder ? (lang === 'cs' ? 'Ukládám...' : 'Saving...') : (lang === 'cs' ? 'Uložit záložku' : 'Save Folder')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Video Manually */}
      {isAddVideoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddVideoModalOpen(false)}>
          <div className="relative w-full max-w-md p-6 rounded-2xl border shadow-2xl" style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[var(--accent-primary)]" />
              <span>{lang === 'cs' ? 'Vložit video do záložky' : 'Add Video to Folder'}</span>
            </h3>

            <form onSubmit={handleManualAddVideo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">
                  {lang === 'cs' ? 'Odkaz na video (YouTube, TikTok, Facebook...)' : 'Video URL'} *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={manualVideoUrl}
                  onChange={(e) => setManualVideoUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-black/30 text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                  style={{ borderColor: 'var(--panel-border)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">
                  {lang === 'cs' ? 'Poznámka k videu (volitelná)' : 'Note for this video (optional)'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'cs' ? 'např. poslech večer, dobrý tip...' : 'e.g. listen in car...'}
                  value={manualVideoNote}
                  onChange={(e) => setManualVideoNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-black/30 text-xs focus:outline-none focus:border-[var(--accent-primary)]"
                  style={{ borderColor: 'var(--panel-border)' }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddVideoModalOpen(false)}
                  className="py-2 px-4 rounded-xl text-xs font-semibold hover:bg-white/5 transition-colors"
                >
                  {lang === 'cs' ? 'Zrušit' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isAddingVideo || !manualVideoUrl.trim()}
                  className="py-2 px-5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast, #000)' }}
                >
                  {isAddingVideo ? (lang === 'cs' ? 'Přidávám...' : 'Adding...') : (lang === 'cs' ? 'Přidat do záložky' : 'Add to Folder')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Edit Item Note */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditingItem(null)}>
          <div className="relative w-full max-w-md p-6 rounded-2xl border shadow-2xl" style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-2">{lang === 'cs' ? 'Upravit poznámku k videu' : 'Edit Video Note'}</h3>
            <p className="text-xs text-slate-400 mb-4 truncate">{editingItem.title}</p>

            <form onSubmit={handleSaveItemNote} className="space-y-4">
              <input
                type="text"
                placeholder={lang === 'cs' ? 'Zadejte poznámku...' : 'Enter note...'}
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-black/30 text-xs focus:outline-none focus:border-[var(--accent-primary)]"
                style={{ borderColor: 'var(--panel-border)' }}
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="py-2 px-4 rounded-xl text-xs font-semibold hover:bg-white/5 transition-colors"
                >
                  {lang === 'cs' ? 'Zrušit' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast, #000)' }}
                >
                  {lang === 'cs' ? 'Uložit' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Move Item (Single or Batch) */}
      {(movingItem || batchMovingItemIds.length > 0) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            setMovingItem(null);
            setBatchMovingItemIds([]);
            setIsCreatingNewTarget(false);
          }}
        >
          <div
            className="relative w-full max-w-md p-6 rounded-2xl border shadow-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-base mb-1 flex items-center gap-2">
              <FolderInput className="w-5 h-5 text-[var(--accent-primary)]" />
              <span>
                {batchMovingItemIds.length > 0
                  ? (lang === 'cs'
                      ? `Přesunout ${batchMovingItemIds.length} ${batchMovingItemIds.length === 1 ? 'video' : batchMovingItemIds.length < 5 ? 'videa' : 'videí'}`
                      : `Move ${batchMovingItemIds.length} video(s)`)
                  : (lang === 'cs' ? 'Přesunout video do jiné záložky' : 'Move Video to Another Folder')}
              </span>
            </h3>

            <p className="text-xs text-slate-400 mb-4 truncate">
              {movingItem ? movingItem.title : (lang === 'cs' ? `Vybráno ${batchMovingItemIds.length} videí ze záložky "${selectedFolder?.name}"` : `Selected from "${selectedFolder?.name}"`)}
            </p>

            <form onSubmit={handleExecuteMove} className="space-y-4">
              {!isCreatingNewTarget ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-300">
                      {lang === 'cs' ? 'Zvolte cílovou záložku:' : 'Select target folder:'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewTarget(true)}
                      className="text-[11px] font-bold text-[var(--accent-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{lang === 'cs' ? 'Nová záložka' : 'New Folder'}</span>
                    </button>
                  </div>

                  {folders.filter((f) => f.id !== selectedFolderId).length === 0 ? (
                    <div className="p-4 rounded-xl border bg-black/20 text-center text-xs text-slate-400 mb-2" style={{ borderColor: 'var(--panel-border)' }}>
                      <p className="mb-2">{lang === 'cs' ? 'Zatím nemáte žádnou další záložku.' : 'You have no other folders yet.'}</p>
                      <button
                        type="button"
                        onClick={() => setIsCreatingNewTarget(true)}
                        className="py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: 'var(--accent-contrast, #000)',
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === 'cs' ? 'Vytvořit novou cílovou záložku' : 'Create new target folder'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {folders
                        .filter((f) => f.id !== selectedFolderId)
                        .map((f) => {
                          const isTarget = targetFolderId === f.id;
                          return (
                            <div
                              key={f.id}
                              onClick={() => setTargetFolderId(f.id)}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                isTarget
                                  ? 'border-[var(--accent-primary)] bg-[var(--badge-bg)]'
                                  : 'border-[var(--panel-border)] bg-black/20 hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Folder className={`w-4 h-4 shrink-0 ${isTarget ? 'text-[var(--accent-primary)]' : 'text-slate-400'}`} />
                                <div className="min-w-0">
                                  <p className="font-bold text-xs truncate">{f.name}</p>
                                  {f.comment && (
                                    <p className="text-[10px] text-slate-400 truncate">{f.comment}</p>
                                  )}
                                </div>
                              </div>

                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/40 text-slate-300 shrink-0">
                                {f.itemCount}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border bg-black/30 space-y-3" style={{ borderColor: 'var(--panel-border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1.5">
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>{lang === 'cs' ? 'Vytvořit novou cílovou záložku' : 'Create new target folder'}</span>
                    </span>
                    {folders.filter((f) => f.id !== selectedFolderId).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsCreatingNewTarget(false)}
                        className="text-[10px] text-slate-400 hover:text-white"
                      >
                        {lang === 'cs' ? 'Zvolit existující' : 'Choose existing'}
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-slate-300">
                      {lang === 'cs' ? 'Název nové záložky:' : 'New folder name:'} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={lang === 'cs' ? 'např. Pohádky pro děti' : 'Folder name'}
                      value={newTargetName}
                      onChange={(e) => setNewTargetName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border bg-black/40 text-white focus:outline-none focus:border-[var(--accent-primary)]"
                      style={{ borderColor: 'var(--panel-border)' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-slate-300">
                      {lang === 'cs' ? 'Komentář k záložce (volitelný):' : 'Optional comment:'}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === 'cs' ? 'např. na víkend' : 'Description'}
                      value={newTargetComment}
                      onChange={(e) => setNewTargetComment(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border bg-black/40 text-white focus:outline-none focus:border-[var(--accent-primary)]"
                      style={{ borderColor: 'var(--panel-border)' }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--panel-border)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMovingItem(null);
                    setBatchMovingItemIds([]);
                    setIsCreatingNewTarget(false);
                  }}
                  className="py-2 px-4 rounded-xl text-xs font-semibold hover:bg-white/5 transition-colors"
                >
                  {lang === 'cs' ? 'Zrušit' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isMoving || (!targetFolderId && !(isCreatingNewTarget && newTargetName.trim()))}
                  className="py-2 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-md flex items-center gap-1.5"
                  style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast, #000)' }}
                >
                  {isMoving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{lang === 'cs' ? 'Přesouvám...' : 'Moving...'}</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>
                        {isCreatingNewTarget && newTargetName.trim()
                          ? (lang === 'cs' ? 'Vytvořit záložku a přesunout' : 'Create Folder & Move')
                          : (lang === 'cs' ? 'Přesunout' : 'Move')}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
