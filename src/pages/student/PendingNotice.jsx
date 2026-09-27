import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, XCircle } from 'lucide-react';
import { useAuth } from '../../store/auth';

/** S4 승인 대기 안내 (반려 안내 포함) */
export default function PendingNotice() {
  const nav = useNavigate();
  const { state } = useLocation();
  const clearGate = useAuth((s) => s.clearGate);
  const gate = state?.gate || 'pending';
  const rejected = gate === 'rejected';
  const go = () => { clearGate(); nav('/student/login', { replace: true }); };
  return (
    <div className="s-shell">
      <div className="hero-blob" />
      <div className="auth-card card" style={{ textAlign: 'center' }}>
        <div className="role-icon" style={{ margin: '0 auto 16px', width: 64, height: 64, borderRadius: 20, background: rejected ? '#FEE2E2' : '#EFF4FF', color: rejected ? '#B91C1C' : '#2563EB' }}>
          {rejected ? <XCircle size={34} /> : <Clock size={34} />}
        </div>
        {rejected ? (
          <>
            <h1 className="auth-title" style={{ fontSize: 20 }}>가입이 반려되었습니다.</h1>
            <p className="auth-sub">담당 선생님께 문의하세요.</p>
          </>
        ) : (
          <>
            <h1 className="auth-title" style={{ fontSize: 20 }}>가입 승인 대기 중입니다.</h1>
            <p className="auth-sub">{state?.justSignedUp ? '가입 신청이 접수되었어요. ' : ''}담당 선생님이 승인하면 등록한 이메일로 안내해 드려요.</p>
          </>
        )}
        <button className="btn btn-full" onClick={go}>로그인 화면으로</button>
      </div>
    </div>
  );
}
