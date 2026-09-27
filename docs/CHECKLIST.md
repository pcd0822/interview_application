# 구현 후 체크리스트 — 보안·규칙 검증 결과

검증 방법: `firestore.rules` / `storage.rules` / `functions/index.js` / 클라이언트 코드(`src/lib/api.js`) 대조 검토.
런타임 검증(에뮬레이터 `firebase emulators:start` + 규칙 단위 테스트)은 배포 전 실행을 권장합니다. 아래 "확인 필요" 항목은 실제 프로젝트에서 한 번 눌러 보면서 확인하세요.

## 1. 학생 간 정보 노출 경로

| 경로 | 결과 | 근거 |
|---|---|---|
| 다른 학생의 `students` 문서 읽기 | 차단 | `students/{id}` read: 교사 또는 `resource.data.authUid == request.auth.uid` |
| `students` 컬렉션 목록 쿼리 | 차단 | 위 규칙상 학생은 쿼리 제약 없이 컬렉션을 읽을 수 없음(규칙이 `authUid`를 요구) |
| 다른 학생의 `bookings` 읽기 | 차단 | read: `resource == null || resource.data.studentId == sid()`. 존재하는 타인 문서는 permission-denied. 존재하지 않는 문서는 데이터 없음 |
| 존재 여부로 슬롯 점유 추론 | 허용(의도) | 슬롯 점유 여부는 이미 `slotStatus`로 공개되는 정보이며 학번·이름 등은 포함되지 않음 |
| 캘린더 「예약완료」 표시 | 학생 정보 없음 | `slotStatus/{date}.taken = [periodId]`만 사용, `syncSlotStatus` 트리거가 갱신 |
| 다른 학생의 `feedbacks` | 차단 | read: `resource.data.studentId == sid()` |
| `memos` | 학생 접근 불가, 교사도 작성자만 | read/write: `teacherUid == request.auth.uid` |
| `studentDailyCounts` | 자기 것만 | 문서 ID가 `{date}_{sid}` 패턴과 일치할 때만 |
| `settings/teacherKey` | 클라이언트 읽기 전면 차단 | `allow read: if false`, Function으로만 대조 |
| `teachers` 생성으로 교사 사칭 | 차단 | 클라이언트 write 금지, `registerTeacher`가 인증키 검증 후 Admin SDK로 생성. 학생 claim 계정은 거부 |
| Storage 피드백 파일 | 교사 + 해당 학생만 | 경로 `feedbacks/{bookingId}/{studentId}/{file}`. 교사는 claim `role == 'teacher'`, 학생은 claim `studentId == 경로의 studentId`. Firestore 조회 없음(교차 서비스 권한 불필요) |
| 학생 화면 UI | 타인 정보 없음 | S5 슬롯: 「예약완료」 배지만, S7/S8: 본인 데이터 쿼리(`where studentId == 본인`) |
| 가상 이메일 노출 | 없음 | 로그인·가입 화면에서 학번만 입력, 오류 메시지도 이메일 미포함 |
| 가입 시 학번 존재 여부 탐색 | 완화 | 미등록·이름 불일치 모두 같은 메시지 반환 |

## 2. 신청 규칙의 서버 측 강제

| 규칙 | 클라이언트 | 서버(규칙/트랜잭션) | 결과 |
|---|---|---|---|
| 슬롯 중복 예약 차단 | 트랜잭션에서 `bookings/{date}_{periodId}` 존재 시 중단 | 문서 ID 고정(`bookingId == date + '_' + periodId`) + 트랜잭션 낙관적 잠금. 동시 생성은 하나만 성공 | **강제됨** |
| 교사가 연 교시만 | 캘린더에 미개방 교시 미표시 | 규칙 `periodId in availability/{date}.openPeriods` | **강제됨** |
| 3일 규칙(today+3 이상) | 이전 날짜 회색 비활성 | 규칙: `dateTs`(UTC 자정, 문자열 `date`와 일치 검증) `>= request.time + 57h` ⇔ KST 기준 `date >= today + 3` (자정 정각 1초 오차 허용) | **강제됨** — 확인 필요: 에뮬레이터에서 today+2 거부 / today+3 허용 |
| 하루 최대 2건 | 같은 날 내 신청 2건이면 3번째 차단 | 트랜잭션에서 `studentDailyCounts/{date}_{sid}` +1, 규칙 `getAfter(counter).count == 이전 + 1 && <= 2`. 카운터 문서는 학생이 증가만 가능 | **강제됨** |
| 본인 명의로만 신청 | — | `studentId == token.studentId`, `studentName == students/{sid}.name`, status `before` 고정 | **강제됨** |
| 승인된 학생만 | pending/rejected는 로그인 즉시 로그아웃 | 규칙 `students/{sid}.status == 'approved' && authUid == uid` | **강제됨** |
| 학생의 취소·변경 불가 | 버튼 없음 + 안내 문구 | `bookings` update/delete는 교사만 | **강제됨** |
| 요청사항 500자, 필수값 | 폼 검증 | 규칙에서 길이·필수 검사 | **강제됨** |
| 교사 직접 등록 시 제한 미적용 | 경고만 표시 | 교사는 규칙 제한 없음(카운터도 함께 증감하여 학생 제한과 정합) | 의도대로 |

## 3. 운영 시 확인 필요 (배포 후 1회)

- [ ] `settings/teacherKey` = `1113` 등록 후 교사 최초 로그인 → `teachers/{uid}` 생성 확인
- [ ] 학생 가입 → pending 상태에서 로그인 시 「가입 승인 대기 중」 화면 + 자동 로그아웃
- [ ] 승인 메일 수신(GAS `MAIL_TOKEN` = Functions Secret `GAS_MAIL_TOKEN`) / 실패 시 `mailLogs` 기록 + 토스트
- [ ] 학생 두 명이 같은 슬롯 동시 신청 → 한 명만 성공, 다른 한 명은 「방금 다른 학생이 신청했어요」
- [ ] today+2 날짜 신청 시도(개발자도구로 강제) → permission-denied
- [ ] 같은 날 3번째 신청 강제 시도 → permission-denied
- [ ] 비밀번호 초기화 → 임시 비밀번호(학번, 6자 미만이면 0 패딩)로 로그인 → 새 비밀번호 강제
- [ ] 피드백 저장 → 상태 「완료」, 학생 화면 PDF 다운로드(MD 변환 / PDF 원본)
- [ ] 운영일지 xlsx: 제목 병합·헤더 서식·내용요약 줄바꿈 확인
- [ ] 전체 명단 초기화 후 xlsx 재등록

## 4. 요구사항 대비 설계상 결정 사항

- GAS URL/토큰은 `VITE_` 환경변수가 아니라 **Cloud Functions 파라미터/Secret**에 보관(클라이언트 번들 노출 방지). 메일 경로는 요구사항대로 React → Function → GAS.
- 운영일지 서식(병합·굵게·테두리·열 너비)은 SheetJS 무료판이 지원하지 않아 **ExcelJS**로 생성. 명단 양식/업로드는 SheetJS 사용.
- md 파일 업로드 시 본문 텍스트를 `feedbacks.contentMd`에도 저장 → 학생 화면에서 Storage CORS 설정 없이 렌더링·PDF 변환 가능.
- 비밀번호 초기화: Firebase Auth 최소 6자 제한 때문에 학번이 6자 미만이면 뒤에 `0`을 채운 값이 임시 비밀번호(모달·토스트에 안내).
- 학생의 「예약완료」 표시용 `slotStatus` 컬렉션과 하루 2건 카운터 `studentDailyCounts` 컬렉션을 데이터 모델에 추가.
- `feedbacks`에 `interviewDateIso`(YYYY-MM-DD)를 추가 저장하여 일지 기간 조회에 사용.
