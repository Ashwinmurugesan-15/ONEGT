import { useState } from 'react';
import { Demand } from '@/types/recruitment';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useUsers } from '@/context/UsersContext';
import { useRecruitment } from '@/context/RecruitmentContext';

const replacePlaceholders = (template: string, data: Record<string, string>) => {
  let result = template;
  Object.entries(data).forEach(([key, value]) => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\[${escapedKey}\\]`, 'g'), value);
  });
  return result;
};

interface CreateDemandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate?: (demand: Omit<Demand, 'id' | 'createdAt' | 'applicants' | 'interviewed' | 'offers'>) => void;
}

const DEPARTMENTS = ['SRE', 'Automation-DevOps', 'AI-ML', 'Software-Development'];
const LEVELS = ['Entry', 'Mid', 'Senior', 'Lead', 'Staff'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const WORK_MODES = ['Onsite', 'Hybrid', 'Remote'];

const DEFAULT_FORM = {
  // Basic
  title: '',
  role: '',
  experience: '',
  location: '',
  openings: 1,
  skills: '',
  // Enhanced
  department: '',
  roleCategory: '',
  level: '',
  employmentType: '',
  workMode: '',
  salary: '',
  description: '',
  responsibilities: '',
  requirements: '',
  niceToHave: '',
  businessImpact: '',
};

export const CreateDemandDialog = ({ open, onOpenChange, onCreate }: CreateDemandDialogProps) => {
  const { users } = useUsers();
  const { emailTemplates, sendEmail } = useRecruitment();
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [activeTab, setActiveTab] = useState('basic');

  const set = (field: keyof typeof DEFAULT_FORM, value: string | number) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const splitLines = (text: string) =>
    text.split('\n').map(s => s.trim()).filter(Boolean);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.experience || !formData.location) {
      toast.error('Please fill in all required fields (Title, Experience, Location)');
      setActiveTab('basic');
      return;
    }

    const newDemand = {
      title: formData.title,
      role: formData.role || formData.title,
      experience: formData.experience,
      location: formData.location,
      openings: formData.openings,
      skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
      status: 'open' as const,
      createdBy: 'Current User',
      rejected: 0,
      // Enhanced fields
      department: formData.department || 'Software-Development',
      roleCategory: formData.roleCategory || formData.role || formData.title,
      level: formData.level || 'Mid',
      employmentType: formData.employmentType || 'Full-time',
      workMode: formData.workMode || 'Onsite',
      salary: formData.salary || 'Competitive',
      description: formData.description || '',
      responsibilities: splitLines(formData.responsibilities),
      requirements: splitLines(formData.requirements),
      niceToHave: splitLines(formData.niceToHave),
      businessImpact: splitLines(formData.businessImpact),
      isActive: true,
      postedDate: new Date().toISOString().split('T')[0],
    };

    // Email notifications
    const adminUsers = users.filter(u => u.role === 'admin' || u.role === 'super_admin');
    adminUsers.forEach(user => {
      const template = emailTemplates.find(t => t.id === 'demand_created');
      let emailSubject = '📢 New Job Demand Created';
      let emailBody = '';

      if (template) {
        const pData = {
          'User Name': user.name,
          'Title': newDemand.title,
          'Role': newDemand.role,
          'Experience': newDemand.experience,
          'Location': newDemand.location,
          'Openings': newDemand.openings.toString(),
          'Status': newDemand.status.toUpperCase(),
          'Created By': newDemand.createdBy,
          'Created At': new Date().toLocaleString(),
          'Skills': newDemand.skills.join(', '),
          'HireFlow Dashboard Link': 'https://hireflow.app/demands',
          'Admin Portal Link': 'https://hireflow.app/admin',
        };
        emailSubject = replacePlaceholders(template.subject, pData);
        emailBody = replacePlaceholders(template.body, pData);
      } else {
        emailBody = `📢 New Job Demand Created\n\nDear ${user.name},\n\nA new job demand has been created: ${newDemand.title}`;
      }

      if (user.email) {
        sendEmail(user.email, emailSubject, emailBody.replace(/\n/g, '<br>'))
          .then(() => console.log(`Email sent to ${user.email}`))
          .catch(err => console.error(`Failed to send email to ${user.email}`, err));
      }
    });

    onCreate?.(newDemand);
    toast.success('Demand created successfully!');
    toast.info(`Job posted on career page: ${newDemand.title}`);
    onOpenChange(false);
    setFormData(DEFAULT_FORM);
    setActiveTab('basic');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Demand</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="details">Job Details</TabsTrigger>
            </TabsList>

            {/* ── TAB 1: BASIC INFO ── */}
            <TabsContent value="basic" className="space-y-4">
              <div className="space-y-2">
                <Label>Job Title <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.title}
                  onChange={e => set('title', e.target.value)}
                  placeholder="e.g., Senior Site Reliability Engineer"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Role / Designation</Label>
                <Input
                  value={formData.role}
                  onChange={e => set('role', e.target.value)}
                  placeholder="e.g., Production SRE"
                />
              </div>

              <div className="space-y-2">
                <Label>Role Category</Label>
                <Input
                  value={formData.roleCategory}
                  onChange={e => set('roleCategory', e.target.value)}
                  placeholder="e.g., Platform Engineering, Backend Engineering"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Experience <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.experience}
                    onChange={e => set('experience', e.target.value)}
                    placeholder="e.g., 5–7 years"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.location}
                    onChange={e => set('location', e.target.value)}
                    placeholder="e.g., Coimbatore"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Number of Openings</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.openings}
                  onChange={e => set('openings', parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="space-y-2">
                <Label>Required Skills <span className="text-muted-foreground text-xs">(comma-separated)</span></Label>
                <Textarea
                  value={formData.skills}
                  onChange={e => set('skills', e.target.value)}
                  placeholder="e.g., AWS, Kubernetes, Docker, Terraform"
                  rows={2}
                />
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={() => setActiveTab('details')}>
                  Next: Job Details →
                </Button>
              </div>
            </TabsContent>

            {/* ── TAB 2: JOB DETAILS ── */}
            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={formData.department} onValueChange={v => set('department', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Level / Seniority</Label>
                  <Select value={formData.level} onValueChange={v => set('level', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employment Type</Label>
                  <Select value={formData.employmentType} onValueChange={v => set('employmentType', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Work Mode</Label>
                  <Select value={formData.workMode} onValueChange={v => set('workMode', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select work mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_MODES.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Salary Range</Label>
                <Input
                  value={formData.salary}
                  onChange={e => set('salary', e.target.value)}
                  placeholder='e.g., "15–20 LPA" or "$120k–$150k"'
                />
              </div>

              <div className="space-y-2">
                <Label>Job Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Describe the role, team context, and what the candidate will be doing…"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Responsibilities <span className="text-muted-foreground text-xs">(one per line)</span></Label>
                <Textarea
                  value={formData.responsibilities}
                  onChange={e => set('responsibilities', e.target.value)}
                  placeholder={"Manage production infrastructure\nLead incident response\nMentor junior engineers"}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Requirements <span className="text-muted-foreground text-xs">(one per line)</span></Label>
                <Textarea
                  value={formData.requirements}
                  onChange={e => set('requirements', e.target.value)}
                  placeholder={"5+ years of SRE experience\nStrong AWS & Kubernetes skills\nExperience with CI/CD pipelines"}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Nice to Have <span className="text-muted-foreground text-xs">(optional — one per line)</span></Label>
                <Textarea
                  value={formData.niceToHave}
                  onChange={e => set('niceToHave', e.target.value)}
                  placeholder={"Experience with Terraform\nKnowledge of PromQL / Grafana"}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Business Impact <span className="text-muted-foreground text-xs">(optional — one per line)</span></Label>
                <Textarea
                  value={formData.businessImpact}
                  onChange={e => set('businessImpact', e.target.value)}
                  placeholder={"Improve system uptime to 99.99%\nReduce deployment time by 40%"}
                  rows={2}
                />
              </div>

              <DialogFooter className="pt-4 gap-2">
                <Button type="button" variant="outline" onClick={() => setActiveTab('basic')}>
                  ← Back
                </Button>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Demand</Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
};
