alter table public.profiles enable row level security;
alter table public.novels enable row level security;
alter table public.chapters enable row level security;
alter table public.submissions enable row level security;

create policy "read profiles" on public.profiles for select using (true);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);

create policy "read novels" on public.novels for select using (true);
create policy "read chapters" on public.chapters for select using (true);

create policy "write novels admin" on public.novels for insert with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "update novels admin" on public.novels for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "write chapters admin" on public.chapters for insert with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "update chapters admin" on public.chapters for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "submit draft" on public.submissions for insert with check (auth.uid() = author_id);
create policy "read submissions self or admin" on public.submissions for select using (
  author_id = auth.uid() OR exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
);
create policy "moderate submissions admin" on public.submissions for update using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
);
