import { useState, useEffect } from 'react';
import { Demand } from '@/types/recruitment';
import { useRecruitment } from '@/context/RecruitmentContext';
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MapPin, Users, Calendar, Briefcase, Edit2, Save, X,
  Building2, Layers, Monitor, Clock, DollarSign,
  FileText, CheckSquare, Star, Zap, ChevronDown, ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DemandDetailsDialogProps {
  demand: Demand | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'view' | 'edit';
  onSave?: (demand: Demand) => void;
  onClose?: (demandId: string) => void;
}

const statusColors = {
  open: 'bg-success/10 text-success border-success/20',
  closed: 'bg-muted text-muted-foreground border-border',
  on_hold: 'bg-warning/10 text-warning border-warning/20',
};

const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());

const DEPARTMENT_OPTIONS = ['Software-Development', 'Data-Engineering', 'DevOps', 'Design', 'Product', 'QA', 'HR', 'Finance', 'Sales', 'Marketing'];
const LEVEL_OPTIONS = ['Intern', 'Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Manager', 'Director'];
const EMPLOYMENT_OPTIONS = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'];
const WORKMODE_OPTIONS = ['Onsite', 'Remote', 'Hybrid'];

/* Small helper: section card for View More */
function InfoSection({ icon, iconClass, title, children }: {
  icon: React.ReactNode; iconClass: string; title: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className={cn('p-1.5 rounded-md', iconClass)}>{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      {children}
    </div>
  );
}

const BulletList = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5">
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-2 text-sm">
        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

/* Helper: parse textarea list input into array */
const parseLines = (s: string) => s.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
const joinLines = (arr?: string[]) => (arr || []).join('\n');

export const DemandDetailsDialog = ({
  demand, open, onOpenChange, mode, onSave, onClose,
}: DemandDetailsDialogProps) => {
  const [isEditing, setIsEditing] = useState(mode === 'edit');
  const [editData, setEditData] = useState<Demand | null>(demand);
  const [showMore, setShowMore] = useState(false);
  const [editTab, setEditTab] = useState('basic');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setIsEditing(mode === 'edit');
      setEditData(demand);
      setShowMore(false);
      setEditTab('basic');
      setIsSaving(false);
    }
  }, [open, demand, mode]);

  const { candidates } = useRecruitment();
  if (!demand) return null;

  const liveRejectedCount = candidates.filter(c => c.demandId === demand.id && c.status === 'rejected').length;
  const rejectedCount = liveRejectedCount > 0 ? liveRejectedCount : (demand.rejected || 0);

  const handleSave = async () => {
    if (!editData || isSaving) return;
    setIsSaving(true);
    try {
      await onSave?.(editData);
      // Wait a moment for context to update before closing
      setIsEditing(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Error in handleSave:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    onClose?.(demand.id);
    toast.success('Position closed successfully!');
    onOpenChange(false);
  };

  const set = (key: keyof Demand, val: any) =>
    setEditData(p => p ? { ...p, [key]: val } : null);

  const hasExtras = !!(
    demand.department || demand.level || demand.employmentType || demand.workMode ||
    demand.salary || demand.description ||
    (demand.responsibilities && demand.responsibilities.length > 0) ||
    (demand.requirements && demand.requirements.length > 0) ||
    (demand.niceToHave && demand.niceToHave.length > 0) ||
    (demand.businessImpact && demand.businessImpact.length > 0)
  );

  const AttrChip = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) =>
    value ? (
      <div className="flex items-center gap-1.5 bg-muted/60 border rounded-full px-3 py-1 text-xs font-medium">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-muted-foreground">{label}:</span>
        <span>{value}</span>
      </div>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle>{isEditing ? 'Edit Demand' : 'Demand Details'}</DialogTitle>
            {!isEditing && mode !== 'edit' && demand.status !== 'closed' && (
              <Button variant="ghost" size="sm" className="-mr-2" onClick={() => {
                setEditData(demand);
                setIsEditing(true);
              }}>
                <Edit2 className="h-4 w-4 mr-1" />Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        {isEditing ? (
          /* ── EDIT MODE — two tabs matching Create dialog ── */
          <div className="py-2">
            <Tabs value={editTab} onValueChange={setEditTab}>
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="details">Job Details</TabsTrigger>
              </TabsList>

              {/* ── Tab 1: Basic Info ── */}
              <TabsContent value="basic" className="space-y-4">
                <div className="space-y-2">
                  <Label>Job Title <span className="text-destructive">*</span></Label>
                  <Input value={editData?.title || ''} onChange={e => set('title', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Role / Designation</Label>
                  <Input value={editData?.role || ''} onChange={e => set('role', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Experience (yrs)</Label>
                    <Input value={editData?.experience || ''} onChange={e => set('experience', e.target.value)} placeholder="e.g. 3-5" />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input value={editData?.location || ''} onChange={e => set('location', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Openings</Label>
                    <Input type="number" min={1} value={editData?.openings || ''} onChange={e => set('openings', parseInt(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editData?.status || 'open'} onValueChange={v => set('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Required Skills <span className="text-xs text-muted-foreground">(comma separated)</span></Label>
                  <Textarea
                    rows={2}
                    value={editData?.skills?.join(', ') || ''}
                    onChange={e => set('skills', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="React, Node.js, PostgreSQL"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => setEditTab('details')}>Next: Job Details →</Button>
                </div>
              </TabsContent>

              {/* ── Tab 2: Job Details ── */}
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={editData?.department || ''} onValueChange={v => set('department', v)}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Select value={editData?.level || ''} onValueChange={v => set('level', v)}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {LEVEL_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employment Type</Label>
                    <Select value={editData?.employmentType || ''} onValueChange={v => set('employmentType', v)}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Work Mode</Label>
                    <Select value={editData?.workMode || ''} onValueChange={v => set('workMode', v)}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {WORKMODE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Salary / Compensation</Label>
                  <Input value={editData?.salary || ''} onChange={e => set('salary', e.target.value)} placeholder="e.g. ₹12–18 LPA or Competitive" />
                </div>
                <div className="space-y-2">
                  <Label>About the Role</Label>
                  <Textarea rows={3} value={editData?.description || ''} onChange={e => set('description', e.target.value)} placeholder="Brief description of the role…" />
                </div>
                <div className="space-y-2">
                  <Label>Responsibilities <span className="text-xs text-muted-foreground">(one per line)</span></Label>
                  <Textarea rows={3} value={joinLines(editData?.responsibilities)} onChange={e => set('responsibilities', parseLines(e.target.value))} placeholder="- Lead backend architecture&#10;- Conduct code reviews" />
                </div>
                <div className="space-y-2">
                  <Label>Requirements <span className="text-xs text-muted-foreground">(one per line)</span></Label>
                  <Textarea rows={3} value={joinLines(editData?.requirements)} onChange={e => set('requirements', parseLines(e.target.value))} placeholder="- 5+ years experience&#10;- Strong Python skills" />
                </div>
                <div className="space-y-2">
                  <Label>Nice to Have <span className="text-xs text-muted-foreground">(one per line)</span></Label>
                  <Textarea rows={2} value={joinLines(editData?.niceToHave)} onChange={e => set('niceToHave', parseLines(e.target.value))} placeholder="- AWS certification&#10;- Open source contributions" />
                </div>
                <div className="space-y-2">
                  <Label>Business Impact <span className="text-xs text-muted-foreground">(one per line)</span></Label>
                  <Textarea rows={2} value={joinLines(editData?.businessImpact)} onChange={e => set('businessImpact', parseLines(e.target.value))} placeholder="- Drive 2x engineering velocity" />
                </div>

                <DialogFooter className="flex-row gap-2 pt-2">
                  <Button variant="outline" onClick={() => setEditTab('basic')}>← Back</Button>
                  <Button variant="outline" onClick={() => { setIsEditing(false); setEditTab('basic'); }}>
                    <X className="h-4 w-4 mr-1" />Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-1" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          /* ── VIEW MODE ── */
          <div className="space-y-5 py-2">
            {/* Title + Status */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold">{demand.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{demand.role}</p>
              </div>
              <Badge className={cn('border text-xs', statusColors[demand.status])}>
                {demand.status === 'on_hold' ? 'On Hold' : demand.status.charAt(0).toUpperCase() + demand.status.slice(1)}
              </Badge>
            </div>

            {/* Core meta */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span>{demand.location || 'Not Specified'}</span></div>
              <div className="flex items-center gap-2 text-sm"><Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span>{demand.experience || 'Not Specified'} yrs exp.</span></div>
              <div className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span>{demand.openings || 0} Openings</span></div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>{demand.createdAt ? isValidDate(new Date(demand.createdAt)) ? format(new Date(demand.createdAt), 'MMM d, yyyy') : 'Invalid Date' : 'No Date'}</span>
              </div>
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Required Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {(demand.skills || []).length > 0
                  ? demand.skills.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)
                  : <span className="text-xs text-muted-foreground italic">No skills listed</span>}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-muted/40 border">
              {[
                { label: 'Applied', value: demand.applicants, color: 'text-foreground' },
                { label: 'Interviewed', value: demand.interviewed, color: 'text-foreground' },
                { label: 'Rejected', value: rejectedCount, color: 'text-destructive' },
                { label: 'Offers', value: demand.offers, color: 'text-accent' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className={cn('text-2xl font-bold', color)}>{value ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {/* Created By */}
            <p className="text-xs text-muted-foreground">
              Created by <span className="font-semibold text-foreground">{demand.createdBy}</span>
            </p>

            {/* ── EXPANDED VIEW MORE SECTION ── */}
            {showMore && hasExtras && (
              <div className="space-y-3 border-t pt-4">
                {/* Attribute chips */}
                <div className="flex flex-wrap gap-2">
                  <AttrChip icon={<Building2 className="h-3 w-3" />} label="Dept" value={demand.department} />
                  <AttrChip icon={<Layers className="h-3 w-3" />} label="Level" value={demand.level} />
                  <AttrChip icon={<Monitor className="h-3 w-3" />} label="Mode" value={demand.workMode} />
                  <AttrChip icon={<Clock className="h-3 w-3" />} label="Type" value={demand.employmentType} />
                </div>

                {demand.salary && (
                  <InfoSection icon={<DollarSign className="h-4 w-4 text-green-600" />} iconClass="bg-green-50 dark:bg-green-900/30" title="Compensation">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400">{demand.salary}</p>
                  </InfoSection>
                )}
                {demand.description && (
                  <InfoSection icon={<FileText className="h-4 w-4 text-blue-600" />} iconClass="bg-blue-50 dark:bg-blue-900/30" title="About the Role">
                    <p className="text-sm leading-relaxed text-muted-foreground">{demand.description}</p>
                  </InfoSection>
                )}
                {demand.responsibilities && demand.responsibilities.length > 0 && (
                  <InfoSection icon={<CheckSquare className="h-4 w-4 text-violet-600" />} iconClass="bg-violet-50 dark:bg-violet-900/30" title="Responsibilities">
                    <BulletList items={demand.responsibilities} />
                  </InfoSection>
                )}
                {demand.requirements && demand.requirements.length > 0 && (
                  <InfoSection icon={<Briefcase className="h-4 w-4 text-orange-600" />} iconClass="bg-orange-50 dark:bg-orange-900/30" title="Requirements">
                    <BulletList items={demand.requirements} />
                  </InfoSection>
                )}
                {demand.niceToHave && demand.niceToHave.length > 0 && (
                  <InfoSection icon={<Star className="h-4 w-4 text-yellow-600" />} iconClass="bg-yellow-50 dark:bg-yellow-900/30" title="Nice to Have">
                    <BulletList items={demand.niceToHave} />
                  </InfoSection>
                )}
                {demand.businessImpact && demand.businessImpact.length > 0 && (
                  <InfoSection icon={<Zap className="h-4 w-4 text-pink-600" />} iconClass="bg-pink-50 dark:bg-pink-900/30" title="Business Impact">
                    <BulletList items={demand.businessImpact} />
                  </InfoSection>
                )}
              </div>
            )}

            {/* ── FOOTER ── */}
            <DialogFooter className="flex-row items-center gap-2 pt-1 border-t">
              {hasExtras && (
                <Button variant="ghost" size="sm" className="mr-auto text-primary hover:text-primary"
                  onClick={() => setShowMore(p => !p)}>
                  {showMore ? <><ChevronUp className="h-4 w-4 mr-1" />View Less</> : <><ChevronDown className="h-4 w-4 mr-1" />View More</>}
                </Button>
              )}
              {demand.status === 'open' && (
                <Button variant="destructive" onClick={handleClose}>Close Position</Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
