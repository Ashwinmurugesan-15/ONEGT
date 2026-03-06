import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, DollarSign, Calendar, User, Briefcase } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import SearchableSelect from '../../components/common/SearchableSelect';
import { opportunitiesApi, leadsApi } from '../../services/crms_api';
import { associatesApi, currencyApi } from '../../services/api';

const STAGES = ['Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

const STAGE_COLORS = {
    'Qualification': { bg: '#dbeafe', color: '#1e40af' },
    'Proposal': { bg: '#fef3c7', color: '#92400e' },
    'Negotiation': { bg: '#e9d5ff', color: '#6b21a8' },
    'Closed Won': { bg: '#d1fae5', color: '#065f46' },
    'Closed Lost': { bg: '#fee2e2', color: '#991b1b' }
};

function Opportunities() {
    const [opportunities, setOpportunities] = useState([]);
    const [leads, setLeads] = useState([]);
    const [associates, setAssociates] = useState([]);
    const [currencies, setCurrencies] = useState(['USD', 'INR', 'SGD']); // Default fallback
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingOpp, setEditingOpp] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [oppToDelete, setOppToDelete] = useState(null);

    const [stageFilter, setStageFilter] = useState('');
    const [formData, setFormData] = useState({
        lead_id: '',
        name: '',
        value: 0,
        currency: 'USD',
        stage: 'Qualification',
        probability: 20,
        expected_close: '',
        assigned_to: '',
        notes: ''
    });

    useEffect(() => {
        loadData();
        loadAssociates();
        loadCurrencies();
    }, [stageFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [oppsRes, leadsRes] = await Promise.all([
                opportunitiesApi.getAll(stageFilter ? { stage: stageFilter } : {}),
                leadsApi.getAll()
            ]);
            setOpportunities(oppsRes.data);
            setLeads(leadsRes.data);
        } catch (error) {
            console.error('Error loading opportunities:', error);
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

        // Validation
        if (!formData.name || !formData.lead_id || !formData.assigned_to) {
            alert('Please fill in Name, Lead, and Assigned To.');
            return;
        }

        try {
            if (editingOpp) {
                await opportunitiesApi.update(editingOpp.id, formData);
            } else {
                await opportunitiesApi.create(formData);
            }
            setShowModal(false);
            resetForm();
            loadData();
        } catch (error) {
            console.error('Error saving opportunity:', error);
        }
    };

    const handleEdit = (opp) => {
        setEditingOpp(opp);
        setFormData({
            lead_id: opp.lead_id || '',
            name: opp.name || '',
            value: opp.value || 0,
            currency: opp.currency || 'USD',
            stage: opp.stage || 'Qualification',
            probability: opp.probability || 20,
            expected_close: opp.expected_close || '',
            assigned_to: opp.assigned_to || '',
            notes: opp.notes || ''
        });
        setShowModal(true);
    };

    const handleDelete = (id) => {
        setOppToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!oppToDelete) return;
        try {
            await opportunitiesApi.delete(oppToDelete);
            loadData();
            setIsDeleteModalOpen(false);
            setOppToDelete(null);
        } catch (error) {
            console.error('Error deleting opportunity:', error);
        }
    };

    const resetForm = () => {
        setEditingOpp(null);
        setFormData({
            lead_id: '',
            name: '',
            value: 0,
            currency: 'USD',
            stage: 'Qualification',
            probability: 20,
            expected_close: '',
            assigned_to: '',
            notes: ''
        });
    };

    const filteredOpps = opportunities; // Already filtered by backend if stageFilter set, or can filter here if preferred

    const columns = [
        { key: 'id', label: 'Opportunity ID' },
        {
            key: 'name',
            label: 'Opportunity Name',
            render: (value) => <strong>{value}</strong>
        },
        {
            key: 'value',
            label: 'Value',
            render: (value, row) => (
                <span style={{ fontFamily: 'monospace' }}>
                    {row.currency || 'USD'} {parseFloat(value).toLocaleString()}
                </span>
            )
        },
        {
            key: 'stage',
            label: 'Stage',
            render: (value) => {
                const style = STAGE_COLORS[value] || { bg: '#f3f4f6', color: '#374151' };
                return (
                    <span className="badge" style={{ backgroundColor: style.bg, color: style.color }}>
                        {value}
                    </span>
                );
            }
        },
        { key: 'probability', label: 'Probability (%)' },
        { key: 'expected_close', label: 'Expected Close Date' },
        {
            key: 'assigned_to',
            label: 'Assigned To',
            render: (value) => {
                const associate = associates.find(a => a.associate_id === value);
                return associate ? associate.associate_name : value;
            }
        },
        { key: 'lead_id', label: 'Lead Id' },
        {
            key: 'created_on',
            label: 'Created On',
            render: (value) => new Date(value).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }).replace(/ /g, '-')
        },
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
                    <h1 className="page-title">Opportunities</h1>
                    <p className="page-subtitle">Track and manage sales opportunities</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => { resetForm(); setShowModal(true); }}
                >
                    <Plus size={20} />
                    Add Opportunity
                </button>
            </div>

            <div className="card">
                <DataTable
                    columns={columns}
                    data={filteredOpps}
                    emptyMessage="No opportunities found"
                    extraHeaderContent={
                        <select
                            className="form-select"
                            value={stageFilter}
                            onChange={(e) => setStageFilter(e.target.value)}
                            style={{ width: '150px' }}
                        >
                            <option value="">All Stages</option>
                            {STAGES.map(stage => (
                                <option key={stage} value={stage}>{stage}</option>
                            ))}
                        </select>
                    }
                />
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingOpp ? 'Edit Opportunity' : 'Add Opportunity'}
            >
                <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Opportunity Name *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        {/* Lead Selection - Using SearchableSelect for Leads too could be good, but simple select for now or SearchableSelect if user wants */}
                        <div className="form-group">
                            <label className="form-label">Lead *</label>
                            <SearchableSelect
                                options={leads.map(lead => ({
                                    value: lead.id,
                                    label: `${lead.name} (${lead.company || 'No Company'})`
                                }))}
                                value={formData.lead_id}
                                onChange={(value) => setFormData({ ...formData, lead_id: value })}
                                placeholder="Select Lead"
                                required
                            />
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
                                    {currencies.map(curr => (
                                        <option key={curr} value={curr}>{curr}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    className="form-input"
                                    style={{ flex: 1 }}
                                    value={formData.value}
                                    onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Stage</label>
                            <select
                                className="form-select"
                                value={formData.stage}
                                onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                            >
                                {STAGES.map(stage => (
                                    <option key={stage} value={stage}>{stage}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Probability (%)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={formData.probability}
                                onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })}
                                min="0"
                                max="100"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Expected Close Date</label>
                            <input
                                type="date"
                                className="form-input"
                                value={formData.expected_close}
                                onChange={(e) => setFormData({ ...formData, expected_close: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Assigned To *</label>
                            <SearchableSelect
                                options={associates
                                    .filter(a => a.status?.toLowerCase() === 'active')
                                    .map(a => ({
                                        value: a.associate_id,
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
                            {editingOpp ? 'Update Opportunity' : 'Create Opportunity'}
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
                    <p>Are you sure you want to delete this opportunity?</p>
                </div>
            </Modal>
        </div>
    );
}

export default Opportunities;
