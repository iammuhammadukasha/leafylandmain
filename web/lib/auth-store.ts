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
  /**
   * False until zustand's persist middleware has finished reading
   * localStorage. On a fresh page load (e.g. typing a URL directly, or any
   * navigation that remounts the store) accessToken briefly starts as
   * `null` before rehydration completes — pages must wait for
   * hasHydrated before treating a null accessToken as "not logged in",
   * or they redirect to /login even though a valid token exists in
   * storage.
   */
  hasHydrated: boolean;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  clear: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      hasHydrated: false,
      setTokens: ({ accessToken, refreshToken }) =>
        set({ accessToken, refreshToken }),
      clear: () => set({ accessToken: null, refreshToken: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'leafyland-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
