import { useNavigate } from 'react-router-dom';
import { GraduationCap, UserRound, ChevronRight } from 'lucide-react';
import { SCHOOL_NAME } from '../../lib/constants';

/** S1 로그인 선택 */
export default function LoginSelect() {
  const nav = useNavigate();
  return (
    <div className="s-shell">
      <div className="hero-blob" />
      <div className="auth-card card">
        <div className="muted small mb-8">{SCHOOL_NAME}</div>
        <h1 className="auth-title">모의면접 신청 시스템</h1>
        <p className="auth-sub">모의면접 일정을 신청하고, 피드백을 받아 보세요.</p>
        <div className="stack">
          <button className="role-btn" onClick={() => nav('/student/login')}>
            <div className="role-icon"><GraduationCap size={26} /></div>
            <div className="grow"><b>학생</b><span>학번과 비밀번호로 로그인</span></div>
            <ChevronRight className="muted" />
          </button>
          <button className="role-btn" onClick={() => nav('/teacher/login')}>
            <div className="role-icon" style={{ background: '#F5F3FF', color: '#7C3AED' }}><UserRound size={26} /></div>
            <div className="grow"><b>교사</b><span>인증키 확인 후 Google 로그인</span></div>
            <ChevronRight className="muted" />
          </button>
        </div>
        <p className="muted xs mt-24" style={{ textAlign: 'center' }}>처음 이용하는 학생은 학생 로그인 화면에서 회원가입을 진행해 주세요.</p>
      </div>
    </div>
  );
}
