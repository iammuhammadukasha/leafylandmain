import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Holds the access token client-side (Architecture §6: Zustand for local
 * UI state, not server data — the token itself is auth/session state, not
 * a TanStack Query-cached server resource). Profile *data* fetched with
 * the token is TanStack Query's concern (see app/(storefront)/account).
 *
 * DECISION: localStorage-persisted for this scaffold's simplicity: no
 * refresh-token-rotation-on-page-load flow is wired into the frontend
 * yet (only the backend's rotation endpoint is proven). Production
 * should move to an httpOnly cookie set by the backend to reduce XSS
 * exposure — noted as a follow-up, not implemented here since it wasn't
 * specified in Volume 07 for the frontend and this is a scaffold slice.
 */
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      setTokens: ({ accessToken, refreshToken }) =>
        set({ accessToken, refreshToken }),
      clear: () => set({ accessToken: null, refreshToken: null }),
    }),
    { name: 'leafyland-auth' },
  ),
);
