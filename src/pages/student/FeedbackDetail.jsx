import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { useAuth } from '../../store/auth';
import { Markdown, Spinner, StatusBadge } from '../../components/common';
import { getBooking, getFeedback } from '../../lib/api';
import { downloadMarkdownAsPdf, downloadUrlAsFile, feedbackPdfFileName } from '../../lib/pdf';
import { formatKoDate } from '../../lib/date';
import { toast } from '../../store/toast';

/** S8 피드백 상세 */
export default function FeedbackDetail() {
  const { bookingId } = useParams();
  const nav = useNavigate();
  const { student } = useAuth();
  const [booking, setBooking] = useState(null);
  const [fb, setFb] = useState(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const b = await getBooking(bookingId).catch(() => null);
      setBooking(b);
      // 피드백 문서가 아직 없으면 규칙상 permission-denied 가 날 수 있음 → "미등록"으로 처리
      const f = b ? await getFeedback(bookingId).catch(() => null) : null;
      setFb(f);
    })();
  }, [bookingId]);

  if (fb === undefined) return <Spinner />;
  if (!booking || booking.studentId !== student.studentId) return <div className="card empty">신청 내역을 찾을 수 없어요.</div>;
  if (!fb) return <div className="card empty">아직 피드백이 등록되지 않았어요.</div>;

  const dateIso = booking.date;
  const markdown = fb.contentMd || '';
  const hasPdf = fb.fileType === 'pdf' && fb.fileUrl;

  const download = async () => {
    setBusy(true);
    try {
      const fileName = feedbackPdfFileName({ studentId: student.studentId, name: student.name, dateIso });
      if (hasPdf) await downloadUrlAsFile(fb.fileUrl, fileName);
      else await downloadMarkdownAsPdf({ markdown, header: { studentName: student.name, studentId: student.studentId, interviewDate: fb.interviewDate, interviewTime: fb.interviewTime, teacherName: fb.teacherName }, fileName });
    } catch (e) { console.error(e); toast.error('PDF를 만들지 못했어요. 잠시 후 다시 시도해 주세요.'); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="row-between mb-12">
        <button className="btn btn-ghost btn-sm" onClick={() => nav('/student/bookings')}><ArrowLeft size={18} />내 신청</button>
        <button className="btn btn-sm" onClick={download} disabled={busy}><Download size={16} />{busy ? '준비 중…' : 'PDF 다운로드'}</button>
      </div>
      <div className="card mb-12">
        <div className="row-between mb-8"><h2 style={{ fontSize: 18 }}>모의면접 피드백</h2><StatusBadge status={booking.status} /></div>
        <div className="kv">
          <span className="k">학생</span><span className="v">{student.name} ({student.studentId})</span>
          <span className="k">담당 교사</span><span className="v">{fb.teacherName || '-'}</span>
          <span className="k">면접 일시</span><span className="v">{fb.interviewDate || formatKoDate(dateIso)} {fb.interviewTime || ''}</span>
          <span className="k">희망 대학</span><span className="v">{booking.targetUniversity} · {booking.targetAdmissionType}</span>
        </div>
      </div>
      {fb.fileUrl && (
        <div className="file-card mb-12">
          <FileText size={20} color="#2563EB" />
          <span className="grow ellipsis">{fb.fileName}</span>
          {hasPdf && <a className="btn btn-outline btn-xs" href={fb.fileUrl} target="_blank" rel="noopener noreferrer">열기</a>}
        </div>
      )}
      {markdown ? <Markdown>{markdown}</Markdown> : (hasPdf ? <div className="card"><iframe title="피드백 PDF" src={fb.fileUrl} style={{ width: '100%', height: '70vh', border: 0, borderRadius: 12 }} /></div> : null)}
    </div>
  );
}
