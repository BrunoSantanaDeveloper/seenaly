-- ============================================================
-- 0021_blog: public blog with moderated comments. Posts are written
-- by the superadmin in /admin/blog (per-locale rows) and served at
-- /blog; signed-in users comment, comments go live after moderation.
-- ============================================================

create type public.blog_comment_status as enum ('pending', 'approved', 'rejected');

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'en',
  slug text not null,
  title text not null,
  excerpt text,
  body_md text not null default '',
  -- Optional cover image URL (Supabase storage or external).
  cover_url text,
  author_name text,
  tags text[] not null default '{}',
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (locale, slug)
);

create index blog_posts_locale_idx on public.blog_posts (locale, published_at desc) where is_published;

create table public.blog_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Denormalized at insert time (trigger below): profiles are not readable
  -- by anonymous visitors, but published comments must show their author.
  author_name text,
  body text not null,
  status public.blog_comment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index blog_comments_post_idx on public.blog_comments (post_id, status);

-- ---------- RLS ----------

alter table public.blog_posts enable row level security;
alter table public.blog_comments enable row level security;

create policy "blog_posts_select_published" on public.blog_posts
  for select to anon, authenticated
  using (is_published or public.is_superadmin());

create policy "blog_posts_all_superadmin" on public.blog_posts
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- Everyone reads approved comments; authors also see their own pending
-- ones (so the thread never looks like it swallowed their words).
create policy "blog_comments_select_visible" on public.blog_comments
  for select to anon, authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_superadmin());

-- Users create their own comments, always as pending; moderation is a
-- superadmin update in /admin/blog.
create policy "blog_comments_insert_own" on public.blog_comments
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

create policy "blog_comments_delete_own" on public.blog_comments
  for delete to authenticated
  using (user_id = auth.uid());

create policy "blog_comments_all_superadmin" on public.blog_comments
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- ---------- Triggers ----------

-- Stamp the author's display name on each comment (see column comment).
create or replace function public.set_blog_comment_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select display_name into new.author_name from public.profiles where id = new.user_id;
  return new;
end;
$$;

create trigger blog_comments_author
  before insert on public.blog_comments
  for each row execute function public.set_blog_comment_author();

create or replace function public.set_blog_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.is_published and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger blog_posts_published_at
  before insert or update on public.blog_posts
  for each row execute function public.set_blog_published_at();

create trigger blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();
