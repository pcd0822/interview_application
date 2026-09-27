import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
export const REGION = env.VITE_FIREBASE_FUNCTIONS_REGION || 'asia-northeast3';
/** .env 미설정 여부 (설정 안내 화면 표시용) */
export const isConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
if (!isConfigured) console.warn('[firebase] VITE_FIREBASE_* 환경변수가 없습니다. .env.example 을 참고해 .env 를 만드세요.');

export const app = initializeApp({ ...firebaseConfig, apiKey: firebaseConfig.apiKey || 'missing-api-key', projectId: firebaseConfig.projectId || 'missing-project' });
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, REGION);
export const storage = getStorage(app);

if (env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}

/** callable 헬퍼: 함수 이름 → (data) => result.data */
export const callFn = (name) => async (data) => {
  const fn = httpsCallable(functions, name);
  const res = await fn(data ?? {});
  return res.data;
};
export const fns = {
  registerStudent: callFn('registerStudent'),
  verifyTeacherKey: callFn('verifyTeacherKey'),
  registerTeacher: callFn('registerTeacher'),
  resetStudentPassword: callFn('resetStudentPassword'),
  rejectStudent: callFn('rejectStudent'),
  deleteStudent: callFn('deleteStudent'),
  purgeStudents: callFn('purgeStudents'),
  sendMail: callFn('sendMail'),
};

/** Firebase 오류 → 한국어 메시지 */
export function errMsg(e, fallback = '오류가 발생했습니다. 다시 시도해 주세요.') {
  const code = e?.code || '';
  const map = {
    'auth/invalid-credential': '학번 또는 비밀번호가 올바르지 않습니다.',
    'auth/invalid-login-credentials': '학번 또는 비밀번호가 올바르지 않습니다.',
    'auth/wrong-password': '학번 또는 비밀번호가 올바르지 않습니다.',
    'auth/user-not-found': '가입되지 않은 학번입니다.',
    'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    'auth/popup-closed-by-user': 'Google 로그인 창이 닫혔습니다.',
    'auth/cancelled-popup-request': 'Google 로그인 창이 닫혔습니다.',
    'auth/requires-recent-login': '보안을 위해 다시 로그인한 뒤 시도해 주세요.',
    'auth/weak-password': '비밀번호는 8자 이상이어야 합니다.',
    'auth/network-request-failed': '네트워크 연결을 확인해 주세요.',
    'permission-denied': '권한이 없습니다.',
    'functions/permission-denied': '권한이 없습니다.',
    'functions/unauthenticated': '로그인이 필요합니다.',
  };
  if (map[code]) return map[code];
  // callable에서 던진 HttpsError 메시지는 한국어로 작성됨
  if (code.startsWith('functions/') && e.message) return e.message;
  if (e?.message && /[가-힣]/.test(e.message)) return e.message;
  // 원인 추적을 위해 오류 코드(또는 메시지 앞부분)를 함께 표시
  const detail = code || (e?.message ? String(e.message).slice(0, 80) : '');
  return detail ? `${fallback} (${detail})` : fallback;
}
