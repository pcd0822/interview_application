# Stitch 디자인 프로젝트

- 프로젝트: **모의면접 신청 시스템** — `projects/9988999818460870027`
  - Stitch 웹: https://stitch.withgoogle.com/projects/9988999818460870027
- 디자인 시스템: 「모의면접 화이트+블루」 `assets/14262917847886028732`
  (Primary #2563EB, 배경 #EFF4FF, 텍스트 #111827, 보조 #6B7280, 테두리 #E5E7EB, 라운드 12~16px, Noto Sans(코드는 Pretendard 우선))
- React 컴포넌트는 아래 화면 이름과 1:1로 대응합니다. 디자인 수정은 Stitch에서 같은 화면 이름으로 진행하세요.

| Stitch 화면 이름 | React 파일 | 기기 | 상태 | 스크린 리소스 |
|---|---|---|---|---|
| S1 로그인 선택 | `src/pages/student/LoginSelect.jsx` | MOBILE | 생성됨 | `screens/77ebe19f3f144995a6ef86580c9ea104` |
| S2 학생 회원가입 | `src/pages/student/StudentSignup.jsx` | MOBILE | 생성됨 | `screens/5045ca75789e48a3a3e91b651aefe8f2` |
| S3 학생 로그인 | `src/pages/student/StudentLogin.jsx` | MOBILE | 생성됨 | `screens/55d7422b982c4990a1aa148c61a784fb` |
| S4 승인 대기 안내 | `src/pages/student/PendingNotice.jsx` | MOBILE | 생성됨 | `screens/857b2c69990541c5b5bc3fbab7397b48` |
| S5 학생 신청 캘린더 | `src/pages/student/StudentCalendar.jsx` | MOBILE | 생성됨 | `screens/569f7901f8ab46659ce7154bf076c5b6` |
| S6 신청 폼 시트 | `src/pages/student/StudentCalendar.jsx` (BookingFormSheet) | MOBILE | 생성됨 | `screens/37591de16e544cd499dc04466bc137b5` |
| S7 내 신청 목록 | `src/pages/student/MyBookings.jsx` | MOBILE | 생성됨 | `screens/e621c87de2a44916a714548f0219aaa9` |
| S8 피드백 상세 | `src/pages/student/FeedbackDetail.jsx` | MOBILE | 생성됨(캔버스에서 확인, MCP 응답 타임아웃으로 리소스 ID 미수집) | - |
| T1 교사 인증키 | `src/pages/teacher/TeacherKey.jsx` | DESKTOP | 생성됨 | `screens/7c34fc48cf944cd2b5d7b50f5e2909f6` |
| T2 교사 대시보드 레이아웃 | `src/pages/teacher/TeacherLayout.jsx`, `Dashboard.jsx` | DESKTOP | 생성됨(제목 "T2 교사 대시보드") | `screens/63315eab1ba747bf93016442ceca2f13` |
| T3 학생관리 | `src/pages/teacher/StudentsPage.jsx` | DESKTOP | 생성됨(캔버스에서 확인, MCP 응답 타임아웃으로 리소스 ID 미수집) | - |
| T4 일정관리-시간 설정 | `src/pages/teacher/SchedulePage.jsx` (AvailabilityTab) | DESKTOP | 생성됨(캔버스에서 확인, MCP 응답 타임아웃으로 리소스 ID 미수집) | - |
| T5 일정관리-캘린더 뷰+패널 | `src/pages/teacher/SchedulePage.jsx` (BookingsTab) | DESKTOP | 생성됨(캔버스에서 확인, MCP 응답 타임아웃으로 리소스 ID 미수집) | - |
| T6 일정관리-테이블 뷰 | `src/pages/teacher/SchedulePage.jsx` (BookingsTab, view=table) | DESKTOP | 생성됨(캔버스에서 확인, MCP 응답 타임아웃으로 리소스 ID 미수집) | - |
| T7 모의면접 | `src/pages/teacher/InterviewPage.jsx` | DESKTOP | 생성됨(캔버스에서 확인, MCP 응답 타임아웃으로 리소스 ID 미수집) | - |
| T8 일지관리 | `src/pages/teacher/LogPage.jsx` | DESKTOP | 생성됨(캔버스에서 확인, MCP 응답 타임아웃으로 리소스 ID 미수집) | - |
| T9 설정 모달 | `src/pages/teacher/SettingsModal.jsx` | DESKTOP | 생성됨 | `screens/8c66512dc6d74a3cbb87e5cef4990725` |

## 메모

- Stitch MCP의 `generate_screen_from_text`는 데스크톱 화면에서 클라이언트 타임아웃이 잦습니다. 타임아웃이 나도 서버 생성은 계속되는 경우가 많으므로 **재생성하지 말고** 10~20분 뒤 Stitch 웹 UI 또는 `list_screens`로 반영 여부를 확인하세요. 없을 때만 다시 생성합니다.
- `list_screens` 목록은 실제보다 10~25분 늦게 갱신됩니다. 개별 화면은 `get_screen`으로 즉시 조회됩니다.
- 화면 HTML(`htmlCode.downloadUrl`)과 스크린샷(`screenshot.downloadUrl`)은 `get_screen` 응답에 포함됩니다.
- 코드 쪽 색·간격 토큰은 `src/styles/global.css`의 `:root` 변수로 관리합니다. Stitch에서 디자인 시스템을 바꾸면 이 변수만 맞추면 됩니다.
