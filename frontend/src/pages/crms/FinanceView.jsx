import React, { useState, useEffect, useMemo, useRef } from 'react';
import { crmDashboardApi } from '../../services/crms_api';
import { currencyApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import {
    DollarSign, AlertCircle, FileText, CheckCircle,
    TrendingUp, RefreshCw, Download, Printer, List
} from 'lucide-react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import StatCard from '../../components/common/StatCard';
import Modal from '../../components/common/Modal';
import InvoiceEditor from './InvoiceEditor';
import {
    ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine, Area
} from 'recharts';

const formatCurrency = (value, currency = 'USD') => {
    if (value === null || value === undefined) return '-';

    const isNegative = value < 0;
    const absValue = Math.abs(value);

    // Use en-IN for Indian-style comma separation when INR is selected
    const locale = currency === 'INR' ? 'en-IN' : 'en-US';

    const amount = new Intl.NumberFormat(locale, {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(absValue);

    const symbols = {
        'USD': '$',
        'SGD': 'S$',
        'INR': '₹',
        'EUR': '€',
        'GBP': '£',
        'AUD': 'A$',
        'CAD': 'C$'
    };

    const symbol = symbols[currency] || currency;

    // Symbol outside parentheses for negative: Symbol (Amount)
    return isNegative ? `${symbol} (${amount})` : `${symbol} ${amount}`;
};

const getFinancialYear = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const month = date.getMonth(); // 0 is Jan, 3 is Apr
    const year = date.getFullYear();
    if (month >= 3) { // Apr to Dec
        return `FY${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
    } else { // Jan to Mar
        return `FY${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
    }
};

const ShimmerLoader = ({ type = 'table', rows = 5 }) => {
    if (type === 'table') {
        return (
            <div className="shimmer-wrapper">
                <div className="shimmer-header"></div>
                {[...Array(rows)].map((_, i) => (
                    <div key={i} className="shimmer-row"></div>
                ))}
            </div>
        );
    }
    if (type === 'stats') {
        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', width: '100%' }}>
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="shimmer-card" style={{ height: '120px', borderRadius: '16px', background: '#f8fafc', overflow: 'hidden', position: 'relative' }}>
                        <div className="shimmer-line" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}></div>
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div className="shimmer-wrapper">
            <div className="shimmer-chart"></div>
        </div>
    );
};

const FinanceView = () => {
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All'); // All, Active, Completed
    const [fyFilter, setFyFilter] = useState('All'); // e.g. 'FY25-26'
    const [currencyRates, setCurrencyRates] = useState([]);

    // Profitability States
    const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' or 'profitability'
    const [profitabilityData, setProfitabilityData] = useState([]);
    const [profitGrouping, setProfitGrouping] = useState('Project'); // 'Project' or 'Customer'

    const [profitCurrency, setProfitCurrency] = useState('INR');
    const [loadingProfit, setLoadingProfit] = useState(false);

    // Cash Flow States
    const [cashflowData, setCashflowData] = useState([]);
    const [loadingCashflow, setLoadingCashflow] = useState(false);

    const [sortBy, setSortBy] = useState('start_date');
    const [sortDesc, setSortDesc] = useState(true);
    const { showToast } = useToast();

    const containerRef = useRef(null);
    const timelineScrollRef = useRef(null);
    const invoiceEditorRef = useRef(null);

    const [showInvoicePreview, setShowInvoicePreview] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [bsPage, setBsPage] = useState(1);
    const bsPageSize = 12; // One year per page

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [overviewRes, ratesRes] = await Promise.all([
                crmDashboardApi.getFinanceOverview(),
                currencyApi.getAll().catch(e => null)
            ]);

            if (overviewRes.data && overviewRes.data.deals) {
                setDeals(overviewRes.data.deals);
            }
            if (ratesRes && ratesRes.data) {
                setCurrencyRates(Array.isArray(ratesRes.data) ? ratesRes.data : [ratesRes.data]);
            }
        } catch (error) {
            console.error('Failed to load finance data:', error);
            showToast('Failed to load finance data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'profitability') {
            loadProfitabilityData(profitCurrency, fyFilter);
        } else if (activeTab === 'cashflow' || activeTab === 'balancesheet') {
            loadCashflowData(profitCurrency, fyFilter);
        }
    }, [activeTab, profitCurrency, fyFilter]);

    const loadProfitabilityData = async (currency, year = 'All') => {
        setLoadingProfit(true);
        try {
            const profitRes = await crmDashboardApi.getProfitability({ currency, year }).catch(e => ({ data: { profitability: [] } }));
            if (profitRes.data && profitRes.data.profitability) {
                setProfitabilityData(profitRes.data.profitability);
            }
        } catch (error) {
            console.error('Failed to load profitability data:', error);
            showToast('Failed to load profitability data', 'error');
        } finally {
            setLoadingProfit(false);
        }
    };

    const loadCashflowData = async (currency, year = 'All') => {
        setLoadingCashflow(true);
        try {
            const cashflowRes = await crmDashboardApi.getCashflow({ currency, year }).catch(e => ({ data: { cashflow: [] } }));
            if (cashflowRes.data && cashflowRes.data.cashflow) {
                setCashflowData(cashflowRes.data.cashflow);
            }
        } catch (error) {
            console.error('Failed to load cash flow data:', error);
            showToast('Failed to load cash flow data', 'error');
        } finally {
            setLoadingCashflow(false);
        }
    };

    // 1. Process and Filter Deals
    const processedDeals = useMemo(() => {
        // Helper to check if a date string falls within the selected FY filter
        const isDateInFY = (dateStr) => {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return false;

            if (fyFilter !== 'All') {
                if (fyFilter.startsWith('FY')) {
                    // e.g., 'FY24-25'
                    const startYY = parseInt(fyFilter.substring(2, 4), 10);
                    const endYY = parseInt(fyFilter.substring(5, 7), 10);
                    const startYear = 2000 + startYY;
                    const endYear = 2000 + endYY;
                    const minD = new Date(`${startYear}-04-01`);
                    const maxD = new Date(`${endYear}-03-31T23:59:59`);
                    if (d < minD || d > maxD) return false;
                } else {
                    // e.g., '2024'
                    const yrStr = d.getFullYear().toString();
                    if (yrStr !== fyFilter) return false;
                }
            } else {
                // If All, per requirements timeline starts from 2024
                const minD = new Date(`2024-01-01`);
                if (d < minD) return false;
            }
            return true;
        };

        return deals.map(deal => {
            let totalInvoiced = 0;
            let totalPaid = 0;
            let totalSent = 0;
            let totalOverdue = 0;

            const today = new Date().toISOString().split('T')[0];

            deal.invoices.forEach(inv => {
                const status = inv.status?.toLowerCase().trim() || 'draft';
                const amount = parseFloat(String(inv.total_amount).replace(/[^0-9.-]+/g, '')) || 0;
                // Always clean the amount so downstream helpers get numeric
                inv.total_amount = amount;

                if (status === 'cancelled') return;

                // Do not aggregate amounts for invoices outside the visual timeline bounds
                if (!isDateInFY(inv.issue_date)) return;

                totalInvoiced += amount;

                if (status === 'paid') {
                    totalPaid += amount;
                } else if (status === 'sent' || status === 'overdue') {
                    if (status === 'overdue' || (inv.due_date && inv.due_date < today)) {
                        totalOverdue += amount;
                    } else {
                        totalSent += amount;
                    }
                }
            });

            const dealValue = parseFloat(String(deal.value).replace(/[^0-9.-]+/g, '')) || 0;
            const progress = dealValue > 0 ? (totalPaid / dealValue) * 100 : 0;

            return {
                ...deal,
                value: dealValue,
                totalInvoiced,
                totalPaid,
                totalSent,
                totalOverdue,
                pipelineValue: Math.max(0, dealValue - totalInvoiced),
                progress,
                // Active = end_date is within 60 days of today (ongoing or recently ended)
                // Completed = end_date is more than 60 days in the past
                isActive: (() => {
                    if (!deal.end_date) return true; // No end date = still active
                    const endDate = new Date(deal.end_date);
                    const cutoff = new Date();
                    cutoff.setDate(cutoff.getDate() - 60);
                    return endDate >= cutoff;
                })(),
                isCompleted: (() => {
                    if (!deal.end_date) return false;
                    const endDate = new Date(deal.end_date);
                    const cutoff = new Date();
                    cutoff.setDate(cutoff.getDate() - 60);
                    return endDate < cutoff;
                })()
            };
        }).filter(deal => {
            if (filter === 'Active' && !deal.isActive) return false;
            if (filter === 'Completed' && !deal.isCompleted) return false;

            if (fyFilter !== 'All') {
                let fyStart, fyEnd;
                if (fyFilter.startsWith('FY')) {
                    const startYY = parseInt(fyFilter.substring(2, 4), 10);
                    const endYY = parseInt(fyFilter.substring(5, 7), 10);
                    fyStart = new Date(`${2000 + startYY}-04-01`);
                    fyEnd = new Date(`${2000 + endYY}-03-31T23:59:59`);
                } else {
                    fyStart = new Date(`${fyFilter}-01-01`);
                    fyEnd = new Date(`${fyFilter}-12-31T23:59:59`);
                }

                const dStart = deal.start_date ? new Date(deal.start_date) : new Date('2000-01-01');
                const dEnd = deal.end_date ? new Date(deal.end_date) : new Date('9999-12-31');

                // Standard interval overlap: (StartA <= EndB) and (EndA >= StartB)
                const isOverlapping = (dStart <= fyEnd) && (dEnd >= fyStart);

                const hasInvoiceInFY = deal.invoices.some(inv => {
                    if (!inv.issue_date) return false;
                    const idate = new Date(inv.issue_date);
                    return !isNaN(idate.getTime()) && idate >= fyStart && idate <= fyEnd;
                });

                if (!isOverlapping && !hasInvoiceInFY) return false;
            }
            return true;
        }).sort((a, b) => {
            let valA, valB;
            switch (sortBy) {
                case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
                case 'value': valA = a.value; valB = b.value; break;
                case 'progress': valA = a.progress; valB = b.progress; break;
                default:
                    valA = a.start_date || '9999-12-31';
                    valB = b.start_date || '9999-12-31';
                    break;
            }
            if (valA < valB) return sortDesc ? 1 : -1;
            if (valA > valB) return sortDesc ? -1 : 1;
            return 0;
        });
    }, [deals, filter, fyFilter, sortBy, sortDesc]);

    // Currency conversion helper
    const convertAmount = useMemo(() => {
        // Build a lookup: { 'YYYY-MonthName': { SGD: rate, INR: rate, USD: 1 } }
        const rateMap = {};
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        let latestRates = { USD: 1 };

        if (Array.isArray(currencyRates)) {
            currencyRates.forEach(r => {
                const key = `${r.year}-${r.month}`;
                const rates = { USD: 1 };
                if (r.rates) {
                    Object.entries(r.rates).forEach(([curr, val]) => {
                        rates[curr.toUpperCase()] = parseFloat(val) || 1;
                    });
                }
                rateMap[key] = rates;
                latestRates = rates; // keep the last one as fallback
            });
        }

        return (amount, fromCurrency, toCurrency, dateStr) => {
            if (!amount || fromCurrency === toCurrency) return amount;
            const from = (fromCurrency || 'USD').trim().toUpperCase();
            const to = (toCurrency || 'USD').trim().toUpperCase();
            if (from === to) return amount;

            // Try to find period-specific rate
            let rates = latestRates;
            if (dateStr) {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                    const mName = monthNames[d.getMonth()];
                    const periodKey = `${d.getFullYear()}-${mName}`;
                    if (rateMap[periodKey]) rates = rateMap[periodKey];
                }
            }

            // Convert: fromCurrency -> USD -> toCurrency
            const fromRate = rates[from] || 1; // How many units of 'from' per 1 USD
            const toRate = rates[to] || 1;     // How many units of 'to' per 1 USD
            const usdAmount = amount / fromRate;
            return usdAmount * toRate;
        };
    }, [currencyRates]);

    // KPI totals with currency conversion
    const kpis = useMemo(() => {
        if (activeTab === 'profitability') {
            let totalIncome = 0, totalSalary = 0, totalOther = 0;
            profitabilityData.forEach(p => {
                totalIncome += p.income || 0;
                totalSalary += p.salary_expense || 0;
                totalOther += p.other_expense || 0;
            });
            const netProfit = totalIncome - totalSalary - totalOther;
            return { totalIncome, totalSalary, totalOther, netProfit };
        } else if (activeTab === 'cashflow') {
            let currentBalance = 0;
            let projectedIn = 0;
            let projectedOut = 0;

            if (cashflowData && cashflowData.length > 0) {
                // Find current month index to get current balance
                const now = new Date();
                const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                const currentIndex = cashflowData.findIndex(d => d.month_key === currentMonthKey);
                if (currentIndex >= 0) {
                    currentBalance = cashflowData[currentIndex].cumulative_cash;

                    // Sum next 3 months projections
                    const lookahead = Math.min(currentIndex + 4, cashflowData.length);
                    for (let i = currentIndex + 1; i < lookahead; i++) {
                        projectedIn += cashflowData[i].projected_in || 0;
                        projectedOut += cashflowData[i].projected_out || 0;
                    }
                } else if (cashflowData.length > 0) {
                    // Fallback to last data point if current month not found
                    currentBalance = cashflowData[cashflowData.length - 1].cumulative_cash;
                }
            }
            return { currentBalance, projectedIn, projectedOut };
        }

        // Timeline KPIs
        let totalValue = 0, totalPaid = 0, totalSent = 0, totalOverdue = 0, totalPipeline = 0;
        processedDeals.forEach(deal => {
            const dealCurr = (deal.currency || 'USD').trim().toUpperCase();
            totalValue += convertAmount(deal.value, dealCurr, 'USD');
            totalPaid += convertAmount(deal.totalPaid, dealCurr, 'USD');
            totalSent += convertAmount(deal.totalSent, dealCurr, 'USD');
            totalOverdue += convertAmount(deal.totalOverdue, dealCurr, 'USD');
            totalPipeline += convertAmount(deal.pipelineValue, dealCurr, 'USD');
        });
        return { totalValue, totalPaid, totalSent, totalOverdue, totalPipeline };
    }, [activeTab, processedDeals, profitabilityData, cashflowData, convertAmount]);

    // Grouped Profitability Data
    const groupedProfitability = useMemo(() => {
        if (activeTab !== 'profitability') return [];

        if (profitGrouping === 'Customer') {
            const customerMap = {};
            profitabilityData.forEach(p => {
                const cid = p.customer_id || 'unknown';
                if (!customerMap[cid]) {
                    customerMap[cid] = {
                        id: cid,
                        name: p.customer_name || 'Unknown',
                        income: 0,
                        salary_expense: 0,
                        other_expense: 0
                    };
                }
                customerMap[cid].income += p.income;
                customerMap[cid].salary_expense += p.salary_expense;
                customerMap[cid].other_expense += p.other_expense;
            });

            return Object.values(customerMap).map(c => {
                c.net_profit = c.income - c.salary_expense - c.other_expense;
                c.margin_percentage = c.income > 0 ? (c.net_profit / c.income) * 100 : 0;
                return c;
            }).sort((a, b) => b.income - a.income);
        }

        // Project wise (default from backend)
        return [...profitabilityData].sort((a, b) => b.income - a.income);
    }, [profitabilityData, profitGrouping, activeTab]);

    // Balance Sheet Chart Scaling
    const { chartScale, chartUnit } = useMemo(() => {
        if (profitCurrency === 'INR') return { chartScale: 10000000, chartUnit: 'Cr' };
        return { chartScale: 1000000, chartUnit: 'M' };
    }, [profitCurrency]);

    // Balance Sheet Chart Data
    const balanceSheetChartData = useMemo(() => {
        if (activeTab !== 'balancesheet' || !cashflowData) return [];
        return cashflowData.map(row => {
            const [y, m] = row.month_key.split('-');
            const date = new Date(y, parseInt(m) - 1, 1);
            const totalIn = (row.actual_in || 0) + (row.projected_in || 0);
            const totalOut = (row.actual_out || 0) + (row.projected_out || 0);
            return {
                name: date.toLocaleDateString('default', { month: 'short', year: '2-digit' }),
                income: totalIn / chartScale,
                expense: totalOut / chartScale,
                net: (totalIn - totalOut) / chartScale,
                incomeAbs: totalIn,
                expenseAbs: totalOut,
                netAbs: totalIn - totalOut,
                month_key: row.month_key
            };
        });
    }, [cashflowData, activeTab, chartScale]);

    // 2. Compute KPI Totals
    const availableFYs = useMemo(() => {
        const years = [];
        const startYear = 2024;
        for (let i = 0; i < 5; i++) {
            const yr = startYear + i;
            years.push(`${yr}`);
            years.push(`FY${String(yr).slice(-2)}-${String(yr + 1).slice(-2)}`);
        }
        return years;
    }, []);

    // 4. Compute Timeline Columns (Months)
    const timelineMonths = useMemo(() => {
        if (processedDeals.length === 0) return [];

        let minDateStr = '9999-12-31';
        let maxDateStr = '0000-01-01';

        if (fyFilter !== 'All') {
            if (fyFilter.startsWith('FY')) {
                // e.g., 'FY24-25'
                const startYY = parseInt(fyFilter.substring(2, 4), 10);
                const endYY = parseInt(fyFilter.substring(5, 7), 10);
                const startYear = 2000 + startYY;
                const endYear = 2000 + endYY;
                minDateStr = `${startYear}-04-01`;
                maxDateStr = `${endYear}-03-31`;
            } else {
                // e.g., '2024'
                minDateStr = `${fyFilter}-01-01`;
                maxDateStr = `${fyFilter}-12-31`;
            }
        } else {
            minDateStr = '2024-01-01'; // Force start from 2024 per user request
            processedDeals.forEach(d => {
                if (d.end_date && d.end_date > maxDateStr) maxDateStr = d.end_date;
                d.invoices.forEach(inv => {
                    if (inv.issue_date && inv.issue_date > maxDateStr) maxDateStr = inv.issue_date;
                });
            });

            if (maxDateStr === '1900-01-01') {
                maxDateStr = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            }
        }

        const minD = new Date(minDateStr);
        const maxD = new Date(maxDateStr);
        let startYear = minD.getFullYear();
        let startMonth = minD.getMonth();
        let endYear = maxD.getFullYear();
        let endMonth = maxD.getMonth() + 2;

        if (endMonth > 11) {
            endMonth = endMonth % 12;
            endYear++;
        }

        const months = [];
        let currY = startYear;
        let currM = startMonth - 1;
        if (currM < 0) { currM = 11; currY--; }

        while (currY < endYear || (currY === endYear && currM <= endMonth)) {
            const daysInMonth = new Date(currY, currM + 1, 0).getDate();
            months.push({
                year: currY,
                month: currM,
                key: `${currY}-${String(currM + 1).padStart(2, '0')}`,
                label: new Date(currY, currM, 1).toLocaleString('default', { month: 'short', year: '2-digit' }),
                daysInMonth
            });
            currM++;
            if (currM > 11) {
                currM = 0;
                currY++;
            }
        }

        return months;
    }, [processedDeals, fyFilter]);

    const totalDays = timelineMonths.reduce((sum, m) => sum + m.daysInMonth, 0);
    const startOfTimeline = timelineMonths.length > 0 ? new Date(timelineMonths[0].year, timelineMonths[0].month, 1) : new Date();
    const timelineEnd = timelineMonths.length > 0 ? new Date(timelineMonths[timelineMonths.length - 1].year, timelineMonths[timelineMonths.length - 1].month, timelineMonths[timelineMonths.length - 1].daysInMonth) : new Date();

    // 5. Bubble Helpers
    const maxInvoiceAmount = useMemo(() => {
        let max = 1;
        processedDeals.forEach(d => {
            d.invoices.forEach(i => {
                if (i.total_amount > max) max = i.total_amount;
            });
        });
        return max;
    }, [processedDeals]);

    const getBubbleProps = (invoice) => {
        const diameter = 32;

        let color1 = '#bfdbfe'; // Light blue
        let color2 = '#3b82f6'; // Deep blue
        let shadowColor = 'rgba(59, 130, 246, 0.4)';
        let borderColor = '#93c5fd';
        const status = invoice.status?.toLowerCase().trim() || 'draft';
        const today = new Date().toISOString().split('T')[0];
        let textColor = '#fff';

        if (status === 'paid') {
            color1 = '#86efac';
            color2 = '#22c55e';
            shadowColor = 'rgba(34, 197, 94, 0.4)';
            borderColor = '#16a34a';
        } else if (status === 'sent' || status === 'overdue') {
            if (status === 'overdue' || (invoice.due_date && invoice.due_date < today)) {
                color1 = '#fca5a5';
                color2 = '#ef4444';
                shadowColor = 'rgba(239, 68, 68, 0.4)';
                borderColor = '#dc2626';
            } else {
                color1 = '#fde047';
                color2 = '#f59e0b';
                shadowColor = 'rgba(245, 158, 11, 0.4)';
                borderColor = '#d97706';
                textColor = '#78350f';
            }
        }

        const background = `radial-gradient(circle at 30% 30%, ${color1}, ${color2})`;

        return { diameter, background, borderColor, textColor, shadowColor, status };
    };

    if (loading) {
        return (
            <div style={{ padding: '2rem' }}>
                <Skeleton height={140} style={{ marginBottom: '1.5rem' }} />
                <Skeleton height={50} style={{ marginBottom: '1rem' }} />
                <Skeleton height={400} />
            </div>
        );
    }

    const isGloballyLoading = loading || loadingProfit || loadingCashflow;

    return (
        <div style={{ paddingBottom: '2rem', position: 'relative' }}>
            {/* Global Progress Bar */}
            {isGloballyLoading && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '3px',
                    zIndex: 9999,
                    background: 'rgba(59, 130, 246, 0.1)',
                    overflow: 'hidden'
                }}>
                    <div className="progress-bar-inner" style={{
                        height: '100%',
                        background: 'var(--gradient-primary)',
                        width: '30%',
                        boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
                    }}></div>
                </div>
            )}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
                <div>
                    <h1 className="page-title">Finance View</h1>
                    <p className="page-subtitle">Track billing timeline and project profitability.</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>


                    {availableFYs.length > 0 && (
                        <select
                            value={fyFilter}
                            onChange={(e) => setFyFilter(e.target.value)}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: 'white',
                                color: '#64748b',
                                outline: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                            }}
                        >
                            <option value="All">All Years</option>
                            {availableFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                        </select>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--gray-600)' }}>Currency:</span>
                        <select
                            value={profitCurrency}
                            onChange={(e) => setProfitCurrency(e.target.value)}
                            style={{
                                padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600,
                                borderRadius: '8px', border: '1px solid #e2e8f0',
                                backgroundColor: 'white', color: '#0f172a', outline: 'none', cursor: 'pointer',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                            }}
                        >
                            {['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AUD', 'CAD'].map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    {(activeTab === 'timeline' || activeTab === 'profitability') && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            backgroundColor: 'white',
                            padding: '0.5rem',
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                            border: '1px solid #e2e8f0'
                        }}>
                            {['All', 'Active', 'Completed'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        borderRadius: '8px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        backgroundColor: filter === f ? '#eff6ff' : 'transparent',
                                        color: filter === f ? '#2563eb' : '#64748b',
                                        boxShadow: filter === f ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                    }}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* View Tabs */}
            <div className="tabs-container">
                <button
                    className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
                    onClick={() => setActiveTab('timeline')}
                >
                    <List size={16} className="tab-icon" />
                    Invoice Timeline
                </button>
                <button
                    className={`tab-btn ${activeTab === 'profitability' ? 'active' : ''}`}
                    onClick={() => setActiveTab('profitability')}
                >
                    <DollarSign size={16} className="tab-icon" />
                    Profitability
                </button>
                <button
                    className={`tab-btn ${activeTab === 'cashflow' ? 'active' : ''}`}
                    onClick={() => setActiveTab('cashflow')}
                >
                    <TrendingUp size={16} className="tab-icon" />
                    Cash Flow
                </button>
                <button
                    className={`tab-btn ${activeTab === 'balancesheet' ? 'active' : ''}`}
                    onClick={() => setActiveTab('balancesheet')}
                >
                    <FileText size={16} className="tab-icon" />
                    Balance Sheet
                </button>
            </div>

            {/* KPI Summary Cards with Loading Protection */}
            <div className="stats-grid" style={{ marginBottom: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', minHeight: '120px' }}>
                {(loading || (activeTab === 'profitability' && loadingProfit) || ((activeTab === 'cashflow' || activeTab === 'balancesheet') && loadingCashflow)) ? (
                    <ShimmerLoader type="stats" />
                ) : activeTab === 'cashflow' ? (
                    <>
                        <StatCard
                            label="Current Cash Balance"
                            value={formatCurrency(kpis.currentBalance, profitCurrency)}
                            icon={DollarSign}
                            color="blue"
                        />
                        <StatCard
                            label="90-Day Projected Inflow"
                            value={formatCurrency(kpis.projectedIn, profitCurrency)}
                            icon={TrendingUp}
                            color="green"
                        />
                        <StatCard
                            label="90-Day Projected Outflow"
                            value={formatCurrency(kpis.projectedOut, profitCurrency)}
                            icon={TrendingUp}
                            color="red"
                        />
                    </>
                ) : activeTab === 'balancesheet' ? (
                    <div className="card" style={{ gridColumn: '1 / -1', padding: '1.5rem', minHeight: '350px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-700)', margin: 0 }}>Monthly Trend: Income vs Expense</h3>
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', fontWeight: 500 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <div style={{ width: '10px', height: '10px', background: '#22c55e', borderRadius: '2px' }}></div> Income
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '2px' }}></div> Expense
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <div style={{ width: '10px', height: '10px', background: '#3b82f6', borderRadius: '50%' }}></div> Net Balance
                                </div>
                            </div>
                        </div>
                        <div style={{ width: '100%', height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={balanceSheetChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                        tickFormatter={(val) => `${val.toFixed(1)} ${chartUnit}`}
                                    />
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '0.875rem' }}
                                        formatter={(val, name, props) => {
                                            const absKey = name.toLowerCase() + 'Abs';
                                            const absVal = props.payload[absKey];
                                            const label = name.toLowerCase() === 'net' ? 'Net Balance' : (name.charAt(0).toUpperCase() + name.slice(1));
                                            return [formatCurrency(absVal, profitCurrency), label];
                                        }}
                                    />
                                    <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Area type="monotone" dataKey="net" fill="#eff6ff" stroke="#3b82f6" strokeWidth={2} />
                                    <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                ) : activeTab === 'timeline' ? (
                    <>
                        <StatCard
                            label="Total Deal Value"
                            value={formatCurrency(kpis.totalValue, 'USD')}
                            icon={TrendingUp}
                            color="blue"
                            subtitle="Expected Revenue (USD)"
                        />
                        <StatCard
                            label="Total Paid"
                            value={formatCurrency(kpis.totalPaid, 'USD')}
                            icon={CheckCircle}
                            color="green"
                            subtitle="Collected Revenue (USD)"
                        />
                        <StatCard
                            label="Awaiting (Sent)"
                            value={formatCurrency(kpis.totalSent, 'USD')}
                            icon={AlertCircle}
                            color="amber"
                            subtitle="Invoices sent but not due (USD)"
                        />
                        <StatCard
                            label="Overdue"
                            value={formatCurrency(kpis.totalOverdue, 'USD')}
                            icon={AlertCircle}
                            color="red"
                            subtitle="Past due invoices (USD)"
                        />
                        <StatCard
                            label="Pipeline"
                            value={formatCurrency(kpis.totalPipeline, 'USD')}
                            icon={RefreshCw}
                            color="purple"
                            subtitle="Unbilled value (USD)"
                        />
                    </>
                ) : (
                    <>
                        <StatCard
                            label="Total Invoice Income"
                            value={formatCurrency(kpis.totalIncome, profitCurrency)}
                            icon={TrendingUp}
                            color="green"
                            subtitle="Gross Billed"
                        />
                        <StatCard
                            label="Total Salary Cost"
                            value={formatCurrency(kpis.totalSalary, profitCurrency)}
                            icon={AlertCircle}
                            color="amber"
                            subtitle="Allocated Resource CTC"
                        />
                        <StatCard
                            label="Other Expenses"
                            value={formatCurrency(kpis.totalOther, profitCurrency)}
                            icon={AlertCircle}
                            color="red"
                            subtitle="Approved Expenses"
                        />
                        <StatCard
                            label="Net Profit"
                            value={formatCurrency(kpis.netProfit, profitCurrency)}
                            icon={DollarSign}
                            color={kpis.netProfit >= 0 ? 'blue' : 'red'}
                            subtitle="Overall Profit"
                        />
                        <StatCard
                            label="Overall Margin"
                            value={kpis.totalIncome > 0 ? ((kpis.netProfit / kpis.totalIncome) * 100).toFixed(1) + '%' : '0%'}
                            icon={RefreshCw}
                            color={kpis.netProfit >= 0 ? 'purple' : 'red'}
                            subtitle="Profit Margin %"
                        />
                    </>
                )}
            </div>

            {activeTab === 'profitability' && (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0.5rem 0', flexWrap: 'wrap', gap: '1rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>Profitability Analysis</h2>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>


                            <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
                                {['Project', 'Customer'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setProfitGrouping(type)}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            fontSize: '0.875rem',
                                            fontWeight: 500,
                                            borderRadius: '6px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: profitGrouping === type ? 'white' : 'transparent',
                                            color: profitGrouping === type ? 'var(--gray-900)' : 'var(--gray-500)',
                                            boxShadow: profitGrouping === type ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{profitGrouping} Name</th>
                                    <th className="text-right">Income</th>
                                    <th className="text-right">Salary Cost</th>
                                    <th className="text-right">Other Expenses</th>
                                    <th className="text-right">Net Profit</th>
                                    <th className="text-right">Margin %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingProfit ? (
                                    [...Array(6)].map((_, i) => (
                                        <tr key={i}>
                                            <td colSpan="6" style={{ padding: '0.75rem' }}>
                                                <div className="shimmer-line"></div>
                                            </td>
                                        </tr>
                                    ))
                                ) : groupedProfitability.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center" style={{ padding: '3rem' }}>
                                            <div style={{ color: 'var(--gray-400)', marginBottom: '0.5rem' }}>
                                                <DollarSign size={48} style={{ margin: '0 auto', opacity: 0.5 }} />
                                            </div>
                                            <p>No profitability data found for the current period.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    groupedProfitability.map((row, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 500, color: 'var(--gray-900)' }}>
                                                {profitGrouping === 'Project' ? row.deal_name : row.name}
                                                {profitGrouping === 'Project' && row.customer_name && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{row.customer_name}</div>
                                                )}
                                            </td>
                                            <td className="text-right" style={{ color: '#16a34a', fontWeight: 500 }}>{formatCurrency(row.income, profitCurrency)}</td>
                                            <td className="text-right" style={{ color: '#ea580c' }}>{formatCurrency(row.salary_expense, profitCurrency)}</td>
                                            <td className="text-right" style={{ color: '#dc2626' }}>{formatCurrency(row.other_expense, profitCurrency)}</td>
                                            <td className="text-right" style={{ fontWeight: 600, color: row.net_profit >= 0 ? '#2563eb' : '#dc2626' }}>
                                                {formatCurrency(row.net_profit, profitCurrency)}
                                            </td>
                                            <td className="text-right">
                                                <span style={{
                                                    padding: '0.25rem 0.6rem',
                                                    borderRadius: '12px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    background: row.margin_percentage >= 20 ? '#dcfce7' : row.margin_percentage > 0 ? '#fef08a' : '#fee2e2',
                                                    color: row.margin_percentage >= 20 ? '#166534' : row.margin_percentage > 0 ? '#854d0e' : '#991b1b'
                                                }}>
                                                    {row.margin_percentage ? row.margin_percentage.toFixed(1) + '%' : '0%'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Gantt Chart Section */}
            {activeTab === 'timeline' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {loading ? (
                        <div style={{ padding: '2rem' }}>
                            <ShimmerLoader type="table" rows={10} />
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'auto', maxHeight: 'calc(100vh - 250px)', position: 'relative' }}>

                                {/* Unified Sticky Header */}
                                <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 60, minWidth: `calc(200px + ${timelineMonths.length * 80}px)` }}>
                                    {/* Fixed Left Header */}
                                    <div style={{
                                        width: '200px',
                                        minWidth: '200px',
                                        height: '48px',
                                        padding: '0 1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        background: '#f8fafc',
                                        borderRight: '1px solid var(--gray-200)',
                                        borderBottom: '1px solid var(--gray-200)',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        letterSpacing: '0.05em',
                                        color: 'var(--gray-500)',
                                        position: 'sticky',
                                        left: 0,
                                        zIndex: 70
                                    }}>
                                        DEAL DETAILS
                                    </div>

                                    {/* Timeline Header Grid */}
                                    <div style={{ display: 'flex', flex: 1, background: '#f8fafc', borderBottom: '1px solid var(--gray-200)' }}>
                                        {timelineMonths.map((m, i) => (
                                            <div key={i} style={{
                                                width: `${(m.daysInMonth / totalDays) * 100}%`,
                                                height: '48px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRight: '1px solid var(--gray-200)',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                letterSpacing: '0.05em',
                                                color: 'var(--gray-500)',
                                                textTransform: 'uppercase'
                                            }}>
                                                {m.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Scrolling Deal Rows */}
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: `calc(200px + ${timelineMonths.length * 80}px)` }}>

                                    {(() => {
                                        const getPositionPct = (dateStr) => {
                                            if (!dateStr) return null;
                                            const date = new Date(dateStr);
                                            if (date < startOfTimeline) return 0;
                                            if (date > timelineEnd) return 100;

                                            let daysFromStart = 0;
                                            const dYear = date.getFullYear();
                                            const dMonth = date.getMonth();
                                            const dDay = date.getDate();

                                            for (let i = 0; i < timelineMonths.length; i++) {
                                                const m = timelineMonths[i];
                                                if (m.year === dYear && m.month === dMonth) {
                                                    daysFromStart += dDay - 1;
                                                    break;
                                                }
                                                daysFromStart += m.daysInMonth;
                                            }
                                            return (daysFromStart / totalDays) * 100;
                                        };

                                        return processedDeals.map((deal) => {
                                            const sortedInvoices = [...deal.invoices].filter(i => i.issue_date && i.status?.toLowerCase().trim() !== 'cancelled').sort((a, b) => a.issue_date.localeCompare(b.issue_date));

                                            const shiftDate = (dateStr, days) => {
                                                if (!dateStr) return null;
                                                const d = new Date(dateStr);
                                                d.setDate(d.getDate() + days);
                                                return d.toISOString().split('T')[0];
                                            };

                                            const startXPctTemp = getPositionPct(shiftDate(deal.start_date, 30));
                                            const allXPcts = [];
                                            if (startXPctTemp !== null) allXPcts.push(startXPctTemp);
                                            sortedInvoices.forEach(i => {
                                                const ix = getPositionPct(i.issue_date);
                                                if (ix !== null) allXPcts.push(ix);
                                            });
                                            let currentXPct = allXPcts.length > 0 ? Math.min(...allXPcts) : 0;

                                            let endXPct = getPositionPct(shiftDate(deal.end_date, 60));
                                            if (endXPct === null || endXPct < currentXPct) {
                                                endXPct = 100;
                                            }

                                            const barWidthPct = Math.max(0, endXPct - currentXPct);

                                            const dealValue = deal.value || 1;
                                            const draftAmount = Math.max(0, deal.totalInvoiced - deal.totalPaid - deal.totalSent - deal.totalOverdue);

                                            let paidPct = (deal.totalPaid / dealValue) * 100;
                                            let sentPct = (deal.totalSent / dealValue) * 100;
                                            let overduePct = (deal.totalOverdue / dealValue) * 100;
                                            let draftPct = (draftAmount / dealValue) * 100;

                                            const totalPct = paidPct + sentPct + overduePct + draftPct;
                                            if (totalPct > 100) {
                                                const scale = 100 / totalPct;
                                                paidPct *= scale;
                                                sentPct *= scale;
                                                overduePct *= scale;
                                                draftPct *= scale;
                                            }

                                            return (
                                                <div key={deal.id} style={{ display: 'flex', height: '80px', borderBottom: '1px solid var(--gray-100)', position: 'relative' }}>
                                                    {/* Sticky Deal Details (Row Level) */}
                                                    <div style={{
                                                        width: '200px',
                                                        minWidth: '200px',
                                                        padding: '0.75rem 1rem',
                                                        borderRight: '1px solid var(--gray-200)',
                                                        background: 'white',
                                                        position: 'sticky',
                                                        left: 0,
                                                        zIndex: 50,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <div style={{ fontWeight: 600, fontSize: '0.875rem', maxWidth: '160px', marginBottom: '0.25rem' }} title={deal.name}>
                                                            {deal.name}
                                                        </div>
                                                        <div style={{ fontWeight: 500, fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                                                            Value: {formatCurrency(deal.value, deal.currency)}
                                                        </div>
                                                    </div>

                                                    {/* Right Timeline Entry */}
                                                    <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                                                        {/* Grid Cells Background */}
                                                        {timelineMonths.map((m, i) => (
                                                            <div key={i} style={{
                                                                width: `${(m.daysInMonth / totalDays) * 100}%`,
                                                                borderRight: '1px solid var(--gray-100)',
                                                                backgroundColor: 'transparent'
                                                            }}></div>
                                                        ))}

                                                        {/* Unified Gantt Bar */}
                                                        {barWidthPct > 0 && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                left: `${currentXPct}%`,
                                                                width: `${barWidthPct}%`,
                                                                height: '14px',
                                                                backgroundColor: 'white',
                                                                border: '1px solid var(--gray-300)',
                                                                borderRadius: '7px',
                                                                top: '50%',
                                                                transform: 'translateY(-50%)',
                                                                zIndex: 1,
                                                                overflow: 'hidden',
                                                                display: 'flex',
                                                                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                                                            }}
                                                                title={(() => {
                                                                    const curr = deal.currency;
                                                                    const invoicedPctVal = deal.value ? ((deal.totalInvoiced / deal.value) * 100).toFixed(1) : '0.0';
                                                                    const paidPctVal = deal.value ? ((deal.totalPaid / deal.value) * 100).toFixed(1) : '0.0';
                                                                    const duePctVal = deal.value ? (((deal.totalSent + deal.totalOverdue) / deal.value) * 100).toFixed(1) : '0.0';
                                                                    const balanceAmt = Math.max(0, deal.value - deal.totalInvoiced);
                                                                    const balancePctVal = deal.value ? ((balanceAmt / deal.value) * 100).toFixed(1) : '0.0';
                                                                    return `Deal Value: ${formatCurrency(deal.value, curr)}\nTotal Invoiced: ${formatCurrency(deal.totalInvoiced, curr)} (${invoicedPctVal}%)\nTotal Paid: ${formatCurrency(deal.totalPaid, curr)} (${paidPctVal}%)\nTotal Due: ${formatCurrency(deal.totalSent + deal.totalOverdue, curr)} (${duePctVal}%)\nBalance to Invoice: ${formatCurrency(balanceAmt, curr)} (${balancePctVal}%)`;
                                                                })()}
                                                            >
                                                                {paidPct > 0 && <div style={{ width: `${paidPct}%`, backgroundColor: '#22c55e', height: '100%' }} />}
                                                                {sentPct > 0 && <div style={{ width: `${sentPct}%`, backgroundColor: '#fbbf24', height: '100%' }} />}
                                                                {overduePct > 0 && <div style={{ width: `${overduePct}%`, backgroundColor: '#ef4444', height: '100%' }} />}
                                                                {draftPct > 0 && <div style={{ width: `${draftPct}%`, backgroundColor: '#93c5fd', height: '100%' }} />}
                                                            </div>
                                                        )}

                                                        {/* Absolute Invoice Bubbles */}
                                                        {(() => {
                                                            const pctCounts = {};
                                                            return sortedInvoices.map((inv, idx) => {
                                                                const dateParts = inv.issue_date ? inv.issue_date.split('-') : [];
                                                                if (dateParts.length === 3) {
                                                                    const d = new Date(dateParts[0], parseInt(dateParts[1], 10) - 1, dateParts[2]);
                                                                    if (d < startOfTimeline || d > timelineEnd) return null;
                                                                }

                                                                const invXPct = getPositionPct(inv.issue_date);
                                                                if (invXPct === null) return null;

                                                                const count = pctCounts[invXPct] || 0;
                                                                pctCounts[invXPct] = count + 1;

                                                                const { background, borderColor, textColor, shadowColor, status } = getBubbleProps(inv);
                                                                const diameter = 32;

                                                                // Compute cumulative billed up to and including this invoice
                                                                let cumulativeBilled = 0;
                                                                for (let ci = 0; ci <= idx; ci++) {
                                                                    cumulativeBilled += parseFloat(sortedInvoices[ci].total_amount) || 0;
                                                                }
                                                                const remainingBalance = Math.max(0, deal.value - cumulativeBilled);

                                                                // Build tooltip lines
                                                                const ttLines = [
                                                                    `Invoice: ${inv.invoice_number}`,
                                                                    `Status: ${status}`,
                                                                    `Issued: ${inv.issue_date}`,
                                                                ];
                                                                if (inv.due_date && status !== 'paid' && status !== 'draft') {
                                                                    ttLines.push(`Due: ${inv.due_date}`);
                                                                }
                                                                if (status === 'paid' && inv.payment_date) {
                                                                    ttLines.push(`Paid: ${inv.payment_date}`);
                                                                }
                                                                ttLines.push(`Amount: ${formatCurrency(inv.total_amount, inv.currency)}`);
                                                                ttLines.push(`Cumulative Billed: ${formatCurrency(cumulativeBilled, deal.currency)}`);
                                                                ttLines.push(`Balance to Invoice: ${formatCurrency(remainingBalance, deal.currency)}`);
                                                                const invTooltip = ttLines.join('\n');

                                                                return (
                                                                    <div key={inv.id} style={{
                                                                        position: 'absolute',
                                                                        left: `${invXPct}%`,
                                                                        top: '50%',
                                                                        transform: `translate(calc(-50% + ${count * 6}px), calc(-50% - ${count * 6}px))`,
                                                                        width: `${diameter}px`,
                                                                        height: `${diameter}px`,
                                                                        borderRadius: '50%',
                                                                        background: background,
                                                                        border: `1.5px solid ${borderColor}`,
                                                                        zIndex: 10 + idx,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        cursor: 'pointer',
                                                                        boxShadow: `0 0 10px ${shadowColor}, inset 0 2px 4px rgba(255,255,255,0.4)`,
                                                                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                                                        color: textColor
                                                                    }}
                                                                        title={invTooltip}
                                                                        onClick={() => {
                                                                            setSelectedInvoice(inv);
                                                                            setShowInvoicePreview(true);
                                                                        }}>
                                                                        <FileText size={diameter * 0.5} strokeWidth={2.5} />
                                                                    </div>
                                                                );
                                                            })
                                                        })()}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>

                            {/* Legend */}
                            <div style={{ padding: '1rem', borderTop: '1px solid var(--gray-200)', background: '#f8fafc', display: 'flex', gap: '1.5rem', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 500, color: 'var(--gray-600)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }}></div> Paid
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fbbf24' }}></div> Sent (Not Due)
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></div> Overdue
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#93c5fd' }}></div> Draft
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '16px', height: '8px', border: '1px solid var(--gray-300)', background: 'white', borderRadius: '4px' }}></div> Uninvoiced Track
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Balance Sheet Section */}
            {activeTab === 'balancesheet' && (
                <div className="card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--gray-900)', marginBottom: '0.25rem' }}>Monthly Balance Sheet</h2>
                            <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>Monthly view of realized and projected income, expenses and net balance.</p>
                        </div>
                    </div>

                    {loadingCashflow ? (
                        <ShimmerLoader type="table" rows={8} />
                    ) : (
                        cashflowData.length === 0 ? (
                            <div className="text-center" style={{ padding: '4rem 2rem', color: 'var(--gray-500)' }}>
                                <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                <p>No financial data available for the balance sheet.</p>
                            </div>
                        ) : (
                            <>
                                <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto', position: 'relative', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                                    <table className="data-table" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                                        <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                                            <tr>
                                                <th style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 21, borderBottom: '2px solid var(--gray-200)' }}>Month</th>
                                                <th className="text-right" style={{ background: '#f8fafc', position: 'sticky', top: 0, textAlign: 'right', borderBottom: '2px solid var(--gray-200)' }}>Opening Balance</th>
                                                <th className="text-right" style={{ background: '#f8fafc', position: 'sticky', top: 0, textAlign: 'right', borderBottom: '2px solid var(--gray-200)' }}>Total Income</th>
                                                <th className="text-right" style={{ background: '#f8fafc', position: 'sticky', top: 0, textAlign: 'right', borderBottom: '2px solid var(--gray-200)' }}>Total Expenses</th>
                                                <th className="text-right" style={{ background: '#f8fafc', position: 'sticky', top: 0, textAlign: 'right', borderBottom: '2px solid var(--gray-200)' }}>Monthly Net</th>
                                                <th className="text-right" style={{ background: '#f8fafc', position: 'sticky', top: 0, textAlign: 'right', borderBottom: '2px solid var(--gray-200)' }}>Closing Balance</th>
                                                <th className="text-right" style={{ background: '#f8fafc', position: 'sticky', top: 0, textAlign: 'right', borderBottom: '2px solid var(--gray-200)' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const startIndex = (bsPage - 1) * bsPageSize;
                                                const paginatedData = cashflowData.slice(startIndex, startIndex + bsPageSize);

                                                return paginatedData.map((row, idx) => {
                                                    const totalIn = (row.actual_in || 0) + (row.projected_in || 0);
                                                    const totalOut = (row.actual_out || 0) + (row.projected_out || 0);
                                                    const net = totalIn - totalOut;

                                                    const now = new Date();
                                                    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                                                    const isCurrent = row.month_key === currentMonthKey;
                                                    const isProjected = row.month_key > currentMonthKey;

                                                    const [y, m] = row.month_key.split('-');
                                                    const date = new Date(y, parseInt(m) - 1, 1);
                                                    const label = date.toLocaleDateString('default', { month: 'short', year: '2-digit' });

                                                    return (
                                                        <tr key={idx} style={isCurrent ? { backgroundColor: '#f0f9ff' } : {}}>
                                                            <td style={{ fontWeight: 600, borderBottom: '1px solid var(--gray-100)', padding: '0.75rem 1rem' }}>
                                                                {label}
                                                                {isCurrent && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#3b82f6', background: '#dbeafe', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>CURRENT</span>}
                                                            </td>
                                                            <td className="text-right" style={{ color: 'var(--gray-600)', borderBottom: '1px solid var(--gray-100)', padding: '0.75rem 1rem' }}>
                                                                {formatCurrency(row.opening_balance, profitCurrency)}
                                                            </td>
                                                            <td className="text-right" style={{ color: '#16a34a', fontWeight: 500, borderBottom: '1px solid var(--gray-100)', padding: '0.75rem 1rem' }}>
                                                                {formatCurrency(totalIn, profitCurrency)}
                                                            </td>
                                                            <td className="text-right" style={{ color: '#dc2626', borderBottom: '1px solid var(--gray-100)', padding: '0.75rem 1rem' }}>
                                                                {formatCurrency(totalOut, profitCurrency)}
                                                            </td>
                                                            <td className="text-right" style={{ fontWeight: 600, color: net >= 0 ? 'var(--gray-900)' : '#dc2626', borderBottom: '1px solid var(--gray-100)', padding: '0.75rem 1rem' }}>
                                                                {formatCurrency(net, profitCurrency)}
                                                            </td>
                                                            <td className="text-right" style={{ fontWeight: 700, color: row.closing_balance >= 0 ? '#2563eb' : '#dc2626', borderBottom: '1px solid var(--gray-100)', padding: '0.75rem 1rem' }}>
                                                                {formatCurrency(row.closing_balance, profitCurrency)}
                                                            </td>
                                                            <td className="text-right" style={{ borderBottom: '1px solid var(--gray-100)', padding: '0.75rem 1rem' }}>
                                                                <span className={`badge badge-${isProjected ? 'warning' : 'success'}`} style={{ fontSize: '0.7rem' }}>
                                                                    {isProjected ? 'Projected' : 'Realized'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                        <tfoot style={{ background: '#f8fafc', fontWeight: 700, position: 'sticky', bottom: 0, zIndex: 10 }}>
                                            <tr>
                                                <td style={{ borderTop: '2px solid var(--gray-200)', padding: '1rem' }}>TOTAL (OVERALL)</td>
                                                <td style={{ borderTop: '2px solid var(--gray-200)' }}></td>
                                                <td className="text-right" style={{ color: '#16a34a', borderTop: '2px solid var(--gray-200)', padding: '1rem' }}>
                                                    {formatCurrency(cashflowData.reduce((sum, r) => sum + (r.actual_in || 0) + (r.projected_in || 0), 0), profitCurrency)}
                                                </td>
                                                <td className="text-right" style={{ color: '#dc2626', borderTop: '2px solid var(--gray-200)', padding: '1rem' }}>
                                                    {formatCurrency(cashflowData.reduce((sum, r) => sum + (r.actual_out || 0) + (r.projected_out || 0), 0), profitCurrency)}
                                                </td>
                                                <td style={{ borderTop: '2px solid var(--gray-200)' }}></td>
                                                <td className="text-right" style={{ color: '#2563eb', borderTop: '2px solid var(--gray-200)', padding: '1rem' }}>
                                                    {formatCurrency(cashflowData.reduce((sum, r) => sum + (r.actual_in || 0) + (r.projected_in || 0) - (r.actual_out || 0) - (r.projected_out || 0), 0), profitCurrency)}
                                                </td>
                                                <td style={{ borderTop: '2px solid var(--gray-200)' }}></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {cashflowData.length > bsPageSize && (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setBsPage(p => Math.max(1, p - 1))}
                                            disabled={bsPage === 1}
                                            style={{ minWidth: '80px' }}
                                        >
                                            Previous
                                        </button>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--gray-600)' }}>
                                            Page {bsPage} of {Math.ceil(cashflowData.length / bsPageSize)}
                                        </span>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setBsPage(p => Math.min(Math.ceil(cashflowData.length / bsPageSize), p + 1))}
                                            disabled={bsPage === Math.ceil(cashflowData.length / bsPageSize)}
                                            style={{ minWidth: '80px' }}
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </>
                        )
                    )}
                </div>
            )}

            {/* Cash Flow Section */}
            {activeTab === 'cashflow' && (
                <div className="card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--gray-900)', marginBottom: '0.25rem' }}>Cash Flow Projection</h2>
                            <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>Historical cash balance and future expected inflows/outflows.</p>
                        </div>
                    </div>

                    {loadingCashflow ? (
                        <ShimmerLoader type="chart" />
                    ) : (
                        cashflowData.length === 0 ? (
                            <div className="text-center" style={{ padding: '4rem 2rem', color: 'var(--gray-500)' }}>
                                <TrendingUp size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                <p>No cash flow data available for the selected parameters.</p>
                            </div>
                        ) : (
                            <div style={{ height: '500px', width: '100%' }}>
                                <ResponsiveContainer>
                                    <ComposedChart data={cashflowData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="month_key"
                                            tickFormatter={(val) => {
                                                if (!val) return '';
                                                const [y, m] = val.split('-');
                                                const date = new Date(y, parseInt(m) - 1, 1);
                                                return date.toLocaleDateString('default', { month: 'short', year: '2-digit' });
                                            }}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 12 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            tickFormatter={(val) => formatCurrency(val, profitCurrency)}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 12 }}
                                            dx={-10}
                                        />
                                        <RechartsTooltip
                                            formatter={(value) => formatCurrency(value, profitCurrency)}
                                            labelFormatter={(label) => {
                                                if (!label) return '';
                                                const [y, m] = label.split('-');
                                                const date = new Date(y, parseInt(m) - 1, 1);
                                                return date.toLocaleDateString('default', { month: 'long', year: 'numeric' });
                                            }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />

                                        <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" />

                                        <Bar dataKey="actual_in" name="Historic Inflow" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                        <Bar dataKey="projected_in" name="Projected Inflow" stackId="a" fill="#86efac" radius={[4, 4, 0, 0]} maxBarSize={50} />

                                        <Bar dataKey="actual_out" name="Historic Outflow" stackId="a" fill="#ef4444" radius={[0, 0, 4, 4]} maxBarSize={50} />
                                        <Bar dataKey="projected_out" name="Projected Outflow" stackId="a" fill="#fca5a5" radius={[0, 0, 4, 4]} maxBarSize={50} />

                                        <Line type="monotone" dataKey="cumulative_cash" name="Cumulative Balance" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 6 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        )
                    )}
                </div>
            )
            }

            {/* Invoice Preview Modal */}
            <Modal
                isOpen={showInvoicePreview}
                onClose={() => setShowInvoicePreview(false)}
                title={`View Invoice: ${selectedInvoice?.invoice_number}`}
                size="xl"
                footer={
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-secondary" onClick={() => window.print()}>
                            <Printer size={18} className="mr-2" /> Print
                        </button>
                        <button className="btn btn-secondary" onClick={() => invoiceEditorRef.current?.download()}>
                            <Download size={18} className="mr-2" /> Download PDF
                        </button>
                        <button className="btn btn-primary" onClick={() => setShowInvoicePreview(false)}>
                            Close
                        </button>
                    </div>
                }
            >
                {selectedInvoice && (
                    <InvoiceEditor
                        ref={invoiceEditorRef}
                        invoice={selectedInvoice}
                        onClose={() => setShowInvoicePreview(false)}
                        viewOnly={true}
                        showPreview={true}
                    />
                )}
            </Modal>

            <style>{`
            /* Tabs - Premium Redesign */
            .tabs-container {
                display: flex;
                gap: 4px;
                margin-bottom: 2rem;
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

            /* Shimmer Effects */
            .shimmer-wrapper {
                width: 100%;
                overflow: hidden;
            }

            .shimmer-header {
                height: 48px;
                background: #f1f5f9;
                border-radius: 8px;
                margin-bottom: 1rem;
                position: relative;
                overflow: hidden;
            }

            .shimmer-row {
                height: 40px;
                background: #f8fafc;
                border-radius: 6px;
                margin-bottom: 0.5rem;
                position: relative;
                overflow: hidden;
            }

            .shimmer-chart {
                height: 400px;
                background: #f8fafc;
                border-radius: 12px;
                position: relative;
                overflow: hidden;
            }

            .shimmer-line {
                height: 20px;
                background: #f1f5f9;
                border-radius: 4px;
                position: relative;
                overflow: hidden;
            }

            .shimmer-header::after,
            .shimmer-row::after,
            .shimmer-chart::after,
            .shimmer-line::after {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                    90deg,
                    transparent,
                    rgba(255, 255, 255, 0.6),
                    transparent
                );
                animation: shimmer 1.5s infinite;
            }

            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }

            .progress-bar-inner {
                animation: progress-animation 2s infinite linear;
                transform-origin: 0% 50%;
            }

            @keyframes progress-animation {
                0% { transform: translateX(-100%) scaleX(0.5); }
                50% { transform: translateX(0%) scaleX(1); }
                100% { transform: translateX(100%) scaleX(0.5); }
            }

            .shimmer-card::after {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                    90deg,
                    transparent,
                    rgba(255, 255, 255, 0.6),
                    transparent
                );
                animation: shimmer 1.5s infinite;
            }
            `}</style>
        </div >
    );
};

export default FinanceView;
