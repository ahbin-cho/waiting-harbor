-- seed.sql 로 넣은 예시 데이터 지우기
-- 예시 사람(id 가 5eed0000- 으로 시작)을 지우면, 그 사람들의 등불·일기·남긴 말·온기가 함께 지워져요.
-- 진짜 사용자가 예시 등불에 보낸 온기와 남긴 말도 등불과 함께 지워져요.
delete from auth.users where id::text like '5eed0000-%';
