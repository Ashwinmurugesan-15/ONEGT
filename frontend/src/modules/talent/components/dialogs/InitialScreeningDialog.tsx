import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Candidate } from '@/types/recruitment';

interface InitialScreeningDialogProps {
    candidate: Candidate | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (candidateId: string, feedback: string) => void;
}

export const InitialScreeningDialog = ({
    candidate,
    open,
    onOpenChange,
    onSave,
}: InitialScreeningDialogProps) => {
    const [feedback, setFeedback] = useState('');
    const maxLength = 120;

    useEffect(() => {
        if (candidate) {
            setFeedback(candidate.screeningFeedback || '');
        }
    }, [candidate, open]);

    const handleSave = () => {
        if (candidate) {
            onSave(candidate.id, feedback);
            onOpenChange(false);
        }
    };

    if (!candidate) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Initial Screening Feedback</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="feedback">Feedback for {candidate.name}</Label>
                        <Textarea
                            id="feedback"
                            placeholder="Enter initial screening feedback..."
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value.slice(0, maxLength))}
                            className="resize-none h-32"
                        />
                        <div className="flex justify-end">
                            <span className={feedback.length >= maxLength ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                                {feedback.length}/{maxLength} characters
                            </span>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!feedback.trim()}>
                        Save Feedback
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
