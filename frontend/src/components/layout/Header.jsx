import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCapability } from '../../contexts/CapabilityContext';
import { LogOut, Shield, ChevronDown, Search, Menu, Settings } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { getDriveDirectLink } from '../../utils/driveUtils';

function Header({ onMenuClick }) {
    const navigate = useNavigate();
    const { user, logout, isAdmin, isManager, isOperationsManager } = useAuth();
    //console.log("Current User in Header:", user);
    const { capability, capabilities, setCapability } = useCapability();
    const [showDropdown, setShowDropdown] = useState(false);
    const [showCapabilityDropdown, setShowCapabilityDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const capabilityRef = useRef(null);
    const [profileImg, setProfileImg] = useState(getDriveDirectLink(user?.picture));
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        setProfileImg(getDriveDirectLink(user?.picture));
        setImgError(false);
    }, [user?.picture]);

    const handleImageError = () => {
        if (!imgError && user?.google_picture && profileImg !== user.google_picture) {
            setProfileImg(user.google_picture);
            setImgError(true);
        } else {
            setProfileImg(null);
        }
    };

    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
            if (capabilityRef.current && !capabilityRef.current.contains(event.target)) {
                setShowCapabilityDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // Get initials from name
    const getInitials = (name) => {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    // Role badge color
    const getRoleBadgeClass = () => {
        if (isAdmin) return 'badge-error';
        if (isManager) return 'badge-warning';
        return 'badge-info';
    };

    // Filter capabilities based on user role or designation
    const accessibleCapabilities = capabilities.filter(cap => {
        if (!cap.roles || cap.roles.length === 0) return true; // Available to all
        const userRole = user?.role?.toLowerCase();
        const userDesignation = (user?.designation || user?.designation_id || '').toLowerCase();

        return cap.roles.some(role => {
            const roleLower = role.toLowerCase();
            return roleLower === userRole || roleLower === userDesignation;
        });
    });

    const CapabilityIcon = capability.icon;

    return (
        <header className="app-header">
            <div className="header-left">
                <button
                    className="mobile-menu-btn mobile-only"
                    onClick={onMenuClick}
                    style={{ marginRight: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-600)' }}
                >
                    <Menu size={24} />
                </button>
                <div className="header-search">
                    <Search size={18} />
                    <input type="text" placeholder="Search..." />
                </div>
            </div>

            <div className="header-right">
                {/* Capability Selector */}
                <div className="capability-selector" ref={capabilityRef} style={{ position: 'relative' }}>
                    <button
                        className="capability-trigger"
                        onClick={() => setShowCapabilityDropdown(!showCapabilityDropdown)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.875rem',
                            borderRadius: '0.5rem',
                            background: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            marginRight: '0.75rem',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                    >
                        <CapabilityIcon size={18} style={{ color: capability.color }} />
                        <span style={{
                            fontSize: '0.8125rem',
                            fontWeight: '600',
                            color: 'var(--gray-800)',
                            whiteSpace: 'nowrap'
                        }}>
                            {capability.name}
                        </span>
                        <ChevronDown
                            size={14}
                            style={{
                                color: 'var(--gray-500)',
                                transition: 'transform 0.2s ease',
                                transform: showCapabilityDropdown ? 'rotate(180deg)' : 'rotate(0deg)'
                            }}
                        />
                    </button>

                    {showCapabilityDropdown && (
                        <div
                            className="capability-dropdown"
                            style={{
                                position: 'absolute',
                                top: 'calc(100% + 0.5rem)',
                                right: 0,
                                minWidth: '280px',
                                background: 'white',
                                borderRadius: '0.75rem',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                                border: '1px solid var(--gray-200)',
                                padding: '0.5rem',
                                zIndex: 1000,
                                animation: 'fadeIn 0.15s ease'
                            }}
                        >
                            {accessibleCapabilities.map((cap) => {
                                const Icon = cap.icon;
                                const isActive = cap.id === capability.id;
                                return (
                                    <button
                                        key={cap.id}
                                        onClick={() => {
                                            setCapability(cap.id);
                                            setShowCapabilityDropdown(false);
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            width: '100%',
                                            padding: '0.75rem',
                                            borderRadius: '0.5rem',
                                            border: 'none',
                                            background: isActive ? `${cap.color}15` : 'transparent',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                            textAlign: 'left'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isActive) e.target.style.background = 'var(--gray-50)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isActive) e.target.style.background = 'transparent';
                                        }}
                                    >
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '0.5rem',
                                            background: `${cap.color}20`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <Icon size={16} style={{ color: cap.color }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontSize: '0.8125rem',
                                                fontWeight: '600',
                                                color: isActive ? cap.color : 'var(--gray-800)',
                                                marginBottom: '0.125rem'
                                            }}>
                                                {cap.fullName}
                                            </div>
                                            <div style={{
                                                fontSize: '0.6875rem',
                                                color: 'var(--gray-500)',
                                                lineHeight: 1.3
                                            }}>
                                                {cap.description}
                                            </div>
                                        </div>
                                        {isActive && (
                                            <div style={{
                                                width: '6px',
                                                height: '6px',
                                                borderRadius: '50%',
                                                background: cap.color,
                                                flexShrink: 0
                                            }} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Global Settings */}
                {(isAdmin || isOperationsManager) && (
                    <button
                        className="header-icon-btn"
                        onClick={() => navigate('/hrms/settings')}
                        title="System Settings"
                    >
                        <Settings size={20} />
                    </button>
                )}

                {/* Notifications */}
                <NotificationBell />

                {/* User Profile */}
                <div className="header-profile" ref={dropdownRef}>
                    <button
                        className="profile-trigger"
                        onClick={() => setShowDropdown(!showDropdown)}
                    >
                        {profileImg ? (
                            <img
                                src={profileImg}
                                alt={user.name}
                                className="profile-avatar"
                                referrerPolicy="no-referrer"
                                onError={handleImageError}
                            />
                        ) : (
                            <div className="profile-avatar profile-initials">
                                {getInitials(user?.name)}
                            </div>
                        )}
                        <ChevronDown size={16} className={`profile-chevron ${showDropdown ? 'open' : ''}`} />
                    </button>

                    {showDropdown && (
                        <div className="profile-dropdown">
                            <div className="dropdown-header">
                                <div className="dropdown-avatar-container">
                                    {profileImg ? (
                                        <img
                                            src={profileImg}
                                            alt={user.name}
                                            className="dropdown-avatar"
                                            referrerPolicy="no-referrer"
                                            onError={handleImageError}
                                        />
                                    ) : (
                                        <div className="dropdown-avatar profile-initials">
                                            {getInitials(user?.name)}
                                        </div>
                                    )}
                                </div>
                                <div className="dropdown-user-info">
                                    <div className="dropdown-user-name">{user?.name}</div>
                                    <div className="dropdown-user-email">{user?.email}</div>
                                    <span className={`badge ${getRoleBadgeClass()}`}>
                                        <Shield size={10} />
                                        {user?.role}
                                    </span>
                                </div>
                            </div>
                            <div className="dropdown-divider"></div>
                            <button className="dropdown-item logout" onClick={handleLogout}>
                                <LogOut size={16} />
                                <span>Logout</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

export default Header;

