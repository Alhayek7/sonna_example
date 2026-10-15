-- =====================================================================
--  تحدي الـ 30 يومًا | صناع الأثر الرقمي  —  مخطط قاعدة البيانات (Supabase)
--  الصق هذا الملف كاملاً في: Supabase ▸ SQL Editor ▸ New query ▸ Run
--  يمكن تشغيله أكثر من مرة دون مشاكل.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1) الجداول
-- ---------------------------------------------------------------------

-- إعدادات التحدي (صف واحد فقط)
create table if not exists public.config (
  id               int primary key default 1 check (id = 1),
  title            text    not null default 'تحدي الـ 30 يومًا',
  start_date       date    not null default current_date,
  total_days       int     not null default 30 check (total_days between 1 and 120),
  registration_open boolean not null default true,
  submissions_open  boolean not null default true,
  announcement     text    not null default 'الاستمرارية هي السر — انشر ريلز اليوم واصنع أثرك!',
  prize_cash       text    not null default '100$',
  prize_count      int     not null default 5,
  updated_at       timestamptz not null default now()
);
insert into public.config (id) values (1) on conflict (id) do nothing;

-- المشاركون
create table if not exists public.participants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  instagram   text not null check (char_length(instagram) between 2 and 40),
  job_title   text not null check (char_length(job_title) between 2 and 80),
  photo_url   text,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now()
);
create unique index if not exists participants_instagram_uq on public.participants (lower(instagram));

-- سجل الإنجاز اليومي
create table if not exists public.checkins (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  day            int  not null check (day between 1 and 120),
  status         text not null default 'pending' check (status in ('pending','approved')),
  reel_url       text check (reel_url is null or char_length(reel_url) <= 300),
  created_at     timestamptz not null default now(),
  unique (participant_id, day)
);
create index if not exists checkins_participant_idx on public.checkins (participant_id);

-- المديرون
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ---------------------------------------------------------------------
-- 2) دالة التحقق من المدير
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) سياسات الأمان RLS
-- ---------------------------------------------------------------------
alter table public.config       enable row level security;
alter table public.participants enable row level security;
alter table public.checkins     enable row level security;
alter table public.admins       enable row level security;

-- config
drop policy if exists config_read   on public.config;
drop policy if exists config_admin  on public.config;
create policy config_read  on public.config for select using (true);
create policy config_admin on public.config for all    using (public.is_admin()) with check (public.is_admin());

-- participants
drop policy if exists participants_read_public on public.participants;
drop policy if exists participants_register    on public.participants;
drop policy if exists participants_admin       on public.participants;
create policy participants_read_public on public.participants
  for select using (status = 'approved' or public.is_admin());
create policy participants_register on public.participants
  for insert with check (
    status = 'pending'
    and (select registration_open from public.config where id = 1)
  );
create policy participants_admin on public.participants
  for all using (public.is_admin()) with check (public.is_admin());

-- checkins
drop policy if exists checkins_read_public on public.checkins;
drop policy if exists checkins_submit      on public.checkins;
drop policy if exists checkins_admin       on public.checkins;
create policy checkins_read_public on public.checkins
  for select using (status = 'approved' or public.is_admin());
create policy checkins_submit on public.checkins
  for insert with check (
    status = 'pending'
    and reel_url is not null
    and (select submissions_open from public.config where id = 1)
    and exists (select 1 from public.participants p where p.id = participant_id and p.status = 'approved')
  );
create policy checkins_admin on public.checkins
  for all using (public.is_admin()) with check (public.is_admin());

-- admins: يقرأ المدير صفه فقط، ولا أحد يعدّل من الواجهة
drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 4) تخزين الصور الشخصية (Storage)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 1048576,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists avatars_read   on storage.objects;
drop policy if exists avatars_upload on storage.objects;
drop policy if exists avatars_admin  on storage.objects;
create policy avatars_read   on storage.objects for select using (bucket_id = 'avatars');
create policy avatars_upload on storage.objects for insert with check (bucket_id = 'avatars');
create policy avatars_admin  on storage.objects for all
  using (bucket_id = 'avatars' and public.is_admin())
  with check (bucket_id = 'avatars' and public.is_admin());

-- ---------------------------------------------------------------------
-- 5) التحديث الحي (Realtime)
-- ---------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.participants; exception when others then null; end;
  begin alter publication supabase_realtime add table public.checkins;     exception when others then null; end;
  begin alter publication supabase_realtime add table public.config;       exception when others then null; end;
end $$;

-- =====================================================================
-- 6) تعيين حساب المدير (بعد إنشاء المستخدم من Authentication ▸ Users)
--    أنشئ مستخدماً بالبريد  admin@sanaa.app  وكلمة مرور قوية، مع تفعيل Auto Confirm،
--    ثم شغّل هذا السطر (غيّر البريد إن اخترت اسم مستخدم آخر):
--
--    insert into public.admins (user_id)
--    select id from auth.users where email = 'admin@sanaa.app'
--    on conflict do nothing;
-- =====================================================================
