"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Role } from "@/lib/rbac";

export type User = {
  id: string;
  name: string;
  role: Role;
};

type AuthContextType = {
  user: User | null;
  signIn: (name: string, role: Role) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "cafe_auth_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [user]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      signIn: (name: string, role: Role) => {
        const u: User = {
          id: crypto.randomUUID(),
          name: name || role.toUpperCase(),
          role,
        };
        setUser(u);
      },
      signOut: () => setUser(null),
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
