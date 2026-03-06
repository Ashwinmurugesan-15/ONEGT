import { useState, useEffect } from 'react';
import { BookOpen, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAssessment } from '../context/AssessmentContext';
import LearningResourceCard from '../components/LearningResourceCard';
import LearningResourceForm from '../components/LearningResourceForm';
import { useLocation } from 'react-router-dom';

export default function LearningResources() {
    const { user, getAuthHeader } = useAuth();
    const { learningResources, loading, refreshResources } = useAssessment();
    const location = useLocation();
    const [showForm, setShowForm] = useState(location.state?.openAddResource || false);
    const [editingResource, setEditingResource] = useState(null);
    const [saving, setSaving] = useState(false);
    const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
    const [selectedResource, setSelectedResource] = useState(null);

    // Clear the state so refreshing the page doesn't keep opening the form
    useEffect(() => {
        if (location.state?.openAddResource) {
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const handleSave = async (data) => {
        setSaving(true);
        try {
            const method = editingResource ? 'PUT' : 'POST';
            const url = editingResource
                ? `/api/assessment/learning/${editingResource.id}`
                : '/api/assessment/learning';

            const payload = editingResource
                ? { ...data, user_role: user.role }
                : { ...data, created_by: user.id, user_role: user.role };

            const res = await fetch(url, {
                method,
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                await refreshResources();
                setShowForm(false);
                setEditingResource(null);
            } else {
                const err = await res.json();
                alert(`Error: ${err.error || 'Failed to save'}`);
            }
        } catch (error) {
            console.error(error);
            alert('Failed to save learning resource');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (resource) => {
        if (!confirm(`Are you sure you want to delete "${resource.title}"?`)) return;
        try {
            const res = await fetch(`/api/assessment/learning/${resource.id}?user_role=${user.role}`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });
            if (res.ok) {
                await refreshResources();
            } else {
                alert('Failed to delete resource');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleRecordView = async (resourceId) => {
        if (user.role !== 'candidate') return;
        try {
            await fetch('/api/assessment/learning/progress', {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ resourceId, userId: user.id })
            });
        } catch (e) {
            console.error('Failed to record view', e);
        }
    };

    const handleViewAnalytics = (resource) => {
        setSelectedResource(resource);
        setAnalyticsModalOpen(true);
    };

    if (loading && learningResources.length === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-amber-600 mb-4" size={48} />
                <p className="text-gray-500 font-medium">Loading materials...</p>
            </div>
        );
    }

    const canManage = user.role === 'admin' || user.role === 'examiner';

    return (
        <div className="space-y-10 animate-fade-in pb-20">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Learning Resources</h1>
                    <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
                        Manage course materials and learning content for candidates
                    </p>
                </div>
                {canManage && !showForm && (
                    <button
                        onClick={() => { setEditingResource(null); setShowForm(true); }}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '0.625rem 1.25rem',
                            background: 'linear-gradient(135deg, #0066b3 0%, #0080cc 50%, #5cc8e6 100%)',
                            color: 'white', fontWeight: 600, fontSize: '0.875rem',
                            border: 'none', borderRadius: '0.75rem', cursor: 'pointer',
                            boxShadow: '0 4px 15px rgba(0,102,179,0.35)',
                        }}
                    >
                        <Plus size={18} />
                        Add Resource
                    </button>
                )}
            </div>

            {/* Form Section */}
            {showForm && (
                <div style={{
                    background: 'white', borderRadius: '1.25rem', padding: '2rem',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
                    border: '1px solid rgba(255,255,255,0.8)', marginBottom: '1.5rem'
                }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem', marginTop: 0 }}>
                        {editingResource ? 'Edit Learning Resource' : 'Create New Learning Resource'}
                    </h3>
                    <LearningResourceForm
                        resource={editingResource}
                        onSave={handleSave}
                        onCancel={() => { setShowForm(false); setEditingResource(null); }}
                        loading={saving}
                    />
                </div>
            )}

            {/* Resources Grid */}
            <div>
                {learningResources.length === 0 ? (
                    <div className="text-center py-32 bg-gray-50/50 rounded-[3rem] border-4 border-dashed border-gray-100">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
                            <BookOpen size={48} className="text-gray-200" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">Knowledge Base Empty</h3>
                        <p className="text-gray-500 max-w-xs mx-auto">Stay tuned! We'll be adding helpful learning materials very soon.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {learningResources.map(resource => (
                            <LearningResourceCard
                                key={resource.id}
                                resource={resource}
                                showActions={canManage}
                                onEdit={() => { setEditingResource(resource); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                onDelete={() => handleDelete(resource)}
                                onRecordView={handleRecordView}
                                onViewAnalytics={() => handleViewAnalytics(resource)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {selectedResource && (
                <AnalyticsModal
                    isOpen={analyticsModalOpen}
                    onClose={() => { setAnalyticsModalOpen(false); setSelectedResource(null); }}
                    resourceId={selectedResource.id}
                    resourceTitle={selectedResource.title}
                />
            )}
        </div>
    );
}
