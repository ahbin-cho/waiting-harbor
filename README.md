# 기다림 항구

돌아올 사람을 기다리는 사람들이 등불을 걸어두는 곳.
군대 간 애인, 장거리 연애, 해외에 있는 가족을 기다리는 사람들이 각자 등불을 걸고,
돌아올 날이 가까울수록 불빛이 밝아져요.

## 기능
- 처음 오면 등대지기가 마을 이야기를 들려줘요 (카메라가 장면마다 이동)
- 회원가입 없이 익명으로 입장
- 3D 밤 마을: 처음엔 멀리서 마을 전체의 불빛을 보고, 장소나 등불을 누르면 카메라가 다가가요. 끌어서 돌려보고 두 손가락으로 확대해요. 항구, 숲, 언덕, 등대 네 곳이 있어요.
- 등불 꾸미기: 불빛 색 7가지와 모양 3가지(둥근 등, 네모 등, 별 등)
- 내 등불 걸기: 기다리는 사람 이름, 기다림 종류, 걸어둘 장소, 시작일, 돌아오는 날, 오늘의 한 줄
- Supabase 설정이 없으면 예시 등불이 걸린 체험 모드로 열려요 (저장되지 않음)
- "지수를 기다리는 사람"처럼 기다리는 사람의 이름으로 불림
- 돌아올 날이 가까울수록 등불이 밝아지고, D-day가 지나면 "다시 만났어요". 등불은 기둥을 떠나 하늘로 올라가요
- 지금 접속한 사람의 등불은 살짝 흔들림 (실시간)
- 다른 사람 등불에 하루 한 번 온기 보내기, 내 등불이 온기를 받으면 반짝임

## 기술
Vite + React + TypeScript, three.js (3D 마을), Supabase (DB, 익명 로그인, Realtime)

## 시작하기
1. https://supabase.com 에서 새 프로젝트를 만들어요.
2. Authentication > Sign In / Providers 에서 **Anonymous sign-ins** 를 켜요.
3. SQL Editor 에 `supabase/schema.sql` 을 붙여넣고 실행해요. (여러 번 실행해도 괜찮아요)
4. Project Settings > API 에서 URL과 anon key를 복사해서 `.env` 파일을 만들어요.
   ```
   cp .env.example .env
   ```
5. 연결 확인 (익명 로그인, 테이블 읽기, Realtime 구독을 차례로 확인해요)
   ```
   npm install
   npm run check:supabase
   ```
6. 실행
   ```
   npm run dev
   ```

## 검색 등록 (배포 후 한 번)
1. **구글**: https://search.google.com/search-console 에서 "URL 접두어"로 사이트 주소를 추가하고, "HTML 태그" 인증 코드(content 값)를 Vercel 환경 변수 `GOOGLE_SITE_VERIFICATION`에 넣고 다시 배포해요. 인증 뒤 Sitemaps 에 `sitemap.xml` 을 제출해요.
2. **네이버**: https://searchadvisor.naver.com 에서 사이트를 등록하고, "HTML 태그" 인증 코드를 `NAVER_SITE_VERIFICATION`에 넣고 다시 배포해요. 인증 뒤 "요청 → 사이트맵 제출"에 `sitemap.xml` 을 넣어요.
3. 사이트 주소를 정해 두려면 `SITE_URL`(예: `https://waiting-harbor.vercel.app`)도 넣어요. 없으면 Vercel 운영 주소를 써요.

검색으로 들어오는 글 페이지: `/rainbow/`(무지개마을, 반려동물 추모), `/discharge/`(전역일 계산기).

## 카카오톡 공유 버튼 (선택)
"보내기" 화면에 카카오톡 버튼을 띄우려면:
1. https://developers.kakao.com 에서 애플리케이션을 만들어요.
2. 앱 설정 → 플랫폼 → Web 에 사이트 주소(예: `https://waiting-harbor-xxxx.vercel.app`)를 등록해요.
3. 앱 키의 **JavaScript 키**를 Vercel 환경 변수 `VITE_KAKAO_JS_KEY` 에 넣고 다시 배포해요.

## 숫자 보기
방문, 등불 걸기, 일기, 온기, 공유 같은 행동이 Supabase `events` 테이블에 쌓여요 (이름·일기·사진 같은 내용은 담지 않아요).
Supabase SQL Editor 에서 아래처럼 봐요.
```sql
select * from analytics.daily;        -- 날짜별: 방문, 새로 온/다시 온 사람, 등불 걸기 연 사람, 건 등불, 공유, 등불 건 비율(%)
select * from analytics.funnel_7d;    -- 주별: 처음 온 사람이 7일 안에 등불 걸기 열기 → 걸기 → 다시 오기 → 공유까지 간 수
select * from analytics.sources_30d;  -- 최근 30일 어디서 들어왔는지 (share, rainbow, naver.com, utm_source …)
```
광고나 게시물 링크에는 `?utm_source=insta` 처럼 붙이면 어디서 왔는지 따로 세져요.

## 무료 요금제로 운영하기
- Supabase 무료 프로젝트는 1주일 동안 활동이 없으면 멈춰요. `vercel.json` 의 Cron 이 하루 한 번 `/api/ping` 을 불러 깨워 둬요.
- 사진은 긴 쪽 1024px, 한 장 약 150KB 이하로 줄여 올리고, 등불을 내리거나 사진을 바꾸면 예전 파일을 지워요.
- 대시보드의 Organization → Usage 에서 DB·저장소·내려받기 사용량을 가끔 확인해요.

## 의견 메일 받기 (선택)
"의견" 버튼으로 받은 말은 Supabase `feedback` 테이블에 쌓이고, 아래를 설정하면 메일로도 와요.
1. https://resend.com 에 가입하고 API 키를 만들어요.
2. Vercel 환경 변수에 넣어요.
   - `RESEND_API_KEY`: Resend API 키
   - `FEEDBACK_TO`: 의견을 받을 메일 주소 (도메인을 인증하기 전에는 Resend 가입 메일 주소만 받을 수 있어요)
   - `FEEDBACK_FROM` (선택): 보내는 주소. 도메인을 인증했다면 `기다림 항구 <hello@내도메인>`처럼 적어요

## 배포
Vercel 이나 Netlify 에 저장소를 연결하고, 환경 변수 두 개(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)만 넣으면 돼요.

## 다음에 해볼 것
- 공유 카드: 내 등불을 이미지로 저장해서 인스타 스토리에 올리기
- 돌아오는 날 알림, 매일 한 줄 남기라는 알림 (PWA 푸시)
- 신고와 차단, 금칙어 필터
- 등불이 많아지면 온기 개수를 DB 뷰로 집계
- 등불이 수백 개가 되면 장소가 비좁아져요. 장소를 넓히거나 새 장소를 여는 방법이 필요해요.
- 3D 번들이 커요(약 790KB). 3D 부분을 나중에 불러오도록 나누면 첫 화면이 빨라져요.
- 지도에서 원하는 자리를 직접 골라 걸기, 내 캐릭터로 걸어 다니기
