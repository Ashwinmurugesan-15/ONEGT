'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Candidate, BenchResource, Interview, EmailTemplate, InterviewRound } from '@/types/recruitment';
import { mockBenchResources } from '@/data/mockData';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { getFilteredCandidatesForUser, getFilteredInterviewsForUser } from '@/utils/candidateFilters';

interface RecruitmentContextType {
    candidates: Candidate[];
    demands: any[];
    setDemands: (demands: any[]) => void;
    filteredCandidates: Candidate[];
    benchResources: BenchResource[];
    interviews: Interview[];
    filteredInterviews: Interview[];
    updateCandidateStatus: (candidateId: string, status: Candidate['status']) => void;
    updateCandidateFeedback: (candidateId: string, round: InterviewRound, feedback: any) => void;
    addCandidate: (candidate: Candidate) => Promise<Candidate>;
    applyCandidate: (formData: FormData, fallbackCandidate: Omit<Candidate, 'id' | 'appliedAt' | 'resumeUrl'>) => Promise<Candidate>;
    addBenchResource: (resource: BenchResource) => void;
    updateBenchResource: (resource: BenchResource) => void;
    addInterview: (interview: Omit<Interview, 'id'>) => void;
    updateInterview: (interviewId: string, updates: Partial<Interview>) => void;
    cancelInterview: (interviewId: string) => void;
    saveScreeningFeedback: (candidateId: string, feedback: string) => void;
    updateInterviewStatus: (candidateId: string, status: Candidate['interviewStatus']) => void;
    updateCandidateOfferDetails: (candidateId: string, updates: Partial<Pick<Candidate, 'offeredCTC' | 'offeredPosition' | 'dateOfJoining' | 'status' | 'experience' | 'currentCompany'>>) => void;
    updateCandidateOnboardingTask: (candidateId: string, taskId: string, completed: boolean) => Promise<void>;
    updateCandidate: (candidateId: string, updates: Partial<Candidate>) => Promise<void>;
    deleteCandidate: (candidateId: string) => void;
    sendEmail: (to: string, subject: string, html: string) => Promise<{ success: boolean; error?: any }>;
    emailTemplates: EmailTemplate[];
    updateEmailTemplate: (templateId: string, updates: Partial<EmailTemplate>) => void;
}

const RecruitmentContext = createContext<RecruitmentContextType | undefined>(undefined);

export const RecruitmentProvider = ({ children }: { children: ReactNode }) => {
    const { user, isAuthenticated, getAuthHeader } = useAuth();
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [demands, setDemands] = useState<any[]>([]);
    const [benchResources, setBenchResources] = useState<BenchResource[]>(mockBenchResources);
    const [interviews, setInterviews] = useState<Interview[]>([]);

    const mapApiInterview = (i: any): Interview => {
        // Handle ISO date or simple date
        let datePart = i.interview_date || i.scheduledAt || '';
        if (typeof datePart === 'string' && datePart.includes('T')) {
            datePart = datePart.split('T')[0];
        }

        const scheduledAt = datePart
            ? new Date(`${datePart}${i.interview_time ? 'T' + i.interview_time : ''}`)
            : (i.scheduledAt ? new Date(i.scheduledAt) : new Date());

        const mapRound = (round: any): InterviewRound => {
            if (!round) return 1;
            const r = String(round).toLowerCase();
            if (r.includes('client')) return 'client';
            if (r.includes('1')) return 1;
            if (r.includes('2')) return 2;
            if (r.includes('3')) return 3;
            return 1;
        };

        return {
            id: i.id,
            candidateId: i.candidateId || '',
            candidateName: i.candidateName || i.full_name || 'Candidate',
            demandId: i.demandId || '',
            demandTitle: i.demandTitle || i.position || 'Unknown Position',
            round: mapRound(i.round || i.interview_round),
            scheduledAt,
            interviewerId: i.interviewerId || '4',
            interviewerName: i.interviewerName || i.interviewer_name || 'Interviewer',
            interviewerEmail: i.interviewerEmail || '',
            meetLink: i.meetLink || i.meeting_link || '',
            status: i.status || 'scheduled',
            feedback: i.feedback
        };
    };

    // Compute filtered candidates based on user role and email
    const filteredCandidates = useMemo(() => {
        return getFilteredCandidatesForUser(candidates, interviews, user);
    }, [candidates, interviews, user]);

    // Compute filtered interviews based on user role and email
    const filteredInterviews = useMemo(() => {
        return getFilteredInterviewsForUser(interviews, user);
    }, [interviews, user]);

    useEffect(() => {
        const fetchData = async () => {
            if (!isAuthenticated) return;

            console.log('Fetching recruitment data...');
            try {
                // Fetch external applicants alongside internal data
                const headers = getAuthHeader();
                const [candRes, intRes, demRes] = await Promise.all([
                    fetch('/api/talent/candidates', { headers }),
                    fetch('/api/talent/interviews', { headers }),
                    fetch('/api/talent/demands', { headers })
                ]);

                console.log(`[RecruitmentContext] Responses: Candidates=${candRes.status}, Interviews=${intRes.status}, Demands=${demRes.status}`);

                if (!candRes.ok || !intRes.ok || !demRes.ok) {
                    console.error('[RecruitmentContext] Critical API failure');
                    throw new Error(`API error: ${candRes.status} / ${intRes.status} / ${demRes.status}`);
                }

                const cands = await candRes.json();
                const ints = await intRes.json();
                const dems = await demRes.json();

                console.log('Fetched candidates:', cands.length);
                console.log('Fetched interviews:', ints.length);
                console.log('Fetched demands:', dems.length);

                const allCandidates = cands.map((c: any) => ({
                    ...c,
                    name: c.name || c.full_name || 'Unknown',
                    appliedAt: c.appliedAt ? new Date(c.appliedAt) : new Date(),
                    dateOfJoining: c.dateOfJoining ? new Date(c.dateOfJoining) : undefined
                }));

                setCandidates(allCandidates);
                const mappedInterviews = ints.map((i: any) => {
                    const interview = mapApiInterview(i);
                    // Date-based heuristic linkage
                    const meetingDateStr = interview.scheduledAt.toISOString().split('T')[0];

                    const normalizeDate = (d: any) => {
                        if (!d) return null;
                        try {
                            return new Date(d).toISOString().split('T')[0];
                        } catch {
                            return null;
                        }
                    };

                    const matchingCandidate = allCandidates.find((c: any) => {
                        const r1 = normalizeDate(c.round1_dt);
                        const r2 = normalizeDate(c.round2_dt);
                        const r3 = normalizeDate(c.round3_dt);

                        const dateMatch = r1 === meetingDateStr || r2 === meetingDateStr || r3 === meetingDateStr;
                        if (!dateMatch) return false;

                        // Tie-breaker: Position match
                        if (interview.demandTitle && interview.demandTitle !== 'Unknown Position') {
                            const candPos = (c.interestedPosition || c.position || '').toLowerCase();
                            const intPos = interview.demandTitle.toLowerCase();
                            if (candPos && (candPos.includes(intPos) || intPos.includes(candPos))) {
                                return true;
                            }
                        }
                        return true; // Default to true if date matches and no position info
                    });

                    if (matchingCandidate) {
                        interview.candidateId = matchingCandidate.id;
                        interview.candidateName = matchingCandidate.name;
                        // Use candidate's demandId if meeting doesn't have a reliable one
                        if (!interview.demandId || interview.demandId === '') {
                            interview.demandId = matchingCandidate.demandId;
                        }

                        // Determine status based on candidate feedback
                        const round = Number(interview.round);
                        const hasFeedback = (round === 1 && matchingCandidate.round1Feedback) ||
                            (round === 2 && matchingCandidate.round2Feedback) ||
                            (interview.round === 'client' && matchingCandidate.clientFeedback);

                        if (hasFeedback) {
                            interview.status = 'completed';
                        }
                    }
                    return interview;
                });
                setInterviews(mappedInterviews);
                setDemands(dems);
            } catch (error) {
                console.error('Failed to fetch data:', error);
                toast.error('Failed to load recruitment data');
            }
        };
        fetchData();
    }, [isAuthenticated]);

    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([
        {
            id: 'round1',
            name: 'Round 1 - Technical Interview',
            subject: 'Interview Invitation - Round 1 - [Position]',
            body: `Dear [Candidate Name],

We are pleased to inform you that your application for the position of [Position] has been shortlisted.

We would like to invite you for Round 1 - Technical Interview / Coding with our team.

Interview Details:
━━━━━━━━━━━━━━━━━━━━━
📅 Date: [Date]
🕐 Time: [Time]
👤 Interviewer: [Interviewer]
 Your Resume: [Resume Link]
🔗 Meeting Link: [Link]
⏱️ Duration: 1 hour (approx.)

Interview Format:
━━━━━━━━━━━━━━━━━━━━━
This round will focus on:
• Technical assessment and coding challenges
• Discussion on your technical skills and experience
• Problem-solving exercises
• Code review and best practices

What to Prepare:
━━━━━━━━━━━━━━━━━━━━━
✓ Review fundamental concepts related to the position
✓ Practice coding problems
✓ Be ready to explain your previous projects
✓ Prepare questions about the role and team

Important Instructions:
━━━━━━━━━━━━━━━━━━━━━
✓ Please join the meeting 5 minutes prior to the scheduled time
✓ Ensure a stable internet connection
✓ Keep your resume and relevant documents handy
✓ Have a quiet environment for the interview
✓ Test your audio and video before the call

Please confirm your availability for this interview by replying to this email.

If you have any questions or need to reschedule, please feel free to contact us.

We look forward to meeting you!

Best regards,
HR Team / Recruitment Team

---
Note: This is an automated email. Please do not reply directly to this email.
For any queries, contact us at hr@company.com`
        },
        {
            id: 'round2',
            name: 'Round 2 - HR Interview',
            subject: 'Interview Invitation - Round 2 - [Position]',
            body: `Dear [Candidate Name],

Congratulations! You have successfully cleared Round 1 of the interview process.

We would like to invite you for Round 2 - Technical Interview / HR with our team for the position of [Position].

Interview Details:
━━━━━━━━━━━━━━━━━━━━━
📅 Date: [Date]
🕐 Time: [Time]
👤 Interviewer: [Interviewer]
 Your Resume: [Resume Link]
🔗 Meeting Link: [Link]
⏱️ Duration: 1 hour (approx.)

Interview Format:
━━━━━━━━━━━━━━━━━━━━━
This round will focus on:
• In-depth technical discussion
• System design and architecture
• HR round and cultural fit assessment
• Discussion on compensation and benefits
• Team expectations and work culture

What to Prepare:
━━━━━━━━━━━━━━━━━━━━━
✓ Be ready for advanced technical questions
✓ Prepare examples of your leadership experience
✓ Think about your career goals
✓ Prepare questions about company culture and growth opportunities
✓ Be ready to discuss salary expectations

Important Instructions:
━━━━━━━━━━━━━━━━━━━━━
✓ Please join the meeting 5 minutes prior to the scheduled time
✓ Ensure a stable internet connection
✓ Keep your resume and relevant documents handy
✓ Have a quiet environment for the interview
✓ Test your audio and video before the call

Please confirm your availability for this interview by replying to this email.

If you have any questions or need to reschedule, please feel free to contact us.

We are excited to move forward with your candidacy!

Best regards,
HR Team / Recruitment Team

---
Note: This is an automated email. Please do not reply directly to this email.
For any queries, contact us at hr@company.com`
        },
        {
            id: 'round_client',
            name: 'Client Interview',
            subject: 'Interview invitation: [Candidate Name] / [Position] / GuhaTek (Client Round)',
            body: `Dear [Candidate Name],

We are pleased to inform you that you have cleared the initial rounds of the interview process. 

We would like to invite you for a Client Interview round. This is a critical step where you will interact directly with our client partners.

Interview Details:
━━━━━━━━━━━━━━━━━━━━━
📅 Date: [Date]
🕐 Time: [Time]
🔗 Meeting Link: [Link]
⏱️ Duration: 1 hour (approx.)

Interview Focus:
━━━━━━━━━━━━━━━━━━━━━
This round will focus on:
• Specialized technical requirements
• Project-specific discussions
• Domain expertise alignment
• Professional fit for client engagement

Important Instructions:
━━━━━━━━━━━━━━━━━━━━━
✓ Please join the meeting 5 minutes prior to the scheduled time
✓ Ensure you are in a quiet environment with stable internet
✓ Have your resume ready for reference
✓ Keep your video ON throughout the session

Please confirm your availability for this round.

Best regards,
GuhaTek Recruitment Team`
        },
        {
            id: 'round1_rejection',
            name: 'Round 1 Rejection',
            subject: 'Update on your application for [Position]',
            body: `Dear [Candidate Name],

Thank you for taking the time to interview with us for the [Position] role.

We appreciate the opportunity to learn more about your skills and experience. After careful consideration, we have decided not to move forward with your application at this time.

We were impressed by your background, but we are looking for a candidate whose skills and experience more closely match our current needs.

We will keep your resume on file for future openings that may be a better fit.

We wish you all the best in your job search.

Best regards,
HR Team`
        },
        {
            id: 'round2_rejection',
            name: 'Round 2 Rejection',
            subject: 'Update on your application for [Position]',
            body: `Dear [Candidate Name],

Thank you for completing the second round of interviews for the [Position] position.

We enjoyed our conversation and appreciate your interest in our company. However, after reviewing our team's feedback, we have decided to proceed with other candidates who better align with our specific requirements for this role.

This was a difficult decision, and we want to thank you for the time and effort you invested in our interview process.

We wish you success in your future endeavors.

Best regards,
HR Team`
        },
        {
            id: 'interview_reminder',
            name: 'Interview Reminder',
            subject: 'Interview Reminder: [Position] - Round [Round]',
            body: `Dear [Candidate Name],

This is a reminder for your upcoming interview scheduled on [Date] at [Time].

Position: [Position]
Round: [Round]
[Link]

Please ensure you are available 5 minutes before the scheduled time.

Best regards,
HR Team`
        },
        {
            id: 'demand_created',
            name: 'New Demand Notification',
            subject: '📢 New Job Demand Created',
            body: `Dear [User Name],

A new job demand has been created in the HireFlow system. Here are the details:

📋 Demand Information
===================
Title: [Title]
Role: [Role]
Experience: [Experience]
Location: [Location]
Openings: [Openings]
Status: [Status]
Created By: [Created By]
Created At: [Created At]

🔧 Required Skills
=================
[Skills]

📊 Next Steps
============
1. Review the demand details in HireFlow
2. Approve if necessary
3. Monitor candidate applications
4. Coordinate with hiring managers

🔗 Quick Links
=============
View Demand: [HireFlow Dashboard Link]
Admin Panel: [Admin Portal Link]

📞 Support
=========
For any questions, please contact the HR team or system administrator.

Best regards,
The HireFlow Team`
        },
        {
            id: 'candidate_rejection',
            name: 'Candidate Rejection',
            subject: 'Application Update - [Position] - GuhaTek',
            body: `Dear [Candidate Name],

Thanks for applying to join our team. After reviewing your application, we’ve decided to move forward with candidates whose skills and experience are more closely aligned with this particular role.

That said, we were impressed with your background, and we’d love to keep your profile on file for future opportunities.

Wishing you success ahead, and we appreciate your interest in GuhaTek.

Sincerely,
GuhaTek Recruitment Team`
        }
    ]);

    const addCandidate = async (candidate: Candidate) => {
        try {
            const res = await fetch('/api/talent/candidates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify(candidate),
            });
            const newCand = await res.json();
            const formattedCand = { ...newCand, appliedAt: new Date(newCand.appliedAt) };
            setCandidates((prev) => [formattedCand, ...prev]);
            return formattedCand;
        } catch (error) {
            toast.error('Failed to add candidate');
            throw error;
        }
    };

    const applyCandidate = async (formData: FormData, fallbackCandidate: Omit<Candidate, 'id' | 'appliedAt' | 'resumeUrl'>) => {
        try {
            const res = await fetch('/api/talent/candidates/apply', {
                method: 'POST',
                headers: getAuthHeader(),
                body: formData
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || err.message || 'Failed to submit application');
            }

            const result = await res.json();
            const newCand: Candidate = {
                ...fallbackCandidate,
                id: result.id || String(candidates.length + 1),
                appliedAt: new Date(),
                resumeUrl: ''
            } as Candidate;
            setCandidates((prev) => [newCand, ...prev]);
            return newCand;
        } catch (error) {
            toast.error('Failed to apply candidate');
            throw error;
        }
    };

    const addBenchResource = (resource: BenchResource) => {
        setBenchResources((prev) => [resource, ...prev]);
    };

    const updateBenchResource = (resource: BenchResource) => {
        setBenchResources((prev) => prev.map(r => r.id === resource.id ? resource : r));
    };

    interface FeedbackData {
        recommendation: string;
        communication?: string;
        technicalAssessment?: string;
        problemSolving?: string;
        overallPotential?: string;
        ctc?: string;
        [key: string]: any;
    }

    const updateCandidateFeedback = async (candidateId: string, round: InterviewRound, feedback: FeedbackData | string) => {
        try {
            const updates: any = { id: candidateId };

            // Handle both string (legacy) and object feedback
            const feedbackData = typeof feedback === 'string' ? { recommendation: feedback } : feedback;
            const feedbackString = JSON.stringify(feedbackData);

            if (Number(round) === 1) {
                updates.round1Feedback = feedbackString;
                updates.round1Recommendation = feedbackData.recommendation;
            } else if (Number(round) === 2) {
                updates.round2Feedback = feedbackString;
                updates.round2Recommendation = feedbackData.recommendation;
            } else if (round === 'client') {
                updates.clientFeedback = feedbackString;
                updates.clientRecommendation = feedbackData.recommendation;
            }

            if (feedbackData.recommendation === 'reject') {
                updates.status = 'rejected';
            }

            const res = await fetch('/api/talent/candidates/update', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify(updates),
            });

            if (res.ok) {
                const updatedCand = await res.json();
                setCandidates((prev) =>
                    prev.map((c) => (c.id === candidateId ? { ...c, ...updatedCand, appliedAt: new Date(updatedCand.appliedAt || c.appliedAt) } : c))
                );
            }
        } catch (error) {
            toast.error('Failed to update candidate feedback');
        }
    };

    const updateCandidateStatus = async (candidateId: string, status: Candidate['status']) => {
        try {
            const res = await fetch('/api/talent/candidates/update', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({ id: candidateId, status }),
            });
            const updatedCand = await res.json();

            // Determine if we need to move to bench
            if (status === 'onboarded') {
                const candidate = candidates.find(c => c.id === candidateId);
                if (candidate && candidate.status !== 'onboarded') {
                    const newResource: BenchResource = {
                        id: String(benchResources.length + 1),
                        name: candidate.name,
                        email: candidate.email,
                        phone: candidate.phone,
                        role: 'Bench Resource',
                        skills: candidate.skills || [],
                        experience: candidate.experience || '0 years',
                        availableFrom: new Date(),
                        status: 'available',
                        location: candidate.location || 'Unknown',
                        expectedCTC: candidate.expectedCTC || '',
                        lastProject: '',
                    };
                    setBenchResources(prev => [newResource, ...prev]);
                    toast.success(`${candidate.name} has been moved to Bench Resources`);
                }
            }

            setCandidates((prev) =>
                prev.map((c) => (c.id === candidateId ? { ...c, ...updatedCand, appliedAt: new Date(updatedCand.appliedAt || c.appliedAt) } : c))
            );
        } catch (error) {
            toast.error('Failed to update candidate status');
        }
    };

    const updateCandidateOfferDetails = async (candidateId: string, updates: Partial<Pick<Candidate, 'offeredCTC' | 'offeredPosition' | 'dateOfJoining' | 'status' | 'experience' | 'currentCompany'>>) => {
        try {
            const res = await fetch('/api/talent/candidates/update', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({ id: candidateId, ...updates }),
            });

            if (res.ok) {
                const updatedCand = await res.json();
                setCandidates((prev) =>
                    prev.map((c) => (c.id === candidateId ? { ...c, ...updatedCand, appliedAt: new Date(updatedCand.appliedAt || c.appliedAt) } : c))
                );
                toast.success(`Candidate offer details updated`);
            }
        } catch (error) {
            toast.error('Failed to update offer details');
        }
    };

    const addInterview = async (interview: Omit<Interview, 'id'>) => {
        try {
            const res = await fetch('/api/talent/interviews', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify(interview),
            });

            if (res.ok) {
                const newInterview = await res.json();
                setInterviews((prev) => [...prev, { ...newInterview, scheduledAt: new Date(newInterview.scheduledAt) }]);

                // Automatically update candidate status and current round
                const isRejected = interview.feedback?.decision === 'reject';

                // Map logical status to Guhatek API enum values
                let mappedInterviewStatus: string = interview.status || 'scheduled';
                if (isRejected) {
                    mappedInterviewStatus = 'reject';
                } else if (interview.status === 'completed') {
                    if (interview.round === 1) mappedInterviewStatus = 'tech_inter_comp';
                    else if (interview.round === 2) mappedInterviewStatus = 'hr_inter_comp';
                    else if (interview.round === 'client') mappedInterviewStatus = 'all_completed';
                } else if (interview.status === 'scheduled') {
                    if (interview.round === 1) mappedInterviewStatus = 'tech_inter_sched';
                    else if (interview.round === 2) mappedInterviewStatus = 'hr_inter_sched';
                    else if (interview.round === 'client') mappedInterviewStatus = 'hr_inter_sched'; // Fallback
                }

                const candidateUpdateRes = await fetch('/api/talent/candidates/update', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeader()
                    },
                    body: JSON.stringify({
                        id: interview.candidateId,
                        status: isRejected ? 'rejected' : (interview.status === 'completed' ? 'interview_completed' : 'interview_scheduled'),
                        interviewStatus: mappedInterviewStatus,
                        currentRound: interview.round
                    }),
                });

                if (candidateUpdateRes.ok) {
                    const updatedCand = await candidateUpdateRes.json();
                    setCandidates((prev) =>
                        prev.map((c) => (c.id === interview.candidateId ? { ...c, ...updatedCand, appliedAt: new Date(updatedCand.appliedAt || c.appliedAt) } : c))
                    );

                    const statusMessage = isRejected ? 'rejected' : (interview.status === 'completed' ? 'noted' : 'scheduled');
                    toast.success(`Interview ${statusMessage} for ${interview.candidateName}`);
                } else {
                    toast.error('Failed to update candidate status');
                }
            }
        } catch (error) {
            toast.error('Failed to schedule interview');
        }
    };

    const updateInterview = async (interviewId: string, updates: Partial<Interview>) => {
        try {
            const res = await fetch('/api/talent/interviews', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({ id: interviewId, ...updates }),
            });

            if (res.ok) {
                const updatedInt = await res.json();
                setInterviews((prev) =>
                    prev.map((i) => i.id === interviewId ? { ...updatedInt, scheduledAt: new Date(updatedInt.scheduledAt) } : i)
                );

                // If the interview status is updated to 'completed' or 'cancelled', update candidate's currentRound or status
                if (updates.status === 'completed' || updates.status === 'cancelled') {
                    const candidateUpdateRes = await fetch('/api/talent/candidates/update', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getAuthHeader()
                        },
                        body: JSON.stringify({
                            id: updatedInt.candidateId,
                            currentRound: updates.status === 'completed' ? updatedInt.round + 1 : updatedInt.round, // Move to next round if completed
                            status: updates.status === 'cancelled' ? 'interview_cancelled' : 'interview_completed',
                            interviewStatus: updates.status === 'completed' ? 'completed' : 'cancelled'
                        }),
                    });

                    if (candidateUpdateRes.ok) {
                        const updatedCand = await candidateUpdateRes.json();
                        setCandidates((prev) =>
                            prev.map((c) => (c.id === updatedInt.candidateId ? { ...c, ...updatedCand, appliedAt: new Date(updatedCand.appliedAt || c.appliedAt) } : c))
                        );
                    }
                }
            }
        } catch (error) {
            toast.error('Failed to update interview');
        }
    };

    const cancelInterview = (interviewId: string) => {
        setInterviews((prev) =>
            prev.map((i) => i.id === interviewId ? { ...i, status: 'cancelled' as const } : i)
        );
        toast.info(`Interview has been cancelled`);
    };

    const saveScreeningFeedback = async (candidateId: string, feedback: string) => {
        try {
            const isRejected = feedback.toLowerCase().includes('reject');
            const res = await fetch('/api/talent/candidates/update', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({
                    id: candidateId,
                    screeningFeedback: feedback,
                    status: isRejected ? 'rejected' : undefined
                }),
            });

            if (res.ok) {
                const updatedCand = await res.json();
                setCandidates((prev) =>
                    prev.map((c) => (c.id === candidateId ? { ...c, ...updatedCand, appliedAt: new Date(updatedCand.appliedAt || c.appliedAt) } : c))
                );
                toast.success('Initial screening feedback saved');
            }
        } catch (error) {
            toast.error('Failed to save screening feedback');
        }
    };

    const updateCandidateOnboardingTask = async (candidateId: string, taskId: string, completed: boolean) => {
        try {
            const candidate = candidates.find(c => c.id === candidateId);
            if (!candidate) return;

            const updatedTasks = (candidate.onboardingTasks || []).map(task =>
                task.id === taskId ? { ...task, completed } : task
            );

            // Calculate overall status
            const completedCount = updatedTasks.filter(t => t.completed).length;
            let onboardingStatus: Candidate['onboardingStatus'] = 'pending';
            if (completedCount === updatedTasks.length && updatedTasks.length > 0) {
                onboardingStatus = 'completed';
            } else if (completedCount > 0) {
                onboardingStatus = 'in_progress';
            }

            const res = await fetch('/api/talent/candidates/update', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({
                    id: candidateId,
                    onboardingTasks: updatedTasks,
                    onboardingStatus
                }),
            });

            if (res.ok) {
                const updatedCand = await res.json();
                setCandidates((prev) =>
                    prev.map((c) => (c.id === candidateId ? { ...c, ...updatedCand, appliedAt: new Date(updatedCand.appliedAt || c.appliedAt) } : c))
                );
            }
        } catch (error) {
            console.error('Failed to update onboarding task:', error);
            toast.error('Failed to update task');
        }
    };

    const updateCandidate = async (candidateId: string, updates: Partial<Candidate>) => {
        try {
            const res = await fetch('/api/talent/candidates/update', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({ id: candidateId, ...updates }),
            });

            if (res.ok) {
                const updatedCand = await res.json();
                // Map Guhatek API field names back to Candidate type fields
                const mapped: Partial<Candidate> = {
                    ...updatedCand,
                    name: updatedCand.fullName || updatedCand.name,
                    phone: updatedCand.contactNumber || updatedCand.phone,
                    currentCompany: updatedCand.currentOrganization || updatedCand.currentCompany,
                    experience: updatedCand.totalExperience != null ? String(updatedCand.totalExperience) + ' years' : updatedCand.experience,
                    location: updatedCand.currentLocation || updatedCand.location,
                    currentCTC: updatedCand.currentCTC != null ? String(updatedCand.currentCTC) : undefined,
                    expectedCTC: updatedCand.expectedCTC != null ? String(updatedCand.expectedCTC) : undefined,
                    linkedInProfile: updatedCand.linkedinProfile || updatedCand.linkedInProfile,
                    isServingNotice: updatedCand.currentlyInNotice ?? updatedCand.isServingNotice,
                    isImmediateJoiner: updatedCand.immediateJoiner ?? updatedCand.isImmediateJoiner,
                    hasOtherOffers: updatedCand.otherOffersInHand ?? updatedCand.hasOtherOffers,
                };
                setCandidates((prev) =>
                    prev.map((c) => (c.id === candidateId ? { ...c, ...mapped, appliedAt: new Date(updatedCand.appliedAt || c.appliedAt) } : c))
                );
                toast.success('Candidate updated successfully');
            } else {
                throw new Error('Failed to update candidate');
            }
        } catch (error) {
            console.error('Failed to update candidate:', error);
            toast.error('Failed to update candidate');
        }
    };

    const deleteCandidate = (candidateId: string) => {
        setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
        toast.success('Candidate removed from view');
    };

    const sendEmail = async (to: string, subject: string, html: string) => {
        try {
            const res = await fetch('/api/talent/email/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({ to, subject, html }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Email sent successfully');
                return { success: true };
            } else {
                throw new Error(data.error || 'Failed to send email');
            }
        } catch (error) {
            console.error('Failed to send email:', error);
            toast.error('Failed to send email');
            return { success: false, error };
        }
    };

    const updateInterviewStatus = (candidateId: string, status: Candidate['interviewStatus']) => {
        setCandidates((prev) =>
            prev.map((c) => (c.id === candidateId ? { ...c, interviewStatus: status } : c))
        );
        toast.success('Interview status updated');
    };

    const updateEmailTemplate = (templateId: string, updates: Partial<EmailTemplate>) => {
        setEmailTemplates((prev) =>
            prev.map((t) => (t.id === templateId ? { ...t, ...updates } : t))
        );
        toast.success('Email template updated successfully');
    };

    return (
        <RecruitmentContext.Provider value={{
            candidates,
            demands,
            setDemands,
            filteredCandidates,
            benchResources,
            interviews,
            filteredInterviews,
            updateCandidateStatus,
            updateCandidateFeedback,
            addCandidate,
            applyCandidate,
            addBenchResource,
            updateBenchResource,
            addInterview,
            updateInterview,
            cancelInterview,
            saveScreeningFeedback,
            updateInterviewStatus,
            updateCandidateOfferDetails,
            updateCandidateOnboardingTask,
            updateCandidate,
            deleteCandidate,
            sendEmail,
            emailTemplates,
            updateEmailTemplate
        }}>
            {children}
        </RecruitmentContext.Provider>
    );
};

export const useRecruitment = () => {
    const context = useContext(RecruitmentContext);
    if (context === undefined) {
        throw new Error('useRecruitment must be used within a RecruitmentProvider');
    }
    return context;
};
