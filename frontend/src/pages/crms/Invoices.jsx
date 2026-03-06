import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, DollarSign, Calendar, Building2, User, FileText, CheckCircle, Clock, Palette, Eye, Download, Printer, Save, CreditCard, X } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import InvoiceEditor from './InvoiceEditor';
import TemplateDesigner from './TemplateDesigner';
import TemplateList from './TemplateList';
import { crmInvoicesApi, crmCustomersApi, dealsApi } from '../../services/crms_api';
import { formatDateToDdMmmYyyy } from '../../utils/dateUtils';
import { useToast } from '../../contexts/ToastContext';
import './Invoice.css'; // Will create this for custom styles
function Invoices() {
    const [view, setView] = useState('invoices'); // 'invoices', 'templates', 'designer'
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [templateViewOnly, setTemplateViewOnly] = useState(false);
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showEditor, setShowEditor] = useState(false);
    const [currentInvoice, setCurrentInvoice] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [viewOnly, setViewOnly] = useState(false);
    const [autoDownload, setAutoDownload] = useState(false);
    const [isSilent, setIsSilent] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [showEditorPreview, setShowEditorPreview] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentData, setPaymentData] = useState({
        invoice_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        amount: 0,
        currency: 'USD',
        invoice_number: ''
    });
    const [paymentSaving, setPaymentSaving] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkDeals, setBulkDeals] = useState([]);
    const [allActiveDeals, setAllActiveDeals] = useState([]);
    const [targetMonth, setTargetMonth] = useState('');
    const [bulkSaving, setBulkSaving] = useState(false);
    const [dealSearchTerm, setDealSearchTerm] = useState('');
    const [showDealDropdown, setShowDealDropdown] = useState(false);
    const [bulkValidationErrors, setBulkValidationErrors] = useState({ mon: false, deals: false });
    const editorRef = useRef(null);
    const dropdownRef = useRef(null);
    const { showToast } = useToast();

    useEffect(() => { loadData(); }, [statusFilter]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDealDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter) params.status = statusFilter;
            const [invoicesRes, customersRes] = await Promise.all([
                crmInvoicesApi.getAll(params),
                crmCustomersApi.getAll()
            ]);
            setInvoices(invoicesRes.data);
            setCustomers(customersRes.data);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const customerLookup = customers.reduce((acc, c) => {
        acc[c.id] = c.name;
        return acc;
    }, {});

    const formatCurrency = (amount, currency = 'USD') => {
        const CURRENCY_LOCALES = { USD: 'en-US', EUR: 'de-DE', INR: 'en-IN', GBP: 'en-GB' };
        try {
            const locale = CURRENCY_LOCALES[currency] || 'en-US';
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency || 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount || 0);
        } catch (e) {
            return `${currency || 'USD'} ${(amount || 0).toFixed(2)}`;
        }
    };

    const confirmDelete = (invoice) => {
        setInvoiceToDelete(invoice);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!invoiceToDelete) return;
        try {
            await crmInvoicesApi.delete(invoiceToDelete.id);
            showToast('Invoice deleted successfully', 'success');
            setShowDeleteModal(false);
            setInvoiceToDelete(null);
            loadData();
        } catch (error) {
            console.error('Error deleting invoice:', error);
            showToast('Failed to delete invoice', 'error');
        }
    };

    const handleView = (invoice) => {
        setCurrentInvoice(invoice);
        setViewOnly(true);
        setShowEditorPreview(true);
        setAutoDownload(false);
        setIsSilent(false);
        setShowEditor(true);
    };

    const handleEdit = (invoice) => {
        setCurrentInvoice(invoice);
        setViewOnly(false);
        setShowEditorPreview(false);
        setShowEditor(true);
    };

    const handleDownload = (invoice) => {
        setCurrentInvoice(invoice);
        setViewOnly(true);
        setAutoDownload(true);
        setIsSilent(true);
        setShowEditor(true);
        setShowEditorPreview(true);
    };

    const handleCreate = () => {
        setCurrentInvoice(null);
        setViewOnly(false);
        setShowEditorPreview(false);
        setShowEditor(true);
    };

    const handleCloseEditor = () => {
        const wasSilent = isSilent;
        setShowEditor(false);
        setCurrentInvoice(null);
        setAutoDownload(false);
        setIsSilent(false);
        setShowEditorPreview(false);
        if (!wasSilent) loadData();
    };

    const handleLogPayment = (invoice) => {
        const subtotal = invoice.items?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
        const total = subtotal + (invoice.tax_rate * subtotal / 100) - (invoice.discount || 0);
        setPaymentData({
            invoice_id: invoice.id,
            payment_date: new Date().toISOString().split('T')[0],
            amount: total,
            currency: invoice.currency || 'USD',
            invoice_number: invoice.invoice_number,
            credit_currency: invoice.currency || 'USD',
            credited_amount: total
        });
        setShowPaymentModal(true);
    };

    const handleLogPaymentSubmit = async () => {
        setPaymentSaving(true);
        try {
            await crmInvoicesApi.logPayment(paymentData.invoice_id, {
                payment_date: paymentData.payment_date,
                credit_currency: paymentData.credit_currency,
                credited_amount: paymentData.credited_amount !== '' ? parseFloat(paymentData.credited_amount) : null
            });
            showToast('Payment logged successfully', 'success');
            setShowPaymentModal(false);
            loadData();
        } catch (error) {
            console.error('Error logging payment:', error);
            showToast('Failed to log payment', 'error');
        } finally {
            setPaymentSaving(false);
        }
    };

    const loadActiveDeals = async () => {
        try {
            const res = await dealsApi.getAll();
            const now = new Date();
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(now.getDate() - 90);

            const nowStr = now.toISOString().split('T')[0];
            const ninetyAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

            // Fetch all invoices to calculate accurate balances
            const invRes = await crmInvoicesApi.getAll();
            const allInvoices = invRes.data || [];

            const active = (res.data || []).map(d => {
                const dealInvoices = allInvoices.filter(inv => inv.deal_id === d.id);
                const hasDraft = dealInvoices.some(inv => (inv.status || '').toLowerCase() === 'draft');
                const totalInvoiced = dealInvoices
                    .filter(inv => ['Paid', 'Sent', 'Overdue'].includes(inv.status))
                    .reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);

                return {
                    ...d,
                    balance: (parseFloat(d.value) || 0) - totalInvoiced,
                    hasDraft
                };
            }).filter(d => {
                const stageOk = !['Closed Lost', 'Cancelled'].includes(d.stage);
                if (!stageOk || d.hasDraft) return false;

                const endDate = d.end_date || '';
                if (!endDate) return d.balance > 0;

                return endDate >= ninetyAgoStr && d.balance > 0;
            });
            setAllActiveDeals(active);
        } catch (error) {
            console.error('Error loading deals:', error);
        }
    };

    const handleBulkGenerate = async () => {
        const errors = {
            mon: !targetMonth,
            deals: bulkDeals.length === 0
        };
        setBulkValidationErrors(errors);

        if (errors.mon || errors.deals) {
            const missing = [];
            if (errors.mon) missing.push('Invoice Month');
            if (errors.deals) missing.push('at least one Deal');
            showToast(`Missing information: ${missing.join(' and ')}`, 'error');
            return;
        }

        setBulkSaving(true);
        try {
            const res = await crmInvoicesApi.bulkGenerate({
                deal_ids: bulkDeals.map(d => d.id),
                month_year: targetMonth
            });

            if (res.data.success) {
                const genCount = res.data.generated?.length || 0;
                const warnCount = res.data.warnings?.length || 0;

                if (genCount > 0) {
                    showToast(`Successfully generated ${genCount} invoices`, 'success', 10000);
                } else if (warnCount === 0) {
                    showToast('No invoices were generated', 'info', 10000);
                }

                if (warnCount > 0) {
                    res.data.warnings.forEach(w => showToast(w, 'warning', 10000));
                }

                setShowBulkModal(false);
                setBulkDeals([]);
                setTargetMonth('');
                setStatusFilter('Draft');
                loadData();
            }
        } catch (error) {
            console.error('Bulk generate failed:', error);
            showToast('Bulk generation failed', 'error');
        } finally {
            setBulkSaving(false);
        }
    };

    const columns = [
        { key: 'invoice_number', label: 'Invoice #' },
        {
            key: 'customer_id',
            label: 'Customer',
            render: (val) => customerLookup[val] || val || '-'
        },
        {
            key: 'issue_date',
            label: 'Issue Date',
            render: (val) => formatDateToDdMmmYyyy(val)
        },
        {
            key: 'due_date',
            label: 'Due Date',
            render: (val) => formatDateToDdMmmYyyy(val)
        },
        {
            key: 'status',
            label: 'Status',
            render: (val) => {
                const normalizedStatus = (val || '').toLowerCase().replace(/\s+/g, '');
                const statusMap = {
                    'paid': 'badge-success',
                    'sent': 'badge-info',
                    'overdue': 'badge-error',
                    'draft': 'badge-warning',
                    'cancelled': 'badge-gray'
                };
                return <span className={`badge ${statusMap[normalizedStatus] || 'badge-gray'}`}>{val}</span>;
            }
        },
        {
            key: 'discount', // Using discount key slot to show total for now, or calculate total from items
            label: 'Amount',
            render: (_, row) => {
                const total = row.items?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
                const final = total + (row.tax_rate * total / 100) - row.discount;
                return <span className="font-mono font-medium">{formatCurrency(final, row.currency)}</span>
            }
        },
        {
            key: 'payment_date',
            label: 'Payment Date',
            render: (val) => val ? formatDateToDdMmmYyyy(val) : '-'
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-icon btn-ghost" title="View" onClick={() => handleView(row)}><Eye size={16} /></button>
                    <button className="btn btn-icon btn-ghost" title="Download" onClick={() => handleDownload(row)}><Download size={16} /></button>
                    {!['paid', 'sent'].includes((row.status || '').toLowerCase()) && (
                        <button className="btn btn-icon btn-ghost" title="Edit" onClick={() => handleEdit(row)}><Edit2 size={16} /></button>
                    )}
                    {(row.status || '').toLowerCase() === 'sent' && (
                        <button className="btn btn-icon btn-ghost" title="Log Payment" style={{ color: 'var(--success-600)' }} onClick={() => handleLogPayment(row)}><CreditCard size={16} /></button>
                    )}
                    {!['paid', 'sent'].includes((row.status || '').toLowerCase()) && (
                        <button className="btn btn-icon btn-ghost text-error" title="Delete" onClick={() => confirmDelete(row)}><Trash2 size={16} /></button>
                    )}
                </div>
            )
        }
    ];

    if (view === 'designer') {
        return (
            <TemplateDesigner
                template={editingTemplate}
                onClose={() => setView('templates')}
                viewOnly={templateViewOnly}
                onEdit={() => setTemplateViewOnly(false)}
            />
        );
    }

    if (view === 'templates') {
        return (
            <TemplateList
                onClose={() => setView('invoices')}
                onEdit={(tpl) => { setEditingTemplate(tpl); setTemplateViewOnly(false); setView('designer'); }}
                onView={(tpl) => { setEditingTemplate(tpl); setTemplateViewOnly(true); setView('designer'); }}
                onCreate={() => { setEditingTemplate(null); setTemplateViewOnly(false); setView('designer'); }}
            />
        );
    }

    if (loading) return <Loading />;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
                    <p className="text-gray-500">Manage invoices and billing</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-secondary" onClick={() => setView('templates')}>
                        <Palette size={18} className="mr-2" />
                        Templates
                    </button>
                    <button
                        className="btn btn-secondary"
                        style={{ color: 'var(--success-600)', borderColor: 'var(--success-300)' }}
                        onClick={() => {
                            setPaymentData({
                                invoice_id: '',
                                payment_date: new Date().toISOString().split('T')[0],
                                amount: 0,
                                currency: 'USD',
                                invoice_number: ''
                            });
                            setShowPaymentModal(true);
                        }}
                    >
                        <CreditCard size={18} className="mr-2" />
                        Log Payment
                    </button>
                    <button
                        className="btn btn-secondary"
                        style={{ color: 'var(--primary-600)', borderColor: 'var(--primary-200)' }}
                        onClick={() => {
                            loadActiveDeals();
                            setShowBulkModal(true);
                            if (!targetMonth) {
                                const now = new Date();
                                const label = now.toLocaleDateString('default', { month: 'short', year: 'numeric' }).replace(' ', '-');
                                setTargetMonth(label);
                            }
                        }}
                    >
                        <FileText size={18} className="mr-2" />
                        Generate Invoices
                    </button>
                    <button className="btn btn-primary" onClick={handleCreate}>
                        <Plus size={20} className="mr-2" />
                        New Invoice
                    </button>
                </div>
            </div>

            <div className="card">
                <DataTable
                    columns={columns}
                    data={invoices}
                    emptyMessage="No invoices found"
                    extraHeaderContent={
                        <select
                            className="form-select w-40"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            <option value="Draft">Draft</option>
                            <option value="Sent">Sent</option>
                            <option value="Paid">Paid</option>
                            <option value="Overdue">Overdue</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    }
                />
            </div>
            <Modal
                isOpen={showEditor}
                onClose={handleCloseEditor}
                title={viewOnly ? `View Invoice: ${currentInvoice?.invoice_number}` : (currentInvoice ? `Edit Invoice: ${currentInvoice.invoice_number}` : 'New Invoice')}
                size="xl"
                footer={
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {showEditorPreview ? (
                            <>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => window.print()}
                                >
                                    <Printer size={18} className="mr-2" />
                                    Print
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => editorRef.current?.download()}
                                >
                                    <Download size={18} className="mr-2" />
                                    Download PDF
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setViewOnly(false);
                                        setShowEditorPreview(false);
                                    }}
                                >
                                    <Edit2 size={18} className="mr-2" />
                                    Edit Invoice
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setViewOnly(true);
                                        setShowEditorPreview(true);
                                    }}
                                >
                                    <Eye size={18} className="mr-2" />
                                    Preview
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => editorRef.current?.save()}
                                >
                                    <Save size={18} className="mr-2" />
                                    Save Invoice
                                </button>
                            </>
                        )}
                    </div>
                }
            >
                <InvoiceEditor
                    ref={editorRef}
                    invoice={currentInvoice}
                    onClose={handleCloseEditor}
                    viewOnly={viewOnly}
                    showPreview={showEditorPreview}
                    downloadOnLoad={autoDownload}
                    isSilentDownload={isSilent}
                />
            </Modal>

            {/* Custom Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Confirm Deletion"
                size="md"
                footer={
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                        <button className="btn btn-primary" style={{ background: 'var(--error-600)', borderColor: 'var(--error-600)' }} onClick={handleDelete}>Delete Invoice</button>
                    </div>
                }
            >
                <div style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--error-50)', display: 'flex', alignItems: 'center', justifyLines: 'center', margin: '0 auto 1.5rem', justifyContent: 'center' }}>
                        <Trash2 size={32} style={{ color: 'var(--error-600)' }} />
                    </div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--gray-900)', marginBottom: '0.5rem' }}>Permanently delete this invoice?</h3>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                        This action cannot be undone. You are about to delete invoice <strong>{invoiceToDelete?.invoice_number}</strong>.
                    </p>
                </div>
            </Modal>

            {/* Log Payment Modal */}
            <Modal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                title="Log Payment"
                size="md"
                footer={
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                        <button
                            className="btn btn-primary"
                            onClick={handleLogPaymentSubmit}
                            disabled={paymentSaving}
                            style={{ background: 'var(--success-600)', borderColor: 'var(--success-600)' }}
                        >
                            <CreditCard size={18} className="mr-2" />
                            {paymentSaving ? 'Saving...' : 'Log Payment'}
                        </button>
                    </div>
                }
            >
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--success-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                            <CreditCard size={32} style={{ color: 'var(--success-600)' }} />
                        </div>
                    </div>
                    <div>
                        <label className="form-label">Invoice</label>
                        <select
                            className="form-select"
                            value={paymentData.invoice_id}
                            onChange={(e) => {
                                const inv = invoices.find(i => i.id === e.target.value);
                                if (inv) handleLogPayment(inv);
                            }}
                        >
                            <option value="">Select Invoice</option>
                            {invoices.filter(i => (i.status || '').toLowerCase() === 'sent').map(inv => (
                                <option key={inv.id} value={inv.id}>
                                    {inv.invoice_number} — {customerLookup[inv.customer_id] || inv.customer_id}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Amount</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formatCurrency(paymentData.amount, paymentData.currency)}
                            readOnly
                            style={{ background: 'var(--gray-50)', fontWeight: 600, fontSize: '1.1rem' }}
                        />
                    </div>
                    <div>
                        <label className="form-label">Payment Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={paymentData.payment_date}
                            onChange={(e) => setPaymentData(prev => ({ ...prev, payment_date: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="form-label">Credit Currency</label>
                        <select
                            className="form-select"
                            value={paymentData.credit_currency || 'USD'}
                            onChange={(e) => setPaymentData(prev => ({ ...prev, credit_currency: e.target.value }))}
                        >
                            <option value="USD">USD - US Dollar</option>
                            <option value="INR">INR - Indian Rupee</option>
                            <option value="EUR">EUR - Euro</option>
                            <option value="GBP">GBP - British Pound</option>
                            <option value="AUD">AUD - Australian Dollar</option>
                            <option value="SGD">SGD - Singapore Dollar</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Credited Amount</label>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="Amount received..."
                            className="form-input"
                            value={paymentData.credited_amount !== undefined ? paymentData.credited_amount : ''}
                            onChange={(e) => setPaymentData(prev => ({ ...prev, credited_amount: e.target.value }))}
                        />
                    </div>
                </div>
            </Modal>
            {/* Bulk Generate Modal */}
            <Modal
                isOpen={showBulkModal}
                onClose={() => {
                    setShowBulkModal(false);
                    setBulkValidationErrors({ mon: false, deals: false });
                    setBulkDeals([]);
                    setDealSearchTerm('');
                    // Reset targetMonth to current month (default)
                    const now = new Date();
                    const label = now.toLocaleDateString('default', { month: 'short', year: 'numeric' }).replace(' ', '-');
                    setTargetMonth(label);
                }}
                title="Bulk Generate Invoices"
                size="md"
                footer={
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>Cancel</button>
                        <button
                            className="btn btn-primary"
                            onClick={handleBulkGenerate}
                            disabled={bulkSaving}
                        >
                            {bulkSaving ? 'Generating...' : `Generate ${bulkDeals.length} Invoices`}
                        </button>
                    </div>
                }
            >
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block', fontWeight: 600 }}>Invoice Month</label>
                        <div style={{ position: 'relative' }}>
                            <Calendar size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: bulkValidationErrors.mon ? 'var(--error-500)' : 'var(--gray-400)' }} />
                            <input
                                type="month"
                                className="form-input"
                                style={{
                                    paddingLeft: '2.5rem',
                                    borderColor: bulkValidationErrors.mon ? 'var(--error-500)' : undefined,
                                    backgroundColor: bulkValidationErrors.mon ? 'var(--error-50)' : undefined
                                }}
                                value={targetMonth ? (() => {
                                    // Convert Mon-YYYY back to YYYY-MM for the input
                                    const [mon, year] = targetMonth.split('-');
                                    const months = { 'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12' };
                                    return `${year}-${months[mon]}`;
                                })() : ''}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        const date = new Date(e.target.value + '-01');
                                        const label = date.toLocaleDateString('default', { month: 'short', year: 'numeric' }).replace(' ', '-');
                                        setTargetMonth(label);
                                        setBulkValidationErrors(prev => ({ ...prev, mon: false }));
                                    }
                                }}
                            />
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>Selected: <strong>{targetMonth}</strong></p>
                    </div>

                    <div>
                        <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block', fontWeight: 600 }}>Select Deals</label>
                        <div style={{ position: 'relative' }} ref={dropdownRef}>
                            <div style={{ position: 'relative' }}>
                                <Building2 size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: bulkValidationErrors.deals ? 'var(--error-500)' : 'var(--gray-400)' }} />
                                <input
                                    type="text"
                                    className="form-input"
                                    style={{
                                        paddingLeft: '2.5rem',
                                        borderColor: bulkValidationErrors.deals ? 'var(--error-500)' : undefined,
                                        backgroundColor: bulkValidationErrors.deals ? 'var(--error-50)' : undefined
                                    }}
                                    placeholder="Search deals or customers..."
                                    value={dealSearchTerm}
                                    onChange={(e) => {
                                        setDealSearchTerm(e.target.value);
                                        setShowDealDropdown(true);
                                    }}
                                    onFocus={() => setShowDealDropdown(true)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            setShowDealDropdown(false);
                                        }
                                    }}
                                />
                            </div>

                            {showDealDropdown && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    border: '1px solid var(--gray-200)',
                                    borderRadius: '8px',
                                    boxShadow: 'var(--shadow-lg)',
                                    zIndex: 10,
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    marginTop: '4px'
                                }}>
                                    {allActiveDeals
                                        .filter(d => !bulkDeals.find(bd => bd.id === d.id))
                                        .filter(d => {
                                            const search = dealSearchTerm.toLowerCase();
                                            const customerName = (customerLookup[d.customer_id] || '').toLowerCase();
                                            return d.name.toLowerCase().includes(search) || customerName.includes(search);
                                        })
                                        .map(d => (
                                            <div
                                                key={d.id}
                                                style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--gray-50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                className="hover-bg-gray-50"
                                                onClick={() => {
                                                    setBulkDeals([...bulkDeals, d]);
                                                    setDealSearchTerm('');
                                                    setShowDealDropdown(false);
                                                    setBulkValidationErrors(prev => ({ ...prev, deals: false }));
                                                }}
                                            >
                                                <div style={{ overflow: 'hidden', flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{d.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{customerLookup[d.customer_id] || d.customer_id}</div>
                                                </div>
                                                <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Balance</div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: d.balance > 0 ? 'var(--primary-600)' : 'var(--error-600)' }}>
                                                        {d.currency} {d.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    }
                                    {allActiveDeals
                                        .filter(d => !bulkDeals.find(bd => bd.id === d.id))
                                        .filter(d => {
                                            const search = dealSearchTerm.toLowerCase();
                                            const customerName = (customerLookup[d.customer_id] || '').toLowerCase();
                                            return d.name.toLowerCase().includes(search) || customerName.includes(search);
                                        }).length === 0 && (
                                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.875rem' }}>
                                                No matches found
                                            </div>
                                        )
                                    }
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Added Deals ({bulkDeals.length})
                        </label>
                        {bulkDeals.length === 0 ? (
                            <div style={{ padding: '1rem', border: '1px dashed var(--gray-200)', borderRadius: '8px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.875rem' }}>
                                No deals selected yet
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', padding: '2px' }}>
                                {bulkDeals.map(deal => (
                                    <div key={deal.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                                        <div style={{ overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{deal.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{customerLookup[deal.customer_id]}</div>
                                        </div>
                                        <button
                                            className="btn btn-icon btn-ghost btn-sm"
                                            style={{ color: 'var(--gray-400)' }}
                                            onClick={() => setBulkDeals(bulkDeals.filter(d => d.id !== deal.id))}
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default Invoices;
