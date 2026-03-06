import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Phone, MapPin, Mail, Calendar, ExternalLink } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import { crmCustomersApi } from '../../services/crms_api';

const STATUSES = ['Active', 'Inactive', 'Prospect', 'Churned'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'SGD', 'AUD', 'CAD', 'CHF', 'JPY', 'CNY'];

const COUNTRIES = [
    'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria',
    'Bahrain', 'Bangladesh', 'Belgium', 'Brazil', 'Canada', 'Chile', 'China',
    'Colombia', 'Czech Republic', 'Denmark', 'Egypt', 'Finland', 'France',
    'Germany', 'Greece', 'Hong Kong', 'Hungary', 'India', 'Indonesia', 'Ireland',
    'Israel', 'Italy', 'Japan', 'Jordan', 'Kenya', 'Kuwait', 'Lebanon',
    'Malaysia', 'Mexico', 'Morocco', 'Netherlands', 'New Zealand', 'Nigeria',
    'Norway', 'Oman', 'Pakistan', 'Peru', 'Philippines', 'Poland', 'Portugal',
    'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Singapore', 'South Africa',
    'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Taiwan',
    'Thailand', 'Turkey', 'UAE', 'United Kingdom', 'United States', 'Vietnam'
];

function Customers() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [formData, setFormData] = useState({
        name: '', contact_person: '', email: '', phone: '',
        address: '', city: '', state: '', zip_code: '',
        country: '', currency: '', status: '', onboarding_date: '', mutual_nda: ''
    });

    useEffect(() => { loadCustomers(); }, []);

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const response = await crmCustomersApi.getAll();
            setCustomers(response.data);
        } catch (error) {
            console.error('Error loading customers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingCustomer) {
                await crmCustomersApi.update(editingCustomer.id, formData);
            } else {
                // For new customers, status and onboarding_date are auto-set by backend
                const createData = {
                    name: formData.name,
                    contact_person: formData.contact_person,
                    email: formData.email,
                    phone: formData.phone,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    zip_code: formData.zip_code,
                    country: formData.country,
                    currency: formData.currency,
                    mutual_nda: formData.mutual_nda
                };
                await crmCustomersApi.create(createData);
            }
            setShowModal(false);
            resetForm();
            loadCustomers();
        } catch (error) {
            console.error('Error saving customer:', error);
        }
    };

    const handleEdit = (customer) => {
        setEditingCustomer(customer);
        setFormData({
            name: customer.name || '',
            contact_person: customer.contact_person || '',
            email: customer.email || '',
            phone: customer.phone || '',
            address: customer.address || '',
            city: customer.city || '',
            state: customer.state || '',
            zip_code: customer.zip_code || '',
            country: customer.country || '',
            currency: customer.currency || '',
            status: customer.status || '',
            onboarding_date: customer.onboarding_date || '',
            mutual_nda: customer.mutual_nda || ''
        });
        setShowModal(true);
    };

    const handleDelete = (id) => {
        setCustomerToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!customerToDelete) return;
        try {
            await crmCustomersApi.delete(customerToDelete);
            loadCustomers();
            setIsDeleteModalOpen(false);
            setCustomerToDelete(null);
        } catch (error) {
            console.error('Error deleting customer:', error);
        }
    };

    const resetForm = () => {
        setEditingCustomer(null);
        setFormData({
            name: '', contact_person: '', email: '', phone: '',
            address: '', city: '', state: '', zip_code: '',
            country: '', currency: '', status: '', onboarding_date: '', mutual_nda: ''
        });
    };

    const getStatusBadge = (status) => {
        const statusStyles = {
            'Active': { background: 'var(--success-100)', color: 'var(--success-700)' },
            'Inactive': { background: 'var(--gray-100)', color: 'var(--gray-700)' },
            'Prospect': { background: 'var(--primary-100)', color: 'var(--primary-700)' },
            'Churned': { background: 'var(--error-100)', color: 'var(--error-700)' }
        };
        const style = statusStyles[status] || statusStyles['Inactive'];
        return (
            <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '500',
                ...style
            }}>
                {status || '-'}
            </span>
        );
    };

    // Apply status filter (search is handled by DataTable)
    const filteredCustomers = customers.filter(c => {
        return !statusFilter || c.status === statusFilter;
    });

    const columns = [
        {
            key: 'name',
            label: 'Customer',
            render: (value) => (
                <div style={{ fontWeight: '600', color: 'var(--gray-900)' }}>{value}</div>
            )
        },
        {
            key: 'contact_person',
            label: 'Contact Person',
            render: (value) => value ? (
                <span style={{ color: 'var(--gray-700)' }}>{value}</span>
            ) : '-'
        },
        {
            key: 'email',
            label: 'Contact',
            render: (value, row) => (
                <div style={{ fontSize: '0.875rem' }}>
                    {value && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--gray-700)' }}>
                            <Mail size={14} style={{ color: 'var(--gray-400)' }} />
                            <a href={`mailto:${value}`} style={{ color: 'var(--primary-600)', textDecoration: 'none' }}>{value}</a>
                        </div>
                    )}
                    {row.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--gray-600)', marginTop: '4px' }}>
                            <Phone size={14} style={{ color: 'var(--gray-400)' }} />
                            {row.phone}
                        </div>
                    )}
                    {!value && !row.phone && '-'}
                </div>
            )
        },
        {
            key: 'country',
            label: 'Location',
            render: (value, row) => value ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} style={{ color: 'var(--gray-400)' }} />
                    <span>{value}</span>
                    {row.currency && (
                        <span style={{
                            fontSize: '0.7rem',
                            background: 'var(--gray-100)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            color: 'var(--gray-600)'
                        }}>
                            {row.currency}
                        </span>
                    )}
                </div>
            ) : '-'
        },
        {
            key: 'status',
            label: 'Status',
            render: (value) => getStatusBadge(value)
        },
        {
            key: 'onboarding_date',
            label: 'Onboarded',
            render: (value) => {
                if (!value) return '-';
                // Extract just the date part (handles both 'YYYY-MM-DD' and 'dd-MMM-yyyy HH:MM:SS' formats)
                const dateOnly = value.split(' ')[0].split('T')[0];
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem' }}>
                        <Calendar size={14} style={{ color: 'var(--gray-400)' }} />
                        {dateOnly}
                    </div>
                );
            }
        },
        {
            key: 'mutual_nda',
            label: 'NDA',
            render: (value) => {
                if (!value) return <span style={{ color: 'var(--gray-400)' }}>-</span>;
                // Check if value is a URL
                const isUrl = value.startsWith('http://') || value.startsWith('https://') || value.startsWith('www.');
                if (isUrl) {
                    const url = value.startsWith('www.') ? `https://${value}` : value;
                    return (
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-icon btn-ghost"
                            title="Open NDA Document"
                            style={{ color: 'var(--primary-600)' }}
                        >
                            <ExternalLink size={16} />
                        </a>
                    );
                }
                // If it's just text like 'Yes', 'No', 'Pending'
                return (
                    <span style={{
                        color: value === 'Yes' ? 'var(--success-600)' : value === 'No' ? 'var(--error-600)' : 'var(--warning-600)',
                        fontSize: '0.875rem',
                        fontWeight: '500'
                    }}>
                        {value}
                    </span>
                );
            }
        },
        {
            key: 'actions',
            label: '',
            render: (_, row) => (
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button className="btn btn-icon btn-ghost" onClick={() => handleEdit(row)} title="Edit">
                        <Edit2 size={16} />
                    </button>
                    <button className="btn btn-icon btn-ghost text-error" onClick={() => handleDelete(row.id)} title="Delete">
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
                    <h1 className="page-title">Customers</h1>
                    <p className="page-subtitle">Manage your customer accounts</p>
                </div>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
                    <Plus size={20} />Add Customer
                </button>
            </div>

            <div className="card">
                <DataTable
                    columns={columns}
                    data={filteredCustomers}
                    emptyMessage="No customers found"
                    extraHeaderContent={
                        <select
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ width: '150px' }}
                        >
                            <option value="">All Status</option>
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    }
                />
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingCustomer ? 'Edit Customer' : 'Add Customer'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                        {/* Row 1: Customer Name, Contact Person */}
                        <div className="form-group">
                            <label className="form-label">Customer Name *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Contact Person *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.contact_person}
                                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                required
                            />
                        </div>

                        {/* Row 2: Email, Phone */}
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
                            <label className="form-label">Phone</label>
                            <input
                                type="tel"
                                className="form-input"
                                value={formData.phone}
                                onChange={(e) => {
                                    // Only allow numbers, spaces, hyphens, parentheses, and plus
                                    const value = e.target.value.replace(/[^0-9+\-\s()]/g, '');
                                    setFormData({ ...formData, phone: value });
                                }}
                                pattern="[0-9+\-\s()]{7,20}"
                                title="Phone number should only contain numbers, spaces, hyphens, parentheses, or plus sign"
                                placeholder="+1 (555) 123-4567"
                            />
                        </div>

                        {/* Row 3: Address (full width) */}
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Address *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Street address"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                required
                            />
                        </div>

                        {/* Row 4: City, State */}
                        <div className="form-group">
                            <label className="form-label">City *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">State/Province *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.state}
                                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                required
                            />
                        </div>

                        {/* Row 5: Zip, Country */}
                        <div className="form-group">
                            <label className="form-label">Zip/Postal Code *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.zip_code}
                                onChange={(e) => {
                                    // Only allow alphanumeric characters, spaces, and hyphens
                                    const value = e.target.value.replace(/[^a-zA-Z0-9\-\s]/g, '').toUpperCase();
                                    setFormData({ ...formData, zip_code: value });
                                }}
                                pattern="[A-Za-z0-9\-\s]{3,12}"
                                title="Zip/Postal code should only contain letters, numbers, spaces, or hyphens"
                                placeholder="e.g. 10001 or SW1A 1AA"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Country *</label>
                            <select
                                className="form-select"
                                value={formData.country}
                                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                required
                            >
                                <option value="">Select Country</option>
                                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Row 6: Currency, Status (only show status for edit) */}
                        <div className="form-group">
                            <label className="form-label">Currency *</label>
                            <select
                                className="form-select"
                                value={formData.currency}
                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                required
                            >
                                <option value="">Select Currency</option>
                                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {editingCustomer && (
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select
                                    className="form-select"
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="">Select Status</option>
                                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Mutual NDA - Google Drive Link */}
                        <div className="form-group" style={{ gridColumn: editingCustomer ? '1' : 'span 1' }}>
                            <label className="form-label">Mutual NDA (Google Drive Link)</label>
                            <input
                                type="url"
                                className="form-input"
                                placeholder="https://drive.google.com/..."
                                value={formData.mutual_nda}
                                onChange={(e) => setFormData({ ...formData, mutual_nda: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{editingCustomer ? 'Update' : 'Create'}</button>
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
                    <p>Are you sure you want to delete this customer?</p>
                </div>
            </Modal>
        </div>
    );
}

export default Customers;
