import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { associatesApi } from '../../services/api';
import Loading from '../../components/common/Loading';
import { DollarSign, Download, AlertCircle, Briefcase } from 'lucide-react';

function SalaryStructure() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        if (user) loadData();
    }, [user]);

    const loadData = async () => {
        try {
            const response = await associatesApi.getById(user.associate_id);
            setProfile(response.data);
        } catch (error) {
            console.error('Error loading salary data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Loading />;
    if (!profile) return <div className="p-8 text-center">Data not found.</div>;

    // Check if CTC is available
    if (!profile.fixed_ctc && !profile.ctc) {
        return (
            <div className="p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4 text-yellow-600">
                    <DollarSign size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Salary Details Unavailable</h2>
                <p className="text-gray-500 max-w-md">
                    Your salary structure has not been updated in the system yet. Please contact your HR manager.
                </p>
            </div>
        );
    }

    // --- Calculation Logic ---
    const fixedCtcAnnual = profile.fixed_ctc || profile.ctc || 0;
    const fixedCtcMonthly = fixedCtcAnnual / 12;

    // A. Cash Compensation
    // 1. Basic: 40% of CTC (using Fixed CTC as base as per image "40% of CTC")
    const basicAnnual = fixedCtcAnnual * 0.40;
    const basicMonthly = basicAnnual / 12;

    // 2. HRA: 50% of Basic
    const hraAnnual = basicAnnual * 0.50;
    const hraMonthly = hraAnnual / 12;

    // 3. Statutory Benefits (PF Employer Contribution)
    // 12% of Basic, capped at 1800 per month usually (Image says Max Rs.1800/-)
    let pfMonthly = basicMonthly * 0.12;
    if (pfMonthly > 1800) pfMonthly = 1800;
    const pfAnnual = pfMonthly * 12;

    // 2. Flexible Components (Allowances)
    // Using simple logic: Special/Supplementary Allowance = Fixed - (Basic + HRA + PF)
    const totalFixedComponents = basicAnnual + hraAnnual + pfAnnual;
    const supplementaryAnnual = fixedCtcAnnual - totalFixedComponents;
    const supplementaryMonthly = supplementaryAnnual / 12;

    // B. Bonus
    const bonusAnnual = profile.bonus || 0;
    // Image says "Up to 10% of annual fixed compensation", but we use actual bonus if present

    // C. Benefits
    const benefitsAnnual = profile.benefits || 0;
    // Breakdowns like Insurance etc are static in image, we might just show total unless we have fields

    const totalCtc = fixedCtcAnnual + bonusAnnual + benefitsAnnual;

    // Format Helpers
    const formatCurrency = (amount) => {
        if (!amount && amount !== 0) return '₹0.00';
        return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const styles = {
        th: "px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-gray-50 border border-gray-200",
        td: "px-4 py-3 text-sm text-gray-700 border border-gray-200",
        tdNumber: "px-4 py-3 text-sm text-gray-900 border border-gray-200 text-right font-mono",
        sectionHeader: "px-4 py-2 bg-gray-100 border border-gray-200 text-sm font-bold text-gray-800 text-center uppercase"
    };

    return (
        <div style={{ maxWidth: '64rem', margin: '0 auto', paddingBottom: '3rem' }}>
            {/* Page Header */}
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 className="page-title">Pay Structure</h1>
                    <p className="page-subtitle" style={{ marginTop: '0.5rem' }}>Detailed breakdown of your compensation package</p>
                </div>
                <button className="btn btn-primary" onClick={() => window.print()}>
                    <Download size={18} />
                    Download Breakdown
                </button>
            </div>

            {/* Name Header Section - Blue Background (Profile Style) */}
            <div className="card" style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
                <div style={{
                    background: 'linear-gradient(135deg, #0066b3 0%, #0080cc 50%, #5cc8e6 100%)',
                    padding: '1.5rem 2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white', marginBottom: '0.25rem' }}>
                            {profile.associate_name}
                        </h2>
                        <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                            {profile.designation}{profile.department && ` - ${profile.department}`}
                        </div>
                    </div>
                    <div style={{
                        padding: '0.5rem 1rem',
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '2rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: 'white',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        Confidential
                    </div>
                </div>
            </div>

            {/* Quick Summary Stats - Single Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'var(--primary-100)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary-600)'
                        }}>
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                                Annual CTC
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                                {formatCurrency(totalCtc)}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'var(--success-100)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--success-600)'
                        }}>
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                                Fixed Compensation
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                                {formatCurrency(fixedCtcAnnual)}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'var(--warning-100)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--warning-600)'
                        }}>
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                                Monthly Gross
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                                {formatCurrency(fixedCtcMonthly)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Compensation Breakdown */}
            <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-700)' }}>
                        <Briefcase size={18} style={{ color: 'var(--primary-600)' }} />
                        Detailed Compensation Breakdown
                    </h3>
                </div>

                <div style={{ padding: '1.5rem', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '0.75rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                        <thead>
                            <tr style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
                                <th style={{ padding: '1rem 1.25rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '2px solid #e2e8f0' }}>Component</th>
                                <th style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '2px solid #e2e8f0' }}>Monthly</th>
                                <th style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '2px solid #e2e8f0' }}>Annual</th>
                                <th style={{ padding: '1rem 1.25rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '2px solid #e2e8f0' }}>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* A. Cash Compensation Section Header */}
                            <tr>
                                <td colSpan={4} style={{ padding: '0.75rem 1.25rem', background: 'linear-gradient(135deg, #0066b3, #0080cc)', color: 'white', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    A. Cash Compensation Break-Up
                                </td>
                            </tr>

                            {/* Basic Pay */}
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '1rem 1.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#334155' }}>Basic Pay</td>
                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace', color: '#1e293b' }}>{formatCurrency(basicMonthly)}</td>
                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace', color: '#1e293b', fontWeight: '600' }}>{formatCurrency(basicAnnual)}</td>
                                <td style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>40% of Fixed CTC</td>
                            </tr>

                            {/* HRA */}
                            <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
                                <td style={{ padding: '1rem 1.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#334155' }}>House Rent Allowance (HRA)</td>
                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace', color: '#1e293b' }}>{formatCurrency(hraMonthly)}</td>
                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace', color: '#1e293b', fontWeight: '600' }}>{formatCurrency(hraAnnual)}</td>
                                <td style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>50% of Basic Pay</td>
                            </tr>

                            {/* Supplementary Allowance */}
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '1rem 1.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#334155' }}>Supplementary Allowance</td>
                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace', color: '#1e293b' }}>{formatCurrency(supplementaryMonthly)}</td>
                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace', color: '#1e293b', fontWeight: '600' }}>{formatCurrency(supplementaryAnnual)}</td>
                                <td style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>Balancing figure</td>
                            </tr>

                            {/* Statutory Benefits Sub-Header */}
                            <tr>
                                <td colSpan={4} style={{ padding: '0.6rem 1.25rem', background: '#f1f5f9', fontSize: '0.7rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Statutory Benefits
                                </td>
                            </tr>

                            {/* PF */}
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '1rem 1.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#334155' }}>Provident Fund (Employer Cont.)</td>
                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace', color: '#1e293b' }}>{formatCurrency(pfMonthly)}</td>
                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace', color: '#1e293b', fontWeight: '600' }}>{formatCurrency(pfAnnual)}</td>
                                <td style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>12% or Maximum ₹1,800/month</td>
                            </tr>

                            {/* Total Fixed Compensation */}
                            <tr style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)' }}>
                                <td style={{ padding: '1rem 1.25rem', fontSize: '0.875rem', fontWeight: '700', color: 'var(--primary-700)', textTransform: 'uppercase' }}>Total Fixed Compensation</td>
                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace', fontWeight: '700', color: 'var(--primary-700)' }}>{formatCurrency(fixedCtcMonthly)}</td>
                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '1rem', fontFamily: 'monospace', fontWeight: '700', color: 'var(--primary-700)' }}>{formatCurrency(fixedCtcAnnual)}</td>
                                <td style={{ padding: '1rem 1.25rem' }}></td>
                            </tr>

                            {/* B. Variable Components Section Header */}
                            <tr>
                                <td colSpan={4} style={{ padding: '0.75rem 1.25rem', background: '#1e293b', color: 'white', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    B. Variable Components
                                </td>
                            </tr>

                            {/* Bonus */}
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '1rem 1.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#334155' }}>Performance Bonus / Incentives</td>
                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace', color: '#94a3b8' }}>-</td>
                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace', color: '#1e293b', fontWeight: '600' }}>{formatCurrency(bonusAnnual)}</td>
                                <td style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>Based on performance</td>
                            </tr>

                            {/* C. Benefits Section Header */}
                            <tr>
                                <td colSpan={4} style={{ padding: '0.75rem 1.25rem', background: '#1e293b', color: 'white', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    C. Benefits
                                </td>
                            </tr>

                            {/* Company Benefits */}
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '1rem 1.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#334155' }}>Company Benefits (Insurance, etc.)</td>
                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace', color: '#94a3b8' }}>-</td>
                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace', color: '#1e293b', fontWeight: '600' }}>{formatCurrency(benefitsAnnual)}</td>
                                <td style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>Group Medical, Life & Accidental</td>
                            </tr>

                            {/* Total CTC */}
                            <tr style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
                                <td colSpan={2} style={{ padding: '1.25rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '700', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost to Company (Total CTC)</td>
                                <td style={{ padding: '1.25rem', textAlign: 'right', fontSize: '1.5rem', fontWeight: '700', color: '#60a5fa' }}>{formatCurrency(totalCtc)}</td>
                                <td style={{ padding: '1.25rem' }}></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Information Note */}
            <div style={{ marginTop: '2rem', padding: '1rem 1.25rem', background: 'var(--primary-50)', borderRadius: '0.75rem', border: '1px solid var(--primary-100)', display: 'flex', gap: '0.75rem' }}>
                <AlertCircle size={20} style={{ color: 'var(--primary-600)', flexShrink: 0, marginTop: '0.125rem' }} />
                <div style={{ fontSize: '0.8rem', color: 'var(--primary-800)', lineHeight: '1.6' }}>
                    <p style={{ fontWeight: '700', marginBottom: '0.25rem' }}>Information Note:</p>
                    This is a computed breakdown based on your Fixed CTC. Actual monthly payouts may vary slightly due to tax declarations,
                    voluntary PF contributions, and other adjustments. Benefits values are approximate costs to the company.
                </div>
            </div>
        </div>
    );
}

export default SalaryStructure;
