import { useState, useEffect } from 'react';
import { formatDate } from '../../utils/dateUtils';
import { Plus, Edit2, Trash2, ExternalLink, Briefcase, TrendingUp, CheckCircle, Filter, Library } from 'lucide-react';
import { useForm } from 'react-hook-form';
import DataTable from '../../components/common/DataTable';

import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import SearchableSelect from '../../components/common/SearchableSelect';
import { useAuth } from '../../contexts/AuthContext';
import { projectsApi, customersApi, associatesApi } from '../../services/api';
import { dealsApi } from '../../services/crms_api';

// Currency symbols mapping
const currencySymbols = {
    USD: '$',
    INR: '₹',
    EUR: '€',
    GBP: '£',
    SGD: 'S$',
    AUD: 'A$',
    JPY: '¥',
    CAD: 'C$'
};

function Projects() {
    const { isAdmin } = useAuth();
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [associates, setAssociates] = useState([]);
    const [deals, setDeals] = useState([]);
    const [stats, setStats] = useState({ active_revenue: 0, active_investment: 0, completed: 0, total: 0, by_type: {}, by_status: {} });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [saving, setSaving] = useState(false);

    // Filter state
    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterStatus, setFilterStatus] = useState('Active');
    const [filterType, setFilterType] = useState('Revenue');
    const [filterPM, setFilterPM] = useState('');
    const [activeTab, setActiveTab] = useState('Active');

    const { register, handleSubmit, reset, setValue, watch } = useForm();

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            const [projectsRes, customersRes, associatesRes, statsRes, dealsRes] = await Promise.all([
                projectsApi.getAll(),
                customersApi.getAll(),
                associatesApi.getAll(),
                projectsApi.getStats(),
                dealsApi.getAll()
            ]);
            setProjects(projectsRes.data);
            setCustomers(customersRes.data);
            setAssociates(associatesRes.data);
            setStats(statsRes.data);
            setDeals(dealsRes.data || []);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Create customer lookup
    const customerLookup = customers.reduce((acc, c) => {
        acc[c.customer_id] = c.customer_name;
        return acc;
    }, {});

    const dealLookup = deals.reduce((acc, d) => {
        acc[d.id] = d.name;
        return acc;
    }, {});

    // Create associate lookup for project managers
    const associateLookup = associates.reduce((acc, a) => {
        acc[a.associate_id] = a.associate_name;
        return acc;
    }, {});

    // Get unique years from projects for filter dropdown
    const availableYears = [...new Set(projects
        .filter(p => p.start_date)
        .map(p => new Date(p.start_date).getFullYear())
    )].sort((a, b) => b - a);

    // Month names for filter dropdown
    const months = [
        { value: 1, label: 'January' },
        { value: 2, label: 'February' },
        { value: 3, label: 'March' },
        { value: 4, label: 'April' },
        { value: 5, label: 'May' },
        { value: 6, label: 'June' },
        { value: 7, label: 'July' },
        { value: 8, label: 'August' },
        { value: 9, label: 'September' },
        { value: 10, label: 'October' },
        { value: 11, label: 'November' },
        { value: 12, label: 'December' }
    ];

    // Get unique Project Managers from current projects
    const projectManagers = [...new Set(projects
        .filter(p => p.project_manager_id)
        .map(p => p.project_manager_id)
    )].map(id => ({
        id,
        name: associateLookup[id] || id
    })).sort((a, b) => a.name.localeCompare(b.name));

    // Filter projects based on selected filters
    const filteredProjects = projects.filter(project => {
        // Year filter
        if (filterYear && project.start_date) {
            const projectYear = new Date(project.start_date).getFullYear();
            if (projectYear !== parseInt(filterYear)) return false;
        }

        // Month filter
        if (filterMonth && project.start_date) {
            const projectMonth = new Date(project.start_date).getMonth() + 1;
            if (projectMonth !== parseInt(filterMonth)) return false;
        }

        // Status filter (case-insensitive)
        // Status filter (controlled by tabs)
        if (activeTab !== 'All') {
            const projectStatus = (project.status || '').toLowerCase().replace(/\s+/g, '');
            const selectedStatus = activeTab.toLowerCase().replace(/\s+/g, '');
            if (projectStatus !== selectedStatus) return false;
        }

        // Type filter (case-insensitive)
        if (filterType) {
            const projectType = (project.project_type || '').toLowerCase();
            const selectedType = filterType.toLowerCase();
            if (projectType !== selectedType) return false;
        }

        // Project Manager filter
        if (filterPM && project.project_manager_id !== filterPM) {
            return false;
        }


        return true;
    });

    // Clear all filters
    const clearFilters = () => {
        setFilterYear('');
        setFilterMonth('');
        setFilterStatus('Active');
        setFilterType('Revenue');
        setFilterPM('');
    };

    // Check if any filter is different from default
    const isFiltered = filterYear !== '' ||
        filterMonth !== '' ||
        activeTab !== 'Active' ||
        filterType !== 'Revenue' ||
        filterPM !== '';

    // ... (rest of code)

    {
        isFiltered && (
            <button
                className="btn btn-secondary"
                onClick={clearFilters}
                title="Reset filters to default"
            >
                <span style={{ fontSize: '1.25rem', lineHeight: 0 }}>×</span>
                Reset
            </button>
        )
    }

    const openModal = (project = null) => {
        setSelectedProject(project);
        if (project) {
            // Format dates for input[type="date"] (YYYY-MM-DD)
            const formatDate = (dateStr) => {
                if (!dateStr) return '';
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return '';
                return date.toISOString().split('T')[0];
            };

            // Normalize status to Title Case
            const normalizeStatus = (status) => {
                if (!status) return 'Active';
                // Capitalize first letter, lowercase rest
                return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
            };

            reset({
                ...project,
                start_date: formatDate(project.start_date),
                end_date: formatDate(project.end_date),
                status: normalizeStatus(project.status)
            });
        } else {
            // For new projects, set today as default start date and generate ID
            const today = new Date().toISOString().split('T')[0];
            reset({
                project_id: '',
                project_name: '',
                customer_id: '',
                project_type: 'Revenue',
                status: 'Active',
                start_date: today,
                end_date: '',
                deal_id: '',
                project_manager_id: ''
            });
            // Generate project ID based on today's date
            generateProjectId(today);
        }
        setIsModalOpen(true);
    };

    const generateProjectId = async (dateStr) => {
        if (!dateStr) return;
        try {
            const date = new Date(dateStr);
            const year = date.getFullYear();
            const month = date.getMonth() + 1; // JS months are 0-indexed
            const response = await projectsApi.generateId(year, month);
            setValue('project_id', response.data.project_id);
        } catch (error) {
            console.error('Error generating project ID:', error);
        }
    };

    const handleStartDateChange = (e) => {
        const newDate = e.target.value;
        if (!selectedProject) {
            // Only auto-generate for new projects
            generateProjectId(newDate);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedProject(null);
        reset();
    };

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            if (selectedProject) {
                await projectsApi.update(selectedProject.project_id, data);
            } else {
                await projectsApi.create(data);
            }
            await loadProjects();
            closeModal();
        } catch (error) {
            console.error('Error saving project:', error);
            alert(error.response?.data?.detail || 'Error saving project');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (project) => {
        if (!confirm(`Are you sure you want to delete ${project.project_name}?`)) return;

        try {
            await projectsApi.delete(project.project_id);
            await loadProjects();
        } catch (error) {
            console.error('Error deleting project:', error);
            alert(error.response?.data?.detail || 'Error deleting project');
        }
    };

    const getStatusBadge = (status) => {
        // Normalize status to lowercase for comparison
        const normalizedStatus = (status || '').toLowerCase().replace(/\s+/g, '');
        const statusMap = {
            'active': 'badge-warning',
            'completed': 'badge-success',
            'inprogress': 'badge-info',
            'onhold': 'badge-gray',
            'cancelled': 'badge-error'
        };
        return <span className={`badge ${statusMap[normalizedStatus] || 'badge-gray'}`}>{status}</span>;
    };

    const formatSOWValue = (value, currency) => {
        if (!value) return '-';
        const symbol = currencySymbols[currency] || currency || '';
        // Use Indian number format for INR (lakhs/crores), otherwise standard format
        const locale = currency === 'INR' ? 'en-IN' : 'en-US';
        return `${symbol} ${Number(value).toLocaleString(locale)}`;
    };

    const columns = [
        { key: 'project_name', label: 'Project Name' },
        {
            key: 'customer_id',
            label: 'Customer',
            render: (value) => customerLookup[value] || value || '-'
        },
        {
            key: 'project_type',
            label: 'Type',
            render: (value) => (
                <span className={`badge ${value === 'Revenue' ? 'badge-success' : 'badge-info'}`}>
                    {value}
                </span>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (value) => getStatusBadge(value)
        },
        {
            key: 'deal_id',
            label: 'Deal',
            render: (value) => dealLookup[value] || value || '-'
        },
        {
            key: 'start_date',
            label: 'Start Date',
            render: (value) => formatDate(value)
        },
        {
            key: 'end_date',
            label: 'End Date',
            render: (value) => value ? formatDate(value) : '-'
        },
        {
            key: 'duration',
            label: 'Duration',
            render: (_, row) => {
                if (!row.start_date) return '-';
                const start = new Date(row.start_date);
                const end = row.end_date ? new Date(row.end_date) : new Date();
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 30) {
                    return `${diffDays} days`;
                } else if (diffDays < 365) {
                    const months = Math.floor(diffDays / 30);
                    const days = diffDays % 30;
                    return days > 0 ? `${months}m ${days}d` : `${months} months`;
                } else {
                    const years = Math.floor(diffDays / 365);
                    const remainingDays = diffDays % 365;
                    const months = Math.floor(remainingDays / 30);
                    return months > 0 ? `${years}y ${months}m` : `${years} years`;
                }
            }
        },
        {
            key: 'project_manager_id',
            label: 'Project Manager',
            render: (value) => associateLookup[value] || value || '-'
        }
    ];

    if (loading) return <Loading />;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Projects</h1>
                    <p className="page-subtitle">Manage your projects</p>
                </div>
                <button className="btn btn-primary" onClick={() => openModal()}>
                    <Plus size={18} />
                    Add Project
                </button>
            </div>
            <div className="tabs-container">
                <button
                    className={`tab-btn ${activeTab === 'Active' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Active')}
                >
                    <Briefcase size={18} className="tab-icon" />
                    Active Projects
                </button>
                <button
                    className={`tab-btn ${activeTab === 'All' ? 'active' : ''}`}
                    onClick={() => setActiveTab('All')}
                >
                    <Library size={18} className="tab-icon" />
                    All Projects
                </button>
            </div>

            {/* Summary Widgets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <TrendingUp size={24} color="white" />
                        </div>
                        <div>
                            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--gray-900)' }}>
                                {stats.active_revenue || 0}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>Active Revenue</div>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Briefcase size={24} color="white" />
                        </div>
                        <div>
                            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--gray-900)' }}>
                                {stats.active_investment || 0}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>Active Investment</div>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <CheckCircle size={24} color="white" />
                        </div>
                        <div>
                            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--gray-900)' }}>
                                {stats.completed || 0}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>Completed</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Filter size={18} color="var(--gray-500)" />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>Year:</label>
                        <select
                            className="form-select"
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            style={{ minWidth: '100px' }}
                        >
                            <option value="">All Years</option>
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>Month:</label>
                        <select
                            className="form-select"
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            style={{ minWidth: '130px' }}
                        >
                            <option value="">All Months</option>
                            {months.map(month => (
                                <option key={month.value} value={month.value}>{month.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status filter removed, replaced by tabs above */}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>Type:</label>
                        <select
                            className="form-select"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            style={{ minWidth: '130px' }}
                        >
                            <option value="">All Types</option>
                            <option value="Revenue">Revenue</option>
                            <option value="Investment">Investment</option>
                        </select>
                    </div>

                    {isAdmin && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>Manager:</label>
                            <select
                                className="form-select"
                                value={filterPM}
                                onChange={(e) => setFilterPM(e.target.value)}
                                style={{ minWidth: '150px' }}
                            >
                                <option value="">All Managers</option>
                                {projectManagers.map(pm => (
                                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {isFiltered && (
                        <button
                            className="btn btn-danger"
                            onClick={clearFilters}
                            title="Reset filters to default"
                        >
                            <span style={{ fontSize: '1.25rem', lineHeight: 0 }}>×</span>
                            Reset
                        </button>
                    )}
                </div>
            </div>

            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <DataTable
                        columns={columns}
                        data={filteredProjects}
                        searchFields={['project_name', 'customer_id', 'sow_number']}
                        extraHeaderContent={(
                            <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                                Showing {filteredProjects.length} of {projects.length} projects
                            </div>
                        )}
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
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={selectedProject ? 'Edit Project' : 'Add Project'}
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
                            <label className="form-label">Project ID *</label>
                            <input
                                className="form-input"
                                {...register('project_id', { required: true })}
                                disabled={!!selectedProject}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Project Name *</label>
                            <input
                                className="form-input"
                                {...register('project_name', { required: true })}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Customer</label>
                            <SearchableSelect
                                options={customers.map(c => ({ value: c.customer_id, label: c.customer_name }))}
                                value={watch('customer_id')}
                                onChange={(value) => setValue('customer_id', value)}
                                placeholder="Select Customer"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Type</label>
                            <select className="form-select" {...register('project_type')}>
                                <option value="Revenue">Revenue</option>
                                <option value="Investment">Investment</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-select" {...register('status')}>
                                <option value="Active">Active</option>
                                <option value="Completed">Completed</option>
                                <option value="On Hold">On Hold</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Deal</label>
                            <SearchableSelect
                                options={deals.map(d => ({ value: d.id, label: d.name }))}
                                value={watch('deal_id')}
                                onChange={(value) => setValue('deal_id', value)}
                                placeholder="Select Deal"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Start Date</label>
                            <input
                                type="date"
                                className="form-input"
                                {...register('start_date', {
                                    onChange: handleStartDateChange
                                })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">End Date</label>
                            <input
                                type="date"
                                className="form-input"
                                {...register('end_date')}
                            />
                        </div>
                    </div>

                    {/* Removed SOW Fields */}

                    <div className="form-group">
                        <label className="form-label">Project Manager</label>
                        <select className="form-select" {...register('project_manager_id')}>
                            <option value="">Select Project Manager</option>
                            {associates.map(a => (
                                <option key={a.associate_id} value={a.associate_id}>
                                    {a.associate_name}
                                </option>
                            ))}
                        </select>
                    </div>
                </form>
            </Modal>
            <style>{`
            /* Tabs - Premium Redesign */
            .tabs-container {
                display: flex;
                gap: 4px;
                margin: 2rem 0;
                background: #f8fafc;
                padding: 6px;
                border-radius: 16px;
                width: fit-content;
                border: 1px solid #e2e8f0;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
            }

            .tab-btn {
                padding: 0.75rem 1.75rem;
                border: none;
                background: transparent;
                font-size: 0.8125rem;
                font-weight: 700;
                color: #64748b;
                cursor: pointer;
                border-radius: 12px;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                position: relative;
            }

            .tab-btn:hover {
                color: #0f172a;
                transform: translateY(-1px);
            }

            .tab-btn.active {
                color: white;
                background: var(--gradient-primary);
                box-shadow: var(--shadow-glow);
            }

            .tab-btn .tab-icon {
                transition: transform 0.3s ease;
                color: #94a3b8;
            }

            .tab-btn.active .tab-icon {
                transform: scale(1.1);
                color: white;
            }
            `}</style>
        </div>
    );
}

export default Projects;
