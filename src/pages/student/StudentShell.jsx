import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { CalendarDays, ListChecks, LogOut } from 'lucide-react';
import { useAuth } from '../../store/auth';

/** 학생 공통 셸: 상단바 + 하단 탭바 (모바일 우선, 최대 폭 640px) */
export default function StudentShell() {
  const { student, signOut } = useAuth();
  const { pathname } = useLocation();
  const isBookings = pathname.startsWith('/student/bookings');
  return (
    <div className="s-shell">
      <div className="hero-blob" style={{ height: 180 }} />
      <div className="s-container">
        <div className="s-topbar">
          <div>
            <div className="s-brand">모의면접 신청</div>
            <div className="xs muted">{student?.name} · {student?.studentId}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={signOut} aria-label="로그아웃"><LogOut size={18} />로그아웃</button>
        </div>
        <Outlet />
      </div>
      <nav className="s-tabbar" aria-label="하단 메뉴">
        <div className="s-tabbar-inner">
          <NavLink to="/student" end className={({ isActive }) => `s-tab ${isActive ? 'active' : ''}`}><CalendarDays size={22} />신청 캘린더</NavLink>
          <NavLink to="/student/bookings" className={`s-tab ${isBookings ? 'active' : ''}`}><ListChecks size={22} />내 신청</NavLink>
        </div>
      </nav>
    </div>
  );
}
