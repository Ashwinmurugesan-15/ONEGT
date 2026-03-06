import { CandidateStatus } from '@/types/recruitment';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: CandidateStatus;
  className?: string;
}

const statusConfig: Record<CandidateStatus, { label: string; className: string }> = {
  applied: { label: 'Received', className: 'bg-blue-200 text-blue-800 border-blue-300' },
  screening: { label: 'Proceed Further', className: 'bg-amber-200 text-amber-800 border-amber-300' },
  interview_scheduled: { label: 'On Hold', className: 'bg-blue-200 text-blue-900 border-blue-300' },
  interview_completed: { label: 'No Resp Call/Email', className: 'bg-slate-200 text-slate-800 border-slate-300' },
  selected: { label: 'Accepted', className: 'bg-green-200 text-green-800 border-green-300' },
  rejected: { label: 'Rejected', className: 'bg-red-200 text-red-800 border-red-300' },
  offer_rolled: { label: 'Sent', className: 'bg-purple-200 text-purple-800 border-purple-300' },
  offer_accepted: { label: 'In Notice', className: 'bg-indigo-200 text-indigo-800 border-indigo-300' },
  offer_rejected: { label: 'Did Not Join', className: 'bg-rose-200 text-rose-800 border-rose-300' },
  onboarding: { label: 'Onboarding', className: 'bg-cyan-200 text-cyan-800 border-cyan-300' },
  onboarded: { label: 'Joined', className: 'bg-emerald-200 text-emerald-800 border-emerald-300' },
};

export const StatusBadge = ({ status, className, extraLabel }: StatusBadgeProps & { extraLabel?: string }) => {
  const normalizedStatus = (status || 'applied').toLowerCase() as CandidateStatus;
  const config = statusConfig[normalizedStatus] || statusConfig.applied;

  return (
    <Badge className={cn('border font-medium', config.className, className)}>
      {config.label}
      {normalizedStatus === 'rejected' && extraLabel && <span className="ml-1 opacity-75">({extraLabel})</span>}
    </Badge>
  );
};
