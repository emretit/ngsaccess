
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentEmployeeUser, isEmployeeAuthenticated, EmployeeUser } from '@/services/employeeAuthService';

interface EmployeeAuthContextType {
  user: EmployeeUser | null;
  loading: boolean;
}

const EmployeeAuthContext = createContext<EmployeeAuthContextType | undefined>(undefined);

export function EmployeeAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<EmployeeUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Initialize auth state
    const checkAuth = () => {
      const authenticated = isEmployeeAuthenticated();
      if (authenticated) {
        const currentUser = getCurrentEmployeeUser();
        setUser(currentUser);
      }
      setLoading(false);
    };

    checkAuth();

    // Listen for storage events (in case of login/logout in another tab)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'employeeAuthSession') {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <EmployeeAuthContext.Provider
      value={{
        user,
        loading
      }}
    >
      {children}
    </EmployeeAuthContext.Provider>
  );
}

export const useEmployeeAuth = () => {
  const context = useContext(EmployeeAuthContext);
  if (context === undefined) {
    throw new Error('useEmployeeAuth must be used within an EmployeeAuthProvider');
  }
  return context;
};
