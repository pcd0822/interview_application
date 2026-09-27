import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db, errMsg } from '../../lib/firebase';
import { PASSWORD_MIN_LEN } from '../../lib/constants';
import { useAuth } from '../../store/auth';
import { Field } from '../../components/common';
import { toast } from '../../store/toast';

/** 비밀번호 초기화 후 강제 변경 화면 */
export default function ChangePassword() {
  const nav = useNavigate();
  const { student, refreshStudent, signOut } = useAuth();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (p1.length < PASSWORD_MIN_LEN) return setErr(`비밀번호는 ${PASSWORD_MIN_LEN}자 이상이어야 합니다.`);
    if (p1 !== p2) return setErr('비밀번호가 서로 일치하지 않습니다.');
    if (p1 === student?.studentId) return setErr('학번과 같은 비밀번호는 사용할 수 없습니다.');
    setBusy(true);
    try {
      await updatePassword(auth.currentUser, p1);
      await updateDoc(doc(db, 'students', student.studentId), { mustChangePassword: false });
      await refreshStudent();
      toast.success('비밀번호가 변경되었습니다.');
      nav('/student', { replace: true });
    } catch (e2) {
      setErr(errMsg(e2));
    } finally { setBusy(false); }
  };

  return (
    <div className="s-shell">
      <div className="hero-blob" />
      <form className="auth-card card" onSubmit={submit}>
        <h1 className="auth-title" style={{ fontSize: 20 }}>새 비밀번호 설정</h1>
        <p className="auth-sub">비밀번호가 초기화되었어요. 계속하려면 새 비밀번호를 설정해 주세요.</p>
        {err && <div className="form-error" role="alert">{err}</div>}
        <Field label="새 비밀번호" required hint={`${PASSWORD_MIN_LEN}자 이상`}><input className="input" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} required /></Field>
        <Field label="새 비밀번호 확인" required><input className="input" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} required /></Field>
        <button className="btn btn-full" type="submit" disabled={busy}>{busy ? '저장 중…' : '비밀번호 변경'}</button>
        <button className="btn btn-ghost btn-full mt-8" type="button" onClick={signOut}>로그아웃</button>
      </form>
    </div>
  );
}
