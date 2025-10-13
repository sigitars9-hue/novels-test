"use client";
import { LogIn, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

export function UserButton() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setUser(sess?.user ?? null));
    return () => sub.subscription?.unsubscribe();
  }, []);
  if (!user) return (
    <a href="/auth" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">
      <LogIn className="h-4 w-4"/> Masuk
    </a>
  );
  const name = user.user_metadata?.full_name || user.email;
  const avatar = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
  return (
    <div className="flex items-center gap-2">
      <a href="/profile" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm hover:bg-white/10">
        <img src={avatar} alt={name} className="h-6 w-6 rounded-full"/>
        <span className="max-w-[120px] truncate">{name}</span>
      </a>
      <button onClick={() => supabase.auth.signOut()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm hover:bg-white/10">
        <LogOut className="h-4 w-4"/>
      </button>
    </div>
  );
}
