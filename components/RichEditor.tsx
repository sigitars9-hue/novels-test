"use client";
import React, { useRef } from "react";

/* ---------- Markdown mini → HTML (preview saja) ---------- */
export function mdToHtml(src: string): string {
  if (!src) return "";

  // Escape basic HTML
  let s = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Headings
  s = s.replace(/^###\s+(.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  s = s.replace(/^##\s+(.+)$/gm, '<h2 class="text-xl font-bold mt-5 mb-3">$1</h2>');
  s = s.replace(/^#\s+(.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>');

  // Inline
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="my-3 rounded border border-white/10 max-w-full" />');

  // Paragraphs (dua newline = paragraf baru)
  s = s.replace(/\r\n/g, "\n");                    // normalisasi newline
  s = s.replace(/\n{2,}/g, "</p><p>");             // paragraf
  s = s.replace(/\n/g, "<br>");                    // satu newline = <br>

  return `<p>${s}</p>`;
}

/* ---------- Tombol toolbar ---------- */
function ToolbarButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { children, className = "", ...rest } = props;
  return (
    <button
      type="button"
      {...rest}
      className={`px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-xs ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------- Editor (textarea + toolbar + preview) ---------- */
export default function Editor({
  value,
  setValue,
}: {
  value: string;
  setValue: (v: string) => void; // <- HANYA string, tidak pernah function
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  /** Sisipkan pembungkus di area terpilih */
  function wrapSelection(before: string, after: string) {
    const el = taRef.current;
    if (!el) return;

    const s = el.selectionStart ?? 0;
    const e = el.selectionEnd ?? 0;
    const cur = value ?? "";
    const selected = cur.slice(s, e);

    const out = cur.slice(0, s) + before + selected + after + cur.slice(e);
    setValue(out); // <- langsung string

    // kembalikan fokus & selection
    requestAnimationFrame(() => {
      el.focus();
      const caretStart = s + before.length;
      const caretEnd = e + before.length;
      el.setSelectionRange(caretStart, caretEnd);
    });
  }

  /** Sisipkan heading di baris baru */
  function insertHeading(level: number) {
    const hashes = "#".repeat(Math.max(1, Math.min(6, level))) + " ";
    wrapSelection("\n" + hashes, "");
  }

  /** Sisipkan gambar (URL) */
  function insertImage() {
    const url = window.prompt("Masukkan URL gambar (boleh data URL):");
    if (!url) return;
    setValue((value || "") + `\n![image](${url})\n`);
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <ToolbarButton onClick={() => insertHeading(1)}>H1</ToolbarButton>
        <ToolbarButton onClick={() => insertHeading(2)}>H2</ToolbarButton>
        <ToolbarButton onClick={() => insertHeading(3)}>H3</ToolbarButton>
        <ToolbarButton onClick={() => wrapSelection("**", "**")}>Bold</ToolbarButton>
        <ToolbarButton onClick={() => wrapSelection("*", "*")}>Italic</ToolbarButton>
        <ToolbarButton onClick={insertImage}>Insert img</ToolbarButton>
      </div>

      {/* Textarea input */}
      <textarea
        ref={taRef}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm h-56"
        placeholder="Tulis konten bab di sini... (Markdown dasar: #, ##, ###, **bold**, *italic*, ![alt](url))"
      />

      {/* Preview */}
      <div className="rounded-xl border border-white/10 p-3" style={{ background: "var(--card)" }}>
        <div className="text-xs text-[color:var(--muted)] mb-2">Preview</div>
        <div
          className="prose prose-invert max-w-none"
          // Preview aman—kita hanya render hasil mdToHtml ringan di atas
          dangerouslySetInnerHTML={{ __html: mdToHtml(value || "") }}
        />
      </div>
    </div>
  );
}
