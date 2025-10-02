"use client";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/lib/rbac";

export default function NavBar() {
  const { user, signOut } = useAuth();
  const canAdmin = user ? hasPermission(user.role, "settings:manage") : false;
  const canInventory = user ? hasPermission(user.role, "inventory:manage") : false;
  return (
    <header className="w-full border-b border-black/10 dark:border-white/15 mb-6">
      <div className="max-w-5xl mx-auto p-4 flex items-center justify-between gap-4">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="hover:underline">Home</Link>
          <Link href="/pos" className="hover:underline">POS</Link>
          <Link href="/accounting" className="hover:underline">Accounting</Link>
          <Link href="/time" className="hover:underline">Time</Link>
          {canInventory && <Link href="/inventory" className="hover:underline">Inventory</Link>}
          {canAdmin && <Link href="/admin" className="hover:underline">Admin</Link>}
        </nav>
        <div className="text-sm flex items-center gap-3">
          {user ? (
            <>
              <span className="opacity-80">{user.name} ({user.role})</span>
              <button onClick={signOut} className="px-3 py-1 rounded border hover:bg-black/5 dark:hover:bg-white/10">Logout</button>
            </>
          ) : (
            <Link href="/login" className="px-3 py-1 rounded border hover:bg-black/5 dark:hover:bg-white/10">Login</Link>
          )}
        </div>
      </div>
    </header>
  );
}
