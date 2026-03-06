import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Mail, Phone, Building2, User, MapPin, Globe } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import SearchableSelect from '../../components/common/SearchableSelect';
import { contactsApi, crmCustomersApi } from '../../services/crms_api';
import { countries } from '../../constants/countries';

function Contacts() {
    const [contacts, setContacts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [contactToDelete, setContactToDelete] = useState(null);

    const [customerFilter, setCustomerFilter] = useState('');
    const [formData, setFormData] = useState({
        customer_id: '', first_name: '', last_name: '', email: '', phone: '',
        location: '', country: '', title: '', department: ''
    });

    // Custom Autocomplete State for Company
    const [companySearch, setCompanySearch] = useState('');
    const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);

    useEffect(() => {
        if (editingContact) {
            const customerName = customers.find(c => c.id === editingContact.customer_id)?.name || editingContact.customer_id;
            setCompanySearch(customerName);
        } else {
            setCompanySearch('');
        }
    }, [editingContact, customers]);

    useEffect(() => { loadData(); }, [customerFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [contactsRes, customersRes] = await Promise.all([
                contactsApi.getAll(customerFilter ? { customer_id: customerFilter } : {}),
                crmCustomersApi.getAll()
            ]);
            setContacts(contactsRes.data);
            setCustomers(customersRes.data);
        } catch (error) {
            console.error('Error loading contacts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
        if (formData.phone && !phoneRegex.test(formData.phone)) {
            alert("Please enter a valid phone number (e.g., +1-555-010-9988 or 1234567890)");
            return;
        }

        try {
            if (editingContact) {
                await contactsApi.update(editingContact.id, formData);
            } else {
                await contactsApi.create(formData);
            }
            setShowModal(false);
            resetForm();
            loadData();
        } catch (error) {
            console.error('Error saving contact:', error);
        }
    };

    const handleEdit = (contact) => {
        setEditingContact(contact);
        setFormData({
            customer_id: contact.customer_id || '', first_name: contact.first_name || '',
            last_name: contact.last_name || '', email: contact.email || '',
            phone: contact.phone || '',
            location: contact.location || '', country: contact.country || '',
            title: contact.title || '', department: contact.department || ''
        });
        setShowModal(true);
    };

    const handleDelete = (id) => {
        setContactToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!contactToDelete) return;
        try {
            await contactsApi.delete(contactToDelete);
            loadData();
            setIsDeleteModalOpen(false);
            setContactToDelete(null);
        } catch (error) {
            console.error('Error deleting contact:', error);
        }
    };

    const resetForm = () => {
        setEditingContact(null);
        setCompanySearch('');
        setFormData({
            customer_id: '', first_name: '', last_name: '', email: '', phone: '',
            location: '', country: '', title: '', department: ''
        });
    };

    const getCustomerName = (id) => customers.find(c => c.id === id)?.name || id;

    // Search is handled by DataTable
    const filteredContacts = contacts;

    const columns = [
        { key: 'id', label: 'Contact ID' },
        {
            key: 'first_name',
            label: 'Name',
            render: (value, row) => (
                <div>
                    <div style={{ fontWeight: '600' }}>{value} {row.last_name}</div>
                    {row.title && <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{row.title}</div>}
                </div>
            )
        },
        { key: 'email', label: 'Email', render: (value) => value ? <span><Mail size={14} style={{ display: 'inline', marginRight: '4px' }} />{value}</span> : '-' },
        { key: 'phone', label: 'Phone', render: (value) => value ? <span><Phone size={14} style={{ display: 'inline', marginRight: '4px' }} />{value}</span> : '-' },
        {
            key: 'customer_id',
            label: 'Company',
            render: (value) => value ? <span><Building2 size={14} style={{ display: 'inline', marginRight: '4px' }} />{getCustomerName(value) || value}</span> : '-'
        },
        { key: 'location', label: 'Location', render: (value) => value ? <span><MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} />{value}</span> : '-' },
        { key: 'country', label: 'Country', render: (value) => value ? <span><Globe size={14} style={{ display: 'inline', marginRight: '4px' }} />{value}</span> : '-' },
        { key: 'title', label: 'Title' },
        { key: 'department', label: 'Department' },
        { key: 'created_on', label: 'Created On', render: (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '-' },

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
                <div><h1 className="page-title">Contacts</h1><p className="page-subtitle">Manage your business contacts</p></div>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}><Plus size={20} />Add Contact</button>
            </div>

            <div className="card">
                <DataTable
                    columns={columns}
                    data={filteredContacts}
                    emptyMessage="No contacts found"
                    extraHeaderContent={
                        <select
                            className="form-select"
                            value={customerFilter}
                            onChange={(e) => setCustomerFilter(e.target.value)}
                            style={{ width: '200px' }}
                        >
                            <option value="">All Companies</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    }
                />
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingContact ? 'Edit Contact' : 'Add Contact'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-group"><label className="form-label">First Name *</label><input type="text" className="form-input" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} required /></div>
                        <div className="form-group"><label className="form-label">Last Name *</label><input type="text" className="form-input" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} required /></div>
                        <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required /></div>
                        <div className="form-group"><label className="form-label">Phone *</label><input type="tel" className="form-input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required /></div>

                        <div className="form-group relative">
                            <label className="form-label">Company *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={companySearch}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCompanySearch(val);
                                    setFormData({ ...formData, customer_id: val }); // Default to text value
                                    setShowCompanySuggestions(true);
                                }}
                                onFocus={() => setShowCompanySuggestions(true)}
                                onBlur={() => setTimeout(() => setShowCompanySuggestions(false), 200)}
                                placeholder="Enter Company Name"
                                required
                            />
                            {showCompanySuggestions && companySearch && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                                    {customers
                                        .filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()))
                                        .map(c => (
                                            <div
                                                key={c.id}
                                                className="px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm text-gray-700"
                                                onClick={() => {
                                                    setCompanySearch(c.name);
                                                    setFormData({ ...formData, customer_id: c.id });
                                                    setShowCompanySuggestions(false);
                                                }}
                                            >
                                                {c.name}
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>

                        <div className="form-group"><label className="form-label">Location</label><input type="text" className="form-input" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} /></div>
                        <div className="form-group">
                            <label className="form-label">Country</label>
                            <select className="form-select" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })}>
                                <option value="">Select Country</option>
                                {countries.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group"><label className="form-label">Title *</label><input type="text" className="form-input" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required /></div>
                        <div className="form-group"><label className="form-label">Department *</label><input type="text" className="form-input" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} required /></div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{editingContact ? 'Update' : 'Create'}</button>
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
                    <p>Are you sure you want to delete this contact?</p>
                </div>
            </Modal>
        </div>
    );
}

export default Contacts;
