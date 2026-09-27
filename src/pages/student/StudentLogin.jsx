import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, errMsg } from '../../lib/firebase';
import { studentEmail } from '../../lib/constants';
import { useAuth } from '../../store/auth';
import { Field } from '../../components/common';

/** S3 학생 로그인 — 학번 + 비밀번호만 입력 (가상 이메일은 노출하지 않음) */
export default function StudentLogin() {
  const nav = useNavigate();
  const gate = useAuth((s) => s.studentGate);
  const [f, setF] = useState({ studentId: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // 로그인 후 pending/rejected로 판정되어 로그아웃된 경우 안내 화면으로
  useEffect(() => { if (gate) nav('/student/pending', { replace: true, state: { gate } }); }, [gate, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, studentEmail(f.studentId.trim()), f.password);
      // 이후 라우팅은 auth store(onAuthStateChanged)가 status를 보고 결정
    } catch (e2) {
      setErr(errMsg(e2, '학번 또는 비밀번호가 올바르지 않습니다.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="s-shell">
      <div className="hero-blob" />
      <form className="auth-card card" onSubmit={submit}>
        <h1 className="auth-title">학생 로그인</h1>
        <p className="auth-sub">학번과 비밀번호를 입력하세요.</p>
        {err && <div className="form-error" role="alert">{err}</div>}
        <Field label="학번"><input className="input" inputMode="numeric" autoComplete="username" value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })} placeholder="예: 20301" required /></Field>
        <Field label="비밀번호"><input className="input" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
        <button className="btn btn-full" type="submit" disabled={busy || !f.studentId || !f.password}>{busy ? '로그인 중…' : '로그인'}</button>
        <p className="small muted mt-16" style={{ textAlign: 'center' }}>처음이신가요? <Link to="/student/signup">회원가입</Link></p>
        <p className="xs muted mt-8" style={{ textAlign: 'center' }}><Link to="/teacher/login" style={{ color: '#6B7280' }}>교사로 로그인</Link></p>
      </form>
    </div>
  );
}
