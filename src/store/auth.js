import { create } from 'zustand';
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, fns } from '../lib/firebase';

/**
 * role: null | 'student' | 'teacher'
 * student: students/{id} 문서, teacher: teachers/{uid} 문서
 * studentGate: null | 'pending' | 'rejected' (로그인 직후 승인 상태로 진입 차단된 경우)
 */
export const useAuth = create((set, get) => ({
  loading: true,
  user: null,
  role: null,
  claims: {},
  student: null,
  teacher: null,
  studentGate: null,

  init: () => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        set({ loading: false, user: null, role: null, claims: {}, student: null, teacher: null });
        return;
      }
      try {
        const token = await user.getIdTokenResult(true);
        const claims = token.claims || {};
        if (claims.studentId) {
          const snap = await getDoc(doc(db, 'students', String(claims.studentId)));
          const student = snap.exists() ? snap.data() : null;
          if (!student || student.status !== 'approved') {
            // pending / rejected → 즉시 로그아웃 + 안내
            const gate = student?.status === 'rejected' ? 'rejected' : 'pending';
            await fbSignOut(auth);
            set({ loading: false, user: null, role: null, claims: {}, student: null, teacher: null, studentGate: gate });
            return;
          }
          set({ loading: false, user, role: 'student', claims, student, teacher: null, studentGate: null });
          return;
        }
        // 교사: teachers/{uid} 존재 여부
        const tSnap = await getDoc(doc(db, 'teachers', user.uid));
        if (tSnap.exists()) {
          // Storage 규칙용 claim(role=teacher)이 없는 교사는 서버에서 부여받고 토큰을 갱신
          let finalClaims = claims;
          if (claims.role !== 'teacher') {
            try {
              await fns.registerTeacher({ key: null });
              finalClaims = (await user.getIdTokenResult(true)).claims || claims;
            } catch (e) { console.warn('teacher claim refresh failed', e); }
          }
          set({ loading: false, user, role: 'teacher', claims: finalClaims, teacher: tSnap.data(), student: null });
        } else {
          // Google 로그인은 되었지만 교사 등록 전 (인증키 단계)
          set({ loading: false, user, role: null, claims, teacher: null, student: null });
        }
      } catch (e) {
        console.error(e);
        set({ loading: false, user, role: null });
      }
    });
  },
  refreshStudent: async () => {
    const id = get().claims?.studentId;
    if (!id) return;
    const snap = await getDoc(doc(db, 'students', String(id)));
    if (snap.exists()) set({ student: snap.data() });
  },
  setTeacher: (teacher, user) => set({ teacher, role: 'teacher', user: user || get().user }),
  clearGate: () => set({ studentGate: null }),
  signOut: async () => {
    await fbSignOut(auth);
    set({ user: null, role: null, claims: {}, student: null, teacher: null });
  },
}));
