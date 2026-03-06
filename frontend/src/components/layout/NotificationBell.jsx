import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, ExternalLink } from 'lucide-react';
import { notificationsApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';

const NotificationBell = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const fetchNotifications = async () => {
        if (!user?.associate_id) return;
        try {
            const res = await notificationsApi.getAll(user.associate_id);
            setNotifications(res.data);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Poll every 5 minutes
        const interval = setInterval(fetchNotifications, 300000);
        return () => clearInterval(interval);
    }, [user?.associate_id]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = () => {
        setIsOpen(!isOpen);
    };

    const markAsRead = async (notification) => {
        if (notification.is_read) return;
        try {
            await notificationsApi.markAsRead(notification.row_index);
            setNotifications(notifications.map(n =>
                n.notification_id === notification.notification_id
                    ? { ...n, is_read: true }
                    : n
            ));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const markAllRead = async () => {
        if (!user?.associate_id || unreadCount === 0) return;
        try {
            await notificationsApi.markAllRead(user.associate_id);
            setNotifications(notifications.map(n => ({ ...n, is_read: true })));
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const date = new Date(timeStr);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="notification-bell-container" ref={dropdownRef}>
            <button className="btn-icon bell-btn" onClick={handleToggle}>
                <Bell size={20} />
                {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
            </button>

            {isOpen && (
                <div className="notification-dropdown">
                    <div className="dropdown-header">
                        <h3>Notifications</h3>
                        {unreadCount > 0 && (
                            <button className="btn-link" onClick={markAllRead}>
                                Mark all as read
                            </button>
                        )}
                    </div>
                    <div className="notification-list">
                        {notifications.length === 0 ? (
                            <div className="empty-notifications">
                                <p>No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n.notification_id}
                                    className={`notification-item ${!n.is_read ? 'unread' : ''}`}
                                    onClick={() => markAsRead(n)}
                                >
                                    <div className="notif-content">
                                        <div className="notif-title">{n.title}</div>
                                        <div className="notif-message">{n.message}</div>
                                        <div className="notif-time">{formatTime(n.created_at)}</div>
                                    </div>
                                    {n.link && (
                                        <Link
                                            to={
                                                n.link.startsWith('/hrms') || n.link.startsWith('/crms') ||
                                                    n.link.startsWith('/talent') || n.link.startsWith('/assessment')
                                                    ? n.link
                                                    : `/hrms${n.link.startsWith('/') ? '' : '/'}${n.link}`
                                            }
                                            className="notif-link"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <ExternalLink size={14} />
                                        </Link>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
