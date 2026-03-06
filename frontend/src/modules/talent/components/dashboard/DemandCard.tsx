
import { Demand } from '@/types/recruitment';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, MapPin, Briefcase, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRecruitment } from '@/context/RecruitmentContext';

interface DemandCardProps {
  demand: Demand;
  onClick?: () => void;
  onViewDetails?: () => void;
  onEdit?: () => void;
  onClose?: () => void;
  onDelete?: () => void;
  onViewApplied?: () => void;
  onViewInterviewed?: () => void;
  onViewOffers?: () => void;
  onViewRejected?: () => void;
  showActions?: boolean;
}

const statusColors: Record<string, string> = {
  open: 'bg-success/10 text-success border-success/20',
  closed: 'bg-muted text-muted-foreground border-border',
  on_hold: 'bg-warning/10 text-warning border-warning/20',
  deleted: 'bg-destructive/10 text-destructive border-destructive/20',
};

const isValidDate = (d: any) => {
  return d instanceof Date && !isNaN(d.getTime());
};

export const DemandCard = ({ demand, onViewDetails, onEdit, onClose, onDelete, onViewApplied, onViewInterviewed, onViewOffers, onViewRejected, showActions = true }: DemandCardProps) => {
  const { candidates } = useRecruitment();
  // Live count: candidates linked to this demand who are rejected
  const liveRejectedCount = candidates.filter(
    c => c.demandId === demand.id && c.status === 'rejected'
  ).length;
  const rejectedCount = liveRejectedCount > 0 ? liveRejectedCount : (demand.rejected || 0);
  return (
    <Card
      className="group border shadow-card hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden"
      onClick={onViewDetails}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
              {demand.title}
            </h3>
            <div className="flex flex-wrap gap-2 mb-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{demand.location || 'Not Specified'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                <span>{demand.experience || 'Not Specified'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{demand.openings || 0} Openings</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn('border', statusColors[demand.status || 'open'] || statusColors.open)}>
              {(demand.status || 'open') === 'on_hold' ? 'On Hold' : (demand.status || 'open').charAt(0).toUpperCase() + (demand.status || 'open').slice(1)}
            </Badge>
            {showActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover">
                  {onEdit && (
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}>
                      Edit Demand
                    </DropdownMenuItem>
                  )}
                  {(demand.status || 'open') === 'open' && (
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      onClose?.();
                    }}>
                      Close Position
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}>
                      Delete Position
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Skills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {(demand.skills || []).slice(0, 4).map((skill) => (
            <Badge key={skill} variant="secondary" className="text-xs font-normal">
              {skill}
            </Badge>
          ))}
          {(demand.skills || []).length > 4 && (
            <Badge variant="secondary" className="text-xs font-normal">
              +{(demand.skills || []).length - 4}
            </Badge>
          )}
        </div>

        {/* Dates */}
        <div className="flex flex-col gap-1 mb-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>
              Created: {demand.createdAt && isValidDate(new Date(demand.createdAt))
                ? format(new Date(demand.createdAt), 'MMM d, yyyy h:mm a')
                : 'Not Specified'}
            </span>
          </div>
          {demand.reopenedAt && isValidDate(new Date(demand.reopenedAt)) && (
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span>Reopened: {format(new Date(demand.reopenedAt), 'MMM d, yyyy h:mm a')}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 pt-4 border-t border-border">
          <div className="text-center cursor-pointer hover:text-primary transition-colors" onClick={(e) => {
            e.stopPropagation();
            onViewApplied?.();
          }}>
            <p className="text-lg font-semibold text-foreground">{demand.applicants || 0}</p>
            <p className="text-xs text-muted-foreground">Applied</p>
          </div>
          <div className="text-center border-x border-border cursor-pointer hover:text-primary transition-colors" onClick={(e) => {
            e.stopPropagation();
            onViewInterviewed?.();
          }}>
            <p className="text-lg font-semibold text-foreground">{demand.interviewed || 0}</p>
            <p className="text-xs text-muted-foreground">Interviewed</p>
          </div>
          <div className="text-center border-r border-border cursor-pointer hover:text-destructive transition-colors" onClick={(e) => {
            e.stopPropagation();
            onViewRejected?.();
          }}>
            <p className="text-lg font-semibold text-foreground">{rejectedCount}</p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </div>
          <div className="text-center cursor-pointer hover:text-primary transition-colors" onClick={(e) => {
            e.stopPropagation();
            onViewOffers?.();
          }}>
            <p className="text-lg font-semibold text-foreground">{demand.offers || 0}</p>
            <p className="text-xs text-muted-foreground">Offers</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
