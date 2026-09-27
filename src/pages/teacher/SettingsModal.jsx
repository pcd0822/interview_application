import { useEffect, useState } from 'react';
import { Modal, Field, Spinner } from '../../components/common';
import { getMailTemplates, saveMailTemplates, getAcademicYear, saveAcademicYear, saveTeacherKey } from '../../lib/api';
import { MAIL_TEMPLATE_LABELS, MAIL_PLACEHOLDERS } from '../../lib/constants';
import { toast } from '../../store/toast';
import { errMsg } from '../../lib/firebase';

/** T9 설정 모달: 교사 인증키 / 메일 템플릿 / 학년도 */
export default function SettingsModal({ onClose }) {
  const [tab, setTab] = useState('key');
  return (
    <Modal title="설정" onClose={onClose} size="lg">
      <div className="subtabs accent-blue mb-16">
        {[['key', '교사 인증키'], ['mail', '메일 템플릿'], ['year', '학년도']].map(([k, l]) => (
          <button key={k} className={`subtab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'key' && <KeyTab onClose={onClose} />}
      {tab === 'mail' && <MailTab onClose={onClose} />}
      {tab === 'year' && <YearTab onClose={onClose} />}
    </Modal>
  );
}

function KeyTab({ onClose }) {
  const [k1, setK1] = useState('');
  const [k2, setK2] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (k1.length < 4) return toast.error('인증키는 4자 이상이어야 합니다.');
    if (k1 !== k2) return toast.error('인증키가 서로 일치하지 않습니다.');
    setBusy(true);
    try { await saveTeacherKey(k1); toast.success('교사 인증키가 변경되었습니다.'); onClose(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div>
      <p className="small muted mb-12">새 교사가 최초 로그인할 때 입력하는 인증키입니다. 현재 키는 보안상 표시하지 않습니다.</p>
      <Field label="새 인증키"><input className="input" type="password" value={k1} onChange={(e) => setK1(e.target.value)} autoComplete="new-password" /></Field>
      <Field label="새 인증키 확인"><input className="input" type="password" value={k2} onChange={(e) => setK2(e.target.value)} autoComplete="new-password" /></Field>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={onClose}>닫기</button><button className="btn" onClick={save} disabled={busy}>저장</button></div>
    </div>
  );
}

function MailTab({ onClose }) {
  const [tpl, setTpl] = useState(null);
  const [key, setKey] = useState('approve');
  const [busy, setBusy] = useState(false);
  useEffect(() => { getMailTemplates().then(setTpl).catch((e) => toast.error(errMsg(e))); }, []);
  if (!tpl) return <Spinner />;
  const cur = tpl[key];
  const set = (f) => (e) => setTpl({ ...tpl, [key]: { ...cur, [f]: e.target.value } });
  const save = async () => {
    setBusy(true);
    try { await saveMailTemplates(tpl); toast.success('메일 템플릿이 저장되었습니다.'); onClose(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div>
      <Field label="템플릿 선택">
        <select className="select" value={key} onChange={(e) => setKey(e.target.value)}>
          {Object.entries(MAIL_TEMPLATE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <div className="chips mb-12">{MAIL_PLACEHOLDERS.map((p) => <span key={p} className="chip">{p}</span>)}<span className="xs muted" style={{ alignSelf: 'center' }}>자리표시자는 발송 시 실제 값으로 바뀝니다.</span></div>
      <Field label="제목"><input className="input" value={cur.subject} onChange={set('subject')} /></Field>
      <Field label="본문"><textarea className="textarea" rows={8} value={cur.body} onChange={set('body')} /></Field>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={onClose}>닫기</button><button className="btn" onClick={save} disabled={busy}>저장</button></div>
    </div>
  );
}

function YearTab({ onClose }) {
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { getAcademicYear().then((y) => setYear(String(y))); }, []);
  const save = async () => {
    if (!/^\d{4}$/.test(year)) return toast.error('학년도는 4자리 숫자로 입력하세요.');
    setBusy(true);
    try { await saveAcademicYear(year); toast.success('학년도가 저장되었습니다.'); onClose(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div>
      <Field label="학년도" hint="운영일지 파일명·제목에 사용됩니다. 예: 2026"><input className="input" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} /></Field>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={onClose}>닫기</button><button className="btn" onClick={save} disabled={busy}>저장</button></div>
    </div>
  );
}
