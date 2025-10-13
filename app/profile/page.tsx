"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import BottomBar from "@/components/BottomBar";
import {
  Calendar,
  Edit3,
  ExternalLink,
  Loader2,
  PenSquare,
  ShieldCheck,
  User2,
  Bookmark,
  Sparkles,
  LogOut,
  UserPlus,
  Check,
} from "lucide-react";
import clsx from "clsx";

/* ======================== Types ======================== */
type Profile = {
  id: string;
  name: string | null;
  handle: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_admin: boolean | null;
  created_at?: string | null;
};

type Novel = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  status: string | null;
  created_at: string;
};

/* ======================== UI helpers ======================== */
const cx = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(" ");

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cx("animate-pulse rounded bg-white/10", className)} />;
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{children}</div>;
}

function NovelCard({ n }: { n: Novel }) {
  return (
    <Link
      href={`/novel/${n.slug}`}
      className="group relative overflow-hidden rounded-xl bg-white/5 border border-white/10"
    >
      <div className="aspect-[3/4] w-full overflow-hidden">
        <img
          src={n.cover_url || `https://picsum.photos/seed/${n.slug}/400/560`}
          alt={n.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="p-3">
        <h4 className="line-clamp-1 text-[15px] font-semibold">{n.title}</h4>
        <div className="mt-1 text-xs text-white/60">{n.status || "Ongoing"}</div>
      </div>
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>
    </Link>
  );
}

/* ======================== Scrollable Tabs ======================== */
function TabsBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const btn = el.querySelector<HTMLButtonElement>(`[data-tab="${active}"]`);
    if (!btn) return;
    const left = btn.offsetLeft - 16;
    const right = left + btn.offsetWidth + 32;
    const viewLeft = el.scrollLeft;
    const viewRight = viewLeft + el.clientWidth;
    if (left < viewLeft) el.scrollTo({ left, behavior: "smooth" });
    else if (right > viewRight) el.scrollTo({ left: right - el.clientWidth, behavior: "smooth" });
  }, [active]);

  return (
    <div className="relative -mx-4 px-4">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-zinc-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-zinc-950 to-transparent" />
      <div
        ref={trackRef}
        className="flex gap-2 overflow-x-auto whitespace-nowrap border-b border-white/10 pb-0.5
                   [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            data-tab={t.id}
            onClick={() => onChange(t.id)}
            className={clsx(
              "px-3 py-2 text-sm transition-colors",
              active === t.id
                ? "border-b-2 border-sky-500 font-semibold text-white"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ======================== Page ======================== */
export default function ProfilePage() {
  // auth state
  const [authUser, setAuthUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  // data state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<Novel[]>([]);
  const [counts, setCounts] = useState({ novels: 0, drafts: 0, bookmarks: 0 });

  // follow state
  const [followers, setFollowers] = useState<number | "—">("—");
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followBusy, setFollowBusy] = useState(false);

  const [tab, setTab] = useState<"overview" | "bookmarks" | "works" | "drafts" | "settings">(
    "overview"
  );

  /* ---- Auth bootstrap ---- */
  useEffect(() => {
    setAuthReady(true);

    supabase.auth.getSession().then(({ data }) => {
      setAuthUser(data.session?.user ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_ev, sess) => {
      setAuthUser(sess?.user ?? null);
    });

    // hijaukan callback param ke /auth/callback
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      if ((u.searchParams.get("code") || u.searchParams.get("error_code")) && !u.pathname.startsWith("/auth/callback")) {
        window.location.href = `/auth/callback${u.search}`;
      }
    }

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  /* ---- Load data profil dkk ---- */
  useEffect(() => {
    (async () => {
      if (!authReady) return;
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setAuthUser(user ?? null);
        if (!user) return;

        try { await supabase.rpc("ensure_profile"); } catch {}

        let { data: p } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (!p) {
          const fallbackName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
          const handle = (fallbackName || "user").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 16);
          const avatar_url = user.user_metadata?.avatar_url || null;
          const { data: inserted } = await supabase
            .from("profiles")
            .upsert({ id: user.id, name: fallbackName, handle, avatar_url })
            .select("*")
            .single();
          p = inserted as any;
        }
        setProfile(p as Profile);

        if (!p?.id) return;

        const [nv, df] = await Promise.all([
          supabase
            .from("novels")
            .select("id, slug, title, cover_url, status, created_at")
            .eq("author_id", p.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("submissions")
            .select("id, title, cover_url, status, created_at")
            .eq("author_id", p.id)
            .order("created_at", { ascending: false }),
        ]);

        setNovels(nv.data || []);
        const draftsAll = df.data || [];
        setDrafts(draftsAll.filter((d) => d.status !== "approved"));

        let bookmarked: Novel[] = [];
        try {
          const { data: rows } = await supabase.from("bookmarks").select("novel_id").eq("user_id", p.id);
          const ids = (rows || []).map((r: any) => r.novel_id);
          if (ids.length) {
            const { data: nvs } = await supabase
              .from("novels")
              .select("id, slug, title, cover_url, status, created_at")
              .in("id", ids);
            bookmarked = nvs || [];
          }
        } catch { bookmarked = []; }
        setBookmarks(bookmarked);

        setCounts({
          novels: (nv.data || []).length,
          drafts: draftsAll.filter((d) => d.status === "pending").length,
          bookmarks: bookmarked.length,
        });

        // Followers & status (aman kalau tabel belum ada)
        try {
          const { count } = await supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", p.id);
          setFollowers(typeof count === "number" ? count : "—");

          const me = user?.id;
          if (me && me !== p.id) {
            const { data: mine } = await supabase
              .from("follows")
              .select("follower_id")
              .eq("follower_id", me)
              .eq("following_id", p.id)
              .maybeSingle();
            setIsFollowing(!!mine);
          } else {
            setIsFollowing(false);
          }
        } catch {
          setFollowers("—");
          setIsFollowing(false);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [authReady]);

  /* ---- Actions: logout & follow ---- */
  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb-") || k.includes("supabase"))
          .forEach((k) => localStorage.removeItem(k));
      } catch {}
      window.location.href = "/";
    } catch {}
  }

  async function toggleFollow() {
    if (!profile?.id) return;
    if (!authUser?.id) {
      await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
      return;
    }
    if (authUser.id === profile.id) return; // gak boleh follow diri sendiri
    setFollowBusy(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", authUser.id)
          .eq("following_id", profile.id);
        if (error) throw error;
        setIsFollowing(false);
        setFollowers((c) => (typeof c === "number" ? Math.max(0, c - 1) : c));
      } else {
        const { error } = await supabase.from("follows").insert({
          follower_id: authUser.id,
          following_id: profile.id,
        } as any);
        if (error) throw error;
        setIsFollowing(true);
        setFollowers((c) => (typeof c === "number" ? c + 1 : c));
      }
    } catch {
      // diam, biar gak ganggu
    } finally {
      setFollowBusy(false);
    }
  }

  const displayName =
    profile?.name || authUser?.user_metadata?.full_name || authUser?.email?.split("@")[0] || "Pengguna";
  const displayHandle =
    profile?.handle || (displayName || "user").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 16);
  const avatar =
    profile?.avatar_url ||
    authUser?.user_metadata?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`;

  const isOwner = !!authUser?.id && !!profile?.id && authUser.id === profile.id;

  // ---- Auth guard ringan ----
  if (authReady && !authUser) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto max-w-7xl px-4 py-16 text-center">
          <div className="mx-auto w-[min(520px,92vw)] rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
            <User2 className="mx-auto h-10 w-10 text-zinc-400" />
            <h1 className="mt-3 text-xl font-bold">Kamu belum masuk</h1>
            <p className="mt-1 text-sm text-zinc-400">Masuk untuk melihat profil, karya, dan bookmark kamu.</p>
            <div className="mt-5">
              <button
                onClick={() =>
                  supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: `${window.location.origin}/auth/callback` },
                  })
                }
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold hover:bg-sky-500"
              >
                Masuk dengan Google
              </button>
            </div>
          </div>
        </main>
        <BottomBar />
      </div>
    );
  }

  /* ======================== Render ======================== */
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* ===== Glass Header ===== */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              maskImage: "radial-gradient(70% 60% at 0% 0%, black, transparent 70%)",
              background:
                "radial-gradient(400px 160px at 10% 5%, rgba(56,189,248,.18), transparent 60%), radial-gradient(420px 160px at 90% -10%, rgba(99,102,241,.14), transparent 60%)",
            }}
          />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-start">
            <img
              src={avatar}
              alt={displayName}
              className="h-24 w-24 shrink-0 rounded-full border border-white/10 object-cover"
            />

            {/* Info kiri */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold leading-tight">{displayName}</h1>
                {profile?.is_admin ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium">
                    <ShieldCheck className="h-3.5 w-3.5" /> Admin
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs">
                  @{displayHandle}
                </span>
              </div>

              <p className="mt-2 max-w-2xl text-sm text-zinc-200/90">
                {profile?.bio || "Belum ada bio."}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Bergabung {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
                </span>
                <Link href="/write" className="inline-flex items-center gap-1 hover:underline">
                  <PenSquare className="h-4 w-4" /> Tulis karya baru
                </Link>
                <a className="inline-flex items-center gap-1 hover:underline" href={`https://openverse.example/u/${displayHandle}`}>
                  <ExternalLink className="h-4 w-4" /> Profil publik
                </a>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                <Stat label="Karya" value={counts.novels} />
                <Stat label="Draft antri" value={counts.drafts} />
                <Stat label="Bookmark" value={counts.bookmarks} />
                <Stat label="Followers" value={followers} />
                <Stat label="Rating rata-rata" value="—" />
              </div>
            </div>

            {/* Kanan: badge + actions */}
            <div className="flex items-start gap-2 md:self-start">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Member
              </span>

              {/* FOLLOW / LOGOUT */}
              {!isOwner ? (
                <button
                  onClick={toggleFollow}
                  disabled={followBusy}
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                    isFollowing
                      ? "border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/20"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  {isFollowing ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                  {isFollowing ? "Mengikuti" : "Ikuti"}
                </button>
              ) : (
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10"
                  title="Keluar"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Keluar
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ===== Tabs ===== */}
        <div className="mt-6">
          <TabsBar
            tabs={[
              { id: "overview", label: "Ringkasan" },
              { id: "bookmarks", label: "Bookmark" },
              { id: "works", label: "Karya" },
              { id: "drafts", label: "Draft" },
              { id: "settings", label: "Pengaturan" },
            ]}
            active={tab}
            onChange={(id) => setTab(id as any)}
          />
        </div>

        {/* ===== Content ===== */}
        <div className="mt-4">
          {/* Overview */}
          {tab === "overview" && (
            <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <h3 className="mb-2 text-sm font-semibold text-white/90">Aktivitas Terakhir</h3>
                <div className="text-sm text-zinc-400">Belum ada aktivitas.</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <h3 className="mb-2 text-sm font-semibold text-white/90">Link & Sosial</h3>
                <a href={`https://openverse.example/u/${displayHandle}`} className="text-sm inline-flex items-center gap-2 hover:underline">
                  <ExternalLink className="h-4 w-4" />
                  Profil publik
                </a>
                <div className="mt-2 text-xs text-zinc-400">Kustomisasi URL akan ditambahkan nanti.</div>
              </div>
            </div>
          )}

          {/* Bookmarks */}
          {tab === "bookmarks" && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <Bookmark className="h-4 w-4" />
                <h3 className="text-sm font-semibold text-white/90">Koleksi Bookmark</h3>
              </div>

              {loading ? (
                <CardGrid>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-white/10 overflow-hidden">
                      <Skeleton className="aspect-[3/4] w-full" />
                      <div className="p-3">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="mt-2 h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </CardGrid>
              ) : bookmarks.length ? (
                <CardGrid>
                  {bookmarks.map((n) => (
                    <NovelCard key={n.id} n={n} />
                  ))}
                </CardGrid>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400 backdrop-blur">
                  Belum ada bookmark. Buka halaman novel dan tekan tombol
                  <span className="mx-1 inline-flex items-center rounded bg-zinc-800 px-2 py-0.5 text-xs">
                    <Bookmark className="mr-1 h-3 w-3" />
                    Bookmark
                  </span>
                  .
                </div>
              )}
            </section>
          )}

          {/* Works */}
          {tab === "works" && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-white/90">Karya Terbit</h3>
              {loading ? (
                <CardGrid>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-white/10 overflow-hidden">
                      <Skeleton className="aspect-[3/4] w-full" />
                      <div className="p-3">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="mt-2 h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </CardGrid>
              ) : novels.length ? (
                <CardGrid>
                  {novels.map((n) => (
                    <NovelCard key={n.id} n={n} />
                  ))}
                </CardGrid>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400 backdrop-blur">
                  Belum ada karya. <Link href="/write" className="text-sky-400 hover:underline">Tulis karya pertama</Link>.
                </div>
              )}
            </section>
          )}

          {/* Drafts */}
          {tab === "drafts" && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-white/90">Draft & Antrian Moderasi</h3>
              {drafts.length ? (
                <ul className="space-y-3">
                  {drafts.map((d) => (
                    <li key={d.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
                      <div className="flex items-start gap-3">
                        {d.cover_url ? (
                          <img src={d.cover_url} className="h-16 w-12 rounded border border-white/10 object-cover" />
                        ) : (
                          <div className="grid h-16 w-12 place-items-center rounded border border-white/10 bg-white/5 text-xs text-zinc-400">
                            No Cover
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="font-semibold">{d.title}</div>
                          <div className="text-xs text-zinc-400">Status: {d.status}</div>
                          <div className="text-xs text-zinc-400">
                            Diajukan {new Date(d.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400 backdrop-blur">
                  Tidak ada draft. Ajukan dari halaman <Link href="/write" className="text-sky-400 hover:underline">Write</Link>.
                </div>
              )}
            </section>
          )}

          {/* Settings */}
          {tab === "settings" && profile && <SettingsCard profile={profile} onChanged={setProfile} />}
        </div>
      </main>

      <BottomBar />
    </div>
  );
}

/* ======================== Settings ======================== */
function SettingsCard({
  profile,
  onChanged,
}: {
  profile: Profile;
  onChanged: (p: Profile) => void;
}) {
  const [form, setForm] = useState({
    name: profile.name || "",
    handle: profile.handle || "",
    bio: profile.bio || "",
    avatar_url: profile.avatar_url || "",
  });
  const [busy, setBusy] = useState(false);
  const canSave = useMemo(
    () =>
      JSON.stringify(form) !==
      JSON.stringify({
        name: profile.name || "",
        handle: profile.handle || "",
        bio: profile.bio || "",
        avatar_url: profile.avatar_url || "",
      }),
    [form, profile]
  );

  async function save() {
    setBusy(true);
    const prev = { ...profile };
    onChanged({ ...profile, ...form }); // optimistic
    const { data, error } = await supabase
      .from("profiles")
      .update({ ...form })
      .eq("id", profile.id)
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      alert(error.message);
      onChanged(prev);
      return;
    }
    onChanged(data as any);
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-6 backdrop-blur">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white/90">
        <User2 className="h-4 w-4" />
        Pengaturan Profil
      </h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-xs text-zinc-400">Nama</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            placeholder="Nama tampilan"
          />

          <label className="block text-xs text-zinc-400">Handle / Username</label>
          <input
            value={form.handle}
            onChange={(e) =>
              setForm({
                ...form,
                handle: e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, "").slice(0, 20),
              })
            }
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            placeholder="username"
          />

          <label className="block text-xs text-zinc-400">Avatar URL</label>
          <input
            value={form.avatar_url}
            onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            placeholder="https://..."
          />
        </div>

        <div className="space-y-3">
          <label className="block text-xs text-zinc-400">Bio</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="h-32 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            placeholder="Ceritakan tentangmu"
          />

          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
            <img
              src={
                form.avatar_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name || "User")}`
              }
              className="h-12 w-12 rounded-full border border-white/10 object-cover"
              alt="preview"
            />
            <div className="text-xs text-zinc-400">
              Pratinjau avatar — tempel URL gambar. (Upload ke Storage bisa ditambahkan nanti)
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={save}
          disabled={!canSave || busy}
          className={clsx(
            "inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold hover:bg-sky-500",
            (!canSave || busy) && "cursor-not-allowed opacity-60"
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
          {busy ? "Menyimpan…" : "Simpan perubahan"}
        </button>
      </div>
    </section>
  );
}
