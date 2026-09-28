import { useEffect, useMemo, useRef, useState } from 'react';
import { Users, Plus, Upload, Download, Trash2, Check, X, Pencil, KeyRound, Search, AlertTriangle } from 'lucide-react';
import { PageHeader } from './TeacherLayout';
import { StudentStatusBadge, Modal, ConfirmModal, Field, Spinner } from '../../components/common';
import { subscribeStudents, addStudent, bulkAddStudents, updateStudent, approveStudent, rejectStudent, resetStudentPassword, deleteStudent, purgeStudents } from '../../lib/api';
import { downloadStudentTemplate, parseStudentXlsx } from '../../lib/excel';
import { formatDateTime, formatShort } from '../../lib/date';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toast';
import { errMsg } from '../../lib/firebase';

/** T3 학생관리 */
export default function StudentsPage() {
  const { teacher, user } = useAuth();
  const teacherName = teacher?.displayName || user?.displayName || '교사';
  const [students, setStudents] = useState(null);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null); // {type, student}
  const [busyId, setBusyId] = useState(null);
  const fileRef = useRef();

  useEffect(() => subscribeStudents(setStudents), []);

  const list = useMemo(() => {
    if (!students) return [];
    const k = q.trim().toLowerCase();
    return students.filter((s) => (status === 'all' || s.status === status) && (!k || s.studentId.includes(k) || s.name.toLowerCase().includes(k)));
  }, [students, status, q]);

  const run = async (student, fn, okMsg) => {
    setBusyId(student.studentId);
    try {
      const res = await fn();
      if (res && res.ok === false) toast.error(`${okMsg} 메일 발송에는 실패했습니다: ${res.error || ''}`);
      else if (res?.tempPassword) toast.success(`${okMsg} 임시 비밀번호: ${res.tempPassword}`);
      else toast.success(okMsg);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusyId(null); }
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const rows = await parseStudentXlsx(file);
      if (!rows.length) return toast.error('읽을 수 있는 행이 없습니다.');
      const r = await bulkAddStudents(rows);
      toast.success(`등록 ${r.added}명 · 중복 건너뜀 ${r.skipped}명 · 형식 오류 ${r.invalid}건`);
      if (r.skippedIds.length) toast.info(`건너뛴 학번: ${r.skippedIds.slice(0, 10).join(', ')}${r.skippedIds.length > 10 ? ' …' : ''}`);
    } catch (e2) { toast.error(errMsg(e2, '파일을 읽지 못했습니다.')); }
  };

  const counts = useMemo(() => {
    const c = { all: students?.length || 0, unregistered: 0, pending: 0, approved: 0, rejected: 0 };
    students?.forEach((s) => { c[s.status] = (c[s.status] || 0) + 1; });
    return c;
  }, [students]);

  return (
    <div>
      <PageHeader icon={Users} title="학생관리" accent="accent-blue">
        <button className="btn btn-outline btn-sm" onClick={downloadStudentTemplate}><Download size={16} />양식 다운로드</button>
        <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}><Upload size={16} />xlsx 업로드</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={onUpload} />
        <button className="btn btn-sm" onClick={() => setModal({ type: 'add' })}><Plus size={16} />개별 추가</button>
        <button className="btn btn-danger-outline btn-sm" onClick={() => setModal({ type: 'purge' })}><AlertTriangle size={16} />전체 명단 초기화</button>
      </PageHeader>

      <div className="toolbar">
        <div className="subtabs accent-blue">
          {[['all', '전체'], ['unregistered', '미가입'], ['pending', '대기'], ['approved', '승인'], ['rejected', '반려']].map(([k, l]) => (
            <button key={k} className={`subtab ${status === k ? 'active' : ''}`} onClick={() => setStatus(k)}>{l} {counts[k] ?? 0}</button>
          ))}
        </div>
        <div className="row grow" style={{ justifyContent: 'flex-end' }}>
          <div className="row" style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, color: '#6B7280' }} />
            <input className="input search" style={{ paddingLeft: 34 }} placeholder="학번·이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      {!students ? <Spinner /> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>학번</th><th>이름</th><th>희망 계열</th><th>희망 전형</th><th>가입 일시</th><th>개인정보 동의</th><th>이메일</th><th>상태</th><th>작업</th></tr></thead>
            <tbody>
              {!list.length && <tr><td colSpan={9} className="empty">표시할 학생이 없습니다. 양식을 내려받아 xlsx로 등록하거나 개별 추가하세요.</td></tr>}
              {list.map((s) => (
                <tr key={s.studentId}>
                  <td className="bold">{s.studentId}</td>
                  <td>{s.name}</td>
                  <td>{s.track || '-'}</td>
                  <td>{s.admissionType || '-'}</td>
                  <td className="small">{s.signupAt ? formatDateTime(s.signupAt) : '-'}</td>
                  <td>{s.consentAgreed ? <span className="badge badge-green">동의</span> : <span className="muted">-</span>}</td>
                  <td className="small">{s.email || '-'}</td>
                  <td>
                    <StudentStatusBadge status={s.status} />
                    {s.status === 'approved' && s.approvedBy && <div className="xs muted">승인: {s.approvedBy} {formatShort(s.approvedAt)}</div>}
                    {s.status === 'rejected' && s.rejectedBy && <div className="xs muted">반려: {s.rejectedBy} {formatShort(s.rejectedAt)}</div>}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {s.status === 'pending' && <>
                        <button className="btn btn-xs" disabled={busyId === s.studentId} onClick={() => run(s, () => approveStudent(s, teacherName), '승인했습니다.')}><Check size={14} />승인</button>
                        <button className="btn btn-danger-outline btn-xs" disabled={busyId === s.studentId} onClick={() => setModal({ type: 'reject', student: s })}><X size={14} />반려</button>
                      </>}
                      <button className="btn btn-outline btn-xs" onClick={() => setModal({ type: 'edit', student: s })} title="수정"><Pencil size={14} /></button>
                      {(s.status === 'approved' || s.status === 'pending') && <button className="btn btn-outline btn-xs" onClick={() => setModal({ type: 'reset', student: s })} title="비밀번호 초기화"><KeyRound size={14} /></button>}
                      <button className="btn btn-outline btn-xs" style={{ color: '#DC2626' }} onClick={() => setModal({ type: 'delete', student: s })} title="삭제"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === 'add' && <StudentFormModal onClose={() => setModal(null)} />}
      {modal?.type === 'edit' && <StudentFormModal student={modal.student} onClose={() => setModal(null)} />}
      {modal?.type === 'reject' && (
        <ConfirmModal title="가입 반려" danger confirmText="반려" onClose={() => setModal(null)}
          message={`${modal.student.name}(${modal.student.studentId}) 학생의 가입을 반려합니다.\n학생 계정이 삭제되고 반려 안내 메일이 발송됩니다.`}
          onConfirm={async () => { const s = modal.student; setModal(null); await run(s, () => rejectStudent(s, teacherName), '반려했습니다.'); }} />
      )}
      {modal?.type === 'reset' && (
        <ConfirmModal title="비밀번호 초기화" confirmText="초기화" onClose={() => setModal(null)}
          message={`${modal.student.name}(${modal.student.studentId}) 학생의 비밀번호를 학번(${modal.student.studentId})으로 재설정합니다.${modal.student.studentId.length < 6 ? `\n(학번이 6자 미만이라 뒤에 0을 채운 ${modal.student.studentId.padEnd(6, '0')} 이 임시 비밀번호가 됩니다.)` : ''}\n학생은 다음 로그인 때 새 비밀번호를 설정해야 합니다.`}
          onConfirm={async () => { const s = modal.student; setModal(null); await run(s, () => resetStudentPassword(s.studentId), '비밀번호를 초기화했습니다.'); }} />
      )}
      {modal?.type === 'delete' && <DeleteModal student={modal.student} onClose={() => setModal(null)} run={run} />}
      {modal?.type === 'purge' && (
        <ConfirmModal title="전체 명단 초기화" danger confirmText="전체 삭제" typeToConfirm="삭제" onClose={() => setModal(null)}
          message={`학년도 전환용 기능입니다.\n학생 문서 전체(${students?.length || 0}명)와 연결된 로그인 계정, 신청·피드백·메모를 모두 삭제합니다.\n이 작업은 되돌릴 수 없습니다.`}
          onConfirm={async () => {
            try { const r = await purgeStudents('삭제'); toast.success(`학생 ${r.students}명, 계정 ${r.authUsers}개를 삭제했습니다.`); setModal(null); }
            catch (e) { toast.error(errMsg(e)); }
          }} />
      )}
    </div>
  );
}

function StudentFormModal({ student, onClose }) {
  const edit = !!student;
  const [f, setF] = useState({ studentId: student?.studentId || '', name: student?.name || '', email: student?.email || '', track: student?.track || '', admissionType: student?.admissionType || '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const email = f.email.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('이메일 형식이 올바르지 않습니다.');
      if (edit) { await updateStudent(student.studentId, { name: f.name.trim(), email: email || null, track: f.track.trim(), admissionType: f.admissionType.trim() }); toast.success('수정했습니다.'); }
      else {
        if (!/^[0-9A-Za-z-]+$/.test(f.studentId.trim())) throw new Error('학번은 숫자·영문으로만 입력하세요.');
        const ok = await addStudent({ ...f, studentId: f.studentId.trim(), name: f.name.trim(), email: email || null });
        if (!ok) throw new Error('이미 등록된 학번입니다.');
        toast.success('등록했습니다.');
      }
      onClose();
    } catch (e2) { toast.error(errMsg(e2)); } finally { setBusy(false); }
  };
  return (
    <Modal title={edit ? '학생 정보 수정' : '학생 개별 추가'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="학번" required hint={edit ? '학번은 변경할 수 없습니다.' : '학생 로그인 ID로 사용됩니다.'}><input className="input" value={f.studentId} onChange={set('studentId')} disabled={edit} required /></Field>
        <Field label="이름" required hint="회원가입 시 입력 이름과 정확히 일치해야 합니다."><input className="input" value={f.name} onChange={set('name')} required /></Field>
        <Field label="안내 메일 주소" hint={edit ? '학생이 가입 때 제출한 주소입니다. 잘못 적었으면 여기서 고치세요. 승인·일정·피드백 안내 메일이 이 주소로 갑니다.' : '선택. 학생이 직접 가입하면 가입 때 입력한 주소로 바뀝니다.'}><input className="input" type="email" inputMode="email" value={f.email} onChange={set('email')} placeholder="example@gmail.com" /></Field>
        <Field label="희망 계열"><input className="input" value={f.track} onChange={set('track')} placeholder="예: 인문 / 자연 / 예체능" /></Field>
        <Field label="희망 전형"><input className="input" value={f.admissionType} onChange={set('admissionType')} placeholder="예: 학생부종합전형" /></Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn-outline" onClick={onClose}>취소</button><button className="btn" disabled={busy}>{busy ? '저장 중…' : '저장'}</button></div>
      </form>
    </Modal>
  );
}

function DeleteModal({ student, onClose, run }) {
  const [cascade, setCascade] = useState(false);
  return (
    <ConfirmModal title="학생 삭제" danger confirmText="삭제" onClose={onClose}
      message={`${student.name}(${student.studentId}) 학생 문서와 로그인 계정을 삭제합니다.`}
      onConfirm={async () => { onClose(); await run(student, () => deleteStudent(student.studentId, cascade), '삭제했습니다.'); }}>
      <label className="checkbox mt-12"><input type="checkbox" checked={cascade} onChange={(e) => setCascade(e.target.checked)} /><span>이 학생의 신청 내역(bookings)과 피드백(feedbacks)도 함께 삭제</span></label>
      <p className="xs muted mt-8">기본은 문서·계정만 삭제합니다. 운영일지에 남겨야 하면 체크하지 마세요.</p>
    </ConfirmModal>
  );
}
