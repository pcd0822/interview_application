/**
 * 모의면접 신청 시스템 — 메일 발송 API (Google Apps Script 웹앱)
 *
 * 호출 경로: React → Cloud Function(sendMail) → 이 웹앱 doPost → GmailApp.sendEmail
 *
 * 배포 방법
 *  1. script.google.com 에서 새 프로젝트 → 이 파일 내용을 Code.gs 에 붙여넣기
 *  2. 프로젝트 설정 → 스크립트 속성 추가
 *       MAIL_TOKEN  : 임의의 긴 비밀 문자열 (Firebase Functions Secret GAS_MAIL_TOKEN 과 동일하게)
 *       SENDER_NAME : (선택) 발신자 표시 이름, 예: 속초여고 모의면접
 *       REPLY_TO    : (선택) 회신 받을 주소
 *  3. 배포 → 새 배포 → 유형: 웹 앱
 *       실행 사용자: 나(스크립트 소유자)
 *       액세스 권한: 모든 사용자
 *  4. 웹앱 URL(…/exec)을 Functions 파라미터 GAS_MAIL_URL 에 등록
 *  5. 코드 수정 후에는 반드시 "새 버전"으로 재배포해야 반영됩니다.
 *
 * 요청(JSON, Content-Type: text/plain)
 *   { token, to, subject, body }
 * 응답(JSON)
 *   { ok: true } | { ok: false, error }
 */

function doPost(e) {
  var out = { ok: false };
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var req = JSON.parse(raw);
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty('MAIL_TOKEN');
    if (!token) throw new Error('MAIL_TOKEN 스크립트 속성이 없습니다.');
    if (!req.token || req.token !== token) throw new Error('unauthorized');

    var to = String(req.to || '').trim();
    var subject = String(req.subject || '').trim();
    var body = String(req.body || '');
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('수신 주소가 올바르지 않습니다.');
    if (!subject) throw new Error('제목이 없습니다.');

    var options = { htmlBody: toHtml_(body) };
    var name = props.getProperty('SENDER_NAME');
    var replyTo = props.getProperty('REPLY_TO');
    if (name) options.name = name;
    if (replyTo) options.replyTo = replyTo;

    GmailApp.sendEmail(to, subject, body, options);
    out = { ok: true, remaining: MailApp.getRemainingDailyQuota() };
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** 상태 확인용 */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'mock-interview-mail' })).setMimeType(ContentService.MimeType.JSON);
}

/** 줄바꿈 텍스트 → 간단한 HTML */
function toHtml_(text) {
  var esc = String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return '<div style="font-family:Pretendard,\'Noto Sans KR\',Apple SD Gothic Neo,sans-serif;font-size:15px;line-height:1.7;color:#111827;max-width:640px">' + esc + '</div>';
}

/** 에디터에서 직접 실행해 발송 테스트 (자기 자신에게) */
function testSend() {
  var me = Session.getActiveUser().getEmail();
  var res = doPost({ postData: { contents: JSON.stringify({ token: PropertiesService.getScriptProperties().getProperty('MAIL_TOKEN'), to: me, subject: '[테스트] 모의면접 메일 발송', body: '테스트 본문입니다.\n둘째 줄' }) } });
  Logger.log(res.getContent());
}
