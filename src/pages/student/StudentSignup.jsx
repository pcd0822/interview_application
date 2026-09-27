import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { fns, errMsg } from '../../lib/firebase';
import { CONSENT_TEXT, PASSWORD_MIN_LEN } from '../../lib/constants';
import { Field } from '../../components/common';

/** S2 학생 회원가입 */
export default function StudentSignup() {
  const nav = useNavigate();
  const [f, setF] = useState({ studentId: '', name: '', password: '', password2: '', email: '', consent: false });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const valid = f.studentId.trim() && f.name.trim() && f.password.length >= PASSWORD_MIN_LEN && f.password === f.password2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) && f.consent;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (f.password !== f.password2) return setErr('비밀번호가 서로 일치하지 않습니다.');
    if (f.password.length < PASSWORD_MIN_LEN) return setErr(`비밀번호는 ${PASSWORD_MIN_LEN}자 이상이어야 합니다.`);
    setBusy(true);
    try {
      await fns.registerStudent({ studentId: f.studentId.trim(), name: f.name.trim(), password: f.password, email: f.email.trim(), consentAgreed: true });
      nav('/student/pending', { state: { gate: 'pending', justSignedUp: true } });
    } catch (e2) {
      setErr(errMsg(e2));
    } finally { setBusy(false); }
  };

  return (
    <div className="s-shell">
      <div className="hero-blob" />
      <form className="auth-card card" onSubmit={submit}>
        <h1 className="auth-title">학생 회원가입</h1>
        <p className="auth-sub">선생님이 등록한 학번·이름과 정확히 일치해야 가입할 수 있어요.</p>
        {err && <div className="form-error" role="alert">{err}</div>}
        <Field label="학번" required><input className="input" inputMode="numeric" autoComplete="username" value={f.studentId} onChange={set('studentId')} placeholder="예: 20301" required /></Field>
        <Field label="이름" required><input className="input" value={f.name} onChange={set('name')} placeholder="이름" required /></Field>
        <Field label="비밀번호" required hint={`${PASSWORD_MIN_LEN}자 이상`}><input className="input" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} required minLength={PASSWORD_MIN_LEN} /></Field>
        <Field label="비밀번호 확인" required><input className={`input ${f.password2 && f.password !== f.password2 ? 'error' : ''}`} type="password" autoComplete="new-password" value={f.password2} onChange={set('password2')} required /></Field>
        <Field label="안내 받을 구글 이메일" required hint="승인·일정 변경·피드백 등록 안내 메일을 받을 주소"><input className="input" type="email" inputMode="email" value={f.email} onChange={set('email')} placeholder="example@gmail.com" required /></Field>

        <details className="consent-box mb-12">
          <summary>{CONSENT_TEXT.title} 전문 보기 <ChevronDown size={18} /></summary>
          <p className="mt-8">{CONSENT_TEXT.intro}</p>
          <ol>{CONSENT_TEXT.items.map((t, i) => <li key={i}>{t}</li>)}</ol>
        </details>
        <label className="checkbox mb-16">
          <input type="checkbox" checked={f.consent} onChange={set('consent')} />
          <span>{CONSENT_TEXT.check}</span>
        </label>
        <button className="btn btn-full" type="submit" disabled={!valid || busy}>{busy ? '가입 신청 중…' : '가입 신청'}</button>
        <p className="small muted mt-16" style={{ textAlign: 'center' }}>이미 계정이 있나요? <Link to="/student/login">로그인</Link></p>
      </form>
    </div>
  );
}
