'use client';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signInAnonymously as signInAnon, signOut as fbSignOut, User } from 'firebase/auth';
import { useEffect, useState } from 'react';

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  return {
    user,
    signInAnonymously: () => signInAnon(auth).then(() => undefined),
    signOut: () => fbSignOut(auth)
  };
}

