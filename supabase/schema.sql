create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  handle text unique,
  avatar_url text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.novels (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  author_id uuid references public.profiles(id) on delete set null,
  cover_url text,
  synopsis text,
  tags text[],
  status text not null default 'Ongoing',
  rating numeric,
  created_at timestamptz default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  novel_id uuid references public.novels(id) on delete cascade,
  number int not null,
  title text not null,
  content text,
  updated_at timestamptz default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  synopsis text,
  tags text[],
  cover_url text,
  content text,
  status text not null default 'pending',
  created_at timestamptz default now(),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz
);
