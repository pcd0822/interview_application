import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { PageHeader, TEACHER_MENUS } from './TeacherLayout';
import { listStudents, getUpcomingBookings } from '../../lib/api';
import { todayIso } from '../../lib/date';
import { useAuth } from '../../store/auth';

/** 대시보드 홈: 요약 카드 + 바로가기 */
export default function Dashboard() {
  const { teacher, user } = useAuth();
  const [stat, setStat] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const [students, bookings] = await Promise.all([listStudents(), getUpcomingBookings(todayIso())]);
        const today = todayIso();
        setStat({
          pending: students.filter((s) => s.status === 'pending').length,
          today: bookings.filter((b) => b.date === today).length,
          inProgress: bookings.filter((b) => b.status === 'inProgress').length,
          upcoming: bookings.filter((b) => b.status === 'before').length,
        });
      } catch { setStat({}); }
    })();
  }, []);
  return (
    <div>
      <PageHeader icon={LayoutDashboard} title="대시보드" accent="accent-blue" />
      <div className="card mb-16">
        <h2 style={{ fontSize: 18 }}>안녕하세요, {teacher?.displayName || user?.displayName} 선생님</h2>
        <p className="muted small mt-8">왼쪽 메뉴에서 학생관리 → 일정관리 → 모의면접 → 일지관리 순서로 운영할 수 있어요.</p>
      </div>
      <div className="stat-grid mb-24">
        <Link to="/teacher/students" className="card stat accent-blue"><div className="k">가입 대기</div><div className="v" style={{ color: 'var(--accent)' }}>{stat ? `${stat.pending ?? 0}명` : '…'}</div></Link>
        <Link to="/teacher/schedule" className="card stat accent-teal"><div className="k">오늘 면접</div><div className="v" style={{ color: 'var(--accent)' }}>{stat ? `${stat.today ?? 0}건` : '…'}</div></Link>
        <Link to="/teacher/interview" className="card stat accent-violet"><div className="k">진행중</div><div className="v" style={{ color: 'var(--accent)' }}>{stat ? `${stat.inProgress ?? 0}건` : '…'}</div></Link>
        <Link to="/teacher/schedule" className="card stat accent-orange"><div className="k">예정(시작전)</div><div className="v" style={{ color: 'var(--accent)' }}>{stat ? `${stat.upcoming ?? 0}건` : '…'}</div></Link>
      </div>
      <div className="stat-grid">
        {TEACHER_MENUS.map((m) => (
          <Link key={m.to} to={m.to} className={`card ${m.accent}`} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="icon" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-bg)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}><m.icon size={22} /></span>
            <b style={{ color: 'var(--text)' }}>{m.label}</b>
          </Link>
        ))}
      </div>
    </div>
  );
}
