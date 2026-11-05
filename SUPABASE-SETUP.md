# Supabase 연동 가이드 (길 B — CLI + 마이그레이션)

이 리포는 **Netlify Functions(옵션 B)** 를 통해 Supabase에 데이터를 저장합니다.
DB 스키마는 `supabase/migrations/` 에 SQL 마이그레이션으로 **git 버전 관리**됩니다.

```
[브라우저]  예약폼 / 방명록
     │  fetch POST
     ▼
[Netlify Function]  /.netlify/functions/reservations, /guestbook
     │  secret 키 (환경변수, 서버에만 존재)
     ▼
[Supabase]  reservations / guestbook 테이블 (RLS ON)
```

## 리포에 이미 세팅된 것

| 경로 | 내용 |
|------|------|
| `supabase/config.toml` | Supabase CLI 프로젝트 설정 (`project_id` 포함) |
| `supabase/migrations/*_init_reservations_guestbook.sql` | 초기 스키마(테이블 + RLS) |
| `netlify/functions/reservations.js` | 예약 저장 함수 |
| `netlify/functions/guestbook.js` | 방명록 작성/조회 함수 |
| `netlify.toml` | functions 디렉터리 + Node 22 빌드 환경 |
| `.env.example` | 환경변수 템플릿 |

CLI는 **프로젝트 dev 의존성**으로 설치돼 있습니다(글로벌 npm 설치는 더 이상 지원 안 됨).
모든 명령은 `npx supabase ...` 또는 `npm run sb:*` 로 실행합니다.

## 한 번만 하는 설정

### 1. 원격 Supabase 프로젝트 생성
[supabase.com/dashboard](https://supabase.com/dashboard) → GitHub 로그인 → **New project**
(Region은 `Northeast Asia (Seoul)` 권장). DB 비밀번호는 안전히 보관하세요.

### 2. CLI 로그인 (브라우저 토큰 인증 — 터미널에서 직접)
```bash
npm run sb:login        # = npx supabase login
```

### 3. 리포를 원격 프로젝트에 연결
```bash
npx supabase link --project-ref <YOUR_PROJECT_REF>
```
`<YOUR_PROJECT_REF>` 는 대시보드 프로젝트 URL `https://supabase.com/dashboard/project/<REF>` 의 `<REF>`
또는 Settings > General 의 Reference ID 입니다.

### 4. 스키마를 원격에 반영
```bash
npm run sb:db:push      # = npx supabase db push
```
`supabase/migrations/` 의 SQL이 원격 DB에 적용됩니다(테이블 + RLS 생성).

### 5. 키 확보 후 Netlify 환경변수 등록
대시보드 **Settings > API Keys** 에서:
- **Project URL** → Netlify 환경변수 `SUPABASE_URL`
- **secret key**(`sb_secret_...`, 생성 필요) → Netlify 환경변수 `SUPABASE_SECRET_KEY`

> 신규 키 체계: `anon`/`service_role`(JWT, `eyJ...`)은 2026년 말 폐지 예정.
> 새 프로젝트는 `publishable`/`secret` 키 사용 권장. 함수는 `SUPABASE_SECRET_KEY`를
> 우선 읽고, 없으면 레거시 `SUPABASE_SERVICE_ROLE_KEY`로 폴백합니다.

### 6. 배포
```bash
git add .
git commit -m "Supabase 연동"
git push                # Netlify 자동 배포
```

## 이후 스키마를 바꿀 때

1. 새 마이그레이션 생성: `npm run sb:migration:new <이름>`
2. 생성된 `supabase/migrations/<timestamp>_<이름>.sql` 에 SQL 작성
3. 원격 반영: `npm run sb:db:push`
4. 커밋 → push

## 로컬 테스트 (선택)

- **함수 + 사이트 로컬 실행**: `npm run dev` (= `netlify dev`). 루트에 `.env`를 만들어
  `SUPABASE_URL`, `SUPABASE_SECRET_KEY`를 넣으면 로컬에서 원격 Supabase로 저장 테스트 가능.
- **로컬 Postgres 스택**(`supabase start`)은 Docker가 필요합니다. 스키마만 원격에
  push하는 경우에는 Docker 없이도 됩니다.
