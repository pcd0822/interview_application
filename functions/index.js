/**
 * Cloud Functions (v2, Node 20) — 모의면접 신청 시스템
 *
 * callable:
 *   registerStudent      학생 가입 검증 + Auth 계정 생성 + custom claim(studentId)
 *   verifyTeacherKey     교사 인증키 대조(키를 클라이언트에 노출하지 않음)
 *   registerTeacher      Google 로그인 후 teachers/{uid} 생성(키 재검증). 기존 교사는 키 없이 통과
 *   resetStudentPassword 학생 비밀번호를 학번으로 재설정 + mustChangePassword
 *   rejectStudent        가입 반려 + Auth 계정 삭제
 *   deleteStudent        학생 문서 + Auth 계정 (+ 선택: bookings/feedbacks/memos) 삭제
 *   purgeStudents        전체 명단 초기화(학년도 전환)
 *   sendMail             settings/mailTemplates 로 본문 생성 → GAS 웹앱으로 발송, mailLogs 기록
 * trigger:
 *   syncSlotStatus       bookings 변경 → slotStatus/{date}.taken 갱신(학생 캘린더의 예약완료 표시용, 학생 정보 없음)
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

const REGION = 'asia-northeast3';
setGlobalOptions({ region: REGION, maxInstances: 10 });

const GAS_MAIL_URL = defineString('GAS_MAIL_URL', { default: '' });
const GAS_MAIL_TOKEN = defineSecret('GAS_MAIL_TOKEN');

const STUDENT_EMAIL_DOMAIN = 'student.mockinterview.local';
const studentEmail = (id) => `${id}@${STUDENT_EMAIL_DOMAIN}`;
const PASSWORD_MIN_LEN = 8;
const PERIOD_IDS = ['p1', 'p2', 'p3', 'p4', 'lunch', 'p5', 'p6', 'p7', 'after1', 'after2'];

const DEFAULT_MAIL_TEMPLATES = {
  approve: { subject: '[모의면접] [학생이름] 학생 가입이 승인되었습니다', body: '[학생이름] 학생, 모의면접 신청 시스템 가입이 승인되었습니다.\n이제 학번과 비밀번호로 로그인하여 모의면접을 신청할 수 있습니다.\n\n(임시 문구입니다. 설정에서 수정하세요.)' },
  reject: { subject: '[모의면접] [학생이름] 학생 가입 신청 결과 안내', body: '[학생이름] 학생, 모의면접 신청 시스템 가입 신청이 반려되었습니다.\n자세한 사항은 담당 선생님께 문의해 주세요.\n\n(임시 문구입니다. 설정에서 수정하세요.)' },
  scheduleChanged: { subject: '[모의면접] 면접 일정이 변경되었습니다', body: '[학생이름] 학생, 모의면접 일정이 변경되었습니다.\n\n[변경내역]\n\n변경된 일정: [날짜] [교시]\n\n(임시 문구입니다. 설정에서 수정하세요.)' },
  scheduleDeleted: { subject: '[모의면접] 면접 신청이 취소되었습니다', body: '[학생이름] 학생, 아래 모의면접 신청이 취소되었습니다.\n\n[변경내역]\n\n필요하면 다시 신청해 주세요.\n\n(임시 문구입니다. 설정에서 수정하세요.)' },
  feedbackDone: { subject: '[모의면접] 피드백이 등록되었습니다', body: '[학생이름] 학생, [날짜] [교시] 모의면접 피드백이 등록되었습니다.\n시스템에 로그인하여 「내 신청」에서 확인하세요.\n\n(임시 문구입니다. 설정에서 수정하세요.)' },
};

/* ───────────── helpers ───────────── */
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isValidStudentId = (id) => /^[0-9A-Za-z-]{1,20}$/.test(id);

async function requireTeacher(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`teachers/${req.auth.uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '교사만 사용할 수 있는 기능입니다.');
  return { uid: req.auth.uid, ...snap.data() };
}
async function getTeacherKey() {
  const snap = await db.doc('settings/teacherKey').get();
  return snap.exists ? String(snap.data().key ?? '') : '';
}
async function deleteAuthUserSafe(uid) {
  if (!uid) return false;
  try { await auth.deleteUser(uid); return true; } catch (e) { if (e.code !== 'auth/user-not-found') console.warn('deleteUser', uid, e.message); return false; }
}
async function deleteQueryBatch(q) {
  let n = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await q.limit(300).get();
    if (snap.empty) return n;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    n += snap.size;
  }
}
async function deleteStudentChildren(studentId) {
  const bookings = await db.collection('bookings').where('studentId', '==', studentId).get();
  for (const b of bookings.docs) {
    await deleteQueryBatch(db.collection('memos').where('bookingId', '==', b.id));
    await db.doc(`feedbacks/${b.id}`).delete().catch(() => {});
    await b.ref.delete();
  }
  await deleteQueryBatch(db.collection('feedbacks').where('studentId', '==', studentId));
  await deleteQueryBatch(db.collection('studentDailyCounts').where('studentId', '==', studentId));
  // Storage 파일
  try {
    const bucket = admin.storage().bucket();
    for (const b of bookings.docs) await bucket.deleteFiles({ prefix: `feedbacks/${b.id}/` }).catch(() => {});
  } catch (e) { console.warn('storage cleanup', e.message); }
}

/* ───────────── 학생 가입 ───────────── */
exports.registerStudent = onCall({ enforceAppCheck: false }, async (req) => {
  const studentId = str(req.data?.studentId, 20);
  const name = str(req.data?.name, 30);
  const password = typeof req.data?.password === 'string' ? req.data.password : '';
  const email = str(req.data?.email, 120);
  const consentAgreed = req.data?.consentAgreed === true;

  if (!studentId || !name || !password || !email) throw new HttpsError('invalid-argument', '모든 항목을 입력해 주세요.');
  if (!isValidStudentId(studentId)) throw new HttpsError('invalid-argument', '학번 형식이 올바르지 않습니다.');
  if (password.length < PASSWORD_MIN_LEN) throw new HttpsError('invalid-argument', `비밀번호는 ${PASSWORD_MIN_LEN}자 이상이어야 합니다.`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', '이메일 형식이 올바르지 않습니다.');
  if (!consentAgreed) throw new HttpsError('failed-precondition', '개인정보 수집·이용에 동의해야 가입할 수 있습니다.');

  const ref = db.doc(`students/${studentId}`);
  const snap = await ref.get();
  // 미등록 또는 이름 불일치 → 동일 메시지(존재 여부 노출 방지)
  if (!snap.exists || snap.data().name !== name) {
    throw new HttpsError('not-found', '등록된 학번·이름과 일치하지 않습니다. 다시 입력해 주세요.');
  }
  const s = snap.data();
  if (s.status === 'pending' || s.status === 'approved') throw new HttpsError('already-exists', '이미 가입된 학번입니다.');

  // 반려 후 재가입 등: 남아 있는 Auth 계정 정리
  const vEmail = studentEmail(studentId);
  try { const old = await auth.getUserByEmail(vEmail); await auth.deleteUser(old.uid); } catch (e) { if (e.code !== 'auth/user-not-found') throw new HttpsError('internal', '계정을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }

  const user = await auth.createUser({ email: vEmail, password, displayName: name, emailVerified: true });
  await auth.setCustomUserClaims(user.uid, { role: 'student', studentId });
  await ref.update({
    status: 'pending', authUid: user.uid, email, signupAt: admin.firestore.FieldValue.serverTimestamp(),
    consentAgreed: true, consentAt: admin.firestore.FieldValue.serverTimestamp(), mustChangePassword: false,
    rejectedBy: null, rejectedAt: null,
  });
  return { ok: true };
});

/* ───────────── 교사 인증 ───────────── */
exports.verifyTeacherKey = onCall(async (req) => {
  const key = str(req.data?.key, 64);
  const real = await getTeacherKey();
  if (!real) throw new HttpsError('failed-precondition', '교사 인증키가 아직 설정되지 않았습니다. Firestore settings/teacherKey 문서를 등록하세요.');
  if (!key || key !== real) throw new HttpsError('permission-denied', '인증키가 올바르지 않습니다.');
  return { ok: true };
});

exports.registerTeacher = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Google 로그인이 필요합니다.');
  const { uid, token } = req.auth;
  if (token.studentId) throw new HttpsError('permission-denied', '학생 계정으로는 교사 등록을 할 수 없습니다.');
  const ref = db.doc(`teachers/${uid}`);
  const snap = await ref.get();
  if (snap.exists) {
    // Storage 규칙용 claim 이 없는 기존 교사에게도 부여 (클라이언트는 응답 후 토큰을 강제 갱신)
    if (token.role !== 'teacher') await auth.setCustomUserClaims(uid, { role: 'teacher' });
    return { ok: true, teacher: snap.data(), existing: true };
  }
  const key = str(req.data?.key, 64);
  const real = await getTeacherKey();
  if (!key || !real || key !== real) throw new HttpsError('permission-denied', '등록되지 않은 교사입니다. 최초 1회는 인증키가 필요합니다.');
  const teacher = { email: token.email || '', displayName: token.name || token.email || '교사', photoURL: token.picture || '', createdAt: admin.firestore.FieldValue.serverTimestamp() };
  await ref.set(teacher);
  await auth.setCustomUserClaims(uid, { role: 'teacher' });
  return { ok: true, teacher: { ...teacher, createdAt: null }, existing: false };
});

/* ───────────── 학생 관리(교사) ───────────── */
exports.resetStudentPassword = onCall(async (req) => {
  await requireTeacher(req);
  const studentId = str(req.data?.studentId, 20);
  const snap = await db.doc(`students/${studentId}`).get();
  if (!snap.exists || !snap.data().authUid) throw new HttpsError('not-found', '가입된 학생이 아닙니다.');
  // Firebase Auth 최소 길이(6자) 미만 학번은 뒤에 0을 채움 (예: 20301 → 203010)
  const tempPassword = studentId.length >= 6 ? studentId : studentId.padEnd(6, '0');
  await auth.updateUser(snap.data().authUid, { password: tempPassword });
  await snap.ref.update({ mustChangePassword: true });
  return { ok: true, tempPassword };
});

exports.rejectStudent = onCall(async (req) => {
  const teacher = await requireTeacher(req);
  const studentId = str(req.data?.studentId, 20);
  const teacherName = str(req.data?.teacherName, 40) || teacher.displayName || '';
  const ref = db.doc(`students/${studentId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '학생을 찾을 수 없습니다.');
  await deleteAuthUserSafe(snap.data().authUid);
  await ref.update({ status: 'rejected', authUid: null, rejectedBy: teacherName, rejectedAt: admin.firestore.FieldValue.serverTimestamp(), mustChangePassword: false });
  return { ok: true };
});

exports.deleteStudent = onCall(async (req) => {
  await requireTeacher(req);
  const studentId = str(req.data?.studentId, 20);
  const cascade = req.data?.cascade === true;
  const ref = db.doc(`students/${studentId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '학생을 찾을 수 없습니다.');
  await deleteAuthUserSafe(snap.data().authUid);
  if (cascade) await deleteStudentChildren(studentId);
  await ref.delete();
  return { ok: true };
});

exports.purgeStudents = onCall({ timeoutSeconds: 540, memory: '512MiB' }, async (req) => {
  await requireTeacher(req);
  if (req.data?.confirmText !== '삭제') throw new HttpsError('failed-precondition', '확인 문자열이 일치하지 않습니다.');
  const students = await db.collection('students').get();
  let authUsers = 0;
  for (const d of students.docs) {
    if (await deleteAuthUserSafe(d.data().authUid)) authUsers++;
  }
  // 학생 관련 컬렉션 전부 정리
  for (const c of ['bookings', 'feedbacks', 'memos', 'studentDailyCounts', 'slotStatus', 'students']) {
    await deleteQueryBatch(db.collection(c));
  }
  try { await admin.storage().bucket().deleteFiles({ prefix: 'feedbacks/' }); } catch (e) { console.warn('storage purge', e.message); }
  return { ok: true, students: students.size, authUsers };
});

/* ───────────── 메일 발송 (GAS 경유) ───────────── */
function fillTemplate(text, vars) {
  let out = String(text || '');
  for (const [k, v] of Object.entries(vars || {})) out = out.split(k).join(v ?? '');
  return out;
}
exports.sendMail = onCall({ secrets: [GAS_MAIL_TOKEN] }, async (req) => {
  const teacher = await requireTeacher(req);
  const studentId = str(req.data?.studentId, 20);
  const templateKey = str(req.data?.templateKey, 40);
  const vars = req.data?.vars && typeof req.data.vars === 'object' ? req.data.vars : {};
  const toOverride = str(req.data?.toOverride, 120);
  if (!DEFAULT_MAIL_TEMPLATES[templateKey]) throw new HttpsError('invalid-argument', '알 수 없는 메일 템플릿입니다.');

  const sSnap = await db.doc(`students/${studentId}`).get();
  const to = toOverride || (sSnap.exists ? sSnap.data().email : null);
  const studentName = sSnap.exists ? sSnap.data().name : '';
  const log = { studentId, templateKey, to: to || null, requestedBy: teacher.uid, requestedByName: teacher.displayName || '', createdAt: admin.firestore.FieldValue.serverTimestamp() };
  if (!to) {
    await db.collection('mailLogs').add({ ...log, ok: false, error: '수신 이메일 없음' });
    return { ok: false, error: '학생 이메일이 등록되어 있지 않습니다.' };
  }
  const tSnap = await db.doc('settings/mailTemplates').get();
  const tpl = { ...DEFAULT_MAIL_TEMPLATES[templateKey], ...((tSnap.exists && tSnap.data()[templateKey]) || {}) };
  const allVars = { '[학생이름]': studentName, '[날짜]': '', '[교시]': '', '[변경내역]': '', ...vars };
  const subject = fillTemplate(tpl.subject, allVars);
  const body = fillTemplate(tpl.body, allVars);

  const url = GAS_MAIL_URL.value();
  const token = GAS_MAIL_TOKEN.value();
  if (!url || !token) {
    await db.collection('mailLogs').add({ ...log, subject, ok: false, error: 'GAS 설정 없음(GAS_MAIL_URL / GAS_MAIL_TOKEN)' });
    return { ok: false, error: '메일 발송 설정(GAS URL/토큰)이 없습니다.' };
  }
  try {
    const res = await fetch(url, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS 웹앱은 text/plain으로 보내야 CORS preflight 없이 doPost 진입
      body: JSON.stringify({ token, to, subject, body }),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* HTML 응답 등 */ }
    // doGet 응답({ok:true, service:...})이 섞여 들어오면 발송 성공으로 오인하지 않도록 service 필드 부재도 확인
    if (!res.ok || !json || json.ok !== true || json.service) throw new Error(json?.error || `GAS 응답 오류 (${res.status}) ${text.slice(0, 120)}`);
    await db.collection('mailLogs').add({ ...log, subject, ok: true });
    return { ok: true };
  } catch (e) {
    await db.collection('mailLogs').add({ ...log, subject, ok: false, error: String(e.message || e) });
    return { ok: false, error: String(e.message || e) };
  }
});

/* ───────────── slotStatus 동기화 트리거 ───────────── */
async function recomputeSlotStatus(date) {
  if (!date) return;
  const snap = await db.collection('bookings').where('date', '==', date).get();
  const taken = PERIOD_IDS.filter((p) => snap.docs.some((d) => d.data().periodId === p));
  await db.doc(`slotStatus/${date}`).set({ date, taken, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
}
exports.syncSlotStatus = onDocumentWritten('bookings/{bookingId}', async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  const dates = new Set([before?.date, after?.date].filter(Boolean));
  for (const d of dates) await recomputeSlotStatus(d);
});
