-- ============================================================
-- CANVAS & GLASS — 초기 스키마 마이그레이션
-- 예약(reservations) + 방명록(guestbook) 테이블과 RLS 설정.
-- 이 파일은 supabase db push 로 원격 프로젝트에 적용된다.
-- ============================================================

-- ------------------------------------------------------------
-- 1) 예약 테이블 (reservations)
-- ------------------------------------------------------------
create table if not exists public.reservations (
  id          bigint generated always as identity primary key,
  name        text        not null,
  phone       text        not null,
  session     text        not null,
  party_size  int         not null default 1,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2) 방명록 테이블 (guestbook)
-- ------------------------------------------------------------
create table if not exists public.guestbook (
  id          bigint generated always as identity primary key,
  nickname    text        not null,
  message     text        not null,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3) RLS(행 수준 보안) 활성화
--    옵션 B 구조에서는 브라우저가 테이블에 직접 접근하지 않고,
--    secret 키(sb_secret_... / 레거시 service_role)를 쓰는
--    Netlify Function 만 접근한다. secret 키는 service_role 역할로
--    매핑되어 RLS 를 우회(BYPASSRLS)하므로, 아래처럼 RLS 를 켜고
--    anon/public 정책을 '만들지 않으면' 외부(브라우저, publishable
--    키)에서는 읽기/쓰기가 모두 차단된다. 이것이 가장 안전한 기본값이다.
-- ------------------------------------------------------------
alter table public.reservations enable row level security;
alter table public.guestbook    enable row level security;

-- (선택) 방명록 '목록 읽기'를 브라우저에서 publishable 키로도 허용하고
-- 싶다면 아래 주석을 해제하세요. RLS 정책은 anon / authenticated 역할에
-- 대해 작성합니다(secret 키에는 정책이 적용되지 않음).
-- 지금 구현은 함수(GET)로 읽으므로 불필요합니다.
-- create policy "guestbook public read"
--   on public.guestbook for select
--   to anon
--   using (true);
