import { useState, useEffect, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import StatCard from '../../components/common/StatCard';
import { Wallet, Users, TrendingDown, ClipboardCheck, Edit3, Save, TrendingUp, Settings } from 'lucide-react';
import { payrollApi, payrunApi } from '../../services/api';

// Get previous month
const getPreviousMonth = () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return {
        month: date.toLocaleString('default', { month: 'long' }),
        year: date.getFullYear()
    };
};

function Payroll() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const isAdmin = user?.role === 'Admin';
    const prevMonth = getPreviousMonth();
    const [activeTab, setActiveTab] = useState('summary'); // 'summary' or 'management'
    const [loading, setLoading] = useState(true);
    const [payrollData, setPayrollData] = useState([]);
    const [summary, setSummary] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [selectedYear, setSelectedYear] = useState(prevMonth.year);
    const [selectedMonth, setSelectedMonth] = useState(prevMonth.month);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [showSummary, setShowSummary] = useState(true);
    const [payrunData, setPayrunData] = useState([]);
    const [isPayrunInitializing, setIsPayrunInitializing] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [editPayslip, setEditPayslip] = useState(null); // Associate currently being edited
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const fileInputRef = useRef(null);

    const { register, handleSubmit, reset } = useForm();

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    useEffect(() => {
        loadData();
    }, [selectedYear, selectedMonth]);

    // Load chart data for last 12 months
    useEffect(() => {
        loadChartData();
    }, []);

    const loadChartData = async () => {
        try {
            // Get last 12 months
            const chartMonths = [];
            const date = new Date();
            for (let i = 11; i >= 0; i--) {
                const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
                chartMonths.push({
                    month: d.toLocaleString('default', { month: 'long' }),
                    year: d.getFullYear(),
                    label: d.toLocaleString('default', { month: 'short' }) + ' ' + d.getFullYear().toString().slice(-2)
                });
            }

            // Fetch summary for each month (includes department breakdown)
            const promises = chartMonths.map(m =>
                payrollApi.getSummary(m.year, m.month).catch(() => ({ data: null }))
            );
            const results = await Promise.all(promises);

            // Collect all unique departments
            const allDepts = new Set();
            results.forEach(r => {
                if (r?.data?.department_breakdown) {
                    Object.keys(r.data.department_breakdown).forEach(d => allDepts.add(d));
                }
            });

            const data = chartMonths.map((m, idx) => {
                const deptData = {};
                allDepts.forEach(dept => {
                    deptData[dept] = results[idx]?.data?.department_breakdown?.[dept]?.total_pay || 0;
                });
                return {
                    ...m,
                    totalPay: results[idx]?.data?.total_net_pay || 0,
                    departments: deptData
                };
            });

            setChartData({ months: data, departments: Array.from(allDepts) });
        } catch (error) {
            console.error('Error loading chart data:', error);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const params = { year: selectedYear };
            if (selectedMonth) params.month = selectedMonth;

            // Reset management state when changing filters
            setActiveTab('summary');
            setPayrunData([]);

            const [dataRes, summaryRes] = await Promise.all([
                payrollApi.getAll(params),
                payrollApi.getSummary(selectedYear, selectedMonth || undefined)
            ]);

            setPayrollData(dataRes.data);
            setSummary(summaryRes.data);
        } catch (error) {
            console.error('Error loading payroll:', error);
        } finally {
            setLoading(false);
        }
    };

    const initPayrun = async () => {
        if (!selectedMonth) return;

        setIsPayrunInitializing(true);
        try {
            const response = await payrunApi.init(selectedYear, selectedMonth);
            // Ensure components are initialized with default values if missing
            const enrichedData = response.data.map(item => ({
                ...item,
                unpaid_leave: 0,
                absent_days: 0,
                late_early_out: 0,
                ot_1_0_hrs: 0,
                ot_1_5_hrs: 0,
                ot_2_0_hrs: 0,
                deductions_breakdown: {
                    unpaid_leave: 0,
                    absent: 0,
                    late: 0
                },
                ot_breakdown: {
                    ot_1_0: 0,
                    ot_1_5: 0,
                    ot_2_0: 0
                }
            }));
            if (enrichedData.length === 0) {
                showToast('No active associates found to generate payrun.', 'warning');
            } else {
                showToast(`Generated payrun for ${enrichedData.length} associates.`, 'success');
            }

            setPayrunData(enrichedData);
            setActiveTab('management');
        } catch (error) {
            console.error('Error initializing payrun:', error);
            showToast(error.response?.data?.detail || 'Error initializing payrun', 'error');
        } finally {
            setIsPayrunInitializing(false);
        }
    };

    const finalizePayrun = async () => {
        if (!payrunData.length) {
            showToast('No payrun data to finalize', 'warning');
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: 'Finalize Payrun',
            message: `Are you sure you want to finalize the payrun for ${selectedMonth} ${selectedYear}? This will save all current adjustments to the payroll sheet.`,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setIsFinalizing(true);
                try {
                    // Filter payload to match backend expectations exactly
                    const payload = payrunData.map(p => ({
                        payroll_month: p.payroll_month,
                        payroll_year: p.payroll_year,
                        associate_id: p.associate_id,
                        associate_name: p.associate_name,
                        join_date: p.join_date,
                        department_name: p.department_name,
                        designation_name: p.designation_name,
                        earnings: p.earnings,
                        statutories_amount: p.statutories_amount,
                        income_tax: p.income_tax,
                        deductions: p.deductions,
                        net_pay: p.net_pay
                    }));

                    await payrunApi.finalize(payload);
                    showToast('Payrun finalized and saved to sheet successfully!', 'success');
                    setActiveTab('summary');
                    loadData();
                } catch (error) {
                    console.error('Error finalizing payrun:', error);
                    showToast(error.response?.data?.detail || 'Error finalizing payrun', 'error');
                } finally {
                    setIsFinalizing(false);
                }
            }
        });
    };

    const handleEditAdjustments = (assoc) => {
        setEditPayslip({ ...assoc });
    };

    const navigateAssociate = (direction) => {
        const currentIndex = payrunData.findIndex(a => a.associate_id === editPayslip.associate_id);
        let nextIndex = currentIndex + direction;

        if (nextIndex >= 0 && nextIndex < payrunData.length) {
            setEditPayslip({ ...payrunData[nextIndex] });
        }
    };

    const saveAdjustments = () => {
        setPayrunData(prev => prev.map(p =>
            p.associate_id === editPayslip.associate_id ? editPayslip : p
        ));
        setEditPayslip(null);
    };

    const calculateAge = (dob) => {
        if (!dob) return 'N/A';
        try {
            const birthDate = new Date(dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            return `${age} yrs ${Math.abs(m)} month(s)`;
        } catch {
            return 'N/A';
        }
    };

    const calculateDerivedRates = (fixedCtc, year, month) => {
        const daysInMonth = (y, m) => {
            const monthsMap = {
                'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
                'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
            };
            return new Date(y, monthsMap[m] + 1, 0).getDate();
        };

        const baseDays = daysInMonth(year, month) || 28;
        const monthlyCtc = (fixedCtc || 0) / 12;
        const dailyRate = monthlyCtc / baseDays;
        const hourlyRate = dailyRate / 8;
        return { dailyRate, hourlyRate, baseDays };
    };

    const formatCurrency = (amount, associate, decimals = 0) => {
        if (amount === undefined || amount === null) return '-';
        const currency = associate?.currency || 'INR';
        const country = associate?.country || 'India';

        const localeMap = {
            'India': 'en-IN',
            'United States': 'en-US', 'USA': 'en-US',
            'UK': 'en-GB', 'United Kingdom': 'en-GB',
            'UAE': 'en-AE', 'Dubai': 'en-AE',
            'Singapore': 'en-SG'
        };
        const locale = localeMap[country] || 'en-IN';

        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            }).format(amount);
        } catch {
            return `${currency} ${amount.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
        }
    };

    const openModal = () => {
        reset({
            payroll_month: months[new Date().getMonth()],
            payroll_year: new Date().getFullYear(),
            associate_id: '',
            associate_name: '',
            date_of_joining: '',
            department_name: '',
            designation_name: '',
            earnings: 0,
            statutories_amount: 0,
            income_tax: 0,
            deductions: 0,
            net_pay: 0
        });
        setIsModalOpen(true);
    };

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            await payrollApi.create(data);
            await loadData();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving payroll:', error);
            alert(error.response?.data?.detail || 'Error saving payroll');
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            alert('Please upload an Excel file (.xlsx or .xls)');
            return;
        }

        setUploading(true);
        setUploadResult(null);

        try {
            const response = await payrollApi.upload(file);
            setUploadResult({
                success: true,
                message: response.data.message,
                period: response.data.period,
                records: response.data.records_added
            });
            await loadData();
        } catch (error) {
            console.error('Error uploading file:', error);
            setUploadResult({
                success: false,
                message: error.response?.data?.detail || 'Error uploading file'
            });
        } finally {
            setUploading(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const columns = [
        { key: 'associate_id', label: 'Emp Code' },
        { key: 'associate_name', label: 'Associate Name' },
        { key: 'department_name', label: 'Department' },
        { key: 'designation_name', label: 'Designation' },
        {
            key: 'earnings',
            label: 'Earnings',
            render: (value) => `₹${(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        },
        {
            key: 'statutories_amount',
            label: 'Statutories',
            render: (value) => `₹${(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        },
        {
            key: 'income_tax',
            label: 'Income Tax',
            render: (value) => `₹${(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        },
        {
            key: 'deductions',
            label: 'Other Deductions',
            render: (value) => `₹${(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        },
        {
            key: 'net_pay',
            label: 'Net Pay',
            render: (value) => <strong>₹{(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        }
    ];

    if (loading && !payrollData.length) return <Loading />;

    return (
        <div style={{ position: 'relative', minHeight: '400px' }}>
            {/* Blocking Loading Overlay */}
            {(isPayrunInitializing || isFinalizing) && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(4px)'
                }}>
                    <Loading />
                    <p style={{ marginTop: '1rem', fontWeight: '600', color: 'var(--primary-700)' }}>
                        {isPayrunInitializing ? 'Generating Payrun...' : 'Finalizing & Saving to Sheet...'}
                    </p>
                </div>
            )}
            <div className="page-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="page-title">Payroll</h1>
                    <p className="page-subtitle">View and manage payroll data</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginRight: '0.5rem' }}>
                        <select
                            className="form-select"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            style={{ minWidth: '120px', padding: '0.4rem 0.5rem', fontSize: '0.875rem' }}
                        >
                            <option value="">All Months</option>
                            {months.map(month => (
                                <option key={month} value={month}>{month}</option>
                            ))}
                        </select>
                        <select
                            className="form-select"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            style={{ minWidth: '90px', padding: '0.4rem 0.5rem', fontSize: '0.875rem' }}
                        >
                            {[2024, 2025, 2026, 2027].map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".xlsx,.xls"
                        style={{ display: 'none' }}
                    />
                    <button
                        className="btn btn-secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        <FileSpreadsheet size={18} />
                        {uploading ? 'Uploading...' : 'Upload Excel'}
                    </button>
                    <button className="btn btn-primary" onClick={openModal}>
                        <Upload size={18} />
                        Add Entry
                    </button>
                    {isAdmin && (
                        <button
                            className="btn btn-primary"
                            style={{
                                background: payrollData.length > 0 ? 'var(--warning-600)' : 'var(--success-600)',
                                borderColor: payrollData.length > 0 ? 'var(--warning-600)' : 'var(--success-600)'
                            }}
                            onClick={() => {
                                if (payrollData.length > 0) {
                                    setConfirmModal({
                                        isOpen: true,
                                        title: 'Re-run Payroll',
                                        message: 'A finalized payrun already exists for this month. Initializing a new payrun will NOT overwrite existing entries until you finalize again. Do you want to continue?',
                                        onConfirm: () => {
                                            setConfirmModal({ ...confirmModal, isOpen: false });
                                            initPayrun();
                                        }
                                    });
                                } else {
                                    initPayrun();
                                }
                            }}
                            disabled={isPayrunInitializing || !selectedMonth}
                        >
                            <ClipboardCheck size={18} />
                            {isPayrunInitializing ? 'Initializing...' : (payrollData.length > 0 ? 'Re-run Payroll' : 'Run Payroll')}
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs-container">
                <button
                    className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                    onClick={() => setActiveTab('summary')}
                >
                    <TrendingUp size={18} className="tab-icon" />
                    Payroll Summary
                </button>
                {isAdmin && (
                    <button
                        className={`tab-btn ${activeTab === 'management' ? 'active' : ''}`}
                        onClick={() => setActiveTab('management')}
                    >
                        <Settings size={18} className="tab-icon" />
                        Payroll Management
                    </button>
                )}
            </div>

            {activeTab === 'summary' ? (
                <>
                    {/* Upload Result Notification */}
                    {uploadResult && (
                        <div
                            className={`alert ${uploadResult.success ? 'alert-success' : 'alert-error'}`}
                            style={{
                                marginBottom: '1rem',
                                padding: '1rem',
                                borderRadius: '8px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: uploadResult.success ? 'var(--success-50)' : 'var(--error-50)',
                                border: `1px solid ${uploadResult.success ? 'var(--success-300)' : 'var(--error-300)'}`,
                                color: uploadResult.success ? 'var(--success-700)' : 'var(--error-700)'
                            }}
                        >
                            <span>{uploadResult.message}</span>
                            <button
                                onClick={() => setUploadResult(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '1.25rem',
                                    lineHeight: 1
                                }}
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {/* Summary Section Toggle */}
                    <div
                        onClick={() => setShowSummary(!showSummary)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem 1rem',
                            background: 'var(--gray-50)',
                            borderRadius: '8px',
                            marginBottom: '1rem',
                            cursor: 'pointer',
                            border: '1px solid var(--gray-200)',
                            transition: 'all 0.2s ease'
                        }}
                        className="summary-toggle-header"
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingDown size={18} className="text-primary-600" />
                            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>Summary</h2>
                        </div>
                        {showSummary ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>

                    {showSummary && (
                        <div className="summary-section-content" style={{ animation: 'slideDown 0.3s ease-out' }}>
                            {/* 12-Month Stacked Bar Chart by Department */}
                            {chartData.months?.length > 0 && chartData.departments?.length > 0 && (() => {
                                // Department colors
                                const deptColors = [
                                    'var(--primary-500)', 'var(--success-500)', 'var(--warning-500)',
                                    'var(--error-400)', 'var(--info-500)', '#8b5cf6', '#ec4899',
                                    '#14b8a6', '#f97316', '#84cc16'
                                ];

                                // Calculate max value for Y-axis
                                const maxVal = Math.max(...chartData.months.map(m => m.totalPay));
                                const yAxisSteps = 5;
                                const stepValue = maxVal / yAxisSteps;

                                return (
                                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                                        <div className="card-header">
                                            <h3 className="card-title">Last 12 Months Payroll by Department</h3>
                                        </div>
                                        <div className="card-body">
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {/* Y-Axis Labels */}
                                                <div style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between',
                                                    height: '200px',
                                                    paddingRight: '8px',
                                                    borderRight: '1px solid var(--gray-200)',
                                                    minWidth: '50px',
                                                    textAlign: 'right'
                                                }}>
                                                    {[...Array(yAxisSteps + 1)].map((_, i) => (
                                                        <span key={i} style={{
                                                            fontSize: '0.7rem',
                                                            color: 'var(--gray-500)',
                                                            lineHeight: 1
                                                        }}>
                                                            ₹{((yAxisSteps - i) * stepValue / 100000).toFixed(1)}L
                                                        </span>
                                                    ))}
                                                </div>

                                                {/* Chart Bars */}
                                                <div style={{
                                                    flex: 1,
                                                    display: 'flex',
                                                    flexDirection: 'column'
                                                }}>
                                                    {/* Bars */}
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'flex-end',
                                                        gap: '6px',
                                                        height: '200px'
                                                    }}>
                                                        {chartData.months.map((item, idx) => {
                                                            const barHeight = maxVal > 0 ? (item.totalPay / maxVal) * 180 : 0;

                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    style={{
                                                                        flex: 1,
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        alignItems: 'center'
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            width: '100%',
                                                                            display: 'flex',
                                                                            flexDirection: 'column-reverse',
                                                                            borderRadius: '4px 4px 0 0',
                                                                            overflow: 'hidden',
                                                                            minHeight: '4px',
                                                                            height: `${barHeight}px`
                                                                        }}
                                                                        title={chartData.departments.map(d =>
                                                                            `${d}: ₹${((item.departments[d] || 0) / 100000).toFixed(2)}L`
                                                                        ).join('\n')}
                                                                    >
                                                                        {chartData.departments.map((dept, dIdx) => {
                                                                            const deptVal = item.departments[dept] || 0;
                                                                            const deptHeight = item.totalPay > 0
                                                                                ? (deptVal / item.totalPay) * 100
                                                                                : 0;
                                                                            return (
                                                                                <div
                                                                                    key={dept}
                                                                                    style={{
                                                                                        height: `${deptHeight}%`,
                                                                                        background: deptColors[dIdx % deptColors.length],
                                                                                        transition: 'height 0.3s ease'
                                                                                    }}
                                                                                />
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* X-Axis: Months */}
                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '6px',
                                                        marginTop: '8px',
                                                        borderTop: '1px solid var(--gray-200)',
                                                        paddingTop: '6px'
                                                    }}>
                                                        {chartData.months.map((item, idx) => (
                                                            <div
                                                                key={idx}
                                                                style={{
                                                                    flex: 1,
                                                                    textAlign: 'center',
                                                                    fontSize: '0.65rem',
                                                                    color: 'var(--gray-600)',
                                                                    fontWeight: '500'
                                                                }}
                                                            >
                                                                {item.month.slice(0, 3)}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* X-Axis: Years */}
                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '6px',
                                                        marginTop: '2px'
                                                    }}>
                                                        {chartData.months.map((item, idx) => {
                                                            // Only show year if it's the first month or different from previous
                                                            const showYear = idx === 0 || item.year !== chartData.months[idx - 1].year;
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    style={{
                                                                        flex: 1,
                                                                        textAlign: 'center',
                                                                        fontSize: '0.6rem',
                                                                        color: 'var(--gray-400)'
                                                                    }}
                                                                >
                                                                    {showYear ? item.year : ''}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Legend */}
                                            <div style={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                justifyContent: 'center',
                                                gap: '1rem',
                                                marginTop: '2rem',
                                                fontSize: '0.75rem'
                                            }}>
                                                {chartData.departments.map((dept, idx) => (
                                                    <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <div style={{
                                                            width: '10px',
                                                            height: '10px',
                                                            background: deptColors[idx % deptColors.length],
                                                            borderRadius: '2px'
                                                        }} />
                                                        <span>{dept}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Summary Stats */}
                            {summary && (
                                <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                                    <StatCard
                                        icon={Users}
                                        value={summary.employee_count}
                                        label="Employees"
                                        color="blue"
                                    />
                                    <StatCard
                                        icon={Wallet}
                                        value={`₹${(summary.total_earnings / 100000).toFixed(2)}L`}
                                        label="Total Earnings"
                                        color="green"
                                    />
                                    <StatCard
                                        icon={TrendingDown}
                                        value={`₹${(summary.total_deductions / 100000).toFixed(2)}L`}
                                        label="Total Deductions"
                                        color="yellow"
                                    />
                                    <StatCard
                                        icon={Wallet}
                                        value={`₹${(summary.total_net_pay / 100000).toFixed(2)}L`}
                                        label="Net Payout"
                                        color="green"
                                    />
                                </div>
                            )}

                            {/* Department Breakdown */}
                            {summary && summary.department_breakdown && (
                                <div className="card mb-4" style={{ marginBottom: '1.5rem' }}>
                                    <div className="card-header">
                                        <h3 className="card-title">Department Breakdown</h3>
                                    </div>
                                    <div className="card-body">
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                            {Object.entries(summary.department_breakdown).map(([dept, data]) => (
                                                <div key={dept} style={{
                                                    padding: '1rem',
                                                    background: 'var(--gray-50)',
                                                    borderRadius: '8px'
                                                }}>
                                                    <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{dept}</div>
                                                    <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                                                        {data.count} employees
                                                    </div>
                                                    <div style={{ fontWeight: '700', color: 'var(--primary-600)' }}>
                                                        ₹{(data.total_pay / 100000).toFixed(2)}L
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Data Table */}
                    <div className="card">
                        <div className="card-body" style={{ padding: 0 }}>
                            <DataTable
                                columns={columns}
                                data={payrollData}
                                searchFields={['associate_id', 'associate_name', 'department_name']}
                            />
                        </div>
                    </div>

                    <Modal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        title="Add Payroll Entry"
                        footer={
                            <>
                                <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleSubmit(onSubmit)} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                            </>
                        }
                    >
                        <form>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Month</label>
                                    <select className="form-select" {...register('payroll_month')}>
                                        {months.map(month => (
                                            <option key={month} value={month}>{month}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Year</label>
                                    <input type="number" className="form-input" {...register('payroll_year')} />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Associate ID</label>
                                    <input className="form-input" {...register('associate_id')} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Associate Name</label>
                                    <input className="form-input" {...register('associate_name')} />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Department</label>
                                    <input className="form-input" {...register('department_name')} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Designation</label>
                                    <input className="form-input" {...register('designation_name')} />
                                </div>
                            </div>

                            <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Salary Components</h4>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Earnings</label>
                                    <input type="number" className="form-input" {...register('earnings')} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Statutories</label>
                                    <input type="number" className="form-input" {...register('statutories_amount')} />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Income Tax</label>
                                    <input type="number" className="form-input" {...register('income_tax')} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Deductions</label>
                                    <input type="number" className="form-input" {...register('deductions')} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Net Pay</label>
                                <input type="number" className="form-input" {...register('net_pay')} />
                            </div>
                        </form>
                    </Modal>
                </>
            ) : (
                /* Management Tab View */
                <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 className="card-title">Payrun Management - {selectedMonth} {selectedYear}</h3>
                            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Adjust and finalize payroll for all active associates</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setActiveTab('summary')}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={finalizePayrun}
                                disabled={isFinalizing || !payrunData.length}
                            >
                                <Save size={18} />
                                {isFinalizing ? 'Finalizing...' : 'Finalize Payrun'}
                            </button>
                        </div>
                    </div>
                    <div className="card-body" style={{ padding: payrunData.length === 0 ? '2rem' : 0 }}>
                        {payrunData.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem' }}>
                                <ClipboardCheck size={48} style={{ color: 'var(--gray-300)', marginBottom: '1rem' }} />
                                <h4 style={{ color: 'var(--gray-600)' }}>
                                    {payrollData.length > 0 ? `Payrun already exists for ${selectedMonth} ${selectedYear}` : 'No Payrun Data Loaded'}
                                </h4>
                                <p style={{ color: 'var(--gray-400)', maxWidth: '400px', margin: '0.5rem auto' }}>
                                    {payrollData.length > 0 ? (
                                        <>
                                            Data has already been finalized and saved. You can view it in the <strong>Payroll Summary</strong> tab, or click <strong>Re-run Payroll</strong> above if you need to make changes.
                                        </>
                                    ) : (
                                        <>
                                            Click the <strong>Run Payroll</strong> button in the header to initialize the payrun for {selectedMonth} {selectedYear}.
                                        </>
                                    )}
                                </p>
                            </div>
                        ) : (
                            <DataTable
                                columns={[
                                    { key: 'associate_id', label: 'ID' },
                                    { key: 'associate_name', label: 'Name' },
                                    {
                                        key: 'earnings',
                                        label: 'Gross Earnings',
                                        render: (val, row) => formatCurrency(val, row)
                                    },
                                    {
                                        key: 'income_tax',
                                        label: 'Income Tax',
                                        render: (val, row) => formatCurrency(val, row)
                                    },
                                    {
                                        key: 'deductions',
                                        label: 'Adjustments',
                                        render: (val, row) => <span className={val > 0 ? 'text-error-600' : ''}>{formatCurrency(val, row)}</span>
                                    },
                                    {
                                        key: 'net_pay',
                                        label: 'Net Payout',
                                        render: (val, row) => <strong>{formatCurrency(val, row)}</strong>
                                    },
                                    {
                                        key: 'actions',
                                        label: 'Actions',
                                        render: (_, row) => (
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => handleEditAdjustments(row)}
                                                style={{ padding: '6px', borderRadius: '4px' }}
                                                title="Adjust Payslip"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                        )
                                    }
                                ]}
                                data={payrunData}
                                searchFields={['associate_name', 'associate_id']}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Advanced Payslip Modal */}
            <Modal
                isOpen={!!editPayslip}
                onClose={() => setEditPayslip(null)}
                title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div
                                onClick={() => navigateAssociate(-1)}
                                style={{
                                    width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gray-100)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: payrunData.findIndex(a => a.associate_id === editPayslip?.associate_id) === 0 ? 'not-allowed' : 'pointer',
                                    opacity: payrunData.findIndex(a => a.associate_id === editPayslip?.associate_id) === 0 ? 0.5 : 1
                                }}
                            >
                                <ChevronDown size={18} style={{ transform: 'rotate(90deg)' }} />
                            </div>
                            <span style={{ fontSize: '1rem', fontWeight: '700' }}>
                                {editPayslip?.associate_id?.toUpperCase()}:{editPayslip?.associate_name?.toUpperCase()}
                            </span>
                        </div>
                        <div
                            onClick={() => navigateAssociate(1)}
                            style={{
                                width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gray-100)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: payrunData.findIndex(a => a.associate_id === editPayslip?.associate_id) === payrunData.length - 1 ? 'not-allowed' : 'pointer',
                                opacity: payrunData.findIndex(a => a.associate_id === editPayslip?.associate_id) === payrunData.length - 1 ? 0.5 : 1,
                                marginRight: '1rem'
                            }}
                        >
                            <ChevronDown size={18} style={{ transform: 'rotate(-90deg)' }} />
                        </div>
                    </div>
                }
                style={{ maxWidth: '1400px', width: '95vw' }}
                footer={null}
            >
                {editPayslip && (() => {
                    const { dailyRate, hourlyRate, baseDays } = calculateDerivedRates(editPayslip.fixed_ctc || 0, selectedYear, selectedMonth);

                    // Live Calculation Helper
                    const updateComp = (field, val) => {
                        const numVal = parseFloat(val) || 0;
                        const newPayslip = { ...editPayslip, [field]: numVal };

                        // Recalculate everything
                        const leaveDeduction = (newPayslip.unpaid_leave || 0) * dailyRate;
                        const absentDeduction = (newPayslip.absent_days || 0) * dailyRate;
                        const lateDeduction = (newPayslip.late_early_out || 0) * (hourlyRate * 0.5);

                        const ot10 = (newPayslip.ot_1_0_hrs || 0) * hourlyRate * 1.0;
                        const ot15 = (newPayslip.ot_1_5_hrs || 0) * hourlyRate * 1.5;
                        const ot20 = (newPayslip.ot_2_0_hrs || 0) * hourlyRate * 2.0;

                        newPayslip.deductions_breakdown = { unpaid_leave: leaveDeduction, absent: absentDeduction, late: lateDeduction };
                        newPayslip.ot_breakdown = { ot_1_0: ot10, ot_1_5: ot15, ot_2_0: ot20 };

                        const totalAdjustment = leaveDeduction + absentDeduction + lateDeduction;
                        const totalOt = ot10 + ot15 + ot20;

                        newPayslip.earnings = (newPayslip.components?.basic || 0) + (newPayslip.components?.hra || 0) + (newPayslip.components?.supplementary || 0) + totalOt - totalAdjustment;
                        newPayslip.net_pay = newPayslip.earnings - (newPayslip.income_tax || 0) - (newPayslip.deductions || 0);

                        setEditPayslip(newPayslip);
                    };

                    return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', padding: '1rem' }}>
                            {/* Col 1: Employee Summary */}
                            <div className="card" style={{ padding: '1rem', background: '#f8fafc' }}>
                                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--gray-600)' }}>Employee Summary</h4>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Age</div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{calculateAge(editPayslip.dob)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Birth Date</div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{editPayslip.dob || '-'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Hourly Rate</div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{formatCurrency(hourlyRate, editPayslip, 2)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Daily Rate</div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{formatCurrency(dailyRate, editPayslip, 2)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Pay Period</div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{selectedMonth.slice(0, 3)}-{selectedYear}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Base Days</div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{baseDays}</div>
                                    </div>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Join Date</div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{editPayslip.join_date}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Col 2: Work Adjustments */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="card" style={{ padding: '0 0 1rem 0' }}>
                                    <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Unpaid Leave , Absent & Lateness</span>
                                        <Settings size={14} className="text-warning-500" />
                                    </div>
                                    <div style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.7rem', color: 'var(--gray-400)', marginBottom: '0.5rem', gap: '2rem' }}>
                                            <span>Hrs/Days</span>
                                            <span>Amount</span>
                                        </div>
                                        {[
                                            { label: 'Unpaid Leave', field: 'unpaid_leave', breakdown: 'unpaid_leave' },
                                            { label: 'Absent', field: 'absent_days', breakdown: 'absent' },
                                            { label: 'Late & Early Out', field: 'late_early_out', breakdown: 'late' }
                                        ].map(item => (
                                            <div key={item.field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{item.label}</span>
                                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        style={{ width: '60px', padding: '4px 8px', textAlign: 'center' }}
                                                        value={editPayslip[item.field] || 0}
                                                        onChange={(e) => updateComp(item.field, e.target.value)}
                                                    />
                                                    <span style={{ width: '60px', textAlign: 'right', fontSize: '0.875rem' }}>
                                                        {formatCurrency(Math.round(editPayslip.deductions_breakdown?.[item.breakdown] || 0), editPayslip)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="card" style={{ padding: '0 0 1rem 0' }}>
                                    <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Overtime Details</span>
                                        <Settings size={14} className="text-warning-500" />
                                    </div>
                                    <div style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.7rem', color: 'var(--gray-400)', marginBottom: '0.5rem', gap: '2rem' }}>
                                            <span>Hours</span>
                                            <span>Rate</span>
                                            <span>Amount</span>
                                        </div>
                                        {[
                                            { label: '1.0', field: 'ot_1_0_hrs', rate: hourlyRate, breakdown: 'ot_1_0' },
                                            { label: '1.5', field: 'ot_1_5_hrs', rate: hourlyRate * 1.5, breakdown: 'ot_1_5' },
                                            { label: '2.0', field: 'ot_2_0_hrs', rate: hourlyRate * 2.0, breakdown: 'ot_2_0' }
                                        ].map(item => (
                                            <div key={item.field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{item.label}</span>
                                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        style={{ width: '60px', padding: '4px 8px', textAlign: 'center' }}
                                                        value={editPayslip[item.field] || 0}
                                                        onChange={(e) => updateComp(item.field, e.target.value)}
                                                    />
                                                    <span style={{ width: '60px', textAlign: 'center', fontSize: '0.8rem' }}>{formatCurrency(item.rate, editPayslip, 2)}</span>
                                                    <span style={{ width: '60px', textAlign: 'right', fontSize: '0.875rem' }}>
                                                        {formatCurrency(Math.round(editPayslip.ot_breakdown?.[item.breakdown] || 0), editPayslip)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Col 3: Earnings & Deductions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>Earnings</span>
                                        <span style={{ fontWeight: '600' }}>{formatCurrency(editPayslip.earnings, editPayslip)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <span style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>Deductions</span>
                                        <span style={{ fontWeight: '600' }}>{formatCurrency(editPayslip.income_tax + editPayslip.deductions, editPayslip)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #dcfce7', paddingTop: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>Total Salary</span>
                                            <Settings size={14} className="text-warning-500" />
                                        </div>
                                        <span style={{ fontWeight: '800', fontSize: '1.25rem', color: '#16a34a' }}>
                                            {formatCurrency(editPayslip.net_pay, editPayslip)}
                                        </span>
                                    </div>
                                </div>

                                <div className="card" style={{ padding: '0' }}>
                                    <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Additions / Deductions</span>
                                        <button className="btn btn-link btn-sm" style={{ padding: 0 }}>Add Allowance</button>
                                    </div>
                                    <div style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--gray-400)', marginBottom: '1rem' }}>
                                            <span>Description</span>
                                            <span>Amount</span>
                                        </div>
                                        {[
                                            { label: 'Basic', val: editPayslip.components?.basic, type: '+' },
                                            { label: 'House Rent Allowance', val: editPayslip.components?.hra, type: '+' },
                                            { label: 'Supplementary Allowance', val: editPayslip.components?.supplementary, type: '+' },
                                            { label: 'PT', val: editPayslip.income_tax, type: '-', field: 'income_tax' },
                                            { label: 'Employee EPF', val: editPayslip.deductions, type: '-', field: 'deductions' }
                                        ].map(item => (
                                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                                <span style={{ fontSize: '0.875rem', color: 'var(--gray-700)' }}>{item.label}</span>
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    <div style={{
                                                        width: '24px', height: '24px', borderRadius: '4px', background: item.type === '+' ? '#f0fdf4' : '#fef2f2',
                                                        color: item.type === '+' ? '#16a34a' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem'
                                                    }}>
                                                        {item.type}
                                                    </div>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        style={{ width: '100px', textAlign: 'right', padding: '4px 8px' }}
                                                        value={Math.round(item.val || 0)}
                                                        onChange={item.field ? (e) => updateComp(item.field, e.target.value) : undefined}
                                                        readOnly={!item.field}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <button className="btn btn-primary w-full" style={{ marginTop: 'auto' }} onClick={saveAdjustments}>SAVE CHANGES</button>
                            </div>
                        </div>
                    );
                })()}
            </Modal>
            <style>{`
                /* Tabs - Premium Redesign */
                .tabs-container {
                    display: flex;
                    gap: 4px;
                    margin: 2rem 0;
                    background: #f8fafc;
                    padding: 6px;
                    border-radius: 16px;
                    width: fit-content;
                    border: 1px solid #e2e8f0;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }

                .tab-btn {
                    padding: 0.75rem 1.75rem;
                    border: none;
                    background: transparent;
                    font-size: 0.8125rem;
                    font-weight: 700;
                    color: #64748b;
                    cursor: pointer;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    position: relative;
                }

                .tab-btn:hover {
                    color: #0f172a;
                    transform: translateY(-1px);
                }

                .tab-btn.active {
                    color: white;
                    background: var(--gradient-primary);
                    box-shadow: var(--shadow-glow);
                }

                .tab-btn .tab-icon {
                    transition: transform 0.3s ease;
                    color: #94a3b8;
                }

                .tab-btn.active .tab-icon {
                    transform: scale(1.1);
                    color: white;
                }

                .summary-toggle-header:hover {
                    background: var(--gray-100) !important;
                }
            `}</style>
            {/* Confirmation Modal */}
            <Modal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                title={confirmModal.title}
                footer={
                    <>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={confirmModal.onConfirm}
                        >
                            Confirm
                        </button>
                    </>
                }
            >
                <div style={{ padding: '1rem 0' }}>
                    <p>{confirmModal.message}</p>
                </div>
            </Modal>
        </div>
    );
}

export default Payroll;
