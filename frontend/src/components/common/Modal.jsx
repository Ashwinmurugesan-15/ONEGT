import { X } from 'lucide-react';

function Modal({ isOpen, onClose, title, children, footer, size = 'md' }) {
    if (!isOpen) return null;

    const sizeClass = size === 'xl' ? 'modal-xl' : size === 'lg' ? 'modal-lg' : '';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className={`modal ${sizeClass}`} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                {footer && (
                    <div className="modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Modal;

