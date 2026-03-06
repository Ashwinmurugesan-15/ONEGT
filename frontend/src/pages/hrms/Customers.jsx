import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, ExternalLink, Users, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import { customersApi } from '../../services/api';

// Country to Continent mapping
const countryToContinent = {
    // North America
    'USA': 'North America', 'United States': 'North America', 'Canada': 'North America', 'Mexico': 'North America',
    // Europe
    'UK': 'Europe', 'United Kingdom': 'Europe', 'Germany': 'Europe', 'France': 'Europe', 'Italy': 'Europe',
    'Spain': 'Europe', 'Netherlands': 'Europe', 'Belgium': 'Europe', 'Switzerland': 'Europe', 'Sweden': 'Europe',
    'Norway': 'Europe', 'Denmark': 'Europe', 'Finland': 'Europe', 'Ireland': 'Europe', 'Poland': 'Europe',
    // Asia
    'India': 'Asia', 'China': 'Asia', 'Japan': 'Asia', 'Singapore': 'Asia', 'South Korea': 'Asia',
    'Malaysia': 'Asia', 'Thailand': 'Asia', 'Indonesia': 'Asia', 'Vietnam': 'Asia', 'Philippines': 'Asia',
    'Taiwan': 'Asia', 'Hong Kong': 'Asia',
    // Middle East
    'UAE': 'Middle East', 'United Arab Emirates': 'Middle East', 'Saudi Arabia': 'Middle East',
    'Qatar': 'Middle East', 'Kuwait': 'Middle East', 'Bahrain': 'Middle East', 'Oman': 'Middle East',
    // Oceania
    'Australia': 'Oceania', 'New Zealand': 'Oceania',
    // South America
    'Brazil': 'South America', 'Argentina': 'South America', 'Chile': 'South America', 'Colombia': 'South America',
    // Africa
    'South Africa': 'Africa', 'Nigeria': 'Africa', 'Kenya': 'Africa', 'Egypt': 'Africa'
};

const getContinent = (country) => {
    if (!country) return 'Unknown';
    return countryToContinent[country] || 'Other';
};

function Customers() {
    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [saving, setSaving] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const { register, handleSubmit, reset } = useForm();

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        try {
            const response = await customersApi.getAll();
            setCustomers(response.data);
        } catch (error) {
            console.error('Error loading customers:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate stats
    const stats = useMemo(() => {
        const activeCount = customers.filter(c => c.status === 'Active').length;
        const inactiveCount = customers.filter(c => c.status === 'Inactive').length;
        const prospectCount = customers.filter(c => c.status === 'Prospect').length;
        const withNDA = customers.filter(c => c.mutual_nda).length;

        // Group by continent
        const continentGroups = {};
        customers.forEach(c => {
            const continent = getContinent(c.country);
            if (!continentGroups[continent]) {
                continentGroups[continent] = { total: 0, active: 0 };
            }
            continentGroups[continent].total++;
            if (c.status === 'Active') {
                continentGroups[continent].active++;
            }
        });

        return { activeCount, inactiveCount, prospectCount, withNDA, continentGroups };
    }, [customers]);

    // Pagination
    const paginatedCustomers = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return customers.slice(startIndex, startIndex + pageSize);
    }, [customers, currentPage, pageSize]);

    const totalPages = Math.ceil(customers.length / pageSize);

    const openModal = (customer = null) => {
        setSelectedCustomer(customer);
        if (customer) {
            reset(customer);
        } else {
            reset({
                customer_id: `CUST-${Date.now()}`,
                customer_name: '',
                contact_person: '',
                email: '',
                phone: '',
                address: '',
                country: '',
                currency: 'USD',
                status: 'Active',
                onboarding_date: '',
                mutual_nda: ''
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedCustomer(null);
        reset();
    };

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            if (selectedCustomer) {
                await customersApi.update(selectedCustomer.customer_id, data);
            } else {
                await customersApi.create(data);
            }
            await loadCustomers();
            closeModal();
        } catch (error) {
            console.error('Error saving customer:', error);
            alert(error.response?.data?.detail || 'Error saving customer');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (customer) => {
        if (!confirm(`Delete ${customer.customer_name}?`)) return;

        try {
            await customersApi.delete(customer.customer_id);
            await loadCustomers();
        } catch (error) {
            console.error('Error deleting customer:', error);
        }
    };

    const columns = [
        { key: 'customer_id', label: 'ID' },
        { key: 'customer_name', label: 'Customer Name' },
        { key: 'contact_person', label: 'Contact Person' },
        { key: 'email', label: 'Email' },
        { key: 'country', label: 'Country' },
        { key: 'currency', label: 'Currency' },
        {
            key: 'status',
            label: 'Status',
            render: (value) => (
                <span className={`badge ${value === 'Active' ? 'badge-success' : value === 'Prospect' ? 'badge-warning' : 'badge-gray'}`}>
                    {value}
                </span>
            )
        },
        {
            key: 'onboarding_date',
            label: 'Onboarding',
            render: (value) => {
                if (!value) return '-';
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                    return value.split(' ')[0];
                }
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const day = String(date.getDate()).padStart(2, '0');
                const month = months[date.getMonth()];
                const year = date.getFullYear();
                return `${day}-${month}-${year}`;
            }
        },
        {
            key: 'mutual_nda',
            label: 'NDA',
            render: (value) => value ? (
                <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary-600)',
                        padding: '0.25rem'
                    }}
                    title="View NDA Document"
                >
                    <ExternalLink size={16} />
                </a>
            ) : (
                <span style={{ color: 'var(--gray-400)' }}>-</span>
            )
        }
    ];

    if (loading) return <Loading />;

    // Continent colors
    const continentColors = {
        'North America': 'blue',
        'Europe': 'purple',
        'Asia': 'green',
        'Middle East': 'yellow',
        'Oceania': 'cyan',
        'South America': 'orange',
        'Africa': 'red',
        'Other': 'gray',
        'Unknown': 'gray'
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Customers</h1>
                    <p className="page-subtitle">Manage your customers and clients</p>
                </div>
                <button className="btn btn-primary" onClick={() => openModal()}>
                    <Plus size={18} />
                    Add Customer
                </button>
            </div>

            {/* Summary Stats Row */}
            <div style={{
                display: 'flex',
                gap: '1.5rem',
                marginBottom: '1.5rem',
                flexWrap: 'wrap'
            }}>
                {/* Active Customers Widget */}
                <div style={{
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    color: 'white',
                    minWidth: '160px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <Users size={20} />
                        <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>Active Customers</span>
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: '700', lineHeight: 1 }}>{stats.activeCount}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '0.5rem' }}>of {customers.length} total</div>
                </div>

                {/* Customers by Region Group */}
                <div style={{
                    flex: 1,
                    background: 'white',
                    borderRadius: '12px',
                    border: '1px solid var(--gray-200)',
                    padding: '1rem'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.75rem',
                        color: 'var(--gray-600)',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                    }}>
                        <Globe size={16} />
                        Customers by Region
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                        {Object.entries(stats.continentGroups)
                            .sort((a, b) => b[1].total - a[1].total)
                            .map(([continent, data]) => (
                                <div
                                    key={continent}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        background: 'var(--gray-50)',
                                        borderRadius: '8px',
                                        borderLeft: `3px solid var(--${continentColors[continent] || 'gray'}-500)`,
                                        minWidth: '90px'
                                    }}
                                >
                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '0.25rem' }}>
                                        {continent}
                                    </div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--gray-800)' }}>
                                        {data.total}
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </div>

            {/* Data Table with Pagination */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <DataTable
                        columns={columns}
                        data={paginatedCustomers}
                        searchFields={['customer_name', 'contact_person', 'email', 'country']}
                        actions={(row) => (
                            <>
                                <button className="btn btn-secondary btn-sm" onClick={() => openModal(row)}>
                                    <Edit2 size={14} />
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(row)}>
                                    <Trash2 size={14} />
                                </button>
                            </>
                        )}
                    />
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem',
                        borderTop: '1px solid var(--gray-200)'
                    }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
                            Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, customers.length)} of {customers.length}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {[...Array(totalPages)].map((_, i) => (
                                <button
                                    key={i}
                                    className={`btn btn-sm ${currentPage === i + 1 ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setCurrentPage(i + 1)}
                                    style={{ minWidth: '32px' }}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={selectedCustomer ? 'Edit Customer' : 'Add Customer'}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSubmit(onSubmit)} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </>
                }
            >
                <form>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Customer ID</label>
                            <input
                                className="form-input"
                                {...register('customer_id')}
                                disabled={!!selectedCustomer}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Customer Name *</label>
                            <input className="form-input" {...register('customer_name', { required: true })} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Contact Person</label>
                            <input className="form-input" {...register('contact_person')} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input type="email" className="form-input" {...register('email')} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Phone</label>
                            <input className="form-input" {...register('phone')} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Country</label>
                            <input className="form-input" {...register('country')} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Address</label>
                        <textarea className="form-textarea" rows={2} {...register('address')} />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Currency</label>
                            <select className="form-select" {...register('currency')}>
                                <option value="USD">USD</option>
                                <option value="INR">INR</option>
                                <option value="SGD">SGD</option>
                                <option value="GBP">GBP</option>
                                <option value="AED">AED</option>
                                <option value="MXN">MXN</option>
                                <option value="EUR">EUR</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-select" {...register('status')}>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                                <option value="Prospect">Prospect</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Onboarding Date</label>
                            <input type="date" className="form-input" {...register('onboarding_date')} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Mutual NDA (Google Drive URL)</label>
                            <input
                                type="url"
                                className="form-input"
                                {...register('mutual_nda')}
                                placeholder="https://drive.google.com/..."
                            />
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

export default Customers;
