import { createClient } from "@supabase/supabase-js";

// Supabase secret-key 클라이언트 (서버 전용).
// 신규 secret 키(sb_secret_...)를 우선 사용하고, 없으면 레거시
// service_role 키로 폴백한다.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export default async (req) => {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    return new Response(
      JSON.stringify({ error: "서버 환경 변수가 설정되지 않았습니다." }),
      { status: 500, headers: jsonHeaders }
    );
  }

  // --- 방명록 목록 조회 ---
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("guestbook")
      .select("id, nickname, message, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return new Response(
        JSON.stringify({ error: "방명록을 불러오지 못했습니다." }),
        { status: 500, headers: jsonHeaders }
      );
    }
    return new Response(JSON.stringify({ entries: data }), {
      status: 200,
      headers: jsonHeaders,
    });
  }

  // --- 방명록 작성 ---
  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "잘못된 요청 형식입니다." }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const nickname = String(body.nickname ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!nickname || !message) {
      return new Response(
        JSON.stringify({ error: "닉네임과 메시지를 모두 입력해 주세요." }),
        { status: 400, headers: jsonHeaders }
      );
    }
    if (nickname.length > 30 || message.length > 500) {
      return new Response(
        JSON.stringify({ error: "닉네임은 30자, 메시지는 500자 이내여야 합니다." }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const { data, error } = await supabase
      .from("guestbook")
      .insert({ nickname, message })
      .select("id, nickname, message, created_at")
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: "방명록 저장 중 오류가 발생했습니다." }),
        { status: 500, headers: jsonHeaders }
      );
    }
    return new Response(JSON.stringify({ ok: true, entry: data }), {
      status: 201,
      headers: jsonHeaders,
    });
  }

  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 405,
    headers: jsonHeaders,
  });
};
