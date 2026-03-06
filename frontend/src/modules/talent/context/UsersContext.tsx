'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { User, UserRole, UserPermissions, EmailTemplate } from '@/types/recruitment';
import { useAuth } from './AuthContext';

interface UsersContextType {
    users: User[];
    addUser: (user: User) => void;
    updateUser: (user: User) => void;
    deleteUser: (userId: string) => void;
    getUserByEmail: (email: string) => User | undefined;
    sendInviteEmail: (user: User, template?: EmailTemplate) => Promise<{ success: boolean; error?: any }>;
}

const UsersContext = createContext<UsersContextType | undefined>(undefined);

const getDefaultPermissions = (role: UserRole): UserPermissions => {
    if (role === 'super_admin') {
        return {
            isSuperAdmin: true,
            canManageUsers: true,
            features: {
                dashboard: true,
                demands: true,
                candidates: true,
                interviews: true,
            },
        };
    }

    const baseFeatures = {
        dashboard: true,
        demands: role === 'admin' || role === 'hiring_manager',
        candidates: role === 'admin' || role === 'hiring_manager',
        interviews: role === 'admin' || role === 'interviewer',
    };

    return {
        canManageUsers: false,
        features: baseFeatures,
    };
};

// Initial users with permissions
const initialUsers: User[] = [
    { id: '1', name: 'Ashwin', email: 'ashlog559@gmail.com', role: 'super_admin', isActive: true, permissions: getDefaultPermissions('super_admin') },
];

const STORAGE_KEY = 'hireflow_users';

const loadUsersFromStorage = (): User[] => {
    if (typeof window === 'undefined') return initialUsers;

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsedUsers = JSON.parse(stored) as User[];
            // Ensure initial super admin always exists
            const hasInitialAdmin = parsedUsers.some(u => u.email === 'ashlog559@gmail.com');
            if (!hasInitialAdmin) {
                return [...initialUsers, ...parsedUsers];
            }
            return parsedUsers;
        }
    } catch (e) {
        console.error('Failed to load users from storage:', e);
    }
    return initialUsers;
};

const saveUsersToStorage = (users: User[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
        console.error('Failed to save users to storage:', e);
    }
};

export const UsersProvider = ({ children }: { children: ReactNode }) => {
    const [users, setUsers] = useState<User[]>(initialUsers);
    const { getAuthHeader } = useAuth();
    const [isLoaded, setIsLoaded] = useState(false);
    const usersRef = useRef<User[]>(users);

    // Keep ref in sync with state
    useEffect(() => {
        usersRef.current = users;
    }, [users]);

    // Load users from localStorage on mount
    useEffect(() => {
        const storedUsers = loadUsersFromStorage();
        setUsers(storedUsers);
        setIsLoaded(true);
    }, []);

    // Save users to localStorage whenever they change (after initial load)
    useEffect(() => {
        if (isLoaded) {
            saveUsersToStorage(users);
        }
    }, [users, isLoaded]);

    const addUser = useCallback((user: User) => {
        setUsers(prev => [...prev, user]);
    }, []);

    const updateUser = useCallback((updatedUser: User) => {
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    }, []);

    const deleteUser = useCallback((userId: string) => {
        setUsers(prev => prev.filter(u => u.id !== userId));
    }, []);

    // Use ref to avoid recreating callback when users change
    const getUserByEmail = useCallback((email: string) => {
        return usersRef.current.find(u => u.email.toLowerCase() === email.toLowerCase());
    }, []);

    const sendInviteEmail = useCallback(async (user: User, template?: EmailTemplate) => {
        try {
            const roleLabel = {
                super_admin: 'Super Admin',
                admin: 'Admin (HR)',
                hiring_manager: 'Hiring Manager',
                interviewer: 'Interviewer',
            }[user.role];

            const portalLink = typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login';

            // Build permissions list
            const permissionsList = user.permissions?.features
                ? Object.entries(user.permissions.features)
                    .filter(([_, enabled]) => enabled)
                    .map(([feature]) => `• ${feature.charAt(0).toUpperCase() + feature.slice(1)}`)
                    .join('\n')
                : 'All features enabled';

            let subject: string;
            let html: string;

            if (template) {
                // Use the customizable template from Settings
                subject = template.subject
                    .replace(/\[User Name\]/g, user.name)
                    .replace(/\[Role\]/g, roleLabel || user.role)
                    .replace(/\[Email\]/g, user.email);

                const bodyWithPlaceholders = template.body
                    .replace(/\[User Name\]/g, user.name)
                    .replace(/\[Role\]/g, roleLabel || user.role)
                    .replace(/\[Email\]/g, user.email)
                    .replace(/\[Portal Link\]/g, portalLink)
                    .replace(/\[Permissions List\]/g, permissionsList);

                // Convert plain text to HTML
                html = `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">${bodyWithPlaceholders}</pre>
                        <div style="margin: 30px 0;">
                            <a href="${portalLink}" style="background-color: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Sign In to HireFlow</a>
                        </div>
                    </div>
                `;
            } else {
                // Fallback to default HTML template
                subject = `Invitation to join HireFlow - ${roleLabel}`;
                html = `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h2 style="color: #0f172a;">Welcome to HireFlow</h2>
                        <p>Hello ${user.name},</p>
                        <p>You have been added as an <strong>${roleLabel}</strong> to the HireFlow Recruitment Portal.</p>
                        <p>You can now access the portal by signing in with your Google account:</p>
                        <div style="margin: 30px 0;">
                            <a href="${portalLink}" style="background-color: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Sign In to HireFlow</a>
                        </div>
                        <p style="color: #64748b; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:<br>
                        ${portalLink}</p>
                        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                        <p style="color: #94a3b8; font-size: 12px;">This is an automated message from HireFlow. Please do not reply directly to this email.</p>
                    </div>
                `;
            }

            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({
                    to: user.email,
                    subject,
                    html,
                }),
            });

            const data = await res.json();
            if (res.ok) {
                return { success: true };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Failed to send invite email:', error);
            return { success: false, error };
        }
    }, []);

    return (
        <UsersContext.Provider value={{ users, addUser, updateUser, deleteUser, getUserByEmail, sendInviteEmail }}>
            {children}
        </UsersContext.Provider>
    );
};

export const useUsers = () => {
    const context = useContext(UsersContext);
    if (!context) {
        throw new Error('useUsers must be used within UsersProvider');
    }
    return context;
};
