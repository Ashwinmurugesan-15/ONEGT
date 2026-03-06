'use client';

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { User, UserRole } from '@/types/recruitment';
import { useAuth as useMainAuth } from '../../../contexts/AuthContext';

interface AuthContextType {
  user: User | null;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  isAuthenticated: boolean;
  getAuthHeader: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { user: mainUser, logout: mainLogout, isAdmin, isManager, isHR, isAssociate, getAuthHeader } = useMainAuth() as any;

  const mappedUser = useMemo(() => {
    if (!mainUser) return null;

    // Map main app roles to talent module roles
    let role: UserRole = 'interviewer';
    if (isAdmin) role = 'super_admin';
    else if (isHR) role = 'admin';
    else if (isManager || isAssociate) role = 'hiring_manager';

    return {
      id: mainUser.id || mainUser.email || 'unknown',
      name: mainUser.name || 'Unknown User',
      email: mainUser.email || '',
      role: role,
      isActive: true,
      permissions: {
        isSuperAdmin: !!isAdmin,
        canManageUsers: !!(isAdmin || isHR),
        features: {
          dashboard: true,
          demands: true,
          candidates: true,
          interviews: true,
        },
      },
      originalRole: role,
    } as User;
  }, [mainUser, isAdmin, isManager, isHR]);

  const logout = () => {
    mainLogout();
  };

  const switchRole = (role: UserRole) => {
    // Role switching is limited in bridged mode
    console.warn('Role switching not supported in integrated mode');
  };

  return (
    <AuthContext.Provider value={{
      user: mappedUser,
      logout,
      switchRole,
      isAuthenticated: !!mappedUser,
      getAuthHeader,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
