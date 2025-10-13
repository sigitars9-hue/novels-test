"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { Home, LibraryBig, Search, PenSquare, Settings, UserCircle2 } from "lucide-react";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type NavItem = { href: Route; label: string; icon?: React.ComponentType<any> };

const items: NavItem[] = [
  { href: "/" as Route, label: "Home", icon: Home },
  { href: "/library" as Route, label: "Library", icon: LibraryBig },
  { href: "/search" as Route, label: "Search", icon: Search },
  { href: "/write" as Route, label: "Write", icon: PenSquare },
  { href: "/moderate" as Route, label: "Moderasi", icon: Settings },
  // profile ditempatkan paling kanan (lihat render di bawah)
];

export default function BottomBar() {
  const pathname = usePathname();

  // ——— AUTH AVATAR (stabil & ringan) ———
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const avatarSetOnce = useRef(false);

  useEffect(() => {
    let mounted = true;

    // ambil sesi awal (tanpa blocking UI)
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const user = data.session?.user ?? null;
      setLoggedIn(!!user);

      // ambil avatar sekali saja (cache di state)
      if (user && !avatarSetOnce.current) {
        // coba dari profiles dulu
        try {
          const { data: p } = await supabase
            .from("profiles")
            .select("avatar_url, name")
            .eq("id", user.id)
            .maybeSingle();

          const displayName =
            p?.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

          const url =
            p?.avatar_url ||
            user.user_metadata?.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`;

          setAvatarUrl(url);
          avatarSetOnce.current = true;
        } catch {
          const displayName =
            user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
          setAvatarUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`);
          avatarSetOnce.current = true;
        }
      }
    });

    // subscribe perubahan auth (update flag login saja; avatar tetap pakai cache)
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setLoggedIn(!!session?.user);
      if (session?.user && !avatarSetOnce.current) {
        const displayName =
          session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "User";
        setAvatarUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`);
        avatarSetOnce.current = true;
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ——— ACTIVE STATE ———
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // ——— RENDER ———
  return (
    <>
      {/* spacer supaya konten tidak ketutup navbar bawah */}
      <div className="h-[68px] md:hidden" />

      <nav
        className={clsx(
          "fixed inset-x-0 bottom-0 z-[70] border-t border-white/10",
          // kurangi blur di mobile (repaint berat)
          "bg-zinc-950/90 supports-[backdrop-filter]:backdrop-blur",
          "md:backdrop-blur"
        )}
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px))",
          // bantu GPU compositing untuk kurangi flicker di mobile
          transform: "translateZ(0)",
          willChange: "transform",
        }}
      >
        <div className="mx-auto flex h-[68px] w-[min(1100px,95vw)] items-center justify-between px-3 select-none touch-manipulation">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={clsx(
                "flex min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-colors",
                isActive(href) ? "text-white" : "text-zinc-400 hover:text-white"
              )}
            >
              {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
              <span className="truncate text-[11px] font-medium">{label}</span>
            </Link>
          ))}

          {/* PROFILE (kanan) */}
          <Link
            href={loggedIn ? ("/profile" as Route) : ("/login" as Route)}
            prefetch={false}
            className={clsx(
              "flex min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-colors",
              isActive("/profile") ? "text-white" : "text-zinc-400 hover:text-white"
            )}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="me"
                width={28}
                height={28}
                decoding="async"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "data:image/svg+xml;charset=UTF-8," +
                    encodeURIComponent(
                      `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><rect width='100%' height='100%' fill='#18181b'/></svg>`
                    );
                }}
                className="h-[28px] w-[28px] rounded-full border border-white/10 object-cover"
                style={{ transform: "translateZ(0)" }}
              />
            ) : (
              <UserCircle2 className="h-5 w-5" />
            )}
            <span className="truncate text-[11px] font-medium">Profile</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
