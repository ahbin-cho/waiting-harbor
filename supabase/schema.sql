-- 기다림 항구 데이터베이스
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 실행하세요.
-- 여러 번 실행해도 안전해요.

-- 등불: 한 사람당 하나
create table if not exists public.lanterns (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  who        text not null check (char_length(who) between 1 and 10),
  kind       text not null default '그 밖의 기다림',
  start_date date not null default current_date,
  end_date   date not null,
  line       text not null default '' check (char_length(line) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date)
);

-- 등불을 걸어둔 장소 (나중에 추가된 칸이라 따로 더해요)
alter table public.lanterns add column if not exists place text not null default '항구';
alter table public.lanterns drop constraint if exists lanterns_place_check;
alter table public.lanterns add constraint lanterns_place_check check (place in ('항구', '숲', '언덕', '등대'));

-- 등불 꾸미기: 불빛 색과 등 모양
alter table public.lanterns add column if not exists color text not null default '촛불';
alter table public.lanterns add column if not exists shape text not null default '둥근';
alter table public.lanterns drop constraint if exists lanterns_color_check;
alter table public.lanterns add constraint lanterns_color_check check (color in ('촛불', '노을', '달빛', '벚꽃', '라벤더', '하늘', '새싹'));
alter table public.lanterns drop constraint if exists lanterns_shape_check;
alter table public.lanterns add constraint lanterns_shape_check check (shape in ('둥근', '네모', '별'));

-- 온기: 한 사람이 한 등불에 하루 한 번
create table if not exists public.warmth (
  from_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  to_id   uuid not null references public.lanterns(user_id) on delete cascade,
  day     date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id, day),
  check (from_id <> to_id)
);

alter table public.lanterns enable row level security;
alter table public.warmth   enable row level security;

-- 누구나 등불을 볼 수 있고, 자기 등불만 고칠 수 있어요
drop policy if exists "lanterns read" on public.lanterns;
create policy "lanterns read"   on public.lanterns for select using (true);
drop policy if exists "lanterns insert" on public.lanterns;
create policy "lanterns insert" on public.lanterns for insert with check (auth.uid() = user_id);
drop policy if exists "lanterns update" on public.lanterns;
create policy "lanterns update" on public.lanterns for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "lanterns delete" on public.lanterns;
create policy "lanterns delete" on public.lanterns for delete using (auth.uid() = user_id);

-- 온기는 누구나 볼 수 있고, 자기 이름으로만 보낼 수 있어요
drop policy if exists "warmth read" on public.warmth;
create policy "warmth read"   on public.warmth for select using (true);
drop policy if exists "warmth insert" on public.warmth;
create policy "warmth insert" on public.warmth for insert with check (auth.uid() = from_id);

-- updated_at 자동 갱신
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists lanterns_touch on public.lanterns;
create trigger lanterns_touch before update on public.lanterns
  for each row execute function public.touch_updated_at();

-- 실시간 반영
-- 여러 번 실행해도 오류가 나지 않도록, 아직 없는 테이블만 추가해요
do $$
declare t text;
begin
  foreach t in array array['lanterns', 'warmth'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
