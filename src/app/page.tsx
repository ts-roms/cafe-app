"use client";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/lib/rbac";

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Cafe App</h1>
      <p className="opacity-80">Simple demo for POS, Accounting and Time tracking with Role-Based Access Control.</p>
      <div className="p-4 border rounded">
        {user ? (
          <div>
            <div className="mb-2">Signed in as <b>{user.name}</b> ({user.role})</div>
            <ul className="list-disc list-inside text-sm">
              <li>POS access: {hasPermission(user.role, "pos:use") ? "Yes" : "No"}</li>
              <li>Accounting access: {hasPermission(user.role, "accounting:view") ? "Yes" : "No"}</li>
              <li>Time access: {hasPermission(user.role, "time:record") ? "Yes" : "No"}</li>
            </ul>
          </div>
        ) : (
          <div>
            <div className="mb-2">You are not signed in.</div>
            <Link className="underline" href="/login">Login</Link>
          </div>
        )}
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <FeatureCard title="POS" href="/pos" description="Sell items and record sales." />
        <FeatureCard title="Accounting" href="/accounting" description="View sales ledger and totals." />
        <FeatureCard title="Time" href="/time" description="Clock in/out and view your logs." />
      </div>
    </div>
  );
}

function FeatureCard({ title, description, href }: Readonly<{
  title: string;
  description: string;
  href: string
}>) {
  return (
    <Link href={href} className="block p-4 border rounded hover:bg-black/5 dark:hover:bg-white/10">
      <div className="font-semibold">{title}</div>
      <div className="text-sm opacity-80">{description}</div>
    </Link>
  );
}
