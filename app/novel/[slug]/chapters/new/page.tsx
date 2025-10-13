"use client";

import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  Type, Heading1, Heading2, Heading3, Bold, Italic, Strikethrough, Link as LinkIcon,
  Image as ImageIcon, List as ListIcon, ListOrdered, Quote, Code, Eye, EyeOff
} from "lucide-react";

/**
 * Keterangan:
 * - Editor berbasis textarea + toolbar Markdown ringan
 * - Tombol: H1/H2/H3, Bold (**), Italic (*), Strike (~~), Bullets (- ), Ordered (1.), Quote (> ), Code (```), Link, Image
 * - Live preview sederhana (regex) tanpa lib eksternal
 * - Submit -> buat row submissions(kind='chapter') + submission_chapters -> pending moderasi
 */

export default function NewChapter({ params }:{ params:{ slug:string } }) {
  const router = useRouter();
  const [novel, setNovel] = useState<any>(null);
  const [mine, setMine] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [nextNum, setNextNum] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  // UI toolbar small popovers
  const [showLink, setShowLink] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [showPreview, setShowPreview] = useState(true);

  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data: n } = await supabase
        .from("novels")
        .select("id, slug, title, author_id")
        .eq("slug", params.slug)
        .maybeSingle();
      if (!n) return;
      setNovel(n);

      const { data: ch } = await supabase
        .from("chapters")
        .select("number")
        .eq("novel_id", n.id)
        .order("number", { ascending:false })
        .limit(1);
      setNextNum(ch?.[0]?.number ? ch[0].number + 1 : 1);

      const { data:{ user } } = await supabase.auth.getUser();
      setMine(!!user && user.id === n.author_id);
    })();
  }, [params.slug]);

  async function submit() {
    if (!novel || !mine) return alert("Anda bukan author novel ini.");
    if (!title.trim() || !content.trim()) return alert("Judul & isi wajib diisi.");
    setSaving(true);

    // 1) Buat submission kind=chapter
    const uid = (await supabase.auth.getUser()).data.user?.id;
    const { data: sub, error: e1 } = await supabase
      .from("submissions")
      .insert({
        kind: "chapter",
        novel_id: novel.id,
        author_id: uid,
        title: `Bab ${nextNum} — ${title}`,
        status: "pending"
      })
      .select("*")
      .single();
    if (e1) { setSaving(false); return alert(e1.message); }

    // 2) Simpan isi bab ke submission_chapters
    const { error: e2 } = await supabase
      .from("submission_chapters")
      .insert({
        submission_id: sub.id,
        number: nextNum,
        title,
        content
      });
    if (e2) { setSaving(false); return alert(e2.message); }

    setSaving(false);
    alert("Bab diajukan. Menunggu persetujuan admin.");
    router.push(`/novel/${novel.slug}`);
  }

  if (!novel) return (<div><TopBar /><main className="mx-auto max-w-7xl px-4 py-6">Loading…</main></div>);
  if (!mine)  return (<div><TopBar /><main className="mx-auto max-w-7xl px-4 py-6">Anda bukan author novel ini.</main></div>);

  // ========= Toolbar helpers =========
  function wrapSelection(prefix: string, suffix?: string) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const selected = content.slice(start, end);
    const sfx = suffix ?? prefix;
    const before = content.slice(0, start);
    const after  = content.slice(end);
    const next = before + prefix + selected + sfx + after;
    setContent(next);
    // restore caret
    const pos = start + prefix.length + selected.length + sfx.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  function insertLineStart(token: string) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const lines = content.split("\n");
    let i = 0, sum = 0, startLine = 0, endLine = 0;
    for (; i < lines.length; i++) {
      const len = lines[i].length + 1; // +\n
      if (sum + len > start) { startLine = i; break; }
      sum += len;
    }
    // compute endLine
    let sum2 = 0;
    for (let j = 0; j < lines.length; j++) {
      const len = lines[j].length + 1;
      if (sum2 + len >= end) { endLine = j; break; }
      sum2 += len;
    }
    for (let k = startLine; k <= endLine; k++) {
      if (lines[k].length === 0) lines[k] = token; else lines[k] = `${token} ${lines[k]}`;
    }
    const next = lines.join("\n");
    setContent(next);
    requestAnimationFrame(() => ta.focus());
  }

  function insertBlock(block: "h1"|"h2"|"h3"|"code") {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const sel = content.slice(start, end) || "Teks";
    let prefix = "", suffix = "";
    if (block === "h1") prefix = "# ";
    if (block === "h2") prefix = "## ";
    if (block === "h3") prefix = "### ";
    if (block === "code") { prefix = "```\n"; suffix = "\n```"; }
    const before = content.slice(0, start);
    const after = content.slice(end);
    const insertion = (block === "code") ? `${prefix}${sel}${suffix}` : `${prefix}${sel}`;
    const next = before + insertion + after;
    setContent(next);
    requestAnimationFrame(() => ta.focus());
  }

  function applyLink(url: string) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const sel = content.slice(start, end) || "teks";
    const before = content.slice(0, start);
    const after  = content.slice(end);
    const next = `${before}[${sel}](${url})${after}`;
    setContent(next);
    setShowLink(false);
    setLinkUrl("");
    requestAnimationFrame(() => ta.focus());
  }

  function applyImage(url: string) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const before = content.slice(0, start);
    const after  = content.slice(start);
    const next = `${before}\n\n![image](${url})\n\n${after}`;
    setContent(next);
    setShowImage(false);
    setImageUrl("");
    requestAnimationFrame(() => ta.focus());
  }

  // ========= Tiny Markdown preview (basic) =========
  function mdToHtml(md: string) {
    // escape
    const esc = (s:string)=> s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    let html = esc(md);

    // code block ```
    html = html.replace(/```([\s\S]*?)```/g, (_m, p1) => `<pre class="rounded border border-white/10 bg-black/50 p-3 text-xs overflow-auto">${esc(p1)}</pre>`);

    // headings
    html = html
      .replace(/^### (.*)$/gm, `<h3 class="text-lg font-semibold mt-3">$1</h3>`)
      .replace(/^## (.*)$/gm, `<h2 class="text-xl font-bold mt-3">$1</h2>`)
      .replace(/^# (.*)$/gm, `<h1 class="text-2xl font-bold mt-3">$1</h1>`);

    // lists
    html = html
      .replace(/^\s*-\s+(.*)$/gm, `<li>$1</li>`)
      .replace(/(<li>.*<\/li>)(?!\n<li>)/gs, `<ul class="list-disc pl-5 my-2">$1</ul>`);
    html = html
      .replace(/^\s*\d+\.\s+(.*)$/gm, `<li>$1</li>`)
      .replace(/(<li>.*<\/li>)(?!\n<li>)/gs, (m)=> `<ol class="list-decimal pl-5 my-2">${m}</ol>`);

    // quote
    html = html.replace(/^\>\s?(.*)$/gm, `<blockquote class="border-l-2 border-white/20 pl-3 my-2 text-[color:var(--muted)]">$1</blockquote>`);

    // inline styles
    html = html
      .replace(/\*\*(.+?)\*\*/g, `<strong>$1</strong>`)
      .replace(/\*(.+?)\*/g, `<em>$1</em>`)
      .replace(/~~(.+?)~~/g, `<del>$1</del>`);

    // image & link
    html = html.replace(/\!\[([^\]]*?)\]\(([^\)]+?)\)/g, `<img alt="$1" src="$2" class="max-w-full rounded border border-white/10 my-2" />`);
    html = html.replace(/\[([^\]]+?)\]\(([^\)]+?)\)/g, `<a href="$2" target="_blank" class="text-sky-400 underline">$1</a>`);

    // paragraphs
    html = html.replace(/(^|>.*\n|<\/(ul|ol|pre|blockquote)>\n?|\n{2,})([^\n<][^\n]*)/g, (_m, p1, _p2, p3) => {
      if (/^<h[1-3]|^<ul|^<ol|^<pre|^<blockquote|^<img/.test(p3)) return p1 + p3;
      return (p1 || "") + `<p class="my-2 leading-relaxed">${p3}</p>`;
    });

    return html;
  }

  return (
    <div>
      <TopBar />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h2 className="text-xl font-bold">Ajukan Bab Baru untuk “{novel.title}”</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Bab ini akan masuk ke antrian moderasi. Setelah disetujui admin, bab otomatis terbit.
        </p>

        <div className="mt-4 space-y-3">
          <input
            value={title}
            onChange={e=>setTitle(e.target.value)}
            placeholder={`Judul Bab ${nextNum}`}
            className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-sm"
          />

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1">
            <span className="text-xs text-[color:var(--muted)] inline-flex items-center gap-1 px-1"><Type className="h-3.5 w-3.5" /> Format</span>
            <button onClick={()=>insertBlock("h1")} className="px-2 py-1 rounded hover:bg-white/10" title="Heading 1"><Heading1 className="h-4 w-4" /></button>
            <button onClick={()=>insertBlock("h2")} className="px-2 py-1 rounded hover:bg-white/10" title="Heading 2"><Heading2 className="h-4 w-4" /></button>
            <button onClick={()=>insertBlock("h3")} className="px-2 py-1 rounded hover:bg-white/10" title="Heading 3"><Heading3 className="h-4 w-4" /></button>
            <span className="mx-1 h-5 w-px bg-white/10" />
            <button onClick={()=>wrapSelection("**")} className="px-2 py-1 rounded hover:bg-white/10" title="Bold"><Bold className="h-4 w-4" /></button>
            <button onClick={()=>wrapSelection("*")} className="px-2 py-1 rounded hover:bg-white/10" title="Italic"><Italic className="h-4 w-4" /></button>
            <button onClick={()=>wrapSelection("~~")} className="px-2 py-1 rounded hover:bg-white/10" title="Strikethrough"><Strikethrough className="h-4 w-4" /></button>
            <span className="mx-1 h-5 w-px bg-white/10" />
            <button onClick={()=>insertLineStart("-")} className="px-2 py-1 rounded hover:bg-white/10" title="Bullet List"><ListIcon className="h-4 w-4" /></button>
            <button onClick={()=>insertLineStart("1.")} className="px-2 py-1 rounded hover:bg-white/10" title="Numbered List"><ListOrdered className="h-4 w-4" /></button>
            <button onClick={()=>insertLineStart(">")} className="px-2 py-1 rounded hover:bg-white/10" title="Quote"><Quote className="h-4 w-4" /></button>
            <button onClick={()=>insertBlock("code")} className="px-2 py-1 rounded hover:bg-white/10" title="Code Block"><Code className="h-4 w-4" /></button>
            <span className="mx-1 h-5 w-px bg-white/10" />
            <button onClick={()=>setShowLink(v=>!v)} className="px-2 py-1 rounded hover:bg-white/10" title="Insert Link"><LinkIcon className="h-4 w-4" /></button>
            <button onClick={()=>setShowImage(v=>!v)} className="px-2 py-1 rounded hover:bg-white/10" title="Insert Image"><ImageIcon className="h-4 w-4" /></button>
            <span className="mx-1 h-5 w-px bg-white/10" />
            <button onClick={()=>setShowPreview(v=>!v)} className="ml-auto px-2 py-1 rounded hover:bg-white/10" title="Toggle Preview">
              {showPreview ? <><EyeOff className="h-4 w-4 inline" /> <span className="text-xs">Hide Preview</span></> : <><Eye className="h-4 w-4 inline" /> <span className="text-xs">Show Preview</span></>}
            </button>
          </div>

          {/* Inline link/image inputs (tanpa window.prompt) */}
          {showLink && (
            <div className="rounded border border-white/10 bg-white/5 p-2 flex gap-2 items-center">
              <span className="text-xs text-[color:var(--muted)]">URL</span>
              <input value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} placeholder="https://..." className="flex-1 rounded bg-white/5 border border-white/10 px-2 py-1 text-sm" />
              <button onClick={()=>{ if(linkUrl.trim()) applyLink(linkUrl.trim()); }} className="rounded bg-sky-600 hover:bg-sky-500 px-3 py-1 text-xs font-semibold">Insert</button>
              <button onClick={()=>{ setShowLink(false); setLinkUrl(""); }} className="rounded bg-white/10 hover:bg-white/15 px-3 py-1 text-xs">Cancel</button>
            </div>
          )}
          {showImage && (
            <div className="rounded border border-white/10 bg-white/5 p-2 flex gap-2 items-center">
              <span className="text-xs text-[color:var(--muted)]">Image URL</span>
              <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://..." className="flex-1 rounded bg-white/5 border border-white/10 px-2 py-1 text-sm" />
              <button onClick={()=>{ if(imageUrl.trim()) applyImage(imageUrl.trim()); }} className="rounded bg-sky-600 hover:bg-sky-500 px-3 py-1 text-xs font-semibold">Insert</button>
              <button onClick={()=>{ setShowImage(false); setImageUrl(""); }} className="rounded bg-white/10 hover:bg-white/15 px-3 py-1 text-xs">Cancel</button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <textarea
              ref={taRef}
              value={content}
              onChange={e=>setContent(e.target.value)}
              placeholder="Tulis isi bab di sini… (Markdown ringan didukung)"
              className="h-[420px] w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-sm leading-relaxed font-mono"
            />
            {showPreview && (
              <div className="h-[420px] w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-sm overflow-auto prose prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: mdToHtml(content) }} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={submit}
              disabled={saving}
              className="rounded bg-sky-600 hover:bg-sky-500 px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "Mengajukan…" : `Ajukan Bab ${nextNum}`}
            </button>
            <button
              onClick={()=>router.push(`/novel/${novel.slug}`)}
              className="rounded bg-white/10 hover:bg-white/15 px-4 py-2 text-sm"
            >
              Batal
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
