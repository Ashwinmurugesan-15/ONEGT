import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Send, Check, X, ChevronDown, ChevronUp, ExternalLink, Eye, List, History, Upload, Loader, Undo2, DollarSign } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import { expensesApi, expenseReportsApi, projectsApi, associatesApi, currencyApi, allocationsApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

// Predefined expense categories
const EXPENSE_CATEGORIES = [
    'Auditor', 'Bank Charges', 'CSR', 'Food', 'Gift', 'Hardware Asset',
    'Insurance premium', 'Marketting', 'Office Supplies', 'Outsourcing',
    'Rent', 'Salary', 'Shipping', 'Software License', 'Telephone & Internet',
    'Training', 'Travel', 'Provident Fund', 'Income Tax', 'Sales Commission',
    'Team Outing', 'GST', 'Client Visit'
];

const STATUS_COLORS = {
    DRAFT: { bg: 'var(--gray-100)', color: 'var(--gray-700)' },
    SUBMITTED: { bg: 'var(--primary-100)', color: 'var(--primary-700)' },
    APPROVED: { bg: 'var(--success-100)', color: 'var(--success-700)' },
    REJECTED: { bg: 'var(--error-100)', color: 'var(--error-700)' },
    PAID: { bg: '#e0f2fe', color: '#0369a1' }
};

function Expenses() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState([]);
    const [projects, setProjects] = useState([]);
    const [associates, setAssociates] = useState([]);
    const [summary, setSummary] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [saving, setSaving] = useState(false);

    // Action Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', report: null });
    const [filters, setFilters] = useState({ project_id: '', status: '', associate_id: '' });

    const [activeTab, setActiveTab] = useState('my'); // 'my', 'team', 'all', or 'summary'
    const [summaryTabFilters, setSummaryTabFilters] = useState({
        period: new Date().getFullYear().toString()
    });
    const [summaryData, setSummaryData] = useState(null);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [approvalComment, setApprovalComment] = useState('');
    const [currencies, setCurrencies] = useState(['INR', 'USD', 'SGD']);
    const [currencyRates, setCurrencyRates] = useState({});
    const [latestRates, setLatestRates] = useState({});
    const [showSummary, setShowSummary] = useState(false);
    const [showValidation, setShowValidation] = useState(false);
    const [allocatedProjectIds, setAllocatedProjectIds] = useState([]);
    const [uploadingReceipt, setUploadingReceipt] = useState({});  // { itemIndex: true/false }
    const [validationErrors, setValidationErrors] = useState({});  // { 'index-field': true }
    const { showToast } = useToast();

    // Generate filter options
    const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
    const fys = Array.from({ length: 5 }, (_, i) => {
        const yr = new Date().getFullYear() - i;
        return `FY${String(yr).slice(-2)}-${String(yr + 1).slice(-2)}`;
    });

    // Date Filter State
    const [dateFilterMode, setDateFilterMode] = useState('all'); // 'thisMonth', 'lastMonth', 'lastYear', 'custom', 'all'
    const [customRange, setCustomRange] = useState({ start: '', end: '' });

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentReportId, setPaymentReportId] = useState('');

    // Helper to check if a field has an error
    const hasError = (index, field) => !!validationErrors[`${index} -${field} `];
    const errorStyle = (index, field) => hasError(index, field) ? {
        border: '1.5px solid #ef4444',
        boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)',
        animation: 'glow-red 1.5s ease-in-out infinite alternate'
    } : {};

    useEffect(() => {
        if (showValidation) {
            const timer = setTimeout(() => {
                setShowValidation(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [showValidation]);



    const showValidationError = (msg) => {
        showToast(msg, 'error', 5000);
    };

    const formatMonth = (yyyyMM) => {
        if (!yyyyMM || !yyyyMM.includes('-')) return yyyyMM;
        const [year, month] = yyyyMM.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleString('default', { month: 'short' }) + '-' + year;
    };

    // Form state for expense report
    const [reportForm, setReportForm] = useState({
        associate_id: '',
        project_id: '',
        project_name: '',
        items: [createEmptyItem()]
    });

    function createEmptyItem() {
        return {
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            category: '',
            bill_no: '',
            description: '',
            expense_amount: 0,
            currency: 'INR',
            payment_mode: 'Self',
            receipt_file_id: '',
            expense_folder_id: ''
        };
    }

    // Fetch allocations when associate changes
    useEffect(() => {
        if (reportForm.associate_id) {
            allocationsApi.getByAssociate(reportForm.associate_id)
                .then(res => {
                    // Ensure unique strings for comparison
                    const ids = [...new Set(res.data.map(a => String(a.project_id).trim()))];
                    setAllocatedProjectIds(ids);
                })
                .catch(err => console.error('Error fetching allocations:', err));
        } else {
            setAllocatedProjectIds([]);
        }
    }, [reportForm.associate_id]);

    // Helper to get month/year from date string
    const getMonthYearFromDate = (dateStr) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return { year: date.getFullYear(), month: months[date.getMonth()] };
    };

    // Convert amount to INR based on currency and date
    const getINRAmount = (amount, currency, dateStr) => {
        if (!amount || currency === 'INR') return parseFloat(amount) || 0;

        let rates = null;
        const period = getMonthYearFromDate(dateStr);

        if (period) {
            const rateKey = `${period.year} -${period.month} `;
            rates = currencyRates[rateKey];
        }

        // Fallback to latest rates if specific month not found
        if (!rates) {
            rates = latestRates;
        }

        if (rates && rates[currency] && rates['INR']) {
            // Rate is value per 1 USD, so: amount * (INR_rate / currency_rate)
            const inrRate = rates['INR'] || 1;
            const currRate = rates[currency] || 1;
            return (parseFloat(amount) || 0) * (inrRate / currRate);
        }

        return parseFloat(amount) || 0;
    };

    useEffect(() => {
        loadData();
    }, [filters]);

    useEffect(() => {
        if (activeTab === 'summary') {
            loadSummaryData();
        }
    }, [activeTab, summaryTabFilters]);

    const loadSummaryData = async () => {
        setIsSummaryLoading(true);
        try {
            // Only send non-empty filters
            const params = {};
            if (summaryTabFilters.period) {
                if (summaryTabFilters.period.startsWith('FY')) {
                    params.financial_year = summaryTabFilters.period;
                } else {
                    params.year = summaryTabFilters.period;
                }
            }
            if (filters.project_id) params.project_id = filters.project_id;

            const res = await expensesApi.getSummary(params);

            // Filter out data before August 2024 (2024-08)
            const filteredMonthly = {};
            if (res.data && res.data.monthly_by_category) {
                Object.entries(res.data.monthly_by_category).forEach(([month, data]) => {
                    if (month >= '2024-08') {
                        filteredMonthly[month] = data;
                    }
                });
            }

            setSummaryData({
                ...res.data,
                monthly_by_category: filteredMonthly
            });
        } catch (error) {
            console.error('Error loading summary data:', error);
        } finally {
            setIsSummaryLoading(false);
        }
    };

    const loadData = async () => {
        try {
            const [reportsRes, projRes, assocRes, summaryRes, currRes, ratesRes] = await Promise.all([
                expenseReportsApi.getAll(filters),
                projectsApi.getAll(),
                associatesApi.getAll(),
                expensesApi.getSummary(filters),
                currencyApi.getCurrencies(),
                currencyApi.getTrend(24)  // Get last 24 months of rates
            ]);

            // Deduplicate lists just in case
            const uniqueProjects = Array.from(new Map(projRes.data.map(item => [String(item.project_id).trim(), item])).values());
            const uniqueAssociates = Array.from(new Map(assocRes.data.map(item => [String(item.associate_id).trim(), item])).values());

            setReports(reportsRes.data);
            setProjects(uniqueProjects);
            setAssociates(uniqueAssociates);
            setSummary(summaryRes.data);

            // Set available currencies
            if (currRes.data && currRes.data.length > 0) {
                setCurrencies(currRes.data);
            }

            // Build rates lookup by year-month
            const ratesLookup = {};
            if (ratesRes.data && ratesRes.data.length > 0) {
                // Since data is sorted descending, first item is latest
                setLatestRates(ratesRes.data[0].rates);

                ratesRes.data.forEach(rate => {
                    const key = `${rate.year} -${rate.month} `;
                    ratesLookup[key] = rate.rates;
                });
            }
            setCurrencyRates(ratesLookup);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Create lookup maps
    const projectLookup = projects.reduce((acc, p) => {
        acc[p.project_id] = p;
        return acc;
    }, {});

    const associateLookup = associates.reduce((acc, a) => {
        acc[a.associate_id] = a.associate_name;
        return acc;
    }, {});

    const openModal = (report = null) => {
        setSelectedReport(report);
        if (report) {
            // Editing existing report
            setReportForm({
                associate_id: report.associate_id,
                project_id: report.project_id,
                project_name: report.project_name,
                expense_report_name: report.expense_report_name || '',
                expense_report_date: report.expense_report_date || new Date().toISOString().split('T')[0],
                items: report.items.map(item => ({
                    id: item.expense_id || Date.now(),
                    date: item.date,
                    category: item.category,
                    bill_no: item.bill_no,
                    description: item.description,
                    expense_amount: item.expense_amount,
                    currency: item.currency || 'INR', // Default to INR if missing
                    payment_mode: item.payment_mode || 'Self',
                    receipt_file_id: item.receipt_file_id || '',
                    expense_folder_id: item.expense_folder_id || ''
                }))
            });
        } else {
            // New report - pre-fill associate if user is logged in
            setReportForm({
                associate_id: user?.associate_id || '',
                project_id: '',
                project_name: '',
                expense_report_name: '',
                expense_report_date: new Date().toISOString().split('T')[0],
                items: [createEmptyItem()]
            });
        }
        setIsModalOpen(true);
    };



    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedReport(null);
        setReportForm({
            associate_id: '',
            project_id: '',
            project_name: '',
            expense_report_name: '',
            expense_report_date: new Date().toISOString().split('T')[0],
            items: [createEmptyItem()]
        });
    };

    const handleProjectChange = (projectId) => {
        const project = projectLookup[projectId];
        setReportForm({
            ...reportForm,
            project_id: projectId,
            project_name: project?.project_name || ''
        });
    };

    const addItem = () => {
        setReportForm({
            ...reportForm,
            items: [...reportForm.items, createEmptyItem()]
        });
    };

    const removeItem = (index) => {
        if (reportForm.items.length === 1) return;
        const newItems = reportForm.items.filter((_, i) => i !== index);
        setReportForm({ ...reportForm, items: newItems });
    };

    const updateItem = (index, field, value) => {
        setReportForm(prev => {
            const newItems = [...prev.items];
            newItems[index] = { ...newItems[index], [field]: value };
            return { ...prev, items: newItems };
        });
    };

    const calculateTotal = () => {
        return reportForm.items.reduce((sum, item) => {
            const amount = getINRAmount(item.expense_amount, item.currency, item.date);
            return sum + amount;
        }, 0);
    };


    const handleReceiptUpload = async (index, file) => {
        if (!file) return;

        let reportId = selectedReport?.expense_report_id;

        // If this is a new report (no ID yet), save as draft first to get a real ID
        if (!reportId) {
            if (!reportForm.associate_id || !reportForm.project_id) {
                showValidationError('Please verify your user profile and select a Project before uploading receipts');
                return;
            }
            try {
                const payload = {
                    associate_id: reportForm.associate_id,
                    project_id: reportForm.project_id,
                    project_name: reportForm.project_name,
                    expense_report_name: reportForm.expense_report_name || '',
                    expense_report_date: reportForm.expense_report_date || new Date().toISOString().split('T')[0],
                    items: reportForm.items.map(item => ({
                        date: item.date,
                        category: item.category || '',
                        bill_no: item.bill_no || '',
                        description: item.description || '',
                        expense_amount: parseFloat(item.expense_amount) || 0,
                        payment_mode: item.payment_mode || 'Self',
                        receipt_file_id: item.receipt_file_id || '',
                        expense_folder_id: item.expense_folder_id || ''
                    }))
                };
                const res = await expenseReportsApi.create(payload);
                reportId = res.data.expense_report_id;
                // Update selectedReport so subsequent uploads reuse the same ID and remains a draft
                setSelectedReport({ ...selectedReport, expense_report_id: reportId, status: 'DRAFT' });
                showToast('Report auto-saved as draft', 'info', 2000);
            } catch (err) {
                console.error('Failed to auto-save report:', err);
                showValidationError('Failed to save report before uploading receipt');
                return;
            }
        }

        setUploadingReceipt(prev => ({ ...prev, [index]: true }));
        try {
            const res = await expenseReportsApi.uploadReceipt(reportId, file);
            if (res.data?.file_id) {
                updateItem(index, 'receipt_file_id', res.data.file_id);
                updateItem(index, 'expense_folder_id', res.data.folder_id);

                // Silently push the IDs to the backend to persist them immediately
                const syncPayload = {
                    associate_id: reportForm.associate_id,
                    project_id: reportForm.project_id,
                    project_name: reportForm.project_name,
                    expense_report_name: reportForm.expense_report_name || '',
                    expense_report_date: reportForm.expense_report_date || new Date().toISOString().split('T')[0],
                    items: reportForm.items.map((item, i) => {
                        if (i === index) {
                            return {
                                ...item,
                                expense_amount: parseFloat(item.expense_amount) || 0,
                                currency: item.currency || 'INR',
                                payment_mode: item.payment_mode || 'Self',
                                receipt_file_id: res.data.file_id,
                                expense_folder_id: res.data.folder_id
                            };
                        }
                        return {
                            ...item,
                            expense_amount: parseFloat(item.expense_amount) || 0,
                            currency: item.currency || 'INR',
                            payment_mode: item.payment_mode || 'Self',
                            receipt_file_id: item.receipt_file_id || '',
                            expense_folder_id: item.expense_folder_id || ''
                        };
                    })
                };
                await expenseReportsApi.update(reportId, syncPayload);
                await loadData();
            }
        } catch (err) {
            console.error('Receipt upload failed:', err);
            showValidationError(err.response?.data?.detail || 'Failed to upload receipt');
        } finally {
            setUploadingReceipt(prev => ({ ...prev, [index]: false }));
        }
    };

    const handleSaveDraft = async () => {
        setSaving(true); // Use saving state for both save and submit
        try {
            const payload = {
                associate_id: reportForm.associate_id,
                project_id: reportForm.project_id,
                project_name: reportForm.project_name,
                expense_report_name: reportForm.expense_report_name || '',
                expense_report_date: reportForm.expense_report_date || new Date().toISOString().split('T')[0],
                items: reportForm.items.map(item => ({
                    date: item.date,
                    category: item.category || '',
                    bill_no: item.bill_no || '',
                    description: item.description || '',
                    expense_amount: parseFloat(item.expense_amount) || 0,
                    currency: item.currency || 'INR', // Ensure currency is sent
                    payment_mode: item.payment_mode || 'Self',
                    receipt_file_id: item.receipt_file_id || '',
                    expense_folder_id: item.expense_folder_id || ''
                }))
            };

            if (selectedReport && selectedReport.expense_report_id) {
                await expenseReportsApi.update(selectedReport.expense_report_id, payload);
                showToast('Draft updated successfully', 'success', 3000);
            } else {
                const res = await expenseReportsApi.create(payload);
                setSelectedReport({ ...selectedReport, expense_report_id: res.data.expense_report_id, status: 'DRAFT' }); // Update selectedReport with new ID and draft status
                showToast('Draft saved successfully', 'success', 3000);
            }

            await loadData();
            closeModal();
        } catch (error) {
            console.error('Error saving draft:', error);
            showValidationError(error.response?.data?.detail || 'Error saving draft');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAndSubmit = async () => {
        // Validation
        if (!reportForm.expense_report_name || !reportForm.expense_report_name.trim()) {
            showValidationError('Please enter a Report Name');
            return;
        }
        if (!reportForm.associate_id) {
            showValidationError('Associate ID is missing (User profile not fully configured)');
            return;
        }
        if (!reportForm.project_id) {
            showValidationError('Please select a Project');
            return;
        }
        if (!reportForm.items || reportForm.items.length === 0) {
            showValidationError('Please add at least one expense item');
            return;
        }

        // Validate each item and collect all errors
        const errors = {};
        const errorMessages = [];
        for (let i = 0; i < reportForm.items.length; i++) {
            const item = reportForm.items[i];
            const row = i + 1;
            if (!item.date) {
                errors[`${i} -date`] = true;
                errorMessages.push(`Row ${row}: Date`);
            }
            if (!item.category) {
                errors[`${i} -category`] = true;
                errorMessages.push(`Row ${row}: Category`);
            }
            if (!item.bill_no || !item.bill_no.trim()) {
                errors[`${i} -bill_no`] = true;
                errorMessages.push(`Row ${row}: Bill No`);
            }
            if (!item.description || !item.description.trim()) {
                errors[`${i} -description`] = true;
                errorMessages.push(`Row ${row}: Description`);
            }
            if (!item.currency) {
                errors[`${i} -currency`] = true;
                errorMessages.push(`Row ${row}: Currency`);
            }
            if (!item.expense_amount || parseFloat(item.expense_amount) <= 0) {
                errors[`${i} -expense_amount`] = true;
                errorMessages.push(`Row ${row}: Amount`);
            }
            if (!item.receipt_file_id || !item.receipt_file_id.trim()) {
                errors[`${i} -receipt_file_id`] = true;
                errorMessages.push(`Row ${row}: Receipt`);
            }
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            showValidationError(`Missing required fields: ${errorMessages.join(', ')} `);
            return;
        }
        setValidationErrors({});

        setSaving(true);
        try {
            const payload = {
                associate_id: reportForm.associate_id,
                project_id: reportForm.project_id,
                project_name: reportForm.project_name,
                items: reportForm.items.map(item => ({
                    date: item.date,
                    category: item.category,
                    bill_no: item.bill_no,
                    description: item.description,
                    expense_amount: parseFloat(item.expense_amount) || 0,
                    currency: item.currency, // Ensure currency is sent
                    payment_mode: item.payment_mode || 'Self',
                    receipt_file_id: item.receipt_file_id || '',
                    expense_folder_id: item.expense_folder_id || ''
                }))
            };

            let reportId;
            if (selectedReport) {
                await expenseReportsApi.update(selectedReport.expense_report_id, payload);
                reportId = selectedReport.expense_report_id;
            } else {
                const res = await expenseReportsApi.create(payload);
                reportId = res.data.expense_report_id;
            }

            // Submit for approval
            await expenseReportsApi.submit(reportId);

            showToast('Expense report submitted for approval', 'success', 3000);

            await loadData();
            closeModal();
        } catch (error) {
            console.error('Error saving and submitting expense report:', error);
            showValidationError(error.response?.data?.detail || 'Error saving and submitting expense report');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (report) => {
        setConfirmModal({ isOpen: true, type: 'delete', report });
    };

    const handleWithdraw = async (report) => {
        setConfirmModal({ isOpen: true, type: 'withdraw', report });
    };

    const executeConfirmAction = async () => {
        const { type, report } = confirmModal;
        if (!report) return;

        setSaving(true);
        try {
            if (type === 'delete') {
                await expenseReportsApi.delete(report.expense_report_id);
                showToast('Expense report deleted successfully', 'success', 3000);
            } else if (type === 'withdraw') {
                await expenseReportsApi.withdraw(report.expense_report_id);
                showToast('Expense report withdrawn to Draft', 'success', 3000);
            }
            await loadData();
            if (isModalOpen && type === 'withdraw') closeModal();
            setConfirmModal({ isOpen: false, type: '', report: null });
        } catch (error) {
            console.error(`Error ${type === 'delete' ? 'deleting' : 'withdrawing'} report: `, error);
            showValidationError(error.response?.data?.detail || `Error ${type === 'delete' ? 'deleting' : 'withdrawing'} report`);
        } finally {
            setSaving(false);
        }
    };

    const openApproveModal = (report) => {
        setSelectedReport(report);
        setApprovalComment('');
        setIsApproveModalOpen(true);
    };

    const handleApprove = async () => {
        setSaving(true);
        try {
            await expenseReportsApi.approve(selectedReport.expense_report_id, approvalComment);
            setIsApproveModalOpen(false);
            setSelectedReport(null);
            await loadData();
            showToast('Expense report approved successfully', 'success', 3000);
        } catch (error) {
            console.error('Error approving report:', error);
            showValidationError(error.response?.data?.detail || 'Error approving report');
        } finally {
            setSaving(false);
        }
    };

    const openRejectModal = (report) => {
        setSelectedReport(report);
        setApprovalComment('');
        setIsRejectModalOpen(true);
    };

    const handleReject = async () => {
        setSaving(true);
        try {
            await expenseReportsApi.reject(selectedReport.expense_report_id, approvalComment);
            setIsRejectModalOpen(false);
            setSelectedReport(null);
            await loadData();
            showToast('Expense report rejected successfully', 'success', 3000);
        } catch (error) {
            console.error('Error rejecting report:', error);
            showValidationError(error.response?.data?.detail || 'Error rejecting report');
        } finally {
            setSaving(false);
        }
    };

    const handleLogPayment = async () => {
        if (!paymentReportId) {
            showToast('Please select a report to log payment', 'error');
            return;
        }

        setSaving(true);
        try {
            await expenseReportsApi.pay(paymentReportId);
            setIsPaymentModalOpen(false);
            setPaymentReportId('');
            await loadData();
            showToast('Payment logged successfully', 'success', 3000);
        } catch (error) {
            console.error('Error logging payment:', error);
            showValidationError(error.response?.data?.detail || 'Error logging payment');
        } finally {
            setSaving(false);
        }
    };



    const getCategoryChartData = () => {
        if (!summary?.by_category) return [];
        return Object.entries(summary.by_category).map(([name, value]) => ({
            name,
            value
        }));
    };

    // Check if current user is a manager for any project
    const isManager = user?.role === 'Admin' || user?.role === 'Project Manager';

    const columns = [
        {
            key: 'expense_report_id',
            label: 'Report ID',
            render: (value) => <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{value}</span>
        },
        {
            key: 'expense_report_name',
            label: 'Report Name',
            render: (value) => (
                <div style={{
                    fontSize: '0.85rem',
                    lineHeight: '1.2',
                    maxWidth: '180px',
                    wordBreak: 'break-word',
                    whiteSpace: 'normal',
                    fontWeight: '500'
                }}>
                    {value || '-'}
                </div>
            )
        },
        {
            key: 'associate_id',
            label: 'Associate',
            render: (value) => <span style={{ fontSize: '0.85rem' }}>{associateLookup[value] || value || '-'}</span>
        },
        {
            key: 'project_id',
            label: 'Project',
            render: (value, row) => (
                <div style={{ fontSize: '0.85rem', maxWidth: '150px', whiteSpace: 'normal' }}>
                    {row.project_name || projectLookup[value]?.project_name || value || '-'}
                </div>
            )
        },
        {
            key: 'expense_report_date',
            label: 'Report Date',
            render: (_, row) => row.expense_report_date || '-'
        },
        {
            key: 'total_amount',
            label: 'Total',
            render: (value) => {
                const total = value || 0;
                return `₹${total.toLocaleString('en-IN')}`;
            }
        },
        {
            key: 'items',
            label: 'Items',
            render: (items) => items?.length || 0
        },
        {
            key: 'status',
            label: 'Status',
            render: (value) => {
                const style = STATUS_COLORS[value] || STATUS_COLORS.DRAFT;
                return (
                    <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: style.bg,
                        color: style.color
                    }}>
                        {value || 'DRAFT'}
                    </span>
                );
            }
        }
    ];

    // Filter reports based on active tab and search dropdowns
    const filteredReports = reports.filter(report => {
        // Apply Dropdown Filters
        if (filters.status && report.status !== filters.status) return false;
        if (filters.project_id && report.project_id !== filters.project_id) return false;
        if (filters.associate_id && report.associate_id !== filters.associate_id) return false;

        // Apply Date Filters (String-based comparison to avoid timezone issues)
        if (dateFilterMode !== 'all' && report.expense_report_date) {
            const reportDateStr = report.expense_report_date; // YYYY-MM-DD
            const now = new Date();

            if (dateFilterMode === 'thisMonth') {
                const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const firstDayStr = firstDayMonth.toISOString().split('T')[0];
                if (reportDateStr < firstDayStr) return false;
            } else if (dateFilterMode === 'lastMonth') {
                const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0];
                if (reportDateStr < oneMonthAgoStr) return false;
            } else if (dateFilterMode === 'lastYear') {
                const oneYearAgoStr = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];
                if (reportDateStr < oneYearAgoStr) return false;
            } else if (dateFilterMode === 'custom') {
                if (customRange.start && reportDateStr < customRange.start) return false;
                if (customRange.end && reportDateStr > customRange.end) return false;
            }
        }

        if (activeTab === 'all') {
            return user?.role === 'Admin';
        } else if (activeTab === 'my') {
            return report.associate_id === user?.associate_id;
        } else {
            // Team/Approvals tab
            const project = projectLookup[report.project_id];
            // Check if user is manager of this project (comparing string IDs)
            const isProjectManager = project?.project_manager_id == user?.associate_id; // lax comparison for safety

            // Admins see all in Team tab, Managers see their projects
            if (user?.role === 'Admin') return true;
            return isProjectManager;
        }
    });

    // Helper for Admin associate dropdown
    const uniqueAssociates = [...new Set(reports.map(r => r.associate_id))].filter(Boolean);

    const isReadOnly = selectedReport && selectedReport.status !== 'DRAFT' && selectedReport.status !== 'REJECTED';

    if (loading) return <Loading />;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Expense Reports</h1>
                    <p className="page-subtitle">Create and manage expense reports for approval</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {(user?.role === 'Admin' || user?.role === 'Project Manager') && (
                        <button className="btn btn-secondary" onClick={() => { setPaymentReportId(''); setIsPaymentModalOpen(true); }}>
                            <DollarSign size={18} />
                            Log Payment
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={() => openModal()}>
                        <Plus size={18} />
                        New Expense Report
                    </button>
                </div>
            </div>

            {/* Tabs */}
            {(isManager) && (
                <div className="tabs-container">
                    <button
                        className={`tab-btn ${activeTab === 'my' ? 'active' : ''}`}
                        onClick={() => setActiveTab('my')}
                    >
                        <List size={18} className="tab-icon" />
                        My Expenses
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
                        onClick={() => setActiveTab('team')}
                    >
                        <History size={18} className="tab-icon" />
                        Team Approvals
                    </button>
                    {user?.role === 'Admin' && (
                        <button
                            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveTab('all')}
                        >
                            <List size={18} className="tab-icon" />
                            All Expenses
                        </button>
                    )}
                    <button
                        className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                        onClick={() => setActiveTab('summary')}
                    >
                        <PieChart size={18} className="tab-icon" />
                        Monthly Summary
                    </button>
                </div>
            )}

            {/* Summary */}
            {activeTab !== 'summary' && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            marginBottom: showSummary ? '1rem' : '0'
                        }}
                        onClick={() => setShowSummary(!showSummary)}
                    >
                        <h3 style={{ margin: 0, marginRight: '0.5rem', fontSize: '1.25rem', fontWeight: '600' }}>Summary</h3>
                        {showSummary ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>

                    {showSummary && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Total Expenses</h3>
                                </div>
                                <div className="card-body text-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                                    <div style={{ fontSize: '2.5rem', fontWeight: '700', color: 'var(--error-600)' }}>
                                        ₹{((summary?.total_expenses || 0) / 100000).toFixed(2)}L
                                    </div>
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">By Category</h3>
                                </div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={200}>
                                        <PieChart>
                                            <Pie
                                                data={getCategoryChartData()}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={70}
                                            >
                                                {getCategoryChartData().map((entry, index) => (
                                                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} `} />
                                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Monthly Expenses Chart for Managers */}
                            {isManager && summary && summary.monthly_by_project ? (
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title">Monthly Trend</h3>
                                    </div>
                                    <div className="card-body" style={{ height: '232px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={Object.entries(summary.monthly_by_project).map(([month, projects]) => ({
                                                    name: formatMonth(month),
                                                    ...projects
                                                }))}
                                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-200)" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value / 1000} k`} tick={{ fontSize: 10 }} width={35} />
                                                <Tooltip
                                                    formatter={(value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} `}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '11px', padding: '8px' }}
                                                    itemStyle={{ padding: '0px' }}
                                                />
                                                {(() => {
                                                    const allKeys = new Set();
                                                    Object.values(summary.monthly_by_project).forEach(projData => {
                                                        Object.keys(projData).forEach(k => allKeys.add(k));
                                                    });
                                                    return Array.from(allKeys).map((key, index) => (
                                                        <Bar
                                                            key={key}
                                                            dataKey={key}
                                                            stackId="a"
                                                            fill={COLORS[index % COLORS.length]}
                                                            radius={index === allKeys.size - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                                                        />
                                                    ));
                                                })()}
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            ) : (
                                null
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'summary' ? (
                <div className="summary-tab-content">
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                            <h3 className="card-title">Expense Trend by Type</h3>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: '500' }}>Period</label>
                                    <select
                                        className="form-select"
                                        style={{ height: '32px', padding: '0 0.5rem', fontSize: '0.85rem', minWidth: '130px' }}
                                        value={summaryTabFilters.period}
                                        onChange={(e) => setSummaryTabFilters({ period: e.target.value })}
                                    >
                                        <option value="">All Time</option>
                                        <optgroup label="Years">
                                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                                        </optgroup>
                                        <optgroup label="Financial Years">
                                            {fys.map(f => <option key={f} value={f}>{f}</option>)}
                                        </optgroup>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: '500' }}>Project</label>
                                    <select
                                        className="form-select"
                                        style={{ height: '32px', padding: '0 0.5rem', fontSize: '0.85rem' }}
                                        value={filters.project_id}
                                        onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
                                    >
                                        <option value="">All Projects</option>
                                        {projects.map(p => (
                                            <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="card-body" style={{ height: '400px' }}>
                            {isSummaryLoading ? <Loading /> : summaryData && summaryData.monthly_by_category ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={Object.entries(summaryData.monthly_by_category).sort(([a], [b]) => a.localeCompare(b)).map(([month, cats]) => ({
                                            name: formatMonth(month),
                                            ...cats
                                        }))}
                                        margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
                                        barSize={32}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-200)" />
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fontSize: 11, fill: 'var(--gray-600)' }}
                                            axisLine={{ stroke: 'var(--gray-200)' }}
                                            tickLine={false}
                                            dy={10}
                                        />
                                        <YAxis
                                            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                                            tick={{ fontSize: 11, fill: 'var(--gray-600)' }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            formatter={(v) => `₹${v.toLocaleString('en-IN')}`}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)', padding: '10px', fontSize: '11px' }}
                                            itemStyle={{ padding: '2px 0' }}
                                            labelStyle={{ fontWeight: '600', marginBottom: '4px', color: 'var(--gray-800)', fontSize: '12px' }}
                                            cursor={{ fill: 'var(--gray-50)' }}
                                        />
                                        <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} />
                                        {(() => {
                                            const cats = new Set();
                                            Object.values(summaryData.monthly_by_category).forEach(c => Object.keys(c).forEach(k => cats.add(k)));
                                            const catList = Array.from(cats).sort();
                                            return catList.map((cat, idx) => (
                                                <Bar
                                                    key={cat}
                                                    dataKey={cat}
                                                    stackId="a"
                                                    fill={COLORS[idx % COLORS.length]}
                                                    radius={idx === catList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                                />
                                            ));
                                        })()}
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-center p-8 gray-500">No data available for the selected period.</div>
                            )}
                        </div>
                    </div>

                    {!isSummaryLoading && summaryData && summaryData.monthly_by_category && (
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Monthly Breakdown by Category</h3>
                            </div>
                            <div className="card-body" style={{ padding: 0 }}>
                                <div className="table-wrapper" style={{ overflowX: 'auto', borderRadius: '0 0 12px 12px' }}>
                                    <table className="portal-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                                        <thead>
                                            <tr style={{ background: 'linear-gradient(to bottom, #f8fafc, #f1f5f9)' }}>
                                                <th style={{ position: 'sticky', left: 0, zIndex: 10, background: '#f8fafc', padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--gray-700)', fontSize: '0.85rem', borderBottom: '2px solid var(--gray-200)', borderRight: '1px solid var(--gray-100)', minWidth: '180px' }}>Expense Category</th>
                                                {Object.keys(summaryData.monthly_by_category).sort().map(m => (
                                                    <th key={m} style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--gray-700)', fontSize: '0.85rem', borderBottom: '2px solid var(--gray-200)', minWidth: '110px' }}>{formatMonth(m)}</th>
                                                ))}
                                                <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', color: 'var(--primary-700)', fontSize: '0.85rem', borderBottom: '2px solid var(--gray-200)', background: 'rgba(0, 102, 204, 0.05)', minWidth: '120px' }}>Grand Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const monthKeys = Object.keys(summaryData.monthly_by_category).sort();
                                                const cats = new Set();
                                                Object.values(summaryData.monthly_by_category).forEach(c => Object.keys(c).forEach(k => cats.add(k)));
                                                const sortedCats = Array.from(cats).sort();

                                                return sortedCats.map((cat, idx) => {
                                                    const rowTotal = monthKeys.reduce((sum, m) => sum + (summaryData.monthly_by_category[m][cat] || 0), 0);
                                                    return (
                                                        <tr key={cat} className="table-row-hover" style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                                                            <td style={{ position: 'sticky', left: 0, zIndex: 5, background: idx % 2 === 0 ? 'white' : '#fafafa', padding: '1rem', fontWeight: '600', fontSize: '0.85rem', color: 'var(--gray-800)', borderBottom: '1px solid var(--gray-100)', borderRight: '1px solid var(--gray-100)' }}>{cat}</td>
                                                            {monthKeys.map(m => (
                                                                <td key={m} style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--gray-700)', borderBottom: '1px solid var(--gray-100)' }}>
                                                                    <span style={{ opacity: (summaryData.monthly_by_category[m][cat] || 0) > 0 ? 1 : 0.3 }}>
                                                                        ₹{(summaryData.monthly_by_category[m][cat] || 0).toLocaleString('en-IN')}
                                                                    </span>
                                                                </td>
                                                            ))}
                                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', fontSize: '0.85rem', color: 'var(--primary-600)', background: 'rgba(0, 102, 204, 0.02)', borderBottom: '1px solid var(--gray-100)' }}>
                                                                ₹{rowTotal.toLocaleString('en-IN')}
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ backgroundColor: '#f1f5f9', fontWeight: '700' }}>
                                                <td style={{ position: 'sticky', left: 0, zIndex: 10, background: '#f1f5f9', padding: '1.25rem 1rem', fontSize: '0.9rem', color: 'var(--gray-900)', borderTop: '2px solid var(--gray-300)' }}>Monthly Grand Total</td>
                                                {(() => {
                                                    const monthKeys = Object.keys(summaryData.monthly_by_category).sort();
                                                    const cats = new Set();
                                                    Object.values(summaryData.monthly_by_category).forEach(c => Object.keys(c).forEach(k => cats.add(k)));
                                                    const catArray = Array.from(cats);

                                                    let grandTotal = 0;
                                                    const monthTotals = monthKeys.map(m => {
                                                        const mTotal = catArray.reduce((sum, cat) => sum + (summaryData.monthly_by_category[m][cat] || 0), 0);
                                                        grandTotal += mTotal;
                                                        return mTotal;
                                                    });

                                                    return (
                                                        <>
                                                            {monthTotals.map((tot, i) => (
                                                                <td key={i} style={{ padding: '1.25rem 1rem', textAlign: 'right', fontSize: '0.9rem', color: 'var(--gray-900)', borderTop: '2px solid var(--gray-300)' }}>₹{tot.toLocaleString('en-IN')}</td>
                                                            ))}
                                                            <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontSize: '1rem', color: 'var(--primary-700)', borderTop: '2px solid var(--gray-300)', background: 'rgba(0, 102, 204, 0.1)' }}>₹{grandTotal.toLocaleString('en-IN')}</td>
                                                        </>
                                                    );
                                                })()}
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        <DataTable
                            columns={columns}
                            data={filteredReports}
                            searchFields={['expense_report_id', 'project_name']}
                            extraHeaderContent={
                                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: '500', color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>Project</label>
                                        <select
                                            className="form-select"
                                            style={{ minWidth: '150px', height: '36px', padding: '0 0.75rem', fontSize: '0.875rem' }}
                                            value={filters.project_id}
                                            onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
                                        >
                                            <option value="">All Projects</option>
                                            {projects.map(p => (
                                                <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {activeTab === 'all' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: '500', color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>Associate</label>
                                            <select
                                                className="form-select"
                                                style={{ minWidth: '150px', height: '36px', padding: '0 0.75rem', fontSize: '0.875rem' }}
                                                value={filters.associate_id}
                                                onChange={(e) => setFilters({ ...filters, associate_id: e.target.value })}
                                            >
                                                <option value="">All Associates</option>
                                                {uniqueAssociates.map(id => (
                                                    <option key={id} value={id}>{associateLookup[id] || id}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: '500', color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>Status</label>
                                        <select
                                            className="form-select"
                                            style={{ minWidth: '140px', height: '36px', padding: '0 0.75rem', fontSize: '0.875rem' }}
                                            value={filters.status}
                                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                        >
                                            <option value="">All Statuses</option>
                                            <option value="DRAFT">Draft</option>
                                            <option value="SUBMITTED">Submitted</option>
                                            <option value="APPROVED">Approved</option>
                                            <option value="REJECTED">Rejected</option>
                                            <option value="PAID">Paid</option>
                                        </select>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: '500', color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>Date Period</label>
                                        <select
                                            className="form-select"
                                            style={{ minWidth: '130px', height: '36px', padding: '0 0.75rem', fontSize: '0.875rem' }}
                                            value={dateFilterMode}
                                            onChange={(e) => setDateFilterMode(e.target.value)}
                                        >
                                            <option value="all">All Time</option>
                                            <option value="thisMonth">This Month</option>
                                            <option value="lastMonth">Last 1 Month</option>
                                            <option value="lastYear">Last 1 Year</option>
                                            <option value="custom">Custom Range</option>
                                        </select>

                                        {dateFilterMode === 'custom' && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <input
                                                    type="date"
                                                    className="form-input"
                                                    style={{ padding: '0 0.5rem', fontSize: '0.8rem', border: '1px solid var(--gray-300)', borderRadius: '4px', height: '36px' }}
                                                    value={customRange.start}
                                                    onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                                                />
                                                <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', padding: '0 2px' }}>to</span>
                                                <input
                                                    type="date"
                                                    className="form-input"
                                                    style={{ padding: '0 0.5rem', fontSize: '0.8rem', border: '1px solid var(--gray-300)', borderRadius: '4px', height: '36px' }}
                                                    value={customRange.end}
                                                    onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            }
                            actions={(row) => (
                                <>
                                    {/* My Expenses Actions */}
                                    {activeTab === 'my' && (
                                        <>
                                            {(row.status === 'DRAFT' || row.status === 'REJECTED') ? (
                                                <>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => openModal(row)} title="Edit">
                                                        <Edit2 size={14} />
                                                    </button>

                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(row)} title="Delete">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => openModal(row)} title="View">
                                                        <Eye size={14} />
                                                    </button>
                                                    {row.status === 'SUBMITTED' && (
                                                        <>
                                                            <button className="btn btn-warning btn-sm" onClick={() => handleWithdraw(row)} title="Withdraw" style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none' }}>
                                                                <Undo2 size={14} />
                                                            </button>
                                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(row)} title="Delete">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    )}

                                    {/* Team Approvals Actions */}
                                    {activeTab === 'team' && (
                                        <>
                                            {row.status === 'SUBMITTED' ? (
                                                <>
                                                    <button className="btn btn-success btn-sm" onClick={() => openApproveModal(row)} title="Approve">
                                                        <Check size={14} />
                                                    </button>
                                                    <button className="btn btn-danger btn-sm" onClick={() => openRejectModal(row)} title="Reject">
                                                        <X size={14} />
                                                    </button>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => openModal(row)} title="View Detail">
                                                        <Eye size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button className="btn btn-secondary btn-sm" onClick={() => openModal(row)} title="View">
                                                    <Eye size={14} />
                                                </button>
                                            )}
                                        </>
                                    )}

                                    {/* All Expenses Actions */}
                                    {activeTab === 'all' && (
                                        <>
                                            <button className="btn btn-secondary btn-sm" onClick={() => openModal(row)} title="View Detail">
                                                <Eye size={14} />
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        />
                    </div>
                </div>
            )}

            {/* Create/Edit Expense Report Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={selectedReport ? (isReadOnly ? 'View Expense Report' : 'Edit Expense Report') : 'New Expense Report'}
                size="xl"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={closeModal}>
                            {(!selectedReport || selectedReport.status === 'DRAFT' || selectedReport.status === 'REJECTED') ? 'Cancel' : 'Close'}
                        </button>
                        {(!selectedReport || selectedReport.status === 'DRAFT' || selectedReport.status === 'REJECTED') && (
                            <>
                                <button className="btn btn-primary" onClick={handleSaveDraft} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save as Draft'}
                                </button>
                                <button className="btn btn-success" onClick={handleSaveAndSubmit} disabled={saving}>
                                    {saving ? 'Saving...' : 'Submit'}
                                </button>
                            </>
                        )}
                        {/* Manager Actions in View Mode */}
                        {isManager && selectedReport?.status === 'SUBMITTED' && (
                            <>
                                <button className="btn btn-success" onClick={() => { closeModal(); openApproveModal(selectedReport); }}>
                                    Approve
                                </button>
                                <button className="btn btn-danger" onClick={() => { closeModal(); openRejectModal(selectedReport); }}>
                                    Reject
                                </button>
                            </>
                        )}
                        {/* Submitter Actions in View Mode */}
                        {!isManager && selectedReport?.status === 'SUBMITTED' && selectedReport?.associate_id === user?.associate_id && (
                            <button className="btn btn-warning" onClick={() => handleWithdraw(selectedReport)} disabled={saving} style={{ marginLeft: 'auto', backgroundColor: '#f59e0b', color: 'white', border: 'none' }}>
                                {saving ? 'Withdrawing...' : 'Withdraw'}
                            </button>
                        )}
                    </>
                }
            >
                <form>
                    {/* Header Section */}
                    {/* Header Section */}
                    {selectedReport?.comments && (
                        <div style={{ marginBottom: '1.5rem', padding: '1.25rem', backgroundColor: '#fff', borderRadius: '0.75rem', border: '1px solid var(--gray-200)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            <h4 style={{ marginBottom: '1rem', fontWeight: '600', color: 'var(--gray-800)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>Start History & Comments</span>
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {selectedReport.comments.split('\n').filter(line => line.trim()).map((line, i) => {
                                    // Parse: <dd-mmm-yyyy hh:MM:ss> <user> <Action> <comments>
                                    // Being flexible with spaces
                                    const match = line.match(/^(\d{2}-[A-Za-z]{3}-\d{4}\s\d{2}:\d{2}:\d{2})\s+(.*?)\s+(Submitted|Approved|Rejected)\s*(.*)$/);

                                    if (match) {
                                        const [_, timestamp, name, action, message] = match;
                                        // Solid colors for clearer status
                                        let actionStyle = { bg: 'var(--primary-600)', color: '#fff', border: 'var(--primary-700)' };
                                        if (action === 'Rejected') actionStyle = { bg: 'var(--error-600)', color: '#fff', border: 'var(--error-700)' };
                                        if (action === 'Approved') actionStyle = { bg: 'var(--success-600)', color: '#fff', border: 'var(--success-700)' };

                                        return (
                                            <div key={i} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'baseline', paddingBottom: '0.75rem', borderBottom: '1px solid var(--gray-100)', last: { borderBottom: 'none' } }}>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', minWidth: '120px', fontFamily: 'monospace', flexShrink: 0 }}>
                                                    {timestamp}
                                                </div>
                                                <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        padding: '1px 8px',
                                                        backgroundColor: 'var(--gray-100)',
                                                        borderRadius: '9999px',
                                                        fontWeight: '600',
                                                        fontSize: '0.7rem',
                                                        color: 'var(--gray-700)',
                                                        border: '1px solid var(--gray-200)'
                                                    }}>
                                                        {name}
                                                    </span>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        padding: '1px 8px',
                                                        backgroundColor: actionStyle.bg,
                                                        color: actionStyle.color,
                                                        borderRadius: '9999px',
                                                        fontWeight: '600',
                                                        fontSize: '0.7rem',
                                                        border: `1px solid ${actionStyle.border} `,
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                                    }}>
                                                        {action}
                                                    </span>
                                                    {message && (
                                                        <span style={{ color: 'var(--gray-600)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                                                            {message}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }
                                    // Fallback for plain text
                                    return (
                                        <div key={i} style={{ padding: '0.75rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--gray-700)' }}>
                                            {line}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem' }}>
                        <h4 style={{ marginBottom: '1rem', fontWeight: '600' }}>Report Details</h4>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Report Date *</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={reportForm.expense_report_date || ''}
                                    onChange={(e) => setReportForm({ ...reportForm, expense_report_date: e.target.value })}
                                    disabled={isReadOnly}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Report Name *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter report name"
                                    value={reportForm.expense_report_name || ''}
                                    onChange={(e) => setReportForm({ ...reportForm, expense_report_name: e.target.value })}
                                    disabled={isReadOnly}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Project *</label>
                                <select
                                    className="form-select"
                                    value={reportForm.project_id}
                                    onChange={(e) => handleProjectChange(e.target.value)}
                                    required
                                    disabled={isReadOnly}
                                >
                                    <option value="">Select Project</option>
                                    {projects.filter(p => allocatedProjectIds.includes(String(p.project_id).trim())).map(p => (
                                        <option key={p.project_id} value={p.project_id}>
                                            {p.project_id} - {p.project_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Expense Items Table */}
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h4 style={{ fontWeight: '600', margin: 0 }}>Expense Items</h4>
                            {!isReadOnly && (
                                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
                                    <Plus size={14} /> Add Item
                                </button>
                            )}
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--gray-100)' }}>
                                        <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Date</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Category</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Bill No</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Description</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Currency</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>Amount</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Payment Mode</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Receipt</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600', width: '50px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportForm.items.map((item, index) => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                                            <td style={{ padding: '0.5rem' }}>
                                                <input
                                                    type="date"
                                                    className="form-input"
                                                    style={{ padding: '0.375rem', fontSize: '0.875rem' }}
                                                    value={item.date}
                                                    onChange={(e) => updateItem(index, 'date', e.target.value)}
                                                    disabled={isReadOnly}
                                                />
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <select
                                                    className="form-select"
                                                    style={{ padding: '0.375rem', fontSize: '0.875rem', minWidth: '120px', ...errorStyle(index, 'category') }}
                                                    value={item.category}
                                                    onChange={(e) => { updateItem(index, 'category', e.target.value); setValidationErrors(prev => { const n = { ...prev }; delete n[`${index} -category`]; return n; }); }}
                                                    disabled={isReadOnly}
                                                >
                                                    <option value="">Select</option>
                                                    {EXPENSE_CATEGORIES.map(c => (
                                                        <option key={c} value={c}>{c}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <input
                                                    className="form-input"
                                                    style={{ padding: '0.375rem', fontSize: '0.875rem', width: '80px', ...errorStyle(index, 'bill_no') }}
                                                    value={item.bill_no}
                                                    onChange={(e) => { updateItem(index, 'bill_no', e.target.value); setValidationErrors(prev => { const n = { ...prev }; delete n[`${index} -bill_no`]; return n; }); }}
                                                    disabled={isReadOnly}
                                                />
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <input
                                                    className="form-input"
                                                    style={{ padding: '0.375rem', fontSize: '0.875rem', minWidth: '150px', ...errorStyle(index, 'description') }}
                                                    value={item.description}
                                                    onChange={(e) => { updateItem(index, 'description', e.target.value); setValidationErrors(prev => { const n = { ...prev }; delete n[`${index} -description`]; return n; }); }}
                                                    disabled={isReadOnly}
                                                />
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <select
                                                    className="form-select"
                                                    style={{ padding: '0.375rem', fontSize: '0.875rem', width: '80px', ...errorStyle(index, 'currency') }}
                                                    value={item.currency || 'INR'}
                                                    onChange={(e) => { updateItem(index, 'currency', e.target.value); setValidationErrors(prev => { const n = { ...prev }; delete n[`${index} -currency`]; return n; }); }}
                                                    disabled={isReadOnly}
                                                >
                                                    {currencies.map(c => (
                                                        <option key={c} value={c}>{c}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    style={{ padding: '0.375rem', fontSize: '0.875rem', width: '100px', textAlign: 'right', ...errorStyle(index, 'expense_amount') }}
                                                    value={item.expense_amount}
                                                    onChange={(e) => { updateItem(index, 'expense_amount', e.target.value); setValidationErrors(prev => { const n = { ...prev }; delete n[`${index} -expense_amount`]; return n; }); }}
                                                    disabled={isReadOnly}
                                                />
                                                {item.currency && item.currency !== 'INR' && item.expense_amount > 0 && (
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', textAlign: 'right', marginTop: '2px' }}>
                                                        ₹{getINRAmount(item.expense_amount, item.currency, item.date).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <select
                                                    className="form-select"
                                                    style={{ padding: '0.375rem', fontSize: '0.875rem', width: '130px', ...errorStyle(index, 'payment_mode') }}
                                                    value={item.payment_mode || 'Self'}
                                                    onChange={(e) => { updateItem(index, 'payment_mode', e.target.value); setValidationErrors(prev => { const n = { ...prev }; delete n[`${index} -payment_mode`]; return n; }); }}
                                                    disabled={isReadOnly}
                                                >
                                                    <option value="Self">Self</option>
                                                    {(() => {
                                                        const assoc = associates.find(a => a.associate_id === reportForm.associate_id);
                                                        const cardNum = assoc?.corporate_card_number;
                                                        if (cardNum && cardNum.length >= 4) {
                                                            const last4 = cardNum.slice(-4);
                                                            return <option value="Corporate Card">Corporate Card ending {last4}</option>;
                                                        } else if (cardNum) {
                                                            return <option value="Corporate Card">Corporate Card</option>;
                                                        }
                                                        return null;
                                                    })()}
                                                    {user?.role === 'Admin' && (
                                                        <option value="Bank Transfer">Bank Transfer</option>
                                                    )}
                                                </select>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={{ borderRadius: '6px', ...(hasError(index, 'receipt_file_id') ? { border: '1.5px solid #ef4444', boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)', animation: 'glow-red 1.5s ease-in-out infinite alternate', padding: '4px' } : {}) }}>
                                                    {item.receipt_file_id ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <a href={`https://drive.google.com/file/d/${item.receipt_file_id}/view`} target="_blank" rel="noopener noreferrer"
                                                                style={{ color: 'var(--primary-600)', fontSize: '0.8rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                <ExternalLink size={12} /> View
                                                            </a >
                                                            {!isReadOnly && (
                                                                <button type="button" className="btn btn-secondary btn-sm"
                                                                    style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                                                    onClick={() => { updateItem(index, 'receipt_file_id', ''); updateItem(index, 'expense_folder_id', ''); }}>
                                                                    <X size={10} />
                                                                </button>
                                                            )}
                                                        </div >
                                                    ) : (
                                                        !isReadOnly && (
                                                            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--gray-500)', fontSize: '0.8rem' }}>
                                                                {uploadingReceipt[index] ? (
                                                                    <><Loader size={14} className="spin" /> Uploading...</>
                                                                ) : (
                                                                    <><Upload size={14} /> Upload</>
                                                                )}
                                                                <input
                                                                    type="file"
                                                                    accept="image/*,.pdf,.doc,.docx"
                                                                    style={{ display: 'none' }}
                                                                    onChange={(e) => { handleReceiptUpload(index, e.target.files[0]); setValidationErrors(prev => { const n = { ...prev }; delete n[`${index}-receipt_file_id`]; return n; }); }}
                                                                    disabled={uploadingReceipt[index]}
                                                                />
                                                            </label>
                                                        )
                                                    )}
                                                </div >
                                            </td >
                                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                {reportForm.items.length > 1 && !isReadOnly && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-danger btn-sm"
                                                        style={{ padding: '0.25rem 0.5rem' }}
                                                        onClick={() => removeItem(index)}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr >
                                    ))}
                                </tbody >
                                <tfoot>
                                    <tr style={{ backgroundColor: 'var(--gray-50)' }}>
                                        <td colSpan="5" style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', paddingRight: '1rem' }}>
                                            Total (INR):
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', fontSize: '1rem', color: 'var(--primary-600)', width: '100px', verticalAlign: 'top' }}>
                                            ₹{calculateTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td></td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table >
                        </div >
                    </div >
                </form >
            </Modal >

            {/* Approve Modal */}
            < Modal
                isOpen={isApproveModalOpen}
                onClose={() => setIsApproveModalOpen(false)}
                title="Approve Expense Report"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsApproveModalOpen(false)} disabled={saving}>Cancel</button>
                        <button className="btn btn-success" onClick={handleApprove} disabled={saving}>
                            {saving ? <><Loader size={16} className="spin" style={{ marginRight: '8px' }} /> Approving...</> : 'Approve'}
                        </button>
                    </>
                }
            >
                {selectedReport && (
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid var(--gray-200)' }}>
                        <div style={{ fontWeight: '600', color: 'var(--gray-900)' }}>{selectedReport.expense_report_id}</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--gray-600)', marginTop: '0.25rem' }}>
                            Amount: ₹{(selectedReport.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <br />
                            Project: {selectedReport.project_name || selectedReport.project_id}
                        </div>
                    </div>
                )}
                <div className="form-group">
                    <label className="form-label">Comments (Optional)</label>
                    <textarea
                        className="form-textarea"
                        rows={3}
                        value={approvalComment}
                        onChange={(e) => setApprovalComment(e.target.value)}
                        placeholder="Add comments..."
                    />
                </div>
            </Modal >

            {/* Reject Reason Modal */}
            < Modal
                isOpen={isRejectModalOpen}
                onClose={() => setIsRejectModalOpen(false)}
                title="Reject Expense Report"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsRejectModalOpen(false)} disabled={saving}>Cancel</button>
                        <button className="btn btn-danger" onClick={handleReject} disabled={saving}>
                            {saving ? <><Loader size={16} className="spin" style={{ marginRight: '8px' }} /> Rejecting...</> : 'Reject'}
                        </button>
                    </>
                }
            >
                {selectedReport && (
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid var(--gray-200)' }}>
                        <div style={{ fontWeight: '600', color: 'var(--gray-900)' }}>{selectedReport.expense_report_id}</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--gray-600)', marginTop: '0.25rem' }}>
                            Amount: ₹{(selectedReport.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <br />
                            Project: {selectedReport.project_name || selectedReport.project_id}
                        </div>
                    </div>
                )}
                <div className="form-group">
                    <label className="form-label">Reason for Rejection / Comments</label>
                    <textarea
                        className="form-textarea"
                        rows={3}
                        value={approvalComment}
                        onChange={(e) => setApprovalComment(e.target.value)}
                        placeholder="Please provide a reason for rejection..."
                    />
                </div>
            </Modal >

            {/* Action Confirmation Modal (Delete / Withdraw) */}
            {/* Payment Modal */}
            <Modal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                title="Log Payment"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)} disabled={saving}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleLogPayment} disabled={saving || !paymentReportId}>
                            {saving ? <><Loader size={16} className="spin" style={{ marginRight: '8px' }} /> Processing...</> : 'Confirm Payment'}
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label className="form-label">Select Approved Expense Report</label>
                    <select
                        className="form-select"
                        value={paymentReportId}
                        onChange={(e) => setPaymentReportId(e.target.value)}
                    >
                        <option value="">-- Choose an approved report --</option>
                        {reports.filter(r => r.status === 'APPROVED').map(r => (
                            <option key={r.expense_report_id} value={r.expense_report_id}>
                                {r.expense_report_id} - {associateLookup[r.associate_id] || r.associate_id} - ₹{(r.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </option>
                        ))}
                    </select>
                </div>

                {paymentReportId && (() => {
                    const report = reports.find(r => r.expense_report_id === paymentReportId);
                    if (!report) return null;
                    return (
                        <div style={{ marginTop: '1.5rem', padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: 'var(--gray-900)' }}>Payment Split Summary</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>Project:</span>
                                    <span style={{ fontWeight: '600', color: 'var(--gray-900)' }}>{report.project_name || report.project_id}</span>
                                </div>
                                <div style={{ height: '1px', backgroundColor: '#e2e8f0' }}></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>To Associate (Self/Reimbursement):</span>
                                    <span style={{ fontWeight: '700', color: 'var(--primary-600)' }}>₹{(report.self_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>To Corporate Card:</span>
                                    <span style={{ fontWeight: '600', color: 'var(--gray-700)' }}>₹{(report.corporate_card_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                {report.bank_transfer_amount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>Bank Transfer (Pre-paid):</span>
                                        <span style={{ fontWeight: '600', color: 'var(--gray-700)' }}>₹{(report.bank_transfer_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <div style={{ height: '1px', backgroundColor: '#e2e8f0' }}></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--gray-900)', fontWeight: '600' }}>Total Amount:</span>
                                    <span style={{ fontSize: '1.125rem', fontWeight: '800', color: 'var(--gray-900)' }}>₹{(report.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--gray-500)', fontStyle: 'italic' }}>
                    Note: Marking this report as paid will change its status to PAID and notify the associate.
                </p>
            </Modal>

            < Modal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ isOpen: false, type: '', report: null })}
                title={confirmModal.type === 'delete' ? 'Delete Expense Report' : 'Withdraw Expense Report'}
                size="md"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setConfirmModal({ isOpen: false, type: '', report: null })} disabled={saving}>
                            Cancel
                        </button>
                        <button
                            className={`btn ${confirmModal.type === 'delete' ? 'btn-danger' : 'btn-warning'}`}
                            onClick={executeConfirmAction}
                            disabled={saving}
                            style={confirmModal.type === 'withdraw' ? { backgroundColor: '#f59e0b', color: 'white', border: 'none' } : {}}
                        >
                            {saving ? 'Processing...' : (confirmModal.type === 'delete' ? 'Yes, Delete' : 'Yes, Withdraw')}
                        </button>
                    </>
                }
            >
                <div style={{ padding: '0.5rem 0' }}>
                    <p style={{ fontSize: '1rem', color: 'var(--gray-700)', marginBottom: '0.5rem' }}>
                        {confirmModal.type === 'delete'
                            ? 'Are you sure you want to permanently delete this expense report?'
                            : 'Are you sure you want to withdraw this expense report? It will be moved back to Draft status.'}
                    </p>
                    {confirmModal.report && (
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem', marginTop: '1rem', border: '1px solid var(--gray-200)' }}>
                            <div style={{ fontWeight: '600', color: 'var(--gray-900)' }}>{confirmModal.report.expense_report_id}</div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--gray-600)', marginTop: '0.25rem' }}>
                                Amount: ₹{((confirmModal.report.total_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <br />
                                Project: {confirmModal.report.project_name || confirmModal.report.project_id}
                            </div>
                        </div>
                    )}
                </div>
            </Modal >


            <style>{`
            @keyframes glow-red {
                from { box-shadow: 0 0 4px rgba(239, 68, 68, 0.3); }
                to { box-shadow: 0 0 12px rgba(239, 68, 68, 0.6); }
            }
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
            `}</style>
        </div >
    );
}

export default Expenses;
