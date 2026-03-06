import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Edit2, Trash2, ExternalLink, Filter, X, UserMinus, Upload } from 'lucide-react';
import { useForm } from 'react-hook-form';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import { associatesApi, skillsApi, organizationApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDriveDirectLink } from '../../utils/driveUtils';
import { COUNTRIES } from '../../utils/locationData';

function Associates() {
    const { isAdmin, isHR, isHROrAdmin } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [associates, setAssociates] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTerminationMode, setIsTerminationMode] = useState(false);
    const [selectedAssociate, setSelectedAssociate] = useState(null);
    const [saving, setSaving] = useState(false);
    const [statusFilter, setStatusFilter] = useState('Active');
    const [skillFamilies, setSkillFamilies] = useState([]);
    const [selectedSkills, setSelectedSkills] = useState([]);
    const [skillInput, setSkillInput] = useState('');
    const [skillSuggestions, setSkillSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const skillInputRef = useRef(null);
    const [uploadingProof, setUploadingProof] = useState(null); // 'national_id' or 'tax_id' during upload

    // New state for departments, roles, and work locations
    const [departments, setDepartments] = useState([]);
    const [roles, setRoles] = useState([]);
    const [workLocations, setWorkLocations] = useState([]);

    // For termination mode: select associate to terminate
    const [associateToTerminateId, setAssociateToTerminateId] = useState('');

    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm();
    const watchSkillFamily = watch('skill_family');
    const watchDepartmentId = watch('department_id');
    const watchCountry = watch('country');

    // Filter roles based on selected department_id
    const filteredRoles = useMemo(() => {
        if (!watchDepartmentId) return [];
        return roles.filter(r => r.department_id === watchDepartmentId);
    }, [roles, watchDepartmentId]);

    // Filter associates who have managerial roles
    const managerOptions = useMemo(() => {
        // Return all active associates as potential managers to ensure names resolve correctly
        return associates.filter(a => a.status === 'Active');
    }, [associates]);

    useEffect(() => {
        loadAssociates();
        loadSkillFamilies();
    }, []);

    // Watch for termination ID selection to auto-fill form data
    useEffect(() => {
        if (isTerminationMode && associateToTerminateId) {
            const associate = associates.find(a => a.associate_id === associateToTerminateId);
            if (associate) {
                // Populate form with existing data so we don't lose it on update
                // BUT we only really care about exit fields for the user input
                Object.keys(associate).forEach(key => {
                    setValue(key, associate[key]);
                });

                // Set default status to Inactive
                setValue('status', 'Inactive');

                setSelectedAssociate(associate); // So update logic works

                // Skills too
                const existingSkills = associate.skills
                    ? associate.skills.split(',').map(s => s.trim()).filter(s => s)
                    : [];
                setSelectedSkills(existingSkills);
            }
        }
    }, [associateToTerminateId, isTerminationMode, associates, setValue]);

    // Handle Country change to auto-update phone code and reset state
    useEffect(() => {
        if (watchCountry && COUNTRIES[watchCountry]) {
            const dialCode = COUNTRIES[watchCountry].dialCode;
            const currentPhone = watch('phone') || '';

            // If phone is empty or contains ONLY a plus sign or an old dial code, update it
            if (!currentPhone || currentPhone === '+' || Object.values(COUNTRIES).some(c => currentPhone === c.dialCode)) {
                setValue('phone', dialCode);
            }
        }
    }, [watchCountry, setValue]);

    // Search skills as user types
    useEffect(() => {
        const searchSkills = async () => {
            if (skillInput.length >= 1) {
                try {
                    const response = await skillsApi.search(skillInput, watchSkillFamily || undefined);
                    // Filter out already selected skills
                    const filtered = response.data.filter(s => !selectedSkills.includes(s));
                    setSkillSuggestions(filtered);
                    setShowSuggestions(filtered.length > 0);
                } catch (error) {
                    console.error('Error searching skills:', error);
                }
            } else {
                setSkillSuggestions([]);
                setShowSuggestions(false);
            }
        };

        const debounce = setTimeout(searchSkills, 200);
        return () => clearTimeout(debounce);
    }, [skillInput, watchSkillFamily, selectedSkills]);

    const loadAssociates = async () => {
        try {
            const response = await associatesApi.getAll();
            setAssociates(response.data);

            // Load departments, roles, and work locations
            const [deptRes, roleRes, workLocRes] = await Promise.all([
                organizationApi.getDepartments(),
                organizationApi.getRoles(),
                organizationApi.getWorkLocations()
            ]);
            setDepartments(deptRes.data);
            setRoles(roleRes.data);
            setWorkLocations(workLocRes.data);
        } catch (error) {
            console.error('Error loading associates:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSkillFamilies = async () => {
        try {
            const response = await skillsApi.getFamilies();
            setSkillFamilies(response.data);
        } catch (error) {
            console.error('Error loading skill families:', error);
        }
    };

    // Add a skill from suggestion or Enter key
    const addSkill = (skill) => {
        if (skill && !selectedSkills.includes(skill)) {
            setSelectedSkills(prev => [...prev, skill]);
        }
        setSkillInput('');
        setShowSuggestions(false);
        skillInputRef.current?.focus();
    };

    // Handle Enter key in skill input
    const handleSkillKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (skillSuggestions.length > 0) {
                // Select first suggestion
                addSkill(skillSuggestions[0]);
            } else if (skillInput.trim()) {
                // Add custom skill if no suggestions
                addSkill(skillInput.trim());
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    const openModal = async (associate = null, terminationMode = false) => {
        setIsTerminationMode(terminationMode);
        setSelectedAssociate(associate);
        setSkillInput('');
        setSkillSuggestions([]);
        setShowSuggestions(false);
        setAssociateToTerminateId('');

        if (associate) {
            // Prepend '+' to phone if missing for display in form
            const formattedAssociate = { ...associate };
            if (formattedAssociate.phone && !formattedAssociate.phone.startsWith('+')) {
                formattedAssociate.phone = `+${formattedAssociate.phone}`;
            }
            reset(formattedAssociate);
            // Parse existing skills into array
            const existingSkills = associate.skills
                ? associate.skills.split(',').map(s => s.trim()).filter(s => s)
                : [];
            setSelectedSkills(existingSkills);
        } else {
            // Fetch next available ID for new associates
            let nextId = '';
            if (!terminationMode) {
                try {
                    const res = await associatesApi.getNextId();
                    nextId = res.data.next_id;
                } catch (err) {
                    console.error('Error fetching next ID:', err);
                }
            }
            // New or Termination Mode Start
            reset({
                associate_id: nextId,
                associate_name: '',
                role: 'Associate',
                status: terminationMode ? 'Inactive' : 'Active',
                gender: '',
                join_date: new Date().toISOString().split('T')[0],
                email: '',
                previous_experience_months: 0,
                company_experience_months: 0,
                department_id: '',
                designation_id: '',
                location: '',
                currency: 'INR',
                fixed_ctc: 0,
                bonus: 0,
                benefits: 0,
                skill_family: '',
                skills: '',
                profile_link: '',
                phone: '',
                address: '',
                city: '',
                state: '',
                country: '',
                postal_code: '',
                personal_email: '',
                national_id_type: '',
                national_id_number: '',
                national_id_proof: '',
                tax_id_type: '',
                tax_id_number: '',
                tax_id_proof: '',
                bank_account_number: '',
                bank_account_name: '',
                ifsc_code: '',
                drive_folder_id: '',
                dob: '',
                passport_number: '',
                passport_issue_country: '',
                passport_issue_date: '',
                passport_expiry_date: '',
                passport_proof: '',
                photo: '',
                resignation_submit_date: '',
                exit_date: '',
                exit_category: 'Voluntary',
                exit_reason: '',
                corporate_card_number: '',
                corporate_card_expiry: '',
                corporate_card_bank: ''
            });
            setSelectedSkills([]);
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedAssociate(null);
        setSelectedSkills([]);
        setIsTerminationMode(false);
        setAssociateToTerminateId('');
        reset();
    };

    const onInvalid = (errors) => {
        console.error('Validation errors:', errors);
        showToast('Please fix the validation errors before saving.', 'error');
    };

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            // Calculate totals (re-calculate in case)
            if (!isTerminationMode || (isTerminationMode && selectedAssociate)) {
                data.total_experience_months = (parseInt(data.previous_experience_months) || 0) + (parseInt(data.company_experience_months) || 0);
                const years = Math.floor(data.total_experience_months / 12);
                const months = data.total_experience_months % 12;
                data.experience_formatted = `${years}y ${months}m`;
                data.ctc = (parseFloat(data.fixed_ctc) || 0) + (parseFloat(data.bonus) || 0) + (parseFloat(data.benefits) || 0);
            }

            // Store skills as comma-separated string
            data.skills = selectedSkills.join(', ');

            // Strip '+' prefix from phone before storing in backend/google sheets
            if (data.phone) {
                data.phone = data.phone.replace(/^\+/, '').replace(/\s/g, '');
            }

            if (selectedAssociate) {
                await associatesApi.update(selectedAssociate.associate_id, data);
            } else {
                await associatesApi.create(data);
            }
            await loadAssociates();
            showToast(`Associate ${selectedAssociate ? 'updated' : 'created'} successfully!`, 'success');
            closeModal();
        } catch (error) {
            console.error('Error saving associate:', error);
            showToast(error.response?.data?.detail || 'Error saving associate', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (associate) => {
        if (!confirm(`Are you sure you want to delete ${associate.associate_name}?`)) return;

        try {
            await associatesApi.delete(associate.associate_id);
            await loadAssociates();
        } catch (error) {
            console.error('Error deleting associate:', error);
            showToast(error.response?.data?.detail || 'Error deleting associate', 'error');
        }
    };

    const associateLookup = useMemo(() => {
        const lookup = {};
        associates.forEach(a => {
            lookup[a.associate_id] = a.associate_name;
        });
        return lookup;
    }, [associates]);

    const columns = [
        { key: 'associate_id', label: 'ID' },
        { key: 'associate_name', label: 'Name' },
        // { key: 'email', label: 'Email' }, // Hidden
        {
            key: 'department_id',
            label: 'Department',
            render: (value) => {
                const dept = departments.find(d => d.department_id === value);
                return dept ? dept.department_name : (value || '-');
            }
        },
        {
            key: 'designation_id',
            label: 'Designation',
            render: (value) => {
                const role = roles.find(r => r.role_id === value);
                return role ? role.role_name : (value || '-');
            }
        },
        {
            key: 'manager_id',
            label: 'Manager',
            render: (value) => {
                const name = associateLookup[value];
                return name ? name : (value || '-');
            }
        },
        // {
        //     key: 'status',
        //     label: 'Status',
        //     render: (value) => (
        //         <span className={`badge ${value === 'Active' ? 'badge-success' : 'badge-gray'}`}>
        //             {value || '-'}
        //         </span>
        //     )
        // },
        {
            key: 'skill_family',
            label: 'Skill Family',
            render: (value) => value || '-'
        },
        {
            key: 'experience_formatted',
            label: 'Experience',
            render: (value) => value || '-'
        },
        {
            key: 'location',
            label: 'Location',
            render: (value) => {
                const loc = workLocations.find(l => l.work_location_id === value);
                return loc ? loc.name : (value || '-');
            }
        },
        // {
        //     key: 'ctc',
        //     label: 'CTC',
        //     render: (value, row) => {
        //         if (!value) return '-';
        //         // Use Indian locale for INR (lakhs/crores grouping)
        //         if (row.currency === 'INR') {
        //             return `₹${value.toLocaleString('en-IN')}`;
        //         } else if (row.currency === 'USD') {
        //             return `$${value.toLocaleString('en-US')}`;
        //         } else if (row.currency === 'EUR') {
        //             return `€${value.toLocaleString('de-DE')}`;
        //         }
        //         return value.toLocaleString();
        //     }
        // },
        {
            key: 'profile_link',
            label: 'Profile',
            render: (value) => value ? (
                <a href={value} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                    <ExternalLink size={14} />
                </a>
            ) : '-'
        }
    ];

    if (loading) return <Loading />;

    // Filter associates by status
    const filteredAssociates = statusFilter === 'All'
        ? associates
        : associates.filter(a => a.status === statusFilter);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Associates</h1>
                    <p className="page-subtitle">Manage your team members</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Filter size={16} style={{ color: 'var(--gray-500)' }} />
                        <select
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                        >
                            <option value="All">All Status</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="On Leave">On Leave</option>
                        </select>
                    </div>
                    {isHROrAdmin && (
                        <>
                            {/* Terminate Associate Button */}
                            <button
                                className="btn btn-danger"
                                onClick={() => openModal(null, true)}
                                style={{ backgroundColor: '#EF4444', borderColor: '#EF4444' }}
                            >
                                <UserMinus size={18} />
                                Terminate
                            </button>
                            <button className="btn btn-primary" onClick={() => openModal(null, false)}>
                                <Plus size={18} />
                                Add Associate
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <DataTable
                        columns={isHROrAdmin ? columns : columns.filter(c => c.key !== 'ctc')}
                        data={filteredAssociates}
                        searchFields={['associate_name', 'email', 'department_id', 'designation_id']}
                        actions={isHROrAdmin ? (row) => (
                            <>
                                <button className="btn btn-secondary btn-sm" onClick={() => openModal(row)}>
                                    <Edit2 size={14} />
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(row)}>
                                    <Trash2 size={14} />
                                </button>
                            </>
                        ) : null}
                    />
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={isTerminationMode ? 'Terminate Associate' : (selectedAssociate ? 'Edit Associate' : 'Add Associate')}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                        <button
                            className={`btn ${isTerminationMode ? 'btn-danger' : 'btn-primary'}`}
                            onClick={handleSubmit(onSubmit, onInvalid)}
                            disabled={saving}
                        >
                            {saving ? 'Processing...' : (isTerminationMode ? 'Terminate' : 'Save')}
                        </button>
                    </>
                }
            >
                <form>
                    {/* Termination Mode: Select Associate */}
                    {isTerminationMode && (
                        <div className="form-group" style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--gray-200)' }}>
                            <label className="form-label">Select Associate to Terminate *</label>
                            <select
                                className="form-select"
                                value={associateToTerminateId}
                                onChange={(e) => setAssociateToTerminateId(e.target.value)}
                            >
                                <option value="">Select Associate</option>
                                {associates.filter(a => a.status === 'Active').map(a => (
                                    <option key={a.associate_id} value={a.associate_id}>
                                        {a.associate_name} ({a.associate_id})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Only show termination fields if in termination mode AND associate selected */}
                    {isTerminationMode && associateToTerminateId && (
                        <>
                            <h4 style={{ color: 'var(--error-600)', marginBottom: '1rem' }}>Exit Details</h4>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Resignation Date</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        {...register('resignation_submit_date')}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Exit Date *</label>
                                    <input
                                        type="date"
                                        className={`form-input ${errors.exit_date ? 'input-error' : ''}`}
                                        {...register('exit_date', { required: isTerminationMode })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Exit Category *</label>
                                    <select
                                        className={`form-select ${errors.exit_category ? 'input-error' : ''}`}
                                        {...register('exit_category', { required: isTerminationMode })}
                                    >
                                        <option value="Voluntary">Voluntary</option>
                                        <option value="Involuntary">Involuntary</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Exit Reason *</label>
                                <textarea
                                    className={`form-input ${errors.exit_reason ? 'input-error' : ''}`}
                                    rows="3"
                                    {...register('exit_reason', { required: isTerminationMode })}
                                    placeholder="Please provide a reason for termination..."
                                ></textarea>
                            </div>

                            {/* Hidden fields to preserve data structure */}
                            <input type="hidden" {...register('status')} value="Inactive" />
                            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--warning-50)', color: 'var(--warning-700)', borderRadius: '0.375rem', fontSize: '0.875rem' }}>
                                <strong>Warning:</strong> This action will mark the associate as Inactive.
                            </div>
                        </>
                    )}

                    {/* Standard Form - Hidden in Termination Mode unless needed? Or just hidden completely 
                        Actually, if we are in termination mode, we probably ONLY want to show exit fields.
                        The rest of the form should be hidden or populated secretly.
                    */}
                    {!isTerminationMode && (
                        <>
                            <h4 style={{
                                marginTop: '1.5rem',
                                marginBottom: '1.25rem',
                                paddingBottom: '0.5rem',
                                borderBottom: '2px solid var(--primary-100)',
                                color: 'var(--primary-700)',
                                fontWeight: '600',
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span style={{ width: '4px', height: '18px', background: 'var(--primary-500)', borderRadius: '2px' }}></span>
                                Basic Information
                            </h4>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Associate ID *</label>
                                    <input
                                        className="form-input"
                                        {...register('associate_id', { required: true })}
                                        disabled
                                        style={{ backgroundColor: 'var(--gray-100)' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Name *</label>
                                    <input
                                        className={`form-input ${errors.associate_name ? 'input-error' : ''}`}
                                        {...register('associate_name', { required: 'Name is required' })}
                                    />
                                    {errors.associate_name && <span className="form-error">{errors.associate_name.message}</span>}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Email *</label>
                                    <input
                                        type="email"
                                        className={`form-input ${errors.email ? 'input-error' : ''}`}
                                        {...register('email', {
                                            required: 'Email is required',
                                            pattern: {
                                                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                                message: 'Invalid email address'
                                            }
                                        })}
                                    />
                                    {errors.email && <span className="form-error">{errors.email.message}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Role</label>
                                    <select className="form-select" {...register('role')}>
                                        <option value="Associate">Associate</option>
                                        <option value="Project Manager">Project Manager</option>
                                        <option value="Marketing Manager">Marketing Manager</option>
                                        <option value="Operations Manager">Operations Manager</option>
                                        <option value="HR">HR</option>
                                        <option value="Admin">Admin</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-select" {...register('status')}>
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                        <option value="On Leave">On Leave</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Gender *</label>
                                    <select className={`form-select ${errors.gender ? 'input-error' : ''}`} {...register('gender', { required: 'Gender is required' })}>
                                        <option value="">Select</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    {errors.gender && <span className="form-error">{errors.gender.message}</span>}
                                </div>
                            </div>

                            <h4 style={{
                                marginTop: '1.5rem',
                                marginBottom: '1.25rem',
                                paddingBottom: '0.5rem',
                                borderBottom: '2px solid var(--primary-100)',
                                color: 'var(--primary-700)',
                                fontWeight: '600',
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span style={{ width: '4px', height: '18px', background: 'var(--primary-500)', borderRadius: '2px' }}></span>
                                Organizational Details
                            </h4>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Department *</label>
                                    <select className={`form-select ${errors.department_id ? 'input-error' : ''}`} {...register('department_id', { required: 'Department is required' })}>
                                        <option value="">Select Department</option>
                                        {departments.map(dept => (
                                            <option key={dept.department_id} value={dept.department_id}>
                                                {dept.department_name}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.department_id && <span className="form-error">{errors.department_id.message}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Designation *</label>
                                    <select
                                        className={`form-select ${errors.designation_id ? 'input-error' : ''}`}
                                        {...register('designation_id', { required: 'Designation is required' })}
                                        disabled={!watchDepartmentId}
                                    >
                                        <option value="">Select Designation</option>
                                        {filteredRoles.map(role => (
                                            <option key={role.role_id} value={role.role_id}>
                                                {role.role_name}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.designation_id && <span className="form-error">{errors.designation_id.message}</span>}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Manager *</label>
                                    <select className={`form-select ${errors.manager_id ? 'input-error' : ''}`} {...register('manager_id', { required: 'Manager is required' })}>
                                        <option value="">Select Manager</option>
                                        {managerOptions.map(m => (
                                            <option key={m.associate_id} value={m.associate_id}>
                                                {m.associate_name}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.manager_id && <span className="form-error">{errors.manager_id.message}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Work Location *</label>
                                    <select
                                        className={`form-select ${errors.location ? 'input-error' : ''}`}
                                        {...register('location', { required: 'Work location is required' })}
                                    >
                                        <option value="">Select Work Location</option>
                                        {workLocations.map(loc => (
                                            <option key={loc.work_location_id} value={loc.work_location_id}>
                                                {loc.name}{loc.state ? `, ${loc.state}` : ''}{loc.country ? `, ${loc.country}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.location && <span className="form-error">{errors.location.message}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Join Date</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        {...register('join_date')}
                                    />
                                </div>
                            </div>

                            <h4 style={{
                                marginTop: '1.5rem',
                                marginBottom: '1.25rem',
                                paddingBottom: '0.5rem',
                                borderBottom: '2px solid var(--primary-100)',
                                color: 'var(--primary-700)',
                                fontWeight: '600',
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span style={{ width: '4px', height: '18px', background: 'var(--primary-500)', borderRadius: '2px' }}></span>
                                Skills & Background
                            </h4>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Skill Family (optional filter)</label>
                                    <select className="form-select" {...register('skill_family')}>
                                        <option value="">All Skill Families</option>
                                        {skillFamilies.map(family => (
                                            <option key={family} value={family}>{family}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Previous Experience (Months)</label>
                                    <input
                                        type="number"
                                        className={`form-input ${errors.previous_experience_months ? 'input-error' : ''}`}
                                        {...register('previous_experience_months', { min: { value: 0, message: 'Must be 0 or greater' } })}
                                    />
                                    {errors.previous_experience_months && <span className="form-error">{errors.previous_experience_months.message}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Company Experience (Months)</label>
                                    <input
                                        type="number"
                                        className={`form-input ${errors.company_experience_months ? 'input-error' : ''}`}
                                        {...register('company_experience_months', { min: { value: 0, message: 'Must be 0 or greater' } })}
                                    />
                                    {errors.company_experience_months && <span className="form-error">{errors.company_experience_months.message}</span>}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Add Skills</label>
                                <div className="skill-input-container">
                                    <input
                                        ref={skillInputRef}
                                        type="text"
                                        className="form-input"
                                        placeholder="Type to search skills... (press Enter to add)"
                                        value={skillInput}
                                        onChange={(e) => setSkillInput(e.target.value)}
                                        onKeyDown={handleSkillKeyDown}
                                        onFocus={() => skillInput && setShowSuggestions(skillSuggestions.length > 0)}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    />
                                    {showSuggestions && (
                                        <div className="skill-suggestions">
                                            {skillSuggestions.map(skill => (
                                                <div
                                                    key={skill}
                                                    className="skill-suggestion-item"
                                                    onClick={() => addSkill(skill)}
                                                >
                                                    {skill}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {selectedSkills.length > 0 && (
                                <div className="form-group">
                                    <label className="form-label">Selected Skills</label>
                                    <div className="skill-chips">
                                        {selectedSkills.map(skill => (
                                            <span key={skill} className="skill-chip skill-chip-selected">
                                                {skill}
                                                <X size={12} style={{ marginLeft: '4px', cursor: 'pointer' }} onClick={() => setSelectedSkills(prev => prev.filter(s => s !== skill))} />
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <h4 style={{
                                marginTop: '1.5rem',
                                marginBottom: '1.25rem',
                                paddingBottom: '0.5rem',
                                borderBottom: '2px solid var(--primary-100)',
                                color: 'var(--primary-700)',
                                fontWeight: '600',
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span style={{ width: '4px', height: '18px', background: 'var(--primary-500)', borderRadius: '2px' }}></span>
                                Identity & Proofs
                            </h4>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">National ID Type</label>
                                    <select className="form-select" {...register('national_id_type')}>
                                        <option value="">Select</option>
                                        <option value="Aadhaar">Aadhaar (India)</option>
                                        <option value="SSN">SSN (US)</option>
                                        <option value="National ID">National ID (Other)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">National ID Number</label>
                                    <input
                                        className={`form-input ${errors.national_id_number ? 'input-error' : ''}`}
                                        {...register('national_id_number', {
                                            validate: (value) => {
                                                if (!value) return true;
                                                const type = watch('national_id_type');
                                                if (type === 'Aadhaar') {
                                                    return /^\d{12}$/.test(value) || 'Aadhaar must be 12 digits';
                                                }
                                                return true;
                                            }
                                        })}
                                        placeholder="Enter ID number"
                                    />
                                    {errors.national_id_number && <span className="form-error">{errors.national_id_number.message}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">National ID Proof</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        {selectedAssociate?.national_id_proof ? (
                                            <a href={watch('national_id_proof')} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                                                <ExternalLink size={14} /> View
                                            </a>
                                        ) : null}
                                        <label
                                            className="btn btn-secondary btn-sm"
                                            style={{
                                                cursor: !selectedAssociate ? 'not-allowed' : 'pointer',
                                                margin: 0,
                                                opacity: !selectedAssociate ? 0.6 : 1
                                            }}
                                            title={!selectedAssociate ? "Please save the associate first to upload proof" : "Upload Proof"}
                                        >
                                            <Upload size={14} />
                                            {uploadingProof === 'national_id' ? ' Uploading...' : ' Upload'}
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                style={{ display: 'none' }}
                                                disabled={!selectedAssociate || uploadingProof === 'national_id'}
                                                onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file || !selectedAssociate) return;
                                                    setUploadingProof('national_id');
                                                    try {
                                                        const res = await associatesApi.uploadProof(selectedAssociate.associate_id, 'national_id', file);
                                                        setValue('national_id_proof', res.data.drive_link);
                                                        showToast('National ID proof uploaded successfully!', 'success');
                                                    } catch (err) {
                                                        console.error('Upload failed:', err);
                                                        showToast('Upload failed: ' + (err.response?.data?.detail || err.message), 'error');
                                                    } finally {
                                                        setUploadingProof(null);
                                                        e.target.value = '';
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Tax ID Type</label>
                                    <select className="form-select" {...register('tax_id_type')}>
                                        <option value="">Select</option>
                                        <option value="PAN">PAN (India)</option>
                                        <option value="Tax ID">Tax ID (Other)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tax ID Number</label>
                                    <input
                                        className={`form-input ${errors.tax_id_number ? 'input-error' : ''}`}
                                        {...register('tax_id_number', {
                                            validate: (value) => {
                                                if (!value) return true;
                                                const type = watch('tax_id_type');
                                                if (type === 'PAN') {
                                                    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value) || 'Invalid PAN format';
                                                }
                                                return true;
                                            }
                                        })}
                                        placeholder="Enter Tax ID"
                                    />
                                    {errors.tax_id_number && <span className="form-error">{errors.tax_id_number.message}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tax ID Proof</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        {selectedAssociate?.tax_id_proof ? (
                                            <a href={watch('tax_id_proof')} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                                                <ExternalLink size={14} /> View
                                            </a>
                                        ) : null}
                                        <label
                                            className="btn btn-secondary btn-sm"
                                            style={{
                                                cursor: !selectedAssociate ? 'not-allowed' : 'pointer',
                                                margin: 0,
                                                opacity: !selectedAssociate ? 0.6 : 1
                                            }}
                                            title={!selectedAssociate ? "Please save the associate first to upload proof" : "Upload Proof"}
                                        >
                                            <Upload size={14} />
                                            {uploadingProof === 'tax_id' ? ' Uploading...' : ' Upload'}
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                style={{ display: 'none' }}
                                                disabled={!selectedAssociate || uploadingProof === 'tax_id'}
                                                onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file || !selectedAssociate) return;
                                                    setUploadingProof('tax_id');
                                                    try {
                                                        const res = await associatesApi.uploadProof(selectedAssociate.associate_id, 'tax_id', file);
                                                        setValue('tax_id_proof', res.data.drive_link);
                                                        showToast('Tax ID proof uploaded successfully!', 'success');
                                                    } catch (err) {
                                                        console.error('Upload failed:', err);
                                                        showToast('Upload failed: ' + (err.response?.data?.detail || err.message), 'error');
                                                    } finally {
                                                        setUploadingProof(null);
                                                        e.target.value = '';
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Passport Number</label>
                                    <input className="form-input" {...register('passport_number')} placeholder="Passport No." />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Issue Country</label>
                                    <input className="form-input" {...register('passport_issue_country')} placeholder="Country" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Passport Proof</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        {selectedAssociate?.passport_proof ? (
                                            <a href={watch('passport_proof')} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                                                <ExternalLink size={14} /> View
                                            </a>
                                        ) : null}
                                        <label
                                            className="btn btn-secondary btn-sm"
                                            style={{
                                                cursor: !selectedAssociate ? 'not-allowed' : 'pointer',
                                                margin: 0,
                                                opacity: !selectedAssociate ? 0.6 : 1
                                            }}
                                            title={!selectedAssociate ? "Please save the associate first to upload proof" : "Upload Passport"}
                                        >
                                            <Upload size={14} />
                                            {uploadingProof === 'passport' ? ' Uploading...' : ' Upload'}
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                style={{ display: 'none' }}
                                                disabled={!selectedAssociate || uploadingProof === 'passport'}
                                                onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file || !selectedAssociate) return;
                                                    setUploadingProof('passport');
                                                    try {
                                                        const res = await associatesApi.uploadProof(selectedAssociate.associate_id, 'passport', file);
                                                        setValue('passport_proof', res.data.drive_link);
                                                        showToast('Passport proof uploaded successfully!', 'success');
                                                    } catch (err) {
                                                        console.error('Upload failed:', err);
                                                        showToast('Upload failed: ' + (err.response?.data?.detail || err.message), 'error');
                                                    } finally {
                                                        setUploadingProof(null);
                                                        e.target.value = '';
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Issue Date</label>
                                    <input type="date" className="form-input" {...register('passport_issue_date')} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Expiry Date</label>
                                    <input type="date" className="form-input" {...register('passport_expiry_date')} />
                                </div>
                            </div>

                            <h4 style={{
                                marginTop: '1.5rem',
                                marginBottom: '1.25rem',
                                paddingBottom: '0.5rem',
                                borderBottom: '2px solid var(--primary-100)',
                                color: 'var(--primary-700)',
                                fontWeight: '600',
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span style={{ width: '4px', height: '18px', background: 'var(--primary-500)', borderRadius: '2px' }}></span>
                                Contact & Social
                            </h4>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Date of Birth</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        {...register('dob')}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Address</label>
                                    <textarea
                                        className="form-input"
                                        rows="2"
                                        {...register('address')}
                                        placeholder="Street address..."
                                    ></textarea>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Photo</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            {selectedAssociate?.photo ? (
                                                <div style={{ position: 'relative', width: '40px', height: '40px' }}>
                                                    <img
                                                        src={getDriveDirectLink(watch('photo'))}
                                                        alt="Profile"
                                                        referrerPolicy="no-referrer"
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', border: '2px solid var(--gray-200)' }}
                                                        onError={(e) => { e.target.style.display = 'none' }}
                                                    />
                                                    <label
                                                        title="Change Photo"
                                                        style={{
                                                            position: 'absolute',
                                                            bottom: -2,
                                                            right: -2,
                                                            background: 'white',
                                                            borderRadius: '50%',
                                                            padding: '2px',
                                                            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                                            cursor: 'pointer',
                                                            border: '1px solid var(--gray-200)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                    >
                                                        <Edit2 size={10} color="var(--gray-600)" />
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            style={{ display: 'none' }}
                                                            disabled={uploadingProof === 'photo'}
                                                            onChange={async (e) => {
                                                                const file = e.target.files[0];
                                                                if (!file || !selectedAssociate) return;
                                                                setUploadingProof('photo');
                                                                try {
                                                                    const res = await associatesApi.uploadProof(selectedAssociate.associate_id, 'photo', file);
                                                                    setValue('photo', res.data.drive_link);
                                                                    showToast('Photo updated successfully!', 'success');
                                                                } catch (err) {
                                                                    console.error('Upload failed:', err);
                                                                    showToast('Upload failed: ' + (err.response?.data?.detail || err.message), 'error');
                                                                } finally {
                                                                    setUploadingProof(null);
                                                                    e.target.value = '';
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                            ) : (
                                                <label
                                                    className="btn btn-secondary btn-sm"
                                                    style={{
                                                        cursor: !selectedAssociate ? 'not-allowed' : 'pointer',
                                                        margin: 0,
                                                        opacity: !selectedAssociate ? 0.6 : 1
                                                    }}
                                                    title={!selectedAssociate ? "Please save the associate first to upload photo" : "Upload Photo"}
                                                >
                                                    <Upload size={14} />
                                                    {uploadingProof === 'photo' ? ' Uploading...' : ' Photo'}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        style={{ display: 'none' }}
                                                        disabled={!selectedAssociate || uploadingProof === 'photo'}
                                                        onChange={async (e) => {
                                                            const file = e.target.files[0];
                                                            if (!file || !selectedAssociate) return;
                                                            setUploadingProof('photo');
                                                            try {
                                                                const res = await associatesApi.uploadProof(selectedAssociate.associate_id, 'photo', file);
                                                                setValue('photo', res.data.drive_link);
                                                                showToast('Photo uploaded successfully!', 'success');
                                                            } catch (err) {
                                                                console.error('Upload failed:', err);
                                                                showToast('Upload failed: ' + (err.response?.data?.detail || err.message), 'error');
                                                            } finally {
                                                                setUploadingProof(null);
                                                                e.target.value = '';
                                                            }
                                                        }}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">City</label>
                                    <input className="form-input" {...register('city')} placeholder="City" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Country *</label>
                                    <select
                                        className={`form-select ${errors.country ? 'input-error' : ''}`}
                                        {...register('country', { required: 'Country is required' })}
                                    >
                                        <option value="">Select Country</option>
                                        {Object.keys(COUNTRIES).map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                    {errors.country && <span className="form-error">{errors.country.message}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">State *</label>
                                    <select
                                        className={`form-select ${errors.state ? 'input-error' : ''}`}
                                        {...register('state', { required: 'State is required' })}
                                        disabled={!watchCountry}
                                    >
                                        <option value="">Select State</option>
                                        {watchCountry && COUNTRIES[watchCountry]?.states.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                    {errors.state && <span className="form-error">{errors.state.message}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Postal Code</label>
                                    <input className="form-input" {...register('postal_code')} placeholder="ZIP/Postal Code" />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Personal Email *</label>
                                    <input
                                        type="email"
                                        className={`form-input ${errors.personal_email ? 'input-error' : ''}`}
                                        placeholder="personal@email.com"
                                        {...register('personal_email', {
                                            required: 'Personal email is required',
                                            pattern: {
                                                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                                message: 'Invalid email address'
                                            }
                                        })}
                                    />
                                    {errors.personal_email && <span className="form-error">{errors.personal_email.message}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone *</label>
                                    <input
                                        className={`form-input ${errors.phone ? 'input-error' : ''}`}
                                        placeholder="+91 1234567890"
                                        {...register('phone', {
                                            required: 'Phone number is required',
                                            pattern: {
                                                value: /^\+\d{1,4}\s?\d{6,14}$/,
                                                message: 'Invalid format. Use +<code > <number>'
                                            }
                                        })}
                                    />
                                    {errors.phone && <span className="form-error">{errors.phone.message}</span>}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Profile Link (Google Drive)</label>
                                    <input
                                        className="form-input"
                                        placeholder="https://drive.google.com/..."
                                        {...register('profile_link')}
                                    />
                                </div>
                                {selectedAssociate?.drive_folder_id && (
                                    <div className="form-group">
                                        <label className="form-label">Drive Folder</label>
                                        <a
                                            href={`https://drive.google.com/drive/folders/${watch('drive_folder_id')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-secondary btn-sm"
                                            style={{ display: 'inline-flex', marginTop: '4px' }}
                                        >
                                            <ExternalLink size={14} /> View Folder
                                        </a>
                                    </div>
                                )}
                            </div>

                            <h4 style={{
                                marginTop: '1.5rem',
                                marginBottom: '1.25rem',
                                paddingBottom: '0.5rem',
                                borderBottom: '2px solid var(--primary-100)',
                                color: 'var(--primary-700)',
                                fontWeight: '600',
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span style={{ width: '4px', height: '18px', background: 'var(--primary-500)', borderRadius: '2px' }}></span>
                                Corporate Card Details
                            </h4>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Corporate Card Number</label>
                                    <input
                                        className="form-input"
                                        {...register('corporate_card_number')}
                                        placeholder="Card Number"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Corporate Card Expiry</label>
                                    <input
                                        type="month"
                                        className="form-input"
                                        {...register('corporate_card_expiry')}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Corporate Card Bank</label>
                                    <input
                                        className="form-input"
                                        {...register('corporate_card_bank')}
                                        placeholder="Bank Name"
                                    />
                                </div>
                            </div>

                            <h4 style={{
                                marginTop: '1.5rem',
                                marginBottom: '1.25rem',
                                paddingBottom: '0.5rem',
                                borderBottom: '2px solid var(--primary-100)',
                                color: 'var(--primary-700)',
                                fontWeight: '600',
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span style={{ width: '4px', height: '18px', background: 'var(--primary-500)', borderRadius: '2px' }}></span>
                                Banking Details
                            </h4>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Bank Account Number</label>
                                    <input
                                        className="form-input"
                                        {...register('bank_account_number')}
                                        placeholder="Account Number"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Bank Account Name</label>
                                    <input
                                        className="form-input"
                                        {...register('bank_account_name')}
                                        placeholder="Name as per bank"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">IFSC Code</label>
                                    <input
                                        className={`form-input ${errors.ifsc_code ? 'input-error' : ''}`}
                                        {...register('ifsc_code', {
                                            pattern: {
                                                value: /^[A-Z]{4}0[A-Z0-9]{6}$/,
                                                message: 'Invalid IFSC format'
                                            }
                                        })}
                                        placeholder="IFSC Code"
                                    />
                                    {errors.ifsc_code && <span className="form-error">{errors.ifsc_code.message}</span>}
                                </div>
                            </div>

                            <h4 style={{
                                marginTop: '1.5rem',
                                marginBottom: '1.25rem',
                                paddingBottom: '0.5rem',
                                borderBottom: '2px solid var(--primary-100)',
                                color: 'var(--primary-700)',
                                fontWeight: '600',
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span style={{ width: '4px', height: '18px', background: 'var(--primary-500)', borderRadius: '2px' }}></span>
                                Salary Details
                            </h4>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Currency</label>
                                    <select className="form-select" {...register('currency')}>
                                        <option value="INR">INR (₹)</option>
                                        <option value="USD">USD ($)</option>
                                        <option value="EUR">EUR (€)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fixed CTC</label>
                                    <input
                                        type="number"
                                        className={`form-input ${errors.fixed_ctc ? 'input-error' : ''}`}
                                        {...register('fixed_ctc', { min: { value: 0, message: 'Must be 0 or greater' } })}
                                    />
                                    {errors.fixed_ctc && <span className="form-error">{errors.fixed_ctc.message}</span>}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Bonus</label>
                                    <input
                                        type="number"
                                        className={`form-input ${errors.bonus ? 'input-error' : ''}`}
                                        {...register('bonus', { min: { value: 0, message: 'Must be 0 or greater' } })}
                                    />
                                    {errors.bonus && <span className="form-error">{errors.bonus.message}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Benefits</label>
                                    <input
                                        type="number"
                                        className={`form-input ${errors.benefits ? 'input-error' : ''}`}
                                        {...register('benefits', { min: { value: 0, message: 'Must be 0 or greater' } })}
                                    />
                                    {errors.benefits && <span className="form-error">{errors.benefits.message}</span>}
                                </div>
                            </div>
                        </>
                    )}
                </form>
            </Modal>
        </div>
    );
}

export default Associates;
