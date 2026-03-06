import { useState, useEffect } from 'react';
import { Save, CalendarRange, Plus, Settings2, Trash2, Info, ChevronRight, CheckCircle2, PartyPopper, Edit3, X, Calendar, Users, CalendarDays, Search, Upload, Download } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { settingsApi } from '../../services/api';
import Modal from '../../components/common/Modal';

const HOLIDAY_TYPES = [
    { value: 'National', color: '#dc2626', bg: '#fef2f2' },
    { value: 'Regional', color: '#d97706', bg: '#fef3c7' },
    { value: 'Company', color: '#2563eb', bg: '#dbeafe' },
    { value: 'Optional', color: '#16a34a', bg: '#dcfce7' },
];

const EMPTY_HOLIDAY = {
    name: '', date: '', holiday_type: 'Company',
    applicable_to: 'All', year: new Date().getFullYear(),
    description: ''
};

const LeaveSetup = () => {
    const { showToast } = useToast();
    const [groups, setGroups] = useState([]);
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [entitlements, setEntitlements] = useState([]);
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('groups');
    const [selectedType, setSelectedType] = useState(null);
    const [saving, setSaving] = useState(false);

    // Modal state
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [groupForm, setGroupForm] = useState({ code: '', name: '', description: '', attachmentMandatory: 'No' });
    const [showTypeModal, setShowTypeModal] = useState(false);
    const [typeForm, setTypeForm] = useState({ code: '', name: '', group_id: '', isLeave: 'Yes', payType: 'PAID', active: true, isAdjustable: false });
    const [typeSearch, setTypeSearch] = useState('');

    // Entitlement modal state
    const [showEntitlementModal, setShowEntitlementModal] = useState(false);
    const [entForm, setEntForm] = useState({ group_code: '', entitlement_type: 'common', rows: [{ group_code: '', from_year: 0, to_year: 0, entitlement_days: 0 }] });
    const [editingEntGroupCode, setEditingEntGroupCode] = useState(null);

    // Holiday state
    const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
    const [showHolidayForm, setShowHolidayForm] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState(null);
    const [holidayForm, setHolidayForm] = useState({ ...EMPTY_HOLIDAY });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (activeTab === 'holidays') loadHolidays();
        if (activeTab === 'policies') loadEntitlements();
    }, [holidayYear, activeTab]);

    const loadData = async () => {
        try {
            const [g, t, p] = await Promise.all([
                settingsApi.getLeaveGroups(),
                settingsApi.getLeaveTypes(),
                settingsApi.getLeavePolicies()
            ]);
            setGroups(g.data);
            setLeaveTypes(t.data);
            setPolicies(p.data);
        } catch (error) {
            console.error('Error loading leave setup data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadHolidays = async () => {
        try {
            const res = await settingsApi.getHolidays();
            const all = res.data || [];
            setHolidays(all);
            // Derive available years
            const yrs = [...new Set(all.map(h => parseInt(h.year)).filter(Boolean))];
            yrs.sort((a, b) => b - a);
            if (yrs.length > 0 && !yrs.includes(holidayYear)) {
                setHolidayYear(yrs[0]);
            }
        } catch (error) {
            console.error('Error loading holidays:', error);
            setHolidays([]);
        }
    };

    const openEditGroup = (group) => {
        setEditingGroup(group);
        setGroupForm({
            code: group.code || '',
            name: group.name || '',
            description: group.description || '',
            attachmentMandatory: group.attachment_mandatory || 'No'
        });
        setShowGroupModal(true);
    };

    const closeGroupModal = () => {
        setShowGroupModal(false);
        setEditingGroup(null);
        setGroupForm({ code: '', name: '', description: '', attachmentMandatory: 'No' });
    };

    const handleSaveGroup = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!groupForm.code || !groupForm.name) {
            showToast('Code and Name are required', 'error');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                code: groupForm.code,
                name: groupForm.name,
                description: groupForm.description || '',
                attachment_mandatory: groupForm.attachmentMandatory
            };
            if (editingGroup) {
                await settingsApi.updateLeaveGroup(editingGroup.code, payload);
                showToast('Leave group updated!', 'success');
            } else {
                await settingsApi.createLeaveGroup(payload);
                showToast('Leave group created!', 'success');
            }
            closeGroupModal();
            loadData();
        } catch (error) {
            console.error(error);
            showToast(error?.response?.data?.detail || 'Error saving leave group', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveType = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!typeForm.code || !typeForm.name || !typeForm.group_id) {
            showToast('Code, Name and Group are required', 'error');
            return;
        }
        setSaving(true);
        try {
            await settingsApi.createLeaveType({
                code: typeForm.code,
                name: typeForm.name,
                group_id: typeForm.group_id,
                is_leave: typeForm.isLeave,
                pay_type: typeForm.payType,
                active: typeForm.active ? 'Yes' : 'No',
                is_adjustable: typeForm.isAdjustable ? 'Yes' : 'No',
                description: typeForm.name
            });
            showToast('Leave type created!', 'success');
            setShowTypeModal(false);
            setTypeForm({ code: '', name: '', group_id: '', isLeave: 'Yes', payType: 'PAID', active: true, isAdjustable: false });
            loadData();
        } catch (error) {
            console.error(error);
            showToast(error?.response?.data?.detail || 'Error creating leave type', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSavePolicy = async (policyData) => {
        setSaving(true);
        try {
            await settingsApi.updateLeavePolicy(policyData);
            showToast('Leave policy updated successfully!', 'success');
            loadData();
        } catch (error) {
            console.error(error);
            showToast('Error updating leave policy', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Entitlement handlers ──
    const loadEntitlements = async () => {
        try {
            const res = await settingsApi.getLeaveEntitlements();
            setEntitlements(res.data || []);
        } catch { setEntitlements([]); }
    };

    const openAddEntitlement = () => {
        setEditingEntGroupCode(null);
        setEntForm({ group_code: '', entitlement_type: 'common', rows: [{ group_code: '', from_year: 0, to_year: 0, entitlement_days: 0 }] });
        setShowEntitlementModal(true);
    };

    const openEditEntitlement = (groupCode) => {
        const groupRows = entitlements.filter(e => e.group_code === groupCode);
        const type = groupRows[0]?.entitlement_type || 'common';
        setEditingEntGroupCode(groupCode);
        setEntForm({ group_code: groupCode, entitlement_type: type, rows: groupRows.map(r => ({ ...r })) });
        setShowEntitlementModal(true);
    };

    const handleSaveEntitlement = async () => {
        if (!entForm.group_code) { showToast('Please select a leave group', 'error'); return; }
        setSaving(true);
        try {
            await settingsApi.saveLeaveEntitlements({
                group_code: entForm.group_code,
                entitlement_type: entForm.entitlement_type,
                rows: entForm.rows.map(r => ({ ...r, group_code: entForm.group_code, entitlement_type: entForm.entitlement_type }))
            });
            showToast('Entitlement saved!', 'success');
            setShowEntitlementModal(false);
            loadEntitlements();
        } catch { showToast('Error saving entitlement', 'error'); }
        finally { setSaving(false); }
    };

    const handleDeleteEntitlement = async (groupCode) => {
        if (!confirm('Delete all entitlement rules for this leave group?')) return;
        try {
            await settingsApi.deleteLeaveEntitlements(groupCode);
            showToast('Entitlement deleted', 'success');
            loadEntitlements();
        } catch { showToast('Error deleting entitlement', 'error'); }
    };

    // Group entitlements by group_code for the list
    const entitlementsByGroup = entitlements.reduce((acc, e) => {
        if (!acc[e.group_code]) acc[e.group_code] = { type: e.entitlement_type, rows: [] };
        acc[e.group_code].rows.push(e);
        return acc;
    }, {});

    const handleSaveHoliday = async (e) => {
        e.preventDefault();
        if (!holidayForm.name || !holidayForm.date) {
            showToast('Name and date are required', 'error');
            return;
        }
        setSaving(true);
        try {
            const payload = { ...holidayForm, year: holidayYear };
            if (editingHoliday) {
                await settingsApi.updateHoliday(editingHoliday.id, payload);
                showToast('Holiday updated!', 'success');
            } else {
                await settingsApi.createHoliday(payload);
                showToast('Holiday added!', 'success');
            }
            setShowHolidayForm(false);
            setEditingHoliday(null);
            setHolidayForm({ ...EMPTY_HOLIDAY, year: holidayYear });
            loadHolidays();
        } catch (error) {
            showToast(error.response?.data?.detail || 'Error saving holiday', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteHoliday = async (id) => {
        if (!confirm('Delete this holiday?')) return;
        try {
            await settingsApi.deleteHoliday(id);
            showToast('Holiday deleted', 'success');
            loadHolidays();
        } catch (error) {
            console.error(error);
            showToast('Error deleting holiday', 'error');
        }
    };

    const startEditHoliday = (h) => {
        setEditingHoliday(h);
        setHolidayForm({
            name: h.name, date: h.date, holiday_type: h.holiday_type || 'Company',
            applicable_to: h.applicable_to || 'All', year: h.year || holidayYear,
            description: h.description || ''
        });
        setShowHolidayForm(true);
    };

    const getHolidayTypeConfig = (type) => HOLIDAY_TYPES.find(t => t.value === type) || HOLIDAY_TYPES[2];

    if (loading) return <div>Loading...</div>;

    return (
        <div className="card shadow-md border-0 mb-4 overflow-hidden" style={{ minHeight: 'calc(100vh - 130px)', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header bg-white border-bottom-0 pt-4 px-4 pb-3">
                <div className="d-flex flex-column gap-3">
                    <div className="d-flex align-items-center gap-3">
                        <div style={{ padding: '10px', background: 'var(--primary-50)', borderRadius: '12px', color: 'var(--primary-600)' }}>
                            <CalendarRange size={24} />
                        </div>
                        <div>
                            <h5 className="card-title mb-0">Leave & Holiday Setup</h5>
                            <p className="text-muted small mb-0">Configure leave categories, types, accrual rules, and company holidays</p>
                        </div>
                    </div>

                    <div className="tabs-container m-0 mt-3 align-self-start">
                        <button
                            className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
                            onClick={() => setActiveTab('groups')}
                        >
                            <Users size={18} className="tab-icon" />
                            Leave Groups
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'types' ? 'active' : ''}`}
                            onClick={() => setActiveTab('types')}
                        >
                            <CalendarDays size={18} className="tab-icon" />
                            Leave Types
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'policies' ? 'active' : ''}`}
                            onClick={() => setActiveTab('policies')}
                        >
                            <Settings2 size={18} className="tab-icon" />
                            Leave Policies
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'holidays' ? 'active' : ''}`}
                            onClick={() => setActiveTab('holidays')}
                        >
                            <PartyPopper size={18} className="tab-icon" />
                            Holidays
                        </button>
                    </div>
                </div>
            </div>

            <div className="card-body p-4 pt-0 transition-fade" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {activeTab === 'groups' && (
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                            <button
                                className="btn btn-primary d-flex align-items-center gap-2"
                                onClick={() => setShowGroupModal(true)}
                            >
                                <Plus size={18} /> Add Group
                            </button>
                        </div>
                        {groups.length === 0 ? (
                            <div className="card">
                                <div className="card-body">
                                    <div className="empty-state">
                                        <Users size={40} />
                                        <h3>No leave groups configured yet</h3>
                                        <p>Click the "Add Group" button above to create your first leave categorization group.</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="card">
                                <div className="card-body" style={{ padding: 0 }}>
                                    <div className="table-container">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Code</th>
                                                    <th>Name</th>
                                                    <th>Description</th>
                                                    <th style={{ textAlign: 'center', width: '160px' }}>Attachment</th>
                                                    <th style={{ textAlign: 'right', width: '120px' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groups.map(g => (
                                                    <tr key={g.code}>
                                                        <td>
                                                            <span style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{g.code}</span>
                                                        </td>
                                                        <td>{g.name}</td>
                                                        <td>{g.description || '—'}</td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <span className={`badge ${g.attachment_mandatory === 'Yes' ? 'badge-success' : 'badge-gray'}`}>
                                                                {g.attachment_mandatory || 'No'}
                                                            </span>
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <div className="actions" style={{ justifyContent: 'flex-end' }}>
                                                                <button className="btn btn-secondary btn-sm" title="Edit Group"
                                                                    onClick={() => openEditGroup(g)}>
                                                                    <Edit3 size={14} />
                                                                </button>
                                                                <button className="btn btn-secondary btn-sm" title="Delete Group"
                                                                    style={{ color: 'var(--error-600)' }}>
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'types' && (
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h6 className="card-title mb-0">Leave Type List</h6>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Enter Leave Type Code or Name"
                                        value={typeSearch}
                                        onChange={(e) => setTypeSearch(e.target.value)}
                                        style={{ paddingRight: '2.5rem', minWidth: '280px' }}
                                    />
                                    <Search size={16} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                                </div>
                                <button
                                    className="btn btn-primary d-flex align-items-center gap-2"
                                    onClick={() => setShowTypeModal(true)}
                                >
                                    <Plus size={18} /> Add Leave Type
                                </button>
                            </div>
                        </div>
                        {leaveTypes.length === 0 ? (
                            <div className="card">
                                <div className="card-body">
                                    <div className="empty-state">
                                        <Settings2 size={40} />
                                        <h3>No leave types configured yet</h3>
                                        <p>Click the "Add Leave Type" button above to create your first leave type.</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="card">
                                <div className="card-body" style={{ padding: 0 }}>
                                    <div className="table-container">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Leave Type Code</th>
                                                    <th>Leave Type Name</th>
                                                    <th>Is Leave</th>
                                                    <th>Pay Type</th>
                                                    <th>Leave Group Name</th>
                                                    <th style={{ textAlign: 'center' }}>Active / InActive</th>
                                                    <th style={{ textAlign: 'right', width: '100px' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {leaveTypes
                                                    .filter(lt => {
                                                        if (!typeSearch) return true;
                                                        const q = typeSearch.toLowerCase();
                                                        return lt.code.toLowerCase().includes(q) || lt.name.toLowerCase().includes(q);
                                                    })
                                                    .map(lt => (
                                                        <tr key={lt.code}>
                                                            <td>
                                                                <span style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{lt.code}</span>
                                                            </td>
                                                            <td>{lt.name}</td>
                                                            <td>{lt.is_leave || 'Yes'}</td>
                                                            <td>{lt.pay_type || 'PAID'}</td>
                                                            <td>
                                                                <span className="badge badge-info">
                                                                    {groups.find(g => g.code === lt.group_id)?.name || lt.group_id}
                                                                </span>
                                                            </td>
                                                            <td style={{ textAlign: 'center' }}>
                                                                <div
                                                                    onClick={() => {
                                                                        // Toggle active status visually (could persist later)
                                                                    }}
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        width: '42px',
                                                                        height: '22px',
                                                                        borderRadius: '11px',
                                                                        background: (lt.active === 'Yes' || lt.active === true) ? 'var(--primary-500)' : 'var(--gray-300)',
                                                                        cursor: 'pointer',
                                                                        padding: '2px',
                                                                        transition: 'background 0.2s'
                                                                    }}
                                                                >
                                                                    <div style={{
                                                                        width: '18px',
                                                                        height: '18px',
                                                                        borderRadius: '50%',
                                                                        background: 'white',
                                                                        transition: 'transform 0.2s',
                                                                        transform: (lt.active === 'Yes' || lt.active === true) ? 'translateX(20px)' : 'translateX(0)'
                                                                    }} />
                                                                </div>
                                                            </td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <div className="actions" style={{ justifyContent: 'flex-end' }}>
                                                                    <button className="btn btn-secondary btn-sm" title="Edit Leave Type">
                                                                        <Edit3 size={14} />
                                                                    </button>
                                                                    <button className="btn btn-secondary btn-sm" title="Delete"
                                                                        style={{ color: 'var(--error-600)' }}>
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'policies' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h6 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Settings2 size={18} className="text-primary" />
                                Leave Entitlements
                            </h6>
                            <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }} onClick={openAddEntitlement}>
                                <Plus size={16} /> Add Entitlement
                            </button>
                        </div>

                        {Object.keys(entitlementsByGroup).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)', background: 'var(--gray-50)', borderRadius: '12px', border: '1px solid var(--gray-200)' }}>
                                <Info size={36} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                                <p style={{ marginBottom: '0.25rem', fontWeight: 600, color: 'var(--gray-600)' }}>No entitlements configured yet</p>
                                <p className="text-muted small">Click "Add Entitlement" to define leave entitlements per group.</p>
                            </div>
                        ) : (
                            <div className="card" style={{ overflow: 'hidden' }}>
                                <div className="card-body" style={{ padding: 0 }}>
                                    <div className="table-container">
                                        <table className="data-table">
                                            <thead><tr>
                                                <th>Leave Group</th>
                                                <th>Type</th>
                                                <th>Rules</th>
                                                <th style={{ textAlign: 'right', width: '100px' }}>Actions</th>
                                            </tr></thead>
                                            <tbody>
                                                {Object.entries(entitlementsByGroup).map(([gc, info]) => {
                                                    const grp = groups.find(g => g.code === gc);
                                                    return (
                                                        <tr key={gc}>
                                                            <td><span style={{ fontWeight: 600 }}>{grp?.name || gc}</span></td>
                                                            <td>
                                                                <span className={`badge ${info.type === 'experience_based' ? 'badge-warning' : 'badge-info'}`}>
                                                                    {info.type === 'experience_based' ? 'Experience-Based' : 'Common'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {info.type === 'common' ? (
                                                                    <span>{info.rows[0]?.entitlement_days || 0} days</span>
                                                                ) : (
                                                                    <span>{info.rows.map(r => `${r.from_year}-${r.to_year} yrs: ${r.entitlement_days}d`).join(', ')}</span>
                                                                )}
                                                            </td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <div className="actions" style={{ justifyContent: 'flex-end' }}>
                                                                    <button className="btn btn-secondary btn-sm" title="Edit" onClick={() => openEditEntitlement(gc)}><Edit3 size={14} /></button>
                                                                    <button className="btn btn-secondary btn-sm" title="Delete" style={{ color: 'var(--error-600)' }} onClick={() => handleDeleteEntitlement(gc)}><Trash2 size={14} /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Entitlement Modal */}
                        <Modal isOpen={showEntitlementModal} onClose={() => setShowEntitlementModal(false)}
                            title={editingEntGroupCode ? 'Edit Entitlement' : 'Add Entitlement'}
                            footer={
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button className="btn btn-secondary" onClick={() => setShowEntitlementModal(false)}>Cancel</button>
                                    <button className="btn btn-primary" onClick={handleSaveEntitlement} disabled={saving}>
                                        {saving ? 'Saving...' : 'Save Entitlement'}
                                    </button>
                                </div>
                            }
                        >
                            <div className="form-grid">
                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <label className="form-label">Leave Group *</label>
                                    <select className="form-select form-input" value={entForm.group_code}
                                        onChange={e => setEntForm({ ...entForm, group_code: e.target.value })}
                                        disabled={!!editingEntGroupCode}
                                    >
                                        <option value="">Select Leave Group</option>
                                        {groups.map(g => (
                                            <option key={g.code} value={g.code}>{g.name} ({g.code})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <label className="form-label">Entitlement Type</label>
                                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input type="radio" name="ent_type" value="common" checked={entForm.entitlement_type === 'common'}
                                                onChange={() => setEntForm({ ...entForm, entitlement_type: 'common', rows: [{ group_code: entForm.group_code, from_year: 0, to_year: 0, entitlement_days: 0 }] })} />
                                            Common (same for all)
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input type="radio" name="ent_type" value="experience_based" checked={entForm.entitlement_type === 'experience_based'}
                                                onChange={() => setEntForm({ ...entForm, entitlement_type: 'experience_based', rows: entForm.rows.length < 2 ? [...entForm.rows, { group_code: entForm.group_code, from_year: 0, to_year: 0, entitlement_days: 0 }] : entForm.rows })} />
                                            Experience-Based
                                        </label>
                                    </div>
                                </div>

                                {entForm.entitlement_type === 'common' ? (
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="form-label">Entitlement (in days)</label>
                                        <input type="number" className="form-input" min="0" step="0.01"
                                            value={entForm.rows[0]?.entitlement_days || 0}
                                            onChange={e => setEntForm({ ...entForm, rows: [{ ...entForm.rows[0], entitlement_days: parseFloat(e.target.value) || 0 }] })}
                                        />
                                    </div>
                                ) : (
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                            <label className="form-label" style={{ margin: 0 }}>Experience Rules</label>
                                            <button type="button" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                onClick={() => setEntForm({ ...entForm, rows: [...entForm.rows, { group_code: entForm.group_code, from_year: 0, to_year: 0, entitlement_days: 0 }] })}>
                                                <Plus size={14} /> Add Row
                                            </button>
                                        </div>
                                        <div style={{ borderRadius: '8px', border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
                                            <table className="data-table" style={{ marginBottom: 0 }}>
                                                <thead><tr>
                                                    <th>From Year</th>
                                                    <th>To Year</th>
                                                    <th>Entitlement (days)</th>
                                                    <th style={{ width: '50px' }}></th>
                                                </tr></thead>
                                                <tbody>
                                                    {entForm.rows.map((row, idx) => (
                                                        <tr key={idx}>
                                                            <td><input type="number" className="form-input" min="0" value={row.from_year}
                                                                onChange={e => { const r = [...entForm.rows]; r[idx] = { ...r[idx], from_year: parseInt(e.target.value) || 0 }; setEntForm({ ...entForm, rows: r }); }}
                                                                style={{ maxWidth: '100px' }} /></td>
                                                            <td><input type="number" className="form-input" min="0" value={row.to_year}
                                                                onChange={e => { const r = [...entForm.rows]; r[idx] = { ...r[idx], to_year: parseInt(e.target.value) || 0 }; setEntForm({ ...entForm, rows: r }); }}
                                                                style={{ maxWidth: '100px' }} /></td>
                                                            <td><input type="number" className="form-input" min="0" step="0.01" value={row.entitlement_days}
                                                                onChange={e => { const r = [...entForm.rows]; r[idx] = { ...r[idx], entitlement_days: parseFloat(e.target.value) || 0 }; setEntForm({ ...entForm, rows: r }); }}
                                                                style={{ maxWidth: '120px' }} /></td>
                                                            <td style={{ textAlign: 'center' }}>
                                                                {entForm.rows.length > 1 && (
                                                                    <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--error-600)' }}
                                                                        onClick={() => setEntForm({ ...entForm, rows: entForm.rows.filter((_, i) => i !== idx) })}>
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Modal>
                    </div>
                )}

                {/* ── Holidays Tab ── */}
                {activeTab === 'holidays' && (() => {
                    const allYears = [...new Set(holidays.map(h => parseInt(h.year)).filter(Boolean))];
                    allYears.sort((a, b) => b - a);
                    if (!allYears.includes(holidayYear)) allYears.unshift(holidayYear);
                    const filteredHolidays = holidays.filter(h => parseInt(h.year) === holidayYear);

                    const handleUploadFile = async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setSaving(true);
                        try {
                            const res = await settingsApi.uploadHolidays(file);
                            showToast(res.data?.message || 'Holidays imported!', 'success');
                            loadHolidays();
                        } catch (err) {
                            showToast('Error uploading file: ' + (err.response?.data?.detail || err.message), 'error');
                        } finally { setSaving(false); e.target.value = ''; }
                    };

                    return (
                        <div className="row g-4" style={{ flex: 1 }}>
                            <div className="col-12">
                                <div className="card shadow-md border-0">
                                    <div className="card-body p-4">
                                        {/* Header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <PartyPopper size={18} className="text-primary" />
                                                <h6 className="card-title" style={{ margin: 0 }}>Company Holidays</h6>
                                                <span className="badge bg-primary-subtle text-primary rounded-pill px-3 py-1 fw-semibold" style={{ fontSize: '0.7rem' }}>
                                                    {filteredHolidays.length} holiday{filteredHolidays.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <label className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', margin: 0 }}>
                                                    <Upload size={14} />
                                                    {saving ? 'Uploading...' : 'Upload CSV / XLSX'}
                                                    <input type="file" accept=".csv,.xlsx,.xls" onChange={handleUploadFile} style={{ display: 'none' }} disabled={saving} />
                                                </label>
                                                <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                                                    onClick={() => { setEditingHoliday(null); setHolidayForm({ ...EMPTY_HOLIDAY, year: holidayYear }); setShowHolidayForm(true); }}>
                                                    <Plus size={16} /> Add Holiday
                                                </button>
                                            </div>
                                        </div>

                                        {/* Year Tabs */}
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                                            {allYears.map(y => (
                                                <button key={y}
                                                    className={`btn btn-sm ${y === holidayYear ? 'btn-primary' : 'btn-secondary'}`}
                                                    style={{ borderRadius: '20px', minWidth: '70px', fontWeight: 600, fontSize: '0.8rem' }}
                                                    onClick={() => setHolidayYear(y)}>
                                                    {y}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Upload Info */}
                                        <div style={{ background: 'var(--gray-50)', borderRadius: '10px', border: '1px dashed var(--gray-300)', padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <Info size={16} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                                            <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                                                <strong>Bulk Upload:</strong> Upload a CSV or XLSX file with columns: <code style={{ fontSize: '0.72rem', background: 'var(--gray-200)', padding: '1px 4px', borderRadius: '3px' }}>name, date, holiday_type, applicable_to, description</code>. Supported date formats: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY.
                                            </div>
                                        </div>

                                        {/* Add/Edit Holiday Form (inline) */}
                                        {showHolidayForm && (
                                            <form onSubmit={handleSaveHoliday} className="mb-4 p-4" style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-200)', animation: 'fadeIn 0.2s ease-out' }}>
                                                <div className="d-flex justify-content-between align-items-center mb-3">
                                                    <h6 className="mb-0 fw-bold text-primary" style={{ fontSize: '0.95rem' }}>
                                                        {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
                                                    </h6>
                                                    <button type="button" className="btn btn-sm text-muted" onClick={() => { setShowHolidayForm(false); setEditingHoliday(null); }}>
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                                <div className="row g-3">
                                                    <div className="col-md-4">
                                                        <label className="form-label small fw-bold">Holiday Name *</label>
                                                        <input type="text" className="form-control form-input" required
                                                            value={holidayForm.name} onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })}
                                                            placeholder="e.g. Republic Day" />
                                                    </div>
                                                    <div className="col-md-3">
                                                        <label className="form-label small fw-bold">Date *</label>
                                                        <input type="date" className="form-control form-input" required
                                                            value={holidayForm.date} onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })} />
                                                    </div>
                                                    <div className="col-md-2">
                                                        <label className="form-label small fw-bold">Type</label>
                                                        <select className="form-select form-input"
                                                            value={holidayForm.holiday_type} onChange={e => setHolidayForm({ ...holidayForm, holiday_type: e.target.value })}>
                                                            {HOLIDAY_TYPES.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="col-md-3">
                                                        <label className="form-label small fw-bold">Applicable To</label>
                                                        <input type="text" className="form-control form-input"
                                                            value={holidayForm.applicable_to} onChange={e => setHolidayForm({ ...holidayForm, applicable_to: e.target.value })}
                                                            placeholder="All / Office Name" />
                                                    </div>
                                                    <div className="col-12">
                                                        <label className="form-label small fw-bold">Description</label>
                                                        <input type="text" className="form-control form-input"
                                                            value={holidayForm.description} onChange={e => setHolidayForm({ ...holidayForm, description: e.target.value })}
                                                            placeholder="Optional notes" />
                                                    </div>
                                                </div>
                                                <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                                                    <button type="button" className="btn btn-secondary btn-sm px-4" onClick={() => { setShowHolidayForm(false); setEditingHoliday(null); }}>
                                                        Cancel
                                                    </button>
                                                    <button type="submit" className="btn btn-primary btn-sm px-4 shadow-sm" disabled={saving}>
                                                        {saving ? 'Saving...' : (editingHoliday ? 'Update Holiday' : 'Save Holiday')}
                                                    </button>
                                                </div>
                                            </form>
                                        )}

                                        {/* Holidays List for selected year */}
                                        {filteredHolidays.length === 0 ? (
                                            <div className="text-center p-5 bg-gray-50 rounded-xl border border-gray-100 mt-2">
                                                <Calendar size={40} className="text-primary opacity-50" style={{ marginBottom: '1rem' }} />
                                                <h6 className="fw-bold mb-2">No Holidays Set</h6>
                                                <p className="text-muted small mb-0">No company holidays have been configured for {holidayYear}.</p>
                                            </div>
                                        ) : (
                                            <div className="table-container" style={{ marginTop: '0.5rem' }}>
                                                <table className="data-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Date</th>
                                                            <th>Holiday Name</th>
                                                            <th>Type</th>
                                                            <th>Applicable To</th>
                                                            <th style={{ textAlign: 'right', width: '100px' }}>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredHolidays.map(h => {
                                                            const typeConfig = getHolidayTypeConfig(h.holiday_type);
                                                            return (
                                                                <tr key={h.id}>
                                                                    <td>
                                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                            <span style={{ fontWeight: 600 }}>{new Date(h.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
                                                                            <span className="text-muted" style={{ fontSize: '0.7rem' }}>{new Date(h.date).toLocaleDateString('en-US', { weekday: 'long' })}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td>
                                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                            <span style={{ fontWeight: 600 }}>{h.name}</span>
                                                                            {h.description && <span className="text-muted" style={{ fontSize: '0.75rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.description}</span>}
                                                                        </div>
                                                                    </td>
                                                                    <td>
                                                                        <span className="badge border fw-medium" style={{ color: typeConfig.color, background: typeConfig.bg, borderColor: `${typeConfig.color}30` }}>
                                                                            {h.holiday_type}
                                                                        </span>
                                                                    </td>
                                                                    <td className="text-muted small">{h.applicable_to || 'All'}</td>
                                                                    <td style={{ textAlign: 'right' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                                                                            <button className="btn btn-secondary btn-sm" title="Edit" onClick={() => startEditHoliday(h)}><Edit3 size={14} /></button>
                                                                            <button className="btn btn-secondary btn-sm" title="Delete" style={{ color: 'var(--error-600)' }} onClick={() => handleDeleteHoliday(h.id)}><Trash2 size={14} /></button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {/* Type Legend */}
                                        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--gray-200)', flexWrap: 'wrap' }}>
                                            {HOLIDAY_TYPES.map(t => (
                                                <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.72rem' }}>
                                                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: t.color }}></div>
                                                    <span className="text-muted fw-medium">{t.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Modals */}
            <Modal
                isOpen={showGroupModal}
                onClose={closeGroupModal}
                title={<div className="d-flex align-items-center gap-2">{editingGroup ? 'Edit Leave Group' : 'Add Leave Group'}</div>}
                size="lg"
                footer={
                    <div className="w-100 d-flex justify-content-end gap-3 pt-2">
                        <button className="btn btn-secondary" onClick={closeGroupModal}>
                            Cancel
                        </button>
                        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={handleSaveGroup} disabled={saving}>
                            {saving ? 'Saving...' : (editingGroup ? 'Update' : 'Create & Save')}
                        </button>
                    </div>
                }
            >
                <form id="groupForm" onSubmit={handleSaveGroup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem' }}>
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">Leave Group Code *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={groupForm.code}
                                onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value.toUpperCase() })}
                                required
                                disabled={!!editingGroup}
                                placeholder="e.g. CL"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Leave Group Name *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={groupForm.name}
                                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                                required
                                placeholder="e.g. Casual Leave"
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                            className="form-textarea"
                            rows={2}
                            value={groupForm.description}
                            onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                            placeholder="e.g. Allow Leave after confirmation only"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Is Attachment Mandatory?</label>
                        <div className="d-flex flex-row gap-4 mt-1">
                            <div className="form-check">
                                <input className="form-check-input" type="radio" name="mandatoryGroup" id="mandYes" checked={groupForm.attachmentMandatory === 'Yes'} onChange={() => setGroupForm({ ...groupForm, attachmentMandatory: 'Yes' })} />
                                <label className="form-check-label" htmlFor="mandYes">Yes</label>
                            </div>
                            <div className="form-check">
                                <input className="form-check-input" type="radio" name="mandatoryGroup" id="mandNo" checked={groupForm.attachmentMandatory === 'No'} onChange={() => setGroupForm({ ...groupForm, attachmentMandatory: 'No' })} />
                                <label className="form-check-label" htmlFor="mandNo">No</label>
                            </div>
                        </div>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={showTypeModal}
                onClose={() => setShowTypeModal(false)}
                title={<div className="d-flex align-items-center gap-2">Add Leave Type</div>}
                size="lg"
                footer={
                    <div className="w-100 d-flex justify-content-end gap-3 pt-2">
                        <button className="btn btn-secondary" onClick={() => setShowTypeModal(false)}>
                            Cancel
                        </button>
                        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={handleSaveType} disabled={saving}>
                            {saving ? 'Saving...' : 'Create & Save'}
                        </button>
                    </div>
                }
            >
                <form id="typeForm" onSubmit={handleSaveType} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem' }}>
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">Leave Type Code *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={typeForm.code}
                                onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })}
                                required
                                placeholder="Leave Type Code"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Leave Type Name *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={typeForm.name}
                                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                                required
                                placeholder="Leave Type Name"
                            />
                        </div>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">Pay Type *</label>
                            <select
                                className="form-select"
                                value={typeForm.payType}
                                onChange={(e) => setTypeForm({ ...typeForm, payType: e.target.value })}
                            >
                                <option value="PAID">PAID</option>
                                <option value="UNPAID">UNPAID</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Leave Group Name *</label>
                            <select
                                className="form-select"
                                value={typeForm.group_id}
                                onChange={(e) => setTypeForm({ ...typeForm, group_id: e.target.value })}
                                required
                            >
                                <option value="">Select a group...</option>
                                {groups.map(g => (
                                    <option key={g.code} value={g.code}>{g.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">Is Leave ?</label>
                            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                    <input type="radio" name="isLeave" checked={typeForm.isLeave === 'Yes'} onChange={() => setTypeForm({ ...typeForm, isLeave: 'Yes' })} /> Yes
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                    <input type="radio" name="isLeave" checked={typeForm.isLeave === 'No'} onChange={() => setTypeForm({ ...typeForm, isLeave: 'No' })} /> No
                                </label>
                            </div>
                        </div>
                        <div className="form-group">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={typeForm.active} onChange={(e) => setTypeForm({ ...typeForm, active: e.target.checked })} /> Active / In Active
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={typeForm.isAdjustable} onChange={(e) => setTypeForm({ ...typeForm, isAdjustable: e.target.checked })} /> Is Adjustable
                                </label>
                            </div>
                        </div>
                    </div>
                </form>
            </Modal>

            <style>{`
                .hover-row:hover {
                    background: var(--gray-50);
                }
                .hover-bg-primary-light:hover {
                    background: var(--primary-50);
                }
                .hover-bg-danger-light:hover {
                    background: var(--danger-50);
                }
                .transition-all {
                    transition: all 0.2s ease;
                }
                .transform-scale-sm {
                    transform: scale(1.02);
                }
                .transition-fade {
                    animation: fadeIn 0.3s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .tabs-container {
                    display: flex;
                    gap: 4px;
                    margin: 1.5rem 0 0 0;
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
            `}</style>
        </div >
    );
};



export default LeaveSetup;
