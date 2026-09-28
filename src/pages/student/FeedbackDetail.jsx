import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { useAuth } from '../../store/auth';
import { Markdown, Spinner, StatusBadge } from '../../components/common';
import { getBooking, getFeedbacksForBooking } from '../../lib/api';
import { downloadMarkdownAsPdf, downloadUrlAsFile, feedbackPdfFileName } from '../../lib/pdf';
import { formatKoDate } from '../../lib/date';
import { toast } from '../../store/toast';

/** S8 피드백 상세 — 한 신청 건에 교사별 피드백이 여러 개일 수 있어 모두 순서대로 보여 준다. */
export default function FeedbackDetail() {
  const { bookingId } = useParams();
  const nav = useNavigate();
  const { student } = useAuth();
  const [booking, setBooking] = useState(null);
  const [fbs, setFbs] = useState(undefined);

  useEffect(() => {
    (async () => {
      const b = await getBooking(bookingId).catch(() => null);
      setBooking(b);
      // 자기 학번 조건을 함께 걸어야 규칙(studentId == 본인)을 통과한다. 실패하면 "미등록"으로 처리.
      // booking 을 함께 넘겨 삭제 후 재신청으로 id 가 같아진 예전 피드백은 제외한다.
      const rows = b ? await getFeedbacksForBooking(bookingId, { studentId: student.studentId, booking: b }).catch(() => []) : [];
      setFbs(rows);
    })();
  }, [bookingId, student.studentId]);

  if (fbs === undefined) return <Spinner />;
  if (!booking || booking.studentId !== student.studentId) return <div className="card empty">신청 내역을 찾을 수 없어요.</div>;
  if (!fbs.length) return <div className="card empty">아직 피드백이 등록되지 않았어요.</div>;

  return (
    <div>
      <div className="row-between mb-12">
        <button className="btn btn-ghost btn-sm" onClick={() => nav('/student/bookings')}><ArrowLeft size={18} />내 신청</button>
        {fbs.length === 1 && <DownloadButton fb={fbs[0]} booking={booking} student={student} />}
      </div>
      <div className="card mb-12">
        <div className="row-between mb-8"><h2 style={{ fontSize: 18 }}>모의면접 피드백</h2><StatusBadge status={booking.status} /></div>
        <div className="kv">
          <span className="k">학생</span><span className="v">{student.name} ({student.studentId})</span>
          <span className="k">담당 교사</span><span className="v">{fbs.map((f) => f.teacherName).filter(Boolean).join(', ') || '-'}</span>
          <span className="k">면접 일시</span><span className="v">{fbs[0].interviewDate || formatKoDate(booking.date)} {fbs[0].interviewTime || ''}</span>
          <span className="k">희망 대학</span><span className="v">{booking.targetUniversity} · {booking.targetAdmissionType}</span>
        </div>
        {fbs.length > 1 && <div className="xs muted mt-8">교사 {fbs.length}명의 피드백이 있어요. 아래에서 차례로 확인하세요.</div>}
      </div>
      {fbs.map((fb, i) => (
        <FeedbackBody key={fb.id} fb={fb} index={fbs.length > 1 ? i + 1 : null} booking={booking} student={student} />
      ))}
    </div>
  );
}

function FeedbackBody({ fb, index, booking, student }) {
  const markdown = fb.contentMd || '';
  const hasPdf = fb.fileType === 'pdf' && fb.fileUrl;
  return (
    <div className="mb-12">
      {index && (
        <div className="card mb-12" style={{ padding: 12 }}>
          <div className="row-between wrap">
            <div><b>피드백 {index}</b> <span className="muted small">· {fb.teacherName || '-'} 선생님 · {fb.interviewDate || formatKoDate(booking.date)} {fb.interviewTime || ''}</span></div>
            <DownloadButton fb={fb} booking={booking} student={student} />
          </div>
        </div>
      )}
      {fb.fileUrl && (
        <div className="file-card mb-12">
          <FileText size={20} color="#2563EB" />
          <span className="grow ellipsis">{fb.fileName}</span>
          <a className="btn btn-outline btn-xs" href={fb.fileUrl} target="_blank" rel="noopener noreferrer">열기</a>
        </div>
      )}
      {/* 파일 「열기」 아래에 교사가 직접 입력한 내용을 그대로 보여 준다. PDF 미리보기는 직접 입력이 전혀 없을 때만 대체 표시. */}
      {markdown ? (
        <div>
          {fb.fileUrl && <div className="small bold mb-8">선생님이 직접 입력한 피드백</div>}
          <Markdown>{markdown}</Markdown>
        </div>
      ) : (hasPdf ? <div className="card"><iframe title={`피드백 PDF ${index || ''}`} src={fb.fileUrl} style={{ width: '100%', height: '70vh', border: 0, borderRadius: 12 }} /></div> : null)}
    </div>
  );
}

function DownloadButton({ fb, booking, student }) {
  const [busy, setBusy] = useState(false);
  const hasPdf = fb.fileType === 'pdf' && fb.fileUrl;
  const download = async () => {
    setBusy(true);
    try {
      const fileName = feedbackPdfFileName({ studentId: student.studentId, name: student.name, dateIso: booking.date });
      if (hasPdf) await downloadUrlAsFile(fb.fileUrl, fileName);
      else await downloadMarkdownAsPdf({ markdown: fb.contentMd || '', header: { studentName: student.name, studentId: student.studentId, interviewDate: fb.interviewDate, interviewTime: fb.interviewTime, teacherName: fb.teacherName }, fileName });
    } catch (e) { console.error(e); toast.error('PDF를 만들지 못했어요. 잠시 후 다시 시도해 주세요.'); } finally { setBusy(false); }
  };
  return <button className="btn btn-sm" onClick={download} disabled={busy}><Download size={16} />{busy ? '준비 중…' : 'PDF 다운로드'}</button>;
}
