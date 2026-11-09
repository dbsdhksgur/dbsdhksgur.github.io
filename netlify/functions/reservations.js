import { createClient } from "@supabase/supabase-js";
import { buildReservationMessage, sendSms } from "./lib/sms.js";

// Supabase secret-key 클라이언트 (서버 전용).
// 신규 키 체계의 secret 키(sb_secret_...)를 우선 사용하고,
// 없으면 레거시 service_role 키로 폴백한다. 이 키는 Netlify
// 환경 변수에만 존재하며 브라우저로 전달되지 않는다.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    return new Response(
      JSON.stringify({ error: "서버 환경 변수가 설정되지 않았습니다." }),
      { status: 500, headers: jsonHeaders }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "잘못된 요청 형식입니다." }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  // 입력 정리 + 검증
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const session = String(body.session ?? "").trim();
  const partySize = Number.parseInt(body.party_size, 10);

  if (!name || !phone || !session) {
    return new Response(
      JSON.stringify({ error: "성함, 연락처, 세션은 필수입니다." }),
      { status: 400, headers: jsonHeaders }
    );
  }
  if (name.length > 50 || phone.length > 30 || session.length > 120) {
    return new Response(JSON.stringify({ error: "입력값이 너무 깁니다." }), {
      status: 400,
      headers: jsonHeaders,
    });
  }
  const safePartySize =
    Number.isFinite(partySize) && partySize >= 1 && partySize <= 10
      ? partySize
      : 1;

  // 1) 예약 저장 (저장된 행을 돌려받아 id 확보)
  const { data: reservation, error } = await supabase
    .from("reservations")
    .insert({
      name,
      phone,
      session,
      party_size: safePartySize,
    })
    .select("id, name, phone, session, party_size, created_at")
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: "예약 저장 중 오류가 발생했습니다." }),
      { status: 500, headers: jsonHeaders }
    );
  }

  // 2) 모의 문자 발송 — 저장된 전화번호로 안내 문자를 "발송"한다.
  //    발송이 실패해도 예약 자체는 이미 접수된 것이므로 흐름을 막지 않는다.
  const smsMessage = buildReservationMessage({
    name,
    session,
    partySize: safePartySize,
  });

  let sms;
  try {
    sms = await sendSms({ to: phone, message: smsMessage });
  } catch {
    sms = { status: "failed", message: smsMessage, sentAt: new Date().toISOString() };
  }

  // 3) 발송 결과를 예약 행에 기록 (실패해도 응답은 성공 처리)
  await supabase
    .from("reservations")
    .update({
      sms_status: sms.status,
      sms_message: sms.message,
      sms_sent_at: sms.sentAt,
    })
    .eq("id", reservation.id);

  // 4) 사이트가 "예약 성사 + 발송된 문자"를 표시할 수 있도록 응답에 담아준다.
  return new Response(
    JSON.stringify({
      ok: true,
      reservation: {
        id: reservation.id,
        name: reservation.name,
        session: reservation.session,
        party_size: reservation.party_size,
        created_at: reservation.created_at,
      },
      sms: {
        status: sms.status,
        message: sms.message,
        sent_at: sms.sentAt,
      },
    }),
    { status: 201, headers: jsonHeaders }
  );
};
