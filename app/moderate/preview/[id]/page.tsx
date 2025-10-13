"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { ShieldCheck } from "lucide-react";

export default function SubmissionPreviewPage({ params }: { params: { id: string } }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [data, setData] = useState<{ submission: any; chapters: any[] } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
      setIsAdmin(!!prof?.is_admin);
    })();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data: sub } = await supabase.from("submissions").select("*").eq("id", params.id).maybeSingle();

      let chapters: any[] = [];
      try {
        const { data: ch } = await supabase
          .from("submission_chapters")
          .select("id, number, title, content, created_at")
          .eq("submission_id", params.id)
          .order("number");
        chapters = ch || [];
      } catch {
        chapters = [];
      }

      setData({ submission: sub, chapters });
    })();
  }, [isAdmin, params.id]);

  const onApprove = async () => {
    if (!data?.submission?.id) return;
    setBusy(true);
    const { error } = await supabase
      .from("submissions")
      .update({ status: "approved" })
      .eq("id", data.submission.id);
    setBusy(false);
    if (error) return alert(error.message);
    alert("Approved!");
  };

  const onReject = async () => {
    if (!data?.submission?.id) return;
    setBusy(true);
    const { error } = await supabase
      .from("submissions")
      .update({ status: "rejected" })
      .eq("id", data.submission.id);
    setBusy(false);
    if (error) return alert(error.message);
    alert("Rejected!");
  };

  if (!isAdmin) {
    return (
      <div>
        <TopBar />
        <main className="mx-auto max-w-7xl px-4 py-6">
          <div className="rounded-xl border border-white/10 p-6" style={{ background: "var(--card)" }}>
            <div className="inline-flex items-center gap-2 text-red-300">
              <ShieldCheck className="h-5 w-5" />
              403 — Halaman ini khusus admin
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <TopBar />
        <main className="mx-auto max-w-7xl px-4 py-6">Memuat…</main>
      </div>
    );
  }

  const s = data.submission;
  const cover = s?.cover_url || `https://picsum.photos/seed/${s?.id}/400/560`;

  return (
    <div>
      <TopBar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent">
          <div className="absolute inset-0 -z-10 opacity-20" style={{ backgroundImage: `url(${cover})`, backgroundSize:"cover", backgroundPosition:"center", filter:"blur(20px)", transform:"scale(1.1)"}} />
          <div className="grid grid-cols-1 md:grid-cols-[200px,1fr] gap-6 p-5 md:p-6">
            <img src={cover} className="h-[260px] w-full md:w-[200px] object-cover rounded-xl border border-white/10" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{s?.title || "Tanpa Judul"}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {(s?.tags || []).map((t: string) => (
                  <span key={t} className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5">{t}</span>
                ))}
              </div>
              {s?.synopsis ? <p className="mt-3 text-sm text-white/80 leading-relaxed max-w-3xl">{s.synopsis}</p> : null}

              <div className="mt-4 flex gap-2">
                <button onClick={onApprove} disabled={busy} className="rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-semibold disabled:opacity-60">Approve</button>
                <button onClick={onReject} disabled={busy} className="rounded bg-white/10 hover:bg-white/15 px-4 py-2 text-sm disabled:opacity-60">Tolak</button>
              </div>
            </div>
          </div>
        </section>

        {Array.isArray(data.chapters) && data.chapters.length > 0 ? (
          <div className="mt-6 rounded-xl border border-white/10 overflow-hidden">
            <div className="bg-white/5 px-4 py-2 text-sm font-semibold">Draft Bab ({data.chapters.length})</div>
            <ul className="divide-y divide-white/10">
              {data.chapters.map((c, idx) => (
                <li key={c.id || idx} className="px-4 py-3">
                  <div className="text-sm font-medium">Bab {c.number ?? idx + 1} — {c.title || "(Tanpa Judul)"}</div>
                  {c.content ? <p className="mt-1 text-sm text-[color:var(--muted)]">{c.content}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </main>
    </div>
  );
}
