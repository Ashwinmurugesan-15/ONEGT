'use client';

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useAuth as useMainAuth } from '../../../contexts/AuthContext';

interface AuthContextType {
    user: any;
    logout: () => void;
    isAuthenticated: boolean;
    getAuthHeader: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const { user: mainUser, logout: mainLogout, isAdmin, isManager, isHR, isAssociate, getAuthHeader } = useMainAuth() as any;

    const mappedUser = useMemo(() => {
        if (!mainUser) return null;

        // Map main app roles to assessment module roles
        let role = 'candidate';
        if (isAdmin || isHR) role = 'admin';
        else if (isManager) role = 'examiner';
        else if (isAssociate) role = 'candidate';

        return {
            ...mainUser,
            role: role,
            id: mainUser.id || mainUser.associate_id || mainUser.email || 'unknown',
        };
    }, [mainUser, isAdmin, isManager, isHR, isAssociate]);

    const logout = () => {
        mainLogout();
    };

    return (
        <AuthContext.Provider value={{
            user: mappedUser,
            logout,
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
