import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { performanceApi } from '../../services/api';
import {
    Star, Search, Filter, Download, ChevronRight, Users,
    Clock, CheckCircle2, AlertCircle, FileText, BarChart3
} from 'lucide-react';

const STATUS_COLORS = {
    'Draft': { bg: 'var(--gray-100)', color: 'var(--gray-600)', icon: FileText },
    'Self-Appraisal Pending': { bg: '#fef3c7', color: '#d97706', icon: Clock },
    'Manager Review Pending': { bg: '#dbeafe', color: '#2563eb', icon: Users },
    'Pending Acknowledgement': { bg: '#e0e7ff', color: '#4338ca', icon: AlertCircle },
    'Closed': { bg: '#dcfce7', color: '#16a34a', icon: CheckCircle2 },
};

export default function AppraisalList() {
    const { user, isAdmin } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [appraisals, setAppraisals] = useState([]);
    const [cycles, setCycles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [cycleFilter, setCycleFilter] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [aRes, cRes] = await Promise.all([
                performanceApi.getAppraisals(isAdmin ? {} : { associate_id: user?.associate_id }),
                performanceApi.getCycles()
            ]);
            setAppraisals(aRes.data || []);
            setCycles(cRes.data || []);
        } catch (error) {
            showToast('Error loading appraisals', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filtered = appraisals.filter(a => {
        if (search && !a.associate_name?.toLowerCase().includes(search.toLowerCase()) && !a.designation?.toLowerCase().includes(search.toLowerCase())) return false;
        if (statusFilter && a.status !== statusFilter) return false;
        if (cycleFilter && a.cycle_id !== cycleFilter) return false;
        return true;
    });

    const handleExport = async () => {
        try {
            const res = await performanceApi.exportAppraisals({ cycle_id: cycleFilter || undefined });
            const data = res.data || [];
            if (!data.length) { showToast('No data to export', 'info'); return; }
            // Convert to CSV
            const headers = ['Associate', 'Designation', 'Department', 'Status', 'Self Score', 'Manager Score', 'Cycle'];
            const rows = data.map(a => [a.associate_name, a.designation, a.department, a.status, a.overall_self_score, a.overall_mgr_score, a.cycle_id]);
            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'appraisals_export.csv'; a.click();
            URL.revokeObjectURL(url);
            showToast('Export downloaded!', 'success');
        } catch (error) {
            showToast('Error exporting data', 'error');
        }
    };

    const StatusBadge = ({ status }) => {
        const config = STATUS_COLORS[status] || STATUS_COLORS['Draft'];
        const Icon = config.icon;
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.75rem', borderRadius: '999px', background: config.bg, color: config.color, fontSize: '0.72rem', fontWeight: 600 }}>
                <Icon size={12} />
                {status}
            </span>
        );
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <div className="loading-spinner"></div>
        </div>
    );

    return (
        <div style={{ maxWidth: '1200px', animation: 'fadeIn 0.5s ease-out' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-xl)', background: 'linear-gradient(135deg, #6366f1, #4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
                        <Star size={24} color="white" />
                    </div>
                    <div>
                        <h1 className="card-title" style={{ fontSize: '1.5rem', marginBottom: '0.125rem' }}>Appraisals</h1>
                        <p className="text-muted small">{filtered.length} appraisal{filtered.length !== 1 ? 's' : ''} found</p>
                    </div>
                </div>
                {isAdmin && (
                    <button className="btn btn-outline-primary d-flex align-items-center gap-2" onClick={handleExport}>
                        <Download size={16} /> Export CSV
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="card shadow-sm border-0 mb-4">
                <div className="card-body p-3 d-flex gap-3 flex-wrap align-items-center">
                    <div className="flex-fill" style={{ minWidth: '200px' }}>
                        <div className="input-group">
                            <span className="input-group-text bg-white"><Search size={16} className="text-muted" /></span>
                            <input type="text" className="form-control" placeholder="Search by name or designation..." value={search} onChange={e => setSearch(e.target.value)} style={{ border: 'none', boxShadow: 'none' }} />
                        </div>
                    </div>
                    <select className="form-select form-input" style={{ width: 'auto', minWidth: '180px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="">All Statuses</option>
                        {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="form-select form-input" style={{ width: 'auto', minWidth: '180px' }} value={cycleFilter} onChange={e => setCycleFilter(e.target.value)}>
                        <option value="">All Cycles</option>
                        {cycles.map(c => <option key={c.cycle_id} value={c.cycle_id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="card shadow-md border-0">
                <div className="card-body p-0">
                    {filtered.length === 0 ? (
                        <div className="text-center p-5">
                            <Star size={48} className="text-muted mb-3" style={{ opacity: 0.3 }} />
                            <h6 className="fw-bold">No Appraisals Found</h6>
                            <p className="text-muted small">Adjust your filters or wait for a cycle to be initiated</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead>
                                    <tr style={{ background: 'var(--gray-50)' }}>
                                        <th className="px-4 py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Associate</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Designation</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Department</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Status</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted text-center" style={{ letterSpacing: '0.05em' }}>Self</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted text-center" style={{ letterSpacing: '0.05em' }}>Manager</th>
                                        <th className="px-4 py-3 text-end small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(a => (
                                        <tr key={a.appraisal_id} className="hover-row">
                                            <td className="px-4 py-3">
                                                <div className="fw-bold text-dark">{a.associate_name}</div>
                                                <div className="text-muted" style={{ fontSize: '0.7rem' }}>{a.associate_id}</div>
                                            </td>
                                            <td className="py-3 text-muted small">{a.designation}</td>
                                            <td className="py-3 text-muted small">{a.department}</td>
                                            <td className="py-3"><StatusBadge status={a.status} /></td>
                                            <td className="py-3 text-center">
                                                <span className="fw-bold" style={{ color: a.overall_self_score ? 'var(--primary-600)' : 'var(--gray-400)' }}>
                                                    {a.overall_self_score || '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 text-center">
                                                <span className="fw-bold" style={{ color: a.overall_mgr_score ? '#16a34a' : 'var(--gray-400)' }}>
                                                    {a.overall_mgr_score || '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-end">
                                                <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 ms-auto"
                                                    onClick={() => navigate(`/performance/appraisals/${a.appraisal_id}`)}>
                                                    {a.status === 'Self-Appraisal Pending' ? 'Fill' :
                                                        a.status === 'Manager Review Pending' ? 'Review' :
                                                            a.status === 'Pending Acknowledgement' ? 'Acknowledge' : 'View'}
                                                    <ChevronRight size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .hover-row:hover { background: var(--gray-50); }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
