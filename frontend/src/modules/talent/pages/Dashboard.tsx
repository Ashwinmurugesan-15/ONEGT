'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { DemandCard } from '@/components/dashboard/DemandCard';
import { CandidatePipeline } from '@/components/dashboard/CandidatePipeline';
import { RecentInterviews } from '@/components/dashboard/RecentInterviews';
import { mockDashboardStats } from '@/data/mockData';
import { useRecruitment } from '@/context/RecruitmentContext';
import { useDemands } from '@/context/DemandsContext';
import { Demand } from '@/types/recruitment';
import {
  Briefcase,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  X,
  User,
} from 'lucide-react';
import { ClipboardCheck } from '@/components/ui/ClipboardCheck';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { DownloadReportsDialog } from '@/components/dialogs/DownloadReportsDialog';
import { DemandDetailsDialog } from '@/components/dialogs/DemandDetailsDialog';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { toast } from 'sonner';
import SplitText from '@/components/ui/SplitText';
import { AnimateIcon } from '@/components/ui/AnimateIcon';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { filteredCandidates: candidates, filteredInterviews: interviews } = useRecruitment();
  const { demands, updateDemand, closeDemand, deleteDemand } = useDemands();
  const activeDemands = demands.filter(d => d.status === 'open');

  const [isDownloadOpen, setIsDownloadOpen] = useState(false);

  // Demand action state
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const handleViewDetails = (demand: Demand) => { setSelectedDemand(demand); setIsDetailsOpen(true); };
  const handleEditDemand = (demand: Demand) => { setSelectedDemand(demand); setIsEditOpen(true); };
  const handleCloseDemand = (demand: Demand) => { setSelectedDemand(demand); setIsCloseConfirmOpen(true); };
  const handleDeleteDemand = (demand: Demand) => { setSelectedDemand(demand); setIsDeleteConfirmOpen(true); };
  const confirmCloseDemand = () => {
    if (!selectedDemand) return;
    closeDemand(selectedDemand.id);
    toast.success(`"${selectedDemand.title}" has been closed`);
    setIsCloseConfirmOpen(false);
  };
  const confirmDeleteDemand = () => {
    if (!selectedDemand) return;
    deleteDemand(selectedDemand.id);
    toast.success(`"${selectedDemand.title}" has been deleted`);
    setIsDeleteConfirmOpen(false);
  };

  const stats = {
    totalDemands: demands.length,
    openPositions: activeDemands.length,
    totalCandidates: candidates.length,
    interviewsScheduled: interviews.filter(i => i.status === 'scheduled').length,
    offersRolled: candidates.filter(c =>
      ['offer_rolled', 'offer_accepted', 'onboarding', 'onboarded'].includes(c.status)
    ).length,
    onboarded: candidates.filter(c => c.status === 'onboarded').length,
  };

  // Calculate role-specific stats
  const totalApplied = candidates.filter(c =>
    c.status !== 'rejected' &&
    c.round1Recommendation !== 'reject' &&
    c.round2Recommendation !== 'reject'
  ).length;
  const totalOffered = candidates.filter(c =>
    ['offer_rolled', 'offer_accepted', 'onboarding', 'onboarded'].includes(c.status)
  ).length;
  const totalRejected = candidates.filter(c =>
    c.round1Recommendation === 'reject' ||
    c.round2Recommendation === 'reject' ||
    (c.status === 'rejected' && !c.round1Recommendation && !c.round2Recommendation)
  ).length;
  const totalInterviews = interviews.length;
  const totalInterviewed = candidates.filter(c =>
    ['interview_scheduled', 'interview_completed', 'selected', 'offer_rolled', 'offer_accepted', 'onboarding', 'onboarded'].includes(c.status)
  ).length;



  const getRoleGreeting = () => {
    switch (user?.role) {
      case 'super_admin': return "Here's your complete hiring overview";
      case 'admin': return "Manage candidates and schedule interviews";
      case 'hiring_manager': return "Track your demands and hiring progress";
      case 'interviewer': return "Your upcoming interviews at a glance";
      default: return "Welcome to your recruitment portal";
    }
  };

  const [greeting, setGreeting] = useState('');
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  // Interviewer Dashboard
  if (user?.role === 'interviewer') {
    return (
      <DashboardLayout title="Dashboard">
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <SplitText
                text={`${greeting || 'Welcome'}, ${user?.name?.split(' ')[0]}!`}
                className="text-2xl font-bold text-foreground"
                delay={5}
                duration={0.2}
                ease="power3.out"
                splitType="chars"
                from={{ opacity: 0, y: 40 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.1}
                rootMargin="-100px"
                textAlign="left"
              />
              <p className="text-muted-foreground mt-1">{getRoleGreeting()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              title="Today's Interviews"
              value={interviews.filter(i =>
                i.scheduledAt instanceof Date && !isNaN(i.scheduledAt.getTime()) &&
                format(i.scheduledAt, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
              ).length}
              icon={<Calendar className="h-5 w-5" />}
              variant="primary"
            />
            <StatsCard
              title="This Week"
              value={stats.interviewsScheduled}
              icon={<Clock className="h-5 w-5" />}
              variant="accent"
            />
            <StatsCard
              title="Completed"
              value={interviews.filter(i => i.status === 'completed').length}
              icon={<CheckCircle2 className="h-5 w-5" />}
              variant="success"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Scheduled Interviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {interviews
                  .filter(interview => interview.status === 'scheduled')
                  .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
                  .map((interview, index) => (
                    <div
                      key={interview.id || `interview-${index}`}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-semibold">
                            {interview.candidateName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{interview.candidateName}</p>
                          <p className="text-sm text-muted-foreground">{interview.demandTitle}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">Round {interview.round}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {interview.scheduledAt instanceof Date && !isNaN(interview.scheduledAt.getTime())
                                ? format(interview.scheduledAt, 'dd MMM yyyy, hh:mm a')
                                : 'Date Error'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {interview.meetLink && (
                          <Button size="sm" asChild>
                            <a href={interview.meetLink} target="_blank" rel="noopener noreferrer">
                              Join Meet
                            </a>
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => navigate('/talent/interviews')}>
                          Submit Feedback
                        </Button>
                      </div>
                    </div>
                  ))}
                {interviews.filter(i => i.status === 'scheduled').length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No scheduled interviews at the moment.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Default Dashboard for super_admin, admin, hiring_manager
  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6 animate-fade-in">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <SplitText
              text={`${greeting || 'Welcome'}, ${user?.name?.split(' ')[0]}!`}
              className="text-2xl font-bold text-foreground"
              delay={50}
              duration={1.25}
              ease="power3.out"
              splitType="chars"
              from={{ opacity: 0, y: 40 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.1}
              rootMargin="-100px"
              textAlign="left"
            />
            <p className="text-muted-foreground mt-1">{getRoleGreeting()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsDownloadOpen(true)} className="group">
              <AnimateIcon animateOnHover animation="bounce" className="mr-2">
                <User className="h-4 w-4" />
              </AnimateIcon>
              Download Reports
            </Button>
          </div>
        </div>



        {/* Open Demands Section */}
        {activeDemands.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Open Demands
                <span className="ml-2 text-sm font-normal text-muted-foreground">({activeDemands.length})</span>
              </h3>
              <Button variant="ghost" size="sm" className="text-primary" onClick={() => navigate('/talent/demands')}>
                View All
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeDemands.map((demand) => (
                <DemandCard
                  key={demand.id}
                  demand={demand}
                  onViewDetails={() => handleViewDetails(demand)}
                  onEdit={() => handleEditDemand(demand)}
                  onClose={() => handleCloseDemand(demand)}
                  onDelete={() => handleDeleteDemand(demand)}
                  onViewApplied={() => navigate(`/talent/candidates?demandId=${demand.id}&status=applied`)}
                  onViewInterviewed={() => navigate(`/talent/candidates?demandId=${demand.id}&status=interview_scheduled,interview_completed`)}
                  onViewRejected={() => navigate(`/talent/candidates?demandId=${demand.id}&status=rejected`)}
                  onViewOffers={() => navigate(`/talent/candidates?demandId=${demand.id}&status=offer_rolled,offer_accepted`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <CandidatePipeline />
          </div>
          <div className="space-y-6">
            <RecentInterviews />
          </div>
        </div>

        <DownloadReportsDialog
          open={isDownloadOpen}
          onOpenChange={setIsDownloadOpen}
        />

        <DemandDetailsDialog
          demand={selectedDemand}
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          mode="view"
          onSave={updateDemand}
        />

        <DemandDetailsDialog
          demand={selectedDemand}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          mode="edit"
          onSave={updateDemand}
        />

        <ConfirmDialog
          open={isCloseConfirmOpen}
          onOpenChange={setIsCloseConfirmOpen}
          title="Close Position"
          description={`Are you sure you want to close "${selectedDemand?.title}"?`}
          confirmLabel="Close Position"
          variant="destructive"
          onConfirm={confirmCloseDemand}
        />

        <ConfirmDialog
          open={isDeleteConfirmOpen}
          onOpenChange={setIsDeleteConfirmOpen}
          title="Delete Position"
          description={`Permanently delete "${selectedDemand?.title}"? This cannot be undone.`}
          confirmLabel="Delete Position"
          variant="destructive"
          onConfirm={confirmDeleteDemand}
        />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
