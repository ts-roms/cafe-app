"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/lib/rbac";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [role, setRole] = useState<Role>("cashier");
  const [name, setName] = useState("");

  const doLogin = (e: React.FormEvent) => {
    e.preventDefault();
    signIn(name || role.toUpperCase(), role);
    router.push("/");
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Login (Demo)</h1>
      <form onSubmit={doLogin} className="space-y-4 p-4 border rounded">
        <div>
          <label className="block text-sm mb-1">Display Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-3 py-2 bg-transparent" placeholder="Optional" />
        </div>
        <div>
          <label className="block text-sm mb-1">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-full border rounded px-3 py-2 bg-transparent">
            <option value="admin">Admin</option>
            <option value="cashier">Cashier</option>
            <option value="staff">Staff</option>
          </select>
        </div>
        <button className="px-4 py-2 rounded bg-foreground text-background">Login</button>
      </form>
      <p className="text-xs opacity-70 mt-3">This is a mock login that stores your choice in localStorage.</p>
    </div>
  );
}
