-- ============================================================
-- 예약 테이블에 모의(mock) 문자 발송 기록 컬럼 추가
-- 실제 발송 없이, 발송 내용/상태/시각을 기록한다.
-- 나중에 실제 SMS 사업자로 교체해도 동일한 컬럼을 재사용한다.
-- ============================================================

alter table public.reservations
  add column if not exists sms_status  text,          -- 예: mock_sent, sent, failed
  add column if not exists sms_message text,          -- 실제 보낸(또는 보낼) 문자 본문
  add column if not exists sms_sent_at timestamptz;   -- 발송 시각
