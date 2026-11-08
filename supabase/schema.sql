-- 기다림 항구 데이터베이스
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 실행하세요.
-- 여러 번 실행해도 안전해요.

-- 등불: 한 사람이 여러 개(최대 5개) 걸 수 있어요. id 는 등불, user_id 는 등불을 건 사람.
create table if not exists public.lanterns (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
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
alter table public.lanterns add constraint lanterns_place_check check (place in ('항구', '숲', '언덕', '등대', '하늘', '무지개'));

-- 등불 꾸미기: 불빛 색과 등 모양
alter table public.lanterns add column if not exists color text not null default '촛불';
alter table public.lanterns add column if not exists shape text not null default '둥근';
alter table public.lanterns drop constraint if exists lanterns_color_check;
alter table public.lanterns add constraint lanterns_color_check check (color in ('촛불', '노을', '달빛', '벚꽃', '라벤더', '하늘', '새싹'));
alter table public.lanterns drop constraint if exists lanterns_shape_check;
alter table public.lanterns add constraint lanterns_shape_check check (shape in ('둥근', '네모', '별', '풍등'));

-- 등불 종류: wait(돌아올 사람을 기다려요), miss(떠나보낸 사람을 그리워해요, 하늘에 띄우는 풍등)
-- miss 에서 start_date 는 처음 만난 날, end_date 는 떠난 날이에요.
alter table public.lanterns add column if not exists mode text not null default 'wait';
alter table public.lanterns drop constraint if exists lanterns_mode_check;
alter table public.lanterns add constraint lanterns_mode_check check (mode in ('wait', 'miss'));

-- 무지개마을: 떠난 반려동물이 어떤 아이였는지 (종류마다 지내는 모습이 달라요)
alter table public.lanterns add column if not exists species text;
alter table public.lanterns drop constraint if exists lanterns_species_check;
alter table public.lanterns add constraint lanterns_species_check check (species is null or species in ('강아지', '고양이', '새', '물고기', '햄스터·토끼', '거북이·도마뱀', '곤충', '그 밖의 아이'));

-- 예전 구조(한 사람당 등불 하나, 사람 아이디가 곧 등불 아이디)에서 옮겨 와요.
-- 이미 걸린 등불은 사람 아이디를 그대로 등불 아이디로 이어받아서, 온기·일기·공유 링크가 끊기지 않아요.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lanterns' and column_name = 'id') then
    alter table public.lanterns add column id uuid;
    update public.lanterns set id = user_id;
    alter table public.lanterns alter column id set not null;
    alter table public.lanterns alter column id set default gen_random_uuid();
    alter table if exists public.warmth drop constraint if exists warmth_to_id_fkey;
    alter table if exists public.notes  drop constraint if exists notes_lantern_id_fkey;
    alter table public.lanterns drop constraint lanterns_pkey;
    alter table public.lanterns add primary key (id);
    if to_regclass('public.warmth') is not null then
      alter table public.warmth add constraint warmth_to_id_fkey foreign key (to_id) references public.lanterns(id) on delete cascade;
    end if;
    if to_regclass('public.notes') is not null then
      alter table public.notes add constraint notes_lantern_id_fkey foreign key (lantern_id) references public.lanterns(id) on delete cascade;
    end if;
  end if;
end $$;
create index if not exists lanterns_user_idx on public.lanterns (user_id);

-- 온기: 한 사람이 한 등불에 하루 한 번
create table if not exists public.warmth (
  from_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  to_id   uuid not null references public.lanterns(id) on delete cascade,  -- 받은 등불
  day     date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id, day)
);

alter table public.lanterns enable row level security;
alter table public.warmth   enable row level security;

-- 기다림 일기: 등불 주인이 날마다 남기는 글. '나만 보기'로 쓴 글은 본인만 봐요.
create table if not exists public.notes (
  id         bigint generated always as identity primary key,
  lantern_id uuid not null references public.lanterns(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 300),
  public     boolean not null default true,
  day        date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists notes_lantern_idx on public.notes (lantern_id, created_at desc);

alter table public.warmth drop constraint if exists warmth_check;           -- 예전 "자기 자신에게 온기 금지" (이제 정책으로 막아요)
alter table public.notes alter column lantern_id drop default;
alter table public.notes enable row level security;
drop policy if exists "notes read" on public.notes;
-- 일기는 그 등불을 건 사람만 쓰고 고치고 지울 수 있어요
create or replace function public.owns_lantern(lid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lanterns where id = lid and user_id = auth.uid())
$$;
create policy "notes read"   on public.notes for select using (public or public.owns_lantern(lantern_id));
drop policy if exists "notes insert" on public.notes;
create policy "notes insert" on public.notes for insert with check (public.owns_lantern(lantern_id));
drop policy if exists "notes update" on public.notes;
create policy "notes update" on public.notes for update using (public.owns_lantern(lantern_id)) with check (public.owns_lantern(lantern_id));
drop policy if exists "notes delete" on public.notes;
create policy "notes delete" on public.notes for delete using (public.owns_lantern(lantern_id));

-- 누구나 등불을 볼 수 있고, 자기 등불만 고칠 수 있어요
drop policy if exists "lanterns read" on public.lanterns;
create policy "lanterns read"   on public.lanterns for select using (true);
drop policy if exists "lanterns insert" on public.lanterns;
-- 한 사람이 걸 수 있는 등불은 5개까지
create or replace function public.my_lantern_count() returns bigint
  language sql stable security definer set search_path = public as $$
  select count(*) from public.lanterns where user_id = auth.uid()
$$;
create policy "lanterns insert" on public.lanterns for insert with check (auth.uid() = user_id and public.my_lantern_count() < 5);
drop policy if exists "lanterns update" on public.lanterns;
create policy "lanterns update" on public.lanterns for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "lanterns delete" on public.lanterns;
create policy "lanterns delete" on public.lanterns for delete using (auth.uid() = user_id);

-- 온기는 누구나 볼 수 있고, 자기 이름으로만 보낼 수 있어요
drop policy if exists "warmth read" on public.warmth;
create policy "warmth read"   on public.warmth for select using (true);
drop policy if exists "warmth insert" on public.warmth;
create policy "warmth insert" on public.warmth for insert with check (auth.uid() = from_id and not public.owns_lantern(to_id));

-- 의견: 마을 사람들이 등대지기(운영자)에게 남기는 말. 운영자만 대시보드에서 봐요 (읽기 정책 없음).
create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  user_id    uuid default auth.uid() references auth.users(id) on delete set null,
  body       text not null check (char_length(body) between 1 and 1000),
  contact    text not null default '' check (char_length(contact) <= 100),
  page       text not null default '' check (char_length(page) <= 200),
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
-- 한 사람이 하루에 5개까지
create or replace function public.my_feedback_today() returns bigint
  language sql stable security definer set search_path = public as $$
  select count(*) from public.feedback where user_id = auth.uid() and created_at > now() - interval '1 day'
$$;
drop policy if exists "feedback insert" on public.feedback;
create policy "feedback insert" on public.feedback for insert with check (auth.uid() = user_id and public.my_feedback_today() < 5);

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
  foreach t in array array['lanterns', 'warmth', 'notes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
