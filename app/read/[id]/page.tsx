// app/read/[id]/page.tsx
import { createClient } from "@supabase/supabase-js";

/** server-side supabase client pakai anon (RLS tetap berlaku) */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Img = { id: string; url: string; ord: number };

// app/read/[id]/page.tsx
export default function Page({ params }: { params: { id: string } }) {
  return <div style={{padding: 20}}>Reader OK — id: {params.id}</div>;
}

