import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, CalendarRange, Plus, CheckCircle2, XCircle, Clock, Users, User, Info, ChevronRight, Search, Filter } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { leaveApi } from '../../services/api';
import Modal from '../../components/common/Modal';

const STATUS_STYLES = {
    Pending: { bg: 'var(--warning-50)', color: 'var(--warning-600)', border: 'var(--warning-200)' },
    Approved: { bg: 'var(--success-50)', color: 'var(--success-600)', border: 'var(--success-200)' },
    Rejected: { bg: 'var(--error-50)', color: 'var(--error-600)', border: 'var(--error-200)' }
};

function Leaves() {
    const { user, isAdmin, isManager } = useAuth();
    const { showToast } = useToast();

    // View toggle
    const [view, setView] = useState('self'); // 'self' or 'team'
    const showTeamView = isAdmin || isManager;

    // Data
    const [leaves, setLeaves] = useState([]);
    const [teamLeaves, setTeamLeaves] = useState([]);
    const [balance, setBalance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Apply modal
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [applyForm, setApplyForm] = useState({
        leave_type_code: '',
        from_date: '',
        to_date: '',
        half_day: false,
        half_day_period: 'first_half',
        reason: ''
    });

    // Reject modal
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectLeaveId, setRejectLeaveId] = useState(null);
    const [rejectRemarks, setRejectRemarks] = useState('');

    // Load data
    useEffect(() => {
        loadData();
    }, [view]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (view === 'self') {
                const [lRes, bRes] = await Promise.all([
                    leaveApi.getLeaves({ associate_id: user?.associate_id }),
                    leaveApi.getBalance(user?.associate_id)
                ]);
                setLeaves(lRes.data || []);
                setBalance(bRes.data?.balance || []);
            } else {
                const res = await leaveApi.getTeamLeaves(statusFilter ? { status: statusFilter } : {});
                setTeamLeaves(res.data || []);
            }
        } catch (err) {
            console.error('Error loading leave data:', err);
            showToast('Error loading data', 'error');
        } finally { setLoading(false); }
    };

    // Computed: total days for apply form
    const computedDays = useMemo(() => {
        if (applyForm.half_day) return 0.5;
        if (!applyForm.from_date || !applyForm.to_date) return 0;
        try {
            const start = new Date(applyForm.from_date);
            const end = new Date(applyForm.to_date);
            if (end < start) return 0;
            let days = 0;
            const cur = new Date(start);
            while (cur <= end) {
                if (cur.getDay() !== 0 && cur.getDay() !== 6) days++;
                cur.setDate(cur.getDate() + 1);
            }
            return days;
        } catch { return 0; }
    }, [applyForm.from_date, applyForm.to_date, applyForm.half_day]);

    // Apply leave
    const handleApplyLeave = async () => {
        if (!applyForm.leave_type_code || !applyForm.from_date) {
            showToast('Please fill all required fields', 'error');
            return;
        }
        if (!applyForm.half_day && !applyForm.to_date) {
            showToast('Please select a To date', 'error');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                associate_id: user?.associate_id,
                associate_name: user?.name || user?.associate_name || '',
                leave_type_code: applyForm.leave_type_code,
                from_date: applyForm.from_date,
                to_date: applyForm.half_day ? applyForm.from_date : applyForm.to_date,
                half_day: applyForm.half_day,
                half_day_period: applyForm.half_day ? applyForm.half_day_period : '',
                reason: applyForm.reason,
                total_days: computedDays
            };
            const res = await leaveApi.applyLeave(payload);
            showToast(res.data?.message || 'Leave applied!', 'success');
            setShowApplyModal(false);
            setApplyForm({ leave_type_code: '', from_date: '', to_date: '', half_day: false, half_day_period: 'first_half', reason: '' });
            loadData();
        } catch (err) {
            showToast('Error applying leave: ' + (err.response?.data?.detail || err.message), 'error');
        } finally { setSaving(false); }
    };

    // Approve leave
    const handleApprove = async (leaveId) => {
        if (!confirm('Approve this leave application?')) return;
        setSaving(true);
        try {
            await leaveApi.approveLeave(leaveId);
            showToast('Leave approved successfully', 'success');
            loadData();
        } catch (err) {
            showToast('Error: ' + (err.response?.data?.detail || err.message), 'error');
        } finally { setSaving(false); }
    };

    // Reject leave
    const openRejectModal = (leaveId) => { setRejectLeaveId(leaveId); setRejectRemarks(''); setShowRejectModal(true); };
    const handleReject = async () => {
        setSaving(true);
        try {
            await leaveApi.rejectLeave(rejectLeaveId, { remarks: rejectRemarks });
            showToast('Leave rejected', 'success');
            setShowRejectModal(false);
            loadData();
        } catch (err) {
            showToast('Error: ' + (err.response?.data?.detail || err.message), 'error');
        } finally { setSaving(false); }
    };

    // Filtered team leaves
    const filteredTeamLeaves = useMemo(() => {
        let list = teamLeaves;
        if (statusFilter) list = list.filter(l => l.status.toLowerCase() === statusFilter.toLowerCase());
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(l => l.associate_name.toLowerCase().includes(q) || l.leave_type_code.toLowerCase().includes(q));
        }
        return list;
    }, [teamLeaves, statusFilter, searchQuery]);

    // Format date
    const fmtDate = (d) => {
        try {
            return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch { return d; }
    };

    return (
        <div className="page-container">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h4 style={{ margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CalendarRange size={24} className="text-primary" />
                        Leave Management
                    </h4>
                    <p className="text-muted small" style={{ margin: '0.25rem 0 0' }}>Apply for leave, track balances, and manage approvals</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {showTeamView && (
                        <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: '8px', padding: '3px' }}>
                            <button
                                className={`btn btn-sm ${view === 'self' ? 'btn-primary' : ''}`}
                                style={{ borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', fontWeight: 600, ...(view !== 'self' ? { background: 'transparent', border: 'none', color: 'var(--gray-500)' } : {}) }}
                                onClick={() => setView('self')}>
                                <User size={14} /> My Leaves
                            </button>
                            <button
                                className={`btn btn-sm ${view === 'team' ? 'btn-primary' : ''}`}
                                style={{ borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', fontWeight: 600, ...(view !== 'team' ? { background: 'transparent', border: 'none', color: 'var(--gray-500)' } : {}) }}
                                onClick={() => setView('team')}>
                                <Users size={14} /> Team Leaves
                            </button>
                        </div>
                    )}
                    {view === 'self' && (
                        <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                            onClick={() => setShowApplyModal(true)}>
                            <Plus size={16} /> Apply Leave
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>
                    <div className="spinner-border text-primary" role="status"></div>
                    <p className="mt-2 text-muted">Loading...</p>
                </div>
            ) : view === 'self' ? (
                /* ── My Leaves View ── */
                <div>
                    {/* Balance Cards */}
                    {balance.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                            {balance.map(b => (
                                <div key={b.leave_type_code} className="card" style={{ padding: '1.25rem', borderLeft: `4px solid ${b.available > 0 ? 'var(--primary-500)' : 'var(--error-400)'}` }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                        {b.leave_type_name}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                        <div>
                                            <span style={{ fontSize: '1.75rem', fontWeight: 700, color: b.available > 0 ? 'var(--primary-600)' : 'var(--error-600)' }}>{b.available}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginLeft: '0.25rem' }}>available</span>
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', textAlign: 'right' }}>
                                            <div>{b.entitled} entitled</div>
                                            <div>{b.used} used</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* My Leaves Table */}
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h6 style={{ margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CalendarDays size={16} className="text-primary" />
                                My Applications
                                <span className="badge bg-primary-subtle text-primary rounded-pill" style={{ fontSize: '0.7rem' }}>{leaves.length}</span>
                            </h6>
                        </div>
                        {leaves.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>
                                <CalendarRange size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                                <p style={{ fontWeight: 600, color: 'var(--gray-600)', marginBottom: '0.25rem' }}>No leave applications yet</p>
                                <p className="text-muted small">Click "Apply Leave" to submit your first application.</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="data-table">
                                    <thead><tr>
                                        <th>Leave Type</th>
                                        <th>From</th>
                                        <th>To</th>
                                        <th>Days</th>
                                        <th>Status</th>
                                        <th>Applied On</th>
                                        <th>Remarks</th>
                                    </tr></thead>
                                    <tbody>
                                        {leaves.map(l => {
                                            const st = STATUS_STYLES[l.status] || STATUS_STYLES.Pending;
                                            return (
                                                <tr key={l.id}>
                                                    <td>
                                                        <span style={{ fontWeight: 600 }}>{l.leave_type_code}</span>
                                                        {l.half_day && <span className="badge" style={{ marginLeft: '0.5rem', fontSize: '0.65rem', background: 'var(--info-50)', color: 'var(--info-600)' }}>Half Day</span>}
                                                    </td>
                                                    <td>{fmtDate(l.from_date)}</td>
                                                    <td>{fmtDate(l.to_date)}</td>
                                                    <td><span style={{ fontWeight: 600 }}>{l.total_days}</span></td>
                                                    <td>
                                                        <span className="badge" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                                                            {l.status}
                                                        </span>
                                                    </td>
                                                    <td className="text-muted small">{fmtDate(l.applied_on?.split(' ')[0])}</td>
                                                    <td className="text-muted small" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {l.remarks || l.reason || '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* ── Team Leaves View ── */
                <div>
                    {/* Filters */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '320px' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                            <input type="text" className="form-input" placeholder="Search by name or leave type..."
                                style={{ paddingLeft: '2rem', fontSize: '0.82rem' }}
                                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                            {['', 'Pending', 'Approved', 'Rejected'].map(s => (
                                <button key={s}
                                    className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ fontSize: '0.78rem', borderRadius: '20px' }}
                                    onClick={() => { setStatusFilter(s); loadData(); }}>
                                    {s || 'All'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h6 style={{ margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Users size={16} className="text-primary" />
                                Team Leave Applications
                                <span className="badge bg-primary-subtle text-primary rounded-pill" style={{ fontSize: '0.7rem' }}>{filteredTeamLeaves.length}</span>
                            </h6>
                        </div>
                        {filteredTeamLeaves.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>
                                <Users size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                                <p style={{ fontWeight: 600, color: 'var(--gray-600)', marginBottom: '0.25rem' }}>No leave applications</p>
                                <p className="text-muted small">No pending leave applications from your team.</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="data-table">
                                    <thead><tr>
                                        <th>Associate</th>
                                        <th>Leave Type</th>
                                        <th>From</th>
                                        <th>To</th>
                                        <th>Days</th>
                                        <th>Reason</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right', width: '140px' }}>Actions</th>
                                    </tr></thead>
                                    <tbody>
                                        {filteredTeamLeaves.map(l => {
                                            const st = STATUS_STYLES[l.status] || STATUS_STYLES.Pending;
                                            return (
                                                <tr key={l.id}>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontWeight: 600 }}>{l.associate_name}</span>
                                                            <span className="text-muted" style={{ fontSize: '0.7rem' }}>{l.associate_id}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight: 600 }}>{l.leave_type_code}</span>
                                                        {l.half_day && <span className="badge" style={{ marginLeft: '0.5rem', fontSize: '0.65rem', background: 'var(--info-50)', color: 'var(--info-600)' }}>Half Day</span>}
                                                    </td>
                                                    <td>{fmtDate(l.from_date)}</td>
                                                    <td>{fmtDate(l.to_date)}</td>
                                                    <td><span style={{ fontWeight: 600 }}>{l.total_days}</span></td>
                                                    <td className="text-muted small" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {l.reason || '—'}
                                                    </td>
                                                    <td>
                                                        <span className="badge" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                                                            {l.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {l.status === 'Pending' ? (
                                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                                                                <button className="btn btn-sm" title="Approve"
                                                                    style={{ background: 'var(--success-50)', color: 'var(--success-600)', border: '1px solid var(--success-200)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px' }}
                                                                    onClick={() => handleApprove(l.id)} disabled={saving}>
                                                                    <CheckCircle2 size={13} /> Approve
                                                                </button>
                                                                <button className="btn btn-sm" title="Reject"
                                                                    style={{ background: 'var(--error-50)', color: 'var(--error-600)', border: '1px solid var(--error-200)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px' }}
                                                                    onClick={() => openRejectModal(l.id)} disabled={saving}>
                                                                    <XCircle size={13} /> Reject
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted small">{l.approved_by ? `by ${l.approved_by}` : '—'}</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Apply Leave Modal ── */}
            <Modal isOpen={showApplyModal} onClose={() => setShowApplyModal(false)} title="Apply for Leave" size="lg"
                footer={
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-secondary" onClick={() => setShowApplyModal(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleApplyLeave} disabled={saving}>
                            {saving ? 'Submitting...' : 'Submit Application'}
                        </button>
                    </div>
                }>
                <div className="form-grid">
                    {/* Leave Type */}
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Leave Type *</label>
                        <select className="form-select form-input" value={applyForm.leave_type_code}
                            onChange={e => setApplyForm({ ...applyForm, leave_type_code: e.target.value })}>
                            <option value="">Select Leave Type</option>
                            {balance.map(b => (
                                <option key={b.leave_type_code} value={b.leave_type_code}>
                                    {b.leave_type_name} ({b.leave_type_code}) — {b.available} days available
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Half Day Toggle */}
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input type="checkbox" checked={applyForm.half_day}
                                onChange={e => setApplyForm({ ...applyForm, half_day: e.target.checked })}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--primary-500)' }} />
                            <span style={{ fontWeight: 600 }}>Half Day Leave</span>
                        </label>
                        {applyForm.half_day && (
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                                    <input type="radio" name="half_period" value="first_half"
                                        checked={applyForm.half_day_period === 'first_half'}
                                        onChange={() => setApplyForm({ ...applyForm, half_day_period: 'first_half' })} />
                                    First Half (Morning)
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                                    <input type="radio" name="half_period" value="second_half"
                                        checked={applyForm.half_day_period === 'second_half'}
                                        onChange={() => setApplyForm({ ...applyForm, half_day_period: 'second_half' })} />
                                    Second Half (Afternoon)
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Dates */}
                    <div className="form-group">
                        <label className="form-label">{applyForm.half_day ? 'Date *' : 'From Date *'}</label>
                        <input type="date" className="form-input" value={applyForm.from_date}
                            onChange={e => setApplyForm({ ...applyForm, from_date: e.target.value })} />
                    </div>
                    {!applyForm.half_day && (
                        <div className="form-group">
                            <label className="form-label">To Date *</label>
                            <input type="date" className="form-input" value={applyForm.to_date}
                                min={applyForm.from_date}
                                onChange={e => setApplyForm({ ...applyForm, to_date: e.target.value })} />
                        </div>
                    )}

                    {/* Total Days */}
                    {computedDays > 0 && (
                        <div className="form-group" style={{ gridColumn: applyForm.half_day ? '2' : 'span 2' }}>
                            <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CalendarDays size={16} style={{ color: 'var(--primary-500)' }} />
                                <span style={{ fontWeight: 700, color: 'var(--primary-600)', fontSize: '1rem' }}>{computedDays}</span>
                                <span style={{ color: 'var(--primary-500)', fontSize: '0.82rem' }}>working day{computedDays !== 1 ? 's' : ''}</span>
                                {applyForm.half_day && <span style={{ color: 'var(--info-500)', fontSize: '0.75rem' }}>({applyForm.half_day_period === 'first_half' ? 'Morning' : 'Afternoon'})</span>}
                            </div>
                        </div>
                    )}

                    {/* Selected type balance */}
                    {applyForm.leave_type_code && (() => {
                        const sel = balance.find(b => b.leave_type_code === applyForm.leave_type_code);
                        if (!sel) return null;
                        return (
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <div style={{ background: sel.available > 0 ? 'var(--success-50)' : 'var(--error-50)', border: `1px solid ${sel.available > 0 ? 'var(--success-200)' : 'var(--error-200)'}`, borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: sel.available > 0 ? 'var(--success-600)' : 'var(--error-600)' }}>
                                        {sel.leave_type_name} Balance
                                    </span>
                                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem' }}>
                                        <span>Entitled: <strong>{sel.entitled}</strong></span>
                                        <span>Used: <strong>{sel.used}</strong></span>
                                        <span>Available: <strong style={{ color: sel.available > 0 ? 'var(--success-600)' : 'var(--error-600)' }}>{sel.available}</strong></span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Reason */}
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Reason</label>
                        <textarea className="form-textarea" rows={3} value={applyForm.reason}
                            onChange={e => setApplyForm({ ...applyForm, reason: e.target.value })}
                            placeholder="Optional: provide a reason for your leave" />
                    </div>
                </div>
            </Modal>

            {/* ── Reject Modal ── */}
            <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Leave Application"
                footer={
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
                        <button className="btn btn-primary" style={{ background: 'var(--error-500)', borderColor: 'var(--error-500)' }}
                            onClick={handleReject} disabled={saving}>
                            {saving ? 'Rejecting...' : 'Reject Leave'}
                        </button>
                    </div>
                }>
                <div className="form-group">
                    <label className="form-label">Reason for rejection</label>
                    <textarea className="form-textarea" rows={3} value={rejectRemarks}
                        onChange={e => setRejectRemarks(e.target.value)}
                        placeholder="Provide a reason for rejecting this leave" />
                </div>
            </Modal>
        </div>
    );
}

export default Leaves;
