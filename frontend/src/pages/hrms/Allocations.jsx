import { useState, useEffect, useMemo } from 'react';
import { formatDate } from '../../utils/dateUtils';
import { Plus, Edit2, Trash2, Calendar, ChevronUp, ChevronDown, Clock, Briefcase, Filter, RotateCcw } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import SearchableSelect from '../../components/common/SearchableSelect';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import { allocationsApi, projectsApi, associatesApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

function Allocations() {
    const [loading, setLoading] = useState(true);
    const [myAllocations, setMyAllocations] = useState([]);
    const [allocations, setAllocations] = useState([]);
    const { user, isManagerOrAdmin, isHROrAdmin } = useAuth();
    const { showToast } = useToast();

    const [projects, setProjects] = useState([]);
    const [associates, setAssociates] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAllocation, setSelectedAllocation] = useState(null);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'gantt'
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [activeTab, setActiveTab] = useState('my');

    // Filters
    const [filterStatus, setFilterStatus] = useState('Active'); // 'Active' or 'All'
    const [filterType, setFilterType] = useState('All'); // 'All', 'Billable', 'Non Billable', 'Unallocated'
    const [filterProject, setFilterProject] = useState('All');
    const [filterAssociate, setFilterAssociate] = useState('All');
    const [filterAssociateStatus, setFilterAssociateStatus] = useState('All'); // 'All', 'Active', 'Inactive', 'On Leave'
    const [showFilters, setShowFilters] = useState(false);

    const { register, handleSubmit, reset, setValue, control, watch, formState: { errors } } = useForm();
    const watchProjectId = watch('project_id');
    const watchAssociateId = watch('associate_id');

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (watchProjectId) {
            const project = projects.find(p => p.project_id === watchProjectId);
            if (project) {
                setValue('project_name', project.project_name);
                // Auto-populate dates only if they are not already set (e.g. during an edit) or if actively creating
                if (!selectedAllocation) {
                    if (project.start_date) setValue('start_date', project.start_date);
                    if (project.end_date) setValue('end_date', project.end_date);
                }
            }
        }
    }, [watchProjectId, projects, setValue, selectedAllocation]);

    useEffect(() => {
        if (watchAssociateId) {
            const associate = associates.find(a => a.associate_id === watchAssociateId);
            if (associate) {
                setValue('associate_name', associate.associate_name);
            }
        }
    }, [watchAssociateId, associates, setValue]);

    useEffect(() => {
        loadData();
    }, [filterStatus]); // Reload when status filter changes

    const loadData = async () => {
        setLoading(true);
        try {
            const activeOnly = filterStatus === 'Active';
            const [dashboardRes, projRes, assocRes] = await Promise.all([
                allocationsApi.getDashboardView(activeOnly),
                projectsApi.getAll(),
                associatesApi.getAll()
            ]);

            setMyAllocations(dashboardRes.data.my_allocations);
            setAllocations(dashboardRes.data.managed_allocations); // Main table shows managed allocations

            setProjects(projRes.data);
            setAssociates(assocRes.data);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (allocation = null) => {
        setSelectedAllocation(allocation);
        if (allocation) {
            reset(allocation);
        } else {
            reset({
                project_id: '',
                project_name: '',
                associate_id: '',
                associate_name: '',
                allocation_type: 'Billable',
                start_date: '',
                end_date: '',
                allocation_percentage: 100
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedAllocation(null);
        reset();
    };

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            if (selectedAllocation) {
                await allocationsApi.update(selectedAllocation.row_index, data);
            } else {
                await allocationsApi.create(data);
            }
            await loadData();
            showToast(`Allocation ${selectedAllocation ? 'updated' : 'created'} successfully`, 'success');
            closeModal();
        } catch (error) {
            console.error('Error saving allocation:', error);
            showToast(error.response?.data?.detail || 'Error saving allocation', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (allocation) => {
        if (!confirm(`Are you sure you want to delete this allocation?`)) return;

        try {
            await allocationsApi.delete(allocation.row_index);
            await loadData();
            showToast('Allocation deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting allocation:', error);
            showToast(error.response?.data?.detail || 'Error deleting allocation', 'error');
        }
    };

    const columns = [
        { key: 'project_id', label: 'Proj ID', width: '100px' },
        { key: 'project_name', label: 'Project', width: '150px' },
        { key: 'associate_id', label: 'Assoc ID', width: '100px' },
        { key: 'associate_name', label: 'Associate', width: '150px' },
        {
            key: 'project_status',
            label: 'Status',
            width: '100px',
            render: (value) => (
                <span className={`badge ${value?.toLowerCase() === 'active' || value?.toLowerCase() === 'in progress' ? 'badge-success' : value === 'On Bench' ? 'badge-error' : 'badge-gray'}`}>
                    {value || 'N/A'}
                </span>
            )
        },
        {
            key: 'allocation_type',
            label: 'Type',
            width: '80px',
            render: (value) => (
                <span className={`badge ${value === 'Billable' ? 'badge-success' : value === 'Unallocated' ? 'badge-error' : 'badge-gray'}`}>
                    {value}
                </span>
            )
        },
        {
            key: 'start_date',
            label: 'Start Date',
            width: '110px',
            render: (value) => value === '-' ? '-' : formatDate(value)
        },
        {
            key: 'end_date',
            label: 'End Date',
            width: '110px',
            render: (value) => value === '-' ? '-' : formatDate(value)
        },
        {
            key: 'allocation_percentage',
            label: 'Alloc (%)',
            width: '80px',
            render: (value) => `${value}%`
        }
    ];

    // Filter helper
    const filterAll = (list) => {
        return list.filter(item => {
            const matchesType = filterType === 'All' || item.allocation_type === filterType;
            const matchesProject = filterProject === 'All' || item.project_id === filterProject;
            const matchesAssociate = filterAssociate === 'All' || item.associate_id === filterAssociate;
            const associate = associates.find(a => a.associate_id === item.associate_id);
            const matchesAssociateStatus = filterAssociateStatus === 'All' || (associate && associate.status === filterAssociateStatus);
            return matchesType && matchesProject && matchesAssociate && matchesAssociateStatus;
        });
    };

    const resetFilters = () => {
        setFilterStatus('Active');
        setFilterType('All');
        setFilterProject('All');
        setFilterAssociate('All');
        setFilterAssociateStatus('All');
        setSelectedYear(new Date().getFullYear());
    };

    const filteredMyAllocations = useMemo(() => {
        if (filterType === 'Unallocated') {
            const isAllocated = myAllocations.length > 0;
            if (isAllocated) return [];

            // Check if my current status matches the associate status filter
            if (filterAssociateStatus !== 'All' && user.status !== filterAssociateStatus) {
                return [];
            }

            // If myAllocations is empty, it means I'm unallocated
            return [{
                associate_id: user.associate_id,
                associate_name: user.name,
                project_id: '-',
                project_name: 'BENCH',
                allocation_type: 'Unallocated',
                start_date: '-',
                end_date: '-',
                allocation_percentage: 0,
                project_status: 'On Bench'
            }];
        }
        return filterAll(myAllocations);
    }, [myAllocations, filterType, filterProject, filterAssociate, filterAssociateStatus, user, associates]);

    const filteredManagedAllocations = useMemo(() => {
        if (filterType === 'Unallocated') {
            const allocatedAssociateIds = new Set(allocations.map(a => a.associate_id));
            let unallocated = associates.filter(assoc => !allocatedAssociateIds.has(assoc.associate_id));

            // Apply associate status filter
            if (filterAssociateStatus !== 'All') {
                unallocated = unallocated.filter(a => a.status === filterAssociateStatus);
            }

            // Apply associate filter if selected
            if (filterAssociate !== 'All') {
                unallocated = unallocated.filter(a => a.associate_id === filterAssociate);
            }

            return unallocated.map(assoc => ({
                associate_id: assoc.associate_id,
                associate_name: assoc.associate_name,
                project_id: '-',
                project_name: 'BENCH',
                allocation_type: 'Unallocated',
                start_date: '-',
                end_date: '-',
                allocation_percentage: 0,
                project_status: 'On Bench'
            }));
        }
        return filterAll(allocations);
    }, [allocations, associates, filterType, filterProject, filterAssociate, filterAssociateStatus]);

    // Gantt Chart Component
    const GanttChartView = ({ data, year }) => {
        const startOfTimeline = new Date(year, 0, 1);
        const monthsToShow = 12;

        const timelineMonths = Array.from({ length: monthsToShow }, (_, i) => {
            const d = new Date(year, i, 1);
            return {
                label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
                year: d.getFullYear(),
                month: d.getMonth(),
                daysInMonth: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
            };
        });

        const totalDays = timelineMonths.reduce((sum, m) => sum + m.daysInMonth, 0);
        const timelineEnd = new Date(year, 11, 31);

        const groupedByAssociate = data.reduce((acc, curr) => {
            if (!acc[curr.associate_id]) {
                acc[curr.associate_id] = {
                    name: curr.associate_name,
                    id: curr.associate_id,
                    allocations: []
                };
            }
            if (curr.project_id !== '-') {
                acc[curr.associate_id].allocations.push(curr);
            }
            return acc;
        }, {});

        const associatesList = Object.values(groupedByAssociate);

        const getPosition = (dateStr) => {
            if (!dateStr || dateStr === '-') return null;
            const date = new Date(dateStr);
            if (date < startOfTimeline || date > timelineEnd) return null;

            let daysFromStart = 0;
            const dYear = date.getFullYear();
            const dMonth = date.getMonth();
            const dDay = date.getDate();

            for (let i = 0; i < timelineMonths.length; i++) {
                const m = timelineMonths[i];
                if (m.year === dYear && m.month === dMonth) {
                    daysFromStart += dDay - 1;
                    break;
                }
                daysFromStart += m.daysInMonth;
            }
            return (daysFromStart / totalDays) * 100;
        };

        const getWidth = (startDate, endDate) => {
            if (!startDate || startDate === '-') return 0;
            const s = new Date(startDate);
            const e = endDate && endDate !== '-' ? new Date(endDate) : timelineEnd;

            const effectiveStart = s < startOfTimeline ? startOfTimeline : s;
            const effectiveEnd = e > timelineEnd ? timelineEnd : e;

            if (effectiveEnd < effectiveStart) return 0;

            const diffTime = Math.abs(effectiveEnd - effectiveStart);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            return (diffDays / totalDays) * 100;
        };

        return (
            <div className="gantt-container">
                <div className="gantt-header">
                    <div className="gantt-y-axis-label">Associate</div>
                    <div className="gantt-timeline-header">
                        {timelineMonths.map((m, i) => (
                            <div key={i} className="gantt-month-label" style={{ width: `${(m.daysInMonth / totalDays) * 100}%` }}>
                                {m.label}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="gantt-body">
                    {associatesList.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 italic">No allocations found for the selected filters</div>
                    ) : (
                        associatesList.map((assoc, rowIndex) => (
                            <div key={assoc.id} className="gantt-row">
                                <div className="gantt-y-axis-item">
                                    <span className="font-semibold">{assoc.name} ({assoc.id})</span>
                                </div>
                                <div className="gantt-timeline-row">
                                    {timelineMonths.map((m, i) => (
                                        <div key={i} className="gantt-grid-cell" style={{ width: `${(m.daysInMonth / totalDays) * 100}%` }}></div>
                                    ))}
                                    {assoc.allocations.map((alloc, idx) => {
                                        const left = getPosition(alloc.start_date) ?? (new Date(alloc.start_date) < startOfTimeline ? 0 : null);
                                        const width = getWidth(alloc.start_date, alloc.end_date);
                                        if (left === null || width <= 0) return null;
                                        return (
                                            <div
                                                key={idx}
                                                className={`gantt-bar ${alloc.allocation_type === 'Billable' ? 'billable' : 'non-billable'} ${rowIndex < 2 ? 'top-row' : ''}`}
                                                style={{
                                                    left: `${left}%`,
                                                    width: `${width}%`,
                                                    top: '50%',
                                                    transform: 'translateY(-50%)'
                                                }}
                                            >
                                                <div className="gantt-tooltip">
                                                    <div className="font-bold border-bottom mb-1 pb-1">{alloc.project_id} - {alloc.project_name}</div>
                                                    <div><span className="text-gray-400">Start:</span> {formatDate(alloc.start_date)}</div>
                                                    <div><span className="text-gray-400">End:</span> {formatDate(alloc.end_date)}</div>
                                                    <div className="mt-1 font-semibold">{alloc.allocation_percentage}% Allocation</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    if (loading) return <Loading />;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Allocations Dashboard</h1>
                    <p className="page-subtitle">Manage project assignments and view your current allocation.</p>
                </div>
            </div>

            {(isManagerOrAdmin || isHROrAdmin) && (
                <div className="tabs-container">
                    <button
                        className={`tab-btn ${activeTab === 'my' ? 'active' : ''}`}
                        onClick={() => setActiveTab('my')}
                    >
                        <Clock size={18} className="tab-icon" />
                        My Allocations
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'managed' ? 'active' : ''}`}
                        onClick={() => setActiveTab('managed')}
                    >
                        <Briefcase size={18} className="tab-icon" />
                        Managed Project Allocations
                    </button>
                </div>
            )}

            <div className="sub-header-toolbar">
                <div className="flex gap-2 items-center">
                    {(activeTab === 'managed' && (isManagerOrAdmin || isHROrAdmin)) && (
                        <div className="flex gap-2">
                            <button
                                className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setViewMode('list')}
                            >
                                List View
                            </button>
                            <button
                                className={`btn ${viewMode === 'gantt' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setViewMode('gantt')}
                            >
                                <Briefcase size={16} />
                                Gantt View
                            </button>
                        </div>
                    )}
                    <button
                        className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setShowFilters(!showFilters)}
                        title="Toggle Filters"
                    >
                        <Filter size={18} />
                        <span>Filters</span>
                    </button>
                </div>

                {activeTab === 'managed' && (isManagerOrAdmin || isHROrAdmin) && (
                    <button className="btn btn-primary" onClick={() => openModal()}>
                        <Plus size={18} />
                        Add Allocation
                    </button>
                )}
            </div>

            <div className={`filter-bar-collapsible ${showFilters ? 'show' : ''}`}>
                <div className="filter-inner">
                    <div className="filter-grid">
                        <div className="filter-item">
                            <label>Status</label>
                            <select
                                className="form-select"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="Active">Active Projects</option>
                                <option value="All">All Projects</option>
                            </select>
                        </div>
                        <div className="filter-item">
                            <label>Type</label>
                            <select
                                className="form-select"
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                            >
                                <option value="All">All Types</option>
                                <option value="Billable">Billable</option>
                                <option value="Non Billable">Non Billable</option>
                                <option value="Unallocated">Unallocated</option>
                            </select>
                        </div>
                        <div className="filter-item">
                            <label>Project</label>
                            <SearchableSelect
                                options={[
                                    { value: 'All', label: 'All Projects' },
                                    ...projects.map(p => ({ value: p.project_id, label: p.project_name }))
                                ]}
                                value={filterProject}
                                onChange={(val) => setFilterProject(val || 'All')}
                                disabled={filterType === 'Unallocated'}
                                placeholder="Select Project"
                            />
                        </div>
                        <div className="filter-item">
                            <label>Assoc Status</label>
                            <select
                                className="form-select"
                                value={filterAssociateStatus}
                                onChange={(e) => setFilterAssociateStatus(e.target.value)}
                            >
                                <option value="All">All Status</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                                <option value="On Leave">On Leave</option>
                            </select>
                        </div>
                        <div className="filter-item">
                            <label>Associate</label>
                            <SearchableSelect
                                options={[
                                    { value: 'All', label: 'All Associates' },
                                    ...associates
                                        .filter(a => filterAssociateStatus === 'All' || a.status === filterAssociateStatus)
                                        .map(a => ({ value: a.associate_id, label: a.associate_name }))
                                ]}
                                value={filterAssociate}
                                onChange={(val) => setFilterAssociate(val || 'All')}
                                placeholder="Select Associate"
                            />
                        </div>
                        {activeTab === 'managed' && viewMode === 'gantt' && filterType !== 'Unallocated' && (
                            <div className="filter-item">
                                <label>Year</label>
                                <select
                                    className="form-select"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                >
                                    {[2024, 2025, 2026, 2027].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={resetFilters} title="Reset all filters">
                        <RotateCcw size={14} />
                        <span>Reset</span>
                    </button>
                </div>
            </div>

            {(activeTab === 'my' || !isManagerOrAdmin) && (
                <div className="card shadow-none border-0 mt-4">
                    <div className="card-body" style={{ padding: 0 }}>
                        {filteredMyAllocations.length > 0 ? (
                            <DataTable
                                columns={columns.filter(c => !['associate_name', 'associate_id'].includes(c.key))}
                                data={filteredMyAllocations}
                                searchFields={['project_name']}
                                actions={() => <></>}
                            />
                        ) : (
                            <div className="text-gray-500 italic p-4 text-center">
                                {filterType === 'Unallocated'
                                    ? "You are currently allocated to projects. No unallocated status found."
                                    : `You are not currently allocated to any ${filterStatus === 'Active' ? 'active' : ''} project${filterType !== 'All' ? ` of type ${filterType}` : ''}.`
                                }
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'managed' && (isManagerOrAdmin || isHROrAdmin) && (
                <div className="mt-4">
                    {viewMode === 'list' && (
                        <div className="card shadow-none border-0">
                            <div className="card-body" style={{ padding: 0 }}>
                                <DataTable
                                    columns={columns}
                                    data={filteredManagedAllocations}
                                    searchFields={['project_name', 'associate_name']}
                                    actions={(row) => row.project_id === '-' ? <></> : (
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
                    )}

                    {viewMode === 'gantt' && (
                        <div className="card shadow-none border-0 overflow-hidden">
                            <div className="card-body" style={{ padding: 0 }}>
                                <GanttChartView data={filteredManagedAllocations} year={selectedYear} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={selectedAllocation ? 'Edit Allocation' : 'Add Allocation'}
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
                            <label className="form-label">Project *</label>
                            <Controller
                                name="project_id"
                                control={control}
                                rules={{ required: true }}
                                render={({ field }) => (
                                    <SearchableSelect
                                        className={errors.project_id ? 'has-error' : ''}
                                        options={projects.map(p => ({ value: p.project_id, label: `[${p.project_id}] ${p.project_name}` }))}
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder="Select Project"
                                        required={true}
                                    />
                                )}
                            />
                            <input type="hidden" {...register('project_name')} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Associate *</label>
                            <Controller
                                name="associate_id"
                                control={control}
                                rules={{ required: true }}
                                render={({ field }) => (
                                    <SearchableSelect
                                        className={errors.associate_id ? 'has-error' : ''}
                                        options={associates.map(a => ({ value: a.associate_id, label: a.associate_name }))}
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder="Select Associate"
                                        required={true}
                                    />
                                )}
                            />
                            <input type="hidden" {...register('associate_name')} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Allocation Type *</label>
                            <select className={`form-select ${errors.allocation_type ? 'input-error' : ''}`} {...register('allocation_type', { required: true })}>
                                <option value="Billable">Billable</option>
                                <option value="Non Billable">Non Billable</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Allocation % *</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                className={`form-input ${errors.allocation_percentage ? 'input-error' : ''}`}
                                {...register('allocation_percentage', { required: true, min: 0, max: 100 })}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Start Date *</label>
                            <input
                                type="date"
                                className={`form-input ${errors.start_date ? 'input-error' : ''}`}
                                {...register('start_date', { required: true })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">End Date</label>
                            <input
                                type="date"
                                className={`form-input ${errors.end_date ? 'input-error' : ''}`}
                                {...register('end_date')}
                            />
                        </div>
                    </div>
                </form>
            </Modal>

            <style>{`
                /* Error Highlights for Form Validation */
                .input-error, .has-error .form-input {
                    border-color: #ef4444 !important;
                    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
                }
                
                .tabs-container {
                    display: flex;
                    gap: 4px;
                    margin: 1.5rem 0;
                    background: #f8fafc;
                    padding: 6px;
                    border-radius: 16px;
                    width: fit-content;
                    border: 1px solid #e2e8f0;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }
                .tab-btn {
                    padding: 0.75rem 1.5rem;
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
                }
                .tab-btn:hover { color: #0f172a; transform: translateY(-1px); }
                .tab-btn.active { color: white; background: var(--gradient-primary); box-shadow: var(--shadow-glow); }
                .tab-btn .tab-icon { transition: transform 0.3s ease; color: #94a3b8; }
                .tab-btn.active .tab-icon { transform: scale(1.1); color: white; }

                .sub-header-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                    gap: 1rem;
                }

                /* Filter Bar - Collapsible */
                .filter-bar-collapsible {
                    max-height: 0;
                    overflow: hidden;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    opacity: 0;
                    margin-bottom: 0;
                }
                .filter-bar-collapsible.show {
                    max-height: 500px;
                    opacity: 1;
                    margin-bottom: 1.5rem;
                }
                .filter-inner {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 1.5rem;
                    display: flex;
                    align-items: flex-end;
                    gap: 1.5rem;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
                }
                .filter-grid { display: flex; flex-wrap: wrap; gap: 1.5rem; flex: 1; }
                .filter-item { display: flex; flex-direction: column; gap: 0.5rem; min-width: 180px; flex: 1; }
                .filter-item label { font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
                .filter-item .form-select { width: 100%; height: 42px; border-radius: 8px; border: 1px solid #e2e8f0; padding: 0 12px; font-size: 0.875rem; background-color: #f8fafc; transition: all 0.2s; }
                .filter-item .form-select:focus { border-color: #3b82f6; background-color: white; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); outline: none; }
                .filter-item .form-select:disabled { background-color: #f1f5f9; cursor: not-allowed; color: #94a3b8; }

                /* Gantt Chart Styles */
                .gantt-container {
                    display: flex;
                    flex-direction: column;
                    min-width: 1000px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .gantt-header {
                    display: flex;
                    background: #f8fafc;
                    border-bottom: 2px solid #e2e8f0;
                    font-weight: 700;
                    color: #475569;
                    font-size: 0.65rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .gantt-y-axis-label { width: 250px; padding: 0.5rem 1rem; border-right: 2px solid #e2e8f0; display: flex; align-items: center; }
                .gantt-timeline-header { flex: 1; display: flex; }
                .gantt-month-label { padding: 0.5rem 0.25rem; text-align: center; border-right: 1px solid #e2e8f0; }
                .gantt-row { display: flex; border-bottom: 1px solid #f1f5f9; transition: background 0.2s; }
                .gantt-row:hover { background: #f8fafc; }
                .gantt-y-axis-item { width: 250px; padding: 0.5rem 1rem; border-right: 2px solid #e2e8f0; background: #fafafa; flex-shrink: 0; font-size: 0.75rem; display: flex; align-items: center; }
                .gantt-timeline-row { flex: 1; position: relative; height: 30px; display: flex; }
                .gantt-grid-cell { height: 100%; border-right: 1px solid #f1f5f9; }
                .gantt-bar { position: absolute; height: 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s; z-index: 1; }
                .gantt-bar:hover { filter: brightness(1.1); transform: translateY(-50%) scaleY(1.3); z-index: 10; }
                .gantt-bar.billable { background: #22c55e; box-shadow: 0 2px 4px rgba(34, 197, 94, 0.3); }
                .gantt-bar.non-billable { background: #ef4444; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3); }
                .gantt-tooltip {
                    position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%) translateY(-8px);
                    background: #1e293b; color: white; padding: 0.5rem 0.75rem; border-radius: 6px;
                    font-size: 0.65rem; width: max-content; max-width: 250px; opacity: 0; visibility: hidden;
                    transition: all 0.2s; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
                    pointer-events: none; line-height: 1.4;
                }
                .gantt-bar:hover .gantt-tooltip { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(-12px); }
                .gantt-bar.top-row .gantt-tooltip { bottom: auto; top: 100%; transform: translateX(-50%) translateY(8px); }
                .gantt-bar.top-row:hover .gantt-tooltip { transform: translateX(-50%) translateY(12px); }
                .overflow-hidden { overflow: hidden !important; }
                .mb-1 { margin-bottom: 0.25rem; }
                .pb-1 { padding-bottom: 0.25rem; }
                .border-bottom { border-bottom: 1px solid rgba(255,255,255,0.1); }
                .mt-1 { margin-top: 0.25rem; }
            `}</style>
        </div>
    );
}

export default Allocations;
