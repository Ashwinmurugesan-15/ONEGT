import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCapability } from '../../contexts/CapabilityContext';
import logo from '../../assets/OneGT_logo.png';
import logoFull from '../../assets/logo_full.png';
import logoIcon from '../../assets/logo_icon.png';
import {
    ChevronLeft,
    ChevronRight,
    Package
} from 'lucide-react';

import { X } from 'lucide-react';

import { SettingsDialog } from '../../modules/talent/components/dialogs/SettingsDialog';
import { RecruitmentProvider } from '../../modules/talent/context/RecruitmentContext';
import { AuthProvider as TalentAuthProvider } from '../../modules/talent/context/AuthContext';

function Sidebar({ isMobileOpen, setIsMobileOpen }) {
    const { isAdmin, isManager, user } = useAuth();
    const { capability, menu } = useCapability();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebarCollapsed');
        return saved === 'true';
    });
    const [settingsOpen, setSettingsOpen] = useState(false);

    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', isCollapsed);
        window.dispatchEvent(new CustomEvent('sidebarToggle', { detail: { collapsed: isCollapsed } }));
    }, [isCollapsed]);

    // Close mobile sidebar on route change
    const handleNavClick = () => {
        if (window.innerWidth < 1024 && setIsMobileOpen) {
            setIsMobileOpen(false);
        }
    };

    const toggleSidebar = () => setIsCollapsed(!isCollapsed);

    // Check if user has required role for an item/section
    const hasAccess = (roles, excludeDesignations = []) => {
        if (isAdmin) return true; // Admins see everything

        const userRole = user?.role?.toLowerCase();
        const userDesignation = (user?.designation || user?.designation_id || '').toLowerCase();

        // Check exclusions first (case-insensitive)
        if (excludeDesignations && excludeDesignations.length > 0) {
            const isExcluded = excludeDesignations.some(d => {
                const lowerD = d.toLowerCase();
                return lowerD === userDesignation || lowerD === userRole;
            });
            if (isExcluded) return false;
        }

        // Check inclusions (case-insensitive)
        if (!roles || roles.length === 0) return true;

        return roles.some(role => {
            const roleLower = role.toLowerCase();
            return roleLower === userRole || roleLower === userDesignation;
        });
    };

    const NavItem = ({ to, action, icon: Icon, label, end = false }) => {
        if (action) {
            return (
                <button
                    className="nav-item w-full text-left"
                    title={isCollapsed ? label : undefined}
                    onClick={() => {
                        handleNavClick();
                        if (action === 'openTalentSettings') {
                            setSettingsOpen(true);
                        }
                    }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                    <Icon />
                    {!isCollapsed && <span>{label}</span>}
                    {isCollapsed && <span className="nav-tooltip">{label}</span>}
                </button>
            );
        }

        return (
            <NavLink
                to={to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                end={end}
                title={isCollapsed ? label : undefined}
                onClick={handleNavClick}
            >
                <Icon />
                {!isCollapsed && <span>{label}</span>}
                {isCollapsed && <span className="nav-tooltip">{label}</span>}
            </NavLink>
        );
    };

    // Get dynamic label for asset items
    const getLabel = (item) => {
        if (item.dynamicLabel) {
            return (isAdmin || isManager) ? 'Asset Management' : 'My Assets';
        }
        return item.label;
    };

    // Get icon color for capability
    const CapabilityIcon = capability.icon;

    return (
        <aside
            className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isHovered ? 'hover-expanded' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="sidebar-header">
                <NavLink
                    to={
                        capability.id === 'CRMS' ? '/crms' :
                            capability.id === 'TalentManagement' ? '/talent' :
                                capability.id === 'AssessmentPortal' ? '/assessment' : '/hrms'
                    }
                    className="sidebar-logo"
                    onClick={handleNavClick}
                >
                    {isCollapsed ? (
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: `${capability.color}15`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.3s ease'
                        }}>
                            <CapabilityIcon size={24} style={{ color: capability.color }} />
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: `${capability.color}15`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <CapabilityIcon size={20} style={{ color: capability.color }} />
                            </div>
                            <div>
                                <div style={{
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    color: 'white',
                                    fontFamily: 'inherit',
                                    lineHeight: 1.2,
                                    whiteSpace: 'normal',
                                    paddingRight: '0.5rem'
                                }}>
                                    {capability.fullName || capability.name}
                                </div>
                            </div>
                        </div>
                    )}
                </NavLink>
                {/* Desktop Toggle */}
                <button className="sidebar-toggle desktop-only" onClick={toggleSidebar} title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                    {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>
                {/* Mobile Close */}
                <button className="sidebar-toggle mobile-only" onClick={() => setIsMobileOpen(false)}>
                    <X size={20} />
                </button>
            </div>

            <nav className="sidebar-nav">
                {menu.map((section, sectionIndex) => {
                    // Check section-level role access
                    if (section.roles && !hasAccess(section.roles)) return null;

                    // Filter items based on role access and exclusion
                    const accessibleItems = section.items.filter(item => hasAccess(item.roles, item.excludeDesignations));
                    if (accessibleItems.length === 0) return null;

                    return (
                        <div className="nav-section" key={sectionIndex}>
                            {!isCollapsed && <div className="nav-section-title">{section.section}</div>}
                            {accessibleItems.map((item, itemIndex) => (
                                <NavItem
                                    key={itemIndex}
                                    to={item.to}
                                    action={item.action}
                                    icon={item.icon}
                                    label={getLabel(item)}
                                    end={item.end}
                                />
                            ))}
                        </div>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <img
                    src={logo}
                    alt="OneGT Logo"
                    className="sidebar-footer-logo"
                />
            </div>

            {settingsOpen && (
                <TalentAuthProvider>
                    <RecruitmentProvider>
                        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
                    </RecruitmentProvider>
                </TalentAuthProvider>
            )}
        </aside>
    );
}

export default Sidebar;

