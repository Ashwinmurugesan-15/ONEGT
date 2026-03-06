import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

function Layout() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    return (
        <div className="app-layout">
            <Sidebar
                isMobileOpen={isMobileSidebarOpen}
                setIsMobileOpen={setIsMobileSidebarOpen}
            />
            {/* Mobile Overlay */}
            {isMobileSidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setIsMobileSidebarOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 40,
                        backdropFilter: 'blur(4px)'
                    }}
                />
            )}
            <div className="main-wrapper">
                <Header onMenuClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)} />
                <main className="main-content">
                    <Outlet />
                </main>
                <footer className="status-bar">
                    <div className="status-bar-copyright">
                        <span>&copy;</span>
                        <span>2026</span>
                        <strong>GuhaTek</strong>
                    </div>
                </footer>
            </div>
        </div>
    );
}

export default Layout;
