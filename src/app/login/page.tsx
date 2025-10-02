"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { signInWithCredentials } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>("");

  const doLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const ok = signInWithCredentials(username, password);
    if (!ok) {
      setError("Invalid username or password");
      return;
    }
    router.push("/");
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Login</h1>
      <form onSubmit={doLogin} className="space-y-4 p-4 border rounded">
        <div>
          <label className="block text-sm mb-1">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border rounded px-3 py-2 bg-transparent" placeholder="Enter username" autoComplete="username" />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded px-3 py-2 bg-transparent" placeholder="Enter password" autoComplete="current-password" />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button className="px-4 py-2 rounded bg-foreground text-background w-full">Sign In</button>
      </form>
      <p className="text-xs opacity-70 mt-3">Hint: default admin is username "admin" with password "admin" on first run.</p>
    </div>
  );
}
