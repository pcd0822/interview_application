import { create } from 'zustand';

let seq = 0;
export const useToast = create((set) => ({
  toasts: [],
  push: (message, tone = 'info', ms = 3500) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m) => useToast.getState().push(m, 'success'),
  error: (m) => useToast.getState().push(m, 'error', 5000),
  info: (m) => useToast.getState().push(m, 'info'),
};
