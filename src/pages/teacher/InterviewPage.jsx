import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessagesSquare, Save, Upload, FileText, Trash2, Search, List } from 'lucide-react';
import { PageHeader } from './TeacherLayout';
import { StatusBadge, Markdown, Field, Spinner } from '../../components/common';
import { todayIso, formatKoDate, timeOptions, formatDateTime, koDateToIso } from '../../lib/date';
import { BOOKING_STATUS } from '../../lib/constants';
import {
  getUpcomingBookings, getAllBookings, searchBookings, getBooking, getStudent, getStudentBookings, getFeedbacksByStudent,
  getMemo, saveMemo, setBookingStatus, getFeedback, saveFeedback, uploadFeedbackFile, deleteStorageFile,
  sendMailSafe, bookingVars,
} from '../../lib/api';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toast';
import { errMsg } from '../../lib/firebase';

const AUTOSAVE_MS = 30000;
const TIMES = timeOptions(5);

/** T7 모의면접 */
export default function InterviewPage() {
  const { user, teacher } = useAuth();
  const [params, setParams] = useSearchParams();
  const bookingId = params.get('bookingId');
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  // mode: 'upcoming'(오늘·예정 건) | 'search'(학번·이름 검색, 전체 기간) | 'all'(전체 조회)
  const [mode, setMode] = useState('upcoming');
  const [listBusy, setListBusy] = useState(false);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadUpcoming = useCallback(async () => {
    setListBusy(true);
    try { setList(await getUpcomingBookings(todayIso())); setMode('upcoming'); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setListBusy(false); }
  }, []);
  const runSearch = useCallback(async () => {
    const k = q.trim();
    if (!k) { loadUpcoming(); return; }
    setListBusy(true);
    try {
      const rows = await searchBookings(k);
      setList(rows); setMode('search');
      if (!rows.length) toast.info(`「${k}」로 시작하는 학번·이름의 신청 건이 없습니다.`);
    } catch (e) { toast.error(errMsg(e)); }
    finally { setListBusy(false); }
  }, [q, loadUpcoming]);
  const loadAll = useCallback(async () => {
    setListBusy(true);
    try { setList(await getAllBookings()); setMode('all'); setQ(''); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setListBusy(false); }
  }, []);

  useEffect(() => { loadUpcoming(); }, [loadUpcoming]);
  useEffect(() => {
    if (!bookingId) { setBooking(null); return; }
    setLoading(true);
    getBooking(bookingId).then((b) => { setBooking(b); if (!b) toast.error('신청 건을 찾을 수 없습니다.'); }).finally(() => setLoading(false));
  }, [bookingId]);

  // 검색·전체 조회 결과는 서버에서 받은 그대로(완료 건 포함). 기본(예정) 목록만 입력 중 즉시 필터 + 완료 제외.
  const options = useMemo(() => {
    const rows = list || [];
    if (mode !== 'upcoming') return rows;
    const k = q.trim().toLowerCase();
    return rows.filter((b) => b.status !== 'done' && (!k || String(b.studentId || '').includes(k) || String(b.studentName || '').toLowerCase().includes(k)));
  }, [list, q, mode]);
  const placeholder = mode === 'search' ? `검색 결과 ${options.length}건 — 신청 건을 선택하세요` : mode === 'all' ? `전체 ${options.length}건 — 신청 건을 선택하세요` : '신청 건을 선택하세요 (오늘·예정 건)';

  const refreshBooking = useCallback(async () => { if (bookingId) setBooking(await getBooking(bookingId)); }, [bookingId]);
  const teacherDisplayName = teacher?.displayName || user?.displayName || '';

  return (
    <div>
      <PageHeader icon={MessagesSquare} title="모의면접" accent="accent-violet" />
      <div className="card mb-16" style={{ padding: 14 }}>
        <div className="row wrap">
          <form className="row" style={{ position: 'relative' }} onSubmit={(e) => { e.preventDefault(); runSearch(); }}>
            <Search size={16} style={{ position: 'absolute', left: 12, color: '#6B7280', pointerEvents: 'none' }} />
            <input className="input" style={{ paddingLeft: 34, width: 200, minHeight: 40 }} placeholder="학번·이름 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="학번·이름 검색" />
            <button type="submit" className="btn btn-violet btn-sm" disabled={listBusy}>{listBusy && mode !== 'all' ? '검색 중…' : '검색'}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={loadAll} disabled={listBusy}><List size={15} />전체 조회</button>
            {mode !== 'upcoming' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(''); loadUpcoming(); }} disabled={listBusy}>예정 건만</button>}
          </form>
          <select className="select grow" style={{ minHeight: 40, maxWidth: 520 }} value={bookingId || ''} onChange={(e) => setParams(e.target.value ? { bookingId: e.target.value } : {})}>
            <option value="">{placeholder}</option>
            {options.map((b) => <option key={b.id} value={b.id}>{formatKoDate(b.date)} {b.periodLabel} · {b.studentId} {b.studentName} · {b.targetUniversity}{mode !== 'upcoming' && BOOKING_STATUS[b.status] ? ` · ${BOOKING_STATUS[b.status].label}` : ''}</option>)}
            {bookingId && !options.some((b) => b.id === bookingId) && <option value={bookingId}>{bookingId} (선택됨)</option>}
          </select>
          {booking && <StatusBadge status={booking.status} />}
        </div>
        <div className="xs muted mt-8">검색은 학번·이름 앞글자 기준이며 지난 면접 건까지 모두 찾습니다. 전체 조회는 모든 신청 건을 최신순으로 보여 줍니다.</div>
      </div>

      {loading && <Spinner />}
      {!loading && !booking && <div className="card empty">상단에서 신청 건을 선택하거나, 일정관리에서 「면접 진행하기」를 눌러 들어오세요.</div>}
      {!loading && booking && (
        <div className="iv-grid">
          <StudentInfoCard booking={booking} />
          <MemoCard key={`memo-${booking.id}`} booking={booking} uid={user.uid} onStatusChange={refreshBooking} />
          <FeedbackCard key={`fb-${booking.id}`} booking={booking} uid={user.uid} teacherDisplayName={teacherDisplayName} onSaved={refreshBooking} />
        </div>
      )}
    </div>
  );
}

/* ── 좌: 학생 정보 카드 ── */
function StudentInfoCard({ booking: b }) {
  const [student, setStudent] = useState(null);
  const [history, setHistory] = useState([]);
  useEffect(() => {
    (async () => {
      const [s, bk, fbs] = await Promise.all([getStudent(b.studentId), getStudentBookings(b.studentId), getFeedbacksByStudent(b.studentId)]);
      setStudent(s);
      const fbMap = Object.fromEntries(fbs.map((f) => [f.bookingId, f]));
      setHistory(bk.filter((x) => x.id !== b.id).map((x) => ({ ...x, feedback: fbMap[x.id] })));
    })();
  }, [b.id, b.studentId]);
  return (
    <div className="card">
      <div className="card-title">학생 정보</div>
      <div className="kv">
        <span className="k">학번·이름</span><span className="v bold">{b.studentId} {b.studentName}</span>
        <span className="k">희망 계열</span><span className="v">{student?.track || '-'}</span>
        <span className="k">희망 전형</span><span className="v">{student?.admissionType || '-'}</span>
      </div>
      <div className="divider" />
      <div className="card-title" style={{ fontSize: 14 }}>이번 신청</div>
      <div className="kv">
        <span className="k">일시</span><span className="v">{formatKoDate(b.date)} {b.periodLabel} ({b.timeRange})</span>
        <span className="k">대학</span><span className="v">{b.targetUniversity}</span>
        <span className="k">전형</span><span className="v">{b.targetAdmissionType}</span>
        <span className="k">요청 사항</span><span className="v">{b.requests || '-'}</span>
      </div>
      <div className="divider" />
      <div className="card-title" style={{ fontSize: 14 }}>이전 면접 이력 ({history.length})</div>
      {!history.length && <div className="xs muted">이전 면접이 없습니다.</div>}
      <div className="stack" style={{ gap: 8 }}>
        {history.map((h) => (
          <div key={h.id} style={{ borderLeft: '3px solid #E5E7EB', paddingLeft: 10 }}>
            <div className="row-between"><span className="small bold">{formatKoDate(h.date)} {h.periodLabel}</span><StatusBadge status={h.status} /></div>
            <div className="xs muted">{h.targetUniversity} · {h.targetAdmissionType}</div>
            {h.feedback && <div className="xs mt-8" style={{ whiteSpace: 'pre-line' }}><b>{h.feedback.teacherName}</b> · {h.feedback.summary}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 중앙: 면접 메모 (작성 교사 전용, 임시 저장 시 status before→inProgress, 자동 저장은 상태 변경 없음) ── */
function MemoCard({ booking: b, uid, onStatusChange }) {
  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const latest = useRef('');
  useEffect(() => {
    getMemo(b.id, uid)
      .catch((e) => { console.warn('memo load', e); toast.error('메모를 불러오지 못했습니다. 빈 메모로 시작합니다.'); return null; })
      .then((m) => { setContent(m?.content || ''); latest.current = m?.content || ''; setSavedAt(m?.updatedAt || null); setLoaded(true); });
  }, [b.id, uid]);
  useEffect(() => {
    const t = setInterval(async () => {
      if (!dirty.current) return;
      try { await saveMemo(b.id, uid, latest.current); dirty.current = false; setSavedAt(new Date()); } catch { /* 다음 주기에 재시도 */ }
    }, AUTOSAVE_MS);
    return () => clearInterval(t);
  }, [b.id, uid]);
  const save = async () => {
    setBusy(true);
    try {
      await saveMemo(b.id, uid, latest.current);
      dirty.current = false; setSavedAt(new Date());
      if (b.status === 'before') { await setBookingStatus(b.id, 'inProgress', uid); await onStatusChange(); }
      toast.success('메모를 임시 저장했습니다.');
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="row-between mb-8"><div className="card-title" style={{ marginBottom: 0 }}>면접 메모 <span className="badge badge-violet">작성 교사 전용</span></div><button className="btn btn-violet btn-sm" onClick={save} disabled={busy || !loaded}><Save size={16} />임시 저장</button></div>
      {!loaded ? <Spinner /> : (
        <textarea className="textarea memo-area grow" placeholder="면접 진행 중 메모를 적어 두세요. 다른 교사는 볼 수 없습니다." value={content}
          onChange={(e) => { setContent(e.target.value); latest.current = e.target.value; dirty.current = true; }} />
      )}
      <div className="xs muted mt-8">30초마다 자동 저장됩니다(자동 저장은 상태를 바꾸지 않음). {savedAt ? `마지막 저장 ${formatDateTime(savedAt)}` : '아직 저장되지 않음'} · 「임시 저장」을 누르면 상태가 「진행중」으로 바뀝니다.</div>
    </div>
  );
}

/* ── 우: 피드백 작성 노트 ── */
function FeedbackCard({ booking: b, uid, teacherDisplayName, onSaved }) {
  const [existing, setExisting] = useState(undefined);
  const [f, setF] = useState({ teacherName: teacherDisplayName, dateIso: '', start: '20:00', end: '22:00', summary: '', contentMd: '', notify: true });
  const [mode, setMode] = useState('md'); // 'md' | 'file'
  const [preview, setPreview] = useState(false);
  const [file, setFile] = useState(null);       // 새로 선택한 File
  const [fileInfo, setFileInfo] = useState(null); // 저장된 {url,name,type,path}
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    getFeedback(b.id).then((fb) => {
      setExisting(fb);
      if (fb) {
        const [start, end] = (fb.interviewTime || '20:00~22:00').split('~');
        setF({ teacherName: fb.teacherName || teacherDisplayName, dateIso: fb.interviewDateIso || koDateToIso(fb.interviewDate) || '', start, end, summary: fb.summary || '', contentMd: fb.fileType ? '' : (fb.contentMd || ''), notify: false });
        if (fb.fileUrl) { setFileInfo({ url: fb.fileUrl, name: fb.fileName, type: fb.fileType, path: fb.filePath }); setMode('file'); }
      }
    });
  }, [b.id, teacherDisplayName]);

  const pickFile = (fl) => {
    if (!fl) return;
    const ok = /\.(pdf|md)$/i.test(fl.name);
    if (!ok) return toast.error('pdf 또는 md 파일만 업로드할 수 있습니다.');
    setFile(fl);
  };

  const hasBody = mode === 'md' ? !!f.contentMd.trim() : !!(file || fileInfo);
  const canSave = f.teacherName.trim() && f.dateIso && f.start && f.end && f.summary.trim() && hasBody;

  const save = async () => {
    if (!canSave) return toast.error('필수 항목을 모두 입력하세요. 피드백 본문은 직접 입력 또는 파일 업로드 중 하나가 필요합니다.');
    if (f.end <= f.start) return toast.error('종료 시간은 시작 시간보다 늦어야 합니다.');
    setBusy(true);
    try {
      let fileUrl = null, fileName = null, fileType = null, filePath = null, contentMd = null;
      if (mode === 'file') {
        let info = fileInfo;
        if (file) {
          setProgress(0);
          try {
            info = await uploadFeedbackFile(b.id, b.studentId, file, setProgress);
          } catch (e) {
            console.error('upload failed', e);
            throw new Error(`파일 업로드에 실패했습니다 (${e?.code || e?.message || '알 수 없는 오류'}). Storage 규칙 또는 네트워크를 확인해 주세요.`);
          }
          if (fileInfo?.path && fileInfo.path !== info.path) await deleteStorageFile(fileInfo.path);
          setFileInfo(info); setFile(null);
        }
        fileUrl = info.url; fileName = info.name; fileType = info.type; filePath = info.path;
        // md 파일은 본문 텍스트도 저장 → 학생 화면에서 파일을 다시 내려받지 않고 렌더링/PDF 변환
        if (fileType === 'md') contentMd = file ? await file.text() : (existing?.contentMd || null);
      } else {
        contentMd = f.contentMd;
        if (fileInfo?.path) await deleteStorageFile(fileInfo.path);
        setFileInfo(null);
      }
      const data = {
        studentId: b.studentId, studentName: b.studentName, teacherName: f.teacherName.trim(),
        interviewDate: formatKoDate(f.dateIso), interviewDateIso: f.dateIso, interviewTime: `${f.start}~${f.end}`,
        summary: f.summary.trim(), contentMd, fileUrl, fileName, fileType, filePath, notifiedByEmail: !!f.notify,
      };
      await saveFeedback(b.id, data, { uid, teacherDisplayName });
      let msg = '피드백을 저장했습니다. 상태가 「완료」로 바뀌었습니다.';
      if (f.notify) {
        const r = await sendMailSafe({ studentId: b.studentId, templateKey: 'feedbackDone', vars: bookingVars(b) });
        if (r.ok === false) toast.error(`메일 발송 실패: ${r.error || ''}`); else msg += ' 안내 메일을 발송했습니다.';
      }
      toast.success(msg);
      setExisting(await getFeedback(b.id));
      await onSaved();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); setProgress(null); }
  };

  if (existing === undefined) return <div className="card"><Spinner /></div>;
  return (
    <div className="card">
      <div className="card-title">피드백 작성 {existing && <span className="badge badge-green">등록됨</span>}</div>
      <Field label="피드백 작성 교사" required><input className="input" value={f.teacherName} onChange={(e) => setF({ ...f, teacherName: e.target.value })} /></Field>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Field label="면접 진행일" required hint={f.dateIso ? `표시: ${formatKoDate(f.dateIso)}` : '매번 직접 선택'}><input className="input" type="date" value={f.dateIso} onChange={(e) => setF({ ...f, dateIso: e.target.value })} /></Field>
        <Field label="시작" required><select className="select" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="종료" required><select className="select" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select></Field>
      </div>
      <Field label="모의면접 내용 요약 (일지용)" required hint="300자 권장 · 운영일지의 내용요약 열에 들어갑니다.">
        <textarea className="textarea" rows={4} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
        <div className="counter" style={{ color: f.summary.length > 300 ? '#B45309' : undefined }}>{f.summary.length}/300</div>
      </Field>

      <div className="field"><label>피드백 본문<span className="req">*</span> <span className="hint">(직접 입력 또는 파일 업로드 중 하나)</span></label>
        <div className="subtabs accent-violet" style={{ alignSelf: 'flex-start' }}>
          <button type="button" className={`subtab ${mode === 'md' ? 'active' : ''}`} onClick={() => setMode('md')}>직접 입력</button>
          <button type="button" className={`subtab ${mode === 'file' ? 'active' : ''}`} onClick={() => setMode('file')}>파일 업로드</button>
        </div>
      </div>
      {mode === 'md' ? (
        <div>
          <div className="row-between mb-8"><span className="xs muted">마크다운(제목 #, 목록 -, 표 |) 지원</span><button type="button" className="btn btn-ghost btn-xs" onClick={() => setPreview((p) => !p)}>{preview ? '편집' : '미리보기'}</button></div>
          {preview ? <Markdown>{f.contentMd}</Markdown> : <textarea className="textarea" rows={12} value={f.contentMd} onChange={(e) => setF({ ...f, contentMd: e.target.value })} placeholder={'## 잘한 점\n- ...\n\n## 보완할 점\n- ...\n\n## 예상 질문\n| 질문 | 조언 |\n|---|---|\n| ... | ... |'} />}
        </div>
      ) : (
        <div>
          {(file || fileInfo) && (
            <div className="file-card mb-8"><FileText size={18} color="#7C3AED" /><span className="grow ellipsis">{file ? `${file.name} (업로드 대기)` : fileInfo.name}</span>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => { setFile(null); if (!file) setFileInfo(null); }} aria-label="파일 제거"><Trash2 size={14} /></button></div>
          )}
          <div className={`dropzone ${over ? 'over' : ''}`} onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); pickFile(e.dataTransfer.files?.[0]); }}>
            <Upload size={22} style={{ marginBottom: 6 }} /><div>pdf 또는 md 파일을 끌어다 놓거나 클릭해서 선택 (크기 제한 없음)</div>
          </div>
          <input ref={inputRef} type="file" accept=".pdf,.md,application/pdf,text/markdown" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
          {progress !== null && <div className="mt-8"><div className="progress"><div style={{ width: `${progress}%` }} /></div><div className="xs muted mt-8">업로드 {progress}%</div></div>}
        </div>
      )}

      <label className="checkbox mt-16 mb-16"><input type="checkbox" checked={f.notify} onChange={(e) => setF({ ...f, notify: e.target.checked })} /><span>이메일로 알림 발송 ("피드백이 등록되었습니다")</span></label>
      <button className="btn btn-violet btn-full" onClick={save} disabled={busy || !canSave}><Save size={16} />{busy ? '저장 중…' : existing ? '피드백 수정 저장' : '저장 (상태 → 완료)'}</button>
      {existing && <div className="xs muted mt-8">최초 작성: {existing.createdByName || '-'} {formatDateTime(existing.createdAt)} · 마지막 수정: {existing.updatedByName || '-'} {formatDateTime(existing.updatedAt)}</div>}
    </div>
  );
}
