import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Clock, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, Trash2, Save, Send, Eye, Pencil, Filter, MessageSquare, History, Users } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import { timesheetsApi, projectsApi, associatesApi, allocationsApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

// Helper to get week dates
const getWeekDates = (startDate) => {
    const dates = [];
    const start = new Date(startDate);
    // Adjust to Sunday
    const day = start.getDay();
    start.setDate(start.getDate() - day);

    for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        dates.push(date);
    }
    return dates;
};

const formatDate = (date) => {
    if (!date) return '';
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toISOString().split('T')[0];
    } catch (e) {
        return '';
    }
};

const getWeekStartDate = (dateStr) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return formatDate(d);
};

const formatDisplayDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getDayName = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
};

const getMonthAbbr = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short' });
};

function Timesheets() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [timesheets, setTimesheets] = useState([]);
    const [summaryTimesheets, setSummaryTimesheets] = useState([]);
    const [projects, setProjects] = useState([]);
    const [associates, setAssociates] = useState([]);
    const [allocations, setAllocations] = useState([]);
    const [userProjects, setUserProjects] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [submitType, setSubmitType] = useState(null); // 'save' or 'submit'
    const [activeTab, setActiveTab] = useState('my'); // 'my' or 'team'
    const [teamTimesheets, setTeamTimesheets] = useState([]);
    const [isApproving, setIsApproving] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [withdrawingPeriod, setWithdrawingPeriod] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectingGroup, setRejectingGroup] = useState(null);
    const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(true);
    const [modalAssociateName, setModalAssociateName] = useState('');
    const [filters, setFilters] = useState({
        associate_id: '',
        project_id: '',
        start_date: '',
        end_date: ''
    });
    const [modalComments, setModalComments] = useState('');
    const [viewingGroup, setViewingGroup] = useState(null);

    const location = useLocation();

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const tab = queryParams.get('tab');
        if (tab === 'team') {
            setActiveTab('team');
        }
    }, [location]);

    // Grid form state
    const [weekStart, setWeekStart] = useState(() => {
        const today = new Date();
        const day = today.getDay();
        today.setDate(today.getDate() - day);
        return today;
    });
    const [rows, setRows] = useState([]);
    const [viewBy, setViewBy] = useState('Period');
    const [modalReadOnly, setModalReadOnly] = useState(false);

    const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

    // Group flat timesheets into periods for the summary table
    const groupedTimesheets = useMemo(() => {
        const groups = {};
        timesheets.forEach(ts => {
            const periodStart = getWeekStartDate(ts.work_date);
            const key = `${ts.associate_id}_${periodStart}`;

            if (!groups[key]) {
                const start = new Date(periodStart);
                const end = new Date(periodStart);
                end.setDate(end.getDate() + 6);

                groups[key] = {
                    id: key,
                    associate_id: ts.associate_id,
                    associate_name: associates.find(a => a.associate_id === ts.associate_id)?.associate_name || ts.associate_id,
                    week_start: periodStart,
                    period: `${formatDisplayDate(start)} - ${formatDisplayDate(end)}`,
                    total_hours: 0,
                    status: ts.status,
                    entries: []
                };
            }

            groups[key].total_hours += ts.hours;
            groups[key].entries.push(ts);

            // Capture comments if any entry has them
            if (ts.comments && !groups[key].comments) {
                groups[key].comments = ts.comments;
            }

            // Priority for status: Submitted > Saved/Draft > Approved
            // If any entry is Submitted, the whole period shows as Submitted
            if (ts.status === 'Submitted' && groups[key].status !== 'Submitted') {
                groups[key].status = 'Submitted';
            }
        });
        return Object.values(groups);
    }, [timesheets, associates]);

    useEffect(() => {
        loadData();
    }, [filters]);

    // Reload user projects when week changes
    useEffect(() => {
        loadUserProjects();
    }, [weekStart, user?.associate_id]);

    const loadData = async () => {
        try {
            setLoading(true);
            // Fetch summary data (full year for selected associate or everyone) to ensure YTD/MTD is accurate
            const currentYear = new Date().getFullYear();
            const summaryFilters = {
                associate_id: filters.associate_id,
                start_date: `${currentYear}-01-01`,
                end_date: `${currentYear}-12-31`
            };

            const [tsRes, summaryTsRes, projRes, assocRes, allocRes] = await Promise.all([
                timesheetsApi.getAll(filters),
                timesheetsApi.getAll(summaryFilters),
                projectsApi.getAll(),
                associatesApi.getAll(),
                allocationsApi.getAll()
            ]);
            setTimesheets(tsRes.data);
            setSummaryTimesheets(summaryTsRes.data);
            setProjects(projRes.data);
            setAssociates(assocRes.data);
            setAllocations(allocRes.data);

            if (user?.role === 'Admin' || user?.role === 'Project Manager') {
                const teamRes = await timesheetsApi.getTeamTimesheets();
                setTeamTimesheets(teamRes.data);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Separate function to load user's allocated projects for the current week
    const loadUserProjects = async () => {
        // Standard time-off options that are always available
        const timeOffOptions = [
            { id: 'PTO', name: 'PTO - Paid Time Off', isTimeOff: true, isBillable: false },
            { id: 'HLDY', name: 'HLDY - Holiday', isTimeOff: true, isBillable: false }
        ];

        // Load user's allocated projects for the current week
        let projectOptions = [];

        try {
            // Use dashboard-view API which correctly returns the user's allocations
            const allocRes = await allocationsApi.getDashboardView(false); // false = include all, not just active
            const myAllocations = allocRes.data?.my_allocations || [];

            // Get current week start and end dates for filtering
            const weekStartDate = new Date(weekStart);
            const weekEndDate = new Date(weekStart);
            weekEndDate.setDate(weekEndDate.getDate() + 6);

            // Filter allocations that overlap with the current week
            const weekAllocations = myAllocations.filter(a => {

                // Parse allocation dates - handle various formats
                let allocStart = null;
                let allocEnd = null;

                if (a.start_date && a.start_date !== '') {
                    allocStart = new Date(a.start_date);
                    // Check if valid date
                    if (isNaN(allocStart.getTime())) allocStart = null;
                }

                if (a.end_date && a.end_date !== '') {
                    allocEnd = new Date(a.end_date);
                    // Check if valid date
                    if (isNaN(allocEnd.getTime())) allocEnd = null;
                }

                // Check if allocation overlaps with the week
                // Allocation overlaps if: allocStart <= weekEnd AND (allocEnd >= weekStart OR allocEnd is null)
                const startsBeforeWeekEnds = !allocStart || allocStart <= weekEndDate;
                const endsAfterWeekStarts = !allocEnd || allocEnd >= weekStartDate;

                const overlaps = startsBeforeWeekEnds && endsAfterWeekStarts;

                return overlaps;
            });

            // Map to project format
            const activeProjects = weekAllocations.map(a => ({
                id: a.project_id,
                name: `${a.project_id} - ${a.project_name || a.project_id}`,
                isTimeOff: false,
                isBillable: a.allocation_type === 'Billable'
            }));

            // Remove duplicates
            projectOptions = activeProjects.filter((p, i, arr) =>
                arr.findIndex(x => x.id === p.id) === i
            );
        } catch (allocError) {
            console.error('Error loading user allocations:', allocError);
        }

        // If no allocations found for this week, show message
        if (projectOptions.length === 0) {
            // No allocations found for this week
        }

        // Always combine projects + time-off options (ensure time-off is always available)
        setUserProjects([...projectOptions, ...timeOffOptions]);
    };

    const openModal = () => {
        // Always reset to current week when clicking Log Time
        const today = new Date();
        const day = today.getDay();
        today.setDate(today.getDate() - day);
        const currentWeekStart = today;
        setWeekStart(currentWeekStart);

        const periodStart = formatDate(currentWeekStart);
        const existing = groupedTimesheets.find(g =>
            g.associate_id === user?.associate_id &&
            g.week_start === periodStart
        );

        if (existing) {
            if (existing.status === 'Submitted' || existing.status === 'Approved') {
                handleView(existing);
                return;
            } else {
                handleEdit(existing);
                return;
            }
        }

        setModalReadOnly(false);
        setModalAssociateName(user?.name || '');
        setModalComments('');
        const defaultProject = userProjects.length > 0 ? userProjects[0].id : '';
        setRows([{
            id: Date.now(),
            timeCode: defaultProject,
            details: '',
            hours: getWeekDates(currentWeekStart).reduce((acc, date) => {
                acc[formatDate(date)] = '';
                return acc;
            }, {})
        }]);
        setIsModalOpen(true);
    };

    const addRow = () => {
        const defaultProject = userProjects.length > 0 ? userProjects[0].id : '';
        setRows([...rows, {
            id: Date.now(),
            timeCode: defaultProject,
            details: '',
            hours: weekDates.reduce((acc, date) => {
                acc[formatDate(date)] = '';
                return acc;
            }, {})
        }]);
    };

    const removeRow = (rowId) => {
        if (rows.length > 1) {
            setRows(rows.filter(r => r.id !== rowId));
        }
    };

    const updateRowTimeCode = (rowId, code) => {
        setRows(rows.map(r => r.id === rowId ? { ...r, timeCode: code } : r));
    };

    const updateRowHours = (rowId, dateStr, value) => {
        const numValue = value === '' ? '' : Math.max(0, Math.min(24, parseFloat(value) || 0));
        setRows(rows.map(r => {
            if (r.id === rowId) {
                return {
                    ...r,
                    hours: { ...r.hours, [dateStr]: numValue }
                };
            }
            return r;
        }));
    };

    const updateRowDetails = (rowId, details) => {
        setRows(rows.map(r => r.id === rowId ? { ...r, details } : r));
    };

    const getRowTotal = (row) => {
        return Object.values(row.hours).reduce((sum, h) => sum + (parseFloat(h) || 0), 0);
    };

    const getDayTotal = (dateStr) => {
        return rows.reduce((sum, row) => sum + (parseFloat(row.hours[dateStr]) || 0), 0);
    };

    const getGrandTotal = () => {
        return rows.reduce((sum, row) => sum + getRowTotal(row), 0);
    };

    const navigateWeek = (direction) => {
        const newStart = new Date(weekStart);
        newStart.setDate(newStart.getDate() + (direction * 7));
        const newStartStr = formatDate(newStart);

        // Update the state for the next render
        setWeekStart(newStart);

        // Check if there's already an entry for this week to toggle View/Edit/New mode
        const existing = groupedTimesheets.find(g =>
            g.associate_id === user?.associate_id &&
            g.week_start === newStartStr
        );

        if (existing) {
            // Apply existing data
            const isReadOnly = existing.status === 'Submitted' || existing.status === 'Approved';
            setModalReadOnly(isReadOnly);
            setModalComments(existing.comments || '');

            const rowsByTask = {};
            existing.entries.forEach(ts => {
                const rowKey = ts.project_id + (ts.task || '');
                if (!rowsByTask[rowKey]) {
                    rowsByTask[rowKey] = {
                        id: Date.now() + Math.random(),
                        timeCode: ts.project_id,
                        details: ts.task || '',
                        hours: getWeekDates(newStart).reduce((acc, date) => {
                            acc[formatDate(date)] = '';
                            return acc;
                        }, {})
                    };
                }
                rowsByTask[rowKey].hours[ts.work_date] = ts.hours;
            });
            setRows(Object.values(rowsByTask));
        } else {
            // New week entry
            setModalReadOnly(false);
            setModalComments('');
            const defaultProject = userProjects.length > 0 ? userProjects[0].id : '';
            setRows([{
                id: Date.now(),
                timeCode: defaultProject,
                details: '',
                hours: getWeekDates(newStart).reduce((acc, date) => {
                    acc[formatDate(date)] = '';
                    return acc;
                }, {})
            }]);
        }
    };

    const handleWithdraw = (period) => {
        setWithdrawingPeriod(period);
        setIsWithdrawModalOpen(true);
    };

    const confirmWithdraw = async () => {
        if (!withdrawingPeriod) return;
        setSaving(true);
        try {
            const rowIndices = withdrawingPeriod.entries.map(e => e.row_index);
            await timesheetsApi.bulkUpdateStatus(rowIndices, 'Saved');
            await loadData();
            setIsWithdrawModalOpen(false);
            setWithdrawingPeriod(null);
        } catch (error) {
            console.error('Error withdrawing timesheet:', error);
            showToast('Error withdrawing timesheet', 'error', 10000);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (period) => {
        setModalReadOnly(false);
        setModalAssociateName(period.associate_name);
        setModalComments(period.comments || '');
        // Set week start to this period's start
        setWeekStart(new Date(period.week_start));

        // Build rows from entries
        const rowsByTask = {};
        period.entries.forEach(ts => {
            const rowKey = ts.project_id + (ts.task || '');
            if (!rowsByTask[rowKey]) {
                rowsByTask[rowKey] = {
                    id: Date.now() + Math.random(),
                    timeCode: ts.project_id,
                    details: ts.task || '',
                    hours: getWeekDates(period.week_start).reduce((acc, date) => {
                        acc[formatDate(date)] = '';
                        return acc;
                    }, {})
                };
            }
            rowsByTask[rowKey].hours[ts.work_date] = ts.hours;
        });

        setRows(Object.values(rowsByTask));
        setIsModalOpen(true);
    };

    const handleView = (period) => {
        setViewingGroup(period);
        setModalReadOnly(true);
        setModalAssociateName(period.associate_name);
        setModalComments(period.comments || '');
        // Set week start to this period's start
        setWeekStart(new Date(period.week_start));

        // Build rows from entries
        const rowsByTask = {};
        period.entries.forEach(ts => {
            const rowKey = ts.project_id + (ts.task || '');
            if (!rowsByTask[rowKey]) {
                rowsByTask[rowKey] = {
                    id: Date.now() + Math.random(),
                    timeCode: ts.project_id,
                    details: ts.task || '',
                    hours: getWeekDates(period.week_start).reduce((acc, date) => {
                        acc[formatDate(date)] = '';
                        return acc;
                    }, {})
                };
            }
            rowsByTask[rowKey].hours[ts.work_date] = ts.hours;
        });

        setRows(Object.values(rowsByTask));
        setIsModalOpen(true);
    };

    const onSubmit = async (saveOnly = false) => {
        setSaving(true);
        setSubmitType(saveOnly ? 'save' : 'submit');
        try {
            // If we are editing an existing period, we should really delete and re-insert
            // but the current backend is row-oriented.
            // For now, let's keep it simple and just insert (duplicate entries risk).
            // Actually, better: if this user-period has existing entries, warn or delete.

            const periodStart = formatDate(weekDates[0]);
            const existingEntries = timesheets.filter(ts =>
                ts.associate_id === user?.associate_id &&
                getWeekStartDate(ts.work_date) === periodStart
            );

            if (existingEntries.length > 0) {
                // Delete existing rows first to effectively "update"
                // IMPORTANT: Delete in descending order of row_index to avoid shifting indices
                const sortedForDeletion = [...existingEntries].sort((a, b) => b.row_index - a.row_index);
                for (const ts of sortedForDeletion) {
                    await timesheetsApi.delete(ts.row_index);
                }
            }

            // Create timesheet entries for each row and day with hours > 0
            const now = new Date();
            const dayStr = String(now.getDate()).padStart(2, '0');
            const monthStr = now.toLocaleString('en-GB', { month: 'short' });
            const yearStr = now.getFullYear();
            const timeStr = now.toTimeString().split(' ')[0];
            const timestamp = `${dayStr}-${monthStr}-${yearStr} ${timeStr}`;

            const userDisplayName = user?.name || user?.associate_id || 'User';
            let updatedComments = modalComments || '';

            if (!saveOnly) {
                const submissionEntry = `${timestamp} ${userDisplayName} Submitted`;
                updatedComments = updatedComments ? `${updatedComments}\n${submissionEntry}` : submissionEntry;
            }

            const entries = [];
            for (const row of rows) {
                for (const [dateStr, hours] of Object.entries(row.hours)) {
                    if (hours && parseFloat(hours) > 0) {
                        entries.push({
                            work_date: dateStr,
                            associate_id: user?.associate_id || '',
                            project_id: row.timeCode,
                            task: row.details,
                            hours: parseFloat(hours),
                            status: saveOnly ? 'Saved' : 'Submitted',
                            comments: updatedComments
                        });
                    }
                }
            }

            if (entries.length === 0) {
                showToast('Please enter at least one hour value', 'warning', 10000);
                setSaving(false);
                setSubmitType(null);
                return;
            }

            // Save entries in bulk
            if (entries.length > 0) {
                await timesheetsApi.bulkCreate(entries);
            }

            showToast(`Timesheet ${saveOnly ? 'saved' : 'submitted'} successfully!`, 'success', 10000);
            await loadData();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving timesheet:', error);
            showToast(error.response?.data?.detail || 'Error saving timesheet', 'error', 10000);
        } finally {
            setSaving(false);
            setSubmitType(null);
        }
    };

    const handleBulkStatus = async (group, status) => {
        if (status === 'Rejected') {
            setRejectingGroup(group);
            setRejectReason('');
            setIsRejectModalOpen(true);
            return;
        }

        setIsApproving(true);
        try {
            const rowIndices = group.entries.map(e => e.row_index);
            await timesheetsApi.bulkUpdateStatus(rowIndices, status);
            showToast(`Timesheet ${status.toLowerCase()} successfully`, 'success', 10000);
            await loadData(); // Refresh both views
            setIsModalOpen(false); // Close main modal
        } catch (error) {
            console.error(`Error updating status to ${status}:`, error);
        } finally {
            setIsApproving(false);
        }
    };

    const handleRejectConfirm = async () => {
        if (!rejectReason.trim()) {
            alert('Please provide a reason for rejection');
            return;
        }

        setIsApproving(true);
        try {
            const rowIndices = rejectingGroup.entries.map(e => e.row_index);
            await timesheetsApi.bulkUpdateStatus(rowIndices, 'Rejected', rejectReason);
            showToast('Timesheet rejected successfully', 'success', 10000);
            await loadData();
            setIsRejectModalOpen(false);
            setIsModalOpen(false); // Close main modal
            setRejectingGroup(null);
            setRejectReason('');
        } catch (error) {
            console.error('Error rejecting timesheet:', error);
            showToast('Failed to reject timesheet', 'error', 10000);
        } finally {
            setIsApproving(false);
        }
    };

    const teamColumns = [
        { key: 'associate_name', label: 'Associate' },
        { key: 'project_name', label: 'Project' },
        { key: 'period', label: 'Period' },
        {
            key: 'total_hours',
            label: 'Total Hours',
            render: (value) => `${value}h`
        },
        {
            key: 'status',
            label: 'Status',
            render: (value) => {
                let badgeClass = 'badge-gray';
                if (value === 'Submitted') badgeClass = 'badge-info';
                if (value === 'Approved') badgeClass = 'badge-success';
                if (value === 'Rejected') badgeClass = 'badge-error';

                return (
                    <span className={`badge ${badgeClass}`}>
                        {value}
                    </span>
                );
            }
        }
    ];

    const groupedTeamTimesheets = useMemo(() => {
        const groups = {};
        teamTimesheets.forEach(ts => {
            const periodStart = getWeekStartDate(ts.work_date);
            const key = `${ts.associate_id}_${ts.project_id}_${periodStart}`;
            if (!groups[key]) {
                const assoc = associates.find(a => a.associate_id === ts.associate_id);
                const proj = projects.find(p => p.project_id === ts.project_id);
                const start = new Date(periodStart);
                const end = new Date(periodStart);
                end.setDate(end.getDate() + 6);

                groups[key] = {
                    id: key,
                    associate_id: ts.associate_id,
                    associate_name: assoc?.associate_name || ts.associate_id,
                    project_id: ts.project_id,
                    project_name: proj?.project_name || ts.project_id,
                    week_start: periodStart,
                    period: `${formatDisplayDate(start)} - ${formatDisplayDate(end)}`,
                    status: ts.status,
                    total_hours: 0,
                    entries: []
                };
            }
            groups[key].total_hours += ts.hours;
            groups[key].entries.push(ts);

            // Capture comments if any entry has them
            if (ts.comments && !groups[key].comments) {
                groups[key].comments = ts.comments;
            }
        });
        return Object.values(groups).sort((a, b) => b.period.localeCompare(a.period));
    }, [teamTimesheets, associates, projects]);

    const columns = [
        { key: 'associate_name', label: 'Associate' },
        { key: 'period', label: 'Period' },
        {
            key: 'total_hours',
            label: 'Total Hours',
            render: (value) => `${value}h`
        },
        {
            key: 'status',
            label: 'Status',
            render: (value) => {
                let badgeClass = 'badge-info';
                if (value === 'Approved') badgeClass = 'badge-success';
                if (value === 'Saved' || value === 'Draft') badgeClass = 'badge-gray';
                if (value === 'Rejected') badgeClass = 'badge-error';

                return (
                    <span className={`badge ${badgeClass}`}>
                        {value}
                    </span>
                );
            }
        }
    ];

    // Calculate summaries (MTD, YTD)
    const summaryStats = useMemo(() => {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const mtdStart = new Date(currentYear, currentMonth, 1);
        const ytdStart = new Date(currentYear, 0, 1);

        const stats = {
            mtd: { total: 0, billable: 0 },
            ytd: { total: 0, billable: 0 }
        };

        summaryTimesheets.forEach(ts => {
            const workDate = new Date(ts.work_date);
            const hours = ts.hours || 0;

            // Determine billability
            const timeOffIds = ['PTO', 'HLDY', 'HOLIDAY'];
            let isBillable = false;

            if (!timeOffIds.includes(ts.project_id)) {
                const alloc = allocations.find(a => {
                    if (a.associate_id !== ts.associate_id || a.project_id !== ts.project_id) return false;
                    const start = a.start_date ? new Date(a.start_date) : null;
                    const end = a.end_date ? new Date(a.end_date) : null;
                    const afterStart = !start || isNaN(start.getTime()) || workDate >= start;
                    const beforeEnd = !end || isNaN(end.getTime()) || workDate <= end;
                    return afterStart && beforeEnd;
                });
                isBillable = alloc ? (alloc.allocation_type || "").toLowerCase().trim() === 'billable' : false;
            }

            const billableHours = isBillable ? hours : 0;

            // Check MTD
            if (workDate >= mtdStart) {
                stats.mtd.total += hours;
                stats.mtd.billable += billableHours;
            }

            // Check YTD (already filtered by year in API, but for safety)
            if (workDate >= ytdStart) {
                stats.ytd.total += hours;
                stats.ytd.billable += billableHours;
            }
        });

        // Calculate Pending Submissions since earliest allocation
        let pendingSubmissions = 0;
        const myAllocations = allocations.filter(a => a.associate_id === user?.associate_id);
        let earliestDate = null;
        myAllocations.forEach(a => {
            if (a.start_date) {
                const d = new Date(a.start_date);
                if (!isNaN(d.getTime()) && (!earliestDate || d < earliestDate)) {
                    earliestDate = d;
                }
            }
        });

        if (earliestDate) {
            const startSun = new Date(earliestDate);
            startSun.setDate(startSun.getDate() - startSun.getDay());
            startSun.setHours(0, 0, 0, 0);

            const todaySun = new Date();
            todaySun.setDate(todaySun.getDate() - todaySun.getDay());
            todaySun.setHours(0, 0, 0, 0);

            let currentWeekSun = new Date(startSun);
            while (currentWeekSun < todaySun) {
                const weekStr = formatDate(currentWeekSun);
                const hasSubmission = summaryTimesheets.some(ts =>
                    ts.associate_id === user?.associate_id &&
                    getWeekStartDate(ts.work_date) === weekStr &&
                    (ts.status === 'Submitted' || ts.status === 'Approved')
                );

                if (!hasSubmission) {
                    pendingSubmissions++;
                }
                currentWeekSun.setDate(currentWeekSun.getDate() + 7);
            }
        }

        return { ...stats, pendingSubmissions };
    }, [summaryTimesheets, allocations, user?.associate_id]);

    if (loading) return <Loading />;

    // Format week range for display
    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekRangeText = `${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${weekEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Timesheets</h1>
                    <p className="page-subtitle">Track time spent on projects</p>
                </div>
                <button className="btn btn-primary" onClick={openModal}>
                    <Plus size={18} />
                    Log Time
                </button>
            </div>

            {/* Tabs */}
            {(user?.role === 'Admin' || user?.role === 'Project Manager') && (
                <div className="tabs-container">
                    <button
                        className={`tab-btn ${activeTab === 'my' ? 'active' : ''}`}
                        onClick={() => setActiveTab('my')}
                    >
                        <Clock size={18} className="tab-icon transition-all duration-200" />
                        My Timesheets
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
                        onClick={() => setActiveTab('team')}
                    >
                        <Users size={18} className="tab-icon transition-all duration-200" />
                        Team Approvals
                        {groupedTeamTimesheets.filter(g => g.status === 'Submitted').length > 0 && (
                            <span className="tab-badge">
                                {groupedTeamTimesheets.filter(g => g.status === 'Submitted').length}
                            </span>
                        )}
                    </button>
                </div>
            )}

            {activeTab === 'my' ? (
                <>
                    {/* Summary Cards */}
                    <div className="stats-grid summary-grid">
                        {/* Total Hours Card */}
                        <div className="stat-card mixed">
                            <div className="stat-card-icon blue">
                                <Clock size={20} />
                            </div>
                            <div className="stat-card-content">
                                <div className="stat-card-label">Total Hours</div>
                                <div className="stat-card-values">
                                    <div className="value-item">
                                        <span className="value-label">MTD</span>
                                        <span className="value-num">{summaryStats.mtd.total}h</span>
                                    </div>
                                    <div className="divider"></div>
                                    <div className="value-item">
                                        <span className="value-label">YTD</span>
                                        <span className="value-num">{summaryStats.ytd.total}h</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Billable Hours Card */}
                        <div className="stat-card mixed">
                            <div className="stat-card-icon green">
                                <Clock size={20} />
                            </div>
                            <div className="stat-card-content">
                                <div className="stat-card-label">Billable Hours</div>
                                <div className="stat-card-values">
                                    <div className="value-item">
                                        <span className="value-label">MTD</span>
                                        <span className="value-num text-green">{summaryStats.mtd.billable}h</span>
                                    </div>
                                    <div className="divider"></div>
                                    <div className="value-item">
                                        <span className="value-label">YTD</span>
                                        <span className="value-num text-green">{summaryStats.ytd.billable}h</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Billable Rate Card */}
                        <div className="stat-card mixed">
                            <div className="stat-card-icon yellow">
                                <Clock size={20} />
                            </div>
                            <div className="stat-card-content">
                                <div className="stat-card-label">Billable Rate</div>
                                <div className="stat-card-values">
                                    <div className="value-item">
                                        <span className="value-label">MTD</span>
                                        <span className="value-num text-blue">
                                            {summaryStats.mtd.total > 0 ? ((summaryStats.mtd.billable / summaryStats.mtd.total) * 100).toFixed(0) : 0}%
                                        </span>
                                    </div>
                                    <div className="divider"></div>
                                    <div className="value-item">
                                        <span className="value-label">YTD</span>
                                        <span className="value-num text-blue">
                                            {summaryStats.ytd.total > 0 ? ((summaryStats.ytd.billable / summaryStats.ytd.total) * 100).toFixed(0) : 0}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pending Submissions Card */}
                        <div className="stat-card mixed">
                            <div className="stat-card-icon orange">
                                <AlertCircle size={20} />
                            </div>
                            <div className="stat-card-content">
                                <div className="stat-card-label">Pending Submissions</div>
                                <div className="stat-card-values">
                                    <div className="value-item">
                                        <span className="value-label">SINCE ALLOCATION</span>
                                        <span className={`value-num ${summaryStats.pendingSubmissions > 0 ? 'text-error' : 'text-green'}`}>
                                            {summaryStats.pendingSubmissions} Weeks
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="filter-bar">
                        <div className="filter-icon">
                            <Filter size={20} />
                        </div>
                        <div className="filter-group">
                            <label>Associate</label>
                            <select
                                value={filters.associate_id}
                                onChange={(e) => setFilters({ ...filters, associate_id: e.target.value })}
                            >
                                <option value="">All Associates</option>
                                {associates.map(a => (
                                    <option key={a.associate_id} value={a.associate_id}>{a.associate_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="filter-group">
                            <label>Start Date</label>
                            <input
                                type="date"
                                value={filters.start_date}
                                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                            />
                        </div>
                        <div className="filter-group">
                            <label>End Date</label>
                            <input
                                type="date"
                                value={filters.end_date}
                                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-body" style={{ padding: 0 }}>
                            <DataTable
                                columns={columns}
                                data={groupedTimesheets}
                                searchFields={['associate_name', 'period']}
                                actions={(row) => (
                                    <div className="flex gap-2">
                                        {(row.status === 'Saved' || row.status === 'Draft' || row.status === 'Rejected') ? (
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(row)} title="Edit">
                                                <Pencil size={16} />
                                            </button>
                                        ) : (
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleView(row)} title="View">
                                                <Eye size={16} />
                                            </button>
                                        )}
                                        {row.status === 'Submitted' && (
                                            <button className="btn btn-danger btn-sm" onClick={() => handleWithdraw(row)} title="Withdraw" disabled={isApproving}>
                                                Withdraw
                                            </button>
                                        )}
                                    </div>
                                )}
                            />
                        </div>
                    </div>
                </>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Pending Section */}
                    <div className="card">
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 className="card-title">Pending Approvals</h2>
                            <span className="badge badge-info" style={{ marginLeft: 'auto' }}>
                                {groupedTeamTimesheets.filter(g => g.status === 'Submitted').length} Pending
                            </span>
                        </div>
                        <div className="card-body" style={{ padding: 0 }}>
                            <DataTable
                                columns={teamColumns}
                                data={groupedTeamTimesheets.filter(g => g.status === 'Submitted')}
                                searchFields={['associate_name', 'project_name', 'period']}
                                actions={(row) => (
                                    <div className="flex gap-2">
                                        <button className="btn btn-secondary btn-sm" onClick={() => handleView(row)} title="View">
                                            <Eye size={16} />
                                        </button>
                                        {row.status === 'Submitted' && (
                                            <>
                                                <button
                                                    className="btn btn-success btn-sm"
                                                    onClick={() => handleBulkStatus(row, 'Approved')}
                                                    disabled={isApproving}
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => handleBulkStatus(row, 'Rejected')}
                                                    disabled={isApproving}
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            />
                        </div>
                    </div>

                    {/* Completed Section */}
                    <div className="card">
                        <div
                            className="card-header"
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                                borderBottom: isCompletedCollapsed ? 'none' : '1px solid var(--border-primary)'
                            }}
                            onClick={() => setIsCompletedCollapsed(!isCompletedCollapsed)}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {isCompletedCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
                                <h2 className="card-title">Recently Completed</h2>
                                <span className="badge badge-gray" style={{ background: '#f1f5f9', color: '#64748b' }}>
                                    {groupedTeamTimesheets.filter(g => g.status !== 'Submitted').length}
                                </span>
                            </div>
                            <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                                {isCompletedCollapsed ? 'Show' : 'Hide'}
                            </span>
                        </div>
                        {!isCompletedCollapsed && (
                            <div className="card-body" style={{ padding: 0 }}>
                                <DataTable
                                    columns={teamColumns}
                                    data={groupedTeamTimesheets.filter(g => g.status !== 'Submitted')}
                                    searchFields={['associate_name', 'project_name', 'period']}
                                    actions={(row) => (
                                        <div className="flex gap-2">
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleView(row)} title="View">
                                                <Eye size={16} />
                                            </button>
                                        </div>
                                    )}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Timesheet Entry Modal - Grid Layout */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalReadOnly ? 'View Timesheet' : 'Enter Time'}
                size="xl"
                footer={
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        {!modalReadOnly && (
                            <>
                                <button className="btn btn-secondary" onClick={() => onSubmit(true)} disabled={saving}>
                                    <Save size={16} />
                                    {saving && submitType === 'save' ? 'Saving...' : 'Save for Later'}
                                </button>
                                <button className="btn btn-primary" onClick={() => onSubmit(false)} disabled={saving}>
                                    <Send size={16} />
                                    {saving && submitType === 'submit' ? 'Submitting...' : 'Submit'}
                                </button>
                            </>
                        )}
                        {modalReadOnly && viewingGroup?.status === 'Submitted' && activeTab === 'team' && (
                            <>
                                <button
                                    className="btn btn-danger"
                                    onClick={() => {
                                        setRejectingGroup(viewingGroup);
                                        setIsRejectModalOpen(true);
                                    }}
                                    disabled={isApproving}
                                >
                                    Reject
                                </button>
                                <button
                                    className="btn btn-premium-add" // Using the premium-add (green) style
                                    onClick={() => handleBulkStatus(viewingGroup, 'Approved')}
                                    disabled={isApproving}
                                >
                                    {isApproving ? 'Approving...' : 'Approve'}
                                </button>
                            </>
                        )}
                    </div>
                }
            >
                <div className="timesheet-grid-form">
                    {/* Header Info */}
                    <div className="timesheet-header">
                        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="timesheet-user-info">
                                <span className="label">Associate:</span>
                                <span className="value">{modalAssociateName || (user?.name || 'Current User')}</span>
                            </div>
                            <div className="timesheet-period-nav">
                                <button className="btn btn-icon" onClick={() => navigateWeek(-1)}>
                                    <ChevronLeft size={18} />
                                </button>
                                <span className="period-text">{weekRangeText}</span>
                                <button className="btn btn-icon" onClick={() => navigateWeek(1)}>
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>

                        {modalComments && (
                            <div className="history-section">
                                <div className="history-header">
                                    <History size={18} className="text-accent" />
                                    <h4 className="history-title">Activity & Comment History</h4>
                                </div>
                                <div className="history-timeline">
                                    {modalComments.split('\n').filter(line => line.trim()).map((line, i) => {
                                        // Standardized pattern: <dd-mmm-yyyy hh:MM:ss> <user> <status> <comments>
                                        // Robust regex to capture timestamp (handles both - and space separators), 
                                        // then the rest until the status (handles optional colon).
                                        const match = line.match(/^(\d{2}[- ](?:[A-Za-z]{3})[- ]\d{4}\s\d{2}:\d{2}:\d{2})\s+(.+?)\s+(Submitted|Approved|Rejected)(?::)?(?:\s+(.*))?$/);

                                        if (match) {
                                            const [_, timestamp, name, action, message] = match;

                                            let actionClass = 'status-default';
                                            if (action.includes('Rejected')) actionClass = 'status-danger';
                                            if (action.includes('Approved')) actionClass = 'status-success';
                                            if (action.includes('Submitted')) actionClass = 'status-info';

                                            return (
                                                <div key={i} className="timeline-item">
                                                    <div className="timeline-marker"></div>
                                                    <div className="timeline-content">
                                                        <div className="timeline-header-row">
                                                            <div className="timeline-timestamp">{timestamp}</div>
                                                            <div className={`status-pill ${actionClass}`}>
                                                                <span className="pill-user">{name}</span>
                                                                <span className="pill-status">{action}</span>
                                                            </div>
                                                        </div>
                                                        {message && (
                                                            <div className="timeline-message-container">
                                                                <MessageSquare size={14} className="message-icon" />
                                                                <p className="timeline-message">{message}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={i} className="timeline-item fallback">
                                                <div className="timeline-marker"></div>
                                                <div className="timeline-content">
                                                    <p className="fallback-text">{line}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Totals Bar */}
                    <div className="timesheet-totals-bar">
                        <div className="total-item">
                            <span className="label">Scheduled:</span>
                            <span className="value">40.00</span>
                        </div>
                        <div className="total-item">
                            <span className="label">Reported:</span>
                            <span className="value">{getGrandTotal().toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Grid Table */}
                    <div className="timesheet-grid-container">
                        <table className="timesheet-grid-table">
                            <thead>
                                <tr>
                                    <th className="col-timecode">Time Reporting Code</th>
                                    <th className="col-details">Task</th>
                                    {weekDates.map(date => (
                                        <th key={formatDate(date)} className="col-day">
                                            <div className="day-header">
                                                <span className="day-name">{getDayName(date)}</span>
                                                <span className="day-date">{getMonthAbbr(date)} {date.getDate()}</span>
                                            </div>
                                        </th>
                                    ))}
                                    <th className="col-rowtotal">Row Totals</th>
                                    <th className="col-actions"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id}>
                                        <td className="col-timecode">
                                            <select
                                                className="timecode-select"
                                                value={row.timeCode}
                                                onChange={(e) => updateRowTimeCode(row.id, e.target.value)}
                                                disabled={modalReadOnly}
                                            >
                                                {userProjects.length === 0 && (
                                                    <option value="">No projects allocated</option>
                                                )}
                                                {userProjects.map(proj => (
                                                    <option key={proj.id} value={proj.id}>{proj.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="col-details">
                                            <input
                                                type="text"
                                                className="details-input"
                                                value={row.details || ''}
                                                onChange={(e) => updateRowDetails(row.id, e.target.value)}
                                                placeholder="Enter task details..."
                                                disabled={modalReadOnly}
                                            />
                                        </td>
                                        {weekDates.map(date => {
                                            const dateStr = formatDate(date);
                                            const dayTotal = getDayTotal(dateStr);
                                            const isFullDay = dayTotal >= 8;
                                            return (
                                                <td key={dateStr} className={`col-day ${isFullDay ? 'full-day' : ''}`}>
                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        min="0"
                                                        max="24"
                                                        className={`hours-input ${isFullDay ? 'hours-full' : ''}`}
                                                        value={row.hours[dateStr]}
                                                        onChange={(e) => updateRowHours(row.id, dateStr, e.target.value)}
                                                        placeholder=""
                                                        disabled={modalReadOnly}
                                                    />
                                                </td>
                                            );
                                        })}
                                        <td className="col-rowtotal">
                                            <span className="row-total-value">{getRowTotal(row).toFixed(2)}</span>
                                        </td>
                                        <td className="col-actions">
                                            {!modalReadOnly && (
                                                <button className="btn-action remove" onClick={() => removeRow(row.id)} title="Remove Row">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {!modalReadOnly && (
                        <div className="table-footer-actions">
                            <button className="btn-premium-add" onClick={addRow}>
                                <Plus size={16} />
                                Add Row
                            </button>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Rejection Reason Modal */}
            <Modal
                isOpen={isRejectModalOpen}
                onClose={() => setIsRejectModalOpen(false)}
                title="Reason for Rejection"
                size="md"
                footer={
                    <div className="flex gap-2 justify-end">
                        <button className="btn btn-secondary" onClick={() => setIsRejectModalOpen(false)}>
                            Cancel
                        </button>
                        <button
                            className="btn btn-danger"
                            onClick={handleRejectConfirm}
                            disabled={isApproving || !rejectReason.trim()}
                        >
                            {isApproving ? 'Rejecting...' : 'Confirm Rejection'}
                        </button>
                    </div>
                }
            >
                <div className="p-4">
                    <p className="mb-4 text-secondary">
                        Please provide a reason for rejecting the timesheet for <strong>{rejectingGroup?.associate_name}</strong>.
                        This reason will be sent to the associate to help them correct the entries.
                    </p>
                    <div className="form-group">
                        <label className="form-label">Rejection Reason</label>
                        <textarea
                            className="form-input"
                            rows="4"
                            placeholder="e.g. Total hours do not match allocation, incorrect project selected, etc."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            autoFocus
                        ></textarea>
                    </div>
                </div>
            </Modal>

            {/* Withdraw Confirmation Modal */}
            <Modal
                isOpen={isWithdrawModalOpen}
                onClose={() => setIsWithdrawModalOpen(false)}
                title="Withdraw Timesheet"
                size="md"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setIsWithdrawModalOpen(false)}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={confirmWithdraw}
                            disabled={saving}
                        >
                            {saving ? 'Withdrawing...' : 'Confirm'}
                        </button>
                    </div>
                }
            >
                <div>
                    <p>Are you sure you want to withdraw this timesheet? It will be changed to "Saved" status and become editable.</p>
                </div>
            </Modal>

            <style>{`
                /* Blue header for Enter Time modal */
                .modal-xl .modal-header {
                    background: linear-gradient(135deg, #3B5998, #4a69bd) !important;
                    color: white !important;
                    border-radius: 8px 8px 0 0 !important;
                    border-bottom: none !important;
                    margin: 0 !important;
                    padding: 1rem 1.5rem !important;
                    min-height: 56px !important;
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    box-sizing: border-box !important;
                }

                .modal-xl .modal-header h2,
                .modal-xl .modal-header .modal-title {
                    color: white !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    font-size: 1.25rem !important;
                    font-weight: 600 !important;
                    line-height: 1 !important;
                    letter-spacing: -0.01em !important;
                }

                .modal-xl .modal-header .modal-close {
                    color: white !important;
                    opacity: 0.85;
                    background: rgba(255, 255, 255, 0.1) !important;
                    border: none !important;
                    border-radius: 6px !important;
                    padding: 0.375rem !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    margin: 0 !important;
                }

                .modal-xl .modal-header .modal-close:hover {
                    opacity: 1;
                    background: rgba(255, 255, 255, 0.2) !important;
                }

                .timesheet-grid-form {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .history-section {
                    width: 100%;
                    padding: 1.25rem;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    margin-top: 0.5rem;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }

                .history-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1.25rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid #e2e8f0;
                }

                .history-title {
                    font-size: 0.9375rem;
                    font-weight: 700;
                    color: #1e293b;
                    margin: 0;
                    letter-spacing: -0.01em;
                }

                .history-timeline {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .history-timeline::before {
                    content: '';
                    position: absolute;
                    left: 7px;
                    top: 5px;
                    bottom: 5px;
                    width: 2px;
                    background: #e2e8f0;
                }

                .timeline-item {
                    position: relative;
                    padding-left: 2rem;
                }

                .timeline-marker {
                    position: absolute;
                    left: 0;
                    top: 6px;
                    width: 16px;
                    height: 16px;
                    background: white;
                    border: 3px solid var(--accent);
                    border-radius: 50%;
                    z-index: 1;
                    box-shadow: 0 0 0 4px #f8fafc;
                }

                .timeline-header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                }

                .timeline-timestamp {
                    font-size: 0.75rem;
                    color: #64748b;
                    font-family: inherit;
                    font-weight: 500;
                }

                .status-pill {
                    display: inline-flex;
                    align-items: center;
                    border-radius: 100px;
                    overflow: hidden;
                    font-size: 0.65rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.08);
                    white-space: nowrap;
                    border: 1px solid #e2e8f0;
                }

                .pill-user {
                    padding: 4px 10px;
                    background: #f8fafc;
                    color: #64748b;
                    border-right: 1px solid #e2e8f0;
                }

                .pill-status {
                    padding: 4px 10px;
                }

                .status-pill.status-info {
                    border-color: #93c5fd;
                }
                .status-pill.status-info .pill-status {
                    background: #dbeafe;
                    color: #1e40af;
                }

                .status-pill.status-success {
                    border-color: #86efac;
                }
                .status-pill.status-success .pill-status {
                    background: #dcfce7;
                    color: #166534;
                }

                .status-pill.status-danger {
                    border-color: #fca5a5;
                }
                .status-pill.status-danger .pill-status {
                    background: #fee2e2;
                    color: #991b1b;
                }

                .status-pill.status-default {
                    border-color: #e2e8f0;
                }
                .status-pill.status-default .pill-status {
                    background: #f1f5f9;
                    color: #475569;
                }

                .timeline-message-container {
                    display: flex;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    background: white;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
                }

                .message-icon {
                    color: #94a3b8;
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                .timeline-message {
                    font-size: 0.8125rem;
                    color: #334155;
                    line-height: 1.6;
                    margin: 0;
                    white-space: pre-wrap;
                }

                .fallback-text {
                    font-size: 0.8125rem;
                    color: #64748b;
                    margin: 0;
                }

            .timesheet-header {
                display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 1rem;
            background: var(--surface-secondary);
            border-radius: 8px;
            flex-wrap: wrap;
            gap: 0.5rem;
                }

            .timesheet-user-info {
                display: flex;
            align-items: center;
            gap: 0.5rem;
                }

            .timesheet-user-info .label {
                color: var(--text-secondary);
            font-size: 0.875rem;
            padding-left: 0.5rem;
                }

            .timesheet-user-info .value {
                font - weight: 600;
            color: var(--text-primary);
                }

            .timesheet-period-nav {
                display: flex;
            align-items: center;
            gap: 0.75rem;
                }

            .btn-icon {
                padding: 0.375rem;
            border-radius: 4px;
            background: var(--surface-primary);
            border: 1px solid var(--border-primary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
                }

            .btn-icon:hover {
                background: var(--accent);
            color: white;
            border-color: var(--accent);
                }

            .period-text {
                font - size: 0.875rem;
            font-weight: 500;
            white-space: nowrap;
                }

            .timesheet-totals-bar {
                display: flex;
            gap: 2rem;
            padding: 0.5rem 1rem;
            background: linear-gradient(135deg, var(--accent-light), var(--surface-secondary));
            border-radius: 8px;
            border-left: 3px solid var(--accent);
                }

            .total-item {
                display: flex;
            align-items: center;
            gap: 0.5rem;
                }

            .total-item .label {
                font - size: 0.875rem;
            color: var(--text-secondary);
            padding-left: 0.5rem;
                }

            .total-item .value {
                font - weight: 700;
                font-weight: 700;
            font-size: 1rem;
            color: var(--accent);
                }

            .timesheet-grid-container {
                overflow-x: auto;
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            }

            .timesheet-grid-table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                font-size: 0.8125rem;
                min-width: 1000px;
            }

            .timesheet-grid-table thead th {
                background: #334155;
                color: #f8fafc;
                font-weight: 600;
                padding: 1rem 0.75rem;
                text-align: center;
                border-bottom: 2px solid #1e293b;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                font-size: 0.7rem;
            }

            .timesheet-grid-table thead th:first-child {
                text-align: left;
                padding-left: 1.5rem;
            }

            .timesheet-grid-table td {
                padding: 0.75rem 0.5rem;
                border-bottom: 1px solid #f1f5f9;
                vertical-align: middle;
            }

            .timesheet-grid-table tr:last-child td {
                border-bottom: none;
            }

            .timesheet-grid-table tr:hover td {
                background-color: #f8fafc;
            }

            .col-actions {
                width: 60px;
            }

            .col-timecode {
                width: 220px;
                padding-left: 1.5rem !important;
            }

            .col-details {
                width: 240px;
            }

            .col-rowtotal {
                width: 90px;
                font-weight: 700;
                color: #334155;
                background: #f8fafc;
            }

            .col-day {
                width: 75px;
            }

            .day-header {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
            }

            .day-name {
                font-size: 0.75rem;
                font-weight: 700;
            }

            .day-date {
                font-size: 0.65rem;
                opacity: 0.8;
                font-weight: 400;
            }

            .day-totals-row th {
                font-size: 0.75rem;
            color: var(--text-secondary);
            font-weight: 500;
            background: rgba(var(--accent-rgb), 0.05);
                }

            .day-total {
                color: var(--accent) !important;
            font-weight: 600 !important;
                }

            /* Full day (8 hours) highlighting */
            .col-day.full-day {
                background-color: #f0fdf4 !important;
                }

            .hours-input.hours-full {
                border-color: #86efac;
                color: #166534;
                background-color: #dcfce7;
            }

            .row-actions {
                display: flex;
            gap: 0.25rem;
            justify-content: center;
                }

            .btn-action {
                width: 28px;
                height: 28px;
                border-radius: 6px;
                border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
                }

            .btn-action.add {
                background: var(--success);
            color: white;
                }

            .btn-action.add:hover {
                background: var(--success-dark);
                }

            .btn-action.remove {
                background: #fee2e2;
                color: #ef4444;
            }

            .btn-action.remove:hover {
                background: #ef4444;
                color: white;
                transform: scale(1.1);
            }

            .btn-premium-add {
                background: #10b981;
                color: white;
                border: none;
                padding: 0.6rem 1.25rem;
                border-radius: 8px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2), 0 2px 4px -2px rgba(16, 185, 129, 0.1);
            }

            .btn-premium-add:hover {
                background: #059669;
                transform: translateY(-1px);
                box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3), 0 4px 6px -4px rgba(16, 185, 129, 0.2);
            }

            .btn-premium-add:active {
                transform: translateY(0);
                box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);
            }

            .timecode-select {
                width: 100%;
            padding: 0.375rem 0.5rem;
            border: 2px solid #cbd5e1;
            border-radius: 4px;
            background: white;
            font-size: 0.8125rem;
                }

            .timecode-select:focus {
                outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.2);
                }

            .details-input {
                width: 100%;
            padding: 0.375rem 0.5rem;
            border: 2px solid #cbd5e1;
            border-radius: 4px;
            font-size: 0.8125rem;
            background: white;
                }

            .details-input:focus {
                outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.2);
                }

            .hours-input {
                width: 100%;
            padding: 0.375rem;
            border: 2px solid #cbd5e1;
            border-radius: 4px;
            text-align: center;
            font-size: 0.875rem;
            background: white;
                }

            .hours-input:focus {
                outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.2);
                }

            .hours-input::-webkit-inner-spin-button,
            .hours-input::-webkit-outer-spin-button {
                -webkit - appearance: none;
            margin: 0;
                }

            .row-total-value {
                font - weight: 600;
            color: var(--accent);
                }

            .summary-grid {
                grid-template-columns: repeat(4, 1fr);
                gap: 1rem;
                margin-bottom: 2rem;
            }

            .stat-card.mixed {
                display: flex;
                align-items: flex-start;
                gap: 0.75rem;
                padding: 1rem;
                background: white;
                border-radius: 12px;
                border: 1px solid #e2e8f0;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }

            .stat-card-content {
                flex: 1;
                }

            .stat-card-values {
                display: flex;
            align-items: center;
            gap: 1rem;
            margin-top: 0.5rem;
                }

            .value-item {
                display: flex;
            flex-direction: column;
                }

            .value-label {
                font - size: 0.625rem;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.025em;
                }

            .value-num {
                font - size: 1.125rem;
            font-weight: 700;
            line-height: 1.2;
                }

            .divider {
                width: 1px;
            height: 24px;
            background: #e2e8f0;
                }

            .stat-card-icon {
                width: 40px;
            height: 40px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
                }

            .stat-card-icon.blue {background: #eff6ff; color: #3b82f6; }
            .stat-card-icon.green {background: #ecfdf5; color: #10b981; }
            .stat-card-icon.yellow {background: #fffbeb; color: #f59e0b; }
            .stat-card-icon.orange {background: #fff7ed; color: #f97316; }

            .stat-card-label {
                font - size: 0.875rem;
            font-weight: 500;
            color: var(--text-secondary);
                }

            .text-green {color: #10b981; }
            .text-blue {color: #3b82f6; }

            .filter-bar {
                display: flex;
            align-items: center;
            gap: 1.5rem;
            padding: 1.25rem;
            background: white;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            margin-bottom: 1.5rem;
                }

            .filter-icon {
                color: var(--text-muted);
            display: flex;
            align-items: center;
            padding-right: 0.5rem;
            border-right: 1px solid #e2e8f0;
                }

            .filter-group {
                display: flex;
            flex-direction: column;
            gap: 0.25rem;
                }

            .filter-group label {
                font - size: 0.75rem;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.025em;
                }

            .filter-group select,
            .filter-group input {
                padding: 0.5rem;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 0.875rem;
            min-width: 180px;
                }

            /* Modal size adjustment */
            .modal-xl .modal-content {
                max - width: 95vw;
            width: 1200px;
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

            .tab-badge {
                background: var(--danger);
            color: white;
            font-size: 0.75rem;
            padding: 2px 6px;
            border-radius: 99px;
            min-width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
                }
            `}</style>
        </div >
    );
};

export default Timesheets;
