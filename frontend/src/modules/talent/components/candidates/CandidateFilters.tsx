import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Filter, X, Columns as ColumnsIcon, ChevronDown } from 'lucide-react';
import { CandidateStatus } from '@/types/recruitment';
import { Column } from './CandidateTable';

interface CandidateFiltersProps {
    onFilterChange: (filters: FilterState) => void;
    columns?: Column[];
    onColumnToggle?: (key: string) => void;
}

export interface FilterState {
    search: string;
    status: CandidateStatus | 'all';
    position: string;
    location: string;
    experience: string;
    noticePeriod: string;
    feedbackFilter: string;
}

const statusOptions: { value: CandidateStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Application Statuses' },
    { value: 'applied', label: 'Received' },
    { value: 'screening', label: 'Proceed Further' },
    { value: 'interview_scheduled', label: 'On Hold' },
    { value: 'interview_completed', label: 'No Resp Call/Email' },
    { value: 'selected', label: 'Accepted' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'offer_rolled', label: 'Sent' },
    { value: 'offer_accepted', label: 'In Notice' },
    { value: 'offer_rejected', label: 'Did Not Join' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'onboarded', label: 'Joined' },
];

const positionOptions = [
    "All Positions",
    "Site Reliability Engineer",
    "Senior Site Reliability Engineer",
    "Lead Site Reliability Engineer",
    "Application Site Reliability Engineer",
    "Security Operations Centre Engineer",
    "Performance Engineer",
    "QA Automation Engineer (Playwright & Selenium)",
    "DevOps Engineer",
    "Lead SAP Engineer",
    "AI/ML Engineer",
    "AI/ML Intern",
    "Internship",
    "Fresher"
];

const locationOptions = [
    "All Location",
    "Bangalore",
    "Chennai",
    "Coimbatore",
    "Others"
];

const experienceOptions = [
    "Any Experience",
    "0-1 Year",
    "1-3 Years",
    "3-5 Years",
    "5-8 Years",
    "8-10 Years",
    "10+ Years"
];

const noticePeriodOptions = [
    "Any Notice Period",
    "Immediate",
    "15 Days",
    "30 Days",
    "45 Days",
    "60 Days",
    "90 Days"
];

const feedbackFilterOptions = [
    { value: 'all', label: 'All Feedback Status' },
    { value: 'has_screening', label: 'Initial Screening' },
    { value: 'has_round1', label: 'Round 1 Feedback' },
    { value: 'has_round2', label: 'Round 2 Feedback' },
];

export function CandidateFilters({ onFilterChange, columns, onColumnToggle }: CandidateFiltersProps) {
    const [filters, setFilters] = useState<FilterState>({
        search: '',
        status: 'all',
        position: 'All Positions',
        location: 'All Location',
        experience: 'Any Experience',
        noticePeriod: 'Any Notice Period',
        feedbackFilter: 'all',
    });

    const updateFilter = (key: keyof FilterState, value: string) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        onFilterChange(newFilters);
    };

    const clearFilters = () => {
        const defaultFilters: FilterState = {
            search: '',
            status: 'all',
            position: 'All Positions',
            location: 'All Location',
            experience: 'Any Experience',
            noticePeriod: 'Any Notice Period',
            feedbackFilter: 'all',
        };
        setFilters(defaultFilters);
        onFilterChange(defaultFilters);
    };

    const hasActiveFilters =
        filters.search ||
        filters.status !== 'all' ||
        filters.position !== 'All Positions' ||
        filters.location !== 'All Location' ||
        filters.experience !== 'Any Experience' ||
        filters.noticePeriod !== 'Any Notice Period' ||
        filters.feedbackFilter !== 'all';

    return (
        <div className="bg-card p-4 rounded-lg border shadow-sm mb-2">
            <div className="flex flex-wrap items-center gap-2">


                {/* Position Filter */}
                <Select value={filters.position} onValueChange={(v) => updateFilter('position', v)}>
                    <SelectTrigger className="w-[170px]">
                        <SelectValue placeholder="Position" />
                    </SelectTrigger>
                    <SelectContent>
                        {positionOptions.map(option => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Location Filter */}
                <Select value={filters.location} onValueChange={(v) => updateFilter('location', v)}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Location" />
                    </SelectTrigger>
                    <SelectContent>
                        {locationOptions.map(option => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Experience Filter */}
                <Select value={filters.experience} onValueChange={(v) => updateFilter('experience', v)}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Experience" />
                    </SelectTrigger>
                    <SelectContent>
                        {experienceOptions.map(option => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Notice Period Filter */}
                <Select value={filters.noticePeriod} onValueChange={(v) => updateFilter('noticePeriod', v)}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Notice Period" />
                    </SelectTrigger>
                    <SelectContent>
                        {noticePeriodOptions.map(option => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select value={filters.status} onValueChange={(v) => updateFilter('status', v)}>
                    <SelectTrigger className="w-[180px]">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Application Status" />
                    </SelectTrigger>
                    <SelectContent>
                        {statusOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Feedback Filter */}
                <Select value={filters.feedbackFilter} onValueChange={(v) => updateFilter('feedbackFilter', v)}>
                    <SelectTrigger className="w-[170px]">
                        <SelectValue placeholder="Feedback Status" />
                    </SelectTrigger>
                    <SelectContent>
                        {feedbackFilterOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Columns Dropdown */}
                {columns && onColumnToggle && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 bg-background h-10 w-[140px] px-3 font-normal text-muted-foreground justify-between">
                                <div className="flex items-center gap-2">
                                    <ColumnsIcon className="w-4 h-4" />
                                    <span>Columns</span>
                                </div>
                                <ChevronDown className="w-4 h-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto">
                            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {columns.filter(c => c.key !== 'actions').map(column => (
                                <DropdownMenuCheckboxItem
                                    key={column.key}
                                    checked={column.visible}
                                    onCheckedChange={() => onColumnToggle(column.key)}
                                    onSelect={(e) => e.preventDefault()}
                                >
                                    {column.label}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground ml-auto">
                        <X className="w-4 h-4 mr-1" />
                        Clear Filters
                    </Button>
                )}
            </div>
        </div>
    );
}
