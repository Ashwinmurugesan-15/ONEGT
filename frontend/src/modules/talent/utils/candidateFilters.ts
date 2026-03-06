import { Candidate, Interview, User } from '@/types/recruitment';

/**
 * Filters candidates based on user role and permissions
 * - Super Admin / Admin: See all candidates
 * - Interviewer: Only see candidates where interviewer email matches their login email
 * - Hiring Manager: See all candidates
 */
export const getFilteredCandidatesForUser = (
    candidates: Candidate[],
    interviews: Interview[],
    user: User | null
): Candidate[] => {
    if (!user) return [];

    // Super Admin and Admin see all candidates
    if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'hiring_manager') {
        return candidates;
    }

    // Interviewers only see their assigned candidates
    if (user.role === 'interviewer') {
        // Get all interviews where the interviewer email matches the logged-in user's email
        const userInterviews = interviews.filter(
            interview => interview.interviewerEmail?.toLowerCase() === user.email.toLowerCase()
        );

        // Extract unique candidate IDs
        const assignedCandidateIds = new Set(
            userInterviews.map(interview => interview.candidateId)
        );

        // Filter candidates to only those assigned to this interviewer
        return candidates.filter(candidate =>
            assignedCandidateIds.has(candidate.id)
        );
    }

    return candidates;

    return candidates;
};

/**
 * Filters interviews based on user role and permissions
 * - Super Admin / Admin: See all interviews
 * - Interviewer: Only see interviews where interviewer email matches their login email
 * - Hiring Manager: See all interviews
 */
export const getFilteredInterviewsForUser = (
    interviews: Interview[],
    user: User | null
): Interview[] => {
    if (!user) return [];

    // Super Admin, Admin, and Hiring Manager see all interviews
    if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'hiring_manager') {
        return interviews;
    }

    // Interviewers only see their assigned interviews
    if (user.role === 'interviewer') {
        return interviews.filter(
            interview => interview.interviewerEmail?.toLowerCase() === user.email.toLowerCase()
        );
    }

    return interviews;
};
