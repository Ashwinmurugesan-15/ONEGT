'use client';

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DemandCard } from '@/components/dashboard/DemandCard';
import { useDemands } from '@/context/DemandsContext';
import { useAuth } from '@/context/AuthContext';
import { Demand } from '@/types/recruitment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, Filter, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreateDemandDialog } from '@/components/dialogs/CreateDemandDialog';
import { DemandDetailsDialog } from '@/components/dialogs/DemandDetailsDialog';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { toast } from 'sonner';

const Demands = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Use global demands state
  const { demands, addDemand, updateDemand, closeDemand, deleteDemand } = useDemands();
  // const [demands, setDemands] = useState<Demand[]>(mockDemands); // Removed local state

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Deep linking
  const [searchParams] = useSearchParams();
  const demandId = searchParams.get('demandId');

  useEffect(() => {
    if (demandId && demands.length > 0) {
      const demand = demands.find(d => d.id === demandId);
      if (demand) {
        setSelectedDemand(demand);
        setIsDetailsOpen(true);
      }
    }
  }, [demandId, demands]);

  const filteredDemands = demands.filter((demand) => {
    // If deep linking to a specific demand, only show that one
    if (demandId) {
      return demand.id === demandId;
    }

    const matchesSearch =
      (demand.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (demand.role?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    // Hide deleted demands unless specifically filtering for them
    if (statusFilter === 'deleted') {
      return demand.status === 'deleted' && matchesSearch;
    }

    const matchesStatus = statusFilter === 'all' || demand.status === statusFilter;
    return matchesSearch && matchesStatus && demand.status !== 'deleted';
  });

  const handleCreateDemand = (newDemand: Omit<Demand, 'id' | 'createdAt' | 'applicants' | 'interviewed' | 'offers' | 'rejected'>) => {
    addDemand(newDemand);
  };

  const handleViewDetails = (demand: Demand) => {
    setSelectedDemand(demand);
    setIsDetailsOpen(true);
  };

  const handleEditDemand = (demand: Demand) => {
    setSelectedDemand(demand);
    setIsEditOpen(true);
  };

  const handleCloseDemand = (demand: Demand) => {
    setSelectedDemand(demand);
    setIsCloseConfirmOpen(true);
  };

  const confirmCloseDemand = () => {
    if (!selectedDemand) return;
    closeDemand(selectedDemand.id);
    toast.success(`Position "${selectedDemand.title}" has been closed`);
    setIsCloseConfirmOpen(false);
  };

  const handleSaveDemand = (updatedDemand: Demand) => {
    updateDemand(updatedDemand);
  };

  const handleDeleteDemand = (demand: Demand) => {
    setSelectedDemand(demand);
    setIsDeleteConfirmOpen(true);
  }

  const confirmDeleteDemand = () => {
    if (!selectedDemand) return;
    deleteDemand(selectedDemand.id);
    toast.success(`Position "${selectedDemand.title}" has been deleted`);
    setIsDeleteConfirmOpen(false);
  };

  return (
    <DashboardLayout title="Demands">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Job Demands</h2>
            <p className="text-muted-foreground">
              {filteredDemands.length} {filteredDemands.length === 1 ? 'position' : 'positions'} available
            </p>
          </div>
          <div className="flex gap-2">
            {demandId && (
              <Button variant="outline" onClick={() => navigate('/talent/demands')}>
                Show All Demands
              </Button>
            )}
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Demand
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search demands..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40 bg-background">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="deleted">Deleted Demands</SelectItem>

                </SelectContent>
              </Select>
              <div className="flex border border-border rounded-lg overflow-hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'rounded-none',
                    viewMode === 'grid' && 'bg-muted'
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'rounded-none',
                    viewMode === 'list' && 'bg-muted'
                  )}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Demands Grid */}
        <div
          className={cn(
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'flex flex-col gap-4'
          )}
        >
          {filteredDemands.map((demand) => (
            <DemandCard
              key={demand.id}
              demand={demand}
              onViewDetails={() => handleViewDetails(demand)}
              onEdit={demand.status !== 'deleted' && demand.status !== 'closed' ? () => handleEditDemand(demand) : undefined}
              onClose={demand.status !== 'deleted' ? () => handleCloseDemand(demand) : undefined}
              onDelete={demand.status !== 'deleted' ? () => handleDeleteDemand(demand) : undefined}
              showActions={demand.status !== 'deleted'}
              onViewApplied={() => navigate(`/talent/candidates?demandId=${demand.id}&status=applied`)}
              onViewInterviewed={() => navigate(`/talent/candidates?demandId=${demand.id}&status=interview_scheduled,interview_completed`)}
              onViewRejected={() => navigate(`/talent/candidates?demandId=${demand.id}&status=rejected`)}
              onViewOffers={() => navigate(`/talent/candidates?demandId=${demand.id}&status=offer_rolled,offer_accepted`)}
            />
          ))}
        </div>

        {filteredDemands.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No demands found matching your criteria</p>
          </div>
        )}

        {/* Dialogs */}
        <CreateDemandDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onCreate={handleCreateDemand}
        />

        <DemandDetailsDialog
          demand={selectedDemand}
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          mode="view"
          onSave={handleSaveDemand}
        />

        <DemandDetailsDialog
          demand={selectedDemand}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          mode="edit"
          onSave={handleSaveDemand}
        />

        <ConfirmDialog
          open={isCloseConfirmOpen}
          onOpenChange={setIsCloseConfirmOpen}
          title="Close Position"
          description={`Are you sure you want to close the position "${selectedDemand?.title}"? This will mark the demand as closed.`}
          confirmLabel="Close Position"
          variant="destructive"
          onConfirm={confirmCloseDemand}
        />

        <ConfirmDialog
          open={isDeleteConfirmOpen}
          onOpenChange={setIsDeleteConfirmOpen}
          title="Delete Position"
          description={`Are you sure you want to PERMANENTLY delete the position "${selectedDemand?.title}"? This action cannot be undone.`}
          confirmLabel="Delete Position"
          variant="destructive"
          onConfirm={confirmDeleteDemand}
        />
      </div>
    </DashboardLayout>
  );
};

export default Demands;
