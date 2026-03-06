import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRecruitment } from '@/context/RecruitmentContext';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const pipelineStages = [
  { key: 'applied', label: 'Applied', color: 'bg-info' },
  { key: 'screening', label: 'Screening', color: 'bg-warning' },
  { key: 'interview_scheduled', label: 'Interview', color: 'bg-primary' },
  { key: 'selected', label: 'Selected', color: 'bg-success' },
  { key: 'offer_rolled', label: 'Offered', color: 'bg-accent' },
  { key: 'onboarding', label: 'Onboarding', color: 'bg-success' },
];

export const CandidatePipeline = () => {
  const router = useRouter();
  const { candidates } = useRecruitment();

  const getCandidateCount = (stage: string) => {
    return candidates.filter((c) => c.status === stage).length;
  };

  const maxCount = Math.max(...pipelineStages.map((s) => getCandidateCount(s.key)));

  const handleStageClick = (stage: string) => {
    router.push(`/candidates?status=${stage}`);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Hiring Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pipelineStages.map((stage) => {
            const count = getCandidateCount(stage.key);
            const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

            return (
              <div
                key={stage.key}
                className="space-y-2 cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleStageClick(stage.key)}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{stage.label}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', stage.color)}
                    style={{ width: `${Math.max(percentage, 5)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
