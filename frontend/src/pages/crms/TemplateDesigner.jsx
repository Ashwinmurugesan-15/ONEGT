import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Eye, ArrowLeft, CheckCircle, Palette, Save, Type, Code, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, Link, Undo2, Redo2, Variable, Heading1, Heading2, Image, Upload, Video, AlertTriangle, Highlighter, Paintbrush, Baseline, Columns, Move, Ruler } from 'lucide-react';
import { crmInvoiceTemplatesApi } from '../../services/crms_api';
import Modal from '../../components/common/Modal';
import { useToast } from '../../contexts/ToastContext';
import { defaultHeaderHtml, defaultFooterHtml, defaultTableHtml } from './templates';
import { sanitizeHtml } from './utils/htmlUtils';
import './Invoice.css';

// Available template variables
const TEMPLATE_VARIABLES = [
    {
        category: 'Company', variables: [
            { key: '{{company.name}}', label: 'Company Name' },
            { key: '{{company.address}}', label: 'Company Address' },
            { key: '{{company.phone}}', label: 'Company Phone' },
            { key: '{{company.email}}', label: 'Company Email' },
        ]
    },
    {
        category: 'Customer', variables: [
            { key: '{{customer.name}}', label: 'Customer Name' },
            { key: '{{customer.email}}', label: 'Customer Email' },
            { key: '{{customer.phone}}', label: 'Customer Phone' },
            { key: '{{customer.address}}', label: 'Customer Address' },
        ]
    },
    {
        category: 'Deal', variables: [
            { key: '{{deal.name}}', label: 'Deal Name' },
            { key: '{{deal.value}}', label: 'Deal Value' },
            { key: '{{deal.stage}}', label: 'Deal Stage' },
            { key: '{{deal.currency}}', label: 'Deal Currency' },
            { key: '{{deal.po_number}}', label: 'PO Number' },
        ]
    },
    {
        category: 'Invoice', variables: [
            { key: '{{invoice.number}}', label: 'Invoice Number' },
            { key: '{{invoice.issue_date}}', label: 'Issue Date' },
            { key: '{{invoice.due_date}}', label: 'Due Date' },
            { key: '{{invoice.subtotal}}', label: 'Subtotal' },
            { key: '{{invoice.tax}}', label: 'Tax Amount' },
            { key: '{{invoice.discount}}', label: 'Discount' },
            { key: '{{invoice.total}}', label: 'Grand Total' },
        ]
    },
];

const styles = {
    container: {
        backgroundColor: '#f3f4f6',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 2rem)',
        margin: '-1.5rem',
        overflow: 'hidden'
    },
    toolbar: {
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    },
    toolbarLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
    },
    toolbarRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
    },
    templateNameInput: {
        fontSize: '1.125rem',
        fontWeight: 'bold',
        border: 'none',
        background: 'transparent',
        outline: 'none',
        minWidth: '200px'
    },
    mainContent: {
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
    },
    sidebar: {
        width: '220px',
        backgroundColor: 'white',
        borderRight: '1px solid #e5e7eb',
        overflowY: 'auto',
        padding: '1rem',
        flexShrink: 0
    },
    sectionTitle: {
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: '1rem',
        textTransform: 'uppercase',
        fontSize: '0.7rem',
        letterSpacing: '0.05em'
    },
    categoryTitle: {
        fontSize: '0.7rem',
        fontWeight: '600',
        color: '#6b7280',
        textTransform: 'uppercase',
        marginBottom: '0.5rem'
    },
    variableBtn: {
        width: '100%',
        textAlign: 'left',
        padding: '0.375rem 0.5rem',
        fontSize: '0.75rem',
        backgroundColor: '#f9fafb',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        marginBottom: '0.25rem',
        transition: 'all 0.15s'
    },
    editorArea: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    },
    tabsBar: {
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '0.5rem 1rem 0',
        display: 'flex',
        gap: '0.5rem'
    },
    tab: {
        padding: '0.5rem 1rem',
        fontSize: '0.875rem',
        fontWeight: '500',
        border: 'none',
        borderBottom: '2px solid transparent',
        background: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        color: '#6b7280'
    },
    tabActive: {
        borderBottomColor: '#3b82f6',
        color: '#3b82f6'
    },
    modeToggle: {
        display: 'flex',
        gap: '0.25rem',
        marginLeft: 'auto',
        backgroundColor: '#f3f4f6',
        borderRadius: '6px',
        padding: '0.25rem'
    },
    modeBtn: {
        padding: '0.375rem 0.75rem',
        fontSize: '0.75rem',
        fontWeight: '500',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        backgroundColor: 'transparent',
        color: '#6b7280'
    },
    modeBtnActive: {
        backgroundColor: 'white',
        color: '#3b82f6',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
    },
    splitPane: {
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
    },
    editorPane: {
        flex: 1,
        padding: '1rem',
        backgroundColor: '#f9fafb',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '400px'
    },
    textarea: {
        width: '100%',
        flex: 1,
        minHeight: '300px',
        fontFamily: 'monospace',
        fontSize: '0.8rem',
        padding: '1rem',
        backgroundColor: 'white',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        resize: 'none',
        outline: 'none'
    },
    wysiwygToolbar: {
        display: 'flex',
        gap: '0.25rem',
        padding: '0.5rem',
        backgroundColor: 'white',
        border: '1px solid #d1d5db',
        borderBottom: 'none',
        borderRadius: '8px 8px 0 0',
        flexWrap: 'wrap'
    },
    formatBtn: {
        padding: '0.375rem',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        backgroundColor: 'transparent',
        color: '#374151',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    formatBtnActive: {
        backgroundColor: '#dbeafe',
        color: '#2563eb'
    },
    divider: {
        width: '1px',
        backgroundColor: '#e5e7eb',
        margin: '0 0.25rem'
    },
    wysiwygEditor: {
        flex: 1,
        minHeight: '250px',
        padding: '1.5rem',
        backgroundColor: 'var(--primary-color, white)',
        border: '1px solid #d1d5db',
        borderRadius: '0 0 8px 8px',
        outline: 'none',
        overflow: 'auto',
        transition: 'background-color 0.3s ease'
    },
    previewPane: {
        flex: 1,
        padding: '1rem',
        backgroundColor: '#e5e7eb',
        overflow: 'auto',
        display: 'flex',
        justifyContent: 'center'
    },
    previewPaper: {
        backgroundColor: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        width: '210mm',
        height: '297mm',
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
    },
    previewLabel: {
        fontSize: '0.7rem',
        color: '#9ca3af',
        textTransform: 'uppercase',
        marginBottom: '0',
        padding: '0.5rem 1rem',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
    },
    placeholder: {
        flex: 1,
        margin: '2rem',
        padding: '1rem',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '2px dashed #d1d5db',
        textAlign: 'center',
        color: '#9ca3af',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
    },
    colorInput: {
        width: '100%',
        height: '32px',
        borderRadius: '4px',
        border: '1px solid #d1d5db',
        cursor: 'pointer',
        padding: '2px'
    },
    label: {
        fontSize: '0.7rem',
        color: '#6b7280',
        display: 'block',
        marginBottom: '0.25rem'
    },
    variableDropdown: {
        position: 'relative',
        display: 'inline-block'
    },
    dropdownMenu: {
        position: 'absolute',
        top: '100%',
        left: 0,
        backgroundColor: 'white',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 100,
        minWidth: '180px',
        maxHeight: '250px',
        overflow: 'auto'
    },
    dropdownItem: {
        padding: '0.5rem 0.75rem',
        fontSize: '0.8rem',
        cursor: 'pointer',
        border: 'none',
        background: 'none',
        width: '100%',
        textAlign: 'left',
        display: 'block'
    }
};

function TemplateDesigner({ template, onClose, onEdit, viewOnly = false }) {
    const [formData, setFormData] = useState({
        name: 'New Template',
        header_html: defaultHeaderHtml,
        footer_html: defaultFooterHtml,
        items_html: defaultTableHtml,
        logo_url: '',
        primary_color: '#2563eb',
        secondary_color: '#64748b',
        table_header_color: '#f3f4f6',
        table_total_color: '#f0fdf4',
        font_family: 'Inter, sans-serif',
        is_default: false
    });

    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('header');
    const [editorMode, setEditorMode] = useState('visual'); // 'visual' or 'html'
    const [displayMode, setDisplayMode] = useState('edit'); // 'edit' or 'preview'
    const [showVarDropdown, setShowVarDropdown] = useState(false);
    const [showImageDropdown, setShowImageDropdown] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isRemoveImageModalOpen, setIsRemoveImageModalOpen] = useState(false);
    const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
    const editorRef = useRef(null);
    const fileInputRef = useRef(null);
    const lastActiveTabRef = useRef(null);
    const lastEditorModeRef = useRef(null);
    const lastDisplayModeRef = useRef(null);
    const lastContentRef = useRef({ header: '', footer: '', items: '' });
    const originalSnapshotRef = useRef(null);

    const [previewData] = useState({
        'company.name': 'THIRANGuhaTek X',
        'company.address': '123 Business Road, Tech City',
        'company.phone': '+1 234 567 890',
        'company.email': 'info@thiranx.com',
        'customer.name': 'Acme Corporation',
        'customer.email': 'billing@acme.com',
        'customer.phone': '+1 987 654 321',
        'customer.address': '456 Client Street, Business Park',
        'deal.name': 'Enterprise Solution',
        'deal.value': '50,000',
        'deal.stage': 'Closed Won',
        'deal.currency': 'USD',
        'deal.po_number': 'PO-98765',
        'invoice.number': 'INV-2024-001',
        'invoice.issue_date': '09-Feb-2024',
        'invoice.due_date': '23-Feb-2024',
        'invoice.subtotal': '50,000.00',
        'invoice.tax': '9,000.00',
        'invoice.discount': '0.00',
        'invoice.total': '59,000.00'
    });

    const [selectedElement, setSelectedElement] = useState(null);
    const [elementSettings, setElementSettings] = useState({
        width: '',
        height: '',
        align: 'left',
        positionMode: 'inline', // 'inline', 'break', 'overlay'
        isTextNode: false
    });

    // Custom History for Undo/Redo
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);
    const isHistoryChangeRef = useRef(false);

    const [resizeState, setResizeState] = useState(null); // { initialX, initialY, initialWidth, initialHeight, handle }
    const [dragState, setDragState] = useState(null); // { initialX, initialY, initialTop, initialLeft }
    const [elementRect, setElementRect] = useState(null);
    const [textIndent, setTextIndent] = useState(0); // Ruler state in pixels
    const [showRuler, setShowRuler] = useState(false);

    // Track cursor element to update ruler
    const cursorNodeRef = useRef(null);

    useEffect(() => {
        if (template) {
            const data = {
                name: template.name || 'Untitled',
                header_html: template.header_html || '',
                footer_html: template.footer_html || '',
                items_html: template.items_html || formData.items_html,
                logo_url: template.logo_url || '',
                primary_color: template.primary_color || '#2563eb',
                secondary_color: template.secondary_color || '#64748b',
                table_header_color: template.table_header_color || '#f3f4f6',
                table_total_color: template.table_total_color || '#f0fdf4',
                font_family: template.font_family || 'Inter, sans-serif',
                is_default: template.is_default || false
            };
            setFormData(data);
            // Store initial snapshot
            originalSnapshotRef.current = JSON.stringify(data);

            // Initialize history
            historyRef.current = [{ ...data }];
            historyIndexRef.current = 0;
        } else {
            // Initial snapshot for new template
            const initialData = { ...formData };
            originalSnapshotRef.current = JSON.stringify(initialData);
            historyRef.current = [{ ...initialData }];
            historyIndexRef.current = 0;
        }
    }, [template]);

    // Push to history when content changes
    useEffect(() => {
        if (isHistoryChangeRef.current) {
            isHistoryChangeRef.current = false;
            return;
        }

        const timeoutId = setTimeout(() => {
            const currentData = { ...formData };
            const lastData = historyRef.current[historyIndexRef.current];

            // Only push if content actually changed
            if (lastData && (currentData.header_html !== lastData.header_html || currentData.footer_html !== lastData.footer_html || currentData.items_html !== lastData.items_html)) {
                pushToHistory(currentData);
            }
        }, 1000); // Debounce history pushes

        return () => clearTimeout(timeoutId);
    }, [formData.header_html, formData.footer_html]);

    const pushToHistory = (newData) => {
        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        newHistory.push({ ...newData });

        // Limit history size to 50
        if (newHistory.length > 50) newHistory.shift();

        historyRef.current = newHistory;
        historyIndexRef.current = newHistory.length - 1;
    };

    const handleUndo = () => {
        if (historyIndexRef.current > 0) {
            historyIndexRef.current -= 1;
            const prevData = historyRef.current[historyIndexRef.current];
            isHistoryChangeRef.current = true;
            setFormData(prevData);

            // Sync editor immediately
            if (editorRef.current) {
                const html = activeTab === 'header' ? prevData.header_html : (activeTab === 'footer' ? prevData.footer_html : prevData.items_html);
                editorRef.current.innerHTML = html;
                lastContentRef.current[activeTab] = html;
            }
        }
    };

    const handleRedo = () => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current += 1;
            const nextData = historyRef.current[historyIndexRef.current];
            isHistoryChangeRef.current = true;
            setFormData(nextData);

            // Sync editor immediately
            if (editorRef.current) {
                const html = nextData[activeTab === 'header' ? 'header_html' : (activeTab === 'footer' ? 'footer_html' : 'items_html')];
                editorRef.current.innerHTML = html;
                lastContentRef.current[activeTab] = html;
            }
        }
    };

    // Update element rect for handles
    useEffect(() => {
        if (!selectedElement || displayMode !== 'edit' || editorMode !== 'visual') {
            setElementRect(null);
            return;
        }

        const updateRect = () => {
            if (!selectedElement || !editorRef.current) return;
            const rect = selectedElement.getBoundingClientRect();
            const parentRect = editorRef.current.getBoundingClientRect();
            setElementRect({
                top: rect.top - parentRect.top,
                left: rect.left - parentRect.left,
                width: rect.width,
                height: rect.height
            });
        };

        updateRect();
        const interval = setInterval(updateRect, 100); // Poll for position changes (e.g. typing)
        return () => clearInterval(interval);
    }, [selectedElement, displayMode, editorMode, formData.header_html, formData.footer_html]);

    // Handle global mouse events for resizing and dragging
    useEffect(() => {
        const onMouseMove = (e) => {
            if (!selectedElement) return;

            // Handle Resizing
            if (resizeState) {
                const deltaX = e.clientX - resizeState.initialX;
                const deltaY = e.clientY - resizeState.initialY;

                let newWidth = resizeState.initialWidth;
                let newHeight = resizeState.initialHeight;

                if (resizeState.handle.includes('right')) newWidth += deltaX;
                if (resizeState.handle.includes('left')) newWidth -= deltaX;
                if (resizeState.handle.includes('bottom')) newHeight += deltaY;
                if (resizeState.handle.includes('top')) newHeight -= deltaY;

                newWidth = Math.max(20, newWidth);
                newHeight = Math.max(20, newHeight);

                selectedElement.style.width = `${newWidth}px`;
                selectedElement.style.height = `${newHeight}px`;

                setElementSettings(prev => ({
                    ...prev,
                    width: `${newWidth}px`,
                    height: `${newHeight}px`
                }));
            }

            // Handle Dragging overlays
            if (dragState) {
                const deltaX = e.clientX - dragState.initialX;
                const deltaY = e.clientY - dragState.initialY;

                selectedElement.style.left = `${dragState.initialLeft + deltaX}px`;
                selectedElement.style.top = `${dragState.initialTop + deltaY}px`;
                selectedElement.style.position = 'absolute';
            }
        };

        const onMouseUp = () => {
            if (resizeState || dragState) {
                setResizeState(null);
                setDragState(null);
                handleWysiwygChange();
            }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [resizeState, dragState, selectedElement]);

    const startResize = (e, handle) => {
        e.preventDefault();
        e.stopPropagation();
        setResizeState({
            initialX: e.clientX,
            initialY: e.clientY,
            initialWidth: selectedElement.offsetWidth,
            initialHeight: selectedElement.offsetHeight,
            handle
        });
    };

    const startDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (elementSettings.positionMode !== 'overlay') return;

        const style = window.getComputedStyle(selectedElement);
        setDragState({
            initialX: e.clientX,
            initialY: e.clientY,
            initialTop: parseInt(style.top, 10) || 0,
            initialLeft: parseInt(style.left, 10) || 0
        });
    };

    // Sync WYSIWYG editor content when tab, mode, or data changes
    useEffect(() => {
        if (editorRef.current && editorMode === 'visual') {
            const currentHtml = activeTab === 'header' ? formData.header_html : (activeTab === 'footer' ? formData.footer_html : formData.items_html);

            // Sync if:
            // 1. Tab/mode/displayMode changed
            // 2. Content changed externally
            // 3. OR CRITICAL: The editor DOM is empty but shouldn't be (handles remounting/blank screen)
            const isEditorEmpty = !editorRef.current.innerHTML || editorRef.current.innerHTML === '<br>';
            const contentMismatch = editorRef.current.innerHTML !== currentHtml;

            if (lastActiveTabRef.current !== activeTab ||
                lastEditorModeRef.current !== editorMode ||
                lastDisplayModeRef.current !== displayMode ||
                lastContentRef.current[activeTab] !== currentHtml ||
                (isEditorEmpty && currentHtml)) {

                editorRef.current.innerHTML = currentHtml;

                // Track current state to prevent redundant syncs from user typing
                lastContentRef.current[activeTab] = currentHtml;
                lastActiveTabRef.current = activeTab;
                lastEditorModeRef.current = editorMode;
                lastDisplayModeRef.current = displayMode;
            }
        }
    }, [activeTab, editorMode, formData.header_html, formData.footer_html, formData.items_html, displayMode, viewOnly]);

    const insertVariable = (varKey) => {
        if (editorMode === 'visual' && editorRef.current) {
            // Insert at cursor position in contentEditable
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const span = document.createElement('span');
                // No highlight or special styling per user request
                span.textContent = varKey;
                range.deleteContents();
                range.insertNode(span);
                range.setStartAfter(span);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                handleWysiwygChange();
            }
        } else {
            const field = activeTab === 'header' ? 'header_html' : (activeTab === 'footer' ? 'footer_html' : 'items_html');
            setFormData(prev => ({
                ...prev,
                [field]: prev[field] + varKey
            }));
        }
        setShowVarDropdown(false);
    };

    const insertColumns = (count) => {
        if (editorMode === 'visual' && editorRef.current) {
            const colsHtml = Array(count).fill('<div style="flex: 1; min-height: 40px; padding: 0.5rem;">Column</div>').join('');
            const html = `
                <div class="gt-columns" style="display: flex; gap: 1rem; margin-bottom: 1rem; width: 100%;">
                    ${colsHtml}
                </div><p><br></p>
            `;
            execCommand('insertHTML', html);
        }
    };

    const insertTextBox = () => {
        if (editorMode === 'visual' && editorRef.current) {
            const html = `
                <div class="gt-draggable" style="position: absolute; width: 250px; padding: 10px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; top: 50px; left: 50px; z-index: 10; display: block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <p style="margin:0;">Double click to edit Text Box</p>
                </div>
            `;
            execCommand('insertHTML', html);
        }
    };

    const handleIndentChange = (e) => {
        const val = parseInt(e.target.value, 10);
        setTextIndent(val);
        if (cursorNodeRef.current && cursorNodeRef.current !== editorRef.current) {
            if (['LI', 'UL', 'OL'].includes(cursorNodeRef.current.tagName)) {
                cursorNodeRef.current.style.marginLeft = `${val}px`;
            } else {
                cursorNodeRef.current.style.paddingLeft = `${val}px`;
            }
            handleWysiwygChange();
        }
    };

    const handleEditorClick = (e) => {
        const isDraggable = e.target.tagName === 'IMG' || e.target.classList.contains('gt-draggable');
        if (isDraggable) {
            const el = e.target;
            setSelectedElement(el);

            // Determine position mode
            let mode = 'inline';
            if (el.style.position === 'absolute') mode = 'overlay';
            else if (el.style.display === 'block') mode = 'break';

            // Determine alignment
            let align = 'left';
            if (el.style.margin === '0px auto' || el.style.margin === '0 auto') align = 'center';
            else if (el.style.marginLeft === 'auto') align = 'right';

            setElementSettings({
                width: el.style.width || el.width || '',
                height: el.style.height || el.height || '',
                align: align,
                positionMode: mode,
                isTextNode: el.tagName !== 'IMG'
            });
        } else {
            setSelectedElement(null);
        }

        // Track the block node for ruler positioning
        let node = e.target;
        while (node && node !== editorRef.current && !['P', 'DIV', 'H1', 'H2', 'LI', 'UL', 'OL'].includes(node.tagName)) {
            node = node.parentNode;
        }
        if (node && node !== editorRef.current) {
            cursorNodeRef.current = node;
            const style = window.getComputedStyle(node);
            const padding = parseInt(style.paddingLeft, 10) || 0;
            const margin = parseInt(style.marginLeft, 10) || 0;
            setTextIndent(['LI', 'UL', 'OL'].includes(node.tagName) ? margin : padding);
        }
    };

    const handleEditorKeyDown = (e) => {
        if (e.key === 'Enter') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const container = range.commonAncestorContainer;
                const parent = container.nodeType === 3 ? container.parentNode : container;

                // If cursor is near an image or we want a forced break
                e.preventDefault();

                // If the selected element is 'break' mode, ensure we go below it
                if (selectedElement && elementSettings.positionMode === 'break') {
                    const br = document.createElement('br');
                    range.insertNode(br);
                    range.setStartAfter(br);
                    range.setEndAfter(br);
                } else {
                    document.execCommand('insertLineBreak');
                }

                handleWysiwygChange();

                // Ensure the editor scrolls if needed
                setTimeout(() => {
                    const editor = editorRef.current;
                    if (editor) editor.scrollTop = editor.scrollHeight;
                }, 0);
            }
        }
    };

    const updateElementStyle = (key, value) => {
        if (!selectedElement) return;

        const updatedSettings = { ...elementSettings, [key]: value };
        setElementSettings(updatedSettings);

        if (key === 'width' || key === 'height') {
            const val = value ? (value.endsWith('%') || value.endsWith('px') ? value : value + 'px') : '';
            selectedElement.style[key] = val;
            if (val && selectedElement.tagName === 'IMG') selectedElement.removeAttribute(key);
        } else if (key === 'align' || key === 'positionMode') {
            const mode = key === 'positionMode' ? value : elementSettings.positionMode;
            const align = key === 'align' ? value : elementSettings.align;

            // Reset conflicting styles
            selectedElement.style.position = 'static';
            selectedElement.style.display = 'inline-block';
            selectedElement.style.margin = '0';
            selectedElement.style.zIndex = 'auto';
            selectedElement.style.float = 'none';

            if (mode === 'overlay') {
                selectedElement.style.position = 'absolute';
                selectedElement.style.zIndex = '10';
                selectedElement.style.display = 'block';
                if (!selectedElement.style.top) selectedElement.style.top = '10px';
                if (!selectedElement.style.left) selectedElement.style.left = '10px';
            } else if (mode === 'break') {
                selectedElement.style.display = 'block';
                if (align === 'center') {
                    selectedElement.style.margin = '0 auto';
                } else if (align === 'right') {
                    selectedElement.style.marginLeft = 'auto';
                }
            } else {
                // In Line
                selectedElement.style.display = 'inline-block';
                selectedElement.style.verticalAlign = 'middle';
                if (align === 'center') {
                    selectedElement.style.display = 'block';
                    selectedElement.style.margin = '0 auto';
                } else if (align === 'right') {
                    selectedElement.style.float = 'right';
                    selectedElement.style.margin = '0 0 10px 10px';
                }
            }
        }

        handleWysiwygChange();
    };

    const handleWysiwygChange = () => {
        if (!editorRef.current) return;
        const html = editorRef.current.innerHTML;
        const field = activeTab === 'header' ? 'header_html' : (activeTab === 'footer' ? 'footer_html' : 'items_html');

        // Update tracking ref so useEffect knows this was an internal change
        lastContentRef.current[activeTab] = html;

        setFormData(prev => ({ ...prev, [field]: html }));
    };

    const hasUnsavedChanges = () => {
        if (viewOnly) return false;
        const currentData = JSON.stringify(formData);
        return currentData !== originalSnapshotRef.current;
    };

    const handleBack = () => {
        if (hasUnsavedChanges()) {
            setShowConfirmModal(true);
        } else {
            onClose();
        }
    };

    const execCommand = (command, value = null) => {
        if (command === 'undo') {
            handleUndo();
            return;
        }
        if (command === 'redo') {
            handleRedo();
            return;
        }
        document.execCommand(command, false, value);
        editorRef.current?.focus();
        handleWysiwygChange();
    };

    const insertImage = () => {
        const url = prompt('Enter image URL:');
        if (url) {
            execCommand('insertImage', url);
        }
        setShowImageDropdown(false);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                execCommand('insertImage', base64);
            };
            reader.readAsDataURL(file);
        }
        setShowImageDropdown(false);
        e.target.value = ''; // Reset file input
    };

    const renderPreviewHtml = (html) => {
        let rendered = html || '';
        // Strip the variable highlights if they exist by replacing the specific style string
        rendered = rendered.replace(/background-color:\s*#dbeafe;?/gi, '');
        rendered = rendered.replace(/color:\s*#2563eb;?/gi, '');
        rendered = rendered.replace(/padding:\s*0\s*4px;?/gi, '');
        rendered = rendered.replace(/border-radius:\s*4px;?/gi, '');
        rendered = rendered.replace(/font-family:\s*monospace;?/gi, '');
        rendered = rendered.replace(/font-size:\s*0\.85em;?/gi, '');

        Object.entries(previewData).forEach(([key, value]) => {
            rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });
        rendered = rendered.replace(/{{primary_color}}/g, formData.primary_color);
        rendered = rendered.replace(/{{secondary_color}}/g, formData.secondary_color);
        rendered = rendered.replace(/{{table_header_color}}/g, formData.table_header_color);
        rendered = rendered.replace(/{{table_total_color}}/g, formData.table_total_color);

        // Financial placeholders for preview
        rendered = rendered.replace(/{{subtotal}}/g, previewData['invoice.subtotal'] || '$59,000.00');
        rendered = rendered.replace(/{{tax_label}}/g, 'Tax (18%)');
        rendered = rendered.replace(/{{tax}}/g, previewData['invoice.tax'] || '$9,000.00');
        rendered = rendered.replace(/{{total}}/g, previewData['invoice.total'] || '$59,000.00');

        // Discount row - show sample in preview
        const sampleDiscountRow = `<tr>
            <td style="padding: 0.35rem 0.75rem; text-align: right; font-weight: 600; color: #374151;">Discount</td>
            <td style="padding: 0.35rem 0.75rem; text-align: right; width: 150px; color: #dc2626;">-$500.00</td>
        </tr>`;
        rendered = rendered.replace(/{{discount_row}}/g, sampleDiscountRow);
        // Individual discount placeholders (user-customized templates)
        rendered = rendered.replace(/{{discount_label}}/g, 'Discount');
        rendered = rendered.replace(/{{discount}}/g, '-$500.00');

        if (rendered.includes('{{items_rows}}')) {
            const sampleRows = `
                <tr>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb;">Enterprise Software License</td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; text-align: center;">1</td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; text-align: right;">$50,000.00</td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; text-align: right;">$50,000.00</td>
                </tr>
                <tr>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb;">Implementation Services</td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; text-align: center;">40</td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; text-align: right;">$225.00</td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; text-align: right;">$9,000.00</td>
                </tr>
            `;
            rendered = rendered.replace('{{items_rows}}', sampleRows);
        }
        return rendered;
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (template?.id) {
                await crmInvoiceTemplatesApi.update(template.id, formData);
                showToast('Template updated successfully', 'success');
            } else {
                await crmInvoiceTemplatesApi.create(formData);
                showToast('Template created successfully', 'success');
            }
            // Update snapshot after successful save
            originalSnapshotRef.current = JSON.stringify(formData);
            onClose();
        } catch (error) {
            console.error('Error saving template:', error);
            showToast('Failed to save template', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={styles.container}>
            {/* Toolbar */}
            <div style={{
                ...styles.toolbar,
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid #e2e8f0',
                padding: '0.75rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div style={styles.toolbarLeft}>
                    <button
                        onClick={handleBack}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <ArrowLeft size={18} /> Back
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '1.5rem' }}>
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: '#94a3b8'
                        }}>
                            Design Template
                        </span>
                        <div style={{ width: '1px', height: '20px', backgroundColor: '#e2e8f0' }}></div>
                        <input
                            type="text"
                            style={{
                                ...styles.templateNameInput,
                                border: 'none',
                                background: 'transparent',
                                fontSize: '1.125rem',
                                fontWeight: '700',
                                color: '#0f172a',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                outline: 'none',
                                width: 'auto',
                                minWidth: '200px'
                            }}
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Template Name"
                            onFocus={(e) => e.target.style.backgroundColor = '#f1f5f9'}
                            onBlur={(e) => e.target.style.backgroundColor = 'transparent'}
                        />
                        {formData.is_default && (
                            <span style={{
                                backgroundColor: '#ecfdf5',
                                color: '#059669',
                                padding: '2px 8px',
                                borderRadius: '99px',
                                fontSize: '0.65rem',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                marginLeft: '0.5rem'
                            }}>
                                Default
                            </span>
                        )}
                    </div>
                </div>
                <div style={styles.toolbarRight}>
                    {displayMode === 'preview' ? (
                        <button
                            onClick={() => setDisplayMode('edit')}
                            className="btn btn-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Edit2 size={18} /> Edit Template
                        </button>
                    ) : viewOnly ? (
                        <button
                            onClick={onEdit}
                            className="btn btn-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Edit2 size={18} /> Edit Template
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="btn btn-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', opacity: saving ? 0.7 : 1 }}
                        >
                            <Save size={18} /> {saving ? 'Saving...' : 'Save Template'}
                        </button>
                    )}
                </div>
            </div>

            <div style={styles.mainContent}>
                {/* Variables Sidebar */}
                {!viewOnly && (
                    <div style={styles.sidebar}>
                        <h3 style={{ ...styles.sectionTitle, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Palette size={14} /> Styling
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>
                                Use the toolbar to adjust branding and styling.
                            </div>
                        </div>

                        {selectedElement && (
                            <div style={{ marginTop: '2rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
                                <h3 style={{ ...styles.sectionTitle, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#2563eb' }}>
                                    {elementSettings.isTextNode ? <Type size={14} /> : <Image size={14} />}
                                    {elementSettings.isTextNode ? 'Text Box Options' : 'Image Options'}
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div>
                                        <label style={styles.label}>Width (px or %)</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            style={{ width: '100%', fontSize: '0.75rem', padding: '0.375rem' }}
                                            value={elementSettings.width}
                                            onChange={(e) => updateElementStyle('width', e.target.value)}
                                            placeholder="Auto"
                                        />
                                    </div>
                                    <div>
                                        <label style={styles.label}>Height (px)</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            style={{ width: '100%', fontSize: '0.75rem', padding: '0.375rem' }}
                                            value={elementSettings.height}
                                            onChange={(e) => updateElementStyle('height', e.target.value)}
                                            placeholder="Auto"
                                        />
                                    </div>
                                    <div>
                                        <label style={styles.label}>Positioning</label>
                                        <div style={{ display: 'flex', gap: '2px', backgroundColor: '#f3f4f6', padding: '2px', borderRadius: '4px', marginBottom: '0.5rem' }}>
                                            {[
                                                { id: 'inline', label: 'In Line' },
                                                { id: 'break', label: 'Break Text' },
                                                { id: 'overlay', label: 'Overlay' }
                                            ].map(mode => (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => updateElementStyle('positionMode', mode.id)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '4px',
                                                        fontSize: '0.7rem',
                                                        border: 'none',
                                                        borderRadius: '3px',
                                                        cursor: 'pointer',
                                                        backgroundColor: elementSettings.positionMode === mode.id ? 'white' : 'transparent',
                                                        color: elementSettings.positionMode === mode.id ? '#2563eb' : '#6b7280',
                                                        boxShadow: elementSettings.positionMode === mode.id ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                                                    }}
                                                >
                                                    {mode.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ opacity: elementSettings.positionMode === 'overlay' ? 0.5 : 1, pointerEvents: elementSettings.positionMode === 'overlay' ? 'none' : 'auto' }}>
                                        <label style={styles.label}>Alignment</label>
                                        <div style={{ display: 'flex', gap: '2px', backgroundColor: '#f3f4f6', padding: '2px', borderRadius: '4px' }}>
                                            {['left', 'center', 'right'].map(align => (
                                                <button
                                                    key={align}
                                                    onClick={() => updateElementStyle('align', align)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '4px',
                                                        fontSize: '0.7rem',
                                                        border: 'none',
                                                        borderRadius: '3px',
                                                        cursor: 'pointer',
                                                        backgroundColor: elementSettings.align === align ? 'white' : 'transparent',
                                                        color: elementSettings.align === align ? '#2563eb' : '#6b7280',
                                                        boxShadow: elementSettings.align === align ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                                                    }}
                                                >
                                                    {align.charAt(0).toUpperCase() + align.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-sm btn-ghost text-error"
                                        style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}
                                        onClick={() => setIsRemoveImageModalOpen(true)}
                                    >
                                        <Trash2 size={12} className="mr-1" /> Remove Element
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Editor Area */}
                <div style={styles.editorArea}>
                    {/* Tabs & Mode Toggle */}
                    {!viewOnly && (
                        <div style={styles.tabsBar}>
                            <button
                                style={{ ...styles.tab, ...(activeTab === 'header' ? styles.tabActive : {}) }}
                                onClick={() => {
                                    if (editorMode === 'visual') handleWysiwygChange();
                                    setActiveTab('header');
                                }}
                            >
                                Header
                            </button>
                            <button
                                style={{ ...styles.tab, ...(activeTab === 'footer' ? styles.tabActive : {}) }}
                                onClick={() => {
                                    if (editorMode === 'visual') handleWysiwygChange();
                                    setActiveTab('footer');
                                }}
                            >
                                Footer
                            </button>
                            <button
                                style={{ ...styles.tab, ...(activeTab === 'items' ? styles.tabActive : {}) }}
                                onClick={() => {
                                    if (editorMode === 'visual') handleWysiwygChange();
                                    setActiveTab('items');
                                }}
                            >
                                Table
                            </button>

                            {/* Edit vs Preview Toggle */}
                            <div style={{ ...styles.modeToggle, marginLeft: '2rem' }}>
                                <button
                                    style={{ ...styles.modeBtn, ...(displayMode === 'edit' ? styles.modeBtnActive : {}) }}
                                    onClick={() => {
                                        if (displayMode === 'preview') {
                                            setDisplayMode('edit');
                                        }
                                    }}
                                >
                                    Edit Layout
                                </button>
                                <button
                                    style={{ ...styles.modeBtn, ...(displayMode === 'preview' ? styles.modeBtnActive : {}) }}
                                    onClick={() => {
                                        if (displayMode === 'edit') {
                                            if (editorMode === 'visual') handleWysiwygChange();
                                            setDisplayMode('preview');
                                        }
                                    }}
                                >
                                    View Preview
                                </button>
                            </div>

                            {/* Visual vs HTML Mode Toggle (Only in Edit Mode) */}
                            {displayMode === 'edit' && (
                                <div style={styles.modeToggle}>
                                    <button
                                        style={{ ...styles.modeBtn, ...(editorMode === 'visual' ? styles.modeBtnActive : {}) }}
                                        onClick={() => setEditorMode('visual')}
                                    >
                                        <Type size={14} /> Visual
                                    </button>
                                    <button
                                        style={{ ...styles.modeBtn, ...(editorMode === 'html' ? styles.modeBtnActive : {}) }}
                                        onClick={() => setEditorMode('html')}
                                    >
                                        <Code size={14} /> HTML
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={styles.splitPane}>
                        {/* Editor Pane */}
                        {!viewOnly && displayMode === 'edit' && (
                            <div style={styles.editorPane}>
                                {editorMode === 'visual' ? (
                                    <>
                                        {/* WYSIWYG Toolbar */}
                                        <div style={styles.wysiwygToolbar}>
                                            <button style={styles.formatBtn} onClick={() => execCommand('bold')} title="Bold">
                                                <Bold size={16} />
                                            </button>
                                            <button style={styles.formatBtn} onClick={() => execCommand('italic')} title="Italic">
                                                <Italic size={16} />
                                            </button>
                                            <button style={styles.formatBtn} onClick={() => execCommand('underline')} title="Underline">
                                                <Underline size={16} />
                                            </button>
                                            <div style={styles.divider}></div>
                                            <button style={styles.formatBtn} onClick={() => execCommand('justifyLeft')} title="Align Left">
                                                <AlignLeft size={16} />
                                            </button>
                                            <button style={styles.formatBtn} onClick={() => execCommand('justifyCenter')} title="Center">
                                                <AlignCenter size={16} />
                                            </button>
                                            <button style={styles.formatBtn} onClick={() => execCommand('justifyRight')} title="Align Right">
                                                <AlignRight size={16} />
                                            </button>
                                            <button style={{ ...styles.formatBtn, backgroundColor: showRuler ? '#dbeafe' : 'transparent', color: showRuler ? '#2563eb' : '#374151' }} onClick={() => setShowRuler(!showRuler)} title="Toggle Ruler">
                                                <Ruler size={16} />
                                            </button>
                                            <div style={styles.divider}></div>
                                            <button style={styles.formatBtn} onClick={() => execCommand('insertUnorderedList')} title="Bullet List">
                                                <List size={16} />
                                            </button>
                                            <div style={styles.divider}></div>
                                            <button style={{ ...styles.formatBtn, gap: '0.25rem', padding: '0.375rem 0.5rem' }} onClick={() => insertColumns(2)} title="Insert 2 Columns">
                                                <Columns size={16} /> Cols
                                            </button>
                                            <button style={{ ...styles.formatBtn, gap: '0.25rem', padding: '0.375rem 0.5rem' }} onClick={insertTextBox} title="Insert Text Box">
                                                <Type size={16} /> Box
                                            </button>
                                            <div style={styles.divider}></div>
                                            <div style={styles.variableDropdown}>
                                                <button
                                                    style={{ ...styles.formatBtn, gap: '0.25rem', padding: '0.375rem 0.5rem' }}
                                                    onClick={() => setShowImageDropdown(!showImageDropdown)}
                                                    title="Insert Image"
                                                >
                                                    <Image size={16} />
                                                </button>
                                                {showImageDropdown && (
                                                    <div style={styles.dropdownMenu}>
                                                        <button
                                                            style={styles.dropdownItem}
                                                            onClick={() => fileInputRef.current?.click()}
                                                            onMouseOver={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                                                            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                                                        >
                                                            <Upload size={14} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                                                            Upload from Computer
                                                        </button>
                                                        <button
                                                            style={styles.dropdownItem}
                                                            onClick={insertImage}
                                                            onMouseOver={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                                                            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                                                        >
                                                            <Link size={14} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                                                            Insert from URL
                                                        </button>
                                                    </div>
                                                )}
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    style={{ display: 'none' }}
                                                    accept="image/*"
                                                    onChange={handleFileUpload}
                                                />
                                            </div>
                                            <div style={styles.divider}></div>
                                            <button style={styles.formatBtn} onClick={() => execCommand('undo')} title="Undo">
                                                <Undo2 size={16} />
                                            </button>
                                            <button style={styles.formatBtn} onClick={() => execCommand('redo')} title="Redo">
                                                <Redo2 size={16} />
                                            </button>
                                            <button style={{ ...styles.formatBtn, color: '#dc2626' }} onClick={() => setIsClearAllModalOpen(true)} title="Clear All">
                                                <Trash2 size={16} />
                                            </button>
                                            <div style={styles.divider}></div>
                                            <div style={styles.variableDropdown}>
                                                <button
                                                    style={{ ...styles.formatBtn, gap: '0.25rem', padding: '0.375rem 0.5rem' }}
                                                    onClick={() => setShowVarDropdown(!showVarDropdown)}
                                                    title="Insert Variable"
                                                >
                                                    <Variable size={16} /> Variable
                                                </button>
                                                {showVarDropdown && (
                                                    <div style={styles.dropdownMenu}>
                                                        {TEMPLATE_VARIABLES.flatMap(cat =>
                                                            cat.variables.map((v) => (
                                                                <button
                                                                    key={v.key}
                                                                    style={styles.dropdownItem}
                                                                    onClick={() => insertVariable(v.key)}
                                                                    onMouseOver={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                                                                    onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                                                                >
                                                                    {v.label}
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={styles.divider}></div>
                                            <select
                                                style={{ border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.75rem', padding: '0.25rem' }}
                                                onChange={(e) => execCommand('fontName', e.target.value)}
                                                defaultValue=""
                                                title="Font Family"
                                            >
                                                <option value="" disabled>Font</option>
                                                <option value="Arial">Arial</option>
                                                <option value="Georgia">Georgia</option>
                                                <option value="Times New Roman">Times New Roman</option>
                                                <option value="Courier New">Courier New</option>
                                                <option value="Verdana">Verdana</option>
                                                <option value="Trebuchet MS">Trebuchet</option>
                                                <option value="Impact">Impact</option>
                                            </select>
                                            <select
                                                style={{ border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.75rem', padding: '0.25rem' }}
                                                onChange={(e) => execCommand('fontSize', e.target.value)}
                                                defaultValue="3"
                                                title="Font Size"
                                            >
                                                <option value="1">8px</option>
                                                <option value="2">10px</option>
                                                <option value="3">12px</option>
                                                <option value="4">14px</option>
                                                <option value="5">18px</option>
                                                <option value="6">24px</option>
                                                <option value="7">36px</option>
                                            </select>
                                            <select
                                                style={{ border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.75rem', padding: '0.25rem' }}
                                                onChange={(e) => {
                                                    if (cursorNodeRef.current && cursorNodeRef.current !== editorRef.current) {
                                                        cursorNodeRef.current.style.lineHeight = e.target.value;
                                                        handleWysiwygChange();
                                                    }
                                                }}
                                                defaultValue=""
                                                title="Line Spacing"
                                            >
                                                <option value="" disabled>Spacing</option>
                                                <option value="1">1.0</option>
                                                <option value="1.15">1.15</option>
                                                <option value="1.5">1.5</option>
                                                <option value="2">2.0</option>
                                                <option value="2.5">2.5</option>
                                            </select>
                                            <button style={styles.formatBtn} onClick={() => execCommand('formatBlock', 'H1')} title="Heading 1">
                                                <Heading1 size={16} />
                                            </button>
                                            <button style={styles.formatBtn} onClick={() => execCommand('formatBlock', 'H2')} title="Heading 2">
                                                <Heading2 size={16} />
                                            </button>
                                            <div style={styles.divider}></div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '28px', height: '28px' }}>
                                                    <Baseline size={16} style={{ position: 'absolute', left: '6px', pointerEvents: 'none' }} />
                                                    <input
                                                        type="color"
                                                        style={{ width: '100%', height: '100%', opacity: 0, position: 'absolute', cursor: 'pointer' }}
                                                        onChange={(e) => execCommand('foreColor', e.target.value)}
                                                        title="Text Color"
                                                    />
                                                    <div style={{ width: '14px', height: '2px', backgroundColor: 'black', position: 'absolute', bottom: '4px', left: '7px' }}></div>
                                                </div>
                                                {/* Template Background Color (formerly Primary Color) */}
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '28px', height: '28px' }}>
                                                    <Highlighter size={16} style={{ position: 'absolute', left: '6px', pointerEvents: 'none' }} />
                                                    <input
                                                        type="color"
                                                        value={formData.primary_color}
                                                        onChange={(e) => {
                                                            const newColor = e.target.value;
                                                            const updatedData = { ...formData, primary_color: newColor };
                                                            setFormData(updatedData);
                                                            pushToHistory(updatedData);
                                                        }}
                                                        style={{ width: '100%', height: '100%', opacity: 0, position: 'absolute', cursor: 'pointer' }}
                                                        title="Template Background Color"
                                                    />
                                                    <div style={{ width: '14px', height: '2px', backgroundColor: formData.primary_color, position: 'absolute', bottom: '4px', left: '7px', border: '1px solid #d1d5db' }}></div>
                                                </div>
                                                {/* Table Header Color */}
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '28px', height: '28px' }} title="Table Header Color">
                                                    <span style={{ position: 'absolute', left: '5px', pointerEvents: 'none', fontSize: '10px', fontWeight: 700, color: '#374151' }}>TH</span>
                                                    <input
                                                        type="color"
                                                        value={formData.table_header_color}
                                                        onChange={(e) => {
                                                            const updatedData = { ...formData, table_header_color: e.target.value };
                                                            setFormData(updatedData);
                                                            pushToHistory(updatedData);
                                                        }}
                                                        style={{ width: '100%', height: '100%', opacity: 0, position: 'absolute', cursor: 'pointer' }}
                                                    />
                                                    <div style={{ width: '14px', height: '2px', backgroundColor: formData.table_header_color, position: 'absolute', bottom: '4px', left: '7px', border: '1px solid #d1d5db' }}></div>
                                                </div>
                                                {/* Table Total Color */}
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '28px', height: '28px' }} title="Total Row Color">
                                                    <span style={{ position: 'absolute', left: '5px', pointerEvents: 'none', fontSize: '10px', fontWeight: 700, color: '#374151' }}>TT</span>
                                                    <input
                                                        type="color"
                                                        value={formData.table_total_color}
                                                        onChange={(e) => {
                                                            const updatedData = { ...formData, table_total_color: e.target.value };
                                                            setFormData(updatedData);
                                                            pushToHistory(updatedData);
                                                        }}
                                                        style={{ width: '100%', height: '100%', opacity: 0, position: 'absolute', cursor: 'pointer' }}
                                                    />
                                                    <div style={{ width: '14px', height: '2px', backgroundColor: formData.table_total_color, position: 'absolute', bottom: '4px', left: '7px', border: '1px solid #d1d5db' }}></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Ruler Overlay */}
                                        {showRuler && (
                                            <div style={{ backgroundColor: '#f1f5f9', border: '1px solid #d1d5db', borderTop: 'none', borderBottom: 'none', padding: '4px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', minWidth: '40px' }}>INDENT</span>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="300"
                                                    step="5"
                                                    value={textIndent}
                                                    onChange={handleIndentChange}
                                                    style={{ flex: 1, cursor: 'pointer', height: '4px', accentColor: '#2563eb' }}
                                                    title="Adjust Text Indentation"
                                                />
                                                <span style={{ fontSize: '10px', color: '#64748b', minWidth: '35px', textAlign: 'right' }}>{textIndent}px</span>
                                            </div>
                                        )}

                                        {/* Editable Content */}
                                        <div style={{ position: 'relative' }}>
                                            <div
                                                ref={editorRef}
                                                contentEditable
                                                className="gt-wysiwyg-editor"
                                                style={{
                                                    ...styles.wysiwygEditor,
                                                    padding: (activeTab === 'footer' || activeTab === 'items') ? '0.5rem 1rem' : '1.5rem',
                                                    minHeight: (activeTab === 'footer' || activeTab === 'items') ? '120px' : '250px',
                                                    '--primary-color': formData.primary_color,
                                                    '--secondary-color': formData.secondary_color,
                                                    fontFamily: formData.font_family
                                                }}
                                                onInput={handleWysiwygChange}
                                                onKeyDown={handleEditorKeyDown}
                                                onClick={handleEditorClick}
                                                suppressContentEditableWarning={true}
                                            />
                                            {elementRect && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: elementRect.top,
                                                    left: elementRect.left,
                                                    width: elementRect.width,
                                                    height: elementRect.height,
                                                    border: '2px solid #2563eb',
                                                    pointerEvents: 'none',
                                                    boxSizing: 'border-box'
                                                }}>
                                                    {elementSettings.positionMode === 'overlay' && (
                                                        <div
                                                            onMouseDown={startDrag}
                                                            style={{
                                                                position: 'absolute',
                                                                top: '-24px',
                                                                left: '50%',
                                                                transform: 'translateX(-50%)',
                                                                backgroundColor: '#2563eb',
                                                                color: 'white',
                                                                padding: '2px 8px',
                                                                borderRadius: '4px',
                                                                cursor: 'grab',
                                                                pointerEvents: 'auto',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                fontSize: '0.65rem'
                                                            }}
                                                        >
                                                            <Move size={12} style={{ marginRight: '4px' }} /> Drag
                                                        </div>
                                                    )}
                                                    {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(handle => (
                                                        <div
                                                            key={handle}
                                                            onMouseDown={(e) => startResize(e, handle)}
                                                            style={{
                                                                position: 'absolute',
                                                                width: '10px',
                                                                height: '10px',
                                                                backgroundColor: 'white',
                                                                border: '2px solid #2563eb',
                                                                borderRadius: '50%',
                                                                cursor: `${handle.includes('top') ? (handle.includes('left') ? 'nw' : 'ne') : (handle.includes('left') ? 'sw' : 'se')}-resize`,
                                                                pointerEvents: 'auto',
                                                                ... (handle.includes('top') ? { top: '-6px' } : { bottom: '-6px' }),
                                                                ... (handle.includes('left') ? { left: '-6px' } : { right: '-6px' })
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <textarea
                                        style={styles.textarea}
                                        value={activeTab === 'header' ? formData.header_html : (activeTab === 'footer' ? formData.footer_html : formData.items_html)}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            [activeTab === 'header' ? 'header_html' : (activeTab === 'footer' ? 'footer_html' : 'items_html')]: e.target.value
                                        })}
                                        placeholder={`Enter ${activeTab} HTML with variables like {{customer.name}}`}
                                    />
                                )}
                            </div>
                        )}

                        {/* Preview Pane */}
                        {(viewOnly || displayMode === 'preview') && (
                            <div style={styles.previewPane}>
                                <div style={{
                                    ...styles.previewPaper,
                                    fontFamily: formData.font_family,
                                    '--primary-color': formData.primary_color,
                                    '--secondary-color': formData.secondary_color
                                }}>
                                    <div style={styles.previewLabel}>
                                        <Eye size={12} /> Live Preview
                                    </div>

                                    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
                                        {/* Header Preview */}
                                        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderPreviewHtml(formData.header_html)) }} />

                                        {/* Sample Invoice Body */}
                                        <div style={styles.placeholder}>
                                            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderPreviewHtml(formData.items_html)) }} />
                                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', textAlign: 'center', opacity: 0.6 }}>(Items generated dynamically on real invoice)</p>
                                        </div>

                                        {/* Footer Preview */}
                                        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderPreviewHtml(formData.footer_html)) }} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Unsaved Changes Confirmation Modal */}
            <Modal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                title="Unsaved Changes"
                footer={
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', padding: '1.25rem' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowConfirmModal(false)}
                        >
                            Continue Editing
                        </button>
                        <button
                            className="btn btn-danger"
                            onClick={() => {
                                setShowConfirmModal(false);
                                onClose();
                            }}
                        >
                            Discard Changes
                        </button>
                    </div>
                }
            >
                <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.25rem',
                        color: '#dc2626',
                        boxShadow: '0 8px 16px -4px rgba(220, 38, 38, 0.15)'
                    }}>
                        <AlertTriangle size={32} />
                    </div>
                    <h3 style={{
                        fontSize: '1.125rem',
                        fontWeight: '700',
                        color: '#0f172a',
                        marginBottom: '0.5rem',
                        fontFamily: 'Plus Jakarta Sans, sans-serif'
                    }}>
                        Discard unsaved changes?
                    </h3>
                    <p style={{
                        fontSize: '0.9375rem',
                        color: '#64748b',
                        lineHeight: '1.5',
                        maxWidth: '280px',
                        margin: '0 auto'
                    }}>
                        You have pending modifications. Are you sure you want to leave? Your changes will be lost forever.
                    </p>
                </div>
            </Modal>

            {/* Remove Image Confirmation Modal */}
            <Modal
                isOpen={isRemoveImageModalOpen}
                onClose={() => setIsRemoveImageModalOpen(false)}
                title="Remove Element"
                size="md"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setIsRemoveImageModalOpen(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn"
                            style={{ backgroundColor: '#dc2626', color: 'white' }}
                            onClick={() => {
                                if (selectedElement) {
                                    selectedElement.remove();
                                    setSelectedElement(null);
                                    const html = editorRef.current.innerHTML;
                                    const field = activeTab === 'header' ? 'header_html' : (activeTab === 'footer' ? 'footer_html' : 'items_html');

                                    const updatedData = { ...formData, [field]: html };
                                    setFormData(updatedData);
                                    pushToHistory(updatedData);
                                    lastContentRef.current[activeTab] = html;
                                }
                                setIsRemoveImageModalOpen(false);
                            }}
                        >
                            Remove
                        </button>
                    </div>
                }
            >
                <div>
                    <p>Are you sure you want to remove this element from the template?</p>
                </div>
            </Modal>

            {/* Clear All Confirmation Modal */}
            <Modal
                isOpen={isClearAllModalOpen}
                onClose={() => setIsClearAllModalOpen(false)}
                title="Clear All Content"
                size="md"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setIsClearAllModalOpen(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn"
                            style={{ backgroundColor: '#dc2626', color: 'white' }}
                            onClick={() => {
                                if (editorRef.current) {
                                    editorRef.current.innerHTML = '';
                                    handleWysiwygChange();
                                }
                                setIsClearAllModalOpen(false);
                            }}
                        >
                            Clear
                        </button>
                    </div>
                }
            >
                <div>
                    <p>Are you sure you want to clear all content in the current editor pane? This cannot be undone if you save the template.</p>
                </div>
            </Modal>
        </div >
    );
}

export default TemplateDesigner;
