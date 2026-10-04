import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { YodoUser } from '../types';
import {
  apiGetMe,
  apiLogin,
  apiRegister,
  apiGoogleLogin,
  apiLogout,
  getStoredToken,
} from '../utils/yodoApi';

interface AuthContextType {
  user: YodoUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'register';
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
  openAuthModal: (tab?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  updateUser: (user: YodoUser) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<YodoUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const initAuth = async () => {
      const token = getStoredToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await apiGetMe();
        setUser(currentUser);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string, rememberMe = true) => {
    const res = await apiLogin(email, password, rememberMe);
    setUser(res.user);
    setIsAuthModalOpen(false);
  };

  const register = async (email: string, password: string, displayName?: string) => {
    const res = await apiRegister(email, password, displayName);
    setUser(res.user);
    setIsAuthModalOpen(false);
  };

  const loginWithGoogle = async (idToken: string) => {
    const res = await apiGoogleLogin(idToken);
    setUser(res.user);
    setIsAuthModalOpen(false);
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  const openAuthModal = (tab: 'login' | 'register' = 'login') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const updateUser = (updated: YodoUser) => {
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isAuthModalOpen,
        authModalTab,
        login,
        register,
        loginWithGoogle,
        logout,
        openAuthModal,
        closeAuthModal,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
