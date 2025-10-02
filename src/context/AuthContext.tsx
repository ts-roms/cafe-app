"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Role } from "@/lib/rbac";
import { getUsers, type UserRecord } from "@/lib/storage";

export type User = {
  id: string;
  name: string;
  role: Role;
};

type AuthContextType = {
  user: User | null;
  signIn: (name: string, role: Role) => void; // legacy demo login
  signInWithCredentials: (username: string, password: string) => boolean; // returns success
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
        // Legacy demo sign-in: create ephemeral user with chosen role
        const u: User = {
          id: crypto.randomUUID(),
          name: name || role.toUpperCase(),
          role,
        };
        setUser(u);
      },
      signInWithCredentials: (username: string, password: string) => {
        try {
          const list = getUsers();
          const rec: UserRecord | undefined = list.find(u => (u.username || "").toLowerCase() === username.trim().toLowerCase());
          if (!rec || (rec.password || "") !== password) return false;
          const u: User = { id: rec.id, name: rec.name, role: rec.role };
          setUser(u);
          return true;
        } catch {
          return false;
        }
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
