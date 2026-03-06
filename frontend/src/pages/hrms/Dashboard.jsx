import { useState, useEffect } from 'react';
import {
    Users,
    FolderKanban,
    DollarSign,
    TrendingUp,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Briefcase,
    Layout,
    Clock,
    Calendar
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import StatCard from '../../components/common/StatCard';
import Loading from '../../components/common/Loading';
import { dashboardApi, timesheetsApi, expenseReportsApi, projectsApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCapability } from '../../contexts/CapabilityContext';
import { Link } from 'react-router-dom';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];



function Dashboard() {
    const { user } = useAuth();
    const { capability } = useCapability();
    const [loading, setLoading] = useState(true);

    // Admin/Manager States
    const [overview, setOverview] = useState(null);
    const [departmentData, setDepartmentData] = useState([]);
    const [utilization, setUtilization] = useState(null);
    const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
    const [pendingTimesheetsCount, setPendingTimesheetsCount] = useState(0);
    const [pendingExpensesCount, setPendingExpensesCount] = useState(0);

    // Associate States
    const [associateMetrics, setAssociateMetrics] = useState(null);

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

    // Tab State (Only Workforce remains for HRMS)
    const [activeTab, setActiveTab] = useState('workforce');

    useEffect(() => {
        loadDashboardData();
    }, [selectedYear, selectedMonth]);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const isManager = user?.role === 'Project Manager';
            const isAdmin = user?.role === 'Admin';
            const isAssociate = user?.role === 'Associate' || user?.role === 'Marketing Manager' || user?.role === 'Operations Manager';
            const managerId = isManager ? user.associate_id : null;
            const params = managerId ? { manager_id: managerId } : {};

            if (isAdmin || isManager) {
                const [overviewRes, deptRes, utilRes, pendingRes] = await Promise.all([
                    dashboardApi.getOverview(params),
                    dashboardApi.getDepartmentSummary(),
                    dashboardApi.getUtilization(selectedYear, selectedMonth, managerId),
                    dashboardApi.getPendingApprovals(managerId)
                ]);

                setOverview(overviewRes.data);
                setDepartmentData(deptRes.data.departments);
                setUtilization(utilRes.data);

                // Use new API for pending approvals
                if (pendingRes?.data) {
                    setPendingApprovalsCount(pendingRes.data.total || 0);
                    setPendingTimesheetsCount(pendingRes.data.timesheets || 0);
                    setPendingExpensesCount(pendingRes.data.expenses || 0);
                } else {
                    console.error('Invalid pending approvals response');
                }


            } else if (isAssociate) {
                const response = await dashboardApi.getAssociateOverview(user.associate_id);
                setAssociateMetrics(response.data);
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(2)}M`;
        }
        if (value >= 1000) {
            return `$${(value / 1000).toFixed(2)}K`;
        }
        return `$${value.toFixed(2)}`;
    };

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    if (loading) return <Loading />;

    if (user?.role === 'Associate' || user?.role === 'Marketing Manager' || user?.role === 'Operations Manager') {
        return (
            <div>
                <div className="page-header">
                    <div>
                        <h1 className="page-title">My Dashboard</h1>
                        <p className="page-subtitle">Welcome back, {user.name}. Here is an overview of your allocations and tasks.</p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid">
                    <StatCard
                        icon={TrendingUp}
                        value={`${associateMetrics?.billable_allocation || 0}%`}
                        label="Billable Allocation"
                        color="green"
                        trend={{ value: 'Current Month', isPositive: true }}
                    />
                    <StatCard
                        icon={Users}
                        value={`${associateMetrics?.total_allocation || 0}%`}
                        label="Total Allocation"
                        color="blue"
                    />
                    <Link to="/hrms/timesheets" style={{ textDecoration: 'none' }}>
                        <StatCard
                            icon={AlertCircle}
                            value={associateMetrics?.pending_timesheet_count || 0}
                            label="Pending Timesheets for Approval"
                            color={associateMetrics?.pending_timesheet_count > 0 ? "yellow" : "green"}
                            trend={{ value: 'Action Required', isPositive: false }}
                        />
                    </Link>
                    <StatCard
                        icon={FolderKanban}
                        value={associateMetrics?.active_project_count || 0}
                        label="Active Projects"
                        color="purple"
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    {/* Allocation Trend */}
                    <div className="chart-container">
                        <h3 className="chart-title">Allocation Trend (Last 6 Months)</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={associateMetrics?.allocation_trend || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                                <YAxis stroke="#6b7280" fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                <Tooltip
                                    formatter={(value, name) => [`${value}%`, name]}
                                    contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="billable"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    name="Billable"
                                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="non_billable"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    name="Non-Billable"
                                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Allocation Breakdown */}
                    <div className="chart-container">
                        <h3 className="chart-title">Current Allocation Breakdown</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Billable', value: associateMetrics?.billable_allocation || 0 },
                                        { name: 'Non-Billable', value: associateMetrics?.non_billable_allocation || 0 },
                                        { name: 'Bench', value: Math.max(0, 100 - (associateMetrics?.total_allocation || 0)) }
                                    ]}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    innerRadius={50}
                                    paddingAngle={5}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    <Cell fill="#10b981" />
                                    <Cell fill="#3b82f6" />
                                    <Cell fill="#e5e7eb" />
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Quick Actions</h3>
                    </div>
                    <div className="card-body">
                        <div className="flex gap-4">
                            <Link to="/hrms/timesheets" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                                Log Time
                            </Link>
                            <Link to="/hrms/allocations" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                                View Assignments
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show Coming Soon page for non-HRMS capabilities
    if (capability.id !== 'HRMS') {
        const CapabilityIcon = capability.icon;
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
                textAlign: 'center',
                padding: '2rem'
            }}>
                <div style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '24px',
                    background: `${capability.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '2rem'
                }}>
                    <CapabilityIcon size={56} color={capability.color} />
                </div>
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: '700',
                    color: 'var(--gray-900)',
                    marginBottom: '0.5rem'
                }}>
                    {capability.fullName}
                </h1>
                <p style={{
                    fontSize: '1.25rem',
                    color: 'var(--gray-500)',
                    marginBottom: '1rem'
                }}>
                    Coming Soon
                </p>
                <p style={{
                    fontSize: '1rem',
                    color: 'var(--gray-400)',
                    maxWidth: '400px',
                    lineHeight: '1.6'
                }}>
                    {capability.description}. This feature is currently under development and will be available soon.
                </p>
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Welcome to HRMS - GuhaTek's People & Project Management System</p>
                </div>
                <div className="flex gap-4">
                    <select
                        className="form-select"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        style={{ width: '120px' }}
                    >
                        {[2024, 2025, 2026].map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    <select
                        className="form-select"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        style={{ width: '150px' }}
                    >
                        {months.map((month, idx) => (
                            <option key={idx} value={idx + 1}>{month}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Dashboard Tabs (Simplified for HRMS) */}
            <div className="tabs-container">
                <button
                    className={`tab-btn active`}
                >
                    <Layout size={18} className="tab-icon" />
                    Workforce & Operations
                </button>
            </div>

            {/* ======================= SECTION 1: WORKFORCE & OPERATIONS ======================= */}
            {activeTab === 'workforce' && (
                <div className="animate-fade-in">

                    {/* Workforce Stats */}
                    <div className="stats-grid mb-6">
                        <StatCard
                            icon={Users}
                            value={overview?.total_associates || 0}
                            label={user?.role === 'Project Manager' ? "My Team" : "Total Associates"}
                            color="blue"
                        />
                        <StatCard
                            icon={Briefcase}
                            value={overview?.revenue_associates || 0}
                            label="Associates in Billable Projects"
                            color="success"
                        />
                        <StatCard
                            icon={Layout}
                            value={overview?.internal_associates || 0}
                            label="Associates in Internal / Investment Projects"
                            color="purple"
                        />
                        <StatCard
                            icon={Clock}
                            value={overview?.bench_associates || 0}
                            label="Associates in Bench"
                            color="gray"
                        />
                        <StatCard
                            icon={TrendingUp}
                            value={`${overview?.average_utilization || 0}%`}
                            label="Avg Utilization %"
                            color="success"
                        />

                        {(user?.role === 'Admin' || user?.role === 'Project Manager') && (
                            <>
                                {pendingTimesheetsCount > 0 && (
                                    <Link to="/hrms/timesheets?tab=team" style={{ textDecoration: 'none' }}>
                                        <StatCard
                                            icon={Calendar}
                                            value={pendingTimesheetsCount}
                                            label="Pending Timesheets for Approval"
                                            color="yellow"
                                            trend={{ value: 'Action Required', isPositive: false }}
                                        />
                                    </Link>
                                )}
                                {pendingExpensesCount > 0 && (
                                    <Link to="/hrms/expenses" style={{ textDecoration: 'none' }}>
                                        <StatCard
                                            icon={DollarSign}
                                            value={pendingExpensesCount}
                                            label="Pending Expenses for Approval"
                                            color="orange"
                                            trend={{ value: 'Action Required', isPositive: false }}
                                        />
                                    </Link>
                                )}
                            </>
                        )}
                    </div>

                    {/* Workforce Charts */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
                        {/* Left: Department Distribution */}
                        <div className="chart-container">
                            <h3 className="chart-title">Associates by Department</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={departmentData}
                                        dataKey="associate_count"
                                        nameKey="department"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        label={({ department, percent, x, y, cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
                                            const RADIAN = Math.PI / 180;
                                            // Move label outward
                                            const radius = outerRadius * 1.2;
                                            const x2 = cx + radius * Math.cos(-midAngle * RADIAN);
                                            const y2 = cy + radius * Math.sin(-midAngle * RADIAN);

                                            return (
                                                <text
                                                    x={x2}
                                                    y={y2}
                                                    fill="#666"
                                                    textAnchor={x2 > cx ? 'start' : 'end'}
                                                    dominantBaseline="central"
                                                    style={{ fontSize: '10px' }}
                                                >
                                                    {`${department} ${(percent * 100).toFixed(0)}%`}
                                                </text>
                                            );
                                        }}
                                    >
                                        {departmentData.map((entry, index) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Right: Utilization Summary (Admin) / Team Utilization Chart (Manager) */}
                        {user?.role === 'Project Manager' ? (
                            <div className="chart-container">
                                <h3 className="chart-title">Team Utilization (%) - {months[selectedMonth - 1]}</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={[...(utilization?.fully_utilized || []), ...(utilization?.partially_utilized || [])].slice(0, 10)}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis dataKey="associate_name" stroke="#6b7280" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
                                        <YAxis stroke="#6b7280" fontSize={12} domain={[0, 120]} />
                                        <Tooltip />
                                        <Bar dataKey="total_allocation" fill="#10b981" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10 }} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Resource Utilization - {months[selectedMonth - 1]}</h3>
                                </div>
                                <div className="card-body">
                                    {utilization && (
                                        <div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                                                <div className="text-center">
                                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--success-600)' }}>
                                                        {utilization.summary.fully_utilized}
                                                    </div>
                                                    <div className="text-muted">Fully Utilized</div>
                                                </div>
                                                <div className="text-center">
                                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--warning-600)' }}>
                                                        {utilization.summary.partially_utilized}
                                                    </div>
                                                    <div className="text-muted">Partial</div>
                                                </div>
                                                <div className="text-center">
                                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--error-600)' }}>
                                                        {utilization.summary.unallocated}
                                                    </div>
                                                    <div className="text-muted">Unallocated</div>
                                                </div>
                                            </div>
                                            <div style={{
                                                background: 'var(--gray-100)',
                                                borderRadius: '8px',
                                                padding: '1rem',
                                                textAlign: 'center'
                                            }}>
                                                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                                                    {utilization.summary.average_utilization}%
                                                </div>
                                                <div className="text-muted">Average Utilization</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Manager: Extra Row for Utilization Summary & Bench */}
                    {user?.role === 'Project Manager' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
                            {/* Utilization Summary */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Resource Utilization - {months[selectedMonth - 1]}</h3>
                                </div>
                                <div className="card-body">
                                    {utilization && (
                                        <div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                                                <div className="text-center">
                                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--success-600)' }}>
                                                        {utilization.summary.fully_utilized}
                                                    </div>
                                                    <div className="text-muted">Fully Utilized</div>
                                                </div>
                                                <div className="text-center">
                                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--warning-600)' }}>
                                                        {utilization.summary.partially_utilized}
                                                    </div>
                                                    <div className="text-muted">Partial</div>
                                                </div>
                                                <div className="text-center">
                                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--error-600)' }}>
                                                        {utilization.summary.unallocated}
                                                    </div>
                                                    <div className="text-muted">Unallocated</div>
                                                </div>
                                            </div>
                                            <div style={{
                                                background: 'var(--gray-100)',
                                                borderRadius: '8px',
                                                padding: '1rem',
                                                textAlign: 'center'
                                            }}>
                                                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                                                    {utilization.summary.average_utilization}%
                                                </div>
                                                <div className="text-muted">Average Utilization</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Bench Members */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Bench Members (Unallocated)</h3>
                                </div>
                                <div className="card-body" style={{ padding: 0 }}>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Associate</th>
                                                <th>Department</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(utilization?.unallocated || []).slice(0, 6).map((assoc) => (
                                                <tr key={assoc.associate_id}>
                                                    <td>{assoc.associate_name}</td>
                                                    <td>{assoc.department}</td>
                                                    <td>
                                                        <span className="badge badge-error">Unallocated</span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(utilization?.unallocated || []).length === 0 && (
                                                <tr>
                                                    <td colSpan="3" className="text-center text-muted py-4">All team members are allocated</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}

export default Dashboard;
