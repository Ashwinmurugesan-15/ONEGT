import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { associatesApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/common/Loading';
import { Download, ChevronRight, ChevronDown, User, Users, Shield, Briefcase, ZoomIn, ZoomOut, Maximize, Eye } from 'lucide-react';
import { getDriveDirectLink } from '../../utils/driveUtils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const OrganizationChart = () => {
    const { user, isAdmin, isManager, loading: authLoading } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [allAssociates, setAllAssociates] = useState([]);
    const [orgData, setOrgData] = useState(null);
    const [zoom, setZoom] = useState(0.8);
    const [displayOptions, setDisplayOptions] = useState({
        photo: true,
        designation: true,
        department: true,
        id: true,
        role: true
    });
    const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
    const chartRef = useRef(null);
    const dropdownRef = useRef(null);
    const viewportRef = useRef(null);

    // Drag-to-scroll state
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

    const handleMouseDown = (e) => {
        if (!viewportRef.current) return;
        if (e.target.closest('button, input, label, .display-options-dropdown')) return;
        setIsDragging(true);
        setDragStart({
            x: e.clientX,
            y: e.clientY,
            scrollLeft: viewportRef.current.scrollLeft,
            scrollTop: viewportRef.current.scrollTop
        });
    };

    const handleMouseMove = (e) => {
        if (!isDragging || !viewportRef.current) return;
        e.preventDefault();
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        viewportRef.current.scrollLeft = dragStart.scrollLeft - dx;
        viewportRef.current.scrollTop = dragStart.scrollTop - dy;
    };

    const handleMouseUp = () => setIsDragging(false);
    const handleMouseLeave = () => setIsDragging(false);

    // Center chart on load
    useEffect(() => {
        if (!loading && orgData && viewportRef.current) {
            const vp = viewportRef.current;
            requestAnimationFrame(() => {
                vp.scrollLeft = (vp.scrollWidth - vp.clientWidth) / 2;
            });
        }
    }, [loading, orgData]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowOptionsDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!authLoading) {
            loadData();
        }
    }, [authLoading]);

    const loadData = async () => {
        setLoading(true);
        try {
            const response = await associatesApi.getAll();
            const associates = response.data;
            setAllAssociates(associates);
            const hierarchy = buildHierarchy(associates);
            setOrgData(hierarchy);
        } catch (error) {
            console.error('Error loading org chart data:', error);
        } finally {
            setLoading(false);
        }
    };

    const buildHierarchy = (associates) => {
        if (!associates || !Array.isArray(associates)) return [];
        const associateMap = {};
        associates.forEach(a => {
            const id = String(a.associate_id).toLowerCase().trim();
            associateMap[id] = { ...a, children: [] };
        });
        const roots = [];
        associates.forEach(a => {
            const id = String(a.associate_id).toLowerCase().trim();
            const mid = a.manager_id ? String(a.manager_id).toLowerCase().trim() : null;
            if (mid && associateMap[mid] && mid !== id) {
                associateMap[mid].children.push(associateMap[id]);
            } else {
                roots.push(associateMap[id]);
            }
        });
        return roots;
    };

    const exportToPDF = async () => {
        if (!chartRef.current) return;
        showToast('Generating PDF... Please wait.', 'info', 5000);
        try {
            const canvas = await html2canvas(chartRef.current, {
                scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
            const imgX = (pdfWidth - canvas.width * ratio) / 2;
            pdf.setFontSize(18);
            pdf.setTextColor(40);
            pdf.text('Organization Chart', pdfWidth / 2, 20, { align: 'center' });
            pdf.addImage(imgData, 'PNG', imgX, 30, canvas.width * ratio, canvas.height * ratio);
            pdf.save('OneGT_Org_Chart.pdf');
            showToast('PDF exported successfully!', 'success');
        } catch (error) {
            console.error('PDF export failed:', error);
            showToast('Failed to export PDF. Please try again.', 'error');
        }
    };

    // ─── OrgNode with real DOM connector divs ──────────────────────────
    const OrgNode = ({ node, isRoot }) => {
        const [isCollapsed, setIsCollapsed] = useState(false);
        const hasChildren = node.children && node.children.length > 0;
        const childrenRowRef = useRef(null);
        const [hBarStyle, setHBarStyle] = useState(null);

        // Measure children to draw the horizontal bar from center-of-first to center-of-last
        useEffect(() => {
            if (!hasChildren || isCollapsed || !childrenRowRef.current) {
                setHBarStyle(null);
                return;
            }
            const row = childrenRowRef.current;
            const branches = row.querySelectorAll(':scope > .org-tree-branch');
            if (branches.length <= 1) {
                setHBarStyle(null);
                return;
            }
            const rowRect = row.getBoundingClientRect();
            const first = branches[0].getBoundingClientRect();
            const last = branches[branches.length - 1].getBoundingClientRect();
            const left = (first.left + first.width / 2) - rowRect.left;
            const right = rowRect.right - (last.left + last.width / 2);
            setHBarStyle({ left: `${left}px`, right: `${right}px` });
        }, [hasChildren, isCollapsed, displayOptions, zoom]);

        return (
            <div className="org-tree-branch">
                {/* Vertical line UP from parent's horizontal bar into this card */}
                {!isRoot && <div className="connector-v-up" />}

                {/* The card */}
                <div className={`org-node ${node.associate_id === user?.associate_id ? 'current-user' : ''}`}>
                    <div className="org-node-header">
                        {displayOptions.photo && (
                            node.photo ? (
                                <img src={getDriveDirectLink(node.photo)} alt={node.associate_name} className="node-avatar" referrerPolicy="no-referrer" />
                            ) : (
                                <div className="node-avatar-placeholder">
                                    <User size={18} />
                                </div>
                            )
                        )}
                        <div className="node-info">
                            <h4 className="node-name">{node.associate_name}</h4>
                            {displayOptions.designation && (
                                <p className="node-designation">{node.designation_id || 'Associate'}</p>
                            )}
                            {displayOptions.department && node.department_id && (
                                <p className="node-dept">{node.department_id}</p>
                            )}
                            {displayOptions.id && (
                                <span className="node-id">{node.associate_id}</span>
                            )}
                        </div>
                    </div>
                    {displayOptions.role && (
                        <div className="org-node-footer">
                            <div className="node-badge">
                                {node.role === 'Admin' ? <Shield size={12} /> : <Briefcase size={12} />}
                                <span>{node.role}</span>
                            </div>
                        </div>
                    )}
                    {hasChildren && (
                        <button className="node-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </button>
                    )}
                </div>

                {/* Children with connectors */}
                {hasChildren && !isCollapsed && (
                    <div className="org-tree-children-wrap">
                        {/* Vertical line DOWN from this card to horizontal bar */}
                        <div className="connector-v-down" />
                        {/* Row of children */}
                        <div className="org-tree-children-row" ref={childrenRowRef}>
                            {/* Horizontal bar (real div, JS-measured) */}
                            {hBarStyle && <div className="connector-h-bar" style={hBarStyle} />}
                            {node.children.map((child) => (
                                <OrgNode key={child.associate_id} node={child} isRoot={false} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (loading) return <Loading />;

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Organizational Chart</h1>
                    <p className="page-subtitle">Visual representation of company hierarchy</p>
                </div>
                <div className="flex gap-2" style={{ position: 'relative' }} ref={dropdownRef}>
                    <button
                        onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
                        className={`toggle-roles-btn ${showOptionsDropdown ? 'active' : ''}`}
                        title="Display Options"
                    >
                        <Eye size={18} />
                        <span>Display Options</span>
                        <ChevronDown size={14} />
                    </button>

                    {showOptionsDropdown && (
                        <div className="display-options-dropdown">
                            <div className="dropdown-header">Show / Hide Fields</div>
                            <div className="options-list">
                                {[
                                    { key: 'photo', label: 'Profile Picture' },
                                    { key: 'designation', label: 'Designation' },
                                    { key: 'department', label: 'Department' },
                                    { key: 'id', label: 'Associate ID' },
                                    { key: 'role', label: 'Role' },
                                ].map(opt => (
                                    <label className="option-item" key={opt.key}>
                                        <input
                                            type="checkbox"
                                            checked={displayOptions[opt.key]}
                                            onChange={() => setDisplayOptions(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                                        />
                                        <span>{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="zoom-controls">
                        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="zoom-btn" title="Zoom Out">
                            <ZoomOut size={18} />
                        </button>
                        <div className="zoom-value">{Math.round(zoom * 100)}%</div>
                        <button onClick={() => setZoom(z => Math.min(1.5, z + 0.1))} className="zoom-btn" title="Zoom In">
                            <ZoomIn size={18} />
                        </button>
                    </div>
                    <button onClick={() => setZoom(0.8)} className="btn btn-secondary" title="Reset Zoom">
                        <Maximize size={18} />
                    </button>
                    <button onClick={exportToPDF} className="btn btn-primary">
                        <Download size={18} />
                        Export PDF
                    </button>
                </div>
            </div>

            <div
                ref={viewportRef}
                className={`org-chart-viewport ${isDragging ? 'is-dragging' : ''}`}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
            >
                <div
                    ref={chartRef}
                    className="org-chart-canvas"
                    style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top center',
                        transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                    }}
                >
                    {orgData && orgData.length > 0 ? (
                        <div className="org-tree-root">
                            {orgData.map(root => (
                                <OrgNode key={root.associate_id} node={root} isRoot={true} />
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state-box">
                            <div className="empty-state-icon"><Users size={32} /></div>
                            <h3 className="empty-state-title">No Hierarchy Available</h3>
                            <p className="empty-state-text">
                                {isAdmin
                                    ? "There are no associates in the system or no hierarchy has been defined yet."
                                    : "You may not have any direct reporting line or your profile is not linked in the hierarchy."}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                /* ======================== */
                /*  Viewport & Canvas       */
                /* ======================== */
                .org-chart-viewport {
                    overflow: auto;
                    background: #f8fafc;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    min-height: 600px;
                    cursor: grab;
                    user-select: none;
                }
                .org-chart-viewport.is-dragging { cursor: grabbing; }
                .org-chart-viewport::-webkit-scrollbar { width: 8px; height: 8px; }
                .org-chart-viewport::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
                .org-chart-viewport::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .org-chart-viewport::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

                .org-chart-canvas {
                    display: inline-flex;
                    justify-content: center;
                    padding: 40px;
                    min-width: 100%;
                    box-sizing: border-box;
                }

                /* ======================== */
                /*  Tree Layout (DOM-based) */
                /* ======================== */
                .org-tree-root {
                    display: flex;
                    justify-content: center;
                }
                .org-tree-branch {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .org-tree-children-wrap {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .org-tree-children-row {
                    display: flex;
                    justify-content: center;
                    gap: 16px;
                    position: relative;
                }

                /* =========================================== */
                /*  Connector Lines (real DOM divs, no pseudo)  */
                /* =========================================== */
                .connector-v-up {
                    width: 2px;
                    height: 20px;
                    background: #94a3b8;
                    flex-shrink: 0;
                }
                .connector-v-down {
                    width: 2px;
                    height: 20px;
                    background: #94a3b8;
                    flex-shrink: 0;
                }
                .connector-h-bar {
                    position: absolute;
                    top: 0;
                    height: 2px;
                    background: #94a3b8;
                    z-index: 0;
                }

                /* ======================== */
                /*  Node Card              */
                /* ======================== */
                .org-node {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    width: 200px;
                    padding: 12px;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
                    position: relative;
                    z-index: 2;
                    transition: box-shadow 0.2s, transform 0.2s;
                    border-top: 3px solid #3b82f6;
                }
                .org-node.current-user {
                    border-top-color: #10b981;
                    box-shadow: 0 0 0 2px rgba(16,185,129,0.2), 0 4px 12px rgba(0,0,0,0.08);
                }
                .org-node:hover {
                    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
                    transform: translateY(-2px);
                }
                .org-node-header {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                .node-avatar {
                    width: 36px; height: 36px;
                    border-radius: 50%;
                    object-fit: cover;
                    border: 2px solid #f1f5f9;
                    flex-shrink: 0;
                }
                .node-avatar-placeholder {
                    width: 36px; height: 36px;
                    border-radius: 50%;
                    background: #f1f5f9;
                    display: flex; align-items: center; justify-content: center;
                    color: #94a3b8;
                    flex-shrink: 0;
                }
                .node-info { flex: 1; min-width: 0; }
                .node-name {
                    font-size: 0.8rem; font-weight: 700; color: #1e293b; margin: 0;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                .node-designation {
                    font-size: 0.65rem; font-weight: 600; color: #475569; margin: 2px 0 0;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                .node-dept {
                    font-size: 0.6rem; color: #64748b; margin: 1px 0 0;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                .node-id {
                    font-size: 0.65rem; color: #1e293b;
                    font-family: 'JetBrains Mono', monospace;
                    background: #f1f5f9; padding: 1px 4px; border-radius: 4px;
                    font-weight: 600; margin-top: 2px; display: inline-block;
                }
                .org-node-footer {
                    display: flex; justify-content: flex-end;
                    border-top: 1px solid #f1f5f9; padding-top: 6px; margin-top: 4px;
                }
                .node-badge {
                    display: flex; align-items: center; gap: 4px;
                    font-size: 0.6rem; font-weight: 600; color: #475569;
                    background: #f1f5f9; padding: 2px 6px; border-radius: 9999px;
                    text-transform: uppercase;
                }
                .node-toggle {
                    position: absolute; bottom: -14px; left: 50%; transform: translateX(-50%);
                    width: 26px; height: 26px; background: white;
                    border: 1px solid #e2e8f0; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; color: #64748b;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05); z-index: 3;
                }
                .node-toggle:hover { color: #3b82f6; border-color: #3b82f6; }

                /* ======================== */
                /*  Header Controls         */
                /* ======================== */
                .zoom-controls {
                    display: flex; background: white; border: 1px solid #e2e8f0;
                    border-radius: 8px; padding: 2px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1); height: 42px;
                }
                .toggle-roles-btn {
                    display: flex; align-items: center; gap: 8px; padding: 0 16px;
                    background: white; border: 1px solid #e2e8f0; border-radius: 8px;
                    cursor: pointer; color: #64748b; font-weight: 600;
                    font-size: 0.875rem; transition: all 0.2s; height: 42px;
                }
                .toggle-roles-btn:hover { background: #f8fafc; border-color: #cbd5e1; color: #1e293b; }
                .toggle-roles-btn.active { background: #eff6ff; border-color: #3b82f6; color: #2563eb; }
                .toggle-roles-btn svg { flex-shrink: 0; }

                .display-options-dropdown {
                    position: absolute; top: 100%; right: 0; margin-top: 8px;
                    background: white; border: 1px solid #e2e8f0; border-radius: 12px;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                    z-index: 50; min-width: 200px; overflow: hidden;
                }
                .dropdown-header {
                    padding: 12px 16px; font-size: 0.75rem; font-weight: 700;
                    text-transform: uppercase; color: #94a3b8;
                    background: #f8fafc; border-bottom: 1px solid #e2e8f0;
                }
                .options-list { padding: 8px; }
                .option-item {
                    display: flex; align-items: center; gap: 12px;
                    padding: 8px 12px; border-radius: 8px;
                    cursor: pointer; transition: background 0.2s;
                }
                .option-item:hover { background: #f1f5f9; }
                .option-item input[type="checkbox"] {
                    width: 16px; height: 16px; border-radius: 4px;
                    accent-color: #3b82f6; cursor: pointer;
                }
                .option-item span { font-size: 0.875rem; font-weight: 500; color: #1e293b; }

                .zoom-btn {
                    padding: 0 12px; background: transparent; border: none;
                    border-radius: 6px; cursor: pointer; color: #64748b;
                    transition: all 0.2s; display: flex; align-items: center; justify-content: center;
                }
                .zoom-btn:hover { background: #f1f5f9; color: #3b82f6; }
                .zoom-value {
                    padding: 0 12px; font-size: 0.9rem; font-weight: 700; color: #334155;
                    display: flex; align-items: center;
                    border-left: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9;
                    min-width: 64px; justify-content: center;
                }

                /* ======================== */
                /*  Empty State             */
                /* ======================== */
                .empty-state-box {
                    display: flex; flex-direction: column; align-items: center;
                    justify-content: center; padding: 100px 20px; text-align: center; width: 100%;
                }
                .empty-state-icon {
                    width: 64px; height: 64px; background: #f1f5f9; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    margin-bottom: 24px; color: #94a3b8;
                }
                .empty-state-title {
                    font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0 0 12px 0;
                }
                .empty-state-text {
                    font-size: 0.95rem; color: #64748b; max-width: 400px;
                    line-height: 1.6; margin: 0 auto;
                }
            `}</style>
        </div>
    );
};

export default OrganizationChart;
