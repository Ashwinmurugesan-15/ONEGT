import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarIcon, Clock, Video, MessageSquare, Mail, Send, CheckCircle2, XCircle, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { format, isSameDay, isSameWeek, isSameMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Interview, Candidate, InterviewRound } from '@/types/recruitment';

import { useRecruitment } from '@/context/RecruitmentContext';
import { InterviewCalendar } from '@/components/interviews/InterviewCalendar';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const replacePlaceholders = (template: string, data: Record<string, string>) => {
  let result = template;
  Object.entries(data).forEach(([key, value]) => {
    // Escape special characters for regex
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\[${escapedKey}\\]`, 'g'), value);
  });
  return result;
};

const countWords = (text: string) => {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

const Interviews = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { updateCandidateFeedback, updateCandidateStatus, filteredInterviews: interviews, candidates, updateInterview, emailTemplates, sendEmail } = useRecruitment();
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false); // New state for details
  const [isSending, setIsSending] = useState(false);
  const [feedbackRound, setFeedbackRound] = useState<InterviewRound>(1);
  const [hasRound1Feedback, setHasRound1Feedback] = useState(false);
  const [isRound1DetailsOpen, setIsRound1DetailsOpen] = useState(false);
  const [isViewRound1Open, setIsViewRound1Open] = useState(false);

  const interviewId = searchParams.get('interviewId');

  useEffect(() => {
    if (interviewId && interviews.length > 0) {
      const interview = interviews.find(i => i.id === interviewId);
      if (interview) {
        setSelectedInterview(interview);
        setIsDetailsOpen(true);
      }
    }
  }, [interviewId, interviews]);
  const [round1Feedback, setRound1Feedback] = useState({
    communication: '',
    technicalAssessment: '',
    problemSolving: '',
    overallPotential: '',
    comments: '',
    recommendation: 'proceed_to_round2' as 'proceed_to_round2' | 'reject',
  });
  const [round2Feedback, setRound2Feedback] = useState({
    communication: '',
    technicalAssessment: '',
    problemSolving: '',
    overallPotential: '',
    recommendation: '',
    comments: '',
    ctc: '',
  });
  const [clientFeedback, setClientFeedback] = useState({
    communication: '',
    technicalAssessment: '',
    problemSolving: '',
    overallPotential: '',
    feedback: '',
    recommendation: 'proceed_to_offer' as 'proceed_to_offer' | 'reject',
  });
  const [emailContent, setEmailContent] = useState({
    subject: '',
    body: '',
  });

  // Calendar state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  // Position filter state
  const [selectedPosition, setSelectedPosition] = useState<string>('All Positions');

  // Position options (reused from CandidateFilters)
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

  const scheduledInterviews = interviews
    .filter((i) => i.status === 'scheduled')
    .filter((i) => {
      // Deep linking filter
      if (interviewId) {
        return i.id === interviewId;
      }
      return selectedPosition === 'All Positions' || i.demandTitle === selectedPosition;
    })
    .filter(i => i.scheduledAt instanceof Date && !isNaN(i.scheduledAt.getTime()))
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  const groupedByDate = (selectedDate ? scheduledInterviews.filter(interview =>
    format(interview.scheduledAt, 'yyyy-MM-dd') === selectedDate
  ) : scheduledInterviews).reduce((acc, interview) => {
    const date = format(interview.scheduledAt, 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(interview);
    return acc;
  }, {} as Record<string, typeof scheduledInterviews>);

  // Calculate interview counts
  const today = new Date();
  const todayInterviews = scheduledInterviews.filter(interview =>
    isSameDay(interview.scheduledAt, today)
  ).length;

  const thisWeekInterviews = scheduledInterviews.filter(interview =>
    isSameWeek(interview.scheduledAt, today)
  ).length;

  const thisMonthInterviews = scheduledInterviews.filter(interview =>
    isSameMonth(interview.scheduledAt, today)
  ).length;

  const handleViewRound1Feedback = (interview: Interview) => {
    // Similar logic to handleOpenFeedback but just for viewing R1
    setSelectedInterview(interview);

    const candidate = candidates.find(c => c.id === interview.candidateId);
    if (!candidate) return;

    // Load Round 1 feedback
    let r1Data: any = {};
    if (candidate.round1Feedback) {
      try {
        r1Data = JSON.parse(candidate.round1Feedback);
        setHasRound1Feedback(true);
      } catch (e) {
        console.error('Error parsing Round 1 feedback', e);
        setHasRound1Feedback(false);
      }
    } else {
      setHasRound1Feedback(false);
    }

    setRound1Feedback({
      communication: r1Data.communication || '',
      technicalAssessment: r1Data.technicalAssessment || '',
      problemSolving: r1Data.problemSolving || '',
      overallPotential: r1Data.overallPotential || '',
      comments: r1Data.comments || r1Data.feedback || '',
      recommendation: r1Data.recommendation || candidate.round1Recommendation || 'proceed_to_round2',
    });

    setIsViewRound1Open(true);
  };

  const handleOpenFeedback = (interview: Interview) => {
    setSelectedInterview(interview);
    setFeedbackRound(interview.round || 1);
    setIsRound1DetailsOpen(false);

    const candidate = candidates.find(c => c.id === interview.candidateId);
    if (!candidate) {
      toast.error('Candidate linkage missing. Feedback cannot be saved correctly.');
      // Initialize with empty defaults if candidate not found
      setRound1Feedback({
        communication: '',
        technicalAssessment: '',
        problemSolving: '',
        overallPotential: '',
        comments: '',
        recommendation: 'proceed_to_round2',
      });
      setRound2Feedback({
        communication: '',
        technicalAssessment: '',
        problemSolving: '',
        overallPotential: '',
        recommendation: '',
        comments: '',
        ctc: '',
      });
      setClientFeedback({
        communication: '',
        technicalAssessment: '',
        problemSolving: '',
        overallPotential: '',
        feedback: '',
        recommendation: 'proceed_to_offer',
      });
      setHasRound1Feedback(false);
      setIsFeedbackOpen(true);
      return;
    }

    // Parse existing feedback for the CURRENT round to pre-fill the form
    let data: any = {};
    const existingFeedback = interview.round === 1 ? candidate.round1Feedback : (interview.round === 2 ? candidate.round2Feedback : candidate.clientFeedback);

    if (existingFeedback) {
      try {
        data = JSON.parse(existingFeedback);
      } catch (e) {
        console.error('Error parsing feedback', e);
      }
    }

    // Always try to load Round 1 feedback specifically, for display in Round 2
    let r1Data: any = {};
    if (candidate.round1Feedback) {
      try {
        r1Data = JSON.parse(candidate.round1Feedback);
        setHasRound1Feedback(true);
      } catch (e) {
        console.error('Error parsing Round 1 feedback', e);
        setHasRound1Feedback(false);
      }
    } else {
      setHasRound1Feedback(false);
    }

    // If we are editing Round 1, use 'data' (which is round1Feedback).
    // If we are editing Round 2, use 'r1Data' to populate the read-only view of Round 1.
    setRound1Feedback({
      communication: (interview.round === 1 ? data.communication : r1Data.communication) || '',
      technicalAssessment: (interview.round === 1 ? data.technicalAssessment : r1Data.technicalAssessment) || '',
      problemSolving: (interview.round === 1 ? data.problemSolving : r1Data.problemSolving) || '',
      overallPotential: (interview.round === 1 ? data.overallPotential : r1Data.overallPotential) || '',
      comments: (interview.round === 1 ? (data.comments || data.feedback) : (r1Data.comments || r1Data.feedback)) || '',
      recommendation: (interview.round === 1 ? (data.recommendation || candidate.round1Recommendation) : (r1Data.recommendation || candidate.round1Recommendation)) || 'proceed_to_round2',
    });

    setRound2Feedback({
      communication: (interview.round === 2 ? data.communication : '') || '',
      technicalAssessment: (interview.round === 2 ? data.technicalAssessment : '') || '',
      problemSolving: (interview.round === 2 ? data.problemSolving : '') || '',
      overallPotential: (interview.round === 2 ? data.overallPotential : '') || '',
      recommendation: (interview.round === 2 ? (data.recommendation || candidate.round2Recommendation) : '') || '',
      comments: (interview.round === 2 ? data.comments : '') || '',
      ctc: (interview.round === 2 ? data.ctc : '') || '',
    });

    setClientFeedback({
      communication: (interview.round === 'client' ? data.communication : '') || '',
      technicalAssessment: (interview.round === 'client' ? data.technicalAssessment : '') || '',
      problemSolving: (interview.round === 'client' ? data.problemSolving : '') || '',
      overallPotential: (interview.round === 'client' ? data.overallPotential : '') || '',
      feedback: (interview.round === 'client' ? (data.feedback || data.comments) : '') || '',
      recommendation: (interview.round === 'client' ? (data.recommendation || candidate.clientRecommendation) : '') || 'proceed_to_offer',
    });

    setIsFeedbackOpen(true);
  };

  const handleSubmitFeedback = async (isReject: boolean = false) => {
    if (!selectedInterview) return;

    const isRound1 = Number(feedbackRound) === 1;
    const isRound2 = Number(feedbackRound) === 2;
    const isClient = feedbackRound === 'client';
    const currentFeedback = isRound1 ? round1Feedback : (isRound2 ? round2Feedback : clientFeedback);
    const finalRecommendation = isReject ? 'reject' : (isRound1 ? round1Feedback.recommendation : (isRound2 ? round2Feedback.recommendation : clientFeedback.recommendation));

    // Use updateInterview from the context
    await updateInterview(selectedInterview.id, {
      status: 'completed' as const,
      feedback: isRound1 ? {
        technicalRating: 0,
        communicationRating: 0,
        comments: `Communication: ${round1Feedback.communication}\nTechnical: ${round1Feedback.technicalAssessment}\nProblem-Solving: ${round1Feedback.problemSolving}\nOverall: ${round1Feedback.overallPotential}\nAssessment: ${round1Feedback.comments}`,
        decision: finalRecommendation === 'proceed_to_round2' ? 'move_forward' : 'reject',
      } : isRound2 ? {
        technicalRating: 0,
        communicationRating: 0,
        comments: `Communication: ${round2Feedback.communication}\nTechnical: ${round2Feedback.technicalAssessment}\nProblem-Solving: ${round2Feedback.problemSolving}\nOverall: ${round2Feedback.overallPotential}\nAssessment: ${round2Feedback.comments}\nRecommendation: ${round2Feedback.recommendation}\nCTC: ${round2Feedback.ctc}`,
        decision: (isReject || finalRecommendation === 'reject') ? 'reject' : 'move_forward',
      } : { // Client Round
        technicalRating: 0, // Not applicable for client round
        communicationRating: 0, // Not applicable for client round
        comments: `Communication: ${clientFeedback.communication || ''}\nTechnical: ${clientFeedback.technicalAssessment || ''}\nProblem-Solving: ${clientFeedback.problemSolving || ''}\nOverall: ${clientFeedback.overallPotential || ''}\nFeedback: ${clientFeedback.feedback || ''}`,
        decision: (isReject || finalRecommendation === 'reject') ? 'reject' : 'move_forward',
      }
    });

    // Update candidate's feedback in the recruitment context
    await updateCandidateFeedback(selectedInterview.candidateId, feedbackRound, { ...currentFeedback, recommendation: finalRecommendation });

    const decisionText = isReject || (isRound1 && round1Feedback.recommendation === 'reject') || (isRound2 && round2Feedback.recommendation === 'reject') || (isClient && clientFeedback.recommendation === 'reject')
      ? 'Rejected'
      : (isRound1 ? 'Proceed to Round 2' : (isRound2 ? 'Completed' : 'Accepted'));

    // Send rejection email if applicable
    if (isReject || finalRecommendation === 'reject') {
      const candidate = candidates.find(c => c.id === selectedInterview.candidateId);
      if (candidate?.email) {
        const templateId = isRound1 ? 'round1_rejection' : (isRound2 ? 'round2_rejection' : 'candidate_rejection');
        const template = emailTemplates.find(t => t.id === templateId);

        if (template) {
          const pData = {
            'Candidate Name': candidate.name,
            'Position': selectedInterview.demandTitle || '',
            'Date': format(new Date(), 'MMMM d, yyyy'),
          };

          let subject = template.subject;
          let body = template.body;

          Object.entries(pData).forEach(([key, value]) => {
            subject = subject.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
            body = body.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
          });

          try {
            await sendEmail(candidate.email, subject, body.replace(/\n/g, '<br>'));
            toast.success('Rejection email sent to candidate');
          } catch (error) {
            console.error('Failed to send rejection email', error);
            toast.error('Failed to send rejection email');
          }
        }
      }
    }

    toast.success(`Round ${feedbackRound} feedback submitted! ${decisionText}`);
    setIsFeedbackOpen(false);
    setSelectedInterview(null);
  };

  const handleOpenEmail = (interview: Interview) => {
    setSelectedInterview(interview);

    const template = emailTemplates.find(t => t.id === 'interview_reminder');
    let subject = `Interview Reminder: ${interview.demandTitle} - Round ${interview.round}`;
    let body = '';

    if (template) {
      const isValid = interview.scheduledAt instanceof Date && !isNaN(interview.scheduledAt.getTime());
      const pData = {
        'Candidate Name': interview.candidateName,
        'Position': interview.demandTitle || '',
        'Round': interview.round?.toString() || '',
        'Date': isValid ? format(interview.scheduledAt, 'MMMM d, yyyy') : 'TBA',
        'Time': isValid ? format(interview.scheduledAt, 'h:mm a') : 'TBA',
        'Link': interview.meetLink ? `Meeting Link: ${interview.meetLink}` : '',
      };
      subject = replacePlaceholders(template.subject, pData);
      body = replacePlaceholders(template.body, pData);
    } else {
      const isValid = interview.scheduledAt instanceof Date && !isNaN(interview.scheduledAt.getTime());
      body = `Dear ${interview.candidateName},\n\nThis is a reminder for your upcoming interview scheduled on ${isValid ? format(interview.scheduledAt, 'MMMM d, yyyy') : 'TBA'} at ${isValid ? format(interview.scheduledAt, 'h:mm a') : 'TBA'}.\n\nPosition: ${interview.demandTitle}\nRound: ${interview.round}\n${interview.meetLink ? `Meeting Link: ${interview.meetLink}` : ''}\n\nPlease ensure you are available 5 minutes before the scheduled time.\n\nBest regards,\nHR Team`;
    }

    setEmailContent({ subject, body });
    setIsEmailOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedInterview || !emailContent.subject || !emailContent.body) return;

    const candidate = candidates.find(c => c.id === selectedInterview.candidateId);
    if (!candidate) {
      toast.error('Candidate linkage missing');
      return;
    }
    if (!candidate.email) {
      toast.error('Candidate email not found');
      return;
    }

    setIsSending(true);
    try {
      const result = await sendEmail(candidate.email, emailContent.subject, emailContent.body.replace(/\n/g, '<br>'));
      if (result.success) {
        toast.success(`Email notification sent to ${selectedInterview.candidateName}!`);
        setIsEmailOpen(false);
        setSelectedInterview(null);
      }
    } catch (error) {
      console.error('Failed to send email:', error);
    } finally {
      setIsSending(false);
    }
  };

  const generateGoogleCalendarLink = (interview: Interview) => {
    const startDate = interview.scheduledAt;
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration

    const formatDateForGoogle = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const title = `Interview: ${interview.demandTitle} - ${interview.candidateName}`;
    const details = `Interview with ${interview.candidateName} for ${interview.demandTitle}\n\nRound: ${interview.round}\nCandidate ID: ${interview.candidateId}\nDemand ID: ${interview.demandId}`;
    const location = interview.meetLink || '';

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}`,
      details: details,
      location: location,
      trp: 'false' // Mark as busy
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const handleAddToGoogleCalendar = (interview: Interview) => {
    const calendarLink = generateGoogleCalendarLink(interview);
    window.open(calendarLink, '_blank');
  };

  const handleSendReminder = async (interview: Interview) => {
    const candidate = candidates.find(c => c.id === interview.candidateId);
    if (!candidate) {
      toast.error('Candidate linkage missing. Cannot determine recipient email.');
      return;
    }
    if (!candidate.email) {
      toast.error('Candidate email not found.');
      return;
    }

    const template = emailTemplates.find(t => t.id === 'interview_reminder');
    let subject = `Reminder: Interview with GuhaTek`;
    let body = '';

    if (template) {
      const isValid = interview.scheduledAt instanceof Date && !isNaN(interview.scheduledAt.getTime());
      const pData = {
        'Candidate Name': interview.candidateName,
        'Position': interview.demandTitle || '',
        'Round': interview.round?.toString() || '',
        'Date': isValid ? format(interview.scheduledAt, 'MMMM d, yyyy') : 'TBA',
        'Time': isValid ? format(interview.scheduledAt, 'h:mm a') : 'TBA',
        'Link': interview.meetLink || '',
      };
      subject = replacePlaceholders(template.subject, pData);
      body = replacePlaceholders(template.body, pData);
    } else {
      const isValid = interview.scheduledAt instanceof Date && !isNaN(interview.scheduledAt.getTime());
      subject = `Interview Reminder: ${interview.demandTitle}`;
      body = `Hi ${interview.candidateName},\n\nThis is a reminder for your interview on ${isValid ? format(interview.scheduledAt, 'MMM d, h:mm a') : 'TBA'}.`;
    }

    toast.promise(
      sendEmail(candidate.email, subject, body.replace(/\n/g, '<br>')),
      {
        loading: 'Sending reminder...',
        success: `Reminder sent to ${candidate.name}`,
        error: 'Failed to send reminder'
      }
    );
  };

  return (
    <DashboardLayout title="Interviews">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Interview Schedule</h2>
            <p className="text-muted-foreground">{interviewId ? 'Viewing Interview Details' : 'Manage your upcoming interviews'}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {interviewId && (
              <Button variant="outline" onClick={() => router.push('/interviews')}>
                Show All Interviews
              </Button>
            )}
            {/* Position Filter */}
            <div className="flex items-center gap-1">
              <Select
                value={selectedPosition}
                onValueChange={setSelectedPosition}
              >
                <SelectTrigger className="w-[200px] sm:w-[250px]">
                  <SelectValue placeholder="Filter by Position" />
                </SelectTrigger>
                <SelectContent>
                  {positionOptions.map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setIsCalendarVisible(!isCalendarVisible)}
            >
              <CalendarIcon className="h-4 w-4" />
              {isCalendarVisible ? 'Hide Calendar' : 'Show Calendar'}
            </Button>
            <Badge variant="outline" className="text-sm py-1">
              <CalendarIcon className="mr-1 h-3 w-3" />
              {scheduledInterviews.length} Scheduled
            </Badge>
          </div>
        </div>

        {/* Calendar Section - Conditionally Visible */}
        {isCalendarVisible && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <InterviewCalendar
              interviews={scheduledInterviews}
              candidates={candidates}
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              onAddToGoogleCalendar={handleAddToGoogleCalendar}
            />
          </div>
        )}

        {/* Interview Cards */}
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([date, dateInterviews]) => (
            <div key={date} className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {format(new Date(date), 'EEEE, MMMM d, yyyy')}
              </h3>
              <div className="grid gap-4">
                {dateInterviews.map((interview, index) => (
                  <Card key={`${interview.id || 'interview'}-${date}-${index}`} className="shadow-card hover:shadow-lg transition-all">
                    <CardContent className="p-4 sm:p-6">
                      {/* Top row: Time | Candidate Info | Round Badge */}
                      <div className="flex items-start gap-4">
                        {/* Time */}
                        <div className="flex items-center gap-3 min-w-[110px]">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Clock className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">
                              {interview.scheduledAt instanceof Date && !isNaN(interview.scheduledAt.getTime()) ? format(interview.scheduledAt, 'h:mm a') : 'TBD'}
                            </p>
                            <p className="text-xs text-muted-foreground">Duration: 1hr</p>
                          </div>
                        </div>

                        {/* Separator */}
                        <div className="w-px self-stretch bg-border shrink-0" />

                        {/* Candidate Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                              <span className="font-semibold text-accent text-sm">
                                {interview.candidateName.charAt(0)}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-foreground">{interview.candidateName}</p>
                                {/* Round Badge inline with name */}
                                <Badge className={cn(
                                  'shrink-0',
                                  interview.round === 1 ? 'bg-info/10 text-info border-info/20' :
                                    interview.round === 2 ? 'bg-warning/10 text-warning border-warning/20' :
                                      'bg-success/10 text-success border-success/20'
                                )}>
                                  Round {interview.round}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{interview.demandTitle}</p>

                              {/* Extended Candidate Details */}
                              {(() => {
                                const candidate = candidates.find(c => c.id === interview.candidateId);
                                if (candidate) {
                                  return (
                                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground border-t border-border/50 pt-2">
                                      {candidate.email && (
                                        <div className="flex items-center gap-1 min-w-0 text-sm">
                                          <Mail className="h-3 w-3 text-primary/70 shrink-0" />
                                          <span className="truncate">{candidate.email}</span>
                                        </div>
                                      )}
                                      {candidate.phone && (
                                        <div className="flex items-center gap-1 text-sm">
                                          <span className="font-semibold text-foreground/70 shrink-0">Contact:</span>
                                          <span>{candidate.phone}</span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1 min-w-0 text-sm">
                                        <span className="font-semibold text-foreground/70 shrink-0">Position:</span>
                                        <span className="text-primary/90 font-medium truncate">{candidate.interestedPosition || interview.demandTitle || 'Not Specified'}</span>
                                      </div>
                                      {candidate.experience && (
                                        <div className="flex items-center gap-1 text-sm">
                                          <span className="font-semibold text-foreground/70 shrink-0">Experience:</span>
                                          <span>{candidate.experience.toLowerCase().includes('year') ? candidate.experience : `${candidate.experience} years`}</span>
                                        </div>
                                      )}
                                      {candidate.currentRole && (
                                        <div className="flex items-center gap-1 min-w-0 text-xs">
                                          <span className="font-semibold text-foreground/70 shrink-0">Current Role:</span>
                                          <span className="truncate">{candidate.currentRole}</span>
                                        </div>
                                      )}
                                      {candidate.currentCompany && (
                                        <div className="flex items-center gap-1 min-w-0 text-xs">
                                          <span className="font-semibold text-foreground/70 shrink-0">Current Org:</span>
                                          <span className="truncate">{candidate.currentCompany}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom row: Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendReminder(interview)}
                          className="text-primary"
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Send Reminder
                        </Button>
                        {interview.meetLink && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-accent border-accent/30 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => window.open(interview.meetLink, '_blank')}
                          >
                            <Video className="mr-2 h-4 w-4" />
                            Join Meet
                          </Button>
                        )}
                        {(interview.round === 2 || interview.round === 'client') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewRound1Feedback(interview)}
                            className="text-muted-foreground border-border hover:bg-muted"
                          >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            View Round 1
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenFeedback(interview)}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Feedback
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEmail(interview)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        {scheduledInterviews.length === 0 && (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Upcoming Interviews</h3>
              <p className="text-muted-foreground">
                You don't have any interviews scheduled yet
              </p>
            </CardContent>
          </Card>
        )}

        {/* Feedback Dialog with Round-based feedback */}
        <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
          <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit Interview Feedback</DialogTitle>
              <DialogDescription>
                Provide your feedback for {selectedInterview?.candidateName}'s Round {selectedInterview?.round} interview
              </DialogDescription>
            </DialogHeader>

            <div className="w-full">
              {/* Round 1 Assessment */}
              {String(feedbackRound) === '1' && (
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <span className="font-bold text-sm">1</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">Round 1: Screening & Technical Basics</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Communication:</Label>
                        <span className={cn("text-[10px]", countWords(round1Feedback.communication) > 120 ? "text-destructive" : "text-muted-foreground")}>
                          {countWords(round1Feedback.communication)}/120 words
                        </span>
                      </div>
                      <Textarea
                        placeholder="Evaluate communication skills..."
                        className={cn("h-20", countWords(round1Feedback.communication) > 120 && "border-destructive")}
                        value={round1Feedback.communication}
                        onChange={(e) => setRound1Feedback({ ...round1Feedback, communication: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Technical Assessment:</Label>
                        <span className={cn("text-[10px]", countWords(round1Feedback.technicalAssessment) > 120 ? "text-destructive" : "text-muted-foreground")}>
                          {countWords(round1Feedback.technicalAssessment)}/120 words
                        </span>
                      </div>
                      <Textarea
                        placeholder="Evaluate technical skills..."
                        className={cn("h-20", countWords(round1Feedback.technicalAssessment) > 120 && "border-destructive")}
                        value={round1Feedback.technicalAssessment}
                        onChange={(e) => setRound1Feedback({ ...round1Feedback, technicalAssessment: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Problem-Solving:</Label>
                        <span className={cn("text-[10px]", countWords(round1Feedback.problemSolving) > 120 ? "text-destructive" : "text-muted-foreground")}>
                          {countWords(round1Feedback.problemSolving)}/120 words
                        </span>
                      </div>
                      <Textarea
                        placeholder="Evaluate problem-solving abilities..."
                        className={cn("h-20", countWords(round1Feedback.problemSolving) > 120 && "border-destructive")}
                        value={round1Feedback.problemSolving}
                        onChange={(e) => setRound1Feedback({ ...round1Feedback, problemSolving: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Overall Potential:</Label>
                        <span className={cn("text-[10px]", countWords(round1Feedback.overallPotential) > 120 ? "text-destructive" : "text-muted-foreground")}>
                          {countWords(round1Feedback.overallPotential)}/120 words
                        </span>
                      </div>
                      <Textarea
                        placeholder="Overall assessment of the candidate..."
                        className={cn("h-20", countWords(round1Feedback.overallPotential) > 120 && "border-destructive")}
                        value={round1Feedback.overallPotential}
                        onChange={(e) => setRound1Feedback({ ...round1Feedback, overallPotential: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 pt-2">
                      <Label>Recommendation:</Label>
                      <Select
                        value={round1Feedback.recommendation}
                        onValueChange={(value) => setRound1Feedback({ ...round1Feedback, recommendation: value as 'proceed_to_round2' | 'reject' })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select outcome" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="proceed_to_round2">
                            <div className="flex items-center gap-2">
                              <ArrowRight className="h-4 w-4 text-emerald-500" />
                              <span>Proceed Round 2</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="reject">
                            <div className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-destructive" />
                              <span>Reject Candidate</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Round 2 Assessment */}
              {String(feedbackRound) === '2' && (
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                      <span className="font-bold text-sm">2</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">Round 2: Detailed Technical Evaluation</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Communication:</Label>
                        <span className={cn("text-[10px]", countWords(round2Feedback.communication) > 120 ? "text-destructive" : "text-muted-foreground")}>
                          {countWords(round2Feedback.communication)}/120 words
                        </span>
                      </div>
                      <Textarea
                        placeholder="Evaluate communication skills..."
                        className={cn("h-20", countWords(round2Feedback.communication) > 120 && "border-destructive")}
                        value={round2Feedback.communication}
                        onChange={(e) => setRound2Feedback({ ...round2Feedback, communication: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Technical Assessment:</Label>
                        <span className={cn("text-[10px]", countWords(round2Feedback.technicalAssessment) > 120 ? "text-destructive" : "text-muted-foreground")}>
                          {countWords(round2Feedback.technicalAssessment)}/120 words
                        </span>
                      </div>
                      <Textarea
                        placeholder="Evaluate technical skills..."
                        className={cn("h-20", countWords(round2Feedback.technicalAssessment) > 120 && "border-destructive")}
                        value={round2Feedback.technicalAssessment}
                        onChange={(e) => setRound2Feedback({ ...round2Feedback, technicalAssessment: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Problem-Solving:</Label>
                        <span className={cn("text-[10px]", countWords(round2Feedback.problemSolving) > 120 ? "text-destructive" : "text-muted-foreground")}>
                          {countWords(round2Feedback.problemSolving)}/120 words
                        </span>
                      </div>
                      <Textarea
                        placeholder="Evaluate problem-solving abilities..."
                        className={cn("h-20", countWords(round2Feedback.problemSolving) > 120 && "border-destructive")}
                        value={round2Feedback.problemSolving}
                        onChange={(e) => setRound2Feedback({ ...round2Feedback, problemSolving: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Overall Potential:</Label>
                        <span className={cn("text-[10px]", countWords(round2Feedback.overallPotential) > 120 ? "text-destructive" : "text-muted-foreground")}>
                          {countWords(round2Feedback.overallPotential)}/120 words
                        </span>
                      </div>
                      <Textarea
                        placeholder="Overall assessment of the candidate..."
                        className={cn("h-20", countWords(round2Feedback.overallPotential) > 120 && "border-destructive")}
                        value={round2Feedback.overallPotential}
                        onChange={(e) => setRound2Feedback({ ...round2Feedback, overallPotential: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Recommendation:</Label>
                        <span className={cn("text-[10px]", countWords(round2Feedback.recommendation) > 120 ? "text-destructive" : "text-muted-foreground")}>
                          {countWords(round2Feedback.recommendation)}/120 words
                        </span>
                      </div>
                      <Textarea
                        placeholder="Your recommendation..."
                        className={cn("h-20", countWords(round2Feedback.recommendation) > 120 && "border-destructive")}
                        value={round2Feedback.recommendation}
                        onChange={(e) => setRound2Feedback({ ...round2Feedback, recommendation: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CTC:</Label>
                      <Input
                        placeholder="Enter expected/offered CTC"
                        value={round2Feedback.ctc}
                        onChange={(e) => setRound2Feedback({ ...round2Feedback, ctc: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Client Interview Detail */}
              {feedbackRound === 'client' && (
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">Client Assessment: Final Selection</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Communication</Label>
                      <Input
                        placeholder="Soft skills / Culture fit"
                        value={clientFeedback.communication || ''}
                        onChange={(e) => setClientFeedback({ ...clientFeedback, communication: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Technical Assessment</Label>
                      <Input
                        placeholder="Role fit assessment"
                        value={clientFeedback.technicalAssessment || ''}
                        onChange={(e) => setClientFeedback({ ...clientFeedback, technicalAssessment: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Problem Solving</Label>
                      <Input
                        placeholder="Analytical ability"
                        value={clientFeedback.problemSolving || ''}
                        onChange={(e) => setClientFeedback({ ...clientFeedback, problemSolving: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Overall Potential</Label>
                      <Input
                        placeholder="Long-term potential"
                        value={clientFeedback.overallPotential || ''}
                        onChange={(e) => setClientFeedback({ ...clientFeedback, overallPotential: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Detailed Assessment</Label>
                    <Textarea
                      placeholder="Detailed feedback from the client..."
                      className="h-32"
                      value={clientFeedback.feedback}
                      onChange={(e) => setClientFeedback({ ...clientFeedback, feedback: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 pt-2">
                    <Label>Final Recommendation</Label>
                    <Select
                      value={clientFeedback.recommendation}
                      onValueChange={(value) => setClientFeedback({ ...clientFeedback, recommendation: value as 'proceed_to_offer' | 'reject' })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select outcome" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="proceed_to_offer">Accept</SelectItem>
                        <SelectItem value="reject">Reject</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex justify-between items-center sm:justify-between w-full">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsFeedbackOpen(false)}>
                  Cancel
                </Button>
                {String(feedbackRound) !== '1' && feedbackRound !== 'client' && (
                  <Button
                    variant="destructive"
                    onClick={() => handleSubmitFeedback(true)}
                    className="flex items-center gap-2"
                    disabled={
                      (Number(feedbackRound) === 2 && (
                        countWords(round2Feedback.communication) > 120 ||
                        countWords(round2Feedback.technicalAssessment) > 120 ||
                        countWords(round2Feedback.problemSolving) > 120 ||
                        countWords(round2Feedback.overallPotential) > 120 ||
                        countWords(round2Feedback.recommendation) > 120
                      ))
                    }
                  >
                    <XCircle className="h-4 w-4" />
                    Reject Candidate
                  </Button>
                )}
              </div>
              <Button
                onClick={() => handleSubmitFeedback(false)}
                disabled={
                  (Number(feedbackRound) === 1 && (
                    countWords(round1Feedback.communication) > 120 ||
                    countWords(round1Feedback.technicalAssessment) > 120 ||
                    countWords(round1Feedback.problemSolving) > 120 ||
                    countWords(round1Feedback.overallPotential) > 120
                  )) ||
                  (Number(feedbackRound) === 2 && (
                    countWords(round2Feedback.communication) > 120 ||
                    countWords(round2Feedback.technicalAssessment) > 120 ||
                    countWords(round2Feedback.problemSolving) > 120 ||
                    countWords(round2Feedback.overallPotential) > 120 ||
                    countWords(round2Feedback.recommendation) > 120
                  ))
                }
              >
                Submit {feedbackRound === 'client' ? 'Client' : `Round ${feedbackRound}`} Feedback
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Email Dialog */}
        <Dialog open={isEmailOpen} onOpenChange={setIsEmailOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Send Email Notification</DialogTitle>
              <DialogDescription>
                Send an email to {selectedInterview?.candidateName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <input
                  type="text"
                  value={emailContent.subject}
                  onChange={(e) => setEmailContent({ ...emailContent, subject: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={emailContent.body}
                  onChange={(e) => setEmailContent({ ...emailContent, body: e.target.value })}
                  rows={10}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEmailOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendEmail} disabled={isSending}>
                <Send className="mr-2 h-4 w-4" />
                {isSending ? 'Sending...' : 'Send Email'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Dialog open={isViewRound1Open} onOpenChange={setIsViewRound1Open}>
        <DialogContent className="max-w-2xl bg-card border border-border sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Round 1 Feedback Details</DialogTitle>
            <DialogDescription>
              Feedback for {selectedInterview?.candidateName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {hasRound1Feedback ? (
              <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <span className="text-xs text-muted-foreground block">Recommendation</span>
                    <span className="text-sm font-medium capitalize">{round1Feedback.recommendation?.replace(/_/g, ' ') || '-'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Communication</span>
                    <span className="text-sm font-medium">{round1Feedback.communication || '-'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Technical</span>
                    <span className="text-sm font-medium">{round1Feedback.technicalAssessment || '-'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Problem Solving</span>
                    <span className="text-sm font-medium">{round1Feedback.problemSolving || '-'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Overall</span>
                    <span className="text-sm font-medium">{round1Feedback.overallPotential || '-'}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Comments</span>
                  <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{round1Feedback.comments || 'No comments'}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-2 opacity-20" />
                <p>No feedback available for Round 1.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewRound1Open(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Interviews;
