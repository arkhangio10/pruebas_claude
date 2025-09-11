"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signInAnonymously, signOut, User } from 'firebase/auth';

export interface AuthContextValue {
  currentUser: User | null;
  selectedProject: string | null;
  loginAnon: () => Promise<void>;
  logout: () => Promise<void>;
  switchProject: (id: string|null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setCurrentUser(u));
    return () => unsub();
  }, []);

  const loginAnon = useCallback(async () => { await signInAnonymously(auth); }, []);
  const logout = useCallback(async () => { await signOut(auth); }, []);
  const switchProject = useCallback((id: string|null) => setSelectedProject(id), []);

  return (
    <AuthContext.Provider value={{ currentUser, selectedProject, loginAnon, logout, switchProject }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
