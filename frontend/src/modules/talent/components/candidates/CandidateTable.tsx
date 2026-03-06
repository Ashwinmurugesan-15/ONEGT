import { useState, useEffect, useRef } from 'react';
import { Candidate } from '@/types/recruitment';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    MoreHorizontal,
    Eye,
    Calendar,
    Mail,
    FileText,
    Columns,
    ChevronDown,
    ArrowUpDown,
    X,
    Edit3,
    Check,
    MessageSquare,
    Star,
    AlertCircle,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// Define Badge variants locally if needed or reuse existing
// Assuming StatusBadge handles the status string correctly

export interface Column {
    key: string;
    label: string;
    visible: boolean;
    sortable?: boolean;
}

export const defaultColumns: Column[] = [
    { key: 'name', label: 'Full Name', visible: true, sortable: true },
    { key: 'email', label: 'Email ID', visible: true },
    { key: 'phone', label: 'Contact Number', visible: true },
    { key: 'linkedInProfile', label: 'LinkedIn Profile', visible: true },
    { key: 'resumeUrl', label: 'Resume / CV', visible: true },
    { key: 'interestPosition', label: 'Interested Position', visible: true },
    { key: 'currentRole', label: 'Current Role', visible: true, sortable: true },
    { key: 'currentCompany', label: 'Current Organization', visible: true },
    { key: 'experience', label: 'Total Years of Experience', visible: true, sortable: true },
    { key: 'location', label: 'Current Location', visible: true },
    { key: 'locationPreference', label: 'Location Preference', visible: true },
    { key: 'currentCTC', label: 'Current CTC per Annum', visible: true },
    { key: 'expectedCTC', label: 'Expected CTC per Annum', visible: true },
    { key: 'noticePeriod', label: 'Notice Period (Days)', visible: true },
    { key: 'isServingNotice', label: 'Currently in Notice', visible: true },
    { key: 'isImmediateJoiner', label: 'Immediate Joiner', visible: true },
    { key: 'hasOtherOffers', label: 'Other Offers in Hand', visible: true },
    { key: 'otherOfferCTC', label: 'Offered CTC (if any)', visible: true },
    { key: 'certifications', label: 'Certifications', visible: true },
    { key: 'referredBy', label: 'Referred By', visible: true },
    { key: 'screeningFeedback', label: 'Initial Screening', visible: true },
    { key: 'comments', label: 'Additional Comments', visible: true },
    { key: 'interviewStatus', label: 'Interview Status', visible: true },
    { key: 'status', label: 'Application Status', visible: true },
    { key: 'round1Recommendation', label: 'Round 1 Feedback', visible: true },
    { key: 'round2Recommendation', label: 'Round 2 Feedback', visible: true },
    { key: 'clientRecommendation', label: 'Client Feedback', visible: true },
    { key: 'offeredCTC', label: 'Offered CTC', visible: true },
    { key: 'offeredPosition', label: 'Offered Position', visible: true },
    { key: 'actions', label: 'Actions', visible: true },
];

// Position title map for displaying full position names
const positionTitleMap: Record<string, string> = {
    'sre': 'Site Reliability Engineer',
    'senior-sre': 'Senior Site Reliability Engineer',
    'lead-sre': 'Lead Site Reliability Engineer',
    'app-sre': 'Application Site Reliability Engineer',
    'soc-engineer': 'Security Operations Centre Engineer',
    'performance-engineer': 'Performance Engineer',
    'qa-automation': 'QA Automation Engineer',
    'devops': 'DevOps Engineer',
    'lead-sap': 'Lead SAP Engineer',
    'ai-ml': 'AI/ML Engineer',
    'ai-ml-intern': 'AI/ML Intern',
    'internship': 'Internship',
    'fresher': 'Fresher',
    'senior-devops': 'Senior DevOps Engineer',
    'full-stack': 'Full Stack Developer',
    'data-engineer': 'Data Engineer',
};

interface CandidateTableProps {
    candidates: Candidate[];
    onViewCandidate: (candidate: Candidate) => void;
    onViewResume: (candidate: Candidate) => void;
    onScheduleInterview: (candidate: Candidate) => void;
    onMoveForward: (candidate: Candidate) => void;
    onReject: (candidate: Candidate) => void;
    onInitialScreening: (candidate: Candidate) => void;
    onStatusChange: (candidateId: string, status: Candidate['status']) => void;
    onInterviewStatusChange: (candidateId: string, status: Candidate['interviewStatus']) => void;
    columns?: Column[];
    onColumnToggle?: (key: string) => void;
}

export function CandidateTable({
    candidates,
    onViewCandidate,
    onViewResume,
    onScheduleInterview,
    onMoveForward,
    onReject,
    onInitialScreening,
    onStatusChange,
    onInterviewStatusChange,
    columns: externalColumns,
    onColumnToggle
}: CandidateTableProps) {
    // Use external columns if provided, otherwise internal state
    const [internalColumns, setInternalColumns] = useState<Column[]>(defaultColumns);
    const columns = externalColumns || internalColumns;

    // Reset columns if the default columns definition changes (useful for HMR)
    useEffect(() => {
        if (!externalColumns) {
            setInternalColumns(defaultColumns);
        }
    }, [externalColumns]);

    const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
    const [sortColumn, setSortColumn] = useState<string>('appliedAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);

    // Refs for synchronized scrolling
    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [tableWidth, setTableWidth] = useState(0);

    // Feedback Dialog State
    const [selectedFeedbackCandidate, setSelectedFeedbackCandidate] = useState<Candidate | null>(null);
    const [activeFeedbackRound, setActiveFeedbackRound] = useState<string>('round1');

    // Reset page when candidates list changes (filtering)
    useEffect(() => {
        setCurrentPage(1);
    }, [candidates]);

    // Synchronize scrolling and handle resize
    useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableContainer = tableContainerRef.current;

        if (!topScroll || !tableContainer) return;

        const handleTopScroll = () => {
            if (tableContainer) tableContainer.scrollLeft = topScroll.scrollLeft;
        };

        const handleTableScroll = () => {
            if (topScroll) topScroll.scrollLeft = tableContainer.scrollLeft;
        };

        topScroll.addEventListener('scroll', handleTopScroll);
        tableContainer.addEventListener('scroll', handleTableScroll);

        // Resize observer to keep widths in sync
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === tableContainer) {
                    setTableWidth(tableContainer.scrollWidth);
                    // Also sync visible width
                    if (topScroll) topScroll.style.width = `${tableContainer.clientWidth}px`;
                }
            }
        });

        resizeObserver.observe(tableContainer);
        // Initial setup
        setTableWidth(tableContainer.scrollWidth);
        topScroll.style.width = `${tableContainer.clientWidth}px`;

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableContainer.removeEventListener('scroll', handleTableScroll);
            resizeObserver.disconnect();
        };
    }, []);

    const visibleColumns = columns.filter(col => col.visible);


    const toggleColumn = (key: string) => {
        if (onColumnToggle) {
            onColumnToggle(key);
        } else {
            setInternalColumns(cols =>
                cols.map(col =>
                    col.key === key ? { ...col, visible: !col.visible } : col
                )
            );
        }
    };

    const toggleSelectAll = () => {
        if (selectedCandidates.length === candidates.length) {
            setSelectedCandidates([]);
        } else {
            setSelectedCandidates(candidates.map(c => c.id));
        }
    };

    const toggleSelectCandidate = (id: string) => {
        setSelectedCandidates(prev =>
            prev.includes(id)
                ? prev.filter(cId => cId !== id)
                : [...prev, id]
        );
    };

    const handleSort = (key: string) => {
        if (sortColumn === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(key);
            setSortDirection('asc');
        }
    };

    const sortedCandidates = [...candidates].sort((a, b) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let aVal: any = a[sortColumn as keyof Candidate];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let bVal: any = b[sortColumn as keyof Candidate];

        // Handle nested or specific field logic if needed
        if (sortColumn === 'appliedAt') {
            const d1 = new Date(aVal);
            const d2 = new Date(bVal);
            aVal = !isNaN(d1.getTime()) ? d1.getTime() : 0;
            bVal = !isNaN(d2.getTime()) ? d2.getTime() : 0;
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const sourceLabels: Record<string, string> = {
        career_portal: 'Career Page',
    };

    const interviewStatusConfig: Record<string, { label: string; className: string }> = {
        applied: { label: 'Applied', className: 'bg-muted/50 text-muted-foreground' },
        profile_screening_comp: { label: 'Profile Screening Comp', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
        voice_screening_comp: { label: 'Voice Screening Comp', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
        tech_inter_sched: { label: 'Tech Inter Sched', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
        tech_inter_comp: { label: 'Tech Inter Comp', className: 'bg-lime-500/10 text-lime-600 border-lime-500/20' },
        code_inter_sched: { label: 'Code Inter Sched', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
        code_inter_comp: { label: 'Code Inter Comp', className: 'bg-lime-500/10 text-lime-600 border-lime-500/20' },
        hr_inter_sched: { label: 'HR Inter Sched', className: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
        hr_inter_comp: { label: 'HR Inter Comp', className: 'bg-purple-900/10 text-purple-900 border-purple-900/20' },
        offer: { label: 'Offer', className: 'bg-teal-500/10 text-teal-600 border-teal-500/20' },
        pending_final_noti: { label: 'Pending Final Noti', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
        references: { label: 'Referances', className: 'bg-gray-500/10 text-gray-600 border-gray-500/20' },
        all_completed: { label: 'All Completed', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    };

    return (
        <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
            {/* Table Header Actions - hide if columns are managed externally since the original dropdown was here */}
            {!externalColumns && (
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
                    <div className="flex items-center gap-2">
                        {selectedCandidates.length > 0 && (
                            <span className="text-sm text-muted-foreground font-medium">
                                {selectedCandidates.length} selected
                            </span>
                        )}
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 bg-background">
                                <Columns className="w-4 h-4" />
                                Columns
                                <ChevronDown className="w-3 h-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto">
                            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {columns.filter(c => c.key !== 'actions').map(column => (
                                <DropdownMenuCheckboxItem
                                    key={column.key}
                                    checked={column.visible}
                                    onCheckedChange={() => toggleColumn(column.key)}
                                    onSelect={(e) => e.preventDefault()}
                                >
                                    {column.label}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
            {/* Show just selection count if columns are external and candidates selected */}
            {externalColumns && selectedCandidates.length > 0 && (
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
                    <span className="text-sm text-muted-foreground font-medium">
                        {selectedCandidates.length} selected
                    </span>
                </div>
            )}

            {/* Top Scrollbar (Synchronized) */}
            <div
                ref={topScrollRef}
                className="overflow-x-auto mb-1"
                style={{ height: '12px' }}
            >
                <div style={{ width: `${tableWidth}px`, height: '1px' }} />
            </div>

            {/* Table */}
            <div
                ref={tableContainerRef}
                className="overflow-x-auto relative"
            >
                <table className="w-full border-separate border-spacing-0">
                    <thead>
                        <tr className="border-b border-border bg-muted/50">
                            <th className="w-12 p-2 align-middle sticky left-0 z-40 bg-muted border-b border-border shadow-[1px_0_0_0_rgba(0,0,0,0.1)] text-sm font-medium text-muted-foreground text-center">
                                CD_ID
                            </th>
                            {visibleColumns.map(column => {
                                const isSticky = ['name', 'email', 'phone'].includes(column.key);
                                let stickyClass = '';
                                if (column.key === 'name') stickyClass = 'sticky left-[56px] z-30 bg-muted border-b border-border';
                                if (column.key === 'email') stickyClass = 'sticky left-[196px] z-30 bg-muted border-b border-border';
                                if (column.key === 'phone') stickyClass = 'sticky left-[396px] z-30 bg-muted border-b border-border shadow-[2px_0_0_0_rgba(0,0,0,0.1)]';

                                let widthClass = '';
                                if (column.key === 'name') widthClass = 'w-[140px] min-w-[140px] max-w-[140px]';
                                if (column.key === 'email') widthClass = 'w-[200px] min-w-[200px] max-w-[200px]';
                                if (column.key === 'phone') widthClass = 'w-[180px] min-w-[180px] max-w-[180px]';

                                return (
                                    <th
                                        key={column.key}
                                        className={cn(
                                            'p-4 text-left text-sm font-medium text-muted-foreground align-middle whitespace-nowrap',
                                            column.sortable && 'cursor-pointer hover:bg-muted transition-colors',
                                            isSticky && stickyClass,
                                            widthClass
                                        )}
                                        onClick={() => column.sortable && handleSort(column.key)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {column.label}
                                            {column.sortable && (
                                                <ArrowUpDown className="w-3 h-3" />
                                            )}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedCandidates.slice((currentPage - 1) * 10, currentPage * 10).map((candidate, index) => (
                            <tr
                                key={candidate.id || `candidate-${index}`}
                                className="group/row hover:bg-muted/50 transition-colors border-b border-border last:border-0 cursor-pointer"
                                onClick={() => onViewCandidate(candidate)}
                            >
                                <td className="w-12 p-2 align-middle sticky left-0 z-20 !bg-card border-b border-border group-hover/row:!bg-muted shadow-[1px_0_0_0_rgba(0,0,0,0.1)] text-center">
                                    <span className="text-sm font-medium text-primary" title={candidate.id || ''}>
                                        {candidate.id ? `${candidate.id.substring(0, 8)}...` : 'N/A'}
                                    </span>
                                </td>
                                {visibleColumns.map(column => {
                                    const isSticky = ['name', 'email', 'phone'].includes(column.key);
                                    let stickyClass = '';
                                    if (column.key === 'name') stickyClass = 'sticky left-[56px] z-10 !bg-card group-hover/row:!bg-muted border-b border-border';
                                    if (column.key === 'email') stickyClass = 'sticky left-[196px] z-10 !bg-card group-hover/row:!bg-muted border-b border-border';
                                    if (column.key === 'phone') stickyClass = 'sticky left-[396px] z-10 !bg-card group-hover/row:!bg-muted border-b border-border shadow-[2px_0_0_0_rgba(0,0,0,0.1)]';

                                    let widthClass = '';
                                    if (column.key === 'name') widthClass = 'w-[140px] min-w-[140px] max-w-[140px]';
                                    if (column.key === 'email') widthClass = 'w-[200px] min-w-[200px] max-w-[200px]';
                                    if (column.key === 'phone') widthClass = 'w-[180px] min-w-[180px] max-w-[180px]';

                                    return (
                                        <td
                                            key={column.key}
                                            className={cn(
                                                "p-4 align-middle whitespace-nowrap",
                                                isSticky && stickyClass,
                                                widthClass
                                            )}
                                        >
                                            {column.key === 'name' && (() => {
                                                // Status color map for name column
                                                const statusTextColors: Record<string, string> = {
                                                    applied: 'text-blue-700',
                                                    screening: 'text-amber-700',
                                                    interview_scheduled: 'text-blue-800',
                                                    interview_completed: 'text-slate-700',
                                                    selected: 'text-green-700',
                                                    rejected: 'text-red-700',
                                                    offer_rolled: 'text-purple-700',
                                                    offer_accepted: 'text-indigo-800',
                                                    offer_rejected: 'text-rose-800',
                                                    onboarding: 'text-cyan-700',
                                                    onboarded: 'text-emerald-800',
                                                };
                                                const nameColor = statusTextColors[candidate.status] || 'text-foreground';
                                                const displayName = candidate.name || 'Unknown Candidate';
                                                return (
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="w-9 h-9">
                                                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                                                {displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className={cn("font-bold text-sm", nameColor)}>{displayName}</span>
                                                    </div>
                                                );
                                            })()}
                                            {column.key === 'email' && (
                                                <span className="text-sm text-foreground">{candidate.email}</span>
                                            )}
                                            {column.key === 'phone' && (
                                                <span className="text-sm text-foreground">{candidate.phone}</span>
                                            )}
                                            {column.key === 'resumeUrl' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onViewResume(candidate);
                                                    }}
                                                >
                                                    <FileText className="w-4 h-4 mr-1" />
                                                    View CV
                                                </Button>
                                            )}
                                            {column.key === 'interestPosition' && (
                                                <span className="text-sm text-foreground font-medium">
                                                    {positionTitleMap[candidate.demandId] || candidate.demandId || '-'}
                                                </span>
                                            )}
                                            {column.key === 'currentRole' && (
                                                <span className="text-sm text-foreground">{candidate.currentRole || '-'}</span>
                                            )}
                                            {column.key === 'skills' && (
                                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                    {Array.isArray(candidate.skills) && candidate.skills.slice(0, 3).map(skill => (
                                                        <span
                                                            key={skill}
                                                            className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded-md"
                                                        >
                                                            {skill}
                                                        </span>
                                                    ))}
                                                    {candidate.skills?.length > 3 && (
                                                        <span className="text-xs text-muted-foreground self-center">
                                                            +{candidate.skills.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {column.key === 'certifications' && (
                                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                    {Array.isArray(candidate.certifications) && candidate.certifications.slice(0, 1).map(cert => (
                                                        <span
                                                            key={cert}
                                                            className="px-2 py-0.5 border text-muted-foreground text-xs rounded-md"
                                                        >
                                                            {cert}
                                                        </span>
                                                    ))}
                                                    {candidate.certifications && candidate.certifications.length > 1 && (
                                                        <span className="text-xs text-muted-foreground self-center">
                                                            +{candidate.certifications.length - 1}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {column.key === 'experience' && (
                                                <span className="text-sm text-foreground">{candidate.experience}</span>
                                            )}
                                            {column.key === 'status' && (
                                                <div onClick={e => e.stopPropagation()}>
                                                    <Select
                                                        value={candidate.status}
                                                        onValueChange={(value) => onStatusChange(candidate.id, value as Candidate['status'])}
                                                    >
                                                        <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs font-medium">
                                                            <SelectValue>
                                                                <StatusBadge
                                                                    status={candidate.status}
                                                                    extraLabel={candidate.status === 'rejected' ? (positionTitleMap[candidate.demandId] || candidate.demandId) : undefined}
                                                                />
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="applied">Received</SelectItem>
                                                            <SelectItem value="screening">Proceed Further</SelectItem>
                                                            <SelectItem value="interview_scheduled">On Hold</SelectItem>
                                                            <SelectItem value="interview_completed">No Resp Call/Email</SelectItem>
                                                            <SelectItem value="selected">Accepted</SelectItem>
                                                            <SelectItem value="rejected">Rejected</SelectItem>
                                                            <SelectItem value="offer_rolled">Sent</SelectItem>
                                                            <SelectItem value="offer_accepted">In Notice</SelectItem>
                                                            <SelectItem value="offer_rejected">Did Not Join</SelectItem>
                                                            <SelectItem value="onboarding">Onboarding</SelectItem>
                                                            <SelectItem value="onboarded">Joined</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                            {column.key === 'source' && (
                                                <span className="text-sm text-muted-foreground">
                                                    {sourceLabels[candidate.source] || candidate.source}
                                                </span>
                                            )}
                                            {column.key === 'appliedAt' && (
                                                <span className="text-sm text-muted-foreground">
                                                    {(() => {
                                                        const d = new Date(candidate.appliedAt);
                                                        return !isNaN(d.getTime()) ? format(d, 'MMM d, yyyy') : 'N/A';
                                                    })()}
                                                </span>
                                            )}
                                            {column.key === 'currentCompany' && (
                                                <span className="text-sm text-foreground">
                                                    {candidate.currentCompany || '-'}
                                                </span>
                                            )}
                                            {column.key === 'location' && (
                                                <span className="text-sm text-muted-foreground">
                                                    {candidate.location || '-'}
                                                </span>
                                            )}
                                            {column.key === 'locationPreference' && (
                                                <span className="text-sm text-muted-foreground">
                                                    {candidate.locationPreference || '-'}
                                                </span>
                                            )}
                                            {column.key === 'currentCTC' && (
                                                <span className="text-sm text-foreground">
                                                    {candidate.currentCTC || '-'}
                                                </span>
                                            )}
                                            {column.key === 'expectedCTC' && (
                                                <span className="text-sm text-muted-foreground">
                                                    {candidate.expectedCTC || '-'}
                                                </span>
                                            )}
                                            {column.key === 'noticePeriod' && (
                                                <span className="text-sm text-muted-foreground">
                                                    {candidate.noticePeriod || '-'}
                                                </span>
                                            )}
                                            {column.key === 'isServingNotice' && (
                                                <span className="text-sm">
                                                    {candidate.isServingNotice ? (
                                                        <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10">Yes</Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">No</span>
                                                    )}
                                                </span>
                                            )}
                                            {column.key === 'isImmediateJoiner' && (
                                                <span className="text-sm">
                                                    {candidate.isImmediateJoiner ? (
                                                        <Badge variant="outline" className="text-green-600 border-green-500/30 bg-green-500/10">Yes</Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">No</span>
                                                    )}
                                                </span>
                                            )}
                                            {column.key === 'hasOtherOffers' && (
                                                <span className="text-sm">
                                                    {candidate.hasOtherOffers ? (
                                                        <Badge variant="secondary">Yes</Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">No</span>
                                                    )}
                                                </span>
                                            )}
                                            {column.key === 'otherOfferCTC' && (
                                                <span className="text-sm text-muted-foreground">
                                                    {candidate.otherOfferCTC || '-'}
                                                </span>
                                            )}
                                            {column.key === 'linkedInProfile' && candidate.linkedInProfile && (
                                                <a
                                                    href={`https://${candidate.linkedInProfile.replace(/^https?:\/\//, '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-primary hover:underline"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    View Profile
                                                </a>
                                            )}
                                            {column.key === 'screeningFeedback' && (
                                                <div className="flex items-center gap-2 max-w-[200px]" onClick={e => e.stopPropagation()}>
                                                    <span className="text-sm text-muted-foreground truncate flex-1" title={candidate.screeningFeedback || ''}>
                                                        {candidate.screeningFeedback || 'No feedback'}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                                                        onClick={() => onInitialScreening(candidate)}
                                                    >
                                                        <Edit3 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            )}
                                            {column.key === 'interviewStatus' && (
                                                <div onClick={e => e.stopPropagation()}>
                                                    <Select
                                                        value={candidate.interviewStatus || 'applied'}
                                                        onValueChange={(value) => onInterviewStatusChange(candidate.id, value as Candidate['interviewStatus'])}
                                                    >
                                                        <SelectTrigger className="h-8 w-[180px] text-xs font-medium">
                                                            <SelectValue>
                                                                {candidate.interviewStatus ? (
                                                                    <Badge className={cn('border font-medium px-2 py-0', interviewStatusConfig[candidate.interviewStatus]?.className)}>
                                                                        {interviewStatusConfig[candidate.interviewStatus]?.label}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge className="bg-muted/50 text-muted-foreground border font-medium px-2 py-0">Applied</Badge>
                                                                )}
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Object.entries(interviewStatusConfig).map(([key, config]) => (
                                                                <SelectItem key={key} value={key}>
                                                                    {config.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                            {column.key === 'referredBy' && (
                                                <span className="text-sm text-muted-foreground">
                                                    {candidate.referredBy || '-'}
                                                </span>
                                            )}
                                            {column.key === 'comments' && (
                                                <span className="text-sm text-muted-foreground max-w-[200px] truncate block" title={candidate.comments || ''}>
                                                    {candidate.comments || '-'}
                                                </span>
                                            )}
                                            {column.key === 'round1Recommendation' && (
                                                <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveFeedbackRound('round1');
                                                    setSelectedFeedbackCandidate(candidate);
                                                }}>
                                                    {candidate.round1Recommendation ? (
                                                        <Badge variant={candidate.round1Recommendation === 'proceed_to_round2' ? 'default' : 'destructive'}
                                                            className={candidate.round1Recommendation === 'proceed_to_round2' ? 'bg-green-600 hover:bg-green-600/90' : ''}
                                                        >
                                                            {candidate.round1Recommendation === 'proceed_to_round2' ? 'Proceed' : 'Reject'}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </div>
                                            )}
                                            {column.key === 'round2Recommendation' && (
                                                <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveFeedbackRound('round2');
                                                    setSelectedFeedbackCandidate(candidate);
                                                }}>
                                                    {candidate.round2Recommendation ? (
                                                        <Badge variant={candidate.round2Recommendation === 'reject' ? 'destructive' : 'default'}
                                                            className={candidate.round2Recommendation !== 'reject' ? 'bg-green-600 hover:bg-green-600/90' : ''}
                                                        >
                                                            {candidate.round2Recommendation === 'reject' ? 'Rejected' : 'Proceed'}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </div>
                                            )}
                                            {column.key === 'clientRecommendation' && (
                                                <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveFeedbackRound('client');
                                                    setSelectedFeedbackCandidate(candidate);
                                                }}>
                                                    {candidate.clientRecommendation ? (
                                                        <Badge
                                                            variant={candidate.clientRecommendation === 'move_forward' || candidate.clientRecommendation === 'proceed_to_offer' ? 'default' : 'destructive'}
                                                            className={candidate.clientRecommendation === 'move_forward' || candidate.clientRecommendation === 'proceed_to_offer' ? 'bg-green-600 hover:bg-green-600/90' : ''}
                                                        >
                                                            {candidate.clientRecommendation === 'move_forward' || candidate.clientRecommendation === 'proceed_to_offer' ? 'Accepted' : 'Rejected'}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </div>
                                            )}
                                            {column.key === 'offeredCTC' && (
                                                <span className="text-sm font-semibold text-green-600">
                                                    {candidate.offeredCTC || '-'}
                                                </span>
                                            )}
                                            {column.key === 'offeredPosition' && (
                                                <span className="text-sm font-medium text-primary">
                                                    {candidate.offeredPosition || '-'}
                                                </span>
                                            )}
                                            {!['name', 'email', 'phone', 'resumeUrl', 'interestPosition', 'currentRole', 'skills', 'certifications', 'experience', 'status', 'source', 'appliedAt', 'currentCompany', 'location', 'locationPreference', 'currentCTC', 'expectedCTC', 'noticePeriod', 'isServingNotice', 'isImmediateJoiner', 'hasOtherOffers', 'otherOfferCTC', 'linkedInProfile', 'screeningFeedback', 'interviewStatus', 'referredBy', 'comments', 'round1Recommendation', 'round2Recommendation', 'clientRecommendation', 'offeredCTC', 'offeredPosition', 'actions'].includes(column.key) && (
                                                <span className="text-sm text-foreground">
                                                    {candidate ? (candidate as any)[column.key] || '-' : '-'}
                                                </span>
                                            )}
                                            {
                                                column.key === 'actions' && (
                                                    <div onClick={e => e.stopPropagation()}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                                                                    <MoreHorizontal className="w-4 h-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => onViewCandidate(candidate)}>
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    View Details
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => onViewResume(candidate)}>
                                                                    <FileText className="mr-2 h-4 w-4" />
                                                                    View Resume
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => onScheduleInterview(candidate)}>
                                                                    <Calendar className="mr-2 h-4 w-4" />
                                                                    Schedule Interview
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => onMoveForward(candidate)}>
                                                                    <ArrowUpDown className="mr-2 h-4 w-4" />
                                                                    Move Forward
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive"
                                                                    onClick={() => onReject(candidate)}
                                                                >
                                                                    <X className="mr-2 h-4 w-4" />
                                                                    Reject
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                )
                                            }
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-4 border-t border-border bg-muted/20">
                <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, sortedCandidates.length)} of {sortedCandidates.length} entries
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </Button>
                    <span className="text-sm font-medium">
                        Page {currentPage} of {Math.ceil(sortedCandidates.length / 10) || 1}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(sortedCandidates.length / 10)))}
                        disabled={currentPage >= Math.ceil(sortedCandidates.length / 10)}
                    >
                        Next
                    </Button>
                </div>
            </div>
            {/* Feedback Details Dialog */}
            <Dialog open={!!selectedFeedbackCandidate} onOpenChange={(open) => !open && setSelectedFeedbackCandidate(null)}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                            <MessageSquare className="w-6 h-6 text-primary" />
                            Interview Feedback Details
                        </DialogTitle>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-medium text-muted-foreground px-2 py-0.5 bg-muted rounded">Candidate: {selectedFeedbackCandidate?.name}</span>
                        </div>
                    </DialogHeader>

                    <div className="space-y-6 pt-2 pb-4">
                        {selectedFeedbackCandidate && (
                            <div>
                                {/* Round 1 Assessment */}
                                {activeFeedbackRound === 'round1' && (
                                    <div className={cn(
                                        "p-5 rounded-2xl border transition-all",
                                        selectedFeedbackCandidate.round1Feedback ? "bg-blue-50/50 border-blue-100" : "bg-muted/30 border-dashed border-muted-foreground/20 opacity-60"
                                    )}>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                    <MessageSquare className="h-5 w-5 text-blue-600" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-lg text-foreground">Round 1 Feedback</h4>
                                                    <p className="text-xs text-muted-foreground">Technical Screening & Fitment</p>
                                                </div>
                                            </div>
                                            {selectedFeedbackCandidate.round1Recommendation && (
                                                <Badge variant={selectedFeedbackCandidate.round1Recommendation === 'proceed_to_round2' ? 'default' : 'destructive'}
                                                    className={cn("px-3 py-1 text-xs font-semibold uppercase tracking-wider", selectedFeedbackCandidate.round1Recommendation === 'proceed_to_round2' ? 'bg-green-600' : '')}>
                                                    {selectedFeedbackCandidate.round1Recommendation === 'proceed_to_round2' ? 'Proceed' : 'Reject'}
                                                </Badge>
                                            )}
                                        </div>

                                        {selectedFeedbackCandidate.round1Feedback ? (() => {
                                            try {
                                                const data = JSON.parse(selectedFeedbackCandidate.round1Feedback);
                                                return (
                                                    <div className="space-y-6">
                                                        <div className="grid grid-cols-2 gap-6">
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Communication</Label>
                                                                <p className="text-sm font-medium text-foreground">{data.communication || '-'}</p>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Technical Assessment</Label>
                                                                <p className="text-sm font-medium text-foreground">{data.technicalAssessment || '-'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-6">
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Problem Solving</Label>
                                                                <p className="text-sm font-medium text-foreground">{data.problemSolving || '-'}</p>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Overall Potential</Label>
                                                                <p className="text-sm font-medium text-foreground">{data.overallPotential || '-'}</p>
                                                            </div>
                                                        </div>
                                                        {(data.comments || data.feedback) && (
                                                            <div className="space-y-2 p-4 bg-background/60 rounded-xl border border-border/50 shadow-inner">
                                                                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Detailed Assessment</Label>
                                                                <p className="text-sm text-foreground/90 leading-relaxed italic mt-1 font-medium">
                                                                    "{data.comments || data.feedback}"
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            } catch (e) {
                                                return <p className="text-sm text-muted-foreground italic">Feedback format error</p>;
                                            }
                                        })() : (
                                            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 bg-background/20 rounded-2xl border border-dashed">
                                                <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
                                                <p className="text-sm text-muted-foreground italic font-medium">No Round 1 feedback recorded yet.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Round 2 Assessment */}
                                {activeFeedbackRound === 'round2' && (
                                    <div className={cn(
                                        "p-5 rounded-2xl border transition-all",
                                        selectedFeedbackCandidate.round2Feedback ? "bg-indigo-50/50 border-indigo-100" : "bg-muted/30 border-dashed border-muted-foreground/20 opacity-60"
                                    )}>
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                                                    <Check className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg leading-tight text-foreground">Round 2 Feedback</h3>
                                                    <p className="text-xs text-muted-foreground">Detailed Technical Interview</p>
                                                </div>
                                            </div>
                                            {selectedFeedbackCandidate.round2Recommendation && (
                                                <Badge variant={selectedFeedbackCandidate.round2Recommendation === 'reject' ? 'destructive' : 'default'}
                                                    className={cn("px-3 py-1 text-xs font-semibold uppercase tracking-wider", selectedFeedbackCandidate.round2Recommendation !== 'reject' ? 'bg-green-600' : '')}>
                                                    {selectedFeedbackCandidate.round2Recommendation === 'reject' ? 'Rejected' : 'Proceed'}
                                                </Badge>
                                            )}
                                        </div>

                                        {selectedFeedbackCandidate.round2Feedback ? (() => {
                                            try {
                                                const data = JSON.parse(selectedFeedbackCandidate.round2Feedback);
                                                return (
                                                    <div className="space-y-6">
                                                        <div className="grid grid-cols-2 gap-6">
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Communication</Label>
                                                                <p className="text-sm font-medium text-foreground">{data.communication || '-'}</p>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Technical Assessment</Label>
                                                                <p className="text-sm font-medium text-foreground">{data.technicalAssessment || '-'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-6">
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Problem Solving</Label>
                                                                <p className="text-sm font-medium text-foreground">{data.problemSolving || '-'}</p>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Expected CTC</Label>
                                                                <p className="text-sm font-semibold text-green-600">{data.ctc || '-'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2 p-4 bg-background/60 rounded-xl border border-border/50 shadow-inner">
                                                            <div className="mb-4">
                                                                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Detailed Assessment</Label>
                                                                <p className="text-sm text-foreground/90 leading-relaxed italic mt-1 font-medium">
                                                                    "{data.comments || "No detailed assessment provided"}"
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Recommendation / Rationale</Label>
                                                                <p className="text-sm text-foreground/90 leading-relaxed italic mt-1 font-medium">
                                                                    "{data.recommendation || "-"}"
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            } catch (e) {
                                                return <p className="text-sm text-muted-foreground italic">Feedback format error</p>;
                                            }
                                        })() : (
                                            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 bg-background/20 rounded-2xl border border-dashed">
                                                <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
                                                <p className="text-sm text-muted-foreground italic font-medium">No Round 2 feedback recorded yet.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Client Interview Detail */}
                                {activeFeedbackRound === 'client' && (
                                    <div className={cn(
                                        "p-5 rounded-2xl border transition-all",
                                        selectedFeedbackCandidate.clientFeedback ? "bg-emerald-50/50 border-emerald-100" : "bg-muted/30 border-dashed border-muted-foreground/20 opacity-60"
                                    )}>
                                        {selectedFeedbackCandidate.clientFeedback ? (
                                            <>
                                                <div className="flex items-center justify-between mb-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
                                                            <Star className="w-5 h-5 fill-white" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold text-lg text-foreground">Client Feedback</h4>
                                                            <p className="text-xs text-muted-foreground">Final Stakeholder Review</p>
                                                        </div>
                                                    </div>
                                                    <Badge
                                                        variant={selectedFeedbackCandidate.clientRecommendation === 'move_forward' || selectedFeedbackCandidate.clientRecommendation === 'proceed_to_offer' ? 'default' : 'destructive'}
                                                        className={cn("px-3 py-1 text-xs font-semibold uppercase tracking-wider", selectedFeedbackCandidate.clientRecommendation === 'move_forward' || selectedFeedbackCandidate.clientRecommendation === 'proceed_to_offer' ? 'bg-green-600' : '')}
                                                    >
                                                        {selectedFeedbackCandidate.clientRecommendation === 'move_forward' || selectedFeedbackCandidate.clientRecommendation === 'proceed_to_offer' ? 'Accepted' : 'Rejected'}
                                                    </Badge>
                                                </div>

                                                {(() => {
                                                    try {
                                                        const data = JSON.parse(selectedFeedbackCandidate.clientFeedback);
                                                        return (
                                                            <div className="space-y-6">
                                                                <div className="grid grid-cols-2 gap-6">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Communication</Label>
                                                                        <p className="text-sm font-medium text-foreground">{data.communication || '-'}</p>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Technical Assessment</Label>
                                                                        <p className="text-sm font-medium text-foreground">{data.technicalAssessment || '-'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-6">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Problem Solving</Label>
                                                                        <p className="text-sm font-medium text-foreground">{data.problemSolving || '-'}</p>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Overall Potential</Label>
                                                                        <p className="text-sm font-medium text-foreground">{data.overallPotential || '-'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-2 p-4 bg-background/60 rounded-xl border border-border/50 shadow-inner">
                                                                    <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em]">Detailed Assessment</Label>
                                                                    <p className="text-sm text-foreground/90 leading-relaxed italic mt-1 font-medium">
                                                                        "{data.feedback || data.comments || "No detailed feedback provided"}"
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    } catch (e) {
                                                        return <p className="text-sm text-muted-foreground italic">Client feedback format error</p>;
                                                    }
                                                })()}
                                            </>
                                        ) : (
                                            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 bg-background/20 rounded-2xl border border-dashed">
                                                <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
                                                <p className="text-sm text-muted-foreground italic font-medium">No Client feedback recorded yet.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
