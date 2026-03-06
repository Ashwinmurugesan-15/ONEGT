import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Phone, PhoneIncoming, PhoneOutgoing, Clock } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import { callsApi, contactsApi } from '../../services/crms_api';

const DIRECTIONS = ['Inbound', 'Outbound'];
const OUTCOMES = ['Connected', 'Voicemail', 'No Answer', 'Busy', 'Wrong Number', 'Callback Scheduled'];

function Calls() {
    const [calls, setCalls] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingCall, setEditingCall] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [callToDelete, setCallToDelete] = useState(null);

    const [directionFilter, setDirectionFilter] = useState('');
    const [formData, setFormData] = useState({
        contact_id: '', direction: 'Outbound', duration: 0, outcome: '', notes: '', call_date: ''
    });

    useEffect(() => { loadData(); }, [directionFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [callsRes, contactsRes] = await Promise.all([
                callsApi.getAll(directionFilter ? { direction: directionFilter } : {}),
                contactsApi.getAll()
            ]);
            setCalls(callsRes.data);
            setContacts(contactsRes.data);
        } catch (error) {
            console.error('Error loading calls:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.duration <= 0) {
            alert('Duration must be greater than 0 seconds');
            return;
        }

        try {
            if (editingCall) await callsApi.update(editingCall.id, formData);
            else await callsApi.create(formData);
            setShowModal(false);
            resetForm();
            loadData();
        } catch (error) {
            console.error('Error saving call:', error);
        }
    };

    const handleEdit = (call) => {
        setEditingCall(call);
        setFormData({
            contact_id: call.contact_id || '', direction: call.direction || 'Outbound',
            duration: call.duration || 0, outcome: call.outcome || '',
            notes: call.notes || '', call_date: call.call_date?.split(' ')[0] || ''
        });
        setShowModal(true);
    };

    const handleDelete = (id) => {
        setCallToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!callToDelete) return;
        try {
            await callsApi.delete(callToDelete);
            loadData();
            setIsDeleteModalOpen(false);
            setCallToDelete(null);
        } catch (error) {
            console.error('Error deleting call:', error);
            alert('Error deleting call');
        }
    };

    const resetForm = () => {
        setEditingCall(null);
        setFormData({ contact_id: '', direction: 'Outbound', duration: 0, outcome: '', notes: '', call_date: '' });
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    const getContactName = (id) => {
        const contact = contacts.find(c => c.id === id);
        return contact ? `${contact.first_name} ${contact.last_name || ''}`.trim() : id;
    };

    // Search is handled by DataTable
    const filteredCalls = calls;

    const columns = [
        {
            key: 'direction',
            label: 'Type',
            render: (value) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {value === 'Inbound' ?
                        <PhoneIncoming size={16} style={{ color: 'var(--success-500)' }} /> :
                        <PhoneOutgoing size={16} style={{ color: 'var(--primary-500)' }} />
                    }
                    {value}
                </span>
            )
        },
        {
            key: 'contact_id',
            label: 'Contact',
            render: (value) => value ? <span>{getContactName(value)}</span> : '-'
        },
        {
            key: 'outcome',
            label: 'Outcome',
            render: (value) => value ? (
                <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    backgroundColor: value === 'Connected' ? '#d1fae5' : '#f3f4f6',
                    color: value === 'Connected' ? '#065f46' : '#374151'
                }}>{value}</span>
            ) : '-'
        },
        {
            key: 'duration',
            label: 'Duration',
            render: (value) => <span><Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />{formatDuration(value)}</span>
        },
        { key: 'call_date', label: 'Date', render: (value) => value || '-' },
        {
            key: 'notes',
            label: 'Notes',
            render: (value) => value ? (
                <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{value}</span>
            ) : '-'
        },
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

    if (loading) return <Loading />;

    return (
        <div>
            <div className="page-header">
                <div><h1 className="page-title">Call Logs</h1><p className="page-subtitle">Track your sales calls</p></div>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}><Plus size={20} />Log Call</button>
            </div>

            <div className="card">
                <DataTable
                    columns={columns}
                    data={filteredCalls}
                    emptyMessage="No call logs found"
                    extraHeaderContent={
                        <select
                            className="form-select"
                            value={directionFilter}
                            onChange={(e) => setDirectionFilter(e.target.value)}
                            style={{ width: '140px' }}
                        >
                            <option value="">All Directions</option>
                            {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    }
                />
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingCall ? 'Edit Call Log' : 'Log Call'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-group"><label className="form-label">Contact *</label><select className="form-select" value={formData.contact_id} onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })} required><option value="">Select Contact</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></div>
                        <div className="form-group"><label className="form-label">Direction *</label><select className="form-select" value={formData.direction} onChange={(e) => setFormData({ ...formData, direction: e.target.value })} required>{DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                        <div className="form-group"><label className="form-label">Outcome *</label><select className="form-select" value={formData.outcome} onChange={(e) => setFormData({ ...formData, outcome: e.target.value })} required><option value="">Select Outcome</option>{OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                        <div className="form-group"><label className="form-label">Duration (seconds) *</label><input type="number" className="form-input" min="1" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })} required /></div>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Call Date *</label><input type="date" className="form-input" value={formData.call_date} onChange={(e) => setFormData({ ...formData, call_date: e.target.value })} required /></div>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Notes *</label><textarea className="form-input" rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} required /></div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{editingCall ? 'Update' : 'Log Call'}</button>
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
                    <p>Are you sure you want to delete this call log?</p>
                </div>
            </Modal>
        </div>
    );
}

export default Calls;
