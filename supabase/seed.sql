-- 기다림 항구: 마을을 채우는 예시 데이터
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 실행하세요. 여러 번 실행해도 같은 데이터가 한 번만 들어가요.
-- schema.sql 을 먼저 실행해 둔 상태여야 해요.
--
-- 들어가는 것: 마을 사람 10명(익명), 등불 19개(기다림 10, 하늘의 풍등 3, 무지개마을 아이 6),
--              일기, 응원·추모의 말, 지난 며칠의 온기(추모), 놓고 간 것(국화, 들꽃, 간식…).
-- 날짜는 실행한 날을 기준으로 정해져요. 며칠 뒤 다시 실행해도 이미 있는 건 그대로 둬요.
-- 지우려면 supabase/unseed.sql 을 실행하세요. 예시 사람과 그 사람들의 등불·일기·말·온기가 함께 지워져요.
-- 예시 사람의 id 는 모두 5eed0000- 으로 시작해요.

-- 1) 마을 사람: 로그인 없이 들어온 익명 사용자처럼 만들어요
insert into auth.users (id, instance_id, aud, role, is_anonymous, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select ('5eed0000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true,
       '{"provider":"anonymous","providers":["anonymous"]}'::jsonb, '{"seed":true}'::jsonb,
       now() - interval '30 days', now()
from generate_series(1, 10) n
on conflict (id) do nothing;

-- 2) 등불
-- 열: 번호, 건 사람 번호, 이름(10자까지), 종류, 시작(오늘부터 며칠), 끝(오늘부터 며칠), 한 줄(60자까지), 장소, 색, 모양, 종류(wait/miss), 반려동물 종류
-- 기다림: 시작 = 기다리기 시작한 날, 끝 = 돌아오는 날
-- 그리움: 시작 = 처음 만난 날, 끝 = 떠난 날 (오늘보다 앞)
insert into public.lanterns (id, user_id, who, kind, start_date, end_date, line, place, color, shape, mode, species, created_at)
select ('5eed1000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
       ('5eed0000-0000-4000-8000-' || lpad(v.u::text, 12, '0'))::uuid,
       v.who, v.kind, current_date + v.s, current_date + v.e, v.line, v.place, v.color, v.shape, v.mode, v.species,
       now() - make_interval(days => 30 - v.n)
from (values
  ( 1,  1, '도윤',   '군대',             -210,   338, '편지 쓰는 날은 하루가 빨리 가요.',          '항구',   '촛불',   '초롱', 'wait', null),
  ( 2,  2, '지민',   '장거리 연애',       -45,    12, '토론토는 지금 새벽이래요.',                 '항구',   '벚꽃',   '둥근', 'wait', null),
  ( 3,  3, '아빠',   '해외에 있는 가족',  -120,    64, '현장 일 끝나면 바로 온대요.',               '항구',   '바다',   '집',   'wait', null),
  ( 4,  4, '현우',   '군대',             -480,    66, '말년 휴가 날짜 나왔대요.',                  '언덕',   '유채',   '별',   'wait', null),
  ( 5,  5, '소윤',   '장거리 연애',       -20,   160, '같은 노래 틀어 놓고 통화해요.',             '숲',     '라벤더', '달',   'wait', null),
  ( 6,  6, '엄마',   '해외에 있는 가족',  -300,    25, '이번 설엔 같이 떡국 먹어요.',               '등대',   '노을',   '연꽃', 'wait', null),
  ( 7,  7, '준서',   '그 밖의 기다림',     -90,     3, '수술 잘 끝나고 퇴원하는 날이에요.',         '등대',   '달빛',   '네모', 'wait', null),
  ( 8,  1, '형',     '군대',             -560,    -3, '드디어 왔어요. 고생 많았어.',               '언덕',   '새싹',   '둥근', 'wait', null),
  ( 9,  8, '하린',   '장거리 연애',      -150,    40, '공항 가는 길을 미리 걸어 봤어요.',          '숲',     '하늘',   '초롱', 'wait', null),
  (10,  9, '은재',   '그 밖의 기다림',     -60,   100, '유학 마치고 오는 날이에요.',                '항구',   '달빛',   '연꽃', 'wait', null),
  (11, 10, '할머니', '가족',           -12000,  -200, '할머니 된장찌개 냄새가 그리워요.',          '하늘',   '촛불',   '풍등', 'miss', null),
  (12,  4, '민재',   '친구',            -4000,  -400, '네가 좋아하던 노래가 라디오에 나왔어.',     '하늘',   '하늘',   '풍등', 'miss', null),
  (13,  6, '아버지', '가족',           -15000,  -800, '',                                         '하늘',   '노을',   '풍등', 'miss', null),
  (14,  2, '보리',   '반려동물',        -5000,   -60, '산책 시간이면 아직도 현관을 봐요.',         '무지개', '유채',   '둥근', 'miss', '강아지'),
  (15,  3, '나비',   '반려동물',        -6000,  -300, '창가 자리는 아직 비워 뒀어.',               '무지개', '달빛',   '둥근', 'miss', '고양이'),
  (16,  5, '콩이',   '반려동물',         -900,   -20, '해바라기씨 볼 때마다 생각나.',              '무지개', '벚꽃',   '둥근', 'miss', '햄스터·토끼'),
  (17,  7, '하늘이', '반려동물',        -3000,  -150, '아침마다 노래해 줘서 고마웠어.',            '무지개', '하늘',   '둥근', 'miss', '새'),
  (18,  8, '느림보', '반려동물',        -7000,  -500, '천천히, 오래 곁에 있어 줘서 고마워.',       '무지개', '새싹',   '둥근', 'miss', '거북이·도마뱀'),
  (19,  9, '꼬물이', '반려동물',         -700,   -40, '어항 불빛을 아직 못 끄겠어.',               '무지개', '바다',   '둥근', 'miss', '물고기')
) as v(n, u, who, kind, s, e, line, place, color, shape, mode, species)
on conflict (id) do nothing;

-- 3) 일기: 등불을 건 사람이 남긴 글 (마을 사람들에게 보여요)
insert into public.notes (lantern_id, body, public, day, created_at)
select ('5eed1000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid, v.body, true, current_date + v.d, now() + make_interval(days => v.d)
from (values
  ( 1,  -1, '훈련소 사진 올라왔어요. 얼굴이 많이 탔어요.'),
  ( 1,  -6, '첫 전화. 목소리 듣고 한참 울었어요.'),
  ( 2,  -2, '시차 계산하는 게 이제 암산으로 돼요.'),
  ( 3,  -4, '아빠가 보내준 현장 사진 뒤로 바다가 보여요.'),
  ( 4,  -3, '달력에 남은 칸이 두 줄밖에 안 남았어요.'),
  ( 7,  -1, '사흘만 더. 병원 밥 이제 지겹대요.'),
  (11,  -9, '할머니 기일이 다가와요. 올해는 제가 전을 부칠게요.'),
  (14,  -2, '공원에서 보리랑 닮은 강아지를 봤어요. 한참 따라 걸었어요.'),
  (15, -20, '오늘 처음으로 창가 방석을 빨았어.')
) as v(n, d, body)
where not exists (
  select 1 from public.notes x
  where x.lantern_id = ('5eed1000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid and x.body = v.body
);

-- 4) 응원·추모의 말: 다른 마을 사람이 남긴 말
insert into public.messages (lantern_id, from_id, body, created_at)
select ('5eed1000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
       ('5eed0000-0000-4000-8000-' || lpad(v.u::text, 12, '0'))::uuid,
       v.body, now() + make_interval(days => v.d)
from (values
  ( 1,  4, -2, '저희 집도 작년에 보냈어요. 시간 생각보다 빨리 가요.'),
  ( 2,  5, -1, '저도 시차 13시간이에요. 같이 버텨요.'),
  ( 7,  6, -1, '퇴원 날 맛있는 거 꼭 드세요.'),
  ( 8,  9, -2, '형 오셨군요. 축하드려요.'),
  (11,  1, -5, '저희 할머니도 된장찌개가 최고였어요.'),
  (12,  2, -8, '친구분도 그 노래 듣고 계실 거예요.'),
  (14,  3, -3, '저도 작년에 보냈어요. 현관 보는 거 저도 그래요.'),
  (14,  7, -1, '보리가 무지개마을 풀밭에서 신나게 뛰고 있을 거예요.'),
  (15,  5, -6, '나비 자리, 계속 비워 두셔도 괜찮아요.'),
  (19,  8, -2, '어항 불빛, 천천히 끄셔도 돼요.')
) as v(n, u, d, body)
where not exists (
  select 1 from public.messages x
  where x.lantern_id = ('5eed1000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid and x.body = v.body
);

-- 5) 온기(추모): 지난 엿새 동안 마을 사람들이 들러 보낸 것처럼, 등불마다 조금씩 다르게
insert into public.warmth (from_id, to_id, day)
select u.id, l.id, current_date - g
from public.lanterns l
cross join (select id from auth.users where id::text like '5eed0000-%') u
cross join generate_series(0, 5) g
where l.id::text like '5eed1000-%'
  and u.id <> l.user_id
  and abs(hashtext(l.id::text || u.id::text || g::text)) % 100 < 8 + abs(hashtext(l.id::text)) % 28  -- 등불마다 들른 정도가 달라요
on conflict do nothing;

-- 6) 놓고 간 것: 지난 엿새 동안 등불마다 조금씩, 그 등불에 어울리는 것으로
insert into public.offerings (lantern_id, from_id, kind, day)
select l.id, u.id,
       k.kinds[1 + abs(hashtext(u.id::text || l.id::text || g::text)) % array_length(k.kinds, 1)],
       current_date - g
from public.lanterns l
cross join lateral (select case
  when l.place = '무지개' then case l.species
    when '강아지' then array['국화', '간식', '공', '뼈다귀']
    when '고양이' then array['국화', '츄르', '상자', '공']
    when '새' then array['국화', '해바라기씨', '방울']
    when '물고기' then array['국화', '먹이', '조약돌']
    when '햄스터·토끼' then array['국화', '해바라기씨', '당근']
    when '거북이·도마뱀' then array['국화', '상추', '조약돌']
    else array['국화', '간식', '공'] end
  when l.mode = 'miss' then array['국화', '들꽃', '편지', '찻잔']
  when l.kind = '군대' then array['편지', '위문상자', '핫팩']
  when l.kind = '장거리 연애' then array['편지', '종이비행기', '풍선']
  when l.kind = '해외에 있는 가족' then array['편지', '종이비행기', '도시락']
  else array['편지', '들꽃', '풍선'] end as kinds) k
cross join (select id from auth.users where id::text like '5eed0000-%') u
cross join generate_series(0, 5) g
where l.id::text like '5eed1000-%'
  and abs(hashtext('o' || l.id::text || u.id::text || g::text)) % 100 < 6 + abs(hashtext('o' || l.id::text)) % 22
on conflict do nothing;

-- 직접 하나 더 넣고 싶을 때 (아래 주석을 풀고 값만 바꿔서 실행하세요)
-- 건 사람은 예시 사람 1~10 중 하나를 쓰면 unseed.sql 로 함께 지울 수 있어요.
-- insert into public.lanterns (user_id, who, kind, start_date, end_date, line, place, color, shape, mode, species)
-- values ('5eed0000-0000-4000-8000-000000000003', '서준', '군대', current_date - 30, current_date + 500, '첫 휴가 날짜 나오면 알려 줘.', '언덕', '촛불', '초롱', 'wait', null);
