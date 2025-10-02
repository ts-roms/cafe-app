"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUsers, updateUser, type UserRecord, addAudit } from "@/lib/storage";
import Link from "next/link";

export default function ProfilePage() {
  const { user } = useAuth();
  const [dir, setDir] = useState<UserRecord[]>([]);
  const me = useMemo(() => dir.find(u => u.id === user?.id), [dir, user?.id]);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [birthday, setBirthday] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDir(getUsers());
  }, []);

  useEffect(() => {
    if (me) {
      setName(me.name || "");
      setUsername(me.username || "");
      setCode(me.code || "");
      setBirthday(me.birthday || "");
    }
  }, [me?.id]);

  if (!user) {
    return (
      <div className="p-4 border rounded">
        <p className="mb-2">You must be logged in to edit your profile.</p>
        <Link className="underline" href="/login">Go to login</Link>
      </div>
    );
  }

  if (!me) {
    return <div className="p-4 border rounded">Loading...</div>;
  }

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Validate username uniqueness
      const taken = dir.some(u => u.id !== me.id && (u.username || "").toLowerCase() === (username || "").trim().toLowerCase());
      if (taken) { alert("Username already taken"); setSaving(false); return; }
      const next: UserRecord = {
        ...me,
        name: name.trim() || me.name,
        username: username.trim() || undefined,
        code: code.trim() || undefined,
        birthday: birthday || undefined,
        password: password ? password : me.password,
      };
      updateUser(next);
      addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: { id: user.id, name: user.name }, action: "profile:update", details: `${me.name} -> ${next.name}` });
      alert("Profile saved");
      // Minimal approach to refresh visible name in NavBar without changing AuthContext API
      if (typeof window !== "undefined") window.location.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">My Profile</h1>
      <form onSubmit={onSave} className="grid gap-3 p-4 border rounded">
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded px-3 py-2 bg-transparent" />
        </div>
        <div>
          <label className="block text-sm mb-1">Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} className="w-full border rounded px-3 py-2 bg-transparent" />
        </div>
        <div>
          <label className="block text-sm mb-1">Employee Code</label>
          <input value={code} onChange={e => setCode(e.target.value)} className="w-full border rounded px-3 py-2 bg-transparent" />
        </div>
        <div>
          <label className="block text-sm mb-1">Birthday</label>
          <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className="w-full border rounded px-3 py-2 bg-transparent" />
        </div>
        <div>
          <label className="block text-sm mb-1">New Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded px-3 py-2 bg-transparent" placeholder="Leave blank to keep current" />
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-sm mb-1">Role</label>
            <input value={user.role} readOnly className="w-full border rounded px-3 py-2 bg-transparent opacity-70" />
          </div>
        </div>
        <button disabled={saving} className="px-4 py-2 rounded bg-foreground text-background">{saving ? "Saving..." : "Save"}</button>
      </form>
    </div>
  );
}
