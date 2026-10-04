import { YodoUser, BookmarkFolder, BookmarkItem } from '../types';

const TOKEN_KEY = 'yodo_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error || `Chyba serveru (${response.status})`;
    throw new Error(errorMsg);
  }

  return data as T;
}

// === AUTH API ===

export interface AuthResponse {
  success: boolean;
  token: string;
  user: YodoUser;
  message?: string;
  isNewUser?: boolean;
}

export async function apiRegister(email: string, password: string, displayName?: string): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>('/api/yodo/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });
  if (res.token) {
    setStoredToken(res.token);
  }
  return res;
}

export async function apiLogin(email: string, password: string, rememberMe = true): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>('/api/yodo/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, rememberMe }),
  });
  if (res.token) {
    setStoredToken(res.token);
  }
  return res;
}

export async function apiGoogleLogin(idToken: string): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>('/api/yodo/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  if (res.token) {
    setStoredToken(res.token);
  }
  return res;
}

export async function apiGetMe(): Promise<YodoUser | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await apiFetch<{ success: boolean; user: YodoUser }>('/api/yodo/auth/me');
    return res.user;
  } catch {
    setStoredToken(null);
    return null;
  }
}

export async function apiChangePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiFetch('/api/yodo/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function apiUpdateProfile(displayName: string): Promise<YodoUser> {
  const res = await apiFetch<{ success: boolean; user: YodoUser }>('/api/yodo/auth/update-profile', {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
  return res.user;
}

export function apiLogout() {
  setStoredToken(null);
}

// === FOLDERS & BOOKMARKS API ===

export async function apiGetFolders(): Promise<BookmarkFolder[]> {
  const res = await apiFetch<{ success: boolean; folders: BookmarkFolder[] }>('/api/yodo/folders');
  return res.folders || [];
}

export async function apiCreateFolder(name: string, comment?: string): Promise<BookmarkFolder> {
  const res = await apiFetch<{ success: boolean; folder: BookmarkFolder }>('/api/yodo/folders', {
    method: 'POST',
    body: JSON.stringify({ name, comment }),
  });
  return res.folder;
}

export async function apiUpdateFolder(id: number, data: { name?: string; comment?: string; sortOrder?: number }): Promise<BookmarkFolder> {
  const res = await apiFetch<{ success: boolean; folder: BookmarkFolder }>(`/api/yodo/folders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.folder;
}

export async function apiDeleteFolder(id: number): Promise<void> {
  await apiFetch(`/api/yodo/folders/${id}`, {
    method: 'DELETE',
  });
}

export async function apiGetFolderItems(folderId: number): Promise<{ folder: { id: number; name: string; comment?: string }; items: BookmarkItem[] }> {
  const res = await apiFetch<{
    success: boolean;
    folder: { id: number; name: string; comment?: string };
    items: BookmarkItem[];
  }>(`/api/yodo/folders/${folderId}/items`);
  return { folder: res.folder, items: res.items || [] };
}

export async function apiAddFolderItem(folderId: number, itemData: {
  url: string;
  videoId?: string;
  platform?: string;
  title?: string;
  author?: string;
  thumbnailUrl?: string;
  duration?: string;
  note?: string;
}): Promise<BookmarkItem> {
  const res = await apiFetch<{ success: boolean; item: BookmarkItem; alreadyExisted?: boolean }>(`/api/yodo/folders/${folderId}/items`, {
    method: 'POST',
    body: JSON.stringify(itemData),
  });
  return res.item;
}

export async function apiDeleteFolderItem(folderId: number, itemId: number): Promise<void> {
  await apiFetch(`/api/yodo/folders/${folderId}/items/${itemId}`, {
    method: 'DELETE',
  });
}

export async function apiUpdateFolderItem(folderId: number, itemId: number, data: { note?: string; sortOrder?: number }): Promise<void> {
  await apiFetch(`/api/yodo/folders/${folderId}/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function apiMoveFolderItem(folderId: number, itemId: number, targetFolderId: number): Promise<void> {
  await apiFetch(`/api/yodo/folders/${folderId}/items/${itemId}/move`, {
    method: 'POST',
    body: JSON.stringify({ targetFolderId }),
  });
}

export async function apiBatchMoveFolderItems(folderId: number, itemIds: number[], targetFolderId: number): Promise<{ movedCount: number; skippedCount: number; message: string }> {
  return await apiFetch<{ success: boolean; movedCount: number; skippedCount: number; message: string }>(
    `/api/yodo/folders/${folderId}/items/batch-move`,
    {
      method: 'POST',
      body: JSON.stringify({ itemIds, targetFolderId }),
    }
  );
}

export async function apiBatchDeleteFolderItems(folderId: number, itemIds: number[]): Promise<{ deletedCount: number; message: string }> {
  return await apiFetch<{ success: boolean; deletedCount: number; message: string }>(
    `/api/yodo/folders/${folderId}/items/batch-delete`,
    {
      method: 'POST',
      body: JSON.stringify({ itemIds }),
    }
  );
}

export async function apiCheckVideoSaved(url: string): Promise<Array<{ folderId: number; folderName: string; itemId: number; note?: string }>> {
  if (!getStoredToken() || !url.trim()) return [];
  try {
    const res = await apiFetch<{
      savedIn: Array<{ folderId: number; folderName: string; itemId: number; note?: string }>;
    }>(`/api/yodo/folders/check-video?url=${encodeURIComponent(url.trim())}`);
    return res.savedIn || [];
  } catch {
    return [];
  }
}
