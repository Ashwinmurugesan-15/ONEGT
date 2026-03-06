import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { performanceApi } from '../../services/api';
import {
    Calendar, Plus, Play, CheckCircle2, Clock, Edit3,
    Save, X, AlertCircle, Users, ChevronRight
} from 'lucide-react';

const STATUS_COLORS = {
    'Draft': { bg: 'var(--gray-100)', color: 'var(--gray-600)' },
    'Active': { bg: '#dcfce7', color: '#16a34a' },
    'Closed': { bg: '#dbeafe', color: '#2563eb' },
};

export default function AppraisalCycles() {
    const { user, isAdmin } = useAuth();
    const { showToast } = useToast();
    const [cycles, setCycles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [initiating, setInitiating] = useState(null);

    const [formData, setFormData] = useState({
        name: '', year: new Date().getFullYear(), cycle_type: 'Annual',
        start_date: '', end_date: ''
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const res = await performanceApi.getCycles();
            setCycles(res.data || []);
        } catch (error) {
            showToast('Error loading cycles', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.year) return;
        setSaving(true);
        try {
            await performanceApi.createCycle(formData);
            showToast('Cycle created successfully!', 'success');
            setShowForm(false);
            setFormData({ name: '', year: new Date().getFullYear(), cycle_type: 'Annual', start_date: '', end_date: '' });
            loadData();
        } catch (error) {
            showToast(error.response?.data?.detail || 'Error creating cycle', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleInitiate = async (cycleId) => {
        if (!confirm('This will generate appraisal documents for all eligible associates. Continue?')) return;
        setInitiating(cycleId);
        try {
            const res = await performanceApi.initiateCycle(cycleId, {});
            showToast(`${res.data.count} appraisals initiated successfully!`, 'success');
            loadData();
        } catch (error) {
            showToast(error.response?.data?.detail || 'Error initiating cycle', 'error');
        } finally {
            setInitiating(null);
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <div className="loading-spinner"></div>
        </div>
    );

    return (
        <div style={{ maxWidth: '1000px', animation: 'fadeIn 0.5s ease-out' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-xl)', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}>
                        <Calendar size={24} color="white" />
                    </div>
                    <div>
                        <h1 className="card-title" style={{ fontSize: '1.5rem', marginBottom: '0.125rem' }}>Appraisal Cycles</h1>
                        <p className="text-muted small">Manage annual and mid-year review cycles</p>
                    </div>
                </div>
                {isAdmin && (
                    <button className="btn btn-primary d-flex align-items-center gap-2 shadow-sm" onClick={() => setShowForm(!showForm)}>
                        {showForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> New Cycle</>}
                    </button>
                )}
            </div>

            {/* Create Form */}
            {showForm && (
                <div className="card shadow-md border-0 mb-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <form onSubmit={handleCreate}>
                        <div className="card-body p-4">
                            <div className="row g-3">
                                <div className="col-md-4">
                                    <label className="form-label small fw-bold">Cycle Name *</label>
                                    <input type="text" className="form-control form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Annual Review 2026" required />
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label small fw-bold">Year *</label>
                                    <input type="number" className="form-control form-input" value={formData.year} onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })} required />
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label small fw-bold">Type</label>
                                    <select className="form-select form-input" value={formData.cycle_type} onChange={e => setFormData({ ...formData, cycle_type: e.target.value })}>
                                        <option>Annual</option>
                                        <option>Mid-Year</option>
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label small fw-bold">Start Date</label>
                                    <input type="date" className="form-control form-input" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label small fw-bold">End Date</label>
                                    <input type="date" className="form-control form-input" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                                </div>
                            </div>
                        </div>
                        <div className="card-footer bg-white p-3 border-top d-flex justify-content-end gap-3">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                            <button type="submit" className="btn btn-primary d-flex align-items-center gap-2" disabled={saving}>
                                {saving ? <span className="spinner-border spinner-border-sm"></span> : <Save size={16} />} Create Cycle
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Cycles Grid */}
            {cycles.length === 0 ? (
                <div className="card shadow-md border-0">
                    <div className="card-body text-center p-5">
                        <Calendar size={48} className="text-muted mb-3" style={{ opacity: 0.3 }} />
                        <h6 className="fw-bold">No Appraisal Cycles</h6>
                        <p className="text-muted small">Create your first appraisal cycle to begin</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
                    {cycles.map(cycle => {
                        const st = STATUS_COLORS[cycle.status] || STATUS_COLORS['Draft'];
                        return (
                            <div key={cycle.cycle_id} className="card shadow-sm border-0" style={{ transition: 'all 0.3s ease' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                            >
                                <div className="card-body p-4">
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div>
                                            <h6 className="fw-bold mb-1">{cycle.name}</h6>
                                            <div className="text-muted small">{cycle.cycle_type} • {cycle.year}</div>
                                        </div>
                                        <span style={{ padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, background: st.bg, color: st.color }}>
                                            {cycle.status}
                                        </span>
                                    </div>
                                    {cycle.start_date && (
                                        <div className="text-muted small mb-3 d-flex align-items-center gap-1">
                                            <Clock size={12} /> {cycle.start_date} — {cycle.end_date}
                                        </div>
                                    )}
                                    {isAdmin && cycle.status === 'Draft' && (
                                        <button className="btn btn-primary btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
                                            onClick={() => handleInitiate(cycle.cycle_id)} disabled={initiating === cycle.cycle_id}>
                                            {initiating === cycle.cycle_id ? (
                                                <><span className="spinner-border spinner-border-sm"></span> Initiating...</>
                                            ) : (
                                                <><Play size={14} /> Initiate Cycle</>
                                            )}
                                        </button>
                                    )}
                                    {cycle.status === 'Active' && (
                                        <div className="d-flex align-items-center gap-2 text-success small fw-semibold" style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', background: '#dcfce7' }}>
                                            <CheckCircle2 size={14} /> Cycle is active — appraisals in progress
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
