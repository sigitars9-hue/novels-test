"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  Home,
  LibraryBig,
  Search,
  PenSquare,
  Settings,
  User2,
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type NavItem = { href: Route; label: string; icon: React.ComponentType<any> };

const BASE_ITEMS: NavItem[] = [
  { href: "/" as Route,        label: "Home",     icon: Home },
  { href: "/library" as Route, label: "Library",  icon: LibraryBig },
  { href: "/search" as Route,  label: "Search",   icon: Search },
  { href: "/write" as Route,   label: "Write",    icon: PenSquare },
  { href: "/moderate" as Route,label: "Moderasi", icon: Settings },
];

export default function BottomBar() {
  const pathname = usePathname();

  // auth + avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user ?? null;
      setIsAuthed(!!user);

      if (!user) {
        if (mounted) setAvatarUrl(null);
        return;
      }

      const meta = (user.user_metadata || {}) as Record<string, any>;
      const pick =
        meta.avatar_url || meta.picture || meta.image || meta.avatar || null;

      if (pick) {
        if (mounted) setAvatarUrl(String(pick));
      } else {
        const { data: p } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        if (mounted) setAvatarUrl(p?.avatar_url ?? null);
      }
    };

    load();
    const sub = supabase.auth.onAuthStateChange(() => load());
    return () => {
      mounted = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  // tambahkan item profile di ujung kanan
  const items: NavItem[] = [...BASE_ITEMS, { href: "/profile" as Route, label: "Profil", icon: User2 }];

  return (
    <>
      {/* spacer supaya konten tidak ketutup navbar bawah */}
      <div className="h-[68px]" />

      <nav
        aria-label="Bottom navigation"
        className="fixed left-0 right-0 bottom-0 z-[70] border-t border-white/10
                   bg-zinc-950/90 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/70"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px))", WebkitTapHighlightColor: "transparent" }}
      >
        <div className="mx-auto flex h-[68px] w-full max-w-[1100px] items-center justify-evenly px-2">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === ("/" as Route) ? pathname === "/" : pathname.startsWith(href);
            const isProfile = href === ("/profile" as Route);

            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-colors",
                  active ? "text-white" : "text-zinc-400 hover:text-white"
                )}
              >
                {isProfile && isAuthed && avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className={clsx(
                      "h-5 w-5 rounded-full object-cover",
                      active ? "ring-2 ring-sky-500/60" : "ring-1 ring-white/10"
                    )}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Icon className="h-5 w-5 shrink-0" />
                )}
                <span className="text-[11px] font-medium leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
