import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../contexts/AuthContext';
import { associatesApi, organizationApi } from '../../services/api';
import Loading from '../../components/common/Loading';
import {
    User, Mail, Briefcase, MapPin, Phone, Calendar,
    Edit2, Save, X, Globe, Award, Shield, Clock,
    CheckCircle2, Building2, ExternalLink, Camera
} from 'lucide-react';
import { getDriveDirectLink } from '../../utils/driveUtils';

function Profile() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [editingSection, setEditingSection] = useState(null);
    const [saving, setSaving] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [roles, setRoles] = useState([]);
    const { register, handleSubmit, reset } = useForm();

    const deptMap = useMemo(() => {
        const map = {};
        departments.forEach(d => { map[d.department_id] = d.department_name; });
        return map;
    }, [departments]);

    const roleMap = useMemo(() => {
        const map = {};
        roles.forEach(r => { map[r.role_id] = r.role_name; });
        return map;
    }, [roles]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [deptRes, roleRes] = await Promise.all([
                    organizationApi.getDepartments(),
                    organizationApi.getRoles()
                ]);
                setDepartments(deptRes.data || []);
                setRoles(roleRes.data || []);
            } catch (error) {
                console.error('Error fetching organization data:', error);
            }
        };
        fetchInitialData();
    }, []);

    const loadProfile = useCallback(async () => {
        try {
            const response = await associatesApi.getById(user.associate_id);
            setProfile(response.data);
            reset(response.data);
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    }, [user.associate_id, reset]);

    useEffect(() => {
        if (user) {
            loadProfile();
        }
    }, [user, loadProfile]);

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSaving(true);
        try {
            await associatesApi.uploadProof(profile.associate_id, 'photo', file);
            await loadProfile();
        } catch (error) {
            console.error('Error uploading photo:', error);
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (amount, currency = 'INR') => {
        if (amount === undefined || amount === null) return '0';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const handleSave = async (data, section) => {
        setSaving(true);
        try {
            let updates = {};
            if (section === 'contact') {
                updates = {
                    phone: data.phone,
                    address: data.address,
                    city: data.city,
                    state: data.state,
                    country: data.country,
                    postal_code: data.postal_code,
                    personal_email: data.personal_email,
                    dob: data.dob,
                    profile_link: data.profile_link
                };
            } else if (section === 'skills') {
                updates = {
                    skills: data.skills
                };
            } else if (section === 'banking') {
                updates = {
                    bank_account_number: data.bank_account_number,
                    bank_account_name: data.bank_account_name,
                    ifsc_code: data.ifsc_code
                };
            } else if (section === 'identity') {
                updates = {
                    national_id_type: data.national_id_type,
                    national_id_number: data.national_id_number,
                    tax_id_type: data.tax_id_type,
                    tax_id_number: data.tax_id_number,
                    passport_number: data.passport_number,
                    passport_issue_country: data.passport_issue_country,
                    passport_issue_date: data.passport_issue_date,
                    passport_expiry_date: data.passport_expiry_date
                };
            }

            await associatesApi.update(profile.associate_id, updates);
            await loadProfile();
            setEditingSection(null);
        } catch (error) {
            console.error('Error updating profile:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        reset(profile);
        setEditingSection(null);
    };

    if (loading) return <Loading />;
    if (!profile) return <div className="p-8 text-center text-gray-500">Profile not found.</div>;

    const renderSectionActions = (sectionName) => {
        const isCurrentSectionEditing = editingSection === sectionName;
        return (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!isCurrentSectionEditing ? (
                    <button
                        className="premium-edit-btn"
                        onClick={() => setEditingSection(sectionName)}
                        title="Edit Section"
                    >
                        <Edit2 size={14} />
                    </button>
                ) : (
                    <>
                        <button
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                padding: '0.5rem 0.875rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                background: 'white',
                                color: '#64748b',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                            onClick={handleCancel}
                            disabled={saving}
                        >
                            <X size={14} />
                            Cancel
                        </button>
                        <button
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                padding: '0.5rem 0.875rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                background: 'var(--primary-600)',
                                color: 'white',
                                border: 'none',
                                boxShadow: '0 1px 3px rgba(0,102,179,0.3)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                            onClick={handleSubmit((data) => handleSave(data, sectionName))}
                            disabled={saving}
                        >
                            <Save size={14} />
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </>
                )}
            </div>
        );
    };

    const renderField = (label, value, icon, name, isEditable = false, textarea = false, sectionName = '') => {
        const isEditing = editingSection === sectionName && isEditable;

        return (
            <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    {label}
                </label>
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    ...(isEditing ? { background: '#f8fafc', padding: '0.75rem', margin: '-0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' } : {}),
                    transition: 'all 0.15s ease'
                }}>
                    {icon && (
                        <div style={{
                            marginTop: '0.125rem',
                            color: isEditing ? 'var(--primary-500)' : '#94a3b8',
                            flexShrink: 0
                        }}>
                            {icon}
                        </div>
                    )}

                    {isEditing ? (
                        textarea ? (
                            <textarea
                                {...register(name)}
                                className="form-textarea profile-edit-input"
                                rows={3}
                                placeholder={`Enter ${label}`}
                            />
                        ) : (
                            <input
                                {...register(name)}
                                className="form-input profile-edit-input"
                                placeholder={`Enter ${label}`}
                            />
                        )
                    ) : (
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b', wordBreak: 'break-word', flex: 1 }}>
                            {value || <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontWeight: 'normal' }}>Not provided</span>}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto pb-8">
            <div className="page-header" style={{ marginBottom: '2.5rem' }}>
                <div>
                    <h1 className="page-title">My Profile</h1>
                    <p className="page-subtitle" style={{ marginTop: '0.5rem' }}>Manage your personal information</p>
                </div>
            </div>

            {/* Name Header Section - Blue Background with Profile Photo */}
            <div className="card" style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
                <div style={{
                    background: 'linear-gradient(135deg, #0066b3 0%, #0080cc 50%, #5cc8e6 100%)',
                    padding: '2.5rem 2rem',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2rem'
                }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            border: '4px solid rgba(255,255,255,0.3)',
                            overflow: 'hidden',
                            background: 'rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {profile.photo ? (
                                <img
                                    src={getDriveDirectLink(profile.photo)}
                                    alt={profile.associate_name}
                                    referrerPolicy="no-referrer"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <User size={60} color="rgba(255,255,255,0.5)" />
                            )}
                        </div>
                        <label
                            style={{
                                position: 'absolute',
                                bottom: '0',
                                right: '0',
                                width: '36px',
                                height: '36px',
                                background: 'white',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                transition: 'all 0.2s ease',
                                border: 'none'
                            }}
                            title="Update Profile Photo"
                        >
                            <Camera size={18} color="var(--primary-600)" />
                            <input
                                type="file"
                                onChange={handlePhotoUpload}
                                style={{ display: 'none' }}
                                accept="image/*"
                                disabled={saving}
                            />
                        </label>
                    </div>

                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: '800', color: 'white', marginBottom: '0.25rem', letterSpacing: '-0.01em' }}>
                            {profile.associate_name}
                        </h2>
                        <div style={{
                            fontSize: '1.1rem',
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}>
                            <span style={{ background: 'rgba(255,255,255,0.15)', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.875rem' }}>
                                {roleMap[profile.designation_id] || profile.designation_id}
                            </span>
                            <span style={{ opacity: 0.6 }}>•</span>
                            <span>{deptMap[profile.department_id] || profile.department_id}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Professional Information */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-700)' }}>
                            <Briefcase size={18} style={{ color: 'var(--primary-600)' }} />
                            Professional Information
                        </h3>
                    </div>
                    <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                        {renderField("Employee ID", profile.associate_id, <User size={16} />, "associate_id")}
                        {renderField("Department", deptMap[profile.department_id] || profile.department_id, <Building2 size={16} />, "department_id")}
                        {renderField("Designation", roleMap[profile.designation_id] || profile.designation_id, <Award size={16} />, "designation_id")}
                        {renderField("Work Location", profile.location, <MapPin size={16} />, "location")}
                        {renderField("Reporting Manager", profile.manager_id ? `${profile.manager_id}` : "Not Assigned", <User size={16} />, "manager_id")}
                        {renderField("Skill Family", profile.skill_family, <Globe size={16} />, "skill_family")}
                    </div>
                </div>

                {/* Experience Section */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-700)' }}>
                            <Clock size={18} style={{ color: 'var(--primary-600)' }} />
                            Experience & Tenure
                        </h3>
                    </div>
                    <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                        {renderField("Date of Joining", profile.join_date, <Calendar size={16} />, "join_date")}
                        {renderField("Company Exp", `${profile.company_experience_months} months`, <Building2 size={16} />, "company_exp")}
                        {renderField("Total Experience", profile.experience_formatted, <Award size={16} />, "total_exp")}
                    </div>
                </div>

                {/* Skills */}
                <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-700)' }}>
                            <CheckCircle2 size={18} style={{ color: 'var(--primary-600)' }} />
                            Skills & Competencies
                        </h3>
                        {renderSectionActions('skills')}
                    </div>
                    <div className="card-body">
                        {editingSection === 'skills' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                                <textarea
                                    {...register('skills')}
                                    className="form-textarea profile-edit-input"
                                    rows={4}
                                    placeholder="Enter skills separated by commas..."
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b', background: 'rgba(255,255,255,0.5)', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}>
                                    <Globe size={14} style={{ color: 'var(--primary-500)' }} />
                                    <span>Separate skills with commas (e.g., Python, React, SQL)</span>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {profile.skills ? (
                                    profile.skills.split(',').map((skill, index) => (
                                        <span key={index} style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '0.375rem 0.75rem',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: '600',
                                            background: 'var(--primary-50)',
                                            color: 'var(--primary-700)',
                                            border: '1px solid var(--primary-100)'
                                        }}>
                                            {skill.trim()}
                                        </span>
                                    ))
                                ) : (
                                    <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontWeight: 'normal' }}>No skills provided.</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Contact Details */}
                <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-700)' }}>
                            <Mail size={18} style={{ color: 'var(--primary-600)' }} />
                            Contact Details
                        </h3>
                        {renderSectionActions('contact')}
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                            {renderField("Work Email", profile.email, <Mail size={16} />, "email", false, false, 'contact')}
                            {renderField("Personal Email", profile.personal_email, <Mail size={16} />, "personal_email", true, false, 'contact')}
                            {renderField("Phone Number", profile.phone, <Phone size={16} />, "phone", true, false, 'contact')}
                            {renderField("Date of Birth", profile.dob, <Calendar size={16} />, "dob", true, false, 'contact')}
                        </div>

                        <div style={{ marginTop: '1.5rem' }}>
                            {renderField("Street Address", profile.address, <MapPin size={16} />, "address", true, true, 'contact')}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginTop: '1rem' }}>
                                {renderField("City", profile.city, null, "city", true, false, 'contact')}
                                {renderField("State", profile.state, null, "state", true, false, 'contact')}
                                {renderField("Country", profile.country, null, "country", true, false, 'contact')}
                                {renderField("Postal Code", profile.postal_code, null, "postal_code", true, false, 'contact')}
                            </div>
                        </div>

                        <div style={{ marginTop: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
                                Profile Link
                            </label>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{ marginTop: '0.125rem', color: editingSection === 'contact' ? 'var(--primary-500)' : '#94a3b8' }}><Globe size={16} /></div>
                                {editingSection === 'contact' ? (
                                    <input
                                        {...register('profile_link')}
                                        className="form-input profile-edit-input"
                                        placeholder="https://..."
                                    />
                                ) : (
                                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b', wordBreak: 'break-all', flex: 1 }}>
                                        {profile.profile_link ? (
                                            <a href={profile.profile_link} target="_blank" rel="noreferrer" style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                Open Link <ExternalLink size={12} />
                                            </a>
                                        ) : (
                                            <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontWeight: 'normal' }}>Not provided</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Identity Information */}
                <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-700)' }}>
                            <Shield size={18} style={{ color: 'var(--primary-600)' }} />
                            Identity Information
                        </h3>
                        {renderSectionActions('identity')}
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                            {renderField(`${profile.national_id_type || 'National'} ID Number`, profile.national_id_number, <Shield size={16} />, "national_id_number", true, false, 'identity')}
                            {renderField(`${profile.tax_id_type || 'Tax'} ID Number`, profile.tax_id_number, <CheckCircle2 size={16} />, "tax_id_number", true, false, 'identity')}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginTop: '1.5rem' }}>
                            {renderField("Passport Number", profile.passport_number, <Globe size={16} />, "passport_number", true, false, 'identity')}
                            {renderField("Issue Country", profile.passport_issue_country, <MapPin size={16} />, "passport_issue_country", true, false, 'identity')}
                            {renderField("Passport Issue Date", profile.passport_issue_date, <Calendar size={16} />, "passport_issue_date", true, false, 'identity')}
                            {renderField("Passport Expiry Date", profile.passport_expiry_date, <Calendar size={16} />, "passport_expiry_date", true, false, 'identity')}
                        </div>
                    </div>
                </div>

                {/* Banking Details */}
                <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-700)' }}>
                            <Building2 size={18} style={{ color: 'var(--primary-600)' }} />
                            Banking Details
                        </h3>
                        {renderSectionActions('banking')}
                    </div>
                    <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                        {renderField("Account Number", profile.bank_account_number, <Shield size={16} />, "bank_account_number", true, false, 'banking')}
                        {renderField("Account Name", profile.bank_account_name, <User size={16} />, "bank_account_name", true, false, 'banking')}
                        {renderField("IFSC Code", profile.ifsc_code, <Building2 size={16} />, "ifsc_code", true, false, 'banking')}
                    </div>
                </div>

                {/* Salary Details (Read-only for Associate) */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-700)' }}>
                            <Award size={18} style={{ color: 'var(--primary-600)' }} />
                            Salary Details (Read-only)
                        </h3>
                    </div>
                    <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                        {renderField("Fixed CTC", formatCurrency(profile.fixed_ctc, profile.currency), null, "fixed_ctc")}
                        {renderField("Bonus", formatCurrency(profile.bonus, profile.currency), null, "bonus")}
                        {renderField("Benefits", formatCurrency(profile.benefits, profile.currency), null, "benefits")}
                    </div>
                </div>

            </div>
        </div>
    );
}

export default Profile;
