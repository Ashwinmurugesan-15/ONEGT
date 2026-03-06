import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, AlertTriangle, TrendingUp, DollarSign, Filter, PlusCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import { currencyApi } from '../../services/api';

const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const currencyColors = {
    INR: '#f59e0b',
    SGD: '#10b981',
    GBP: '#8b5cf6',
    AED: '#ef4444',
    MXN: '#06b6d4',
    EUR: '#3b82f6',
    JPY: '#ec4899'
};

function CurrencyRates() {
    const [loading, setLoading] = useState(true);
    const [rates, setRates] = useState([]);
    const [currencies, setCurrencies] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAddCurrencyModalOpen, setIsAddCurrencyModalOpen] = useState(false);
    const [selectedRate, setSelectedRate] = useState(null);
    const [saving, setSaving] = useState(false);
    const [missingEntry, setMissingEntry] = useState(null);
    const [trendData, setTrendData] = useState([]);
    const [newCurrencyCode, setNewCurrencyCode] = useState('');
    const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, data: null });

    // Filters
    const today = new Date();
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const [filterYear, setFilterYear] = useState(prevMonth.getFullYear());
    const [filterMonth, setFilterMonth] = useState(months[prevMonth.getMonth()]);

    const { register, handleSubmit, reset, setValue, watch } = useForm();
    const watchedRates = watch();

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        loadRates();
    }, [filterYear, filterMonth]);

    const loadData = async () => {
        try {
            const [currenciesRes, missingRes, trendRes] = await Promise.all([
                currencyApi.getCurrencies(),
                currencyApi.checkMissing(),
                currencyApi.getTrend(12)
            ]);

            setCurrencies(currenciesRes.data || ['USD', 'INR', 'SGD']);
            setMissingEntry(missingRes.data);
            setTrendData(trendRes.data || []);
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const loadRates = async () => {
        try {
            const response = await currencyApi.getAll(filterYear, filterMonth);
            setRates(response.data);
        } catch (error) {
            console.error('Error loading rates:', error);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (rate = null) => {
        setSelectedRate(rate);
        if (rate) {
            reset({
                year: rate.year,
                month: rate.month,
                ...rate.rates
            });
        } else {
            const defaultRates = { USD: 1 };
            currencies.forEach(c => {
                if (c !== 'USD') defaultRates[c] = '';
            });

            // Default to missing month if any
            const defaultYear = missingEntry?.missing_entries?.[0]?.year || prevMonth.getFullYear();
            const defaultMonth = missingEntry?.missing_entries?.[0]?.month || months[prevMonth.getMonth()];

            reset({
                year: defaultYear,
                month: defaultMonth,
                ...defaultRates
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedRate(null);
        reset();
    };

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            const ratesObj = {};
            currencies.forEach(c => {
                ratesObj[c] = parseFloat(data[c]) || 0;
            });

            const payload = {
                year: parseInt(data.year),
                month: data.month,
                rates: ratesObj
            };

            if (selectedRate) {
                await currencyApi.update(selectedRate.year, selectedRate.month, { rates: ratesObj });
            } else {
                await currencyApi.create(payload);
            }
            await loadData();
            await loadRates();
            closeModal();
        } catch (error) {
            console.error('Error saving rate:', error);
            alert(error.response?.data?.detail || 'Error saving currency rate');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (rate) => {
        if (!confirm(`Delete rates for ${rate.month} ${rate.year}?`)) return;

        try {
            await currencyApi.delete(rate.year, rate.month);
            await loadRates();
        } catch (error) {
            console.error('Error deleting rate:', error);
        }
    };

    const handleAddCurrency = async () => {
        if (!newCurrencyCode.trim()) return;

        try {
            await currencyApi.addCurrency(newCurrencyCode.toUpperCase());
            setNewCurrencyCode('');
            setIsAddCurrencyModalOpen(false);
            await loadData();
        } catch (error) {
            alert(error.response?.data?.detail || 'Error adding currency');
        }
    };

    // Prepare table columns dynamically
    const columns = useMemo(() => {
        const cols = [
            { key: 'year', label: 'Year' },
            { key: 'month', label: 'Month' }
        ];

        currencies.forEach(curr => {
            cols.push({
                key: curr,
                label: curr,
                render: (_, row) => {
                    const val = row.rates?.[curr];
                    return val ? val.toFixed(2) : '-';
                }
            });
        });

        return cols;
    }, [currencies]);

    // Calculate max value for chart scaling
    const chartMax = useMemo(() => {
        if (!trendData.length) return 100;
        let max = 0;
        trendData.forEach(d => {
            currencies.forEach(c => {
                if (c !== 'USD' && d.rates?.[c] > max) max = d.rates[c];
            });
        });
        return Math.ceil(max / 10) * 10;
    }, [trendData, currencies]);

    if (loading) return <Loading />;

    // Years for filter
    const years = [2023, 2024, 2025, 2026, 2027];

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Currency Rates</h1>
                    <p className="page-subtitle">Monthly conversion rates (value per 1 USD)</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-secondary" onClick={() => setIsAddCurrencyModalOpen(true)}>
                        <PlusCircle size={18} />
                        Add Currency
                    </button>
                    <button className="btn btn-primary" onClick={() => openModal()}>
                        <Plus size={18} />
                        Add Rate
                    </button>
                </div>
            </div>

            {/* Missing Entry Alert */}
            {missingEntry?.has_missing && (
                <div style={{
                    background: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                }}>
                    <AlertTriangle size={20} style={{ color: '#d97706' }} />
                    <div>
                        <strong style={{ color: '#92400e' }}>Missing Currency Entries!</strong>
                        <span style={{ marginLeft: '0.5rem', color: '#78350f' }}>
                            Please add rates for: {missingEntry.missing_entries.map(e =>
                                `${e.month} ${e.year}`
                            ).join(', ')}
                        </span>
                    </div>
                    <button
                        className="btn btn-primary btn-sm"
                        style={{ marginLeft: 'auto' }}
                        onClick={() => openModal()}
                    >
                        Add Now
                    </button>
                </div>
            )}

            {/* Trend Chart */}
            {trendData.length > 0 && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div className="card-header">
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={18} />
                            Currency Trend (Last 12 Months)
                        </h3>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {/* Y-Axis Labels */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                paddingBottom: '30px',
                                width: '50px',
                                textAlign: 'right',
                                fontSize: '0.7rem',
                                color: 'var(--gray-500)'
                            }}>
                                <span>{chartMax}</span>
                                <span>{Math.round(chartMax * 0.75)}</span>
                                <span>{Math.round(chartMax * 0.5)}</span>
                                <span>{Math.round(chartMax * 0.25)}</span>
                                <span>0</span>
                            </div>

                            {/* Chart Area */}
                            <div style={{ flex: 1, position: 'relative' }}>
                                <svg width="100%" height="200" viewBox="0 0 800 200" preserveAspectRatio="none">
                                    {/* Grid lines */}
                                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                                        <line
                                            key={i}
                                            x1="0" y1={200 - ratio * 180}
                                            x2="800" y2={200 - ratio * 180}
                                            stroke="var(--gray-200)"
                                            strokeDasharray="4,4"
                                        />
                                    ))}

                                    {/* Lines for each currency */}
                                    {currencies.filter(c => c !== 'USD').map(curr => {
                                        const sortedData = [...trendData].reverse();
                                        const points = sortedData.map((d, i) => {
                                            const x = (i / (sortedData.length - 1 || 1)) * 780 + 10;
                                            const y = 190 - ((d.rates?.[curr] || 0) / chartMax) * 180;
                                            return `${x},${y}`;
                                        }).join(' ');

                                        return (
                                            <polyline
                                                key={curr}
                                                points={points}
                                                fill="none"
                                                stroke={currencyColors[curr] || '#6b7280'}
                                                strokeWidth="2"
                                            />
                                        );
                                    })}

                                    {/* Interactive data points */}
                                    {currencies.filter(c => c !== 'USD').map(curr => {
                                        const sortedData = [...trendData].reverse();
                                        return sortedData.map((d, i) => {
                                            const x = (i / (sortedData.length - 1 || 1)) * 780 + 10;
                                            const y = 190 - ((d.rates?.[curr] || 0) / chartMax) * 180;
                                            return (
                                                <circle
                                                    key={`${curr}-${i}`}
                                                    cx={x}
                                                    cy={y}
                                                    r="6"
                                                    fill={currencyColors[curr] || '#6b7280'}
                                                    fillOpacity="0"
                                                    stroke="none"
                                                    style={{ cursor: 'pointer' }}
                                                    onMouseEnter={(e) => {
                                                        const rect = e.target.getBoundingClientRect();
                                                        setTooltip({
                                                            show: true,
                                                            x: rect.left + window.scrollX,
                                                            y: rect.top + window.scrollY - 60,
                                                            data: {
                                                                month: `${d.month} ${d.year}`,
                                                                currency: curr,
                                                                value: d.rates?.[curr]?.toFixed(2) || '0'
                                                            }
                                                        });
                                                    }}
                                                    onMouseLeave={() => setTooltip({ show: false, x: 0, y: 0, data: null })}
                                                />
                                            );
                                        });
                                    })}
                                </svg>

                                {/* Tooltip */}
                                {tooltip.show && tooltip.data && (
                                    <div style={{
                                        position: 'fixed',
                                        left: tooltip.x - 40,
                                        top: tooltip.y,
                                        background: 'rgba(0,0,0,0.85)',
                                        color: 'white',
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        zIndex: 1000,
                                        pointerEvents: 'none',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        <div style={{ fontWeight: '600', marginBottom: '2px' }}>{tooltip.data.month}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <span style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: currencyColors[tooltip.data.currency] || '#6b7280'
                                            }} />
                                            {tooltip.data.currency}: {tooltip.data.value}
                                        </div>
                                    </div>
                                )}

                                {/* X-Axis Labels */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '0.65rem',
                                    color: 'var(--gray-500)',
                                    marginTop: '4px'
                                }}>
                                    {[...trendData].reverse().map((d, i) => (
                                        <span key={i}>{d.month?.slice(0, 3)} '{String(d.year).slice(-2)}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Legend */}
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '1rem',
                            marginTop: '1rem',
                            justifyContent: 'center'
                        }}>
                            {currencies.filter(c => c !== 'USD').map(curr => (
                                <div key={curr} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <div style={{
                                        width: '12px',
                                        height: '3px',
                                        background: currencyColors[curr] || '#6b7280',
                                        borderRadius: '2px'
                                    }} />
                                    <span style={{ fontSize: '0.75rem' }}>{curr}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                background: 'var(--gray-50)',
                borderRadius: '8px'
            }}>
                <Filter size={16} style={{ color: 'var(--gray-500)' }} />
                <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)', display: 'block' }}>Year</label>
                    <select
                        className="form-select"
                        value={filterYear}
                        onChange={e => setFilterYear(parseInt(e.target.value))}
                        style={{ minWidth: '100px' }}
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)', display: 'block' }}>Month</label>
                    <select
                        className="form-select"
                        value={filterMonth}
                        onChange={e => setFilterMonth(e.target.value)}
                        style={{ minWidth: '130px' }}
                    >
                        <option value="">All Months</option>
                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
            </div>

            {/* Data Table */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <DataTable
                        columns={columns}
                        data={rates}
                        searchable={false}
                        actions={(row) => (
                            <>
                                <button className="btn btn-secondary btn-sm" onClick={() => openModal(row)}>
                                    <Edit2 size={14} />
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(row)}>
                                    <Trash2 size={14} />
                                </button>
                            </>
                        )}
                    />
                </div>
            </div>

            {/* Add/Edit Rate Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={selectedRate ? 'Edit Currency Rates' : 'Add Currency Rates'}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSubmit(onSubmit)} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </>
                }
            >
                <form>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Year</label>
                            <select
                                className="form-select"
                                {...register('year')}
                                disabled={!!selectedRate}
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Month</label>
                            <select
                                className="form-select"
                                {...register('month')}
                                disabled={!!selectedRate}
                            >
                                {months.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>

                    <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                        Enter the value of each currency for 1 USD
                    </p>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">USD (Base)</label>
                            <input type="number" step="0.01" className="form-input" {...register('USD')} value={1} disabled />
                        </div>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                        gap: '1rem'
                    }}>
                        {currencies.filter(c => c !== 'USD').map(curr => (
                            <div className="form-group" key={curr}>
                                <label className="form-label">{curr}</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="form-input"
                                    {...register(curr)}
                                    placeholder="0.00"
                                />
                            </div>
                        ))}
                    </div>
                </form>
            </Modal>

            {/* Add Currency Modal */}
            <Modal
                isOpen={isAddCurrencyModalOpen}
                onClose={() => setIsAddCurrencyModalOpen(false)}
                title="Add New Currency"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsAddCurrencyModalOpen(false)}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" onClick={handleAddCurrency}>
                            Add Currency
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label className="form-label">Currency Code</label>
                    <input
                        className="form-input"
                        placeholder="e.g., EUR, JPY, AUD"
                        value={newCurrencyCode}
                        onChange={e => setNewCurrencyCode(e.target.value.toUpperCase())}
                        maxLength={4}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.5rem' }}>
                        Enter the 3-letter currency code. This will add a new column to your Currency sheet.
                    </p>
                </div>
            </Modal>
        </div>
    );
}

export default CurrencyRates;
