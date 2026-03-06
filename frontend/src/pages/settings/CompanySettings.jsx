import { useState, useEffect, useRef } from 'react';
import { Save, Upload, Palette, Building2, Globe, Mail, Phone, MapPin, Loader2, CheckCircle2, ImageIcon } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { settingsApi } from '../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const CompanySettings = () => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const [config, setConfig] = useState({
        name: 'OneGT',
        logo_url: '',
        primary_color: '#3b82f6',
        secondary_color: '#10b981',
        address: '',
        website: '',
        email: '',
        phone: ''
    });

    useEffect(() => { loadSettings(); }, []);

    const loadSettings = async () => {
        try {
            const res = await settingsApi.getCompany();
            setConfig(res.data);
        } catch (error) {
            console.error('Error loading company settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await settingsApi.updateCompany(config);
            showToast('Company settings updated successfully!', 'success');
        } catch (error) {
            showToast('Error updating company settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file (PNG, JPG, SVG)', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('File size must be under 5MB', 'error');
            return;
        }
        setUploading(true);
        try {
            const res = await settingsApi.uploadLogo(file);
            setConfig(prev => ({ ...prev, logo_url: res.data.file_id }));
            showToast('Logo uploaded successfully!', 'success');
        } catch (error) {
            showToast(error.response?.data?.detail || 'Failed to upload logo', 'error');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const getLogoSrc = () => {
        if (!config.logo_url) return null;
        if (config.logo_url.startsWith('http')) return config.logo_url;
        return `${API_BASE}/common/drive-proxy/${config.logo_url}`;
    };

    if (loading) return <div>Loading...</div>;

    const logoSrc = getLogoSrc();

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            {/* Page Header */}
            <div className="card shadow-md border-0 mb-4 overflow-visible">
                <div className="card-header bg-white border-bottom-0 pt-4 px-4 pb-3">
                    <div className="d-flex align-items-center gap-3">
                        <div style={{ padding: '10px', background: 'var(--primary-50)', borderRadius: '12px', color: 'var(--primary-600)' }}>
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h5 className="card-title mb-0">Company Profile</h5>
                            <p className="text-muted small mb-0">Customize your organization identity, branding, and contact information</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Identity & Logo */}
            <div className="card shadow-md border-0 mb-4">
                <div className="card-body p-4">
                    <h6 className="text-primary fw-bold text-uppercase mb-4" style={{ letterSpacing: '0.05em', fontSize: '1rem' }}>Identity & Branding</h6>
                    <div className="row g-4">
                        {/* Logo */}
                        <div className="col-auto">
                            <div
                                style={{
                                    width: '110px', height: '110px',
                                    borderRadius: '16px',
                                    background: logoSrc ? '#fff' : 'var(--gray-50)',
                                    border: logoSrc ? '2px solid var(--gray-200)' : '2px dashed var(--gray-300)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: logoSrc ? '0 2px 8px rgba(0,0,0,0.06)' : 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                }}
                                onClick={() => !uploading && fileInputRef.current?.click()}
                                title="Click to upload logo"
                            >
                                {uploading ? (
                                    <div className="text-center">
                                        <Loader2 size={24} className="text-primary" style={{ animation: 'spin 1s linear infinite' }} />
                                        <div className="text-muted" style={{ fontSize: '0.6rem', marginTop: '4px' }}>Uploading…</div>
                                    </div>
                                ) : logoSrc ? (
                                    <img src={logoSrc} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '12px' }} />
                                ) : (
                                    <div className="text-center">
                                        <ImageIcon size={28} className="text-muted" style={{ opacity: 0.3 }} />
                                        <div className="text-muted" style={{ fontSize: '0.6rem', marginTop: '4px' }}>Upload Logo</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />

                        {/* Company Name + Upload */}
                        <div className="col">
                            <label className="form-label small fw-bold text-dark">Company Name</label>
                            <input type="text" className="form-control form-input"
                                value={config.name} onChange={e => setConfig({ ...config, name: e.target.value })}
                                placeholder="Enter legal entity name" />
                            <div className="d-flex align-items-center gap-3 mt-3">
                                <button className="btn btn-secondary btn-sm d-flex align-items-center gap-2"
                                    onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                    {uploading
                                        ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Uploading…</>
                                        : <><Upload size={14} /> {logoSrc ? 'Change Logo' : 'Upload Logo'}</>}
                                </button>
                                {logoSrc && (
                                    <span className="d-flex align-items-center gap-1 text-success" style={{ fontSize: '0.72rem' }}>
                                        <CheckCircle2 size={13} /> Uploaded
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Theme Colors */}
            <div className="card shadow-md border-0 mb-4">
                <div className="card-body p-4">
                    <h6 className="text-primary fw-bold text-uppercase mb-4" style={{ letterSpacing: '0.05em', fontSize: '1rem' }}>
                        <span className="d-flex align-items-center gap-2"><Palette size={15} /> Theme Preferences</span>
                    </h6>
                    <div style={{ display: 'flex', flexDirection: 'row', gap: '2rem', flexWrap: 'nowrap' }}>
                        {/* Primary */}
                        <div>
                            <label className="form-label small fw-bold text-dark mb-2">Primary Color</label>
                            <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', alignItems: 'center', flexWrap: 'nowrap' }}>
                                <div style={{
                                    width: '38px', height: '36px', borderRadius: '8px',
                                    background: config.primary_color,
                                    border: '1px solid var(--gray-200)', flexShrink: 0,
                                    cursor: 'pointer', overflow: 'hidden', position: 'relative'
                                }}>
                                    <input type="color" value={config.primary_color}
                                        onChange={e => setConfig({ ...config, primary_color: e.target.value })}
                                        style={{ position: 'absolute', top: -5, left: -5, width: 55, height: 55, cursor: 'pointer' }} />
                                </div>
                                <input type="text" className="form-control form-input" style={{ width: '120px' }}
                                    value={config.primary_color}
                                    onChange={e => setConfig({ ...config, primary_color: e.target.value })} />
                            </div>
                        </div>
                        {/* Secondary */}
                        <div>
                            <label className="form-label small fw-bold text-dark mb-2">Secondary Color</label>
                            <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', alignItems: 'center', flexWrap: 'nowrap' }}>
                                <div style={{
                                    width: '38px', height: '36px', borderRadius: '8px',
                                    background: config.secondary_color,
                                    border: '1px solid var(--gray-200)', flexShrink: 0,
                                    cursor: 'pointer', overflow: 'hidden', position: 'relative'
                                }}>
                                    <input type="color" value={config.secondary_color}
                                        onChange={e => setConfig({ ...config, secondary_color: e.target.value })}
                                        style={{ position: 'absolute', top: -5, left: -5, width: 55, height: 55, cursor: 'pointer' }} />
                                </div>
                                <input type="text" className="form-control form-input" style={{ width: '120px' }}
                                    value={config.secondary_color}
                                    onChange={e => setConfig({ ...config, secondary_color: e.target.value })} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Contact Details */}
            <div className="card shadow-md border-0 mb-4">
                <div className="card-body p-4">
                    <h6 className="text-primary fw-bold text-uppercase mb-4" style={{ letterSpacing: '0.05em', fontSize: '1rem' }}>Contact Details</h6>
                    <div className="row g-3">
                        <div className="col-6">
                            <label className="form-label small fw-bold text-dark d-flex align-items-center gap-2">
                                <Globe size={14} className="text-muted" /> Website
                            </label>
                            <input type="url" className="form-control form-input" placeholder="https://example.com"
                                value={config.website} onChange={e => setConfig({ ...config, website: e.target.value })} />
                        </div>
                        <div className="col-6">
                            <label className="form-label small fw-bold text-dark d-flex align-items-center gap-2">
                                <Mail size={14} className="text-muted" /> Support Email
                            </label>
                            <input type="email" className="form-control form-input" placeholder="support@company.com"
                                value={config.email} onChange={e => setConfig({ ...config, email: e.target.value })} />
                        </div>
                        <div className="col-6">
                            <label className="form-label small fw-bold text-dark d-flex align-items-center gap-2">
                                <Phone size={14} className="text-muted" /> Business Phone
                            </label>
                            <input type="tel" className="form-control form-input" placeholder="+91 99999 00000"
                                value={config.phone} onChange={e => setConfig({ ...config, phone: e.target.value })} />
                        </div>
                        <div className="col-6">
                            <label className="form-label small fw-bold text-dark d-flex align-items-center gap-2">
                                <MapPin size={14} className="text-muted" /> Office Address
                            </label>
                            <textarea className="form-control form-input" rows="1" placeholder="Full business address"
                                value={config.address} onChange={e => setConfig({ ...config, address: e.target.value })} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="d-flex justify-content-end">
                <button
                    className="btn btn-primary d-flex align-items-center gap-2 px-4 shadow-sm"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <><span className="spinner-border spinner-border-sm"></span> Saving…</>
                    ) : (
                        <><Save size={16} /> Save Changes</>
                    )}
                </button>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default CompanySettings;
