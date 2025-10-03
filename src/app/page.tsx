"use client";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/lib/rbac";
import { motion } from "framer-motion";

export default function Home() {
  const { user } = useAuth();
  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <motion.h1 className="text-3xl font-semibold" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>Cafe App</motion.h1>
      <motion.p className="opacity-80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>Simple demo for POS, Accounting and Time tracking with Role-Based Access Control.</motion.p>
      <motion.div className="p-4 border rounded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.15 }}>
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
      </motion.div>
      <div className="grid sm:grid-cols-3 gap-3">
        <FeatureCard title="POS" href="/pos" description="Sell items and record sales." />
        <FeatureCard title="Accounting" href="/accounting" description="View sales ledger and totals." />
        <FeatureCard title="Time" href="/time" description="Clock in/out and view your logs." />
        <FeatureCard title="Time Kiosk" href="/kiosk" description="Clock in/out with employee code (no login)." />
      </div>
    </motion.div>
  );
}

function FeatureCard({ title, description, href }: Readonly<{
  title: string;
  description: string;
  href: string
}>) {
  return (
    <Link href={href} className="block">
      <motion.div className="p-4 border rounded hover:bg-black/5 dark:hover:bg-white/10"
        initial={{ opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-20%" }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <div className="font-semibold">{title}</div>
        <div className="text-sm opacity-80">{description}</div>
      </motion.div>
    </Link>
  );
}
