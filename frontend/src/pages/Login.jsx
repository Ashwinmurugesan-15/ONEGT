import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/OneGT_logo.png';

function Login() {
    const navigate = useNavigate();
    const { login, isAuthenticated, googleClientId, loading } = useAuth();
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [googleLoaded, setGoogleLoaded] = useState(false);

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated && !loading) {
            navigate('/hrms', { replace: true });
        }
    }, [isAuthenticated, loading, navigate]);

    // Initialize Google Sign-In
    useEffect(() => {
        if (!googleClientId || loading) {
            return;
        }

        const initializeGoogle = () => {
            if (window.google?.accounts?.id) {
                try {
                    window.google.accounts.id.initialize({
                        client_id: googleClientId,
                        callback: handleGoogleCallback,
                        auto_select: false,
                        cancel_on_tap_outside: true,
                    });

                    window.google.accounts.id.renderButton(
                        document.getElementById('google-signin-button'),
                        {
                            theme: 'outline',
                            size: 'large',
                            width: 320,
                            text: 'signin_with',
                            shape: 'rectangular',
                        }
                    );
                    setGoogleLoaded(true);
                } catch (err) {
                    console.error('Error initializing Google Sign-In:', err);
                    setError('Failed to initialize Google Sign-In');
                }
            }
        };

        // Wait for Google script to load
        if (window.google?.accounts?.id) {
            initializeGoogle();
        } else {
            const interval = setInterval(() => {
                if (window.google?.accounts?.id) {
                    initializeGoogle();
                    clearInterval(interval);
                }
            }, 100);

            // Timeout after 5 seconds
            const timeout = setTimeout(() => {
                clearInterval(interval);
                if (!googleLoaded) {
                    console.error('Google SDK failed to load after 5 seconds');
                    setError('Google Sign-In is taking too long to load. Please refresh the page.');
                }
            }, 5000);

            return () => {
                clearInterval(interval);
                clearTimeout(timeout);
            };
        }
    }, [googleClientId, loading]);

    const handleGoogleCallback = useCallback(async (response) => {
        setError('');
        setIsLoggingIn(true);

        try {
            const result = await login(response.credential);
            if (result.success) {
                navigate('/hrms', { replace: true });
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setIsLoggingIn(false);
        }
    }, [login, navigate]);

    if (loading) {
        return (
            <div className="login-page">
                <div className="login-card">
                    <div className="loading-spinner"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo">
                        <img src={logo} alt="OneGT Logo" style={{ height: '180px', width: 'auto' }} />
                    </div>
                    <h1 style={{ marginTop: '0.5rem' }}>OneGT</h1>
                    <p>GuhaTek Management System</p>
                </div>

                {error && (
                    <div className="login-error">
                        {error}
                    </div>
                )}

                <div className="login-form">
                    {isLoggingIn ? (
                        <div className="login-loading">
                            <div className="loading-spinner"></div>
                            <p>Signing you in...</p>
                        </div>
                    ) : (
                        <>
                            <p className="login-instruction">Sign in with your organization Google account</p>
                            <div id="google-signin-button" className="google-button-container"></div>
                        </>
                    )}
                </div>

                <div className="login-footer">
                    <p>Only registered associates can access this system.</p>
                    <p>Contact your administrator if you need access.</p>
                </div>
            </div>
        </div>
    );
}

export default Login;
