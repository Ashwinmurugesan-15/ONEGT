import { useState, useEffect } from 'react';
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
import { useRecruitment } from '@/context/RecruitmentContext';
import { EmailTemplate } from '@/types/recruitment';
import { Settings, Save, X } from 'lucide-react';
import { AnimateIcon } from '@/components/ui/AnimateIcon';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
    const { emailTemplates, updateEmailTemplate } = useRecruitment();
    const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
    const [editData, setEditData] = useState({
        subject: '',
        body: '',
    });

    useEffect(() => {
        if (emailTemplates.length > 0 && !selectedTemplate) {
            setSelectedTemplate(emailTemplates[0]);
        }
    }, [emailTemplates, selectedTemplate]);

    useEffect(() => {
        if (selectedTemplate) {
            setEditData({
                subject: selectedTemplate.subject,
                body: selectedTemplate.body,
            });
        }
    }, [selectedTemplate]);

    const handleSave = () => {
        if (selectedTemplate) {
            updateEmailTemplate(selectedTemplate.id, editData);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AnimateIcon animateOnHover animation="spin">
                            <Settings className="h-5 w-5" />
                        </AnimateIcon>
                        System Settings - Mail Templates
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex gap-6 py-4">
                    {/* Sidebar - Template List */}
                    <div className="w-64 border-r pr-4 space-y-1">
                        <p className="text-sm font-medium text-muted-foreground mb-3 px-2">Templates</p>
                        {emailTemplates.map((template) => (
                            <button
                                key={template.id}
                                onClick={() => setSelectedTemplate(template)}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedTemplate?.id === template.id
                                    ? 'bg-primary text-primary-foreground font-medium'
                                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {template.name}
                            </button>
                        ))}
                    </div>

                    {/* Editor Area */}
                    <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                        {selectedTemplate ? (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="subject">Subject Template</Label>
                                    <Input
                                        id="subject"
                                        value={editData.subject}
                                        onChange={(e) => setEditData({ ...editData, subject: e.target.value })}
                                        placeholder="Email subject..."
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">
                                        Placeholders: [Candidate Name], [Position], [Date], [Time], [Interviewer Name], [Link], [Resume Link]
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="body">Email Body Template</Label>
                                    <Textarea
                                        id="body"
                                        value={editData.body}
                                        onChange={(e) => setEditData({ ...editData, body: e.target.value })}
                                        placeholder="Email body..."
                                        rows={18}
                                        className="font-mono text-sm resize-none"
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                Select a template to edit
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button onClick={handleSave} disabled={!selectedTemplate}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
