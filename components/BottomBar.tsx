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
  UserCircle2,
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ───────────────── Config ───────────────── */
type NavItem = { href: Route; label: string; icon?: React.ComponentType<any> };

const NAV_ITEMS: NavItem[] = [
  { href: "/" as Route, label: "Home", icon: Home },
  { href: "/library" as Route, label: "Library", icon: LibraryBig },
  { href: "/search" as Route, label: "Search", icon: Search },
  { href: "/write" as Route, label: "Write", icon: PenSquare },
  { href: "/moderate" as Route, label: "Moderasi", icon: Settings },
];

// ❗TAMPIL HANYA DI RUTE INI (whitelist).
//   Kalau mau pakai blacklist tinggal kebalik logikanya.
const SHOW_ON_PREFIX = ["/", "/library", "/search", "/write", "/moderate", "/profile"];

// id elemen untuk diukur tingginya
const BAR_ID = "global-bottom-bar";
// fallback tinggi bar kalau ResizeObserver belum jalan (px)
const BAR_FALLBACK = 68;

/* ───────────────── Komponen ───────────────── */
export default function BottomBar() {
  const pathname = usePathname() || "/";

  // tampil hanya kalau path ada di whitelist
  const showBar =
    SHOW_ON_PREFIX.some((p) =>
      p === "/" ? pathname === "/" : pathname.startsWith(p)
    );

  // state auth/avatar ringan
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const avatarSetOnce = useRef(false);

  // ukur tinggi bar → set padding-bottom pada <body>
  useEffect(() => {
    const body = document.body;
    const el = document.getElementById(BAR_ID);

    // fungsi apply padding
    const setPad = (px: number) => {
      body.style.paddingBottom = showBar
        ? `calc(${Math.round(px)}px + env(safe-area-inset-bottom))`
        : ""; // hapus padding saat bar disembunyikan
      // simpan juga ke var kalau kamu mau pakai di CSS lain
      document.documentElement.style.setProperty("--bbh", `${Math.round(px)}px`);
    };

    // jika bar sedang tidak ditampilkan → bersihkan padding & stop
    if (!showBar) {
      setPad(0);
      return;
    }

    // set awal (fallback)
    setPad(el?.getBoundingClientRect().height || BAR_FALLBACK);

    // observe perubahan tinggi (responsif & dinamis)
    const ro =
      el &&
      new ResizeObserver((entries) => {
        const h = entries[0]?.contentRect?.height ?? BAR_FALLBACK;
        setPad(h);
      });
    if (el && ro) ro.observe(el);

    return () => {
      if (ro && el) ro.unobserve(el);
    };
  }, [showBar, pathname]);

  // auth: ambil sesi & avatar (sekali, ringan)
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const user = data.session?.user ?? null;
      setLoggedIn(!!user);

      if (user && !avatarSetOnce.current) {
        try {
          const { data: p } = await supabase
            .from("profiles")
            .select("avatar_url, name")
            .eq("id", user.id)
            .maybeSingle();

          const displayName =
            p?.name ||
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "User";

          const url =
            p?.avatar_url ||
            user.user_metadata?.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              displayName
            )}`;

          setAvatarUrl(url);
          avatarSetOnce.current = true;
        } catch {
          const displayName =
            user?.user_metadata?.full_name ||
            user?.email?.split("@")[0] ||
            "User";
          setAvatarUrl(
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              displayName
            )}`
          );
          avatarSetOnce.current = true;
        }
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setLoggedIn(!!session?.user);
      if (session?.user && !avatarSetOnce.current) {
        const displayName =
          session.user.user_metadata?.full_name ||
          session.user.email?.split("@")[0] ||
          "User";
        setAvatarUrl(
          `https://ui-avatars.com/api/?name=${encodeURIComponent(
            displayName
          )}`
        );
        avatarSetOnce.current = true;
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // jika tidak termasuk whitelist → jangan render apa-apa
  if (!showBar) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      id={BAR_ID}
      className={clsx(
        "fixed inset-x-0 bottom-0 z-[70] border-t border-white/10",
        "bg-zinc-950/90 supports-[backdrop-filter]:backdrop-blur"
        // kalau mau hanya mobile: tambahkan "md:hidden" di sini
      )}
      style={{
        // safe-area untuk iPhone
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        // bantu GPU
        transform: "translateZ(0)",
        willChange: "transform",
      }}
    >
      <div className="mx-auto flex h-[68px] w-[min(1100px,95vw)] select-none touch-manipulation items-center justify-between px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
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
          href={(loggedIn ? "/profile" : "/login") as Route}
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
          <span className="truncate text-[11px] font-medium">
            {loggedIn ? "Profile" : "Login"}
          </span>
        </Link>
      </div>
    </nav>
  );
}
