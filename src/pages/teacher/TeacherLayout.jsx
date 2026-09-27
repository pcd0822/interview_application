import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Menu, Users, CalendarDays, MessagesSquare, ClipboardList, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../../store/auth';
import SettingsModal from './SettingsModal';

export const TEACHER_MENUS = [
  { to: '/teacher/students', label: '학생관리', icon: Users, accent: 'accent-blue' },
  { to: '/teacher/schedule', label: '일정관리', icon: CalendarDays, accent: 'accent-teal' },
  { to: '/teacher/interview', label: '모의면접', icon: MessagesSquare, accent: 'accent-violet' },
  { to: '/teacher/log', label: '일지관리', icon: ClipboardList, accent: 'accent-orange' },
];

/** T2 교사 대시보드 레이아웃 */
export default function TeacherLayout() {
  const { user, teacher, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('t-sidebar') === '1'; } catch { return false; } });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { pathname } = useLocation();
  const current = TEACHER_MENUS.find((m) => pathname.startsWith(m.to));
  const toggle = () => { setCollapsed((c) => { try { localStorage.setItem('t-sidebar', c ? '0' : '1'); } catch { /* ignore */ } return !c; }); };
  const name = teacher?.displayName || user?.displayName || '교사';
  const photo = teacher?.photoURL || user?.photoURL;

  return (
    <div className={`t-shell ${current?.accent || 'accent-blue'}`}>
      <aside className={`t-sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="사이드바">
        <div className="t-side-head">
          <button className="btn btn-ghost btn-icon" onClick={toggle} aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}><Menu size={20} /></button>
          <b>모의면접 관리</b>
        </div>
        <nav className="t-nav">
          {TEACHER_MENUS.map((m) => (
            <NavLink key={m.to} to={m.to} className={({ isActive }) => `t-nav-item ${m.accent} ${isActive ? 'active' : ''}`} title={m.label}>
              <m.icon size={20} /><span className="t-nav-label">{m.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="t-side-foot">
          <button className="t-nav-item" onClick={signOut} title="로그아웃"><LogOut size={20} /><span className="t-nav-label">로그아웃</span></button>
        </div>
      </aside>
      <div className="t-main">
        <header className="t-topbar">
          <div className="bold" style={{ color: 'var(--accent)' }}>{current?.label || '대시보드'}</div>
          <div className="row" style={{ gap: 12 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setSettingsOpen(true)}><Settings size={16} />인증키 변경</button>
            <div className="t-profile">
              {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : <div className="avatar">{name.slice(0, 1)}</div>}
              <span className="small bold">{name}</span>
            </div>
          </div>
        </header>
        <main className="t-content"><Outlet /></main>
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export function PageHeader({ icon: Icon, title, accent, children }) {
  return (
    <div className={`page-head ${accent}`}>
      <div className="page-title"><span className="icon"><Icon size={22} /></span>{title}</div>
      <div className="row wrap">{children}</div>
    </div>
  );
}
