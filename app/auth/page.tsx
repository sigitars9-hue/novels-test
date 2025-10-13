"use client";
import { TopBar } from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { LogIn } from "lucide-react";

const providers = [
  { id: "google", name: "Google" },
  { id: "facebook", name: "Facebook" },
  { id: "github", name: "GitHub" }
] as const;

export default function AuthPage(){
  async function handle(id: string){
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: id as any,
      options: { redirectTo: `${location.origin}/` }
    });
    if (error) alert(error.message);
    if (data?.url) location.href = data.url;
  }
  return (
    <div>
      <TopBar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-md rounded-xl border border-white/10 p-6" style={{background:'var(--card)'}}>
          <h2 className="text-xl font-bold">Masuk ke OpenVerse</h2>
          <p className="text-sm text-[color:var(--muted)] mt-1">Login via Supabase OAuth.</p>
          <div className="mt-4 space-y-2">
            {providers.map(p => (
              <button key={p.id} onClick={()=> handle(p.id)}
                className="w-full rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-semibold inline-flex items-center justify-center gap-2">
                <LogIn className="h-4 w-4" /> Masuk dengan {p.name}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
