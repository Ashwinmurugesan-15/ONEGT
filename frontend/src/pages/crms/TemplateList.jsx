import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, ArrowLeft, CheckCircle, Palette } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import { crmInvoiceTemplatesApi } from '../../services/crms_api';

import { formatDateToDdMmmYyyy } from '../../utils/dateUtils';

function TemplateList({ onClose, onEdit, onCreate, onView }) {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState(null);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const res = await crmInvoiceTemplatesApi.getAll();
            setTemplates(res.data || res);
        } catch (error) {
            console.error('Error loading templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id) => {
        setTemplateToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!templateToDelete) return;
        try {
            await crmInvoiceTemplatesApi.delete(templateToDelete);
            loadTemplates();
            setIsDeleteModalOpen(false);
            setTemplateToDelete(null);
        } catch (error) {
            console.error('Error deleting template:', error);
            alert('Failed to delete template');
        }
    };

    const columns = [
        {
            key: 'id',
            label: 'Template ID',
            render: (val, row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: '500' }}>{val}</span>
                    {row.is_default && (
                        <span style={{
                            backgroundColor: '#ecfdf5',
                            color: '#059669',
                            padding: '2px 8px',
                            borderRadius: '99px',
                            fontSize: '0.65rem',
                            fontWeight: '700',
                            textTransform: 'uppercase'
                        }}>
                            Default
                        </span>
                    )}
                </div>
            )
        },
        {
            key: 'name',
            label: 'Template Name',
            render: (val) => (
                <div style={{ fontWeight: '600', color: '#111827' }}>{val}</div>
            )
        },
        {
            key: 'created_at',
            label: 'Created At',
            render: (val) => formatDateToDdMmmYyyy(val)
        },
        {
            key: 'updated_at',
            label: 'Last Updated',
            render: (val) => formatDateToDdMmmYyyy(val)
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-icon btn-ghost" title="View" onClick={() => onView(row)}><Eye size={16} /></button>
                    <button className="btn btn-icon btn-ghost" title="Edit" onClick={() => onEdit(row)}><Edit2 size={16} /></button>
                    <button className="btn btn-icon btn-ghost text-error" title="Delete" onClick={() => handleDelete(row.id)}><Trash2 size={16} /></button>
                </div>
            )
        }
    ];

    if (loading) return <Loading />;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="btn btn-icon btn-ghost">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Invoice Templates</h1>
                        <p className="text-gray-500">Manage and customize your invoice layouts</p>
                    </div>
                </div>
                <button className="btn btn-primary" onClick={onCreate}>
                    <Plus size={20} className="mr-2" />
                    New Template
                </button>
            </div>

            <div className="card">
                <DataTable
                    columns={columns}
                    data={templates}
                    emptyMessage="No templates found. Design your first template to get started!"
                />
            </div>

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
                    <p>Are you sure you want to delete this invoice template?</p>
                </div>
            </Modal>
        </div>
    );
}

export default TemplateList;
