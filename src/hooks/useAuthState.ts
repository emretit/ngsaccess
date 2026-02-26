import { useConvexAuth } from "convex/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Convex Auth state hook
 * Convex Auth otomatik session yönetimi sağlar
 */
export const useAuthState = () => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.currentUser);

  return {
    session: isAuthenticated ? { user } : null,
    user: user ?? null,
    profile: user ?? null,
    loading: isLoading || (isAuthenticated && user === undefined),
    refreshProfile: async () => {
      // Convex otomatik günceller, manuel refresh gerekmez
    },
  };
};
