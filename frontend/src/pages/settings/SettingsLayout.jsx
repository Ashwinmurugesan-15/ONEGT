import { NavLink, Outlet } from 'react-router-dom';
import { Building2, ShieldCheck, CalendarRange, Settings } from 'lucide-react';

const SettingsLayout = () => {
    const navItems = [
        { to: '/hrms/settings/company', icon: Building2, label: 'Company Profile' },
        { to: '/hrms/settings/iam', icon: ShieldCheck, label: 'IAM & Security' },
        { to: '/hrms/settings/leave', icon: CalendarRange, label: 'Leave Management' },
    ];

    return (
        <div className="settings-layout">
            {/* Settings Sidebar - matches main sidebar theme */}
            <div className="settings-sidebar">
                {/* Gear icon header */}
                <div className="settings-sidebar-header">
                    <div className="settings-sidebar-icon">
                        <Settings size={22} />
                    </div>
                    <span className="settings-sidebar-title">Settings</span>
                </div>

                {/* Navigation */}
                <nav className="settings-sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `settings-nav-item ${isActive ? 'active' : ''}`}
                        >
                            <item.icon size={20} />
                            <span className="settings-nav-label">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
            </div>

            {/* Settings Content Area */}
            <div className="settings-content">
                <Outlet />
            </div>

            <style>{`
                .settings-layout {
                    display: flex;
                    min-height: calc(100vh - 65px);
                }

                .settings-sidebar {
                    width: 68px;
                    background: var(--gradient-sidebar);
                    display: flex;
                    flex-direction: column;
                    border-right: 1px solid rgba(255, 255, 255, 0.08);
                    overflow: hidden;
                    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: sticky;
                    top: 65px;
                    height: calc(100vh - 65px);
                    z-index: 10;
                    flex-shrink: 0;
                }
                .settings-sidebar:hover {
                    width: 240px;
                }

                .settings-sidebar-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1.25rem 1.25rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    white-space: nowrap;
                }

                .settings-sidebar-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    background: rgba(255, 255, 255, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary-300);
                    flex-shrink: 0;
                }

                .settings-sidebar-title {
                    font-size: 1rem;
                    font-weight: 700;
                    color: white;
                    opacity: 0;
                    transition: opacity 0.2s ease 0s;
                }
                .settings-sidebar:hover .settings-sidebar-title {
                    opacity: 1;
                    transition: opacity 0.2s ease 0.1s;
                }

                .settings-sidebar-nav {
                    flex: 1;
                    padding: 0.75rem 0;
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .settings-nav-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1.25rem;
                    color: rgba(255, 255, 255, 0.6);
                    text-decoration: none;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                    border-left: 3px solid transparent;
                    margin: 0 0.5rem;
                    border-radius: 8px;
                    font-size: 0.875rem;
                    font-weight: 500;
                }
                .settings-nav-item svg {
                    flex-shrink: 0;
                    width: 20px;
                    height: 20px;
                }
                .settings-nav-item:hover {
                    color: rgba(255, 255, 255, 0.9);
                    background: rgba(255, 255, 255, 0.08);
                }
                .settings-nav-item.active {
                    color: white;
                    background: rgba(255, 255, 255, 0.12);
                    border-left-color: var(--primary-400);
                }

                .settings-nav-label {
                    opacity: 0;
                    transition: opacity 0.2s ease 0s;
                    overflow: hidden;
                }
                .settings-sidebar:hover .settings-nav-label {
                    opacity: 1;
                    transition: opacity 0.2s ease 0.1s;
                }

                .settings-content {
                    flex: 1;
                    min-width: 0;
                    padding: 1.5rem;
                }
            `}</style>
        </div>
    );
};

export default SettingsLayout;
