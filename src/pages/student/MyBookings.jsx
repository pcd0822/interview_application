import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FileText } from 'lucide-react';
import { useAuth } from '../../store/auth';
import { StatusBadge, Spinner } from '../../components/common';
import { subscribeMyBookings } from '../../lib/api';
import { formatKoDate } from '../../lib/date';

/** S7 내 신청 목록 */
export default function MyBookings() {
  const { student } = useAuth();
  const nav = useNavigate();
  const [list, setList] = useState(null);
  useEffect(() => subscribeMyBookings(student.studentId, setList), [student.studentId]);

  if (!list) return <Spinner />;
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>내 신청</h2>
      {!list.length && <div className="card empty">아직 신청한 모의면접이 없어요.<br />신청 캘린더에서 원하는 날짜와 교시를 골라 보세요.</div>}
      <div className="stack">
        {list.map((b) => {
          const done = b.status === 'done';
          return (
            <div key={b.id} className={`bk-card ${done ? 'link' : ''}`} role={done ? 'button' : undefined} tabIndex={done ? 0 : -1}
              onClick={() => done && nav(`/student/bookings/${b.id}`)} onKeyDown={(e) => done && e.key === 'Enter' && nav(`/student/bookings/${b.id}`)}>
              <div className="row-between">
                <div className="bk-date">{formatKoDate(b.date)}</div>
                <StatusBadge status={b.status} />
              </div>
              <div className="bk-meta">{b.periodLabel} · {b.timeRange}</div>
              <div className="bk-meta">{b.targetUniversity} · {b.targetAdmissionType}</div>
              {done && <div className="row mt-8" style={{ color: '#2563EB', fontWeight: 600, fontSize: 14 }}><FileText size={16} />피드백 보기 <ChevronRight size={16} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
