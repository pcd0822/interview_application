import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { KeyRound } from 'lucide-react';
import { auth, fns, errMsg } from '../../lib/firebase';
import { useAuth } from '../../store/auth';
import { Field } from '../../components/common';

/**
 * T1 교사 인증키
 * 흐름: 인증키 입력 → verifyTeacherKey(서버 대조) → Google 팝업 → registerTeacher(서버에서 키 재검증 후 teachers/{uid} 생성)
 * 이미 teachers/{uid}가 있으면 키 없이 Google 로그인만으로 진입.
 */
export default function TeacherKey() {
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const setTeacher = useAuth((s) => s.setTeacher);

  const googleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  };

  const withKey = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await fns.verifyTeacherKey({ key: key.trim() });
      const user = await googleLogin();
      const res = await fns.registerTeacher({ key: key.trim() });
      await user.getIdToken(true); // role=teacher claim 반영
      setTeacher(res.teacher, user);
    } catch (e2) {
      setErr(errMsg(e2, '인증에 실패했습니다.'));
      if (auth.currentUser && !auth.currentUser.email?.endsWith('.local')) await signOut(auth).catch(() => {});
    } finally { setBusy(false); }
  };

  const withoutKey = async () => {
    setErr(''); setBusy(true);
    try {
      const user = await googleLogin();
      try {
        const res = await fns.registerTeacher({ key: null }); // 기존 교사면 키 없이 통과
        await user.getIdToken(true); // role=teacher claim 반영
        setTeacher(res.teacher, user);
      } catch (e2) {
        await signOut(auth);
        setErr('등록되지 않은 교사 계정입니다. 최초 1회는 인증키를 입력해 주세요.');
      }
    } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  };

  return (
    <div className="s-shell">
      <div className="hero-blob" />
      <form className="auth-card card" onSubmit={withKey}>
        <div className="role-icon mb-12" style={{ background: '#F5F3FF', color: '#7C3AED' }}><KeyRound size={24} /></div>
        <h1 className="auth-title">교사 인증</h1>
        <p className="auth-sub">인증키는 최초 1회만 필요합니다. 이미 등록된 교사는 Google 로그인만으로 진입할 수 있어요.</p>
        {err && <div className="form-error" role="alert">{err}</div>}
        <Field label="교사 인증키" hint="최초 1회만 필요 · 담당 부서에서 안내받은 키"><input className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="인증키" autoComplete="off" /></Field>
        <button className="btn btn-full" type="submit" disabled={busy || !key.trim()}>{busy ? '확인 중…' : '인증 후 Google로 로그인'}</button>
        <div className="divider" />
        <button className="btn btn-outline btn-full" type="button" onClick={withoutKey} disabled={busy}>
          <GoogleIcon /> 이미 등록된 교사 · Google로 로그인
        </button>
        <p className="small muted mt-16" style={{ textAlign: 'center' }}><Link to="/">학생으로 돌아가기</Link></p>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.4 35.1 44 30 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
