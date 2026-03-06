import React, { useState, useEffect } from 'react';
import { Save, ShieldCheck, UserPlus, Plus, X, Eye, Edit3, Settings2, Users, Star } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { useToast } from '../../contexts/ToastContext';
import { settingsApi, associatesApi } from '../../services/api';
import { CAPABILITIES, CAPABILITY_MENUS } from '../../contexts/CapabilityContext';

const IAMSettings = () => {
    const { showToast } = useToast();
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [associates, setAssociates] = useState([]);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);   // null = new role
    const [roleName, setRoleName] = useState('');
    const [roleDesc, setRoleDesc] = useState('');
    const [modalPerms, setModalPerms] = useState([]);       // local copy for modal editing

    const caps = Object.keys(CAPABILITY_MENUS).map(capId => ({
        id: capId,
        name: CAPABILITIES[capId]?.fullName || capId,
        pages: Array.from(new Set(
            CAPABILITY_MENUS[capId].flatMap(section =>
                section.items.map(item => item.label)
            )
        ))
    }));

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [rolesData, permsData, assocData] = await Promise.all([
                settingsApi.getRoles(),
                settingsApi.getPermissions(),
                associatesApi.getAll()
            ]);
            setRoles(rolesData.data || []);
            setPermissions(permsData.data || []);
            setAssociates(assocData.data || []);
        } catch (error) {
            console.error('Error loading IAM data:', error);
        } finally {
            setLoading(false);
        }
    };

    // ── Modal helpers ──
    const openNewRole = () => {
        setEditingRole(null);
        setRoleName('');
        setRoleDesc('');
        setModalPerms([]);
        setModalOpen(true);
    };

    const openEditRole = (role) => {
        setEditingRole(role);
        setRoleName(role.name || '');
        setRoleDesc(role.description || '');
        setModalPerms(permissions.filter(p => p.role_id === role.id).map(p => ({ ...p })));
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingRole(null);
    };

    const toggleModalPerm = (roleId, capId, pageId, type) => {
        const existing = modalPerms.find(p => p.capability_id === capId && p.page_id === pageId);
        if (existing) {
            setModalPerms(modalPerms.map(p => p === existing ? { ...p, [type]: !p[type] } : p));
        } else {
            setModalPerms([...modalPerms, {
                role_id: roleId, capability_id: capId, page_id: pageId,
                can_read: type === 'can_read', can_write: type === 'can_write',
                scope: 'associate'
            }]);
        }
    };

    const setModalPermScope = (capId, pageId, scope) => {
        const existing = modalPerms.find(p => p.capability_id === capId && p.page_id === pageId);
        if (existing) {
            setModalPerms(modalPerms.map(p => p === existing ? { ...p, scope } : p));
        } else {
            setModalPerms([...modalPerms, {
                role_id: editingRole?.id || '__new__', capability_id: capId, page_id: pageId,
                can_read: false, can_write: false, scope
            }]);
        }
    };

    const checkModalPerm = (capId, pageId, type) => {
        const p = modalPerms.find(p => p.capability_id === capId && p.page_id === pageId);
        return p ? p[type] : false;
    };

    const getModalPermScope = (capId, pageId) => {
        const p = modalPerms.find(p => p.capability_id === capId && p.page_id === pageId);
        return p?.scope || 'associate';
    };

    const handleSaveModal = async () => {
        if (!roleName.trim()) { showToast('Role name is required', 'error'); return; }
        setSaving(true);
        try {
            let roleId;
            if (editingRole) {
                roleId = editingRole.id;
            } else {
                const res = await settingsApi.createRole({ name: roleName, description: roleDesc });
                roleId = res.data?.id || roleName.toLowerCase().replace(/\s+/g, '_');
            }
            // Merge modal perms back into global perms
            const otherPerms = permissions.filter(p => p.role_id !== roleId);
            const thisPerms = modalPerms.map(p => ({ ...p, role_id: roleId }));
            const allPerms = [...otherPerms, ...thisPerms];
            await settingsApi.updatePermissions(allPerms);
            showToast(editingRole ? 'Role permissions updated!' : 'Role created with permissions!', 'success');
            closeModal();
            loadData();
        } catch (error) {
            showToast('Error saving role', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSetDefault = async (roleId) => {
        try {
            await settingsApi.setDefaultRole(roleId);
            showToast('Default role updated!', 'success');
            loadData();
        } catch (error) {
            showToast('Error setting default role', 'error');
        }
    };

    const handleSeedAdmin = async () => {
        try {
            setSaving(true);
            const res = await settingsApi.seedAdminRole();
            showToast(res.data?.message || 'Admin role created with full permissions!', 'success');
            loadData();
        } catch (error) {
            showToast('Error seeding admin role', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">IAM & Security</h1>
                    <p className="page-subtitle">Manage system roles and page-level access permissions</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {!roles.some(r => (r.name || '').toLowerCase() === 'admin') && (
                        <button className="btn btn-secondary d-flex align-items-center gap-2"
                            onClick={handleSeedAdmin} disabled={saving}>
                            <ShieldCheck size={18} /> Seed Admin Role
                        </button>
                    )}
                    <button className="btn btn-primary d-flex align-items-center gap-2"
                        onClick={openNewRole}>
                        <UserPlus size={18} /> Add Role
                    </button>
                </div>
            </div>

            {/* Roles Table */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Role</th>
                                    <th>Description</th>
                                    <th style={{ textAlign: 'center', width: '180px' }}>Permissions</th>
                                    <th style={{ textAlign: 'center', width: '100px' }}>Default</th>
                                    <th style={{ textAlign: 'right', width: '100px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roles.length === 0 ? (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>
                                        <ShieldCheck size={40} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
                                        <div>No roles configured. Click "Add Role" to get started.</div>
                                    </td></tr>
                                ) : roles.map(role => {
                                    const readCount = permissions.filter(p => p.role_id === role.id && p.can_read).length;
                                    const writeCount = permissions.filter(p => p.role_id === role.id && p.can_write).length;
                                    const isDefault = role.is_default === true || role.is_default === 'TRUE' || role.is_default === 'true';
                                    return (
                                        <tr key={role.id}>
                                            <td>
                                                <span style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{role.name || ''}</span>
                                                {isDefault && (
                                                    <span className="badge badge-warning" style={{ marginLeft: '0.5rem', fontSize: '0.6rem' }}>DEFAULT</span>
                                                )}
                                            </td>
                                            <td>{role.description || '—'}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                    <span className="badge badge-success">
                                                        <Eye size={10} style={{ marginRight: '3px', verticalAlign: '-1px' }} />{readCount} read
                                                    </span>
                                                    <span className="badge badge-primary">
                                                        <Edit3 size={10} style={{ marginRight: '3px', verticalAlign: '-1px' }} />{writeCount} write
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button
                                                    className="btn btn-sm"
                                                    onClick={() => !isDefault && handleSetDefault(role.id)}
                                                    title={isDefault ? 'Current default role' : 'Set as default role'}
                                                    style={{
                                                        background: 'none', border: 'none', padding: '0.25rem',
                                                        cursor: isDefault ? 'default' : 'pointer',
                                                        color: isDefault ? '#f59e0b' : 'var(--gray-300)',
                                                        transition: 'color 0.2s'
                                                    }}
                                                    onMouseEnter={e => { if (!isDefault) e.target.style.color = '#f59e0b'; }}
                                                    onMouseLeave={e => { if (!isDefault) e.target.style.color = 'var(--gray-300)'; }}
                                                >
                                                    <Star size={18} fill={isDefault ? '#f59e0b' : 'none'} />
                                                </button>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="btn btn-secondary btn-sm"
                                                    onClick={() => openEditRole(role)} title="Manage Permissions">
                                                    <Settings2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Role Assignment Section ── */}
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '2rem 0 0.75rem', color: 'var(--gray-800)' }}>Role Assignment</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>Assign IAM roles to associates. Users without a role will use the default role's permissions.</p>
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Associate</th>
                                    <th>Email</th>
                                    <th>Department</th>
                                    <th style={{ width: '200px' }}>IAM Role</th>
                                </tr>
                            </thead>
                            <tbody>
                                {associates.filter(a => a.status?.toLowerCase() === 'active' || !a.status).map(assoc => (
                                    <tr key={assoc.associate_id}>
                                        <td>
                                            <span style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{assoc.associate_name}</span>
                                        </td>
                                        <td>{assoc.email}</td>
                                        <td>{assoc.department_id || '—'}</td>
                                        <td>
                                            <select
                                                className="form-select"
                                                value={assoc.iam_role_id || ''}
                                                onChange={async (e) => {
                                                    const newRoleId = e.target.value;
                                                    try {
                                                        await settingsApi.assignRole(assoc.associate_id, newRoleId);
                                                        setAssociates(prev => prev.map(a =>
                                                            a.associate_id === assoc.associate_id
                                                                ? { ...a, iam_role_id: newRoleId }
                                                                : a
                                                        ));
                                                        showToast(`Role updated for ${assoc.associate_name}`, 'success');
                                                    } catch (err) {
                                                        showToast('Error assigning role', 'error');
                                                    }
                                                }}
                                                style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                                            >
                                                <option value="">Default Role</option>
                                                {roles.map(r => (
                                                    <option key={r.id} value={r.id}>{r.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Permission Modal ── */}
            <Modal
                isOpen={modalOpen}
                onClose={closeModal}
                title={editingRole ? `Manage Permissions — ${editingRole.name}` : 'Create New Role'}
                size="lg"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                        <button className="btn btn-primary d-flex align-items-center gap-2"
                            onClick={handleSaveModal} disabled={saving}>
                            {saving ? (
                                <><span className="spinner-border spinner-border-sm"></span> Saving...</>
                            ) : (
                                <><Save size={16} /> {editingRole ? 'Save Permissions' : 'Create & Save'}</>
                            )}
                        </button>
                    </>
                }
            >
                {/* Role Name / Description for new roles */}
                {!editingRole && (
                    <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--gray-200)' }}>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Role Name *</label>
                                <input type="text" className="form-input" placeholder="e.g. HR Manager"
                                    value={roleName} onChange={e => setRoleName(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <input type="text" className="form-input" placeholder="Brief role description"
                                    value={roleDesc} onChange={e => setRoleDesc(e.target.value)} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Permissions Matrix */}
                <div style={{ margin: '0 calc(var(--spacing-6) * -1)', marginBottom: 'calc(var(--spacing-6) * -1)' }}>
                    <table className="table align-middle mb-0">
                        <thead>
                            <tr style={{ background: 'var(--gray-50)' }}>
                                <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--gray-500)' }}>Module / Page</th>
                                <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--gray-500)', textAlign: 'center', width: '80px' }}>
                                    <Eye size={11} style={{ marginRight: '3px', verticalAlign: '-1px' }} />Read
                                </th>
                                <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--gray-500)', textAlign: 'center', width: '80px' }}>
                                    <Edit3 size={11} style={{ marginRight: '3px', verticalAlign: '-1px' }} />Write
                                </th>
                                <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--gray-500)', textAlign: 'center', width: '160px' }}>
                                    <Users size={11} style={{ marginRight: '3px', verticalAlign: '-1px' }} />Scope
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {caps.map(cap => (
                                <React.Fragment key={cap.id}>
                                    {/* Module group header */}
                                    <tr>
                                        <td colSpan={4} style={{ padding: '0.5rem 1.5rem', background: 'var(--primary-50)', borderBottom: '1px solid var(--gray-200)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-500)' }}></div>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary-600)' }}>
                                                    {cap.name}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                    {/* Page rows */}
                                    {cap.pages.map(page => {
                                        const rid = editingRole?.id || '__new__';
                                        const hasRead = checkModalPerm(cap.id, page, 'can_read');
                                        const hasWrite = checkModalPerm(cap.id, page, 'can_write');
                                        const scope = getModalPermScope(cap.id, page);
                                        return (
                                            <tr key={`${cap.id}-${page}`} className="hover-row">
                                                <td style={{ padding: '0.625rem 1.5rem 0.625rem 2.5rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.875rem', fontWeight: 500, color: 'var(--gray-700)' }}>
                                                    {page}
                                                </td>
                                                <td style={{ textAlign: 'center', borderBottom: '1px solid var(--gray-100)', padding: '0.625rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                        <ToggleSwitch active={hasRead} color="var(--success-500, #22c55e)"
                                                            onClick={() => toggleModalPerm(rid, cap.id, page, 'can_read')} />
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center', borderBottom: '1px solid var(--gray-100)', padding: '0.625rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                        <ToggleSwitch active={hasWrite} color="var(--primary-500, #3b82f6)"
                                                            onClick={() => toggleModalPerm(rid, cap.id, page, 'can_write')} />
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center', borderBottom: '1px solid var(--gray-100)', padding: '0.625rem' }}>
                                                    {(hasRead || hasWrite) ? (
                                                        <select
                                                            className="form-select"
                                                            value={scope}
                                                            onChange={e => setModalPermScope(cap.id, page, e.target.value)}
                                                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', width: 'auto', margin: '0 auto', minWidth: '130px' }}
                                                        >
                                                            <option value="associate">Associate</option>
                                                            <option value="managing_team">Managing Team</option>
                                                            <option value="all">All</option>
                                                        </select>
                                                    ) : (
                                                        <span style={{ color: 'var(--gray-300)' }}>—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Modal>

            <style>{`
                .hover-row:hover { background: var(--gray-50); }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

// ── Reusable Toggle Switch ──
const ToggleSwitch = ({ active, color, onClick }) => (
    <div
        onClick={onClick}
        style={{
            width: '36px', height: '20px', borderRadius: '12px', cursor: 'pointer',
            background: active ? color : 'var(--gray-300, #d1d5db)',
            position: 'relative', transition: 'background 0.2s ease'
        }}
    >
        <div style={{
            width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
            position: 'absolute', top: '2px',
            left: active ? '18px' : '2px',
            transition: 'left 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
        }}></div>
    </div>
);

export default IAMSettings;
