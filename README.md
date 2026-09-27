# 모의면접 신청·피드백·운영일지 시스템 (속초여자고등학교)

학생이 모의면접 일정을 신청하고, 교사가 면접을 진행·피드백을 남기며, 운영일지를 xlsx로 내보내는 웹 애플리케이션입니다.

- 프론트엔드: React 18 (Vite) + React Router + Zustand
- 백엔드: Firebase (Auth · Firestore · Storage · Cloud Functions v2, Blaze 플랜)
- 메일: Google Apps Script 웹앱(`gas/Code.gs`) → `GmailApp.sendEmail`
- 배포: GitHub → Netlify (SPA `_redirects` 포함)
- 디자인: Stitch 프로젝트 「모의면접 신청 시스템」 (`docs/STITCH.md`)

---

## 1. 폴더 구조

```
├─ src/
│  ├─ App.jsx                 라우팅·권한 가드
│  ├─ lib/
│  │  ├─ firebase.js          Firebase 초기화, callable 헬퍼, 오류 메시지
│  │  ├─ api.js               Firestore/Storage 데이터 계층 (트랜잭션 포함)
│  │  ├─ constants.js         교시표·상태·동의 문구·메일 템플릿 기본값
│  │  ├─ date.js              2026.09.24.(목) 포맷 등 날짜 유틸
│  │  ├─ pdf.js               MD → PDF(A4, 20mm, Pretendard)
│  │  └─ excel.js             명단 양식/업로드(SheetJS), 운영일지(ExcelJS)
│  ├─ store/                  auth(zustand), toast
│  ├─ components/common/      StatusBadge, Modal, Sheet, MonthCalendar, Markdown …
│  ├─ pages/student/          S1~S8 학생 화면 (모바일 우선, 최대 640px)
│  └─ pages/teacher/          T1~T9 교사 화면 (사이드바 240/64px, 패널 420px)
├─ functions/index.js         Cloud Functions (registerStudent, verifyTeacherKey, registerTeacher,
│                             resetStudentPassword, rejectStudent, deleteStudent, purgeStudents,
│                             sendMail, syncSlotStatus 트리거)
├─ gas/Code.gs                메일 발송 GAS 웹앱
├─ firestore.rules / storage.rules / firestore.indexes.json / firebase.json
├─ public/_redirects, netlify.toml
└─ docs/CHECKLIST.md          보안·규칙 검증 체크리스트
```

## 2. 데이터 모델 요약

| 컬렉션 | 문서 ID | 비고 |
|---|---|---|
| `settings/teacherKey` | 고정 | `{ key }` — 클라이언트 읽기 불가, Function으로만 검증 |
| `settings/mailTemplates` | 고정 | approve / reject / scheduleChanged / scheduleDeleted / feedbackDone |
| `settings/academicYear` | 고정 | `{ year }` |
| `teachers/{uid}` | Auth uid | Function이 생성 (클라이언트 쓰기 불가) |
| `students/{studentId}` | 학번 | status: unregistered / pending / approved / rejected |
| `availability/{YYYY-MM-DD}` | 날짜 | `openPeriods: [periodId]` — 없거나 비면 전부 신청 불가 |
| `bookings/{YYYY-MM-DD}_{periodId}` | 날짜_교시 | 문서 ID로 슬롯 중복을 물리적으로 차단. `dateTs`(UTC 자정) 포함 |
| `slotStatus/{YYYY-MM-DD}` | 날짜 | `taken: [periodId]` — 학생 캘린더 「예약완료」 표시용, **학생 정보 없음** (트리거가 갱신) |
| `studentDailyCounts/{date}_{studentId}` | | 하루 2건 제한 카운터 (트랜잭션 + 규칙 `getAfter`로 강제) |
| `memos/{bookingId}_{teacherUid}` | | 작성 교사만 읽기/쓰기 |
| `feedbacks/{bookingId}` | | 교사 공유, 해당 학생만 읽기. `interviewDateIso` 추가(기간 조회용) |
| `mailLogs/{autoId}` | | 발송 성공/실패 기록 (Function이 기록) |

교시(periodId): p1~p4, lunch, p5~p7, after1, after2 — `src/lib/constants.js`.

## 3. Firebase 콘솔 설정 순서

1. **프로젝트 생성** → Blaze 요금제로 업그레이드(Functions 필요).
2. **Authentication → 로그인 방법**
   - `이메일/비밀번호` 사용 설정 (학생용. 가상 주소 `{학번}@student.mockinterview.local`, 학생에게 노출 안 함)
   - `Google` 사용 설정 (교사용). 승인된 도메인에 Netlify 도메인 추가(Authentication → 설정 → 승인된 도메인).
3. **Firestore Database** 생성 (리전: `asia-northeast3` 권장, 프로덕션 모드).
4. **Storage** 사용 설정 (동일 리전).
5. **프로젝트 설정 → 내 앱 → 웹 앱 추가** → 설정값을 `.env`에 입력 (`.env.example` 참고).
6. 로컬에서 Firebase CLI 로그인 후 배포
   ```bash
   npm i -g firebase-tools
   firebase login
   cp .firebaserc.example .firebaserc      # 프로젝트 ID 입력
   cd functions && npm install && cd ..
   cp functions/.env.example functions/.env  # GAS_MAIL_URL 입력
   firebase functions:secrets:set GAS_MAIL_TOKEN   # GAS 스크립트 속성 MAIL_TOKEN 과 동일 값
   firebase deploy --only firestore:rules,firestore:indexes,storage,functions
   ```
7. **초기 데이터 등록** (Firestore 콘솔에서 직접 추가)
   - `settings/teacherKey` → 필드 `key` (string) = `1113`
   - (선택) `settings/academicYear` → `year` (number) = `2026` — 없으면 현재 연도 사용
   - (선택) `settings/mailTemplates` — 없으면 자리표시자가 포함된 기본 문구 사용. 교사 대시보드 「설정」에서 편집 가능
8. **Storage CORS** (학생이 업로드된 PDF를 "다운로드"로 받게 하려면 필요, 없으면 새 탭으로 열림)
   ```bash
   # cors.json: [{"origin":["https://<netlify-domain>"],"method":["GET"],"maxAgeSeconds":3600}]
   gsutil cors set cors.json gs://<project>.firebasestorage.app
   ```

## 4. GAS 메일 웹앱 배포

`gas/Code.gs` 상단 주석 참고. 요약: 새 Apps Script 프로젝트 → 코드 붙여넣기 → 스크립트 속성 `MAIL_TOKEN` 설정 → 웹 앱 배포(실행: 나, 액세스: 모든 사용자) → `…/exec` URL을 `functions/.env`의 `GAS_MAIL_URL`에 입력 → Functions 재배포.
Gmail 일일 발송 한도(일반 계정 100통/일, Workspace 1,500통/일)에 유의하세요.

## 5. 로컬 개발

```bash
npm install
cp .env.example .env     # Firebase 값 입력
npm run dev              # http://localhost:5173
```
에뮬레이터를 쓰려면 `.env`에 `VITE_USE_EMULATORS=true`, 그리고 `firebase emulators:start`.

## 6. Netlify 배포

1. GitHub 저장소에 커밋·푸시.
2. Netlify → Add new site → Import from Git → 저장소 선택. 빌드 명령 `npm run build`, 게시 디렉터리 `dist` (`netlify.toml`에 정의됨).
3. Site settings → Environment variables에 `.env.example`의 `VITE_*` 값 등록.
4. 배포 후 도메인을 Firebase Authentication 승인된 도메인에 추가.

> GAS URL·토큰은 **Cloud Functions 파라미터/Secret**에만 둡니다. `VITE_` 변수는 번들에 노출되므로 토큰을 넣지 않습니다. (요구사항의 "VITE_…로 관리"는 Firebase 설정값에만 적용하고, 메일 토큰은 서버 측으로 옮겼습니다.)

## 7. 운영 흐름

1. 교사: 인증키 `1113` + Google 로그인 → 학생관리에서 xlsx 명단 등록(양식 다운로드 제공: 1행 헤더 `학번, 이름, 희망계열, 희망전형`).
2. 학생: 회원가입(학번·이름 일치 검증, 개인정보 동의) → 교사 승인 → 로그인 → 캘린더에서 신청(오늘+3일 이후, 하루 2건).
3. 교사: 일정관리에서 신청 가능 교시 저장 / 신청 조회·수정·삭제(이메일 안내) / 「면접 진행하기」.
4. 교사: 모의면접에서 메모(본인 전용, 임시 저장 시 진행중) → 피드백 저장(완료, 이메일 안내).
5. 학생: 내 신청 → 완료 건 피드백 열람 → PDF 다운로드.
6. 교사: 일지관리에서 이름 입력 후 조회 → `{학년도}학년도_모의면접_운영일지_속초여고.xlsx`.
7. 학년도 전환: 학생관리 「전체 명단 초기화」(「삭제」 입력 확인) → xlsx 재등록.

## 8. 학생 명단 xlsx 양식

| 학번 | 이름 | 희망계열 | 희망전형 |
|---|---|---|---|
| 20301 | 홍길동 | 인문 | 학생부종합 |

- 1행은 헤더, 2행부터 데이터. 학번은 문자열 그대로 문서 ID가 됩니다.
- 중복 학번은 건너뛰고 결과(등록/중복/오류 건수)를 표시합니다.

## 9. 보안 요약

- 교사 판정: `teachers/{uid}` 존재. 이 문서는 `registerTeacher` Function(인증키 검증)만 생성.
- 학생 판정: `registerStudent`가 부여한 custom claim `studentId`. 규칙에서 `students/{sid}.authUid == uid && status == approved` 재확인.
- 학생은 자기 `students`, `bookings`, `feedbacks`, `studentDailyCounts` 문서만 읽음. 다른 학생 정보를 담은 컬렉션은 읽을 수 없고, 캘린더의 예약완료 표시는 학생 정보가 없는 `slotStatus`만 사용.
- 슬롯 중복: 문서 ID `{date}_{periodId}` + 트랜잭션. 3일 규칙: 규칙에서 `dateTs`(UTC 자정) ≥ `request.time + 57h`. 하루 2건: 트랜잭션 안에서 카운터 +1, 규칙 `getAfter`로 `≤ 2` 검증.
- 자세한 검증 결과는 `docs/CHECKLIST.md`.
