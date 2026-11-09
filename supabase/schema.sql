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
alter table public.lanterns add constraint lanterns_color_check check (color in ('촛불', '노을', '달빛', '벚꽃', '라벤더', '하늘', '새싹', '바다', '유채'));
alter table public.lanterns drop constraint if exists lanterns_shape_check;
alter table public.lanterns add constraint lanterns_shape_check check (shape in ('둥근', '네모', '초롱', '별', '달', '연꽃', '집', '풍등'));

-- 군대를 기다릴 때 군 종류: 전역일 계산과 도착 안내판 꾸밈에 써요
alter table public.lanterns add column if not exists branch text;
alter table public.lanterns drop constraint if exists lanterns_branch_check;
alter table public.lanterns add constraint lanterns_branch_check check (branch is null or branch in ('육군', '해군', '공군', '해병대', '카투사', '사회복무요원'));

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

-- 남긴 마음: 다른 사람의 등불 앞에 남기는 짧은 말 (기다림엔 응원, 그리움엔 추모).
-- 누구나 읽고, 자기 이름으로만 남겨요. 한 사람이 하루에 등불마다 세 번까지.
-- 쓴 사람과 등불 주인은 지울 수 있어요.
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  lantern_id uuid not null references public.lanterns(id) on delete cascade,
  from_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists messages_lantern_idx on public.messages (lantern_id, created_at desc);
alter table public.messages enable row level security;
create or replace function public.my_messages_today(lid uuid) returns bigint
  language sql stable security definer set search_path = public as $$
  select count(*) from public.messages where lantern_id = lid and from_id = auth.uid() and created_at > now() - interval '1 day'
$$;
drop policy if exists "messages read" on public.messages;
create policy "messages read"   on public.messages for select using (true);
drop policy if exists "messages insert" on public.messages;
create policy "messages insert" on public.messages for insert with check (auth.uid() = from_id and public.my_messages_today(lantern_id) < 3);
drop policy if exists "messages delete" on public.messages;
create policy "messages delete" on public.messages for delete using (auth.uid() = from_id or public.owns_lantern(lantern_id));

-- 놓고 가는 것: 국화, 들꽃, 간식, 공, 종이배, 조약돌. 한 사람이 등불마다 하루에 하나.
-- 등불 주인도 자기 등불(떠난 아이)에게 놓을 수 있어요. 누구나 볼 수 있고, 놓은 사람만 거둘 수 있어요.
-- day 는 놓은 사람의 날짜예요 (시간대 차이로 하루 앞뒤까지 받아요).
create table if not exists public.offerings (
  id         bigint generated always as identity primary key,
  lantern_id uuid not null references public.lanterns(id) on delete cascade,
  from_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('국화', '들꽃', '간식', '공', '종이배', '조약돌')),
  day        date not null default current_date,
  created_at timestamptz not null default now(),
  unique (from_id, lantern_id, day)
);
create index if not exists offerings_lantern_idx on public.offerings (lantern_id, day);
alter table public.offerings enable row level security;
drop policy if exists "offerings read" on public.offerings;
create policy "offerings read"   on public.offerings for select using (true);
drop policy if exists "offerings insert" on public.offerings;
create policy "offerings insert" on public.offerings for insert
  with check (auth.uid() = from_id and day between current_date - 1 and current_date + 1);
drop policy if exists "offerings delete" on public.offerings;
create policy "offerings delete" on public.offerings for delete using (auth.uid() = from_id);
-- 등불마다 놓인 것의 수 (전부 내려받지 않고 요약만). yesterday: 어제 놓인 수
create or replace function public.offering_counts() returns table (lantern_id uuid, kind text, n bigint, yesterday bigint)
  language sql stable security definer set search_path = public as $$
  select o.lantern_id, o.kind, count(*), count(*) filter (where o.day = current_date - 1)
  from public.offerings o group by o.lantern_id, o.kind
$$;
grant execute on function public.offering_counts() to anon, authenticated;

-- 이야기하기: 그리움 등불의 주인이 떠나보낸 사람(아이)에게 말을 걸고, 그 마음을 빌린 짧은 답장을 받아요.
-- 등불 주인만 읽고 쓰고 지울 수 있어요. role: me(내가 한 말) / them(답장). 하루에 내가 보내는 말은 30개까지.
create table if not exists public.talks (
  id         bigint generated always as identity primary key,
  lantern_id uuid not null references public.lanterns(id) on delete cascade,
  role       text not null check (role in ('me', 'them')),
  body       text not null check (char_length(btrim(body)) between 1 and 600),
  created_at timestamptz not null default now()
);
create index if not exists talks_lantern_idx on public.talks (lantern_id, created_at desc);
alter table public.talks enable row level security;
create or replace function public.my_talks_today(lid uuid) returns bigint
  language sql stable security definer set search_path = public as $$
  select count(*) from public.talks t
  where t.lantern_id = lid and t.role = 'me' and t.created_at > now() - interval '1 day'
    and exists (select 1 from public.lanterns l where l.id = lid and l.user_id = auth.uid())
$$;
drop policy if exists "talks read" on public.talks;
create policy "talks read"   on public.talks for select using (public.owns_lantern(lantern_id));
drop policy if exists "talks insert" on public.talks;
create policy "talks insert" on public.talks for insert with check (
  public.owns_lantern(lantern_id)
  and exists (select 1 from public.lanterns l where l.id = lantern_id and l.mode = 'miss')
  and (role = 'them' or public.my_talks_today(lantern_id) < 30)
);
drop policy if exists "talks delete" on public.talks;
create policy "talks delete" on public.talks for delete using (public.owns_lantern(lantern_id));

-- 등불 사진: 등불마다 한 장. 다른 사람에게 보일지는 등불 주인이 정해요 (photo_public).
-- 파일은 Storage 'photos' 버킷의 {user_id}/{등불 id}.jpg 에 있어요.
alter table public.lanterns add column if not exists photo_path text;
alter table public.lanterns add column if not exists photo_public boolean not null default false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 3145728, '{image/jpeg}')
on conflict (id) do update set public = false, file_size_limit = 3145728, allowed_mime_types = '{image/jpeg}';

-- 자기 폴더({user_id}/)에만 올리고 바꾸고 지울 수 있어요
drop policy if exists "photos write" on storage.objects;
create policy "photos write" on storage.objects for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos update" on storage.objects;
create policy "photos update" on storage.objects for update
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos delete" on storage.objects;
create policy "photos delete" on storage.objects for delete
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- 볼 수 있는 사람: 주인, 또는 주인이 '마을 사람들에게도 보여요'로 둔 사진이면 누구나
drop policy if exists "photos read" on storage.objects;
create policy "photos read" on storage.objects for select using (
  bucket_id = 'photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.lanterns l where l.photo_path = name and l.photo_public)
  )
);

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

-- 숫자 세기: 방문, 등불 걸기 같은 행동만 남겨요. 이름·일기·사진 같은 내용은 담지 않아요.
-- 누구나 자기 행동만 남길 수 있고, 읽기는 운영자만 (대시보드 SQL Editor 에서 analytics 요약으로) 봐요.
create table if not exists public.events (
  id         bigint generated always as identity primary key,
  user_id    uuid default auth.uid() references auth.users(id) on delete set null,
  name       text not null check (name in (
    'visit', 'story_end', 'form_open', 'lantern_created', 'note_written', 'warmth_sent',
    'share_click', 'clip_made', 'photo_added', 'feedback_sent', 'message_left', 'offering_left', 'talk_sent'
  )),
  props      jsonb not null default '{}' check (octet_length(props::text) <= 400),
  via        text not null default '' check (char_length(via) <= 60),   -- 어디서 왔는지 (share, rainbow, discharge, 검색 사이트 이름, utm_source)
  created_at timestamptz not null default now()
);
create index if not exists events_name_time_idx on public.events (name, created_at);
-- 이미 만들어 둔 표에도 새 행동 이름을 받아요
alter table public.events drop constraint if exists events_name_check;
alter table public.events add constraint events_name_check check (name in (
  'visit', 'story_end', 'form_open', 'lantern_created', 'note_written', 'warmth_sent',
  'share_click', 'clip_made', 'photo_added', 'feedback_sent', 'message_left', 'offering_left', 'talk_sent'
));
create index if not exists events_user_idx on public.events (user_id, created_at);
alter table public.events enable row level security;
drop policy if exists "events insert" on public.events;
create policy "events insert" on public.events for insert with check (auth.uid() = user_id);

-- 운영자용 요약. 공개 API 에 나가지 않는 analytics 스키마에 둬요.
create schema if not exists analytics;
revoke all on schema analytics from public, anon, authenticated;

-- 날짜별 (한국 시간): 방문한 사람, 등불 걸기 연 사람, 등불을 건 사람, 다시 온 사람, 공유
create or replace view analytics.daily as
with e as (
  select (created_at at time zone 'Asia/Seoul')::date as day, user_id, name, via from public.events
), firsts as (
  select user_id, min((created_at at time zone 'Asia/Seoul')::date) as first_day from public.events where name = 'visit' group by user_id
)
select
  e.day,
  count(distinct e.user_id) filter (where e.name = 'visit')                                       as visitors,
  count(distinct e.user_id) filter (where e.name = 'visit' and f.first_day = e.day)               as new_visitors,
  count(distinct e.user_id) filter (where e.name = 'visit' and f.first_day < e.day)               as returning_visitors,
  count(distinct e.user_id) filter (where e.name = 'form_open')                                   as opened_form,
  count(*)                  filter (where e.name = 'lantern_created')                             as lanterns_created,
  count(*)                  filter (where e.name = 'note_written')                                as notes,
  count(*)                  filter (where e.name = 'warmth_sent')                                 as warmth,
  count(*)                  filter (where e.name = 'share_click')                                 as shares,
  count(distinct e.user_id) filter (where e.name = 'visit' and e.via = 'share')                   as from_share_links,
  count(*)                  filter (where e.name = 'clip_made')                                   as clips,
  round(100.0 * count(distinct e.user_id) filter (where e.name = 'lantern_created')
        / nullif(count(distinct e.user_id) filter (where e.name = 'visit'), 0), 1)               as lantern_rate_pct
from e left join firsts f using (user_id)
group by e.day
order by e.day desc;

-- 처음 온 사람이 7일 안에 어디까지 갔는지 (처음 온 날 기준, 최근 8주)
create or replace view analytics.funnel_7d as
with firsts as (
  select user_id, min(created_at) as first_at from public.events where name = 'visit' group by user_id
)
select
  date_trunc('week', f.first_at at time zone 'Asia/Seoul')::date as week,
  count(*)                                                                                         as new_visitors,
  count(*) filter (where exists (select 1 from public.events x where x.user_id = f.user_id and x.name = 'form_open'       and x.created_at < f.first_at + interval '7 days')) as opened_form,
  count(*) filter (where exists (select 1 from public.events x where x.user_id = f.user_id and x.name = 'lantern_created' and x.created_at < f.first_at + interval '7 days')) as hung_lantern,
  count(*) filter (where exists (select 1 from public.events x where x.user_id = f.user_id and x.name = 'visit' and x.created_at >= f.first_at + interval '1 day' and x.created_at < f.first_at + interval '7 days')) as came_back,
  count(*) filter (where exists (select 1 from public.events x where x.user_id = f.user_id and x.name = 'share_click'     and x.created_at < f.first_at + interval '7 days')) as shared
from firsts f
where f.first_at > now() - interval '8 weeks'
group by 1
order by 1 desc;

-- 어디서 들어왔는지 (최근 30일)
create or replace view analytics.sources_30d as
select coalesce(nullif(via, ''), '(직접)') as via, count(distinct user_id) as visitors
from public.events
where name = 'visit' and created_at > now() - interval '30 days'
group by 1
order by 2 desc;

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
