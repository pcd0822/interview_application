import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Lock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../store/auth';
import { MonthCalendar, Sheet, Field, Spinner } from '../../components/common';
import { PERIODS, MAX_BOOKINGS_PER_DAY, REQUESTS_MAX_LEN } from '../../lib/constants';
import { monthRange, isBookableDate, formatKoDate, minBookableIso } from '../../lib/date';
import { getAvailabilityRange, getSlotStatusRange, getMyBookings, createBookingAsStudent } from '../../lib/api';
import { toast } from '../../store/toast';
import { errMsg } from '../../lib/firebase';

/** S5 학생 신청 캘린더 + S6 신청 폼 시트 */
export default function StudentCalendar() {
  const { student } = useAuth();
  const [month, setMonth] = useState(new Date());
  const [avail, setAvail] = useState({});     // {date: openPeriods[]}
  const [taken, setTaken] = useState({});     // {date: takenPeriods[]} (학생 정보 없음)
  const [mine, setMine] = useState([]);       // 내 신청
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // dateIso
  const [form, setForm] = useState(null);         // {dateIso, periodId}

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = monthRange(month);
      const [a, t, m] = await Promise.all([getAvailabilityRange(start, end), getSlotStatusRange(start, end), getMyBookings(student.studentId)]);
      setAvail(a); setTaken(t); setMine(m);
    } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }, [month, student.studentId]);
  useEffect(() => { load(); }, [load]);

  const mineByDate = useMemo(() => {
    const m = {};
    mine.forEach((b) => { (m[b.date] ||= []).push(b.periodId); });
    return m;
  }, [mine]);

  const availableCount = (iso) => {
    const open = avail[iso] || [];
    const tk = new Set(taken[iso] || []);
    return open.filter((p) => !tk.has(p)).length;
  };

  const renderCell = (c) => {
    const bookable = isBookableDate(c.iso);
    const open = avail[c.iso] || [];
    const myCount = (mineByDate[c.iso] || []).length;
    let sub = null;
    if (myCount) sub = <span className="cal-sub ok">내 신청 {myCount}</span>;
    else if (!bookable) sub = null;
    else if (!open.length) sub = <span className="cal-sub full">마감</span>;
    else {
      const n = availableCount(c.iso);
      sub = n ? <span className="cal-sub ok">신청 가능 {n}개</span> : <span className="cal-sub full">마감</span>;
    }
    return { sub, disabled: !bookable && !myCount, selected: selected === c.iso };
  };

  const slots = selected ? PERIODS.map((p) => {
    const open = (avail[selected] || []).includes(p.id);
    const isMine = (mineByDate[selected] || []).includes(p.id);
    const isTaken = (taken[selected] || []).includes(p.id);
    let state = 'closed';
    if (isMine) state = 'mine'; else if (!open) state = 'closed'; else if (isTaken) state = 'taken'; else state = 'open';
    return { ...p, state };
  }) : [];
  const myCountSelected = selected ? (mineByDate[selected] || []).length : 0;
  const selectedBookable = selected ? isBookableDate(selected) : false;

  const pick = (p) => {
    if (!selectedBookable) return toast.info('면접 준비를 위해 신청일 기준 3일 이후부터 신청할 수 있어요.');
    if (myCountSelected >= MAX_BOOKINGS_PER_DAY) return toast.info(`하루 최대 ${MAX_BOOKINGS_PER_DAY}교시까지 신청할 수 있어요.`);
    setForm({ dateIso: selected, periodId: p.id });
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>신청 캘린더</h2>
      <div className="form-info row" style={{ alignItems: 'flex-start' }}><Info size={16} style={{ flexShrink: 0, marginTop: 3 }} /><span>면접 준비를 위해 신청일 기준 3일 이후부터 신청할 수 있어요. (가장 빠른 날짜: {formatKoDate(minBookableIso())})</span></div>
      <div className="card" style={{ padding: 14 }}>
        {loading && !Object.keys(avail).length ? <Spinner /> : (
          <MonthCalendar month={month} onMonthChange={(m) => { setMonth(m); setSelected(null); }} onSelect={setSelected} renderCell={renderCell} />
        )}
      </div>

      {selected && (
        <Sheet title={formatKoDate(selected)} onClose={() => setSelected(null)}>
          {!selectedBookable && <div className="form-warn">이 날짜는 신청 기간이 지났어요. 기존 신청만 확인할 수 있습니다.</div>}
          {selectedBookable && !(avail[selected] || []).length && <div className="empty">이 날은 신청 가능한 교시가 없어요.</div>}
          <div className="stack">
            {slots.filter((s) => s.state !== 'closed').map((s) => (
              <div key={s.id} className={`slot ${s.state}`}>
                <div><div className="slot-name">{s.label}</div><div className="slot-time">{s.time}</div></div>
                {s.state === 'open' && <button className="btn btn-sm" onClick={() => pick(s)} disabled={myCountSelected >= MAX_BOOKINGS_PER_DAY || !selectedBookable}>신청</button>}
                {s.state === 'taken' && <span className="badge badge-gray"><Lock size={12} />예약완료</span>}
                {s.state === 'mine' && <span className="badge badge-blue"><CheckCircle2 size={12} />내 신청</span>}
              </div>
            ))}
          </div>
          {myCountSelected >= MAX_BOOKINGS_PER_DAY && <p className="small muted mt-12">하루 최대 {MAX_BOOKINGS_PER_DAY}교시까지 신청할 수 있어요.</p>}
          <p className="xs muted mt-12">신청 후에는 직접 취소·변경할 수 없어요. 변경이 필요하면 담당 선생님께 요청해 주세요.</p>
        </Sheet>
      )}

      {form && (
        <BookingFormSheet
          student={student} dateIso={form.dateIso} periodId={form.periodId}
          onClose={() => setForm(null)}
          onDone={() => { setForm(null); setSelected(null); load(); }}
          onConflict={() => { setForm(null); load(); }}
        />
      )}
    </div>
  );
}

/** S6 신청 폼 시트 */
function BookingFormSheet({ student, dateIso, periodId, onClose, onDone, onConflict }) {
  const p = PERIODS.find((x) => x.id === periodId);
  const [f, setF] = useState({ targetUniversity: '', targetAdmissionType: student.admissionType || '', requests: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await createBookingAsStudent({ student, dateIso, periodId, ...f, targetUniversity: f.targetUniversity.trim(), targetAdmissionType: f.targetAdmissionType.trim(), requests: f.requests.trim() });
      toast.success('신청이 완료되었어요.');
      onDone();
    } catch (e2) {
      if (e2.code === 'SLOT_TAKEN' || e2.code === 'permission-denied') {
        toast.error('방금 다른 학생이 신청했어요. 다른 시간을 선택해 주세요.');
        onConflict();
      } else if (e2.code === 'DAILY_LIMIT') {
        toast.error(`하루 최대 ${MAX_BOOKINGS_PER_DAY}교시까지 신청할 수 있어요.`);
        onConflict();
      } else if (e2.code === 'SLOT_CLOSED') {
        toast.error('선생님이 이 교시를 닫았어요. 다른 시간을 선택해 주세요.');
        onConflict();
      } else setErr(errMsg(e2));
    } finally { setBusy(false); }
  };
  return (
    <Sheet title="모의면접 신청" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="chips mb-16">
          <span className="chip" style={{ background: '#EFF4FF', color: '#1D4ED8' }}>{formatKoDate(dateIso)}</span>
          <span className="chip" style={{ background: '#EFF4FF', color: '#1D4ED8' }}>{p.label} {p.time}</span>
        </div>
        {err && <div className="form-error">{err}</div>}
        <Field label="희망 대학" required><input className="input" value={f.targetUniversity} onChange={(e) => setF({ ...f, targetUniversity: e.target.value })} placeholder="예: ○○대학교 ○○학과" required maxLength={100} /></Field>
        <Field label="희망 전형" required><input className="input" value={f.targetAdmissionType} onChange={(e) => setF({ ...f, targetAdmissionType: e.target.value })} placeholder="예: 학생부종합전형" required maxLength={60} /></Field>
        <Field label="요청 사항" hint="선택 사항이에요. 준비한 예상 질문, 특히 연습하고 싶은 부분 등을 적어 주세요.">
          <textarea className="textarea" value={f.requests} onChange={(e) => setF({ ...f, requests: e.target.value.slice(0, REQUESTS_MAX_LEN) })} maxLength={REQUESTS_MAX_LEN} rows={4} />
          <div className="counter">{f.requests.length}/{REQUESTS_MAX_LEN}</div>
        </Field>
        <div className="form-warn">신청 후에는 직접 취소·변경할 수 없어요. 변경이 필요하면 담당 선생님께 요청해 주세요.</div>
        <button className="btn btn-full" type="submit" disabled={busy}>{busy ? '신청 중…' : '신청하기'}</button>
      </form>
    </Sheet>
  );
}
