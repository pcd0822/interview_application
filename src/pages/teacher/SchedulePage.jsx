import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, X, Plus, Pencil, Trash2, Play, Save, Copy, Search, ArrowUpDown } from 'lucide-react';
import { PageHeader } from './TeacherLayout';
import { MonthCalendar, StatusBadge, Modal, Field, Spinner } from '../../components/common';
import { PERIODS, PERIOD_IDS, PERIOD_MAP, MAX_BOOKINGS_PER_DAY, REQUESTS_MAX_LEN } from '../../lib/constants';
import { monthRange, formatKoDate, formatDateTime, isWeekday, monthGrid, minBookableIso } from '../../lib/date';
import {
  getAvailabilityRange, saveAvailability, getBookingsRange, getAllBookings, listStudents, getFeedback,
  createBookingAsTeacher, updateBookingAsTeacher, deleteBookingAsTeacher, sendMailSafe, bookingVars,
} from '../../lib/api';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toast';
import { errMsg } from '../../lib/firebase';

/** T4 / T5 / T6 일정관리 */
export default function SchedulePage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'bookings' ? 'bookings' : 'availability';
  const setTab = (t) => setParams({ tab: t });
  return (
    <div>
      <PageHeader icon={CalendarDays} title="일정관리" accent="accent-teal">
        <div className="subtabs accent-teal">
          <button className={`subtab ${tab === 'availability' ? 'active' : ''}`} onClick={() => setTab('availability')}>신청 가능 시간 설정</button>
          <button className={`subtab ${tab === 'bookings' ? 'active' : ''}`} onClick={() => setTab('bookings')}>신청 조회·관리</button>
        </div>
      </PageHeader>
      {tab === 'availability' ? <AvailabilityTab /> : <BookingsTab />}
    </div>
  );
}

/* ═══════════════════════ (A) 신청 가능 시간 설정 — T4 ═══════════════════════ */
function AvailabilityTab() {
  const { user } = useAuth();
  const [month, setMonth] = useState(new Date());
  const [saved, setSaved] = useState({});    // 서버 상태 {date: periods[]}
  const [draft, setDraft] = useState({});    // 수정 중 {date: periods[]}
  const [bookings, setBookings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [copyMode, setCopyMode] = useState(false);
  const [copyTargets, setCopyTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = monthRange(month);
      const [a, b] = await Promise.all([getAvailabilityRange(start, end), getBookingsRange(start, end)]);
      setSaved(a); setBookings(b);
    } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const current = (iso) => draft[iso] ?? saved[iso] ?? [];
  const bookedByDate = useMemo(() => {
    const m = {};
    bookings.forEach((b) => { (m[b.date] ||= {})[b.periodId] = b; });
    return m;
  }, [bookings]);
  const dirtyCount = Object.keys(draft).filter((d) => JSON.stringify(PERIOD_IDS.filter((p) => (draft[d] || []).includes(p))) !== JSON.stringify(PERIOD_IDS.filter((p) => (saved[d] || []).includes(p)))).length;

  const setDay = (iso, periods) => setDraft((d) => ({ ...d, [iso]: PERIOD_IDS.filter((p) => periods.includes(p)) }));
  const toggle = (iso, pid) => {
    const cur = current(iso);
    const on = cur.includes(pid);
    if (on && bookedByDate[iso]?.[pid]) {
      const b = bookedByDate[iso][pid];
      if (!window.confirm(`${PERIOD_MAP[pid].label}에는 이미 신청(${b.studentName})이 있어요.\n닫아도 기존 신청은 유지됩니다. 취소하려면 「신청 조회·관리」에서 삭제하세요.\n그래도 닫을까요?`)) return;
    }
    setDay(iso, on ? cur.filter((p) => p !== pid) : [...cur, pid]);
  };
  const openWeekdays = () => {
    const next = { ...draft };
    monthGrid(month).filter((c) => c.inMonth && isWeekday(c.iso)).forEach((c) => { next[c.iso] = [...PERIOD_IDS]; });
    setDraft(next);
    toast.info('이번 달 평일 전체를 열었습니다. 「신청 가능 시간 저장」을 눌러야 반영됩니다.');
  };
  const applyCopy = () => {
    if (!selected || !copyTargets.length) return;
    const src = current(selected);
    const next = { ...draft };
    copyTargets.forEach((iso) => { next[iso] = [...src]; });
    setDraft(next);
    setCopyMode(false); setCopyTargets([]);
    toast.info(`${copyTargets.length}개 날짜에 복사했습니다. 저장을 눌러 반영하세요.`);
  };
  const save = async () => {
    setBusy(true);
    try {
      await saveAvailability(draft, user.uid);
      toast.success('신청 가능 시간을 저장했습니다. 학생 캘린더에 바로 반영됩니다.');
      setDraft({});
      await load();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const renderCell = (c) => {
    const n = current(c.iso).length;
    const dirty = c.iso in draft;
    return {
      sub: n ? <span className="cal-sub ok" style={{ color: '#0D9488' }}>{n}교시 열림{dirty ? '*' : ''}</span> : (dirty ? <span className="cal-sub">닫힘*</span> : null),
      selected: selected === c.iso,
      multi: copyMode && copyTargets.includes(c.iso),
      dot: !!bookedByDate[c.iso],
    };
  };
  const onSelect = (iso) => {
    if (copyMode) {
      if (iso === selected) return;
      setCopyTargets((t) => (t.includes(iso) ? t.filter((x) => x !== iso) : [...t, iso]));
    } else setSelected(iso);
  };

  return (
    <div className="panel-wrap" style={{ alignItems: 'flex-start' }}>
      <div className="card grow" style={{ padding: 16 }}>
        <div className="row-between mb-12 wrap">
          <div className="row wrap">
            <button className="btn btn-outline btn-sm" onClick={openWeekdays}>평일 전체 열기</button>
            {copyMode ? (
              <>
                <span className="badge badge-teal">복사할 날짜를 클릭하세요 ({copyTargets.length})</span>
                <button className="btn btn-teal btn-sm" onClick={applyCopy} disabled={!copyTargets.length}>복사 적용</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setCopyMode(false); setCopyTargets([]); }}>취소</button>
              </>
            ) : (
              <button className="btn btn-outline btn-sm" disabled={!selected} onClick={() => setCopyMode(true)}><Copy size={16} />선택한 날의 설정을 다른 날짜로 복사</button>
            )}
          </div>
          <button className="btn btn-teal" onClick={save} disabled={busy || !dirtyCount}><Save size={16} />{busy ? '저장 중…' : `신청 가능 시간 저장${dirtyCount ? ` (${dirtyCount})` : ''}`}</button>
        </div>
        <p className="xs muted mb-8">기본은 전부 닫힘입니다. 주말·공휴일도 동일하며, 열어 준 교시만 학생이 신청할 수 있어요. 점(●)은 신청이 있는 날입니다. *는 저장 전 변경.</p>
        {loading && !Object.keys(saved).length ? <Spinner /> : <MonthCalendar month={month} onMonthChange={setMonth} onSelect={onSelect} renderCell={renderCell} accent="teal" />}
      </div>
      <div className="panel" style={{ position: 'sticky' }}>
        <div className="panel-head"><b>{selected ? formatKoDate(selected) : '날짜를 선택하세요'}</b>
          {selected && <div className="row"><button className="btn btn-outline btn-xs" onClick={() => setDay(selected, PERIOD_IDS)}>이 날 전체 열기</button><button className="btn btn-outline btn-xs" onClick={() => setDay(selected, [])}>이 날 전체 닫기</button></div>}
        </div>
        <div className="panel-body stack" style={{ gap: 8 }}>
          {!selected && <div className="empty">왼쪽 캘린더에서 날짜를 클릭하면 교시별로 열고 닫을 수 있어요.</div>}
          {selected && PERIODS.map((p) => {
            const on = current(selected).includes(p.id);
            const b = bookedByDate[selected]?.[p.id];
            return (
              <div key={p.id} className={`toggle-row ${on ? 'on' : ''}`}>
                <div><div className="bold small">{p.label} <span className="muted" style={{ fontWeight: 400 }}>{p.time}</span></div>
                  {b && <div className="xs" style={{ color: '#B45309' }}>신청 1건 · {b.studentName}{!on && ' (닫혀 있지만 신청 유지됨)'}</div>}</div>
                <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={`${p.label} ${on ? '열림' : '닫힘'}`} onClick={() => toggle(selected, p.id)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ (B) 신청 조회·관리 — T5 / T6 ═══════════════════════ */
function BookingsTab() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [view, setView] = useState('calendar');
  const [month, setMonth] = useState(new Date());
  const [monthBookings, setMonthBookings] = useState([]);
  const [allBookings, setAllBookings] = useState(null);
  const [loading, setLoading] = useState(true);
  // 패널 상태
  const [panelDate, setPanelDate] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [scrollToDetail, setScrollToDetail] = useState(false);
  const [modal, setModal] = useState(null); // {type:'new'|'edit'|'delete', booking}
  const detailRef = useRef(null);
  // 테이블 뷰
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });

  const loadMonth = useCallback(async () => {
    setLoading(true);
    try { const { start, end } = monthRange(month); setMonthBookings(await getBookingsRange(start, end)); }
    catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }, [month]);
  const loadAll = useCallback(async () => {
    try { setAllBookings(await getAllBookings()); } catch (e) { toast.error(errMsg(e)); }
  }, []);
  useEffect(() => { loadMonth(); }, [loadMonth]);
  useEffect(() => { if (view === 'table' && !allBookings) loadAll(); }, [view, allBookings, loadAll]);
  const reload = async () => { await Promise.all([loadMonth(), allBookings ? loadAll() : null]); };

  const source = view === 'table' ? (allBookings || []) : monthBookings;
  const byDate = useMemo(() => {
    const m = {};
    source.forEach((b) => { (m[b.date] ||= []).push(b); });
    Object.values(m).forEach((arr) => arr.sort((a, b) => PERIOD_IDS.indexOf(a.periodId) - PERIOD_IDS.indexOf(b.periodId)));
    return m;
  }, [source]);
  const panelList = panelDate ? (byDate[panelDate] || []) : [];
  const selectedBooking = source.find((b) => b.id === selectedId) || null;

  useEffect(() => {
    if (scrollToDetail && selectedBooking && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollToDetail(false);
    }
  }, [scrollToDetail, selectedBooking]);

  const openDate = (iso) => { setPanelDate(iso); setSelectedId(null); };
  const openBooking = (b) => { setPanelDate(b.date); setSelectedId(b.id); setScrollToDetail(true); };
  const closePanel = () => { setPanelDate(null); setSelectedId(null); };

  const tableRows = useMemo(() => {
    const k = q.trim().toLowerCase();
    let rows = (allBookings || []).filter((b) => (status === 'all' || b.status === status) && (!k || b.studentId.includes(k) || b.studentName.toLowerCase().includes(k) || (b.targetUniversity || '').toLowerCase().includes(k)));
    const dir = sort.dir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      if (sort.key === 'date') { const c = a.date.localeCompare(b.date) || PERIOD_IDS.indexOf(a.periodId) - PERIOD_IDS.indexOf(b.periodId); return c * dir; }
      return String(a[sort.key] || '').localeCompare(String(b[sort.key] || '')) * dir;
    });
    return rows;
  }, [allBookings, q, status, sort]);
  const th = (key, label) => (
    <th className="sortable" onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}>
      <span className="row" style={{ gap: 4 }}>{label}<ArrowUpDown size={12} style={{ opacity: sort.key === key ? 1 : .35 }} /></span>
    </th>
  );

  return (
    <div>
      <div className="toolbar">
        <div className="subtabs accent-teal">
          <button className={`subtab ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>캘린더 뷰</button>
          <button className={`subtab ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>테이블 뷰</button>
        </div>
        {view === 'table' && <>
          <div className="row" style={{ position: 'relative' }}><Search size={16} style={{ position: 'absolute', left: 12, color: '#6B7280' }} /><input className="input search" style={{ paddingLeft: 34 }} placeholder="학번·이름·대학 검색" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">전체 상태</option><option value="before">시작전</option><option value="inProgress">진행중</option><option value="done">완료</option></select>
        </>}
        <div className="grow" />
        <button className="btn btn-teal btn-sm" onClick={() => setModal({ type: 'new', date: panelDate })}><Plus size={16} />새 신청 등록</button>
      </div>

      <div className="panel-wrap" style={{ alignItems: 'flex-start' }}>
        <div className="grow" style={{ minWidth: 0 }}>
          {view === 'calendar' ? (
            <div className="card" style={{ padding: 16 }}>
              {loading && !monthBookings.length ? <Spinner /> : (
                <MonthCalendar month={month} onMonthChange={setMonth} onSelect={openDate} accent="teal" renderCell={(c) => ({
                  selected: panelDate === c.iso,
                  content: (byDate[c.iso] || []).slice(0, 4).map((b) => (
                    <span key={b.id} className={`cal-chip ${b.status}`} title={`${b.studentId} ${b.studentName} · ${b.periodLabel}`}
                      onClick={(e) => { e.stopPropagation(); openBooking(b); }}>{b.studentId} {b.studentName} · {b.periodLabel}</span>
                  )).concat((byDate[c.iso] || []).length > 4 ? [<span key="more" className="xs muted">+{(byDate[c.iso] || []).length - 4}건</span>] : []),
                })} />
              )}
              <div className="chips mt-12"><span className="cal-chip before">시작전</span><span className="cal-chip inProgress">진행중</span><span className="cal-chip done">완료</span></div>
            </div>
          ) : (
            <div className="table-wrap">
              {!allBookings ? <Spinner /> : (
                <table className="tbl accent-teal">
                  <thead><tr>{th('date', '날짜')}<th>교시·시간</th>{th('studentId', '학번')}{th('studentName', '이름')}<th>희망 대학</th><th>전형</th>{th('status', '상태')}<th>담당교사</th></tr></thead>
                  <tbody>
                    {!tableRows.length && <tr><td colSpan={8} className="empty">신청 건이 없습니다.</td></tr>}
                    {tableRows.map((b) => (
                      <tr key={b.id} className={`clickable ${selectedId === b.id ? 'selected' : ''}`} onClick={() => openBooking(b)}>
                        <td>{formatKoDate(b.date)}</td><td>{b.periodLabel} <span className="muted xs">{b.timeRange}</span></td><td className="bold">{b.studentId}</td><td>{b.studentName}</td>
                        <td className="ellipsis" style={{ maxWidth: 200 }}>{b.targetUniversity}</td><td>{b.targetAdmissionType}</td><td><StatusBadge status={b.status} /></td><td>{b.feedbackTeacherName || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {panelDate && (
          <aside className="panel accent-teal" aria-label="신청 패널">
            <div className="panel-head">
              <b>{formatKoDate(panelDate)}</b>
              <div className="row"><button className="btn btn-outline btn-xs" onClick={() => setModal({ type: 'new', date: panelDate })}><Plus size={14} />새 신청 등록</button><button className="btn btn-ghost btn-icon" onClick={closePanel} aria-label="패널 닫기"><X size={18} /></button></div>
            </div>
            <div className="panel-body">
              <div className="panel-section-title">날짜별 신청 목록 ({panelList.length})</div>
              <div className="stack" style={{ gap: 6 }}>
                {!panelList.length && <div className="empty" style={{ padding: 20 }}>이 날짜에는 신청이 없어요.</div>}
                {panelList.map((b) => (
                  <div key={b.id} className={`booking-item ${selectedId === b.id ? 'selected' : ''}`} onClick={() => { setSelectedId(b.id); setScrollToDetail(true); }}>
                    <div><div className="bold small">{b.periodLabel} <span className="muted" style={{ fontWeight: 400 }}>{b.timeRange}</span></div><div className="small">{b.studentId} {b.studentName}</div></div>
                    <StatusBadge status={b.status} />
                  </div>
                ))}
              </div>
              <div className="divider" />
              <div ref={detailRef} style={{ scrollMarginTop: 60 }}>
                <div className="panel-section-title">신청 상세보기</div>
                {!selectedBooking ? <div className="empty" style={{ padding: 20 }}>목록에서 신청 건을 선택하세요.</div> : (
                  <BookingDetail booking={selectedBooking}
                    onInterview={() => nav(`/teacher/interview?bookingId=${encodeURIComponent(selectedBooking.id)}`)}
                    onEdit={() => setModal({ type: 'edit', booking: selectedBooking })}
                    onDelete={() => setModal({ type: 'delete', booking: selectedBooking })} />
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {modal?.type === 'new' && <NewBookingModal defaultDate={modal.date} teacherUid={user.uid} onClose={() => setModal(null)} onDone={async (b) => { setModal(null); await reload(); openBooking(b); }} />}
      {modal?.type === 'edit' && <EditBookingModal booking={modal.booking} teacherUid={user.uid} onClose={() => setModal(null)} onDone={async (newId) => { setModal(null); await reload(); if (newId) setSelectedId(newId); }} />}
      {modal?.type === 'delete' && <DeleteBookingModal booking={modal.booking} onClose={() => setModal(null)} onDone={async () => { setModal(null); setSelectedId(null); await reload(); }} />}
    </div>
  );
}

function BookingDetail({ booking: b, onInterview, onEdit, onDelete }) {
  const [fb, setFb] = useState(undefined);
  useEffect(() => { setFb(undefined); getFeedback(b.id).then(setFb).catch(() => setFb(null)); }, [b.id]);
  return (
    <div>
      <div className="row-between mb-12"><b>{b.studentId} {b.studentName}</b><StatusBadge status={b.status} /></div>
      <div className="kv">
        <span className="k">일시</span><span className="v">{formatKoDate(b.date)} {b.periodLabel} ({b.timeRange})</span>
        <span className="k">희망 대학</span><span className="v">{b.targetUniversity}</span>
        <span className="k">희망 전형</span><span className="v">{b.targetAdmissionType}</span>
        <span className="k">요청 사항</span><span className="v">{b.requests || '-'}</span>
        <span className="k">신청 일시</span><span className="v">{formatDateTime(b.createdAt)}{b.updatedBy ? ' (교사 수정)' : ''}</span>
        <span className="k">피드백</span><span className="v">{fb === undefined ? '…' : fb ? <span className="badge badge-green">등록됨 · {fb.teacherName}</span> : <span className="muted">없음</span>}</span>
      </div>
      <div className="row mt-16 wrap">
        <button className="btn btn-violet btn-sm" onClick={onInterview}><Play size={16} />면접 진행하기</button>
        <button className="btn btn-outline btn-sm" onClick={onEdit}><Pencil size={16} />수정</button>
        <button className="btn btn-danger-outline btn-sm" onClick={onDelete}><Trash2 size={16} />삭제</button>
      </div>
    </div>
  );
}

/* ── 새 신청 등록 (교사 직접) ── */
function NewBookingModal({ defaultDate, teacherUid, onClose, onDone }) {
  const [students, setStudents] = useState(null);
  const [q, setQ] = useState('');
  const [student, setStudent] = useState(null);
  const [f, setF] = useState({ date: defaultDate || '', periodId: 'p1', targetUniversity: '', targetAdmissionType: '', requests: '' });
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState('');
  useEffect(() => { listStudents().then((l) => setStudents(l.filter((s) => s.status === 'approved'))); }, []);
  const matches = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!students || !k) return [];
    return students.filter((s) => s.studentId.includes(k) || s.name.toLowerCase().includes(k)).slice(0, 8);
  }, [students, q]);
  useEffect(() => {
    if (!student || !f.date) return setWarn('');
    (async () => {
      const w = [];
      if (f.date < minBookableIso()) w.push('학생 신청 기준(3일 이후)보다 이른 날짜입니다.');
      const dayBookings = await getBookingsRange(f.date, f.date);
      if (dayBookings.filter((b) => b.studentId === student.studentId).length >= MAX_BOOKINGS_PER_DAY) w.push(`이 학생은 이 날 이미 ${MAX_BOOKINGS_PER_DAY}건을 신청했습니다.`);
      setWarn(w.join(' '));
    })();
  }, [student, f.date]);
  const submit = async (e) => {
    e.preventDefault();
    if (!student) return toast.error('학생을 선택하세요.');
    setBusy(true);
    try {
      await createBookingAsTeacher({ student, dateIso: f.date, periodId: f.periodId, targetUniversity: f.targetUniversity.trim(), targetAdmissionType: f.targetAdmissionType.trim(), requests: f.requests.trim(), teacherUid });
      toast.success('신청을 등록했습니다.');
      onDone({ id: `${f.date}_${f.periodId}`, date: f.date });
    } catch (e2) {
      if (e2.code === 'SLOT_TAKEN') toast.error('이미 예약된 교시입니다. 다른 교시를 선택하세요.'); else toast.error(errMsg(e2));
    } finally { setBusy(false); }
  };
  return (
    <Modal title="새 신청 등록" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="학생 (승인된 학생만)" required>
          {student ? (
            <div className="row-between"><span className="badge badge-teal" style={{ fontSize: 14 }}>{student.studentId} {student.name}</span><button type="button" className="btn btn-ghost btn-xs" onClick={() => { setStudent(null); setQ(''); }}>변경</button></div>
          ) : (
            <>
              <input className="input" placeholder="학번·이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
              {!!matches.length && <div className="stack mt-8" style={{ gap: 4 }}>{matches.map((s) => <button type="button" key={s.studentId} className="booking-item" onClick={() => { setStudent(s); setF((x) => ({ ...x, targetAdmissionType: x.targetAdmissionType || s.admissionType || '' })); }}><span>{s.studentId} {s.name}</span><span className="xs muted">{s.track} {s.admissionType}</span></button>)}</div>}
              {students && q && !matches.length && <div className="xs muted mt-8">일치하는 승인 학생이 없습니다.</div>}
            </>
          )}
        </Field>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <Field label="날짜" required><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></Field>
          <Field label="교시" required><select className="select" value={f.periodId} onChange={(e) => setF({ ...f, periodId: e.target.value })}>{PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label} {p.time}</option>)}</select></Field>
        </div>
        {warn && <div className="form-warn">{warn} (교사 등록은 제한 없이 진행됩니다.)</div>}
        <Field label="희망 대학" required><input className="input" value={f.targetUniversity} onChange={(e) => setF({ ...f, targetUniversity: e.target.value })} required /></Field>
        <Field label="희망 전형" required><input className="input" value={f.targetAdmissionType} onChange={(e) => setF({ ...f, targetAdmissionType: e.target.value })} required /></Field>
        <Field label="요청 사항"><textarea className="textarea" rows={3} maxLength={REQUESTS_MAX_LEN} value={f.requests} onChange={(e) => setF({ ...f, requests: e.target.value })} /></Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn-outline" onClick={onClose}>취소</button><button className="btn btn-teal" disabled={busy || !student}>{busy ? '등록 중…' : '등록'}</button></div>
      </form>
    </Modal>
  );
}

/* ── 수정 (이메일 발송 체크박스, 기본 체크) ── */
function EditBookingModal({ booking: b, teacherUid, onClose, onDone }) {
  const [f, setF] = useState({ date: b.date, periodId: b.periodId, targetUniversity: b.targetUniversity, targetAdmissionType: b.targetAdmissionType, requests: b.requests || '' });
  const [mail, setMail] = useState(true);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const before = `${formatKoDate(b.date)} ${b.periodLabel} (${b.timeRange})`;
      const after = `${formatKoDate(f.date)} ${PERIOD_MAP[f.periodId].label} (${PERIOD_MAP[f.periodId].time})`;
      const res = await updateBookingAsTeacher(b, f, teacherUid);
      let msg = '수정했습니다.';
      if (mail) {
        const r = await sendMailSafe({ studentId: b.studentId, templateKey: 'scheduleChanged', vars: bookingVars({ ...b, date: f.date, periodLabel: PERIOD_MAP[f.periodId].label, timeRange: PERIOD_MAP[f.periodId].time }, { '[변경내역]': `변경 전: ${before}\n변경 후: ${after}` }) });
        if (r.ok === false) toast.error(`메일 발송 실패: ${r.error || ''}`); else msg += ' 안내 메일을 발송했습니다.';
      }
      toast.success(msg);
      onDone(res.newId);
    } catch (e2) {
      if (e2.code === 'SLOT_TAKEN') toast.error('변경하려는 교시에 이미 다른 신청이 있습니다.'); else toast.error(errMsg(e2));
    } finally { setBusy(false); }
  };
  return (
    <Modal title="신청 수정" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-info">{b.studentId} {b.studentName} · 현재: {formatKoDate(b.date)} {b.periodLabel}</div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <Field label="날짜" required><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></Field>
          <Field label="교시" required><select className="select" value={f.periodId} onChange={(e) => setF({ ...f, periodId: e.target.value })}>{PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label} {p.time}</option>)}</select></Field>
        </div>
        <Field label="희망 대학" required><input className="input" value={f.targetUniversity} onChange={(e) => setF({ ...f, targetUniversity: e.target.value })} required /></Field>
        <Field label="희망 전형" required><input className="input" value={f.targetAdmissionType} onChange={(e) => setF({ ...f, targetAdmissionType: e.target.value })} required /></Field>
        <Field label="요청 사항"><textarea className="textarea" rows={3} maxLength={REQUESTS_MAX_LEN} value={f.requests} onChange={(e) => setF({ ...f, requests: e.target.value })} /></Field>
        <label className="checkbox mb-16"><input type="checkbox" checked={mail} onChange={(e) => setMail(e.target.checked)} /><span>학생에게 이메일 발송 (변경 전·후 일정 안내)</span></label>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn-outline" onClick={onClose}>취소</button><button className="btn btn-teal" disabled={busy}>{busy ? '저장 중…' : '저장'}</button></div>
      </form>
    </Modal>
  );
}

/* ── 삭제 ── */
function DeleteBookingModal({ booking: b, onClose, onDone }) {
  const [mail, setMail] = useState(true);
  const [busy, setBusy] = useState(false);
  const del = async () => {
    setBusy(true);
    try {
      await deleteBookingAsTeacher(b);
      let msg = '삭제했습니다.';
      if (mail) {
        const r = await sendMailSafe({ studentId: b.studentId, templateKey: 'scheduleDeleted', vars: bookingVars(b, { '[변경내역]': `취소된 일정: ${formatKoDate(b.date)} ${b.periodLabel} (${b.timeRange})` }) });
        if (r.ok === false) toast.error(`메일 발송 실패: ${r.error || ''}`); else msg += ' 안내 메일을 발송했습니다.';
      }
      toast.success(msg);
      onDone();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title="신청 삭제" onClose={onClose} footer={<><button className="btn btn-outline" onClick={onClose} disabled={busy}>취소</button><button className="btn btn-danger" onClick={del} disabled={busy}>{busy ? '삭제 중…' : '삭제'}</button></>}>
      <p>{b.studentId} {b.studentName} · {formatKoDate(b.date)} {b.periodLabel} ({b.timeRange}) 신청을 삭제합니다.</p>
      {b.status === 'done' && <div className="form-warn mt-12">완료된 건입니다. 피드백 문서는 유지되지만 학생 화면에서는 더 이상 보이지 않습니다.</div>}
      <label className="checkbox mt-12"><input type="checkbox" checked={mail} onChange={(e) => setMail(e.target.checked)} /><span>학생에게 이메일 발송 (취소된 일정 안내)</span></label>
    </Modal>
  );
}
