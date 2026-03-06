import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Package, Monitor, Headphones, Briefcase, AlertCircle, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import { assetsApi, associatesApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

function Assets() {
    const { user, isHROrAdmin } = useAuth();
    const isManagerOrAdmin = user?.role === 'Admin' || user?.role === 'Project Manager' || isHROrAdmin;

    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState([]);
    const [associates, setAssociates] = useState([]);
    const [assetTypes, setAssetTypes] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showNewTypeInput, setShowNewTypeInput] = useState(false);
    const [newAssetType, setNewAssetType] = useState('');

    // Owner autocomplete state
    const [ownerInput, setOwnerInput] = useState('');
    const [ownerSuggestions, setOwnerSuggestions] = useState([]);
    const [showOwnerSuggestions, setShowOwnerSuggestions] = useState(false);
    const [selectedOwner, setSelectedOwner] = useState(null);
    const ownerInputRef = useRef(null);

    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm();
    const watchAssetType = watch('asset_type');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [assetsRes, typesRes, associatesRes] = await Promise.all([
                isManagerOrAdmin
                    ? assetsApi.getAll()
                    : assetsApi.getMyAssets(user?.associate_id),
                assetsApi.getTypes(),
                associatesApi.getAll()
            ]);
            setAssets(assetsRes.data);
            setAssetTypes(typesRes.data);
            setAssociates(associatesRes.data);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (asset = null) => {
        setSelectedAsset(asset);
        setShowNewTypeInput(false);
        setNewAssetType('');
        setOwnerInput('');
        setOwnerSuggestions([]);
        setShowOwnerSuggestions(false);

        if (asset) {
            reset(asset);
            // Set selected owner if editing
            if (asset.owner) {
                const owner = associates.find(a => a.associate_id === asset.owner);
                if (owner) {
                    setSelectedOwner(owner);
                } else {
                    // Fallback if associate not found - use username as display name, owner as ID
                    setSelectedOwner({
                        associate_id: asset.owner,
                        associate_name: asset.username || 'Unknown'
                    });
                }
            } else {
                setSelectedOwner(null);
            }
        } else {
            reset({
                asset_type: '',
                asset_name: '',
                serial_no: '',
                owner: '',
                username: '',
                model: '',
                color: '',
                processor: '',
                memory: '',
                disk: '',
                screen_type: '',
                other_spec: '',
                warranty_years: 0,
                vendor: '',
                purchase_date: '',
                warranty_expiry: '',
                operating_system: '',
                client_onboarding_status: '',
                client_onboarding_software: ''
            });
            setSelectedOwner(null);
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedAsset(null);
        setShowNewTypeInput(false);
        setOwnerInput('');
        setSelectedOwner(null);
        reset();
    };

    // Owner search effect
    useEffect(() => {
        if (!ownerInput.trim()) {
            setOwnerSuggestions([]);
            setShowOwnerSuggestions(false);
            return;
        }

        const query = ownerInput.toLowerCase();
        const filtered = associates
            .filter(a => a.status === 'Active')
            .filter(a =>
                a.associate_name?.toLowerCase().includes(query) ||
                a.associate_id?.toLowerCase().includes(query) ||
                a.email?.toLowerCase().includes(query)
            )
            .slice(0, 10);

        setOwnerSuggestions(filtered);
        setShowOwnerSuggestions(filtered.length > 0);
    }, [ownerInput, associates]);

    const selectOwner = (associate) => {
        setSelectedOwner(associate);
        setValue('owner', associate.associate_id);
        setOwnerInput('');
        setShowOwnerSuggestions(false);
    };

    const clearOwner = () => {
        setSelectedOwner(null);
        setValue('owner', '');
    };

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            // Use new asset type if provided
            if (showNewTypeInput && newAssetType.trim()) {
                data.asset_type = newAssetType.trim();
            }

            if (selectedAsset) {
                await assetsApi.update(selectedAsset.asset_id, data);
            } else {
                await assetsApi.create(data);
            }
            await loadData();
            closeModal();
        } catch (error) {
            console.error('Error saving asset:', error);
            alert(error.response?.data?.detail || 'Error saving asset');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (asset) => {
        if (!confirm(`Delete asset ${asset.asset_id} - ${asset.asset_name}?`)) return;

        try {
            await assetsApi.delete(asset.asset_id);
            await loadData();
        } catch (error) {
            console.error('Error deleting asset:', error);
            alert(error.response?.data?.detail || 'Error deleting asset');
        }
    };

    const getAssetIcon = (type) => {
        switch (type?.toLowerCase()) {
            case 'laptop': return <Monitor size={16} />;
            case 'headset': return <Headphones size={16} />;
            case 'laptop bag': return <Briefcase size={16} />;
            default: return <Package size={16} />;
        }
    };

    const columns = [
        { key: 'asset_id', label: 'Asset ID' },
        {
            key: 'asset_type',
            label: 'Type',
            render: (value) => (
                <span className="flex items-center gap-2">
                    {getAssetIcon(value)}
                    {value || '-'}
                </span>
            )
        },
        { key: 'asset_name', label: 'Name' },
        { key: 'serial_no', label: 'Serial No' },
        {
            key: 'owner',
            label: 'Assigned To',
            render: (value, row) => {
                if (!value) return '-';
                // Look up associate name from loaded associates
                const associate = associates.find(a => a.associate_id === value);
                const name = associate?.associate_name || row.username || '';
                if (name) {
                    return `${name} (${value})`;
                }
                return value;
            }
        },
        { key: 'model', label: 'Model' },
        {
            key: 'warranty_expiry',
            label: 'Warranty',
            render: (value) => {
                if (!value) return '-';
                const expiry = new Date(value);
                const now = new Date();
                const isExpired = expiry < now;
                return (
                    <span className={`badge ${isExpired ? 'badge-error' : 'badge-success'}`}>
                        {value}
                    </span>
                );
            }
        },
        {
            key: 'client_onboarding_status',
            label: 'Status',
            render: (value) => (
                <span className={`badge ${value === 'Active' ? 'badge-success' : 'badge-gray'}`}>
                    {value || '-'}
                </span>
            )
        }
    ];

    // Add actions column for managers/admins
    if (isManagerOrAdmin) {
        columns.push({
            key: 'actions',
            label: 'Actions',
            render: (_, row) => (
                <div className="flex gap-2">
                    <button className="btn btn-secondary btn-sm" onClick={() => openModal(row)}>
                        <Edit2 size={14} />
                    </button>
                    <button className="btn btn-secondary btn-sm text-error" onClick={() => handleDelete(row)}>
                        <Trash2 size={14} />
                    </button>
                </div>
            )
        });
    }

    if (loading) return <Loading />;

    // Associate view with no assets
    if (!isManagerOrAdmin && assets.length === 0) {
        return (
            <div className="page-container">
                <div className="page-header">
                    <h1 className="page-title">My Assets</h1>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <AlertCircle size={48} style={{ color: 'var(--gray-400)', margin: '0 auto 1rem' }} />
                    <h3 style={{ marginBottom: '0.5rem', color: 'var(--gray-600)' }}>No Assets Mapped</h3>
                    <p style={{ color: 'var(--gray-500)' }}>
                        You currently don't have any assets assigned to you.
                        <br />Contact your manager if you need IT equipment.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">{isManagerOrAdmin ? 'Asset Management' : 'My Assets'}</h1>
                {isManagerOrAdmin && (
                    <button className="btn btn-primary" onClick={() => openModal()}>
                        <Plus size={16} /> Add Asset
                    </button>
                )}
            </div>

            <div className="card">
                <DataTable
                    columns={columns}
                    data={assets}
                    searchKeys={['asset_id', 'asset_name', 'serial_no', 'username', 'model']}
                />
            </div>

            {isManagerOrAdmin && (
                <Modal isOpen={isModalOpen} onClose={closeModal} title={selectedAsset ? 'Edit Asset' : 'Add Asset'}>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <h4 style={{ marginBottom: '1rem' }}>Basic Information</h4>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Asset Type *</label>
                                {!showNewTypeInput ? (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <select
                                            className="form-select"
                                            {...register('asset_type', { required: !showNewTypeInput })}
                                            style={{ flex: 1 }}
                                        >
                                            <option value="">Select Type</option>
                                            {assetTypes.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => setShowNewTypeInput(true)}
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            className="form-input"
                                            placeholder="Enter new asset type"
                                            value={newAssetType}
                                            onChange={(e) => setNewAssetType(e.target.value)}
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => {
                                                setShowNewTypeInput(false);
                                                setNewAssetType('');
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Asset Name *</label>
                                <input
                                    className="form-input"
                                    {...register('asset_name', { required: true })}
                                />
                                {errors.asset_name && <span className="form-error">Required</span>}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Serial No</label>
                                <input className="form-input" {...register('serial_no')} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Model</label>
                                <input className="form-input" {...register('model')} />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Owner (Associate)</label>
                                {selectedOwner ? (
                                    <div className="selected-owner-chip">
                                        <span>{selectedOwner.associate_name} ({selectedOwner.associate_id})</span>
                                        <X size={14} onClick={clearOwner} style={{ cursor: 'pointer' }} />
                                    </div>
                                ) : (
                                    <div className="skill-input-container">
                                        <input
                                            ref={ownerInputRef}
                                            type="text"
                                            className="form-input"
                                            placeholder="Type to search associates..."
                                            value={ownerInput}
                                            onChange={(e) => setOwnerInput(e.target.value)}
                                            onFocus={() => ownerInput && setShowOwnerSuggestions(ownerSuggestions.length > 0)}
                                            onBlur={() => setTimeout(() => setShowOwnerSuggestions(false), 200)}
                                        />
                                        {showOwnerSuggestions && (
                                            <div className="skill-suggestions">
                                                {ownerSuggestions.map(a => (
                                                    <div
                                                        key={a.associate_id}
                                                        className="skill-suggestion-item"
                                                        onClick={() => selectOwner(a)}
                                                    >
                                                        {a.associate_name} ({a.associate_id})
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <input type="hidden" {...register('owner')} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Username</label>
                                <input className="form-input" placeholder="Enter username" {...register('username')} />
                            </div>
                        </div>

                        <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Specifications</h4>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Color</label>
                                <input className="form-input" {...register('color')} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Processor</label>
                                <input className="form-input" {...register('processor')} />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Memory</label>
                                <input className="form-input" placeholder="e.g., 16GB" {...register('memory')} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Disk</label>
                                <input className="form-input" placeholder="e.g., 512GB SSD" {...register('disk')} />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Screen Type</label>
                                <input className="form-input" {...register('screen_type')} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Operating System</label>
                                <input className="form-input" placeholder="e.g., Windows 11" {...register('operating_system')} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Other Specifications</label>
                            <textarea
                                className="form-input"
                                rows={2}
                                {...register('other_spec')}
                            />
                        </div>

                        <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Purchase & Warranty</h4>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Vendor</label>
                                <input className="form-input" {...register('vendor')} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Warranty (Years)</label>
                                <input type="number" className="form-input" {...register('warranty_years')} />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Purchase Date</label>
                                <input type="date" className="form-input" {...register('purchase_date')} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Warranty Expiry Date</label>
                                <input type="date" className="form-input" {...register('warranty_expiry')} />
                            </div>
                        </div>

                        <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Client Onboarding</h4>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Onboarding Status</label>
                                <select className="form-select" {...register('client_onboarding_status')}>
                                    <option value="">Select Status</option>
                                    <option value="Active">Active</option>
                                    <option value="In Active">In Active</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Onboarding Software</label>
                                <input className="form-input" {...register('client_onboarding_software')} />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? 'Saving...' : (selectedAsset ? 'Update' : 'Create')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}

export default Assets;
