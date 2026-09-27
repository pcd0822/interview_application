import { useEffect, useState } from 'react';
import { ClipboardList, Download, Search } from 'lucide-react';
import { PageHeader } from './TeacherLayout';
import { Modal, Spinner, Field } from '../../components/common';
import { getAllFeedbacks, getFeedbacksRange, getAcademicYear, getAllBookings } from '../../lib/api';
import { exportLogXlsx } from '../../lib/excel';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toast';
import { errMsg } from '../../lib/firebase';

/** T8 일지관리 — 완료 건(feedbacks)만 조회, 담당교사 열은 조회 시 입력한 이름 */
export default function LogPage() {
  const { teacher, user } = useAuth();
  const [name, setName] = useState(teacher?.displayName || user?.displayName || '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState(null);
  const [queriedName, setQueriedName] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getAcademicYear().then(setYear).catch(() => {}); }, []);

  const search = async (e) => {
    e?.preventDefault();
    if (!name.trim()) return toast.error('교사 이름을 입력하세요.');
    if (from && to && from > to) return toast.error('기간이 올바르지 않습니다.');
    setBusy(true);
    try {
      const [fbs, bookings] = await Promise.all([
        from || to ? getFeedbacksRange(from || '0000-01-01', to || '9999-12-31') : getAllFeedbacks(),
        getAllBookings(),
      ]);
      const bMap = Object.fromEntries(bookings.map((b) => [b.id, b]));
      const list = fbs
        .filter((f) => bMap[f.bookingId]?.status === 'done')
        .map((f) => {
          const b = bMap[f.bookingId];
          return { id: f.id, date: f.interviewDate, dateIso: f.interviewDateIso, time: f.interviewTime, studentId: f.studentId, name: f.studentName || b.studentName, target: `${b.targetUniversity} · ${b.targetAdmissionType}`, teacher: name.trim(), summary: f.summary || '', author: f.teacherName };
        })
        .sort((a, b) => (a.dateIso || '').localeCompare(b.dateIso || '') || a.time.localeCompare(b.time));
      setRows(list);
      setQueriedName(name.trim());
    } catch (e2) { toast.error(errMsg(e2)); } finally { setBusy(false); }
  };

  const exportXlsx = async () => {
    if (!rows?.length) return toast.error('내보낼 데이터가 없습니다.');
    try { await exportLogXlsx({ year, rows }); toast.success('운영일지를 내려받았습니다.'); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div>
      <PageHeader icon={ClipboardList} title="일지관리" accent="accent-orange">
        <button className="btn btn-orange btn-sm" onClick={exportXlsx} disabled={!rows?.length}><Download size={16} />일지 내보내기 (xlsx)</button>
      </PageHeader>
      <form className="card mb-16" onSubmit={search} style={{ padding: 16 }}>
        <div className="row wrap" style={{ alignItems: 'flex-end' }}>
          <Field label="이름 (담당교사 열에 사용)" required><input className="input" style={{ width: 200 }} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="기간 시작 (선택)"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="기간 종료 (선택)"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <div className="field"><button className="btn btn-orange" disabled={busy}><Search size={16} />{busy ? '조회 중…' : '조회'}</button></div>
        </div>
        <div className="xs muted">파일명: {year}학년도_모의면접_운영일지_속초여고.xlsx · 완료(피드백 저장) 건만 표시됩니다.</div>
      </form>

      {busy && !rows && <Spinner />}
      {rows && (
        <div className="table-wrap">
          <table className="tbl accent-orange">
            <thead><tr><th>연번</th><th>면접 날짜</th><th>시간</th><th>학번</th><th>이름</th><th>희망 대학·전형</th><th>담당교사</th><th>모의면접 내용 요약</th></tr></thead>
            <tbody>
              {!rows.length && <tr><td colSpan={8} className="empty">조건에 맞는 완료 건이 없습니다.</td></tr>}
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td><td>{r.date}</td><td>{r.time}</td><td className="bold">{r.studentId}</td><td>{r.name}</td><td className="wrap" style={{ maxWidth: 220 }}>{r.target}</td><td>{queriedName}</td>
                  <td className="wrap" style={{ maxWidth: 360, cursor: 'pointer' }} onClick={() => setDetail(r)} title="클릭하면 전체 보기"><div className="clamp-2">{r.summary}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && (
        <Modal title={`${detail.studentId} ${detail.name} · ${detail.date}`} onClose={() => setDetail(null)}>
          <div className="xs muted mb-8">작성: {detail.author} · {detail.time} · {detail.target}</div>
          <p style={{ whiteSpace: 'pre-line' }}>{detail.summary}</p>
        </Modal>
      )}
    </div>
  );
}
