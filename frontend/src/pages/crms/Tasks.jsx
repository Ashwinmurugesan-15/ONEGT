import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Calendar, CheckCircle, Clock, AlertCircle, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import SearchableSelect from '../../components/common/SearchableSelect';
import { crmTasksApi, crmLeadsApi, crmOpportunitiesApi, crmCustomersApi, contactsApi, crmDealsApi } from '../../services/crms_api';
import { associatesApi } from '../../services/api';

const STATUSES = ['Open', 'In Progress', 'Completed', 'Cancelled'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const RELATED_TYPES = ['Lead', 'Opportunity', 'Customer', 'Contact', 'Deal'];

const STATUS_COLORS = {
    'Open': { bg: '#dbeafe', color: '#1e40af' },
    'In Progress': { bg: '#fef3c7', color: '#92400e' },
    'Completed': { bg: '#d1fae5', color: '#065f46' },
    'Cancelled': { bg: '#f3f4f6', color: '#374151' }
};

const PRIORITY_COLORS = {
    'Low': { bg: '#f3f4f6', color: '#374151' },
    'Medium': { bg: '#dbeafe', color: '#1e40af' },
    'High': { bg: '#fef3c7', color: '#92400e' },
    'Urgent': { bg: '#fee2e2', color: '#991b1b' }
};

function Tasks() {
    const { user } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [associates, setAssociates] = useState([]);
    const [relatedOptions, setRelatedOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [newComment, setNewComment] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState(null);

    const [statusFilter, setStatusFilter] = useState('');
    const [formData, setFormData] = useState({
        title: '', description: '', related_type: '', related_id: '',
        due_date: '', priority: 'Medium', status: 'Open', assigned_to: '', comments: []
    });

    useEffect(() => { loadTasks(); loadAssociates(); }, [statusFilter]);

    useEffect(() => {
        if (formData.related_type) {
            fetchRelatedOptions(formData.related_type);
        } else {
            setRelatedOptions([]);
        }
    }, [formData.related_type]);

    const loadTasks = async () => {
        setLoading(true);
        try {
            const response = await crmTasksApi.getAll(statusFilter ? { status: statusFilter } : {});
            setTasks(response.data);
        } catch (error) {
            console.error('Error loading tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAssociates = async () => {
        try {
            const response = await associatesApi.getAll();
            setAssociates(response.data);
        } catch (error) {
            console.error('Error loading associates:', error);
        }
    };

    const fetchRelatedOptions = async (type) => {
        try {
            let response;
            switch (type) {
                case 'Lead': response = await crmLeadsApi.getAll(); break;
                case 'Opportunity': response = await crmOpportunitiesApi.getAll(); break;
                case 'Customer': response = await crmCustomersApi.getAll(); break;
                case 'Contact': response = await contactsApi.getAll(); break;
                case 'Deal': response = await crmDealsApi.getAll(); break;
                default: return;
            }
            if (response && response.data) {
                // Normalize data to {id, name}
                const options = response.data.map(item => ({
                    id: item.id,
                    name: item.name || (item.first_name ? `${item.first_name} ${item.last_name}` : item.title || item.id)
                }));
                setRelatedOptions(options);
            }
        } catch (error) {
            console.error('Error loading related options:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingTask) await crmTasksApi.update(editingTask.id, formData);
            else await crmTasksApi.create(formData);
            setShowModal(false);
            resetForm();
            loadTasks();
        } catch (error) {
            console.error('Error saving task:', error);
        }
    };

    const handleEdit = (task) => {
        setEditingTask(task);
        const newFormData = {
            title: task.title || '', description: task.description || '',
            related_type: task.related_type || '', related_id: task.related_id || '',
            due_date: task.due_date || '', priority: task.priority || 'Medium',
            status: task.status || 'Open', assigned_to: task.assigned_to || '',
            comments: Array.isArray(task.comments) ? task.comments : []
        };
        setFormData(newFormData);
        // Trigger fetch of related options immediately if type exists
        if (newFormData.related_type) {
            fetchRelatedOptions(newFormData.related_type);
        }
        setShowModal(true);
    };

    const handleDelete = (id) => {
        setTaskToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!taskToDelete) return;
        try {
            await crmTasksApi.delete(taskToDelete);
            loadTasks();
            setIsDeleteModalOpen(false);
            setTaskToDelete(null);
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };

    const resetForm = () => {
        setEditingTask(null);
        setFormData({
            title: '', description: '', related_type: '', related_id: '',
            due_date: '', priority: 'Medium', status: 'Open', assigned_to: '', comments: []
        });
        setNewComment('');
        setRelatedOptions([]);
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;

        const commentObj = {
            id: Date.now().toString(),
            author_id: user?.associate_id || 'unknown',
            author_name: user?.name || 'Unknown',
            content: newComment,
            created_at: new Date().toISOString()
        };

        const updatedComments = [...(formData.comments || []), commentObj];
        setFormData({ ...formData, comments: updatedComments });
        setNewComment('');

        // If editing, save immediately (optional, mimicking Jira real-time feel)
        // Or wait for "Update" button.
        // Let's rely on standard "Update" button for now to avoid complexity,
        // UNLESS user expects "Chat" like behavior which usually autosaves.
        // User asked for "like Jira", Jira comments save immediately.
        if (editingTask) {
            try {
                // We only update the comments field to save bandwidth/risk
                // But our API updates whole row. That's fine.
                await crmTasksApi.update(editingTask.id, { ...formData, comments: updatedComments });
                // Also update local task list to reflect change immediately without reload
                setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, comments: updatedComments } : t));
            } catch (error) {
                console.error('Error adding comment:', error);
            }
        }
    };

    const handleDeleteComment = async (commentId) => {
        const updatedComments = (formData.comments || []).filter(c => c.id !== commentId);
        setFormData({ ...formData, comments: updatedComments });

        if (editingTask) {
            try {
                await crmTasksApi.update(editingTask.id, { ...formData, comments: updatedComments });
                setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, comments: updatedComments } : t));
            } catch (error) {
                console.error('Error deleting comment:', error);
            }
        }
    };

    const isOverdue = (dueDate, status) => {
        if (status === 'Completed' || status === 'Cancelled') return false;
        return dueDate && new Date(dueDate) < new Date();
    };

    // Search is handled by DataTable (Removed)
    const filteredTasks = statusFilter ? tasks.filter(t => t.status === statusFilter) : tasks;

    const getAssociateName = (id) => {
        const associate = associates.find(a => a.associate_id === id || a.id === id);
        return associate ? associate.associate_name : id;
    };

    if (loading) return <Loading />;

    return (
        <div>
            <div className="page-header">
                <div><h1 className="page-title">Tasks</h1><p className="page-subtitle">Manage your CRM tasks</p></div>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}><Plus size={20} />Add Task</button>
            </div>

            <div className="kanban-board" style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem', flex: 1 }}>
                {STATUSES.map(status => {
                    const statusTasks = filteredTasks.filter(t => t.status === status);
                    const statusColor = STATUS_COLORS[status] || STATUS_COLORS['Open'];

                    return (
                        <div key={status} style={{ minWidth: '300px', width: '300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ padding: '0.75rem', backgroundColor: statusColor.bg, color: statusColor.color, borderRadius: '0.5rem', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `4px solid ${statusColor.color}` }}>
                                <span>{status}</span>
                                <span style={{ backgroundColor: 'rgba(255,255,255,0.5)', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem' }}>{statusTasks.length}</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)', paddingRight: '0.25rem' }}>
                                {statusTasks.map(task => {
                                    const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS['Medium'];
                                    const overdue = isOverdue(task.due_date, task.status);

                                    return (
                                        <div
                                            key={task.id}
                                            onClick={() => handleEdit(task)}
                                            style={{
                                                backgroundColor: 'white',
                                                padding: '1rem',
                                                borderRadius: '0.5rem',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                                cursor: 'pointer',
                                                border: '1px solid #e5e7eb',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--gray-500)' }}>{task.id}</span>
                                                <span style={{
                                                    padding: '0.125rem 0.375rem',
                                                    borderRadius: '4px',
                                                    fontSize: '0.625rem',
                                                    fontWeight: '600',
                                                    backgroundColor: priorityColor.bg,
                                                    color: priorityColor.color,
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {task.priority || 'MEDIUM'}
                                                </span>
                                            </div>

                                            <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--gray-900)', marginBottom: '0.5rem', lineHeight: '1.4' }}>{task.title}</h3>

                                            {task.description && (
                                                <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '0.75rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {task.description}
                                                </p>
                                            )}

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid #f3f4f6' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280' }}>
                                                        {task.assigned_to ? task.assigned_to.substring(0, 2).toUpperCase() : 'UN'}
                                                    </div>
                                                    {task.assigned_to && <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>{getAssociateName(task.assigned_to)}</span>}
                                                </div>

                                                {task.due_date && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: overdue ? 'var(--error-600)' : 'var(--gray-500)', fontWeight: overdue ? '600' : '400' }}>
                                                        <Calendar size={12} />
                                                        <span>{new Date(task.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingTask ? 'Edit Task' : 'Add Task'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Title *</label>
                            <input type="text" className="form-input" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                        </div>
                        {editingTask && (
                            <div className="form-group">
                                <label className="form-label">Status *</label>
                                <select className="form-select" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} required>
                                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="form-group">
                            <label className="form-label">Priority *</label>
                            <select className="form-select" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} required>
                                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Due Date *</label>
                            <input type="date" className="form-input" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Assigned To *</label>
                            <SearchableSelect
                                options={associates.map(a => ({ value: a.associate_id, label: `${a.associate_id} - ${a.associate_name}` }))}
                                value={formData.assigned_to}
                                onChange={(value) => setFormData({ ...formData, assigned_to: value })}
                                placeholder="Select Associate"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Related To *</label>
                            <select
                                className="form-select"
                                value={formData.related_type}
                                onChange={(e) => setFormData({ ...formData, related_type: e.target.value, related_id: '' })} // Reset ID when type changes
                                required
                            >
                                <option value="">Select Type</option>
                                {RELATED_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Related ID *</label>
                            <SearchableSelect
                                options={relatedOptions.map(r => ({ value: r.id, label: `${r.id} - ${r.name}` }))}
                                value={formData.related_id}
                                onChange={(value) => setFormData({ ...formData, related_id: value })}
                                placeholder={formData.related_type ? "Select Related Entity" : "Select Type First"}
                                disabled={!formData.related_type}
                                required
                            />
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Description *</label>
                            <textarea className="form-input" rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required />
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Activity</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Show: Comments</span>
                            </label>

                            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#4b5563', flexShrink: 0 }}>
                                    {user?.name ? user.name.substring(0, 2).toUpperCase() : 'ME'}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ position: 'relative' }}>
                                        <textarea
                                            className="form-input"
                                            rows={2}
                                            placeholder="Add a comment..."
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            style={{ paddingRight: '2.5rem' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddComment}
                                            style={{
                                                position: 'absolute',
                                                right: '8px',
                                                bottom: '8px',
                                                border: 'none',
                                                background: 'transparent',
                                                cursor: 'pointer',
                                                color: newComment.trim() ? 'var(--primary-600)' : 'var(--gray-400)'
                                            }}
                                            disabled={!newComment.trim()}
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>Pro tip: press <strong>M</strong> to comment</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {Array.isArray(formData.comments) && [...formData.comments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((comment) => (
                                    <div key={comment.id} style={{ display: 'flex', gap: '0.75rem' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#4b5563', flexShrink: 0 }}>
                                            {comment.author_name ? comment.author_name.substring(0, 2).toUpperCase() : 'UN'}
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--gray-900)' }}>{comment.author_name}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{new Date(comment.created_at).toLocaleString()}</span>
                                            </div>
                                            <p style={{ fontSize: '0.875rem', color: 'var(--gray-700)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{comment.content}</p>
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                <button type="button" className="btn-link" style={{ fontSize: '0.75rem', color: 'var(--gray-500)', padding: 0 }}>Edit</button>
                                                <button type="button" onClick={() => handleDeleteComment(comment.id)} className="btn-link" style={{ fontSize: '0.75rem', color: 'var(--gray-500)', padding: 0 }}>Delete</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{editingTask ? 'Update' : 'Create'}</button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Confirm Deletion"
                size="md"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setIsDeleteModalOpen(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn"
                            style={{ backgroundColor: '#dc2626', color: 'white' }}
                            onClick={confirmDelete}
                        >
                            Delete
                        </button>
                    </div>
                }
            >
                <div>
                    <p>Are you sure you want to delete this task?</p>
                </div>
            </Modal>
        </div>
    );
}

export default Tasks;
