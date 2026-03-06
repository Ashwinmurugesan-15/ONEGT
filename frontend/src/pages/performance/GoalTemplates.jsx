import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { performanceApi } from '../../services/api';
import {
    Target, Plus, Copy, Trash2, Edit3, ChevronDown, ChevronRight,
    CheckCircle2, AlertTriangle, Save, X, GripVertical, Layers
} from 'lucide-react';

const EMPTY_CATEGORY = { name: '', weight: 0, goals: [] };
const EMPTY_GOAL = { description: '', expected_outcome: '', target_metric: '', is_mandatory: true };

export default function GoalTemplates() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showClone, setShowClone] = useState(null);
    const [expandedTemplate, setExpandedTemplate] = useState(null);
    const [designations, setDesignations] = useState([]);

    // Form state
    const [formData, setFormData] = useState({
        name: '', designation_id: '', year: new Date().getFullYear(),
        categories: [{ ...EMPTY_CATEGORY, goals: [{ ...EMPTY_GOAL }] }]
    });

    // Clone form
    const [cloneData, setCloneData] = useState({ new_name: '', new_designation_id: '', new_year: new Date().getFullYear() });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [tRes] = await Promise.all([
                performanceApi.getTemplates()
            ]);
            setTemplates(tRes.data || []);
            // Try to get designations for the dropdown
            try {
                const { associatesApi } = await import('../../services/api');
                // We'll just use the API or hardcode common ones
            } catch (e) { }
        } catch (error) {
            showToast('Error loading templates', 'error');
        } finally {
            setLoading(false);
        }
    };

    const totalWeight = formData.categories.reduce((sum, c) => sum + (parseFloat(c.weight) || 0), 0);
    const isValid = formData.name && formData.year && Math.abs(totalWeight - 100) < 0.01;

    const addCategory = () => {
        setFormData({ ...formData, categories: [...formData.categories, { ...EMPTY_CATEGORY, goals: [{ ...EMPTY_GOAL }] }] });
    };

    const removeCategory = (idx) => {
        const cats = [...formData.categories];
        cats.splice(idx, 1);
        setFormData({ ...formData, categories: cats });
    };

    const updateCategory = (idx, field, value) => {
        const cats = [...formData.categories];
        cats[idx] = { ...cats[idx], [field]: field === 'weight' ? parseFloat(value) || 0 : value };
        setFormData({ ...formData, categories: cats });
    };

    const addGoal = (catIdx) => {
        const cats = [...formData.categories];
        cats[catIdx].goals = [...(cats[catIdx].goals || []), { ...EMPTY_GOAL }];
        setFormData({ ...formData, categories: cats });
    };

    const removeGoal = (catIdx, goalIdx) => {
        const cats = [...formData.categories];
        cats[catIdx].goals.splice(goalIdx, 1);
        setFormData({ ...formData, categories: cats });
    };

    const updateGoal = (catIdx, goalIdx, field, value) => {
        const cats = [...formData.categories];
        cats[catIdx].goals[goalIdx] = { ...cats[catIdx].goals[goalIdx], [field]: value };
        setFormData({ ...formData, categories: cats });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isValid) {
            showToast('Please ensure all fields are filled and weights sum to 100%', 'error');
            return;
        }
        setSaving(true);
        try {
            await performanceApi.createTemplate(formData);
            showToast('Template created successfully!', 'success');
            setShowForm(false);
            setFormData({ name: '', designation_id: '', year: new Date().getFullYear(), categories: [{ ...EMPTY_CATEGORY, goals: [{ ...EMPTY_GOAL }] }] });
            loadData();
        } catch (error) {
            showToast(error.response?.data?.detail || 'Error creating template', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleClone = async () => {
        if (!showClone || !cloneData.new_name) return;
        setSaving(true);
        try {
            await performanceApi.cloneTemplate(showClone, cloneData);
            showToast('Template cloned successfully!', 'success');
            setShowClone(null);
            loadData();
        } catch (error) {
            showToast(error.response?.data?.detail || 'Error cloning template', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (tid) => {
        if (!confirm('Delete this template and all its categories/goals?')) return;
        try {
            await performanceApi.deleteTemplate(tid);
            showToast('Template deleted', 'success');
            loadData();
        } catch (error) {
            showToast('Error deleting template', 'error');
        }
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
                    <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-xl)', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
                        <Target size={24} color="white" />
                    </div>
                    <div>
                        <h1 className="card-title" style={{ fontSize: '1.5rem', marginBottom: '0.125rem' }}>Goal Templates</h1>
                        <p className="text-muted small">Define appraisal structures with categories, weights, and KPIs</p>
                    </div>
                </div>
                <button className="btn btn-primary d-flex align-items-center gap-2 shadow-sm" onClick={() => setShowForm(!showForm)}>
                    {showForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> New Template</>}
                </button>
            </div>

            {/* Create Template Form */}
            {showForm && (
                <div className="card shadow-md border-0 mb-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <form onSubmit={handleSubmit}>
                        <div className="card-header bg-white border-bottom p-4">
                            <h5 className="card-title mb-1">Create New Template</h5>
                            <p className="text-muted small mb-0">Define categories with weights that must total 100%</p>
                        </div>
                        <div className="card-body p-4">
                            {/* Template Header */}
                            <div className="row g-3 mb-4">
                                <div className="col-md-4">
                                    <label className="form-label small fw-bold">Template Name *</label>
                                    <input type="text" className="form-control form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. L1 Associate 2026" required />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label small fw-bold">Designation / Level</label>
                                    <input type="text" className="form-control form-input" value={formData.designation_id} onChange={e => setFormData({ ...formData, designation_id: e.target.value })} placeholder="e.g. L1, DES-001" />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label small fw-bold">Year *</label>
                                    <input type="number" className="form-control form-input" value={formData.year} onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })} required />
                                </div>
                            </div>

                            {/* Weight Indicator */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)', background: Math.abs(totalWeight - 100) < 0.01 ? '#dcfce7' : totalWeight > 100 ? '#fef2f2' : '#fef3c7', marginBottom: '1.5rem', transition: 'all 0.3s ease' }}>
                                {Math.abs(totalWeight - 100) < 0.01 ? <CheckCircle2 size={18} color="#16a34a" /> : <AlertTriangle size={18} color={totalWeight > 100 ? '#dc2626' : '#d97706'} />}
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: Math.abs(totalWeight - 100) < 0.01 ? '#16a34a' : totalWeight > 100 ? '#dc2626' : '#d97706' }}>
                                    Total Weight: {totalWeight.toFixed(1)}% {Math.abs(totalWeight - 100) < 0.01 ? '✓' : `(${totalWeight < 100 ? `${(100 - totalWeight).toFixed(1)}% remaining` : `${(totalWeight - 100).toFixed(1)}% over`})`}
                                </span>
                                <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(0,0,0,0.1)', overflow: 'hidden', marginLeft: '0.5rem' }}>
                                    <div style={{ height: '100%', width: `${Math.min(totalWeight, 100)}%`, borderRadius: '3px', background: Math.abs(totalWeight - 100) < 0.01 ? '#16a34a' : totalWeight > 100 ? '#dc2626' : '#d97706', transition: 'all 0.3s ease' }}></div>
                                </div>
                            </div>

                            {/* Categories */}
                            {formData.categories.map((cat, catIdx) => (
                                <div key={catIdx} className="card border mb-3" style={{ borderColor: 'var(--gray-200)' }}>
                                    <div className="card-header bg-gray-50 p-3 d-flex align-items-center gap-3">
                                        <Layers size={16} className="text-primary" />
                                        <div className="row g-2 flex-fill">
                                            <div className="col-md-6">
                                                <input type="text" className="form-control form-control-sm" placeholder="Category Name (e.g. Performance)" value={cat.name} onChange={e => updateCategory(catIdx, 'name', e.target.value)} />
                                            </div>
                                            <div className="col-md-3">
                                                <div className="input-group input-group-sm">
                                                    <input type="number" className="form-control" placeholder="Weight" value={cat.weight || ''} onChange={e => updateCategory(catIdx, 'weight', e.target.value)} min="0" max="100" step="0.5" />
                                                    <span className="input-group-text">%</span>
                                                </div>
                                            </div>
                                        </div>
                                        {formData.categories.length > 1 && (
                                            <button type="button" className="btn btn-sm text-danger" onClick={() => removeCategory(catIdx)}><Trash2 size={16} /></button>
                                        )}
                                    </div>
                                    <div className="card-body p-3">
                                        <div className="small fw-bold text-muted mb-2" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>Goals / KPIs</div>
                                        {(cat.goals || []).map((goal, goalIdx) => (
                                            <div key={goalIdx} className="row g-2 mb-2 align-items-start">
                                                <div className="col-md-5">
                                                    <input type="text" className="form-control form-control-sm" placeholder="Goal Description" value={goal.description} onChange={e => updateGoal(catIdx, goalIdx, 'description', e.target.value)} />
                                                </div>
                                                <div className="col-md-3">
                                                    <input type="text" className="form-control form-control-sm" placeholder="Expected Outcome" value={goal.expected_outcome} onChange={e => updateGoal(catIdx, goalIdx, 'expected_outcome', e.target.value)} />
                                                </div>
                                                <div className="col-md-3">
                                                    <input type="text" className="form-control form-control-sm" placeholder="Target Metric (optional)" value={goal.target_metric} onChange={e => updateGoal(catIdx, goalIdx, 'target_metric', e.target.value)} />
                                                </div>
                                                <div className="col-md-1">
                                                    {(cat.goals || []).length > 1 && (
                                                        <button type="button" className="btn btn-sm text-danger p-1" onClick={() => removeGoal(catIdx, goalIdx)}><X size={14} /></button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <button type="button" className="btn btn-sm btn-light d-flex align-items-center gap-1 mt-2" onClick={() => addGoal(catIdx)}>
                                            <Plus size={14} /> Add Goal
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button type="button" className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1" onClick={addCategory}>
                                <Plus size={14} /> Add Category
                            </button>
                        </div>
                        <div className="card-footer bg-white p-4 border-top d-flex justify-content-end gap-3">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                            <button type="submit" className="btn btn-primary d-flex align-items-center gap-2 shadow-sm" disabled={saving || !isValid}>
                                {saving ? <><span className="spinner-border spinner-border-sm"></span> Saving...</> : <><Save size={16} /> Create Template</>}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Templates List */}
            <div className="card shadow-md border-0">
                <div className="card-body p-0">
                    {templates.length === 0 ? (
                        <div className="text-center p-5">
                            <Target size={48} className="text-muted mb-3" style={{ opacity: 0.3 }} />
                            <h6 className="fw-bold">No Templates Yet</h6>
                            <p className="text-muted small">Create your first goal template to get started</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead>
                                    <tr style={{ background: 'var(--gray-50)' }}>
                                        <th className="px-4 py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em', width: '40px' }}></th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Template Name</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Designation</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Year</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Version</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Status</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Categories</th>
                                        <th className="px-4 py-3 text-end small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {templates.map(t => (
                                        <>
                                            <tr key={t.template_id} className="hover-row" style={{ cursor: 'pointer' }} onClick={() => setExpandedTemplate(expandedTemplate === t.template_id ? null : t.template_id)}>
                                                <td className="px-4 py-3">
                                                    {expandedTemplate === t.template_id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                </td>
                                                <td className="py-3 fw-bold text-dark">{t.name}</td>
                                                <td className="py-3 text-muted">{t.designation_id || 'All'}</td>
                                                <td className="py-3">{t.year}</td>
                                                <td className="py-3">v{t.version}</td>
                                                <td className="py-3">
                                                    <span style={{
                                                        padding: '0.25rem 0.625rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600,
                                                        background: String(t.is_active).toLowerCase() === 'true' ? '#dcfce7' : 'var(--gray-100)',
                                                        color: String(t.is_active).toLowerCase() === 'true' ? '#16a34a' : 'var(--gray-500)'
                                                    }}>
                                                        {String(t.is_active).toLowerCase() === 'true' ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="py-3">{(t.categories || []).length}</td>
                                                <td className="px-4 py-3 text-end" onClick={e => e.stopPropagation()}>
                                                    <div className="d-flex justify-content-end gap-1">
                                                        <button className="btn btn-sm text-primary" title="Clone" onClick={() => { setShowClone(t.template_id); setCloneData({ new_name: `${t.name} (Copy)`, new_designation_id: '', new_year: parseInt(t.year) }); }}>
                                                            <Copy size={16} />
                                                        </button>
                                                        <button className="btn btn-sm text-danger" title="Delete" onClick={() => handleDelete(t.template_id)}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedTemplate === t.template_id && (t.categories || []).map(cat => (
                                                <tr key={cat.category_id} style={{ background: 'var(--gray-50)' }}>
                                                    <td></td>
                                                    <td colSpan={2} className="py-2 ps-4">
                                                        <span className="fw-bold text-primary">{cat.name}</span>
                                                        <span className="badge bg-primary-subtle text-primary rounded-pill ms-2 fw-semibold" style={{ fontSize: '0.65rem' }}>{cat.weight}%</span>
                                                    </td>
                                                    <td colSpan={5} className="py-2">
                                                        {(cat.goals || []).map((g, i) => (
                                                            <div key={i} className="text-muted small mb-1">
                                                                • {g.description} {g.target_metric && <span className="text-primary">({g.target_metric})</span>}
                                                            </div>
                                                        ))}
                                                    </td>
                                                </tr>
                                            ))}
                                        </>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Clone Modal */}
            {showClone && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}>
                    <div className="card shadow-lg" style={{ width: '480px', maxWidth: '90vw', animation: 'fadeIn 0.2s ease-out' }}>
                        <div className="card-header bg-white p-4 border-bottom">
                            <h5 className="card-title mb-0 d-flex align-items-center gap-2"><Copy size={18} className="text-primary" /> Clone Template</h5>
                        </div>
                        <div className="card-body p-4">
                            <div className="mb-3">
                                <label className="form-label small fw-bold">New Template Name *</label>
                                <input type="text" className="form-control form-input" value={cloneData.new_name} onChange={e => setCloneData({ ...cloneData, new_name: e.target.value })} />
                            </div>
                            <div className="row g-3">
                                <div className="col-6">
                                    <label className="form-label small fw-bold">Designation</label>
                                    <input type="text" className="form-control form-input" value={cloneData.new_designation_id} onChange={e => setCloneData({ ...cloneData, new_designation_id: e.target.value })} placeholder="Leave blank to keep same" />
                                </div>
                                <div className="col-6">
                                    <label className="form-label small fw-bold">Year</label>
                                    <input type="number" className="form-control form-input" value={cloneData.new_year} onChange={e => setCloneData({ ...cloneData, new_year: parseInt(e.target.value) })} />
                                </div>
                            </div>
                        </div>
                        <div className="card-footer bg-white p-4 border-top d-flex justify-content-end gap-3">
                            <button className="btn btn-secondary" onClick={() => setShowClone(null)}>Cancel</button>
                            <button className="btn btn-primary d-flex align-items-center gap-2" disabled={saving || !cloneData.new_name} onClick={handleClone}>
                                {saving ? <span className="spinner-border spinner-border-sm"></span> : <Copy size={16} />} Clone
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .hover-row:hover { background: var(--gray-50); }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
