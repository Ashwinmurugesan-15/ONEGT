import { useState, useEffect } from 'react';
import { Candidate } from '@/types/recruitment';
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
import { toast } from 'sonner';
import { useRecruitment } from '@/context/RecruitmentContext';

interface RejectionEmailDialogProps {
    candidate: Candidate | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}

const replacePlaceholders = (template: string, data: Record<string, string>) => {
    let result = template;
    Object.entries(data).forEach(([key, value]) => {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(`\\[${escapedKey}\\]`, 'g'), value);
    });
    return result;
};

export const RejectionEmailDialog = ({
    candidate,
    open,
    onOpenChange,
    onConfirm
}: RejectionEmailDialogProps) => {
    const { emailTemplates, sendEmail } = useRecruitment();
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Position title map
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

    const demand = mockDemands.find(d => d.id === candidate?.demandId);
    const positionTitle = candidate ? (positionTitleMap[candidate.demandId] || demand?.title || candidate.demandId || 'Unknown Position') : '';

    useEffect(() => {
        if (candidate && open) {
            const template = emailTemplates.find(t => t.id === 'candidate_rejection');
            if (template) {
                const pData = {
                    'Candidate Name': candidate.name,
                    'Position': positionTitle,
                };
                setEmailSubject(replacePlaceholders(template.subject, pData));
                setEmailBody(replacePlaceholders(template.body, pData));
            }
        }
    }, [candidate, open, emailTemplates, positionTitle]);

    const handleSend = async () => {
        if (!candidate || !candidate.email) {
            toast.error('Candidate email is missing');
            return;
        }

        setIsSending(true);
        try {
            const result = await sendEmail(candidate.email, emailSubject, emailBody.replace(/\n/g, '<br>'));
            if (result.success) {
                toast.success(`Rejection email sent to ${candidate.name}`);
                onConfirm(); // This likely handles the status update in the parent
                onOpenChange(false);
            }
        } catch (error) {
            console.error('Failed to send rejection email', error);
        } finally {
            setIsSending(false);
        }
    };

    if (!candidate) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Send Rejection Email</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                        <p className="font-medium text-destructive">Rejecting: {candidate.name}</p>
                        <p className="text-sm text-muted-foreground">{positionTitle}</p>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-base font-semibold">Email Content</Label>
                            <span className="text-xs text-muted-foreground">Review and edit before sending</span>
                        </div>

                        <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                                className="font-medium"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Email Body</Label>
                            <Textarea
                                value={emailBody}
                                onChange={(e) => setEmailBody(e.target.value)}
                                rows={12}
                                className="font-mono text-sm"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleSend} disabled={isSending}>
                        {isSending ? 'Sending...' : 'Reject & Send Email'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
