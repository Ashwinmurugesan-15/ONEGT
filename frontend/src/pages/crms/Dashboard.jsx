import { useState, useEffect } from 'react';
import {
    Users, Target, Building2, Phone, TrendingUp,
    DollarSign, ClipboardCheck, UserPlus, Briefcase
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import StatCard from '../../components/common/StatCard';
import Loading from '../../components/common/Loading';
import { crmDashboardApi } from '../../services/crms_api';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const STAGE_COLORS = {
    'Qualification': '#3b82f6',
    'Proposal': '#f59e0b',
    'Negotiation': '#8b5cf6',
    'Closed Won': '#10b981',
    'Closed Lost': '#ef4444'
};

function CRMSDashboard() {
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState(null);
    const [pipeline, setPipeline] = useState(null);
    const [leadSources, setLeadSources] = useState(null);
    const [recentActivities, setRecentActivities] = useState(null);

    const [selectedYear, setSelectedYear] = useState('All');
    const [selectedCurrency, setSelectedCurrency] = useState('USD');
    const [availableCurrencies, setAvailableCurrencies] = useState(['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD']);

    const getAvailableYears = () => {
        const currentYear = new Date().getFullYear();
        const years = ['All'];
        for (let y = currentYear; y >= currentYear - 5; y--) {
            years.push(y.toString());
        }
        return years;
    };

    const [availableYears] = useState(getAvailableYears());

    useEffect(() => {
        loadDashboardData();
    }, [selectedYear, selectedCurrency]);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const params = {};
            if (selectedYear !== 'All') params.year = selectedYear;
            if (selectedCurrency) params.currency = selectedCurrency;

            const [overviewRes, pipelineRes, sourcesRes, activitiesRes] = await Promise.all([
                crmDashboardApi.getOverview(params),
                crmDashboardApi.getPipeline(params),
                crmDashboardApi.getLeadSources({ year: params.year }),
                crmDashboardApi.getRecentActivities()
            ]);

            setOverview(overviewRes.data);
            setPipeline(pipelineRes.data);
            setLeadSources(sourcesRes.data);
            setRecentActivities(activitiesRes.data);
        } catch (error) {
            console.error('Error loading CRMS dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        const currencySymbols = {
            'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹',
            'AUD': 'A$', 'CAD': 'C$', 'SGD': 'S$'
        };
        const symbol = currencySymbols[selectedCurrency] || selectedCurrency + ' ';

        if (selectedCurrency === 'INR') {
            if (value >= 10000000) return `${symbol}${(value / 10000000).toFixed(2)}Cr`; // Crores
            if (value >= 100000) return `${symbol}${(value / 100000).toFixed(2)}L`;     // Lakhs
            return `${symbol}${value.toFixed(2)}`;
        }

        if (value >= 1000000) return `${symbol}${(value / 1000000).toFixed(2)}M`;
        if (value >= 1000) return `${symbol}${(value / 1000).toFixed(2)}K`;
        return `${symbol}${value.toFixed(2)}`;
    };

    if (loading) return <Loading />;

    // Prepare pipeline chart data
    const pipelineChartData = pipeline ? Object.entries(pipeline.pipeline).map(([stage, data]) => ({
        stage,
        count: data.count,
        value: data.value
    })) : [];

    // Prepare lead sources chart data
    const leadSourcesChartData = leadSources ? Object.entries(leadSources.sources).map(([source, count]) => ({
        name: source,
        value: count
    })) : [];

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
                <div>
                    <h1 className="page-title">CRM Dashboard</h1>
                    <p className="page-subtitle">Customer Relationship Management Overview</p>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    backgroundColor: 'white',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '16px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                    border: '1px solid #e2e8f0'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Year</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            style={{
                                padding: '0.5rem 2.5rem 0.5rem 1rem',
                                appearance: 'none',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                color: '#0f172a',
                                fontWeight: 500,
                                cursor: 'pointer',
                                outline: 'none',
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 0.75rem center',
                                backgroundSize: '1rem',
                                transition: 'all 0.2s ease',
                                minWidth: '150px'
                            }}
                            onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; e.target.style.backgroundColor = 'white'; }}
                            onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; e.target.style.backgroundColor = '#f8fafc'; }}
                            onMouseEnter={(e) => { if (document.activeElement !== e.target) e.target.style.borderColor = '#cbd5e1'; }}
                            onMouseLeave={(e) => { if (document.activeElement !== e.target) e.target.style.borderColor = '#e2e8f0'; }}
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year === 'All' ? 'All Time' : year}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ width: '1px', height: '40px', backgroundColor: '#e2e8f0', margin: '0 0.5rem' }}></div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Currency</label>
                        <select
                            value={selectedCurrency}
                            onChange={(e) => setSelectedCurrency(e.target.value)}
                            style={{
                                padding: '0.5rem 2.5rem 0.5rem 1rem',
                                appearance: 'none',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                color: '#0f172a',
                                fontWeight: 500,
                                cursor: 'pointer',
                                outline: 'none',
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 0.75rem center',
                                backgroundSize: '1rem',
                                transition: 'all 0.2s ease',
                                minWidth: '150px'
                            }}
                            onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; e.target.style.backgroundColor = 'white'; }}
                            onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; e.target.style.backgroundColor = '#f8fafc'; }}
                            onMouseEnter={(e) => { if (document.activeElement !== e.target) e.target.style.borderColor = '#cbd5e1'; }}
                            onMouseLeave={(e) => { if (document.activeElement !== e.target) e.target.style.borderColor = '#e2e8f0'; }}
                        >
                            {availableCurrencies.map(currency => (
                                <option key={currency} value={currency}>{currency}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid" style={{ marginBottom: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <StatCard
                    label="Total Leads"
                    value={overview?.leads?.total || 0}
                    icon={UserPlus}
                    color="blue"
                    subtitle={`${overview?.leads?.new || 0} New | ${overview?.metrics?.conversion_rate?.toFixed(1) || 0}% Conversion`}
                />
                <StatCard
                    label="Opportunities"
                    value={formatCurrency(overview?.opportunities?.total_value || 0)}
                    icon={Target}
                    color="purple"
                    subtitle={`${overview?.opportunities?.total || 0} Active | ${formatCurrency(overview?.metrics?.weighted_pipeline || 0)} Weighted`}
                />
                <StatCard
                    label="Customers"
                    value={overview?.customers?.total || 0}
                    icon={Building2}
                    color="green"
                    subtitle="Active Customer Base"
                />
                <StatCard
                    label="Opportunity Cost"
                    value={formatCurrency(overview?.metrics?.opportunity_cost || 0)}
                    icon={DollarSign}
                    color="red"
                    subtitle={`${overview?.deals?.lost || 0} Lost Deals`}
                />
                <StatCard
                    label="Won Deals"
                    value={formatCurrency(overview?.deals?.won_value || 0)}
                    icon={TrendingUp}
                    color="emerald"
                    subtitle={`${overview?.deals?.won || 0} Closed Won`}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-2" style={{ marginBottom: '2rem', gap: '1.5rem' }}>
                {/* Sales Pipeline */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Sales Pipeline</h3>
                    </div>
                    <div className="card-body">
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={pipelineChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip
                                    formatter={(value, name) => [
                                        name === 'value' ? formatCurrency(value) : value,
                                        name === 'value' ? 'Value' : 'Count'
                                    ]}
                                    contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                                />
                                <Bar dataKey="count" fill="#3b82f6" name="Count" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Lead Sources */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Lead Sources</h3>
                    </div>
                    <div className="card-body">
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={leadSourcesChartData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                >
                                    {leadSourcesChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Tasks and Activities Row */}
            <div className="grid grid-2" style={{ gap: '1.5rem' }}>
                {/* Open Tasks */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <ClipboardCheck size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                            Tasks Overview
                        </h3>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'space-around', padding: '1rem 0' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-600)' }}>
                                    {overview?.tasks?.open || 0}
                                </div>
                                <div style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Open</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--error-600)' }}>
                                    {overview?.tasks?.overdue || 0}
                                </div>
                                <div style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Overdue</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--gray-600)' }}>
                                    {overview?.tasks?.total || 0}
                                </div>
                                <div style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Total</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Calls */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <Phone size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                            Recent Calls
                        </h3>
                    </div>
                    <div className="card-body">
                        <div style={{ fontSize: '0.875rem' }}>
                            {recentActivities?.recent_calls?.length > 0 ? (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {recentActivities.recent_calls.slice(0, 5).map((call, idx) => (
                                        <li key={idx} style={{
                                            padding: '0.75rem 0',
                                            borderBottom: idx < 4 ? '1px solid var(--gray-100)' : 'none',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <div>
                                                <span className={`badge ${call.direction === 'Inbound' ? 'badge-success' : 'badge-primary'}`} style={{ marginRight: '0.5rem' }}>
                                                    {call.direction}
                                                </span>
                                                <span style={{ color: 'var(--gray-700)', fontWeight: 500 }}>{call.outcome || 'No outcome'}</span>
                                            </div>
                                            <span style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>{call.call_date}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '1rem' }}>No recent calls</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CRMSDashboard;
