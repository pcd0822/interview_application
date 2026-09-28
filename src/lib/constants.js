// 교시 기본값 — 평일·주말·공휴일 동일
export const PERIODS = [
  { id: 'p1', label: '1교시', time: '08:40~09:30' },
  { id: 'p2', label: '2교시', time: '09:40~10:30' },
  { id: 'p3', label: '3교시', time: '10:40~11:30' },
  { id: 'p4', label: '4교시', time: '11:40~12:30' },
  { id: 'lunch', label: '점심시간', time: '13:00~13:30' },
  { id: 'p5', label: '5교시', time: '13:30~14:20' },
  { id: 'p6', label: '6교시', time: '14:30~15:20' },
  { id: 'p7', label: '7교시', time: '15:40~16:30' },
  { id: 'after1', label: '방과후1', time: '16:40~17:30' },
  { id: 'after2', label: '방과후2', time: '17:40~18:30' },
];
export const PERIOD_MAP = Object.fromEntries(PERIODS.map((p) => [p.id, p]));
export const PERIOD_IDS = PERIODS.map((p) => p.id);

export const BOOKING_STATUS = {
  before: { label: '시작전', tone: 'gray' },
  inProgress: { label: '진행중', tone: 'amber' },
  done: { label: '완료', tone: 'green' },
};

export const STUDENT_STATUS = {
  unregistered: { label: '미가입', tone: 'gray' },
  pending: { label: '대기', tone: 'amber' },
  approved: { label: '승인', tone: 'green' },
  rejected: { label: '반려', tone: 'red' },
};

// 학생 가상 이메일 도메인 (학생에게 절대 노출하지 않음)
export const STUDENT_EMAIL_DOMAIN = 'student.mockinterview.local';
export const studentEmail = (studentId) => `${studentId}@${STUDENT_EMAIL_DOMAIN}`;

// 학생 신청 제한
export const MIN_LEAD_DAYS = 3; // today + 3 이상
export const MAX_BOOKINGS_PER_DAY = 2;
export const REQUESTS_MAX_LEN = 500;
export const PASSWORD_MIN_LEN = 8;

export const SCHOOL_NAME = '속초여자고등학교';
export const SCHOOL_SHORT = '속초여고';

export const CONSENT_TEXT = {
  title: '개인정보 수집·이용 동의',
  intro: `${SCHOOL_NAME} 모의면접 프로그램 운영을 위해 아래와 같이 개인정보를 수집·이용합니다.`,
  items: [
    '수집 항목: 학번, 이름, 이메일 주소, 희망 대학·전형, 모의면접 신청 내역 및 피드백 내용',
    '수집·이용 목적: 모의면접 일정 신청·관리, 면접 결과 피드백 제공, 승인·일정 변경·피드백 등록 안내 메일 발송, 운영일지 작성',
    '보유·이용 기간: 해당 학년도 종료 시까지 보유하며, 목적 달성 후 지체 없이 파기합니다.',
    '동의를 거부할 권리가 있으며, 거부 시 모의면접 프로그램 신청 서비스 이용이 제한됩니다.',
    '수집된 정보는 담당 교사 외 다른 학생에게 공개되지 않습니다.',
  ],
  check: '위 내용을 확인하였으며 개인정보 수집·이용에 동의합니다.',
};

// 메일 템플릿 기본값 (교사가 설정 모달에서 수정). functions/index.js 에도 동일 기본값 존재.
export const DEFAULT_MAIL_TEMPLATES = {
  approve: {
    subject: '[모의면접] [학생이름] 학생 가입이 승인되었습니다',
    body: '[학생이름] 학생, 모의면접 신청 시스템 가입이 승인되었습니다.\n이제 학번과 비밀번호로 로그인하여 모의면접을 신청할 수 있습니다.',
  },
  reject: {
    subject: '[모의면접] [학생이름] 학생 가입 신청 결과 안내',
    body: '[학생이름] 학생, 모의면접 신청 시스템 가입 신청이 반려되었습니다.\n자세한 사항은 담당 선생님께 문의해 주세요.',
  },
  scheduleChanged: {
    subject: '[모의면접] 면접 일정이 변경되었습니다',
    body: '[학생이름] 학생, 모의면접 일정이 변경되었습니다.\n\n[변경내역]\n\n변경된 일정: [날짜] [교시]',
  },
  scheduleDeleted: {
    subject: '[모의면접] 면접 신청이 취소되었습니다',
    body: '[학생이름] 학생, 아래 모의면접 신청이 취소되었습니다.\n\n[변경내역]\n\n필요하면 다시 신청해 주세요.',
  },
  feedbackDone: {
    subject: '[모의면접] 피드백이 등록되었습니다',
    body: '[학생이름] 학생, [날짜] [교시] 모의면접 피드백이 등록되었습니다.\n시스템에 로그인하여 「내 신청」에서 확인하세요.',
  },
};
export const MAIL_TEMPLATE_LABELS = {
  approve: '가입 승인',
  reject: '가입 반려',
  scheduleChanged: '일정 변경',
  scheduleDeleted: '일정 삭제',
  feedbackDone: '피드백 등록',
};
export const MAIL_PLACEHOLDERS = ['[학생이름]', '[날짜]', '[교시]', '[변경내역]'];
