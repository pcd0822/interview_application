import {
  format, parseISO, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isBefore, getDay,
} from 'date-fns';
import { MIN_LEAD_DAYS } from './constants';

export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

export const toIso = (d) => format(d, 'yyyy-MM-dd'); // YYYY-MM-DD
export const fromIso = (s) => parseISO(s);
export const todayIso = () => toIso(new Date());

/** 2026-09-24 → 2026.09.24.(목) */
export function formatKoDate(isoOrDate) {
  if (!isoOrDate) return '';
  const d = typeof isoOrDate === 'string' ? parseISO(isoOrDate) : isoOrDate;
  return `${format(d, 'yyyy.MM.dd.')}(${WEEKDAY_KO[getDay(d)]})`;
}
/** 2026.09.24.(목) → 2026-09-24 */
export function koDateToIso(ko) {
  const m = /^(\d{4})\.(\d{2})\.(\d{2})\./.exec(ko || '');
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
export function formatDateTime(ts) {
  if (!ts) return '-';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return format(d, 'yyyy.MM.dd HH:mm');
}
export function formatShort(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return format(d, 'MM.dd');
}
export const yyyymmdd = (iso) => (iso || '').replace(/-/g, '');

/** 학생이 신청할 수 있는 가장 이른 날짜 (today + 3) */
export function minBookableIso() {
  return toIso(addDays(new Date(), MIN_LEAD_DAYS));
}
export function isBookableDate(iso) {
  return iso >= minBookableIso();
}
/** 월 그리드(일요일 시작) */
export function monthGrid(monthDate) {
  const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end }).map((d) => ({
    date: d,
    iso: toIso(d),
    inMonth: isSameMonth(d, monthDate),
    isToday: isSameDay(d, new Date()),
    weekday: getDay(d),
  }));
}
export function monthRange(monthDate) {
  return { start: toIso(startOfMonth(monthDate)), end: toIso(endOfMonth(monthDate)) };
}
export const isPast = (iso) => isBefore(parseISO(iso), parseISO(todayIso()));
export function isWeekday(iso) {
  const w = getDay(parseISO(iso));
  return w >= 1 && w <= 5;
}
/** UTC 자정 Date (Firestore 규칙에서 날짜 검증용) */
export function isoToUtcMidnight(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
/** 5분 단위 시간 옵션 */
export function timeOptions(step = 5) {
  const out = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += step) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return out;
}
