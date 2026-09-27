import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './store/auth';
import { isConfigured } from './lib/firebase';
import { Toasts, Spinner } from './components/common';

import LoginSelect from './pages/student/LoginSelect';
import StudentSignup from './pages/student/StudentSignup';
import StudentLogin from './pages/student/StudentLogin';
import PendingNotice from './pages/student/PendingNotice';
import ChangePassword from './pages/student/ChangePassword';
import StudentShell from './pages/student/StudentShell';
import StudentCalendar from './pages/student/StudentCalendar';
import MyBookings from './pages/student/MyBookings';
import FeedbackDetail from './pages/student/FeedbackDetail';

import TeacherKey from './pages/teacher/TeacherKey';
import TeacherLayout from './pages/teacher/TeacherLayout';
import Dashboard from './pages/teacher/Dashboard';
import StudentsPage from './pages/teacher/StudentsPage';
import SchedulePage from './pages/teacher/SchedulePage';
import InterviewPage from './pages/teacher/InterviewPage';
import LogPage from './pages/teacher/LogPage';

function RequireStudent({ children }) {
  const { loading, role, student } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (role !== 'student') return <Navigate to="/student/login" replace />;
  if (student?.mustChangePassword && loc.pathname !== '/student/change-password') return <Navigate to="/student/change-password" replace />;
  return children;
}
function RequireTeacher({ children }) {
  const { loading, role } = useAuth();
  if (loading) return <Spinner />;
  if (role !== 'teacher') return <Navigate to="/teacher/login" replace />;
  return children;
}
function PublicOnly({ children }) {
  const { loading, role } = useAuth();
  if (loading) return <Spinner />;
  if (role === 'student') return <Navigate to="/student" replace />;
  if (role === 'teacher') return <Navigate to="/teacher" replace />;
  return children;
}

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => { if (isConfigured) init(); }, [init]);
  if (!isConfigured) {
    return (
      <div className="s-shell"><div className="hero-blob" />
        <div className="auth-card card">
          <h1 className="auth-title" style={{ fontSize: 20 }}>Firebase 설정이 필요합니다</h1>
          <p className="auth-sub">.env.example 을 복사해 .env 를 만들고 VITE_FIREBASE_* 값을 채운 뒤 다시 실행하세요. Netlify에서는 환경변수로 등록합니다.</p>
        </div>
      </div>
    );
  }
  return (
    <>
      <Toasts />
      <Routes>
        <Route path="/" element={<PublicOnly><LoginSelect /></PublicOnly>} />
        <Route path="/student/login" element={<PublicOnly><StudentLogin /></PublicOnly>} />
        <Route path="/student/signup" element={<PublicOnly><StudentSignup /></PublicOnly>} />
        <Route path="/student/pending" element={<PendingNotice />} />
        <Route path="/student/change-password" element={<RequireStudent><ChangePassword /></RequireStudent>} />
        <Route path="/student" element={<RequireStudent><StudentShell /></RequireStudent>}>
          <Route index element={<StudentCalendar />} />
          <Route path="bookings" element={<MyBookings />} />
          <Route path="bookings/:bookingId" element={<FeedbackDetail />} />
        </Route>

        <Route path="/teacher/login" element={<PublicOnly><TeacherKey /></PublicOnly>} />
        <Route path="/teacher" element={<RequireTeacher><TeacherLayout /></RequireTeacher>}>
          <Route index element={<Dashboard />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="interview" element={<InterviewPage />} />
          <Route path="log" element={<LogPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
