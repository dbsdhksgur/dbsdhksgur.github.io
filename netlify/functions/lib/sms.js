// ============================================================
// 문자 발송 어댑터
// ------------------------------------------------------------
// 현재는 모의(mock) 구현: 실제 문자를 보내지 않고, 보낼 내용을
// 구성해 "발송한 것처럼" 결과를 돌려준다.
//
// 나중에 실제 SMS 사업자(Solapi, Twilio 등)로 바꾸려면
// sendSms() 내부만 교체하면 된다. 호출부(reservations.js)는
// 그대로 둬도 동작하도록 반환 형태를 고정해 둔다.
//
//   입력:  { to: 전화번호, message: 본문 }
//   반환:  { status: "mock_sent" | "sent" | "failed",
//           provider: "mock",
//           message: 본문,
//           sentAt: ISO 문자열,
//           providerMessageId?: string }
// ============================================================

/**
 * 예약 접수 안내 문자 본문을 생성한다.
 */
export function buildReservationMessage({ name, session, partySize }) {
  return (
    `[CANVAS & GLASS] ${name}님, 예약이 접수되었습니다.\n` +
    `· 세션: ${session}\n` +
    `· 인원: ${partySize}명\n` +
    `안내 문자가 곧 발송됩니다. 감사합니다.`
  );
}

/**
 * 문자 발송(모의). 전화번호를 간단히 마스킹해 로그에 남긴다.
 */
export async function sendSms({ to, message }) {
  const sentAt = new Date().toISOString();

  // 서버 로그용 전화번호 마스킹 (가운데 자리 가림)
  const masked = String(to).replace(/(\d{2,3})[- ]?\d{3,4}[- ]?(\d{4})/, "$1-****-$2");

  // 실제 사업자 연동 시 이 블록을 fetch(providerApiUrl, ...) 로 교체.
  console.log(`[MOCK SMS] to=${masked} :: ${message.replace(/\n/g, " / ")}`);

  return {
    status: "mock_sent",
    provider: "mock",
    message,
    sentAt,
    providerMessageId: `mock_${Date.now()}`,
  };
}
