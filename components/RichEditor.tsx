"use client";
import { useRef } from "react";

export function mdToHtml(src: string){
  if (!src) return "";
  let s = src.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  s = s.replace(/^###\s+(.+)$/gm,'<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  s = s.replace(/^##\s+(.+)$/gm,'<h2 class="text-xl font-bold mt-5 mb-3">$1</h2>');
  s = s.replace(/^#\s+(.+)$/gm,'<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>');
  s = s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g,'<em>$1</em>');
  s = s.replace(/!\[(.*?)\]\((.*?)\)/g,'<img src="$2" alt="$1" class="my-3 rounded border border-white/10 max-w-full" />');
  s = s.replace(/\n{2,}/g,'</p><p>');
  return '<p>'+s+'</p>';
}

function ToolbarButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { children, ...rest } = props;
  return <button type="button" {...rest} className="px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-xs">{children}</button>;
}

export default function Editor({ value, setValue }:{ value:string; setValue:(v:string)=>void }) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  function wrap(before:string, after:string){
    const el = taRef.current; if(!el) return; const {selectionStart:s, selectionEnd:e, value:v} = el;
    const selected = v.slice(s,e); const out = v.slice(0,s)+before+selected+after+v.slice(e);
    setValue(out);
    setTimeout(()=>{ el.focus(); el.selectionStart = s+before.length; el.selectionEnd = e+before.length; },0);
  }
  function insertHeading(level:number){ const hashes = '#'.repeat(level)+' '; wrap('\n'+hashes, ''); }
  function insertImage(){
    const url = prompt('Masukkan URL gambar (boleh data URL):'); if(!url) return;
    setValue(value + `\n![image](${url})\n`);
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <ToolbarButton onClick={()=> insertHeading(1)}>H1</ToolbarButton>
        <ToolbarButton onClick={()=> insertHeading(2)}>H2</ToolbarButton>
        <ToolbarButton onClick={()=> insertHeading(3)}>H3</ToolbarButton>
        <ToolbarButton onClick={()=> wrap('**','**')}>Bold</ToolbarButton>
        <ToolbarButton onClick={()=> wrap('*','*')}>Italic</ToolbarButton>
        <ToolbarButton onClick={insertImage}>Insert Img</ToolbarButton>
      </div>
      <textarea ref={taRef} value={value} onChange={(e)=> setValue(e.target.value)}
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm h-56"
        placeholder="Tulis konten bab di sini... (Markdown: #, ##, ###, **bold**, *italic*, ![alt](url))"/>
      <div className="rounded-xl border border-white/10 p-3" style={{background:'var(--card)'}}>
        <div className="text-xs text-[color:var(--muted)] mb-2">Preview</div>
        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{__html: mdToHtml(value)}} />
      </div>
    </div>
  );
}
