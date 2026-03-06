import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRecruitment } from '@/context/RecruitmentContext';
import { Video, Clock, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

export const RecentInterviews = () => {
  const router = useRouter();
  const { interviews } = useRecruitment();

  const upcomingInterviews = interviews
    .filter((i) => i.status === 'scheduled')
    .sort((a, b) => {
      const timeA = a.scheduledAt instanceof Date && !isNaN(a.scheduledAt.getTime()) ? a.scheduledAt.getTime() : 0;
      const timeB = b.scheduledAt instanceof Date && !isNaN(b.scheduledAt.getTime()) ? b.scheduledAt.getTime() : 0;
      return timeA - timeB;
    })
    .slice(0, 4);

  const handleViewAll = () => {
    router.push('/interviews');
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Upcoming Interviews</CardTitle>
        <Button variant="ghost" size="sm" className="text-primary" onClick={handleViewAll}>
          View All
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {upcomingInterviews.map((interview, index) => (
          <div
            key={interview.id || `interview-${index}`}
            className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="font-semibold text-primary">
                {interview.candidateName.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{interview.candidateName}</p>
              <p className="text-sm text-muted-foreground truncate">{interview.demandTitle}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="text-xs">
                Round {interview.round}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {interview.scheduledAt instanceof Date && !isNaN(interview.scheduledAt.getTime())
                  ? format(interview.scheduledAt, 'MMM d, h:mm a')
                  : 'Invalid Data'}
              </div>
            </div>
            {interview.meetLink && (
              <Button
                size="icon"
                variant="ghost"
                className="flex-shrink-0 text-accent hover:text-accent"
                onClick={() => window.open(interview.meetLink, '_blank')}
              >
                <Video className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        {upcomingInterviews.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No upcoming interviews scheduled</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
