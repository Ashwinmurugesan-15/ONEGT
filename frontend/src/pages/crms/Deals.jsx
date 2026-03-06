import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { Plus, Edit2, Trash2, DollarSign, Calendar, Building2, User, ExternalLink } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import SearchableSelect from '../../components/common/SearchableSelect';
import { dealsApi, crmCustomersApi } from '../../services/crms_api';
import { associatesApi, currencyApi } from '../../services/api';

const STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];
const STAGE_COLORS = {
    'Prospecting': { bg: '#f3f4f6', color: '#374151' },
    'Qualification': { bg: '#dbeafe', color: '#1e40af' },
    'Proposal': { bg: '#fef3c7', color: '#92400e' },
    'Negotiation': { bg: '#e9d5ff', color: '#6b21a8' },
    'Closed Won': { bg: '#d1fae5', color: '#065f46' },
    'Closed Lost': { bg: '#fee2e2', color: '#991b1b' }
};

function Deals() {
    const [deals, setDeals] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [associates, setAssociates] = useState([]);
    const [currencies, setCurrencies] = useState(['USD']);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingDeal, setEditingDeal] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [dealToDelete, setDealToDelete] = useState(null);
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();

    const [stageFilter, setStageFilter] = useState('');
    const [formData, setFormData] = useState({
        customer_id: '', name: '', value: 0, currency: 'USD', stage: 'Prospecting',
        close_date: '', start_date: '', end_date: '', owner_id: '', notes: '',
        sow_number: '', sow: '', po_number: ''
    });

    useEffect(() => { loadData(); loadAssociates(); loadCurrencies(); }, [stageFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [dealsRes, customersRes] = await Promise.all([
                dealsApi.getAll(stageFilter ? { stage: stageFilter } : {}),
                crmCustomersApi.getAll()
            ]);
            setDeals(dealsRes.data);
            setCustomers(customersRes.data);
        } catch (error) {
            console.error('Error loading deals:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAssociates = async () => {
        try {
            const response = await associatesApi.getAll();
            setAssociates(response.data);
        } catch (error) {
            console.error('Error loading associates:', error);
        }
    };

    const loadCurrencies = async () => {
        try {
            const response = await currencyApi.getCurrencies();
            if (response.data && Array.isArray(response.data)) {
                setCurrencies(response.data);
            }
        } catch (error) {
            console.error('Error loading currencies:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingDeal) {
                await dealsApi.update(editingDeal.id, formData);
                showToast('Deal updated successfully', 'success');
            } else {
                await dealsApi.create(formData);
                showToast('Deal created successfully', 'success');
            }
            setShowModal(false);
            resetForm();
            loadData();
        } catch (error) {
            console.error('Error saving deal:', error);
            showToast('Error saving deal', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (deal) => {
        setEditingDeal(deal);
        setFormData({
            customer_id: deal.customer_id || '', name: deal.name || '',
            value: deal.value || 0, currency: deal.currency || 'USD',
            stage: deal.stage || 'Prospecting', close_date: deal.close_date || '',
            start_date: deal.start_date || '', end_date: deal.end_date || '',
            owner_id: deal.owner_id || '', notes: deal.notes || '',
            sow_number: deal.sow_number || '', sow: deal.sow || '',
            po_number: deal.po_number || ''
        });
        setShowModal(true);
    };

    const handleDelete = (id) => {
        setDealToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!dealToDelete) return;
        try {
            await dealsApi.delete(dealToDelete);
            loadData();
            setIsDeleteModalOpen(false);
            setDealToDelete(null);
        } catch (error) {
            console.error('Error deleting deal:', error);
            showToast('Error deleting deal', 'error');
        }
    };

    const resetForm = () => {
        setEditingDeal(null);
        setFormData({
            customer_id: '', name: '', value: 0, currency: 'USD', stage: 'Prospecting',
            close_date: '', start_date: '', end_date: '', owner_id: '', notes: '',
            sow_number: '', sow: '', po_number: ''
        });
    };

    const getCustomerName = (id) => customers.find(c => c.id === id)?.name || id;
    const getOwnerName = (id) => {
        const associate = associates.find(a => a.associate_id === id);
        return associate ? associate.associate_name : id;
    };

    // Search is handled by DataTable
    const filteredDeals = deals;

    const formatCurrencyValue = (value, currency) => {
        const num = parseFloat(value) || 0;
        const cur = currency || 'USD';
        const symbolMap = {
            'INR': '₹', 'USD': '$', 'EUR': '€', 'GBP': '£',
            'AUD': 'A$', 'CAD': 'C$', 'SGD': 'S$', 'AED': 'AED ',
            'JPY': '¥', 'CNY': '¥', 'NZD': 'NZ$', 'HKD': 'HK$',
            'CHF': 'CHF ', 'MYR': 'RM ', 'THB': '฿', 'PHP': '₱'
        };
        const localeMap = {
            'INR': 'en-IN', 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB',
            'AUD': 'en-AU', 'CAD': 'en-CA', 'SGD': 'en-SG', 'AED': 'en-AE',
            'JPY': 'ja-JP', 'CNY': 'zh-CN'
        };
        const symbol = symbolMap[cur] || cur + ' ';
        const locale = localeMap[cur] || 'en-US';
        const formatted = new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
        return `${symbol}${formatted}`;
    };

    const columns = [
        { key: 'id', label: 'Deal ID' },
        {
            key: 'name',
            label: 'Deal Name',
            render: (value) => <div style={{ fontWeight: '600' }}>{value}</div>
        },
        {
            key: 'customer_id',
            label: 'Customer',
            render: (value) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building2 size={14} className="text-gray-500" />
                    <span>{getCustomerName(value)}</span>
                </div>
            )
        },
        {
            key: 'value',
            label: 'Value',
            render: (value, row) => <span style={{ fontWeight: '600', color: 'var(--success-600)', fontFamily: 'monospace' }}>{formatCurrencyValue(value, row.currency)}</span>
        },
        {
            key: 'stage',
            label: 'Stage',
            render: (value) => {
                const colors = STAGE_COLORS[value] || STAGE_COLORS['Prospecting'];
                return <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '500', backgroundColor: colors.bg, color: colors.color }}>{value}</span>;
            }
        },
        { key: 'close_date', label: 'Close Date', render: (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '-' },
        { key: 'start_date', label: 'Start Date', render: (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '-' },
        { key: 'end_date', label: 'End Date', render: (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '-' },
        { key: 'owner_id', label: 'Owner', render: (value) => getOwnerName(value) },
        {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-icon btn-ghost" onClick={() => handleEdit(row)}><Edit2 size={16} /></button>
                    <button className="btn btn-icon btn-ghost text-error" onClick={() => handleDelete(row.id)}><Trash2 size={16} /></button>
                </div>
            )
        }
    ];

    // Add SOW columns if needed, or just SOW Link
    columns.splice(columns.length - 2, 0, {
        key: 'sow_number',
        label: 'SOW #',
        render: (value, row) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{value || '-'}</span>
                {row.sow && (
                    <a
                        href={row.sow}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary-dark transition-colors"
                        title="Open SOW"
                    >
                        <ExternalLink size={14} />
                    </a>
                )}
            </div>
        )
    }, {
        key: 'po_number',
        label: 'PO #',
        render: (value) => value || '-'
    });

    if (loading) return <Loading />;

    return (
        <div>
            <div className="page-header">
                <div><h1 className="page-title">Deals</h1><p className="page-subtitle">Track your sales deals</p></div>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}><Plus size={20} />Add Deal</button>
            </div>

            <div className="card">
                <DataTable
                    columns={columns}
                    data={filteredDeals}
                    emptyMessage="No deals found"
                    extraHeaderContent={
                        <select
                            className="form-select"
                            value={stageFilter}
                            onChange={(e) => setStageFilter(e.target.value)}
                            style={{ width: '160px' }}
                        >
                            <option value="">All Stages</option>
                            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    }
                />
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingDeal ? 'Edit Deal' : 'Add Deal'}
                footer={
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button
                            type="submit"
                            form="deal-form"
                            className="btn btn-primary"
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : (editingDeal ? 'Update' : 'Create')}
                        </button>
                    </div>
                }
            >
                <form id="deal-form" onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Deal Name *</label>
                            <input type="text" className="form-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Value</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <select
                                    className="form-select"
                                    style={{ width: '100px' }}
                                    value={formData.currency}
                                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                >
                                    {currencies.map(curr => <option key={curr} value={curr}>{curr}</option>)}
                                </select>
                                <input
                                    type="text"
                                    className="form-input"
                                    style={{ flex: 1 }}
                                    value={formData.value}
                                    onChange={(e) => {
                                        const rawValue = e.target.value.replace(/,/g, '');
                                        setFormData({ ...formData, value: rawValue === '' ? '' : (parseFloat(rawValue) || 0) });
                                    }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Customer</label>
                            <SearchableSelect
                                options={customers.map(c => ({ value: c.id, label: c.name }))}
                                value={formData.customer_id}
                                onChange={(value) => setFormData({ ...formData, customer_id: value })}
                                placeholder="Select Customer"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Stage</label>
                            <select className="form-select" value={formData.stage} onChange={(e) => setFormData({ ...formData, stage: e.target.value })}>
                                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Close Date</label>
                            <input type="date" className="form-input" value={formData.close_date} onChange={(e) => setFormData({ ...formData, close_date: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Start Date</label>
                            <input type="date" className="form-input" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">End Date</label>
                            <input type="date" className="form-input" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Owner</label>
                            <SearchableSelect
                                options={associates.filter(a => a.status?.toLowerCase() === 'active').map(a => ({ value: a.associate_id, label: `${a.associate_id} - ${a.associate_name}` }))}
                                value={formData.owner_id}
                                onChange={(value) => setFormData({ ...formData, owner_id: value })}
                                placeholder="Select Owner"
                            />
                        </div>

                        <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Notes</label><textarea className="form-input" rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>

                        <div className="form-group">
                            <label className="form-label">SOW Number</label>
                            <input type="text" className="form-input" value={formData.sow_number} onChange={(e) => setFormData({ ...formData, sow_number: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">SOW Link (URL)</label>
                            <input type="text" className="form-input" placeholder="https://..." value={formData.sow} onChange={(e) => setFormData({ ...formData, sow: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">PO Number</label>
                            <input type="text" className="form-input" value={formData.po_number} onChange={(e) => setFormData({ ...formData, po_number: e.target.value })} />
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Confirm Deletion"
                size="md"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setIsDeleteModalOpen(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn"
                            style={{ backgroundColor: '#dc2626', color: 'white' }}
                            onClick={confirmDelete}
                        >
                            Delete
                        </button>
                    </div>
                }
            >
                <div>
                    <p>Are you sure you want to delete this deal?</p>
                </div>
            </Modal>
        </div>
    );
}

export default Deals;
