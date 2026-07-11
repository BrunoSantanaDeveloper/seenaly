-- ============================================================
-- 0020_help: customer-facing help center. Content is written by the
-- superadmin in /admin/help (per-locale rows) and served publicly at
-- /help without a deploy. Publishing is a switch, not a migration.
-- ============================================================

create table public.help_categories (
  id uuid primary key default gen_random_uuid(),
  -- One row per locale; the public page falls back to 'en' when the
  -- visitor's locale has no content.
  locale text not null default 'en',
  slug text not null,
  name text not null,
  description text,
  sort integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (locale, slug)
);

create table public.help_articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.help_categories (id) on delete cascade,
  locale text not null default 'en',
  slug text not null,
  title text not null,
  excerpt text,
  body_md text not null default '',
  sort integer not null default 0,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (locale, slug)
);

create index help_articles_category_idx on public.help_articles (category_id);
create index help_articles_locale_idx on public.help_articles (locale) where is_published;

-- ---------- RLS ----------

alter table public.help_categories enable row level security;
alter table public.help_articles enable row level security;

-- The help center is public: anonymous visitors read published content.
create policy "help_categories_select_published" on public.help_categories
  for select to anon, authenticated
  using (is_published or public.is_superadmin());

create policy "help_articles_select_published" on public.help_articles
  for select to anon, authenticated
  using (is_published or public.is_superadmin());

create policy "help_categories_all_superadmin" on public.help_categories
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

create policy "help_articles_all_superadmin" on public.help_articles
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- ---------- published_at + updated_at maintenance ----------

create or replace function public.set_help_published_at()
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

create trigger help_articles_published_at
  before insert or update on public.help_articles
  for each row execute function public.set_help_published_at();

create trigger help_categories_updated_at
  before update on public.help_categories
  for each row execute function public.set_updated_at();

create trigger help_articles_updated_at
  before update on public.help_articles
  for each row execute function public.set_updated_at();
