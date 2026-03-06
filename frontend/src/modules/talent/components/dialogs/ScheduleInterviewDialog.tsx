// IDE Sync Trigger: 5
import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { Candidate, InterviewRound } from '@/types/recruitment';
import { mockDemands } from '@/data/mockData';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useRecruitment } from '@/context/RecruitmentContext';
import { useDemands } from '@/context/DemandsContext';
import { useUsers } from '@/context/UsersContext';
import { CheckCircle2, XCircle, MessageSquare } from 'lucide-react';

interface ScheduleInterviewDialogProps {
  candidate: Candidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule?: (data: ScheduleData) => void;
}

interface ScheduleData {
  candidateId: string;
  round: InterviewRound;
  date: string;
  time: string;
  meetLink: string;
  interviewerName: string;
}

const replacePlaceholders = (template: string, data: Record<string, string>) => {
  let result = template;
  Object.entries(data).forEach(([key, value]) => {
    // Escape special characters for regex
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\[${escapedKey}\\]`, 'g'), value);
  });
  return result;
};

export const ScheduleInterviewDialog = ({
  candidate,
  open,
  onOpenChange,
  onSchedule
}: ScheduleInterviewDialogProps) => {
  const { addInterview, emailTemplates, sendEmail } = useRecruitment();
  const { demands } = useDemands();
  const { getUserByEmail } = useUsers();
  const [isSending, setIsSending] = useState(false);
  const [formData, setFormData] = useState({
    round: '1' as string,
    date: '',
    time: '',
    meetLink: '',
    interviewerName: '',
    interviewerEmail: '',
    position: '',
    clientFeedback: '',
    clientRecommendation: null as 'move_forward' | 'reject' | null,
  });
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Cleanup orphaned portal elements when dialog closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        // Find and remove any leftover radix portals
        const portals = document.querySelectorAll('[data-radix-portal]');
        portals.forEach(p => p.remove());
        // Force restore body styles
        document.body.style.pointerEvents = 'auto';
        document.body.style.overflow = 'auto';
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // if (!candidate) return null; // MOVED TO END

  // Position title map for new position IDs
  const positionTitleMap: Record<string, string> = {
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
  };

  // Position options matching CandidateFilters.tsx
  const positionOptions = [
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

  // Get position title from either new IDs or legacy mock demands
  const demandId = candidate?.demandId;
  const demand = demandId ? mockDemands.find((d: { id: string }) => d.id === demandId) : undefined;
  const derivedPositionTitle = demandId
    ? (positionTitleMap[demandId] || demand?.title || demandId || 'Unknown Position')
    : '';

  useEffect(() => {
    if (open && candidate) {
      setFormData({
        round: '1',
        date: '',
        time: '',
        meetLink: '',
        interviewerName: '',
        interviewerEmail: '',
        position: derivedPositionTitle,
        clientFeedback: '',
        clientRecommendation: null
      });
      setEmailSubject('');
      setEmailBody('');
    }
  }, [open, candidate, derivedPositionTitle]);

  // Update email template when round, date, time, interviewer, or position changes
  const updateEmailTemplate = (round: string, date: string, time: string, interviewerName: string, meetLink: string, position: string) => {
    // Check debugging logs
    console.log('UpdateEmailTemplate called with:', { position, date, time });

    const formattedDate = date ? format(new Date(date), 'MMMM d, yyyy') : '[Date]';
    const formattedTime = time || '[Time]';
    const finalMeetLink = meetLink || 'https://meet.google.com/xxx-xxxx-xxx';

    let templateId = 'round1';
    if (round === '2') templateId = 'round2';
    if (round === 'client') templateId = 'round_client';

    const template = emailTemplates.find((t: { id: string }) => t.id === templateId);

    if (template) {
      const pData = {
        'Candidate Name': candidate?.name || '',
        'Position': position,
        'Date': formattedDate,
        'Time': formattedTime,
        'Interviewer': interviewerName,
        'Link': finalMeetLink,
        'Resume Link': (candidate && candidate.resumeUrl) ? candidate.resumeUrl : 'Not provided',
      };

      setEmailSubject(replacePlaceholders(template.subject, pData));
      setEmailBody(replacePlaceholders(template.body, pData));
    }
  };

  const handleFormChange = (field: string, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Update email template when relevant fields change
    if (['round', 'date', 'time', 'interviewerName', 'meetLink', 'position'].includes(field)) {
      updateEmailTemplate(
        newFormData.round,
        newFormData.date,
        newFormData.time,
        newFormData.interviewerName,
        newFormData.meetLink,
        newFormData.position
      );
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!candidate) return;

    if (!formData.date || !formData.time || !formData.meetLink) {
      toast.error('Please fill in all required fields (Date, Time, and Meeting Link)');
      return;
    }

    const isClientRound = formData.round === 'client';
    const scheduleData: ScheduleData = {
      candidateId: candidate.id,
      round: (isClientRound ? 'client' : parseInt(formData.round)) as InterviewRound,
      date: formData.date,
      time: formData.time,
      meetLink: formData.meetLink,
      interviewerName: formData.interviewerName,
    };

    // Create scheduled date object
    const scheduledAt = new Date(`${formData.date}T${formData.time}`);

    // Add interview to context (automatically updates calendar)
    addInterview({
      candidateId: candidate.id,
      candidateName: candidate.name,
      demandId: candidate.demandId,
      demandTitle: formData.position, // Use selected position
      round: (isClientRound ? 'client' : parseInt(formData.round)) as InterviewRound,
      scheduledAt,
      interviewerId: '4', // Default interviewer ID
      interviewerName: formData.interviewerName || (isClientRound ? 'Client' : ''),
      interviewerEmail: formData.interviewerEmail,
      meetLink: formData.meetLink,
      status: 'scheduled',
    });

    // Send email notifications to both candidate and interviewer for all rounds
    setIsSending(true);
    let candidateEmailSent = false;
    let interviewerEmailSent = false;

    // Send to candidate
    if (candidate.email && emailSubject && emailBody) {
      try {
        const result = await sendEmail(candidate.email, emailSubject, emailBody.replace(/\n/g, '<br>'));
        if (result.success) {
          candidateEmailSent = true;
          toast.success('Invitation email sent to candidate');
        }
      } catch (error) {
        console.error('Failed to send interview email to candidate:', error);
      }
    }

    // Send to interviewer
    if (formData.interviewerEmail && emailSubject && emailBody) {
      try {
        // Create interviewer-specific email body
        const interviewerEmailBody = emailBody
          .replace(/Dear \[Candidate Name\]|Dear [^,]+/g, `Dear ${formData.interviewerName || 'Interviewer'}`)
          .replace(/This is (a reminder|an invitation) for your/g, 'You have been assigned to conduct an')
          .replace(/you are (invited|scheduled) for/gi, 'you will be conducting')
          .replace(/Please confirm your availability/g, 'Please be ready for the interview');

        const interviewerSubject = emailSubject.replace('Interview Invitation', 'Interview Assignment');

        const result = await sendEmail(formData.interviewerEmail, interviewerSubject, interviewerEmailBody.replace(/\n/g, '<br>'));
        if (result.success) {
          interviewerEmailSent = true;
          toast.success('Notification email sent to interviewer');
        }
      } catch (error) {
        console.error('Failed to send interview email to interviewer:', error);
        toast.error('Failed to notify interviewer');
      }
    }
    setIsSending(false);

    onSchedule?.(scheduleData);
    toast.success(`Interview scheduled for ${candidate.name}!`);

    // Close dialog
    onOpenChange(false);

    // Reset form
    setFormData({
      round: '1',
      date: '',
      time: '',
      meetLink: '',
      interviewerName: '',
      interviewerEmail: '',
      position: '',
      clientFeedback: '',
      clientRecommendation: null,
    });
    setEmailSubject('');
    setEmailBody('');
  };

  if (!candidate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Schedule Interview</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Interview Round</Label>
            <Select
              value={formData.round}
              onValueChange={(value: string) => handleFormChange('round', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Round 1 - Technical Interview / Coding</SelectItem>
                <SelectItem value="2">Round 2 - Technical Interview / HR</SelectItem>
                <SelectItem value="client">Client Interview</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Position</Label>
            <Select
              value={formData.position}
              onValueChange={(value: string) => handleFormChange('position', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                {positionOptions.map((position) => (
                  <SelectItem key={position} value={position}>
                    {position}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleFormChange('date', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Time *</Label>
              <Input
                type="time"
                value={formData.time}
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleFormChange('time', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Interviewer Name</Label>
              <Input
                value={formData.interviewerName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleFormChange('interviewerName', e.target.value)}
                placeholder="Enter interviewer name"
              />
            </div>
            <div className="space-y-2">
              <Label>Interviewer Email</Label>
              <Input
                type="email"
                value={formData.interviewerEmail}
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleFormChange('interviewerEmail', e.target.value)}
                placeholder="interviewer@company.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Meeting Link *</Label>
            <Input
              value={formData.meetLink}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleFormChange('meetLink', e.target.value)}
              placeholder="Paste meeting link here"
              required
            />
          </div>

          {/* Email Notification Preview */}
          {emailBody && (
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Email Notification Preview</Label>
                <span className="text-[10px] text-muted-foreground italic">Scheduled for both Candidate & Interviewer</span>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={emailSubject}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmailSubject(e.target.value)}
                  className="font-medium"
                />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea
                  value={emailBody}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setEmailBody(e.target.value)}
                  rows={10}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSending}>
              {isSending ? 'Sending...' : 'Schedule & Send Email'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
