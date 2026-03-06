import { useMemo } from 'react';
import { useDemands } from '@/context/DemandsContext';
import { useRecruitment } from '@/context/RecruitmentContext';
import { differenceInDays } from 'date-fns';

export interface NotificationItem {
    id: string;
    type: 'demand' | 'interview';
    title: string;
    subtitle: string;
    time: string;
    date: Date;
    read: boolean;
}

export const useNotifications = () => {
    const { demands } = useDemands();
    const { interviews } = useRecruitment();

    const notifications = useMemo(() => {
        const items: NotificationItem[] = [];
        const now = new Date();

        // Process Demands (Created in last 7 days)
        demands.forEach(demand => {
            // Use createdAt if available, otherwise fallback to current time for demo/mock data
            // In a real app, strict date checking would apply
            const createdDate = demand.createdAt ? new Date(demand.createdAt) : new Date();

            if (differenceInDays(now, createdDate) <= 7) {
                items.push({
                    id: `demand-${demand.id}`,
                    type: 'demand',
                    title: `Demand Created: ${demand.title}`,
                    subtitle: `${demand.location} • ${demand.experience}`,
                    time: createdDate.toLocaleDateString(),
                    date: createdDate,
                    read: false,
                });
            }
        });

        // Process Interviews (Scheduled in last 7 days OR upcoming)
        interviews.forEach((interview, index) => {
            // Handle scheduledAt which might be a string from JSON or a Date object
            const scheduledAt = new Date(interview.scheduledAt);

            // Ensure we have a unique ID even if interview.id is missing
            const uniqueId = interview.id || `missing-id-${index}-${Date.now()}`;

            // Show interviews created recently or upcoming
            if (differenceInDays(scheduledAt, now) >= -7) {
                items.push({
                    id: `interview-${uniqueId}`,
                    type: 'interview',
                    title: `Interview Scheduled: ${interview.candidateName || 'Unknown Candidate'}`,
                    subtitle: `Round ${interview.round} • ${scheduledAt.toLocaleDateString()} ${scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                    time: scheduledAt.toLocaleDateString(),
                    date: scheduledAt,
                    read: false,
                });
            }
        });

        // Sort by Date (Newest First)
        return items.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [demands, interviews]);

    return { notifications, unreadCount: notifications.length };
};
