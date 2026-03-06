import { Candidate } from '@/types/recruitment';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Download, ExternalLink } from 'lucide-react';

interface ResumeDialogProps {
  candidate: Candidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ResumeDialog = ({ candidate, open, onOpenChange }: ResumeDialogProps) => {
  if (!candidate) return null;

  const hasResume = candidate.resumeUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{candidate.name}'s Resume</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {hasResume ? (
            <div className="space-y-4">
              <div className="aspect-[8.5/11] bg-muted rounded-lg flex items-center justify-center border">
                <iframe
                  src={candidate.resumeUrl}
                  className="w-full h-full rounded-lg"
                  title="Resume"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                  <a href={candidate.resumeUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in New Tab
                  </a>
                </Button>
                <Button asChild>
                  <a href={candidate.resumeUrl} download>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No Resume Uploaded</h3>
              <p className="text-muted-foreground">
                This candidate has not uploaded their resume yet.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
