"use client";
import { useEffect } from "react";
import { makeServer } from "./server";

export default function MirageBoot() {
  useEffect(() => {
    // Only start in the browser and in development
    if (process.env.NODE_ENV !== "production") {
      try { makeServer(); } catch {}
    }
  }, []);
  return null;
}
