import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { Plus, Filter, Edit2, Trash2, Phone, Mail, Building2 } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import SearchableSelect from '../../components/common/SearchableSelect';
import { leadsApi } from '../../services/crms_api';
import { associatesApi } from '../../services/api';

const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const LEAD_SOURCES = ['Website', 'Referral', 'Cold Call', 'LinkedIn', 'Advertisement', 'Trade Show', 'Other'];

const STATUS_COLORS = {
    'New': 'bg-blue-100 text-blue-800',
    'Contacted': 'bg-yellow-100 text-yellow-800',
    'Qualified': 'bg-purple-100 text-purple-800',
    'Proposal': 'bg-indigo-100 text-indigo-800',
    'Negotiation': 'bg-orange-100 text-orange-800',
    'Won': 'bg-green-100 text-green-800',
    'Lost': 'bg-red-100 text-red-800'
};

function Leads() {
    const [leads, setLeads] = useState([]);
    const { showToast } = useToast();
    const [associates, setAssociates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingLead, setEditingLead] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [leadToDelete, setLeadToDelete] = useState(null);

    const [statusFilter, setStatusFilter] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        source: '',
        lead_type: '',
        status: 'New',
        assigned_to: '',
        notes: ''
    });

    useEffect(() => {
        loadLeads();
        loadAssociates();
    }, [statusFilter]);

    const loadLeads = async () => {
        setLoading(true);
        try {
            const params = statusFilter ? { status: statusFilter } : {};
            const response = await leadsApi.getAll(params);
            setLeads(response.data);
        } catch (error) {
            console.error('Error loading leads:', error);
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.name || !formData.email || !formData.phone || !formData.company || !formData.source || !formData.assigned_to) {
            alert('Please fill in all mandatory fields.');
            return;
        }

        try {
            if (editingLead) {
                await leadsApi.update(editingLead.id, formData);
                showToast('Lead updated successfully', 'success');
            } else {
                // Ensure status is New for new leads
                await leadsApi.create({ ...formData, status: 'New' });
                showToast('Lead added successfully', 'success');
            }
            setShowModal(false);
            resetForm();
            loadLeads();
        } catch (error) {
            console.error('Error saving lead:', error);
            const errorMsg = error.response?.data?.detail || 'Failed to save lead';
            showToast(errorMsg, 'error');
        }
    };

    const handleEdit = (lead) => {
        setEditingLead(lead);
        setFormData({
            name: lead.name || '',
            email: lead.email || '',
            phone: lead.phone || '',
            company: lead.company || '',
            source: lead.source || '',
            lead_type: lead.lead_type || '',
            status: lead.status || 'New',
            assigned_to: lead.assigned_to || '',
            notes: lead.notes || ''
        });
        setShowModal(true);
    };

    const handleDelete = (id) => {
        setLeadToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!leadToDelete) return;
        try {
            await leadsApi.delete(leadToDelete);
            showToast('Lead deleted successfully', 'success');
            loadLeads();
            setIsDeleteModalOpen(false);
            setLeadToDelete(null);
        } catch (error) {
            console.error('Error deleting lead:', error);
            const errorMsg = error.response?.data?.detail || 'Failed to delete lead';
            showToast(errorMsg, 'error');
        }
    };

    const resetForm = () => {
        setEditingLead(null);
        setFormData({
            name: '',
            email: '',
            phone: '',
            company: '',
            source: '',
            lead_type: '',
            status: 'New',
            assigned_to: '',
            notes: ''
        });
    };

    const filteredLeads = leads.filter(lead =>
        !statusFilter || lead.status === statusFilter
    );

    const columns = [
        { key: 'id', label: 'Lead ID' },
        {
            key: 'name',
            label: 'Lead Name',
            render: (value, row) => (
                <div>
                    <div style={{ fontWeight: '600' }}>{value}</div>
                    {row.company && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                            <Building2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                            {row.company}
                        </div>
                    )}
                </div>
            )
        },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone Number' },
        { key: 'company', label: 'Company' },
        { key: 'source', label: 'Source' },
        { key: 'lead_type', label: 'Lead Type' },
        {
            key: 'status',
            label: 'Lead Status',
            render: (value) => (
                <span className={`badge ${STATUS_COLORS[value] || 'bg-gray-100 text-gray-800'}`}>
                    {value}
                </span>
            )
        },
        { key: 'assigned_to', label: 'Assigned To' },
        { key: 'created_on', label: 'Created On' },
        {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        className="btn btn-icon btn-ghost"
                        onClick={() => handleEdit(row)}
                        title="Edit"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        className="btn btn-icon btn-ghost text-error"
                        onClick={() => handleDelete(row.id)}
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ];

    if (loading) return <Loading />;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Leads</h1>
                    <p className="page-subtitle">Manage your sales leads</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => { resetForm(); setShowModal(true); }}
                >
                    <Plus size={20} />
                    Add Lead
                </button>
            </div>

            {/* Data Table */}
            <div className="card">
                <DataTable
                    columns={columns}
                    data={filteredLeads}
                    emptyMessage="No leads found"
                    extraHeaderContent={
                        <select
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ width: '150px' }}
                        >
                            <option value="">All Statuses</option>
                            {LEAD_STATUSES.map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    }
                />
            </div>

            {/* Add/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingLead ? 'Edit Lead' : 'Add Lead'}
            >
                <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">Name *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email *</label>
                            <input
                                type="email"
                                className="form-input"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Phone *</label>
                            <input
                                type="tel"
                                className="form-input"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Company *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.company}
                                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Source *</label>
                            <select
                                className="form-select"
                                value={formData.source}
                                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                required
                            >
                                <option value="">Select Source</option>
                                {LEAD_SOURCES.map(source => (
                                    <option key={source} value={source}>{source}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Lead Type</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.lead_type}
                                onChange={(e) => setFormData({ ...formData, lead_type: e.target.value })}
                                placeholder="e.g. Inbound"
                            />
                        </div>

                        {/* Status field - only show when editing */}
                        {editingLead && (
                            <div className="form-group">
                                <label className="form-label">Status *</label>
                                <select
                                    className="form-select"
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    required
                                >
                                    {LEAD_STATUSES.map(status => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Assigned To *</label>
                            <SearchableSelect
                                options={associates
                                    .filter(a => a.status?.toLowerCase() === 'active')
                                    .map(a => ({
                                        value: a.associate_id, // Use ID as value
                                        label: `${a.associate_id} - ${a.associate_name}`
                                    }))}
                                value={formData.assigned_to}
                                onChange={(value) => setFormData({ ...formData, assigned_to: value })}
                                placeholder="Select Associate"
                                required
                            />
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Notes</label>
                            <textarea
                                className="form-input"
                                rows={3}
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            {editingLead ? 'Update Lead' : 'Add Lead'}
                        </button>
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
                    <p>Are you sure you want to delete this lead?</p>
                </div>
            </Modal>
        </div>
    );
}

export default Leads;
