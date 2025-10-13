"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { BookOpen, Home, Library, Search, PenSquare, Settings } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { UserButton } from "./UserButton";
import { supabase } from "@/lib/supabaseClient";

async function ensureProfileSilently() {
  try {
    // RPC returns { data, error } in v2
    const { error } = await supabase.rpc("ensure_profile");
    // ignore error—this is a best‐effort fallback
    if (error) {
      // optional: console.warn("ensure_profile error:", error.message);
    }
  } catch {
    // ignore
  }
}

export function TopBar() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session?.user) await ensureProfileSilently();
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      if (sess?.user) {
        // run async without awaiting the callback itself
        ensureProfileSilently();
      }
    });

    unsub = () => listener?.subscription?.unsubscribe?.();
    return () => { if (unsub) unsub(); };
  }, []);

  return (
    <header className="sticky top-0 z-40 backdrop-blur border-b border-white/10 bg-[var(--header-bg)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
        <Link href="/" className="group inline-flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-gradient-to-br from-sky-500 to-indigo-500 grid place-items-center">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-wide">OpenVerse</span>
        </Link>

        <nav className="ml-auto hidden md:flex items-center gap-1 text-sm">
          <Link href="/" className="px-3 py-1.5 rounded hover:bg-white/5 flex items-center gap-2">
            <Home className="h-4 w-4" /> Home
          </Link>
          <Link href={"/library" as Route} className="px-3 py-1.5 rounded hover:bg-white/5 flex items-center gap-2">
            <Library className="h-4 w-4" /> Library
          </Link>
          <Link href={"/search" as Route} className="px-3 py-1.5 rounded hover:bg-white/5 flex items-center gap-2">
            <Search className="h-4 w-4" /> Search
          </Link>
          <Link href={"/write" as Route} className="px-3 py-1.5 rounded hover:bg-white/5 flex items-center gap-2">
            <PenSquare className="h-4 w-4" /> Write
          </Link>
          <Link href={"/moderate" as Route} className="px-3 py-1.5 rounded hover:bg-white/5 flex items-center gap-2">
            <Settings className="h-4 w-4" /> Moderasi
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <UserButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
