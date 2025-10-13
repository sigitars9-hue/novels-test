"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  Eye,
  Check,
  X,
  ShieldCheck,
  ExternalLink,
  RefreshCcw,
  Inbox,
  Search,
  Tag as TagIcon,
} from "lucide-react";
import DOMPurify from "dompurify";
import BottomBar from "@/components/BottomBar"; // ⬅️ pastikan path ini sesuai

/* ============== Types ============== */
type ChapterSubmission = {
  id: string;
  novel_id: string;
  number: number;
  title: string | null;
  content: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  // kolom opsional (jika ada)
  reject_reason?: string | null;
  tags?: string[] | null;
};

type NovelLite = {
  id: string;
  title: string;
  cover_url: string | null;
  tags: string[] | null;
};

type TabKey = "all" | "pending" | "approved" | "rejected";

/* ============== UI kecil ============== */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-medium tracking-wide">
      {children}
    </span>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-[color:var(--muted)]">
      <Inbox className="h-4 w-4" />
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10"
          style={{ background: "var(--card)" }}
        >
          <div className="max-h-[80vh] overflow-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ============== Page ============== */
export default function ModeratePage() {
  const [isAdmin, setIsAdmin] = useState(false);

  const [pending, setPending] = useState<ChapterSubmission[]>([]);
  const [novelsById, setNovelsById] = useState<Record<string, NovelLite>>({});

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // UI extras
  const [tab, setTab] = useState<TabKey>("pending");
  const [q, setQ] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<ChapterSubmission | null>(
    null
  );

  /* ---- cek admin ---- */
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        setIsAdmin(false);
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", uid)
        .maybeSingle();
      setIsAdmin(!!prof?.is_admin);
    })();
  }, []);

  /* ---- load submissions (semua status) + metadata novel ---- */
  async function reload() {
    const { data, error } = await supabase
      .from("submission_chapters")
      .select(
        "id, novel_id, number, title, content, status, created_at, reject_reason"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setPending([]);
      setNovelsById({});
      return;
    }

    const subs = (data || []) as ChapterSubmission[];
    setPending(subs);

    const novelIds = Array.from(
      new Set(subs.map((s) => s.novel_id).filter(Boolean))
    );
    if (novelIds.length) {
      const { data: novels } = await supabase
        .from("novels")
        .select("id, title, cover_url, tags")
        .in("id", novelIds);
      const map: Record<string, NovelLite> = {};
      (novels || []).forEach((n: any) => (map[n.id] = n));
      setNovelsById(map);
    } else {
      setNovelsById({});
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    reload();
    // realtime optional — abaikan jika belum enable Realtime
    const ch = supabase
      .channel("moderation_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submission_chapters" },
        () => reload()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  /* ---- data preview dari item terpilih ---- */
  const preview = useMemo(() => {
    if (!previewId) return null;
    const sub = pending.find((p) => p.id === previewId);
    if (!sub) return null;
    const novel = novelsById[sub.novel_id];
    return { submission: sub, novel };
  }, [previewId, pending, novelsById]);

  /* ---- Approve (pakai RPC existing) ---- */
  const onApprove = async (id: string) => {
    if (!confirm("Approve bab ini?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("approve_chapter_submission", {
      p_submission_id: id,
    });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    await reload();
    setPreviewId((v) => (v === id ? null : v));
  };

  /* ---- Open reject reason dialog ---- */
  const openReject = (item: ChapterSubmission) => {
    setRejectTarget(item);
    setReason(item.reject_reason || "");
    setReasonOpen(true);
  };

  /* ---- Tolak + simpan alasan (best-effort, tidak merusak flow) ---- */
  const confirmReject = async () => {
    if (!rejectTarget) return;
    setBusy(true);
    // 1) tetap set status=rejected (logika lama, penting)
    const upd = await supabase
      .from("submission_chapters")
      .update({ status: "rejected", reject_reason: reason || null }) // kolom opsional
      .eq("id", rejectTarget.id);

    // 2) jika kolom reject_reason tidak ada, coba tulis ke tabel optional "moderation_notes"
    if (upd.error) {
      // tetap update status saja
      const updStatusOnly = await supabase
        .from("submission_chapters")
        .update({ status: "rejected" })
        .eq("id", rejectTarget.id);

      if (updStatusOnly.error) {
        setBusy(false);
        alert(updStatusOnly.error.message);
        return;
      }

      // catat alasan ke tabel opsional (abaikan error)
      try {
        await supabase.from("moderation_notes").insert({
          submission_id: rejectTarget.id,
          novel_id: rejectTarget.novel_id,
          reason: reason || null,
        });
      } catch {}
    }

    setBusy(false);
    setReasonOpen(false);
    setRejectTarget(null);
    setReason("");
    await reload();
  };

  /* ---- Filtering & search ---- */
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return pending.filter((d) => {
      const tabOk =
        tab === "all" ? true : (d.status as string) === tab.toString();
      if (!tabOk) return false;

      if (!term) return true;
      const novel = novelsById[d.novel_id];
      const hay =
        (novel?.title || "") +
        " " +
        (d.title || "") +
        " " +
        (novel?.tags || []).join(" ");
      return hay.toLowerCase().includes(term);
    });
  }, [pending, tab, q, novelsById]);

  /* ---- Non-admin guard ---- */
  if (!isAdmin) {
    return (
      <div className="pb-24">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/90 backdrop-blur">
          <div className="mx-auto w-[min(1100px,95vw)] px-4 py-3">
            <div className="inline-flex items-center gap-2 text-red-300">
              <ShieldCheck className="h-5 w-5" />
              403 — Halaman ini khusus admin
            </div>
          </div>
        </header>
        <main className="mx-auto w-[min(1100px,95vw)] px-4 py-6">
          <EmptyState>Silakan login sebagai admin.</EmptyState>
        </main>
        <BottomBar />
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto w-[min(1100px,95vw)] px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Antrian Moderasi (Bab)</h2>
            <div className="flex items-center gap-3 text-xs text-[color:var(--muted)]">
              <span>{pending.length} total</span>
              <button
                onClick={reload}
                className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 hover:bg-white/10"
                title="Refresh"
              >
                <RefreshCcw className="h-4 w-4" /> Refresh
              </button>
            </div>
          </div>

          {/* Tabs + Search */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {([
              { id: "all", label: "Semua" },
              { id: "pending", label: "Pending" },
              { id: "approved", label: "Approved" },
              { id: "rejected", label: "Rejected" },
            ] as { id: TabKey; label: string }[]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full px-3 py-1 text-sm ${
                  tab === t.id ? "bg-sky-600" : "bg-white/5 hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            ))}

            <div className="relative ml-auto">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari judul / tag / bab…"
                className="h-9 w-[min(260px,50vw)] rounded-lg border border-white/10 bg-zinc-950 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>
          </div>
        </div>
      </header>

      {/* List */}
      <main className="mx-auto w-[min(1100px,95vw)] px-4 py-6">
        {!filtered.length ? (
          <EmptyState>Tidak ada bab pada filter ini.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {filtered.map((d) => {
              const novel = novelsById[d.novel_id];
              const cover =
                novel?.cover_url ||
                `https://picsum.photos/seed/${d.novel_id}/200/300`;
              return (
                <li
                  key={d.id}
                  className="rounded-xl border border-white/10 p-3"
                  style={{ background: "var(--card)" }}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={cover}
                      className="h-16 w-12 rounded border border-white/10 object-cover"
                      alt=""
                    />
                    <div className="flex-1">
                      <div className="font-semibold">
                        {novel?.title || "(Tanpa Judul)"} — Bab {d.number ?? "?"}
                        {d.title ? `: ${d.title}` : ""}
                      </div>

                      <div className="mt-1 flex flex-wrap gap-1">
                        {(novel?.tags || []).map((t) => (
                          <Chip key={t}>
                            <TagIcon className="mr-1 h-3 w-3" />
                            {t}
                          </Chip>
                        ))}
                        <Chip>Status: {d.status}</Chip>
                        {d.reject_reason ? (
                          <Chip>Alasan: {d.reject_reason}</Chip>
                        ) : null}
                      </div>

                      {/* cuplikan konten (strip tag) */}
                      {d.content ? (
                        <p className="mt-2 line-clamp-2 text-sm text-white/80">
                          {d.content.replace(/<[^>]+>/g, "").slice(0, 220)}
                          {d.content.replace(/<[^>]+>/g, "").length > 220
                            ? "…"
                            : ""}
                        </p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => setPreviewId(d.id)}
                          className="inline-flex items-center gap-2 rounded bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15"
                        >
                          <Eye className="h-4 w-4" /> Preview
                        </button>

                        {/* (Opsional) halaman preview terpisah */}
                        <Link
                          href={`/moderate/preview/${d.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-2 rounded bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15"
                        >
                          <ExternalLink className="h-4 w-4" /> Buka di Tab Baru
                        </Link>

                        {d.status !== "approved" && (
                          <button
                            onClick={() => onApprove(d.id)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500 disabled:opacity-60"
                          >
                            <Check className="h-4 w-4" /> Approve
                          </button>
                        )}

                        {d.status !== "rejected" && (
                          <button
                            onClick={() => openReject(d)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15 disabled:opacity-60"
                          >
                            <X className="h-4 w-4" /> Tolak
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* BottomBar selalu muncul */}
      <BottomBar />

      {/* Modal Preview */}
      <Modal open={!!previewId} onClose={() => setPreviewId(null)}>
        {!preview ? (
          <div className="p-5">Memuat preview…</div>
        ) : (
          <SubmissionPreview
            submission={preview.submission}
            novel={preview.novel || null}
            onApprove={() => previewId && onApprove(previewId)}
            onReject={() => preview && openReject(preview.submission)}
            busy={busy}
          />
        )}
      </Modal>

      {/* Modal Alasan Penolakan */}
      <Modal open={reasonOpen} onClose={() => setReasonOpen(false)}>
        <div className="p-5 md:p-6">
          <h3 className="text-lg font-semibold">Alasan penolakan</h3>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Pesan ini akan disimpan sebagai catatan moderasi (jika kolom/
            tabel tersedia). Penolakan tetap diproses walau catatan gagal
            disimpan, jadi alurnya tidak rusak.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-3 h-32 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm outline-none focus:ring-2 focus:ring-sky-600"
            placeholder="Contoh: Konten mengandung spoiler berat tanpa penanda..."
          />
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={confirmReject}
              disabled={busy}
              className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-60"
            >
              Kirim & Tolak
            </button>
            <button
              onClick={() => setReasonOpen(false)}
              className="rounded bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              Batal
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ============== Preview ============== */
function SubmissionPreview({
  submission,
  novel,
  onApprove,
  onReject,
  busy,
}: {
  submission: ChapterSubmission;
  novel: NovelLite | null;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const cover =
    novel?.cover_url ||
    `https://picsum.photos/seed/${submission.novel_id}/400/560`;

  // sanitize konten HTML bila ada
  const html = useMemo(() => {
    const raw = submission.content || "";
    return DOMPurify.sanitize(raw);
  }, [submission.content]);

  return (
    <div className="p-5 md:p-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[200px,1fr]">
        <img
          src={cover}
          className="h-[260px] w-full rounded-xl border border-white/10 object-cover md:w-[200px]"
          alt=""
        />
        <div>
          <h3 className="text-xl font-bold">
            {novel?.title || "(Tanpa Judul)"} — Bab {submission.number ?? "?"}
            {submission.title ? `: ${submission.title}` : ""}
          </h3>

          <div className="mt-2 flex flex-wrap gap-1">
            {(novel?.tags || []).map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
            <Chip>Status: {submission.status}</Chip>
            {submission.reject_reason ? (
              <Chip>Alasan: {submission.reject_reason}</Chip>
            ) : null}
          </div>

          {!!submission.content && (
            <div className="prose prose-invert mt-4 max-w-none text-sm">
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {submission.status !== "approved" && (
              <button
                onClick={onApprove}
                disabled={busy}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-60"
              >
                Approve
              </button>
            )}
            {submission.status !== "rejected" && (
              <button
                onClick={onReject}
                disabled={busy}
                className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-60"
              >
                Tolak
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
