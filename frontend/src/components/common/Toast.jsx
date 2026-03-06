import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const Toast = ({ message, type = 'info', onClose }) => {
    const getBgColor = () => {
        switch (type) {
            case 'success': return '#10B981'; // Green
            case 'error': return '#EF4444'; // Red
            case 'warning': return '#F59E0B'; // Amber
            default: return '#3B82F6'; // Blue
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle size={18} />;
            case 'error': return <AlertCircle size={18} />;
            case 'warning': return <AlertCircle size={18} />;
            default: return <Info size={18} />;
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            borderLeft: `4px solid ${getBgColor()}`,
            minWidth: '300px',
            maxWidth: '450px',
            animation: 'slideIn 0.3s ease-out'
        }}>
            <div style={{ color: getBgColor(), display: 'flex', alignItems: 'center' }}>
                {getIcon()}
            </div>
            <div style={{ flex: 1, color: '#1F2937', fontSize: '14px', lineHeight: '1.4' }}>
                {message}
            </div>
            <button
                onClick={onClose}
                style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#9CA3AF',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                }}
            >
                <X size={14} />
            </button>
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default Toast;
