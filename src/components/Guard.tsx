"use client";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { hasPermission, type Permission } from "@/lib/rbac";
import Link from "next/link";

export function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return (
      <div className="p-4 border rounded">
        <p className="mb-2">You must be logged in to access this page.</p>
        <Link className="underline" href="/login">Go to login</Link>
      </div>
    );
  }
  if (!hasPermission(user.role, permission)) {
    return (
      <div className="p-4 border rounded">
        <p className="mb-2">Access denied. Your role "{user.role}" lacks permission: {permission}</p>
        <Link className="underline" href="/">Return Home</Link>
      </div>
    );
  }
  return <>{children}</>;
}
