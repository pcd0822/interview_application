/**
 * Firestore 데이터 접근 계층.
 * 컬렉션: settings, teachers, students, availability, bookings, slotStatus, studentDailyCounts,
 *         memos, feedbacks, mailLogs
 */
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, orderBy, limit, runTransaction, serverTimestamp, Timestamp,
  writeBatch, onSnapshot, increment, deleteField,
} from 'firebase/firestore';
import { ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, fns } from './firebase';
import { PERIOD_MAP, PERIOD_IDS, DEFAULT_MAIL_TEMPLATES, MAX_BOOKINGS_PER_DAY } from './constants';
import { isoToUtcMidnight, formatKoDate } from './date';

const col = (name) => collection(db, name);
const snapToList = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/* ───────────────────────── settings ───────────────────────── */
export async function getMailTemplates() {
  const snap = await getDoc(doc(db, 'settings', 'mailTemplates'));
  const data = snap.exists() ? snap.data() : {};
  const merged = {};
  for (const k of Object.keys(DEFAULT_MAIL_TEMPLATES)) {
    merged[k] = { ...DEFAULT_MAIL_TEMPLATES[k], ...(data[k] || {}) };
  }
  return merged;
}
export const saveMailTemplates = (templates) => setDoc(doc(db, 'settings', 'mailTemplates'), templates, { merge: true });
export async function getAcademicYear() {
  const snap = await getDoc(doc(db, 'settings', 'academicYear'));
  return snap.exists() ? snap.data().year : new Date().getFullYear();
}
export const saveAcademicYear = (year) => setDoc(doc(db, 'settings', 'academicYear'), { year: Number(year) });
export const saveTeacherKey = (key) => setDoc(doc(db, 'settings', 'teacherKey'), { key: String(key), updatedAt: serverTimestamp() });

/* ───────────────────────── students ───────────────────────── */
export async function listStudents() {
  const snap = await getDocs(query(col('students'), orderBy('studentId')));
  return snapToList(snap);
}
export function subscribeStudents(cb) {
  return onSnapshot(query(col('students'), orderBy('studentId')), (snap) => cb(snapToList(snap)));
}
export async function getStudent(studentId) {
  const snap = await getDoc(doc(db, 'students', studentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
/** 개별 등록. 이미 있으면 false 반환(건너뜀). */
export async function addStudent({ studentId, name, track, admissionType }) {
  const ref = doc(db, 'students', studentId);
  const snap = await getDoc(ref);
  if (snap.exists()) return false;
  await setDoc(ref, {
    studentId, name, track: track || '', admissionType: admissionType || '',
    registeredAt: serverTimestamp(), signupAt: null, consentAgreed: false, consentAt: null,
    email: null, status: 'unregistered', authUid: null, mustChangePassword: false,
    approvedBy: null, approvedAt: null, rejectedBy: null, rejectedAt: null,
  });
  return true;
}
/** xlsx 일괄 등록: 중복 학번은 건너뜀 */
export async function bulkAddStudents(rows) {
  const existing = new Set((await listStudents()).map((s) => s.studentId));
  const result = { added: 0, skipped: 0, invalid: 0, skippedIds: [] };
  let batch = writeBatch(db);
  let n = 0;
  for (const r of rows) {
    const studentId = String(r.studentId ?? '').trim();
    const name = String(r.name ?? '').trim();
    if (!studentId || !name) { result.invalid++; continue; }
    if (existing.has(studentId)) { result.skipped++; result.skippedIds.push(studentId); continue; }
    existing.add(studentId);
    batch.set(doc(db, 'students', studentId), {
      studentId, name, track: String(r.track ?? '').trim(), admissionType: String(r.admissionType ?? '').trim(),
      registeredAt: serverTimestamp(), signupAt: null, consentAgreed: false, consentAt: null,
      email: null, status: 'unregistered', authUid: null, mustChangePassword: false,
      approvedBy: null, approvedAt: null, rejectedBy: null, rejectedAt: null,
    });
    result.added++;
    if (++n >= 400) { await batch.commit(); batch = writeBatch(db); n = 0; }
  }
  if (n > 0) await batch.commit();
  return result;
}
export const updateStudent = (studentId, patch) => updateDoc(doc(db, 'students', studentId), patch);
export async function approveStudent(student, teacherName) {
  await updateDoc(doc(db, 'students', student.studentId), {
    status: 'approved', approvedBy: teacherName, approvedAt: serverTimestamp(), rejectedBy: null, rejectedAt: null,
  });
  return sendMailSafe({ studentId: student.studentId, templateKey: 'approve', vars: { '[학생이름]': student.name } });
}
export async function rejectStudent(student, teacherName) {
  await fns.rejectStudent({ studentId: student.studentId, teacherName });
  return sendMailSafe({ studentId: student.studentId, templateKey: 'reject', vars: { '[학생이름]': student.name }, toOverride: student.email });
}
export const resetStudentPassword = (studentId) => fns.resetStudentPassword({ studentId });
export const deleteStudent = (studentId, cascade) => fns.deleteStudent({ studentId, cascade: !!cascade });
export const purgeStudents = (confirmText) => fns.purgeStudents({ confirmText });

/* ───────────────────────── availability ───────────────────────── */
export async function getAvailabilityRange(startIso, endIso) {
  const snap = await getDocs(query(col('availability'), where('date', '>=', startIso), where('date', '<=', endIso)));
  const map = {};
  snap.docs.forEach((d) => { map[d.id] = d.data().openPeriods || []; });
  return map;
}
export async function getAvailability(dateIso) {
  const snap = await getDoc(doc(db, 'availability', dateIso));
  return snap.exists() ? snap.data().openPeriods || [] : [];
}
/** 여러 날짜 저장 (교사). entries: { [dateIso]: periodId[] } */
export async function saveAvailability(entries, teacherUid) {
  const batch = writeBatch(db);
  for (const [date, periods] of Object.entries(entries)) {
    const openPeriods = PERIOD_IDS.filter((p) => periods.includes(p));
    batch.set(doc(db, 'availability', date), { date, openPeriods, updatedBy: teacherUid, updatedAt: serverTimestamp() });
  }
  await batch.commit();
}

/* ───────────────────────── slotStatus (학생용 예약완료 표시, 학생 정보 없음) ───────────────────────── */
export async function getSlotStatusRange(startIso, endIso) {
  const snap = await getDocs(query(col('slotStatus'), where('date', '>=', startIso), where('date', '<=', endIso)));
  const map = {};
  snap.docs.forEach((d) => { map[d.id] = d.data().taken || []; });
  return map;
}

/* ───────────────────────── bookings ───────────────────────── */
export const bookingId = (dateIso, periodId) => `${dateIso}_${periodId}`;

export function bookingBase(dateIso, periodId) {
  const p = PERIOD_MAP[periodId];
  return { date: dateIso, periodId, periodLabel: p.label, timeRange: p.time, dateTs: Timestamp.fromDate(isoToUtcMidnight(dateIso)) };
}

/**
 * 학생 신청 — 트랜잭션.
 * 슬롯 문서가 없을 때만 생성 + 같은 날 본인 신청 수(studentDailyCounts) 2건 제한.
 * 규칙에서도 동일 조건을 검사한다(firestore.rules 참고).
 */
export async function createBookingAsStudent({ student, dateIso, periodId, targetUniversity, targetAdmissionType, requests }) {
  const bRef = doc(db, 'bookings', bookingId(dateIso, periodId));
  const cRef = doc(db, 'studentDailyCounts', `${dateIso}_${student.studentId}`);
  const aRef = doc(db, 'availability', dateIso);
  await runTransaction(db, async (tx) => {
    const [bSnap, cSnap, aSnap] = await Promise.all([tx.get(bRef), tx.get(cRef), tx.get(aRef)]);
    if (bSnap.exists()) throw Object.assign(new Error('SLOT_TAKEN'), { code: 'SLOT_TAKEN' });
    const open = aSnap.exists() ? aSnap.data().openPeriods || [] : [];
    if (!open.includes(periodId)) throw Object.assign(new Error('SLOT_CLOSED'), { code: 'SLOT_CLOSED' });
    const count = cSnap.exists() ? cSnap.data().count || 0 : 0;
    if (count >= MAX_BOOKINGS_PER_DAY) throw Object.assign(new Error('DAILY_LIMIT'), { code: 'DAILY_LIMIT' });
    tx.set(cRef, { date: dateIso, studentId: student.studentId, count: count + 1 });
    tx.set(bRef, {
      ...bookingBase(dateIso, periodId),
      studentId: student.studentId, studentName: student.name,
      targetUniversity, targetAdmissionType, requests: requests || '',
      status: 'before', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: null,
    });
  });
}

/** 교사 직접 등록 — 슬롯 중복만 트랜잭션으로 차단, 제한 규칙은 경고만(호출측) */
export async function createBookingAsTeacher({ student, dateIso, periodId, targetUniversity, targetAdmissionType, requests, teacherUid }) {
  const bRef = doc(db, 'bookings', bookingId(dateIso, periodId));
  const cRef = doc(db, 'studentDailyCounts', `${dateIso}_${student.studentId}`);
  await runTransaction(db, async (tx) => {
    const bSnap = await tx.get(bRef);
    if (bSnap.exists()) throw Object.assign(new Error('SLOT_TAKEN'), { code: 'SLOT_TAKEN' });
    tx.set(cRef, { date: dateIso, studentId: student.studentId, count: increment(1) }, { merge: true });
    tx.set(bRef, {
      ...bookingBase(dateIso, periodId),
      studentId: student.studentId, studentName: student.name,
      targetUniversity, targetAdmissionType, requests: requests || '',
      status: 'before', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: teacherUid,
    });
  });
}

/**
 * 교사 수정. 날짜·교시가 바뀌면 트랜잭션으로 새 슬롯 점유 후 기존 슬롯 해제.
 * 반환: { moved: bool }
 */
export async function updateBookingAsTeacher(booking, patch, teacherUid) {
  const newDate = patch.date || booking.date;
  const newPeriod = patch.periodId || booking.periodId;
  const moved = newDate !== booking.date || newPeriod !== booking.periodId;
  const fields = {
    targetUniversity: patch.targetUniversity ?? booking.targetUniversity,
    targetAdmissionType: patch.targetAdmissionType ?? booking.targetAdmissionType,
    requests: patch.requests ?? booking.requests ?? '',
    updatedAt: serverTimestamp(), updatedBy: teacherUid,
  };
  if (!moved) {
    await updateDoc(doc(db, 'bookings', booking.id), fields);
    return { moved: false };
  }
  const oldRef = doc(db, 'bookings', booking.id);
  const newRef = doc(db, 'bookings', bookingId(newDate, newPeriod));
  await runTransaction(db, async (tx) => {
    const [oldSnap, newSnap] = await Promise.all([tx.get(oldRef), tx.get(newRef)]);
    if (newSnap.exists()) throw Object.assign(new Error('SLOT_TAKEN'), { code: 'SLOT_TAKEN' });
    if (!oldSnap.exists()) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
    const old = oldSnap.data();
    tx.set(newRef, { ...old, ...bookingBase(newDate, newPeriod), ...fields });
    tx.delete(oldRef);
    if (newDate !== old.date) {
      tx.set(doc(db, 'studentDailyCounts', `${old.date}_${old.studentId}`), { date: old.date, studentId: old.studentId, count: increment(-1) }, { merge: true });
      tx.set(doc(db, 'studentDailyCounts', `${newDate}_${old.studentId}`), { date: newDate, studentId: old.studentId, count: increment(1) }, { merge: true });
    }
    // 메모·피드백은 bookingId 기반이므로 함께 이동
  });
  await moveBookingChildren(booking.id, bookingId(newDate, newPeriod));
  return { moved: true, newId: bookingId(newDate, newPeriod) };
}
async function moveBookingChildren(oldId, newId) {
  const batch = writeBatch(db);
  // 피드백은 교사별 문서(작성자만 수정 가능). 다른 교사 문서도 옮겨야 하므로 규칙이 허용하는 bookingId 필드만 갱신한다(문서 id는 유지).
  const fbs = await getDocs(query(col('feedbacks'), where('bookingId', '==', oldId)));
  fbs.docs.forEach((f) => batch.update(f.ref, { bookingId: newId }));
  const memos = await getDocs(query(col('memos'), where('bookingId', '==', oldId)));
  memos.docs.forEach((m) => {
    const data = m.data();
    batch.set(doc(db, 'memos', `${newId}_${data.teacherUid}`), { ...data, bookingId: newId });
    batch.delete(m.ref);
  });
  await batch.commit();
}
export async function deleteBookingAsTeacher(booking) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'bookings', booking.id));
  batch.set(doc(db, 'studentDailyCounts', `${booking.date}_${booking.studentId}`), { date: booking.date, studentId: booking.studentId, count: increment(-1) }, { merge: true });
  await batch.commit();
}
export const setBookingStatus = (id, status, teacherUid) => updateDoc(doc(db, 'bookings', id), { status, updatedAt: serverTimestamp(), updatedBy: teacherUid || null });

export async function getBookingsRange(startIso, endIso) {
  const snap = await getDocs(query(col('bookings'), where('date', '>=', startIso), where('date', '<=', endIso), orderBy('date')));
  return snapToList(snap);
}
export async function getAllBookings() {
  const snap = await getDocs(query(col('bookings'), orderBy('date', 'desc')));
  return snapToList(snap);
}
export async function getBooking(id) {
  const snap = await getDoc(doc(db, 'bookings', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
export async function getMyBookings(studentId) {
  const snap = await getDocs(query(col('bookings'), where('studentId', '==', studentId), orderBy('date', 'desc')));
  return snapToList(snap);
}
export function subscribeMyBookings(studentId, cb) {
  return onSnapshot(query(col('bookings'), where('studentId', '==', studentId), orderBy('date', 'desc')), (snap) => cb(snapToList(snap)));
}
export async function getStudentBookings(studentId) {
  const snap = await getDocs(query(col('bookings'), where('studentId', '==', studentId), orderBy('date', 'desc')));
  return snapToList(snap);
}
export async function getUpcomingBookings(fromIso, max = 200) {
  const snap = await getDocs(query(col('bookings'), where('date', '>=', fromIso), orderBy('date'), limit(max)));
  return snapToList(snap);
}
/**
 * 학번·이름 접두 검색 — 날짜 무관 전체 기간.
 * 단일 필드 범위 쿼리 두 개(studentId, studentName)를 합쳐 중복 제거 후 날짜 내림차순.
 * 복합 인덱스 불필요.
 */
export async function searchBookings(keyword, max = 100) {
  const k = String(keyword || '').trim();
  if (!k) return [];
  const end = k + '';
  const [byId, byName] = await Promise.all([
    getDocs(query(col('bookings'), where('studentId', '>=', k), where('studentId', '<=', end), limit(max))),
    getDocs(query(col('bookings'), where('studentName', '>=', k), where('studentName', '<=', end), limit(max))),
  ]);
  const map = new Map();
  [...snapToList(byId), ...snapToList(byName)].forEach((b) => map.set(b.id, b));
  return [...map.values()].sort((a, b) => (a.date === b.date ? String(a.periodId).localeCompare(String(b.periodId)) : (a.date < b.date ? 1 : -1)));
}

/* ───────────────────────── memos (작성 교사 전용) ───────────────────────── */
export async function getMemo(bookingId, teacherUid) {
  const snap = await getDoc(doc(db, 'memos', `${bookingId}_${teacherUid}`));
  return snap.exists() ? snap.data() : null;
}
export const saveMemo = (bookingId, teacherUid, content) =>
  setDoc(doc(db, 'memos', `${bookingId}_${teacherUid}`), { bookingId, teacherUid, content, updatedAt: serverTimestamp() });

/* ───────────────────────── feedbacks (교사별 문서, 작성자만 수정) ─────────────────────────
 * 문서 id: `${bookingId}_${teacherUid}` (구형 문서는 `${bookingId}` 하나뿐이고 teacherUid 없음 → createdBy 로 작성자 판정)
 * 조회는 항상 bookingId 필드 기준이라 구형·신형이 함께 나온다. 일정 이동 시에도 id는 두고 bookingId 만 바꾼다.
 */
const tsMs = (t) => (t?.toMillis ? t.toMillis() : t ? new Date(t).getTime() : 0);
const sortFeedbacks = (rows) => rows.sort((a, b) => tsMs(a.createdAt) - tsMs(b.createdAt));
/** 이 피드백 문서를 uid 교사가 수정할 수 있는가 (규칙의 owner() 와 동일 조건) */
export const isFeedbackOwner = (fb, uid) => !!fb && !!uid && (fb.teacherUid ? fb.teacherUid === uid : fb.createdBy === uid);
/** 한 신청 건의 피드백 전부(작성순). 학생은 자기 학번 조건을 함께 걸어야 규칙을 통과한다. */
export async function getFeedbacksForBooking(bookingId, { studentId } = {}) {
  const conds = [where('bookingId', '==', bookingId)];
  if (studentId) conds.push(where('studentId', '==', studentId));
  const snap = await getDocs(query(col('feedbacks'), ...conds));
  return sortFeedbacks(snapToList(snap));
}
export async function getFeedbacksByStudent(studentId) {
  const snap = await getDocs(query(col('feedbacks'), where('studentId', '==', studentId)));
  return snapToList(snap);
}
export async function getAllFeedbacks() {
  const snap = await getDocs(query(col('feedbacks'), orderBy('interviewDateIso')));
  return snapToList(snap);
}
export async function getFeedbacksRange(startIso, endIso) {
  const snap = await getDocs(query(col('feedbacks'), where('interviewDateIso', '>=', startIso), where('interviewDateIso', '<=', endIso), orderBy('interviewDateIso')));
  return snapToList(snap);
}
/** 파일 업로드(진행률 콜백) → { url, name, type } */
export function uploadFeedbackFile(bookingId, studentId, file, onProgress) {
  const ext = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'md';
  // 경로에 학번을 포함 → Storage 규칙이 Firestore 조회 없이 해당 학생 읽기 권한을 판정
  const path = `feedbacks/${bookingId}/${studentId}/${Date.now()}_${file.name}`;
  const task = uploadBytesResumable(sRef(storage, path), file, { contentType: ext === 'pdf' ? 'application/pdf' : 'text/markdown' });
  return new Promise((resolve, reject) => {
    task.on('state_changed',
      (s) => onProgress?.(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      reject,
      async () => resolve({ url: await getDownloadURL(task.snapshot.ref), name: file.name, type: ext, path }),
    );
  });
}
export async function deleteStorageFile(path) {
  try { await deleteObject(sRef(storage, path)); } catch { /* 없으면 무시 */ }
}
/**
 * 내 피드백 저장(교사별 문서) + booking.status → done.
 * 이미 내 문서가 있으면 그 문서를 갱신(일정 이동으로 id가 달라졌어도 bookingId 로 찾음), 없으면 `${bookingId}_${uid}` 로 생성.
 * booking.feedbackTeacherName 은 이 건의 모든 피드백 작성 교사명을 ", " 로 이어 붙인다.
 */
export async function saveFeedback(bookingId, data, { uid, teacherDisplayName }) {
  const all = await getFeedbacksForBooking(bookingId);
  const mine = all.find((f) => isFeedbackOwner(f, uid));
  const ref = mine ? doc(db, 'feedbacks', mine.id) : doc(db, 'feedbacks', `${bookingId}_${uid}`);
  const stamp = { updatedAt: serverTimestamp(), updatedBy: uid, updatedByName: teacherDisplayName };
  const base = mine
    ? stamp
    : { createdBy: uid, createdByName: teacherDisplayName, createdAt: serverTimestamp(), ...stamp };
  const names = [...all.filter((f) => f.id !== ref.id).map((f) => f.teacherName), data.teacherName].map((n) => (n || '').trim()).filter(Boolean);
  const batch = writeBatch(db);
  batch.set(ref, { bookingId, teacherUid: uid, ...data, ...base }, { merge: true });
  batch.update(doc(db, 'bookings', bookingId), { status: 'done', updatedAt: serverTimestamp(), updatedBy: uid, feedbackTeacherName: [...new Set(names)].join(', ') });
  await batch.commit();
  return ref.id;
}

/* ───────────────────────── mail ───────────────────────── */
/**
 * 메일 발송(Cloud Function 경유). 실패해도 예외를 던지지 않고 {ok:false, error}를 반환.
 * vars: { '[학생이름]': ..., '[날짜]': ..., '[교시]': ..., '[변경내역]': ... }
 */
export async function sendMailSafe({ studentId, templateKey, vars, toOverride }) {
  try {
    const res = await fns.sendMail({ studentId, templateKey, vars: vars || {}, toOverride: toOverride || null });
    return res;
  } catch (e) {
    console.error('sendMail failed', e);
    return { ok: false, error: e.message || String(e) };
  }
}
export function bookingVars(booking, extra = {}) {
  return {
    '[학생이름]': booking.studentName,
    '[날짜]': formatKoDate(booking.date),
    '[교시]': `${booking.periodLabel} (${booking.timeRange})`,
    '[변경내역]': '',
    ...extra,
  };
}

/* ───────────────────────── teachers ───────────────────────── */
export async function listTeachers() {
  const snap = await getDocs(col('teachers'));
  return snapToList(snap);
}

export { serverTimestamp, deleteField, addDoc };
