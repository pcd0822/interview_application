/**
 * xlsx 처리
 * - 학생 명단 양식 다운로드 / 업로드 파싱: SheetJS(xlsx)
 * - 운영일지 내보내기(병합·굵게·테두리·열 너비 등 서식 필요): ExcelJS
 */
import * as XLSX from 'xlsx';
import { SCHOOL_SHORT } from './constants';

const HEADERS = ['학번', '이름', '희망계열', '희망전형'];

export function downloadStudentTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ['20301', '홍길동', '인문', '학생부종합']]);
  ws['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '학생명단');
  XLSX.writeFile(wb, '학생명단_양식.xlsx');
}

/** 업로드 파일 → [{studentId, name, track, admissionType}] */
export async function parseStudentXlsx(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  if (!rows.length) return [];
  const header = rows[0].map((h) => String(h).replace(/\s/g, ''));
  const idx = (names) => header.findIndex((h) => names.includes(h));
  const iId = idx(['학번']);
  const iName = idx(['이름', '성명']);
  const iTrack = idx(['희망계열', '계열']);
  const iType = idx(['희망전형', '전형']);
  if (iId < 0 || iName < 0) throw new Error('1행 헤더에 「학번」「이름」이 있어야 합니다.');
  return rows.slice(1)
    .filter((r) => r.some((c) => String(c).trim() !== ''))
    .map((r) => ({
      studentId: String(r[iId] ?? '').trim(),
      name: String(r[iName] ?? '').trim(),
      track: iTrack >= 0 ? String(r[iTrack] ?? '').trim() : '',
      admissionType: iType >= 0 ? String(r[iType] ?? '').trim() : '',
    }));
}

/**
 * 운영일지 xlsx
 * rows: [{ date:'2026.09.24.(목)', time:'20:00~22:00', studentId, name, target:'대학·전형', teacher, summary }]
 */
export async function exportLogXlsx({ year, rows }) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('운영일지');
  const title = `${year}학년도 모의면접 운영일지`;
  const thin = { style: 'thin', color: { argb: 'FF000000' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  ws.columns = [
    { key: 'no', width: 6 }, { key: 'date', width: 16 }, { key: 'time', width: 14 }, { key: 'sid', width: 10 },
    { key: 'name', width: 10 }, { key: 'target', width: 26 }, { key: 'teacher', width: 12 }, { key: 'summary', width: 60 },
  ];
  // 1행 제목 (A1:H1 병합, 굵게, 가운데, 16pt)
  ws.mergeCells('A1:H1');
  const t = ws.getCell('A1');
  t.value = title;
  t.font = { bold: true, size: 16 };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;
  // 2행 비움
  ws.getRow(2).height = 8;
  // 3행 헤더
  const headers = ['연번', '날짜', '시간', '학번', '이름', '희망대학·전형', '담당교사', '내용요약'];
  const hr = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    c.border = border;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  hr.height = 22;
  // 4행부터 데이터
  rows.forEach((r, i) => {
    const row = ws.getRow(4 + i);
    const vals = [i + 1, r.date, r.time, r.studentId, r.name, r.target, r.teacher, r.summary];
    vals.forEach((v, j) => {
      const c = row.getCell(j + 1);
      c.value = v;
      c.border = border;
      c.alignment = j === 7
        ? { horizontal: 'left', vertical: 'top', wrapText: true }
        : { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    const lines = String(r.summary || '').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 40)), 0);
    row.height = Math.max(20, Math.min(400, lines * 16 + 6));
  });
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${year}학년도_모의면접_운영일지_${SCHOOL_SHORT}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
