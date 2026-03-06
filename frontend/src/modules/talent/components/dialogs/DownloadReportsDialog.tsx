import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useRecruitment } from '@/context/RecruitmentContext';
import { useDemands } from '@/context/DemandsContext';
import { useAuth } from '@/context/AuthContext';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { Download } from 'lucide-react';
import { AnimateIcon } from '@/components/ui/AnimateIcon';

interface DownloadReportsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const DownloadReportsDialog = ({ open, onOpenChange }: DownloadReportsDialogProps) => {
    const { candidates, interviews } = useRecruitment();
    const { demands } = useDemands();
    const { user } = useAuth();

    const safeFormat = (date: any, formatStr: string) => {
        try {
            if (!date) return '-';
            const d = new Date(date);
            if (isNaN(d.getTime())) return '-';
            return format(d, formatStr);
        } catch (e) {
            return '-';
        }
    };


    const [selectedReports, setSelectedReports] = useState({
        candidates: true,
        interviews: false,
        demands: false,
        rejected: false,
        onboarding: false,
        offers: false,
    });

    const reportOptions = [
        { id: 'candidates', label: 'Candidate Report' },
        { id: 'interviews', label: 'Interview Report' },
        { id: 'demands', label: 'Demand Report' },
        { id: 'rejected', label: 'Rejected Candidates Report' },
        { id: 'onboarding', label: 'Onboarding Report' },
        { id: 'offers', label: 'Offer Report' },
    ];

    const handleToggle = (id: string) => {
        setSelectedReports((prev) => ({
            ...prev,
            [id]: !prev[id as keyof typeof prev],
        }));
    };

    const isAllSelected = Object.values(selectedReports).every(Boolean);

    const handleSelectAll = (checked: boolean) => {
        const newState = { ...selectedReports };
        Object.keys(newState).forEach(key => {
            newState[key as keyof typeof selectedReports] = checked;
        });
        setSelectedReports(newState);
    };

    const downloadExcel = () => {
        const workbook = XLSX.utils.book_new();

        // Role-based filtering
        let filteredCandidates = candidates;
        let filteredInterviews = interviews;
        let filteredDemands = demands;

        if (user?.role === 'interviewer') {
            // Interviewers: match by ID (preferred) or Name (fallback)
            filteredInterviews = interviews.filter(i =>
                (i.interviewerId === user.id) ||
                (i.interviewerName?.toLowerCase() === user.name?.toLowerCase())
            );

            // And candidates related to those interviews
            const candidateIds = new Set(filteredInterviews.map(i => i.candidateId));
            filteredCandidates = candidates.filter(c => candidateIds.has(c.id));
            filteredDemands = [];
        } else if (user?.role === 'hiring_manager') {
            // Hiring Managers see open demands (matching dashboard)
            filteredDemands = demands.filter(d => d.status === 'open');
            const demandIds = new Set(filteredDemands.map(d => d.id));
            // Filter candidates and interviews by these demands
            filteredCandidates = candidates.filter(c => demandIds.has(c.demandId));
            filteredInterviews = interviews.filter(i => demandIds.has(i.demandId));
        }

        if (selectedReports.candidates) {
            const data = filteredCandidates.map(c => ({
                Name: c.name,
                Email: c.email,
                Phone: c.phone,
                Status: c.status,
                Experience: c.experience,
                'Applied Date': safeFormat(c.appliedAt, 'yyyy-MM-dd'),
            }));
            const worksheet = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');
        }

        if (selectedReports.interviews) {
            const data = filteredInterviews.map(i => ({
                Candidate: i.candidateName,
                'Demand Title': i.demandTitle,
                Round: i.round,
                Interviewer: i.interviewerName,
                Date: safeFormat(i.scheduledAt, 'yyyy-MM-dd HH:mm'),
                Status: i.status,
            }));
            const worksheet = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Interviews');
        }

        if (selectedReports.demands) {
            const data = filteredDemands.map(d => ({
                Title: d.title,
                Role: d.role,
                Location: d.location,
                Status: d.status,
                Openings: d.openings,
                'Created At': safeFormat(d.createdAt, 'yyyy-MM-dd'),
            }));
            const worksheet = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Demands');
        }

        if (selectedReports.rejected) {
            const data = filteredCandidates.filter(c =>
                c.status === 'rejected' ||
                c.round1Recommendation === 'reject' ||
                c.round2Recommendation === 'reject'
            ).map(c => ({
                Name: c.name,
                Email: c.email,
                Phone: c.phone,
                Position: c.interestedPosition || '-',
                'Rejection Stage': c.round2Recommendation === 'reject' ? 'Round 2' : c.round1Recommendation === 'reject' ? 'Round 1' : 'Screening',
                'Applied Date': safeFormat(c.appliedAt, 'yyyy-MM-dd'),
            }));
            const worksheet = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Rejected Candidates');
        }

        if (selectedReports.onboarding) {
            const data = filteredCandidates.filter(c => ['onboarding', 'onboarded'].includes(c.status)).map(c => ({
                Name: c.name,
                Email: c.email,
                Status: c.status,
                'Joining Date': safeFormat(c.dateOfJoining, 'yyyy-MM-dd'),
            }));
            const worksheet = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Onboarding');
        }

        if (selectedReports.offers) {
            const data = filteredCandidates.filter(c => ['offer_rolled', 'offer_accepted'].includes(c.status)).map(c => ({
                Name: c.name,
                Email: c.email,
                Status: c.status,
                'Offered CTC': c.offeredCTC || '-',
            }));
            const worksheet = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Offers');
        }


        XLSX.writeFile(workbook, `Recruitment_All_Report_${safeFormat(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Download Reports</DialogTitle>
                    <DialogDescription>
                        Select the reports you want to include in the Excel file.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex items-center space-x-2 pb-2 border-b">
                        <Checkbox
                            id="select-all"
                            checked={isAllSelected}
                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        />
                        <Label
                            htmlFor="select-all"
                            className="text-sm font-bold leading-none cursor-pointer"
                        >
                            Select All
                        </Label>
                    </div>
                    {reportOptions.map((option) => (
                        <div key={option.id} className="flex items-center space-x-2">
                            <Checkbox
                                id={option.id}
                                checked={selectedReports[option.id as keyof typeof selectedReports]}
                                onCheckedChange={() => handleToggle(option.id)}
                            />
                            <Label
                                htmlFor={option.id}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                {option.label}
                            </Label>
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={downloadExcel} className="group">
                        <AnimateIcon animateOnHover animation="bounce" className="mr-2">
                            <Download className="h-4 w-4" />
                        </AnimateIcon>
                        Download Excel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
