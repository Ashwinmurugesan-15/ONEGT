'use client';

import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { mockCandidates, mockDemands } from '@/data/mockData';
import { Candidate } from '@/types/recruitment';
import { Button } from '@/components/ui/button';
import { Download, Plus, Check } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// Components
import { CandidateFilters, FilterState } from '@/components/candidates/CandidateFilters';
import { CandidateTable, Column, defaultColumns } from '@/components/candidates/CandidateTable';

// Dialogs
import { CandidateProfileDialog } from '@/components/dialogs/CandidateProfileDialog';
import { ResumeDialog } from '@/components/dialogs/ResumeDialog';
import { ScheduleInterviewDialog } from '@/components/dialogs/ScheduleInterviewDialog';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { InitialScreeningDialog } from '@/components/dialogs/InitialScreeningDialog';
import { RejectionEmailDialog } from '@/components/dialogs/RejectionEmailDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';


import { useRecruitment } from '@/context/RecruitmentContext';

const Candidates = () => {
  const { filteredCandidates: candidates, addCandidate, applyCandidate, updateCandidate, updateCandidateStatus, saveScreeningFeedback, updateInterviewStatus, deleteCandidate } = useRecruitment();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // File state for Guhatek API
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Parse query parameters
  const queryParams = searchParams;
  const initialDemandId = queryParams?.get('demandId') || '';
  const initialStatus = queryParams?.get('status') || 'all';

  const getDemandTitle = (demandId: string) => {
    const titleMap: Record<string, string> = {
      'sre': 'Site Reliability Engineer',
      'senior-sre': 'Senior Site Reliability Engineer',
      'lead-sre': 'Lead Site Reliability Engineer',
      'app-sre': 'Application Site Reliability Engineer',
      'soc-engineer': 'Security Operations Centre Engineer',
      'performance-engineer': 'Performance Engineer',
      'qa-automation': 'QA Automation Engineer (Playwright & Selenium)',
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
    return titleMap[demandId] || mockDemands.find((d) => d.id === demandId)?.title || demandId || 'Unknown';
  };

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: initialStatus as FilterState['status'],
    position: initialDemandId ? getDemandTitle(initialDemandId) : 'All Positions',
    location: 'All Location',
    experience: 'Any Experience',
    noticePeriod: 'Any Notice Period',
    feedbackFilter: 'all',
  });

  // Apply initial filters from URL
  React.useEffect(() => {
    const demandId = searchParams.get('demandId');
    const status = searchParams.get('status');

    if (demandId || status) {
      setFilters(prev => ({
        ...prev,
        status: (status || 'all') as any,
      }));
    }
  }, [searchParams]);

  // Columns State
  const [columns, setColumns] = useState<Column[]>(defaultColumns);

  const handleColumnToggle = (key: string) => {
    setColumns(cols =>
      cols.map(col =>
        col.key === key ? { ...col, visible: !col.visible } : col
      )
    );
  };

  // Dialog States
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isResumeOpen, setIsResumeOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isMoveForwardOpen, setIsMoveForwardOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isScreeningOpen, setIsScreeningOpen] = useState(false);

  // Add Candidate State
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [newCandidateData, setNewCandidateData] = useState({
    name: '',
    email: '',
    phone: '',
    demandId: '',
    experience: '',
    currentCompany: '',
    currentRole: '',
    skills: '',
    source: 'career_portal' as Candidate['source'],
    location: '',
    locationPreference: '',
    currentCTC: '',
    expectedCTC: '',
    offeredCTC: '',
    offeredPosition: '',
    noticePeriod: '',
    isServingNotice: false,
    isImmediateJoiner: false,
    linkedInProfile: '',
    resumeUrl: '',
    hasOtherOffers: false,
    otherOfferCTC: '',
    certifications: '',
    referredBy: '',
  });

  // Helper helpers for filtering
  const parseExperience = (exp: any): number => {
    if (!exp) return 0;
    const strExp = String(exp);
    const match = strExp.match(/(\d+)/);
    return match ? parseInt(match[0]) : 0;
  };

  const parseNoticePeriod = (np: string): number => {
    if (!np) return 0;
    if (np.toLowerCase().includes('immediate')) return 0;
    const match = np.match(/(\d+)/);
    return match ? parseInt(match[0]) : 0;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Set the file in state for the API submission
    setSelectedFile(file);

    // For UI feedback, just set a fake URL or the file name
    setNewCandidateData(prev => ({ ...prev, resumeUrl: URL.createObjectURL(file) }));
    toast.success('File selected: ' + file.name);
  };

  // Filter Logic
  const filteredCandidates = useMemo(() => {
    // Get query parameters for additional filtering
    const demandId = searchParams.get('demandId');
    const statusParam = searchParams.get('status');
    const currentRoundParam = searchParams.get('currentRound');

    return candidates.filter(candidate => {
      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const matchesSearch =
          (candidate.name?.toLowerCase() || '').includes(search) ||
          (candidate.email?.toLowerCase() || '').includes(search) ||
          (Array.isArray(candidate.skills) ? candidate.skills.some(s => s.toLowerCase().includes(search)) : false);
        if (!matchesSearch) return false;
      }

      // Status filter - handle both single and multiple statuses
      const statusFilter = statusParam || filters.status;
      if (statusFilter !== 'all') {
        const statuses = statusFilter.split(',');
        const isRejectedRequested = statuses.includes('rejected');

        const isCandidateRejected = statuses.includes(candidate.status) ||
          (isRejectedRequested && (candidate.round1Recommendation === 'reject' || candidate.round2Recommendation === 'reject'));

        if (!isCandidateRejected) {
          return false;
        }
      } else {
        // By default (All), hide rejected candidates to show only active pipeline.
        // This resolves the count mismatch and adheres to the request to hide Round 1 rejects.
        if (candidate.status === 'rejected' || candidate.round1Recommendation === 'reject' || candidate.round2Recommendation === 'reject') {
          return false;
        }
      }

      // Current Round filter from URL
      if (currentRoundParam) {
        if (currentRoundParam === 'undefined') {
          // For screening rejection, check if currentRound is undefined or null
          if (candidate.currentRound !== undefined && candidate.currentRound !== null) {
            return false;
          }
        } else {
          // For specific rounds, check exact match or specific recommendation
          const round = parseInt(currentRoundParam, 10);
          const isRoundMatch = candidate.currentRound === round ||
            (round === 1 && candidate.round1Recommendation === 'reject') ||
            (round === 2 && candidate.round2Recommendation === 'reject');

          if (!isRoundMatch) {
            return false;
          }
        }
      }

      // Demand ID filter from URL
      if (demandId && candidate.demandId !== demandId) {
        return false;
      }

      // Position Filter
      if (filters.position !== 'All Positions') {
        const positionTitle = getDemandTitle(candidate.demandId);
        // Handle "Internship" / "Fresher" if they are specific titles, otherwise general matching
        // User list included "Internship", "Fresher". Assuming these might be part of title or special handling.
        // For now, doing exact title match logic.
        if (positionTitle !== filters.position) {
          // Fallback: If filter is "Internship" or "Fresher", check if title includes it
          if ((filters.position === 'Internship' || filters.position === 'Fresher') && positionTitle.includes(filters.position)) {
            // match
          } else {
            return false;
          }
        }
      }

      // Location Filter
      if (filters.location !== 'All Location') {
        const candLocation = candidate.location || '';
        if (filters.location === 'Others') {
          if (['Bangalore', 'Chennai', 'Coimbatore'].some(city => candLocation.includes(city))) {
            return false;
          }
        } else if (!candLocation.includes(filters.location)) {
          return false;
        }
      }

      // Experience Filter
      if (filters.experience !== 'Any Experience') {
        const expYears = parseExperience(candidate.experience);
        const [min, maxPart] = filters.experience.split('-');

        if (filters.experience === '10+ Years') {
          if (expYears < 10) return false;
        } else if (filters.experience === '0-1 Year') {
          if (expYears > 1) return false;
        } else if (maxPart) {
          const minYear = parseInt(min);
          const maxYear = parseInt(maxPart); // "3 Years" -> 3
          if (expYears < minYear || expYears > maxYear) return false;
        }
      }

      // Notice Period Filter
      if (filters.noticePeriod !== 'Any Notice Period') {
        if (filters.noticePeriod === 'Immediate') {
          if (!candidate.isImmediateJoiner && !candidate.noticePeriod?.toLowerCase().includes('immediate')) {
            return false;
          }
        } else {
          const filterDays = parseNoticePeriod(filters.noticePeriod);
          const candDays = parseNoticePeriod(candidate.noticePeriod || '');
          // Use a tolerance or exact match? Likely approximate bucket or exact match if data is clean.
          // Given the strict options "15 Days", "30 Days", assuming strict buckets.
          // But data might be "30 days" or "1 month".
          // Let's use exact match logic on difference < 5 days tolerance?
          // Or better, check if candidate ranges around the filter.
          // Simple approach: exact number match
          if (candDays !== filterDays) return false;
        }
      }

      // Feedback Filter
      if (filters.feedbackFilter !== 'all') {
        switch (filters.feedbackFilter) {
          case 'has_screening':
            if (!candidate.screeningFeedback) return false;
            break;
          case 'has_round1':
            if (!candidate.round1Recommendation) return false;
            break;
          case 'has_round2':
            if (!candidate.round2Recommendation) return false;
            break;
          case 'no_screening':
            if (candidate.screeningFeedback) return false;
            break;
          case 'no_round1':
            if (candidate.round1Recommendation) return false;
            break;
          case 'no_round2':
            if (candidate.round2Recommendation) return false;
            break;
        }
      }

      return true;
    });
  }, [candidates, filters, searchParams]);

  // Actions
  const handleViewCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setIsProfileOpen(true);
  };

  const handleEditCandidate = (candidate: Candidate) => {
    setNewCandidateData({
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone || '',
      demandId: candidate.demandId,
      experience: candidate.experience || '',
      currentCompany: candidate.currentCompany || '',
      currentRole: candidate.currentRole || '',
      skills: candidate.skills ? candidate.skills.join(', ') : '',
      source: (candidate.source as any) || 'career_portal',
      location: candidate.location || '',
      locationPreference: candidate.locationPreference || '',
      currentCTC: candidate.currentCTC || '',
      expectedCTC: candidate.expectedCTC || '',
      offeredCTC: (candidate as any).offeredCTC || '',
      offeredPosition: (candidate as any).offeredPosition || '',
      noticePeriod: candidate.noticePeriod || '',
      isServingNotice: candidate.isServingNotice || false,
      isImmediateJoiner: candidate.isImmediateJoiner || false,
      linkedInProfile: candidate.linkedInProfile || '',
      resumeUrl: candidate.resumeUrl || '',
      hasOtherOffers: candidate.hasOtherOffers || false,
      otherOfferCTC: candidate.otherOfferCTC || '',
      certifications: candidate.certifications ? candidate.certifications.join(', ') : '',
      referredBy: candidate.referredBy || '',
    });
    setIsEditMode(true);
    setIsAddCandidateOpen(true);
  };

  const handleViewResume = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setIsResumeOpen(true);
  };

  const handleScheduleInterview = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setIsScheduleOpen(true);
  };

  const handleMoveForward = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setIsMoveForwardOpen(true);
  };

  const handleReject = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setIsRejectOpen(true);
  };

  const handleInitialScreening = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setIsScreeningOpen(true);
  };

  const handleExport = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Position', 'Status', 'Applied Date', 'Round', 'Source'],
      ...filteredCandidates.map(c => [
        c.name,
        c.email,
        c.phone,
        getDemandTitle(c.demandId),
        c.status,
        (() => {
          const d = new Date(c.appliedAt || '');
          return !isNaN(d.getTime()) ? format(d, 'yyyy-MM-dd') : 'N/A';
        })(),
        c.currentRound || 'N/A',
        c.source || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candidates-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Candidates exported successfully!');
  };

  const handleAddCandidate = async () => {
    // Validation
    if (!newCandidateData.name || !newCandidateData.email || !newCandidateData.demandId) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!newCandidateData.phone || newCandidateData.phone.length !== 10) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }

    if (!isEditMode && !selectedFile) {
      toast.error('Resume is required for new candidates');
      return;
    }

    // Construct common data object
    const candidateData: Partial<Candidate> = {
      name: newCandidateData.name,
      email: newCandidateData.email,
      phone: newCandidateData.phone,
      demandId: newCandidateData.demandId,
      skills: newCandidateData.skills ? newCandidateData.skills.split(',').map(s => s.trim()) : [],
      source: newCandidateData.source,
      experience: newCandidateData.experience || '0 years',
      currentCompany: newCandidateData.currentCompany || '',
      currentRole: newCandidateData.currentRole || '',
      location: newCandidateData.location || '',
      locationPreference: newCandidateData.locationPreference || '',
      currentCTC: newCandidateData.currentCTC || '',
      expectedCTC: newCandidateData.expectedCTC || '',
      noticePeriod: newCandidateData.noticePeriod || '',
      isServingNotice: newCandidateData.isServingNotice,
      isImmediateJoiner: newCandidateData.isImmediateJoiner,
      linkedInProfile: newCandidateData.linkedInProfile || '',
      resumeUrl: newCandidateData.resumeUrl || '#',
      hasOtherOffers: newCandidateData.hasOtherOffers,
      otherOfferCTC: newCandidateData.otherOfferCTC || '',
      certifications: newCandidateData.certifications ? newCandidateData.certifications.split(',').map(s => s.trim()) : [],
      referredBy: newCandidateData.referredBy || '',
    };

    const toastId = toast.loading('Submitting application...');

    try {
      if (isEditMode && selectedCandidate) {
        // UPDATE FLOW
        const apiUpdates = {
          fullName: newCandidateData.name,
          email: newCandidateData.email,
          contactNumber: newCandidateData.phone,
          interestedPosition: getDemandTitle(newCandidateData.demandId),
          currentRole: newCandidateData.currentRole,
          currentOrganization: newCandidateData.currentCompany,
          totalExperience: parseExperience(newCandidateData.experience || '0'),
          currentLocation: newCandidateData.location,
          locationPreference: newCandidateData.locationPreference,
          currentCTC: parseInt(newCandidateData.currentCTC || '0'),
          expectedCTC: parseInt(newCandidateData.expectedCTC || '0'),
          noticePeriod: newCandidateData.noticePeriod,
          currentlyInNotice: newCandidateData.isServingNotice,
          immediateJoiner: newCandidateData.isImmediateJoiner,
          linkedinProfile: newCandidateData.linkedInProfile,
          otherOffersInHand: newCandidateData.hasOtherOffers,
          certifications: newCandidateData.certifications ? newCandidateData.certifications.split(',').map(s => s.trim()) : [],
          skills: newCandidateData.skills ? newCandidateData.skills.split(',').map(s => s.trim()) : [],
          referredBy: newCandidateData.referredBy,
        };

        // Update via context (API + Local State)
        await updateCandidate(selectedCandidate.id, {
          ...apiUpdates,
          expectedCTC: String(apiUpdates.expectedCTC),
          currentCTC: String(apiUpdates.currentCTC),
        } as any);

        toast.dismiss(toastId);
        toast.success('Candidate updated successfully');
        handleCloseDialog();

      } else {
        // INSERT FLOW
        if (!selectedFile) {
          toast.dismiss(toastId);
          toast.error('File missing for new application');
          return;
        }

        const apiData = {
          fullName: newCandidateData.name,
          email: newCandidateData.email,
          contactNumber: newCandidateData.phone,
          interestedPosition: getDemandTitle(newCandidateData.demandId),
          status: 'Applied',
          currentRole: newCandidateData.currentRole,
          currentOrganization: newCandidateData.currentCompany,
          totalExperience: parseExperience(newCandidateData.experience || '0'),
          currentLocation: newCandidateData.location,
          locationPreference: newCandidateData.locationPreference,
          currentCTC: parseInt(newCandidateData.currentCTC || '0'),
          expectedCTC: parseInt(newCandidateData.expectedCTC || '0'),
          noticePeriod: newCandidateData.noticePeriod,
          currentlyInNotice: newCandidateData.isServingNotice,
          immediateJoiner: newCandidateData.isImmediateJoiner,
          linkedinProfile: newCandidateData.linkedInProfile,
          otherOffersInHand: newCandidateData.hasOtherOffers,
          certifications: newCandidateData.certifications ? newCandidateData.certifications.split(',').map(s => s.trim()) : [],
          skills: newCandidateData.skills ? newCandidateData.skills.split(',').map(s => s.trim()) : [],
          referredBy: newCandidateData.referredBy,
        };

        // 1. Submit application with resume via applyCandidate
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('applicationData', JSON.stringify(apiData));

        const fallbackCandidateData = {
          ...candidateData,
          status: 'applied' as const,
          skills: candidateData.skills || [],
          experience: candidateData.experience || '0 years',
          source: (candidateData.source || 'career_portal') as any,
        } as Omit<Candidate, 'id' | 'appliedAt' | 'resumeUrl'>;

        await applyCandidate(formData, fallbackCandidateData);
        toast.dismiss(toastId);
        toast.success('Application submitted successfully via Guhatek API');
        handleCloseDialog();
      }

    } catch (error: any) {
      console.error('Submission error:', error);
      toast.dismiss(toastId);
      toast.error('Failed to submit application: ' + error.message);
    }
  };

  const handleDeleteCandidate = async (candidate: Candidate) => {
    try {
      if (confirm(`Are you sure you want to delete ${candidate.name}?`)) {
        deleteCandidate(candidate.id);
        setIsProfileOpen(false);
      }
    } catch (error: any) {
      toast.error('Failed to delete candidate: ' + error.message);
    }
  };

  const handleCloseDialog = () => {
    setIsAddCandidateOpen(false);
    setIsEditMode(false);
    setNewCandidateData({
      name: '',
      email: '',
      phone: '',
      demandId: '',
      experience: '',
      currentCompany: '',
      currentRole: '',
      skills: '',
      source: 'career_portal' as Candidate['source'],
      location: '',
      locationPreference: '',
      currentCTC: '',
      expectedCTC: '',
      offeredCTC: '',
      offeredPosition: '',
      noticePeriod: '',
      isServingNotice: false,
      isImmediateJoiner: false,
      linkedInProfile: '',
      resumeUrl: '',
      hasOtherOffers: false,
      otherOfferCTC: '',
      certifications: '',
      referredBy: '',
    });
    setSelectedFile(null);
  };

  // Dialog Handlers (reused)
  const confirmMoveForward = () => {
    if (!selectedCandidate) return;

    // Auto-update status when moving forward from 'applied'
    if (selectedCandidate.status === 'applied') {
      updateCandidateStatus(selectedCandidate.id, 'screening');
    }

    toast.success(`Moved ${selectedCandidate.name} forward`);
    setIsMoveForwardOpen(false);
  };

  const confirmReject = () => {
    if (!selectedCandidate) return;
    updateCandidateStatus(selectedCandidate.id, 'rejected');
  };

  const handleStatusUpdate = (id: string, status: Candidate['status']) => {
    if (status === 'rejected') {
      const candidate = candidates.find(c => c.id === id);
      if (candidate) {
        setSelectedCandidate(candidate);
        setIsRejectOpen(true);
        return;
      }
    }
    updateCandidateStatus(id, status);
  };

  return (
    <DashboardLayout title="Candidates">
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Candidate Pipeline</h2>
            <p className="text-muted-foreground">{filteredCandidates.length} candidates found</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button size="sm" onClick={() => { setIsEditMode(false); setIsAddCandidateOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Candidate
            </Button>
          </div>
        </div>

        {/* Filters and Actions Bar */}
        <div className="flex flex-col gap-2">
          <CandidateFilters
            onFilterChange={setFilters}
            columns={columns}
            onColumnToggle={handleColumnToggle}
          />
        </div>

        {/* Table */}
        <CandidateTable
          candidates={filteredCandidates}
          onViewCandidate={handleViewCandidate}
          onViewResume={handleViewResume}
          onScheduleInterview={handleScheduleInterview}
          onMoveForward={handleMoveForward}
          onReject={handleReject}
          onInitialScreening={handleInitialScreening}
          onStatusChange={handleStatusUpdate}
          onInterviewStatusChange={updateInterviewStatus}
          columns={columns}
          onColumnToggle={handleColumnToggle}
        />

        {/* Dialogs */}
        <CandidateProfileDialog
          candidate={selectedCandidate}
          open={isProfileOpen}
          onOpenChange={setIsProfileOpen}
          onViewResume={(c) => {
            setIsProfileOpen(false);
            setSelectedCandidate(c);
            setIsResumeOpen(true);
          }}
          onMoveForward={() => {
            setIsProfileOpen(false);
            setIsMoveForwardOpen(true);
          }}
          onReject={() => {
            setIsProfileOpen(false);
            setIsRejectOpen(true);
          }}
          onEdit={() => {
            setIsProfileOpen(false);
            setIsEditMode(true);
            setIsAddCandidateOpen(true);
            // Pre-fill form
            setNewCandidateData({
              // ... (existing pre-fill logic)
              name: selectedCandidate?.name || '',
              email: selectedCandidate?.email || '',
              phone: selectedCandidate?.phone || '',
              demandId: selectedCandidate?.demandId || '',
              experience: selectedCandidate?.experience || '',
              currentCompany: selectedCandidate?.currentCompany || '',
              currentRole: selectedCandidate?.currentRole || '',
              skills: (selectedCandidate?.skills || []).join(', '),
              source: selectedCandidate?.source || 'career_portal',
              location: selectedCandidate?.location || '',
              locationPreference: selectedCandidate?.locationPreference || '',
              currentCTC: String(selectedCandidate?.currentCTC || ''),
              expectedCTC: String(selectedCandidate?.expectedCTC || ''),
              offeredCTC: String((selectedCandidate as any)?.offeredCTC || ''),
              offeredPosition: String((selectedCandidate as any)?.offeredPosition || ''),
              noticePeriod: selectedCandidate?.noticePeriod || '',
              isServingNotice: selectedCandidate?.isServingNotice || false,
              isImmediateJoiner: selectedCandidate?.isImmediateJoiner || false,
              linkedInProfile: selectedCandidate?.linkedInProfile || '',
              resumeUrl: selectedCandidate?.resumeUrl || '',
              hasOtherOffers: selectedCandidate?.hasOtherOffers || false,
              otherOfferCTC: String(selectedCandidate?.otherOfferCTC || ''),
              certifications: (selectedCandidate?.certifications || []).join(', '),
              referredBy: selectedCandidate?.referredBy || '',
            });
          }}
          onDelete={handleDeleteCandidate}
        />

        <ResumeDialog
          candidate={selectedCandidate}
          open={isResumeOpen}
          onOpenChange={setIsResumeOpen}
        />

        <ScheduleInterviewDialog
          candidate={selectedCandidate}
          open={isScheduleOpen}
          onOpenChange={setIsScheduleOpen}
        />

        <ConfirmDialog
          open={isMoveForwardOpen}
          onOpenChange={setIsMoveForwardOpen}
          title="Move Candidate Forward"
          description={`Are you sure you want to move ${selectedCandidate?.name} to the next stage?`}
          confirmLabel="Move Forward"
          onConfirm={confirmMoveForward}
        />

        <RejectionEmailDialog
          candidate={selectedCandidate}
          open={isRejectOpen}
          onOpenChange={setIsRejectOpen}
          onConfirm={confirmReject}
        />

        <InitialScreeningDialog
          candidate={selectedCandidate}
          open={isScreeningOpen}
          onOpenChange={setIsScreeningOpen}
          onSave={saveScreeningFeedback}
        />

        {/* Add/Edit Candidate Dialog */}
        <Dialog open={isAddCandidateOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setIsAddCandidateOpen(true); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Edit Candidate' : 'Add New Candidate'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={newCandidateData.name}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, name: e.target.value })}
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={newCandidateData.email}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input
                    value={newCandidateData.phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setNewCandidateData({ ...newCandidateData, phone: val });
                    }}
                    placeholder="9876543210"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interest Position *</Label>
                  <Select
                    value={newCandidateData.demandId}
                    onValueChange={(val) => setNewCandidateData({ ...newCandidateData, demandId: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sre">Site Reliability Engineer</SelectItem>
                      <SelectItem value="senior-sre">Senior Site Reliability Engineer</SelectItem>
                      <SelectItem value="lead-sre">Lead Site Reliability Engineer</SelectItem>
                      <SelectItem value="app-sre">Application Site Reliability Engineer</SelectItem>
                      <SelectItem value="soc-engineer">Security Operations Centre Engineer</SelectItem>
                      <SelectItem value="performance-engineer">Performance Engineer</SelectItem>
                      <SelectItem value="qa-automation">QA Automation Engineer (Playwright & Selenium)</SelectItem>
                      <SelectItem value="devops">DevOps Engineer</SelectItem>
                      <SelectItem value="lead-sap">Lead SAP Engineer</SelectItem>
                      <SelectItem value="ai-ml">AI/ML Engineer</SelectItem>
                      <SelectItem value="ai-ml-intern">AI/ML Intern</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                      <SelectItem value="fresher">Fresher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Current Role & Company */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Current Role</Label>
                  <Input
                    value={newCandidateData.currentRole}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, currentRole: e.target.value })}
                    placeholder="e.g. Senior Developer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Current Company</Label>
                  <Input
                    value={newCandidateData.currentCompany}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, currentCompany: e.target.value })}
                    placeholder="e.g. Acme Corp"
                  />
                </div>
              </div>

              {/* Experience & Skills */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Experience</Label>
                  <Input
                    value={newCandidateData.experience}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, experience: e.target.value })}
                    placeholder="e.g. 5 years"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Skills (comma-separated)</Label>
                  <Input
                    value={newCandidateData.skills}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, skills: e.target.value })}
                    placeholder="e.g. React, Node.js, AWS"
                  />
                </div>
              </div>



              {/* LinkedIn & Resume */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>LinkedIn Profile</Label>
                  <Input
                    value={newCandidateData.linkedInProfile}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, linkedInProfile: e.target.value })}
                    placeholder="linkedin.com/in/username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Resume (PDF/DOC) *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="cursor-pointer file:text-foreground"
                    />
                    {newCandidateData.resumeUrl && (
                      <Check className="text-green-500 w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Current Location</Label>
                  <Input
                    value={newCandidateData.location}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, location: e.target.value })}
                    placeholder="e.g. Bangalore"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location Preference</Label>
                  <Input
                    value={newCandidateData.locationPreference}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, locationPreference: e.target.value })}
                    placeholder="e.g. Bangalore, Chennai"
                  />
                </div>
              </div>

              {/* CTC */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Current CTC</Label>
                  <Input
                    value={newCandidateData.currentCTC}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, currentCTC: e.target.value })}
                    placeholder="e.g. 12 LPA"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expected CTC</Label>
                  <Input
                    value={newCandidateData.expectedCTC}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, expectedCTC: e.target.value })}
                    placeholder="e.g. 15 LPA"
                  />
                </div>
              </div>
              {/* Notice Period */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Notice Period</Label>
                  <Input
                    value={newCandidateData.noticePeriod}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, noticePeriod: e.target.value })}
                    placeholder="e.g. 30 days"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Certifications (comma-separated)</Label>
                  <Input
                    value={newCandidateData.certifications}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, certifications: e.target.value })}
                    placeholder="e.g. AWS Certified, Azure"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isServingNotice"
                    checked={newCandidateData.isServingNotice}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, isServingNotice: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isServingNotice">Serving Notice</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isImmediateJoiner"
                    checked={newCandidateData.isImmediateJoiner}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, isImmediateJoiner: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isImmediateJoiner">Immediate Joiner</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="hasOtherOffers"
                    checked={newCandidateData.hasOtherOffers}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, hasOtherOffers: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="hasOtherOffers">Has Other Offers</Label>
                </div>
              </div>

              {/* Other Offer CTC & Referred By */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Other Offer CTC</Label>
                  <Input
                    value={newCandidateData.otherOfferCTC}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, otherOfferCTC: e.target.value })}
                    placeholder="e.g. 14 LPA"
                    disabled={!newCandidateData.hasOtherOffers}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Referred By</Label>
                  <Input
                    value={newCandidateData.referredBy}
                    onChange={(e) => setNewCandidateData({ ...newCandidateData, referredBy: e.target.value })}
                    placeholder="e.g. John Smith"
                  />
                </div>
              </div>

              {/* Offered CTC & Offered Position — edit mode only */}
              {isEditMode && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Offered CTC</Label>
                    <Input
                      value={newCandidateData.offeredCTC}
                      onChange={(e) => setNewCandidateData({ ...newCandidateData, offeredCTC: e.target.value })}
                      placeholder="e.g. 18 LPA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Offered Position</Label>
                    <Input
                      value={newCandidateData.offeredPosition}
                      onChange={(e) => setNewCandidateData({ ...newCandidateData, offeredPosition: e.target.value })}
                      placeholder="e.g. Senior Engineer"
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button onClick={handleAddCandidate}>
                {isEditMode ? 'Save Changes' : 'Add Candidate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Candidates;
