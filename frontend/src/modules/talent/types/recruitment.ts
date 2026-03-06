export type UserRole = 'super_admin' | 'admin' | 'hiring_manager' | 'interviewer';

export interface OnboardingTask {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  icon?: string; // Storing icon name as string for persistence
}

export type CandidateStatus =
  | 'applied'
  | 'screening'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'selected'
  | 'rejected'
  | 'offer_rolled'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'onboarding'
  | 'onboarded';

export type InterviewStatus =
  | 'applied'
  | 'profile_screening_comp'
  | 'voice_screening_comp'
  | 'tech_inter_sched'
  | 'tech_inter_comp'
  | 'code_inter_sched'
  | 'code_inter_comp'
  | 'hr_inter_sched'
  | 'hr_inter_comp'
  | 'offer'
  | 'pending_final_noti'
  | 'references'
  | 'all_completed';

export type InterviewRound = 1 | 2 | 3 | 'client';

export interface UserPermissions {
  isSuperAdmin?: boolean; // Grant full super admin access
  canManageUsers?: boolean; // Can this user assign permissions to others
  features: {
    dashboard: boolean;
    demands: boolean;
    candidates: boolean;
    interviews: boolean;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  originalRole?: UserRole; // Track the true role for masquerading
  avatar?: string;
  isActive: boolean;
  permissions?: UserPermissions;
}

export interface Demand {
  id: string;
  title: string;
  role: string;
  experience: string;
  location: string;
  openings: number;
  skills: string[];
  status: 'open' | 'closed' | 'on_hold' | 'deleted';
  createdBy: string;
  createdAt: Date;
  applicants: number;
  interviewed: number;
  offers: number;
  rejected: number;
  reopenedAt?: Date;
  // New fields for Job Postings Alignment
  department?: string;
  roleCategory?: string;
  level?: string;
  employmentType?: string;
  workMode?: string;
  salary?: string;
  description?: string;
  responsibilities?: string[];
  requirements?: string[];
  niceToHave?: string[];
  businessImpact?: string[];
  isActive?: boolean;
  postedDate?: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  resumeUrl?: string;
  demandId: string;
  status: CandidateStatus;
  skills: string[];
  source: 'career_portal' | 'linkedin' | 'indeed' | 'naukri' | 'referral' | 'other';
  experience: string;
  currentCompany?: string;
  location?: string;
  noticePeriod?: string;
  appliedAt: Date;
  currentRound?: InterviewRound;
  expectedCTC?: string;
  offeredCTC?: string;
  offeredPosition?: string;
  dateOfJoining?: Date;
  linkedInProfile?: string;
  currentRole?: string;
  locationPreference?: string;
  currentCTC?: string;
  isServingNotice?: boolean;
  isImmediateJoiner?: boolean;
  hasOtherOffers?: boolean;
  otherOfferCTC?: string;
  certifications?: string[];
  referredBy?: string;
  interestedPosition?: string;
  additionalInfo?: string;
  comments?: string;
  round1Recommendation?: string;
  round1Feedback?: string;
  round2Recommendation?: string;
  round2Feedback?: string;
  clientRecommendation?: string;
  clientFeedback?: string;
  screeningFeedback?: string;
  interviewStatus?: InterviewStatus;
  onboardingStatus?: 'pending' | 'in_progress' | 'completed';
  onboardingTasks?: OnboardingTask[];
  department?: string;
  reportingManager?: string;
}

export interface Interview {
  id: string;
  candidateId: string;
  candidateName: string;
  demandId: string;
  demandTitle: string;
  round: InterviewRound;
  scheduledAt: Date;
  interviewerId: string;
  interviewerName: string;
  interviewerEmail?: string;
  meetLink?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  feedback?: {
    technicalRating: number;
    communicationRating: number;
    comments: string;
    decision: 'move_forward' | 'reject';
  };
}

export interface DashboardStats {
  totalDemands: number;
  openPositions: number;
  totalCandidates: number;
  interviewsScheduled: number;
  offersRolled: number;
  onboarded: number;
}

export type BenchStatus = 'available' | 'releasing_soon' | 'allocated';

export interface BenchResource {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  skills: string[];
  experience: string;
  availableFrom: Date;
  status: BenchStatus;
  location: string;
  expectedCTC: string;
  lastProject?: string;
  avatar?: string;
}

// Projects & Allocations Types
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled';
export type AllocationStatus = 'active' | 'ended' | 'upcoming';

export interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  description?: string;
  status: ProjectStatus;
  startDate: Date;
  endDate?: Date;
  teamSize: number;
  allocatedResources: number;
  techStack: string[];
  projectManager: string;
}

export interface ResourceAllocation {
  id: string;
  resourceId: string;
  resourceName: string;
  resourceEmail: string;
  projectId: string;
  projectName: string;
  clientName: string;
  role: string;
  skills: string[];
  allocationPercentage: number;
  startDate: Date;
  endDate?: Date;
  status: AllocationStatus;
}

export interface AllocationHistory {
  id: string;
  resourceId: string;
  resourceName: string;
  projectId: string;
  projectName: string;
  clientName: string;
  role: string;
  startDate: Date;
  endDate: Date;
  duration: string;
}

export interface Client {
  id: string;
  name: string;
  industry: string;
  contactPerson: string;
  email: string;
  phone: string;
  projectCount: number;
  activeProjects: number;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}
