import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BOOKING_STATUS, STUDENT_STATUS } from '../../lib/constants';
import { useToast } from '../../store/toast';
import { monthGrid } from '../../lib/date';
import { format, addMonths, subMonths } from 'date-fns';

/* ── 상태 배지 (전 화면 공통) ── */
export function StatusBadge({ status }) {
  const s = BOOKING_STATUS[status] || { label: status, tone: 'gray' };
  return <span className={`badge badge-${s.tone}`} aria-label={`상태: ${s.label}`}>{s.label}</span>;
}
export function StudentStatusBadge({ status }) {
  const s = STUDENT_STATUS[status] || { label: status, tone: 'gray' };
  return <span className={`badge badge-${s.tone}`}>{s.label}</span>;
}

/* ── 토스트 ── */
export function Toasts() {
  const toasts = useToast((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.message}</div>)}
    </div>
  );
}

export const Spinner = () => <div className="spinner" role="progressbar" aria-label="불러오는 중" />;

/* ── 모달 ── */
export function Modal({ title, onClose, children, footer, size }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ── 확인 모달 ── */
export function ConfirmModal({ title, message, confirmText = '확인', danger, onConfirm, onClose, typeToConfirm, children }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = !typeToConfirm || typed === typeToConfirm;
  return (
    <Modal title={title} onClose={onClose} footer={
      <>
        <button className="btn btn-outline" onClick={onClose} disabled={busy}>취소</button>
        <button className={`btn ${danger ? 'btn-danger' : ''}`} disabled={!ok || busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{busy ? '처리 중…' : confirmText}</button>
      </>
    }>
      {message && <p style={{ whiteSpace: 'pre-line' }}>{message}</p>}
      {children}
      {typeToConfirm && (
        <div className="field mt-12">
          <label>계속하려면 「{typeToConfirm}」를 입력하세요</label>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={typeToConfirm} />
        </div>
      )}
    </Modal>
  );
}

/* ── 바텀시트 (모바일) / 중앙 모달 (데스크톱) ── */
export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay sheet-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" />
        <div className="modal-head"><h3>{title}</h3><button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="닫기"><X size={20} /></button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ── 월 캘린더 (공용) ──
 * renderCell(cell) → { sub?: ReactNode, disabled?: bool, selected?: bool, multi?: bool, content?: ReactNode, dot?: bool }
 */
export function MonthCalendar({ month, onMonthChange, onSelect, renderCell, accent }) {
  const cells = monthGrid(month);
  return (
    <div className="cal">
      <div className="cal-head">
        <button className="btn btn-ghost btn-icon" onClick={() => onMonthChange(subMonths(month, 1))} aria-label="이전 달"><ChevronLeft size={20} /></button>
        <div className="cal-month">{format(month, 'yyyy년 M월')}</div>
        <button className="btn btn-ghost btn-icon" onClick={() => onMonthChange(addMonths(month, 1))} aria-label="다음 달"><ChevronRight size={20} /></button>
      </div>
      <div className="cal-grid">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => <div key={d} className={`cal-dow ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>{d}</div>)}
        {cells.map((c) => {
          const r = renderCell?.(c) || {};
          const cls = ['cal-cell', !c.inMonth && 'out', c.isToday && 'today', r.disabled && 'disabled', r.selected && 'selected', r.selected && accent, r.multi && 'multi', !r.disabled && onSelect && 'clickable'].filter(Boolean).join(' ');
          return (
            <div key={c.iso} className={cls} role={onSelect ? 'button' : undefined} tabIndex={onSelect && !r.disabled ? 0 : -1}
              onClick={() => !r.disabled && onSelect?.(c.iso)}
              onKeyDown={(e) => e.key === 'Enter' && !r.disabled && onSelect?.(c.iso)}
              aria-label={`${c.iso}${r.disabled ? ' (신청 불가)' : ''}`}>
              <span className="cal-day" style={c.weekday === 0 ? { color: '#DC2626' } : c.weekday === 6 ? { color: '#2563EB' } : undefined}>{c.date.getDate()}</span>
              {r.dot && <span className="cal-dot" />}
              {r.sub}
              {r.content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 마크다운 뷰어 ── */
export function Markdown({ children }) {
  return <div className="md-preview"><ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ''}</ReactMarkdown></div>;
}

/* ── 필드 ── */
export function Field({ label, required, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}{required && <span className="req">*</span>}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
