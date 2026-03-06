import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// API base URL - use Vite's base path
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const API_URL = `${basePath}/api`;

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [googleClientId, setGoogleClientId] = useState('');

    // Load user from token on mount
    useEffect(() => {
        const loadUser = async () => {
            const token = localStorage.getItem('chrms_token');
            if (token) {
                try {
                    const response = await axios.get(`${API_URL}/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const userData = response.data;
                    // Update local storage if API returns a picture
                    if (userData.picture) {
                        localStorage.setItem('chrms_user_picture', userData.picture);
                    } else {
                        // If API has no picture, try to use cached one (e.g. from Google login)
                        userData.picture = localStorage.getItem('chrms_user_picture') || '';
                    }
                    setUser(userData);
                } catch (error) {
                    console.error('Token validation failed:', error);
                    localStorage.removeItem('chrms_token');
                    localStorage.removeItem('chrms_user_picture');
                }
            }
            setLoading(false);
        };

        const loadConfig = async () => {
            try {
                const response = await axios.get(`${API_URL}/auth/config`);
                setGoogleClientId(response.data.google_client_id);
            } catch (error) {
                console.error('Failed to load auth config:', error);
            }
        };

        loadUser();
        loadConfig();
    }, []);

    // Load Google Sign-In script
    useEffect(() => {
        if (!googleClientId) return;

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, [googleClientId]);

    const login = useCallback(async (googleCredential) => {
        try {
            const response = await axios.post(`${API_URL}/auth/google`, {
                credential: googleCredential
            });

            const { access_token } = response.data;
            localStorage.setItem('chrms_token', access_token);

            // Fetch absolute latest user data to prevent role caching 
            // since the user could have been updated in the Associates sheet recently
            const meResponse = await axios.get(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${access_token}` }
            });
            const freshUserData = meResponse.data;

            // Store picture from backend response
            if (freshUserData.picture) {
                localStorage.setItem('chrms_user_picture', freshUserData.picture);
            }

            setUser(freshUserData);
            return { success: true };
        } catch (error) {
            console.error('Login failed:', error);
            return {
                success: false,
                error: error.response?.data?.detail || 'Login failed'
            };
        }
    }, []);

    const logout = useCallback(async () => {
        const token = localStorage.getItem('chrms_token');
        if (token) {
            try {
                await axios.post(`${API_URL}/auth/logout`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } catch (error) {
                console.error('Logout error:', error);
            }
        }
        localStorage.removeItem('chrms_token');
        setUser(null);
    }, []);

    const isAdmin = user?.role === 'Admin';
    const isOperationsManager = user?.role === 'Operations Manager';
    const isHR = user?.role === 'HR' || isOperationsManager;
    const isMarketingManager = user?.role === 'Marketing Manager' || isOperationsManager;
    const isManager = user?.role === 'Project Manager' || isMarketingManager;
    const isAssociate = user?.role === 'Associate';
    const isManagerOrAdmin = isAdmin || isManager;
    const isHROrAdmin = isAdmin || isHR;

    const hasAccess = useCallback((module) => {
        if (!user) return false;
        if (isAdmin) return true;

        // Define module access per role
        const managerModules = [
            'dashboard', 'associates', 'projects', 'allocations',
            'timesheets', 'expenses', 'customers'
        ];
        const associateModules = ['dashboard', 'allocations', 'timesheets', 'payroll'];

        if (isHR) return ['dashboard', 'associates', 'payroll', 'assets', 'profile'].includes(module);
        if (isManager) return managerModules.includes(module);
        if (isAssociate) return associateModules.includes(module);

        return false;
    }, [user, isAdmin, isHR, isManager, isAssociate]);

    const getAuthHeader = useCallback(() => {
        const token = localStorage.getItem('chrms_token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    }, []);

    const value = {
        user,
        loading,
        googleClientId,
        login,
        logout,
        isAdmin,
        isHR,
        isManager,
        isOperationsManager,
        isAssociate,
        isManagerOrAdmin,
        isHROrAdmin,
        hasAccess,
        getAuthHeader,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
