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

function json(data, status) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

// 예약 입력값 정리 + 검증. 유효하면 { value }, 아니면 { error } 반환.
function validateReservation(body) {
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const session = String(body.session ?? "").trim();
  const partySize = Number.parseInt(body.party_size, 10);

  if (!name || !phone || !session) {
    return { error: "성함, 연락처, 세션은 필수입니다." };
  }
  if (name.length > 50 || phone.length > 30 || session.length > 120) {
    return { error: "입력값이 너무 깁니다." };
  }
  const safePartySize =
    Number.isFinite(partySize) && partySize >= 1 && partySize <= 10
      ? partySize
      : 1;

  return { value: { name, phone, session, party_size: safePartySize } };
}

// 모의 문자 발송 + 예약 행에 발송 결과 기록.
async function sendAndRecordSms(reservation) {
  const smsMessage = buildReservationMessage({
    name: reservation.name,
    session: reservation.session,
    partySize: reservation.party_size,
  });

  let sms;
  try {
    sms = await sendSms({ to: reservation.phone, message: smsMessage });
  } catch {
    sms = { status: "failed", message: smsMessage, sentAt: new Date().toISOString() };
  }

  await supabase
    .from("reservations")
    .update({
      sms_status: sms.status,
      sms_message: sms.message,
      sms_sent_at: sms.sentAt,
    })
    .eq("id", reservation.id);

  return sms;
}

// 요청 body에서 예약 id를 안전하게 추출.
function parseId(body) {
  const id = Number.parseInt(body?.id, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default async (req) => {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    return json({ error: "서버 환경 변수가 설정되지 않았습니다." }, 500);
  }

  const method = req.method;

  // DELETE 외에는 JSON body 파싱
  let body = {};
  if (method === "POST" || method === "PUT" || method === "DELETE") {
    try {
      body = await req.json();
    } catch {
      // DELETE는 body가 없을 수도 있으므로, body 필수인 경우만 아래에서 검사
      body = {};
    }
  }

  // ===== 예약 생성 =====
  if (method === "POST") {
    const { value, error: vErr } = validateReservation(body);
    if (vErr) return json({ error: vErr }, 400);

    const { data: reservation, error } = await supabase
      .from("reservations")
      .insert(value)
      .select("id, name, phone, session, party_size, created_at")
      .single();

    if (error) return json({ error: "예약 저장 중 오류가 발생했습니다." }, 500);

    const sms = await sendAndRecordSms(reservation);

    return json(
      {
        ok: true,
        reservation: {
          id: reservation.id,
          name: reservation.name,
          session: reservation.session,
          party_size: reservation.party_size,
          created_at: reservation.created_at,
        },
        sms: { status: sms.status, message: sms.message, sent_at: sms.sentAt },
      },
      201
    );
  }

  // ===== 예약 수정 =====
  if (method === "PUT") {
    const id = parseId(body);
    if (!id) return json({ error: "수정할 예약 번호가 올바르지 않습니다." }, 400);

    const { value, error: vErr } = validateReservation(body);
    if (vErr) return json({ error: vErr }, 400);

    const { data: reservation, error } = await supabase
      .from("reservations")
      .update(value)
      .eq("id", id)
      .select("id, name, phone, session, party_size, created_at")
      .single();

    if (error || !reservation) {
      return json({ error: "예약 수정 중 오류가 발생했거나 예약을 찾을 수 없습니다." }, 404);
    }

    // 수정된 내용으로 다시 안내 문자 발송
    const sms = await sendAndRecordSms(reservation);

    return json(
      {
        ok: true,
        updated: true,
        reservation: {
          id: reservation.id,
          name: reservation.name,
          session: reservation.session,
          party_size: reservation.party_size,
          created_at: reservation.created_at,
        },
        sms: { status: sms.status, message: sms.message, sent_at: sms.sentAt },
      },
      200
    );
  }

  // ===== 예약 취소 =====
  if (method === "DELETE") {
    const id = parseId(body);
    if (!id) return json({ error: "취소할 예약 번호가 올바르지 않습니다." }, 400);

    const { data: deleted, error } = await supabase
      .from("reservations")
      .delete()
      .eq("id", id)
      .select("id")
      .single();

    if (error || !deleted) {
      return json({ error: "예약 취소 중 오류가 발생했거나 예약을 찾을 수 없습니다." }, 404);
    }

    return json({ ok: true, canceled: true, id: deleted.id }, 200);
  }

  return json({ error: "Method Not Allowed" }, 405);
};
