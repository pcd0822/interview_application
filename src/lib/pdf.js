/**
 * 피드백 MD → PDF 변환 (브라우저).
 * A4, 여백 20mm, 한글 웹폰트(Pretendard → Noto Sans KR 폴백), 본문 11pt, 줄간격 1.6,
 * 문단·표·코드가 페이지 경계에서 잘리지 않도록 page-break-inside: avoid.
 */
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { yyyymmdd } from './date';

const PDF_CSS = `
  .pdf-root { font-family: 'Pretendard Variable', Pretendard, 'Noto Sans KR', sans-serif; color: #111827; font-size: 11pt; line-height: 1.6; width: 170mm; }
  .pdf-header { border-bottom: 2px solid #2563EB; padding-bottom: 8px; margin-bottom: 16px; page-break-inside: avoid; }
  .pdf-header h1 { font-size: 16pt; margin: 0 0 6px; color: #1D4ED8; }
  .pdf-header table { font-size: 10pt; border-collapse: collapse; }
  .pdf-header td { padding: 2px 12px 2px 0; }
  .pdf-header td.k { color: #6B7280; }
  .pdf-body h1 { font-size: 15pt; margin: 18px 0 8px; page-break-after: avoid; }
  .pdf-body h2 { font-size: 13.5pt; margin: 16px 0 8px; page-break-after: avoid; border-left: 4px solid #2563EB; padding-left: 8px; }
  .pdf-body h3 { font-size: 12pt; margin: 14px 0 6px; page-break-after: avoid; }
  .pdf-body p, .pdf-body li { page-break-inside: avoid; margin: 0 0 8px; }
  .pdf-body ul, .pdf-body ol { padding-left: 22px; }
  .pdf-body table { border-collapse: collapse; width: 100%; margin: 8px 0 12px; page-break-inside: avoid; font-size: 10.5pt; }
  .pdf-body th, .pdf-body td { border: 1px solid #D1D5DB; padding: 5px 8px; text-align: left; vertical-align: top; }
  .pdf-body th { background: #EFF4FF; font-weight: 600; }
  .pdf-body tr { page-break-inside: avoid; }
  .pdf-body pre { background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; font-size: 9.5pt; white-space: pre-wrap; word-break: break-all; page-break-inside: avoid; }
  .pdf-body code { background: #F3F4F6; padding: 1px 4px; border-radius: 4px; font-size: 10pt; }
  .pdf-body blockquote { border-left: 4px solid #CBD5E1; margin: 8px 0; padding: 4px 12px; color: #4B5563; page-break-inside: avoid; }
  .pdf-body hr { border: 0; border-top: 1px solid #E5E7EB; margin: 14px 0; }
  .pdf-body img { max-width: 100%; }
`;

export function feedbackPdfFileName({ studentId, name, dateIso }) {
  return `모의면접_피드백_${studentId}_${name}_${yyyymmdd(dateIso)}.pdf`;
}

/**
 * @param {object} p
 * @param {string} p.markdown 본문
 * @param {{studentName,studentId,interviewDate,interviewTime,teacherName}} p.header
 * @param {string} p.fileName
 */
export async function downloadMarkdownAsPdf({ markdown, header, fileName }) {
  const { default: html2pdf } = await import('html2pdf.js');
  await document.fonts?.ready;

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;background:#fff;';
  const style = document.createElement('style');
  style.textContent = PDF_CSS;
  host.appendChild(style);
  const mount = document.createElement('div');
  host.appendChild(mount);
  document.body.appendChild(host);

  const root = createRoot(mount);
  root.render(
    createElement('div', { className: 'pdf-root' },
      createElement('div', { className: 'pdf-header' },
        createElement('h1', null, '모의면접 피드백'),
        createElement('table', null, createElement('tbody', null,
          createElement('tr', null,
            createElement('td', { className: 'k' }, '학생'), createElement('td', null, `${header.studentName} (${header.studentId})`),
            createElement('td', { className: 'k' }, '담당 교사'), createElement('td', null, header.teacherName || '-')),
          createElement('tr', null,
            createElement('td', { className: 'k' }, '면접 일시'), createElement('td', { colSpan: 3 }, `${header.interviewDate || ''} ${header.interviewTime || ''}`)),
        )),
      ),
      createElement('div', { className: 'pdf-body' }, createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, markdown || '')),
    ),
  );
  // 렌더 완료 대기
  await new Promise((r) => setTimeout(r, 150));
  try {
    await html2pdf()
      .set({
        margin: 20, // mm
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['p', 'li', 'table', 'tr', 'pre', 'blockquote', 'h1', 'h2', 'h3'] },
      })
      .from(mount)
      .save();
  } finally {
    root.unmount();
    host.remove();
  }
}

/** 업로드된 PDF 원본 다운로드 (CORS 허용 시 blob, 아니면 새 탭) */
export async function downloadUrlAsFile(url, fileName) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}
