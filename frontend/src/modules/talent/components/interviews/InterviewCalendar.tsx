import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, addDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Interview, Candidate } from '@/types/recruitment';
import { Clock, Video, Calendar, ChevronLeft, ChevronRight, ExternalLink, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import 'react-day-picker/style.css';

interface InterviewCalendarProps {
    interviews: Interview[];
    candidates?: Candidate[]; // Added candidates prop
    selectedDate: string | null;
    onDateSelect: (date: string | null) => void;
    onAddToGoogleCalendar: (interview: Interview) => void;
}

export const InterviewCalendar = ({
    interviews,
    candidates = [], // Default to empty array
    selectedDate,
    onDateSelect,
    onAddToGoogleCalendar,
}: InterviewCalendarProps) => {
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

    // Get dates that have interviews
    const interviewDates = interviews.reduce((acc, interview) => {
        try {
            const date = new Date(interview.scheduledAt);
            if (isNaN(date.getTime())) return acc;
            const dateStr = format(date, 'yyyy-MM-dd');
            if (!acc[dateStr]) {
                acc[dateStr] = [];
            }
            acc[dateStr].push(interview);
        } catch (e) {
            console.error('Error formatting interview date:', e);
        }
        return acc;
    }, {} as Record<string, Interview[]>);

    // Get interview count for a specific date
    const getInterviewCount = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return interviewDates[dateStr]?.length || 0;
    };

    // Get interviews for a specific date
    const getInterviewsForDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return interviewDates[dateStr] || [];
    };

    // Handle date click
    const handleDayClick = (day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (selectedDate === dateStr) {
            onDateSelect(null); // Deselect if already selected
        } else {
            onDateSelect(dateStr);
        }
    };

    // Custom day content renderer for month view
    const renderDayContent = (day: Date) => {
        const count = getInterviewCount(day);
        const isSelected = selectedDate === format(day, 'yyyy-MM-dd');
        const isToday = isSameDay(day, new Date());

        return (
            <div
                className={cn(
                    'relative w-full h-full flex flex-col items-center justify-center cursor-pointer rounded-lg transition-all',
                    isSelected && 'bg-primary text-primary-foreground',
                    isToday && !isSelected && 'ring-2 ring-primary ring-offset-2',
                    count > 0 && !isSelected && 'bg-primary/10'
                )}
                onClick={() => handleDayClick(day)}
                title={count > 0 ? `${count} interview${count > 1 ? 's' : ''} scheduled` : undefined}
            >
                <span className={cn("text-sm font-semibold", isSelected && "text-primary-foreground")}>
                    {format(day, 'd')}
                </span>
                {count > 0 && (
                    <div className="flex gap-1 mt-1">
                        {count <= 3 ? (
                            Array.from({ length: count }).map((_, i) => {
                                // Define distinct colors for dots
                                const dotColors = [
                                    "bg-blue-500",
                                    "bg-orange-500",
                                    "bg-green-500",
                                    "bg-purple-500",
                                    "bg-pink-500"
                                ];
                                const colorClass = dotColors[i % dotColors.length];

                                return (
                                    <span
                                        key={i}
                                        className={cn(
                                            "w-2 h-2 rounded-full",
                                            isSelected ? "bg-white" : colorClass
                                        )}
                                    />
                                );
                            })
                        ) : (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-primary text-primary-foreground border-none">
                                {count}
                            </Badge>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Week view
    const renderWeekView = () => {
        const weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentMonth, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentMonth(addDays(currentMonth, -7))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">
                        {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                    </h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentMonth(addDays(currentMonth, 7))}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {days.map((day) => {
                        const dayInterviews = getInterviewsForDate(day);
                        const isSelected = selectedDate === format(day, 'yyyy-MM-dd');
                        const isToday = isSameDay(day, new Date());

                        return (
                            <div
                                key={day.toISOString()}
                                className={cn(
                                    'p-2 rounded-lg border cursor-pointer transition-all min-h-[100px]',
                                    isSelected && 'border-primary bg-primary/5',
                                    isToday && !isSelected && 'border-primary/50',
                                    dayInterviews.length > 0 && !isSelected && 'bg-accent/10'
                                )}
                                onClick={() => handleDayClick(day)}
                            >
                                <div className="text-center mb-2">
                                    <p className="text-xs text-muted-foreground">{format(day, 'EEE')}</p>
                                    <p className={cn(
                                        "text-lg font-semibold",
                                        isToday && "text-primary"
                                    )}>{format(day, 'd')}</p>
                                </div>
                                {dayInterviews.length > 0 && (
                                    <div className="space-y-1">
                                        {dayInterviews.slice(0, 2).map((interview, i) => (
                                            <div
                                                key={`${interview.id || 'interview'}-${i}`}
                                                className="text-xs p-1 bg-primary/10 rounded truncate"
                                                title={`${interview.candidateName} - ${interview.scheduledAt instanceof Date && !isNaN(interview.scheduledAt.getTime()) ? format(interview.scheduledAt, 'h:mm a') : 'TBD'}`}
                                            >
                                                {interview.scheduledAt instanceof Date && !isNaN(interview.scheduledAt.getTime()) ? format(interview.scheduledAt, 'h:mm a') : 'TBD'}
                                            </div>
                                        ))}
                                        {dayInterviews.length > 2 && (
                                            <p className="text-xs text-muted-foreground text-center">
                                                +{dayInterviews.length - 2} more
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Day view
    const renderDayView = () => {
        const dayInterviews = getInterviewsForDate(currentMonth);

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentMonth(addDays(currentMonth, -1))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">{format(currentMonth, 'EEEE, MMMM d, yyyy')}</h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentMonth(addDays(currentMonth, 1))}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                {dayInterviews.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No interviews scheduled for this day</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {dayInterviews.map((interview, i) => {
                            const candidate = candidates?.find(c => c.id === interview.candidateId);
                            return (
                                <Card key={`${interview.id || 'day-int'}-${i}`} className="shadow-sm">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3 w-full">
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mt-1 flex-shrink-0">
                                                    <Clock className="h-5 w-5 text-primary" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-medium">{interview.scheduledAt instanceof Date && !isNaN(interview.scheduledAt.getTime()) ? format(interview.scheduledAt, 'h:mm a') : 'TBD'}</p>
                                                            <p className="text-sm text-foreground font-medium">{interview.candidateName}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline">Round {interview.round}</Badge>
                                                            {interview.meetLink && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => window.open(interview.meetLink, '_blank')}
                                                                >
                                                                    <Video className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => onAddToGoogleCalendar(interview)}
                                                                title="Add to Google Calendar"
                                                            >
                                                                <ExternalLink className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {candidate && (
                                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground bg-muted/30 p-2 rounded-md">
                                                            {candidate.email && (
                                                                <div className="flex items-center gap-1">
                                                                    <Mail className="h-3 w-3" />
                                                                    <span className="truncate">{candidate.email}</span>
                                                                </div>
                                                            )}
                                                            {candidate.phone && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-semibold">Ph:</span>
                                                                    <span>{candidate.phone}</span>
                                                                </div>
                                                            )}
                                                            {candidate.currentRole && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-semibold">Role:</span>
                                                                    <span className="truncate">{candidate.currentRole}</span>
                                                                </div>
                                                            )}
                                                            {candidate.currentCompany && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-semibold">Org:</span>
                                                                    <span className="truncate">{candidate.currentCompany}</span>
                                                                </div>
                                                            )}
                                                            {candidate.experience && (
                                                                <div className="flex items-center gap-1 sm:col-span-2">
                                                                    <span className="font-semibold">Exp:</span>
                                                                    <span>{candidate.experience} years</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <Card className="shadow-card">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Interview Calendar</CardTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open('https://calendar.google.com/calendar', '_blank')}
                        >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open Google Calendar
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-2">
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'month' | 'week' | 'day')}>
                    <TabsList className="mb-4">
                        <TabsTrigger value="month">Month</TabsTrigger>
                        <TabsTrigger value="week">Week</TabsTrigger>
                        <TabsTrigger value="day">Day</TabsTrigger>
                    </TabsList>

                    <TabsContent value="month" className="mt-0">
                        <DayPicker
                            mode="single"
                            selected={selectedDate ? new Date(selectedDate) : undefined}
                            month={currentMonth}
                            onMonthChange={setCurrentMonth}
                            modifiers={{
                                hasInterview: Object.keys(interviewDates).map((d) => new Date(d)),
                            }}
                            modifiersClassNames={{
                                hasInterview: "font-bold"
                            }}
                            components={{
                                Day: ({ day, modifiers, ...props }) => (
                                    <td {...props} role="gridcell">
                                        {renderDayContent(day.date)}
                                    </td>
                                ),
                            }}
                            className="mx-auto"
                            classNames={{
                                month_caption: 'flex justify-center pt-1 relative items-center pb-4',
                                caption_label: 'text-sm font-medium',
                                nav: 'space-x-1 flex items-center absolute right-1 z-10',
                                button_previous: 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 flex items-center justify-center cursor-pointer',
                                button_next: 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 flex items-center justify-center cursor-pointer',
                                chevron: 'h-4 w-4 fill-current',
                                month_grid: 'w-full border-collapse table-fixed mt-4',
                                weekdays: '',
                                weekday: 'text-muted-foreground font-medium text-sm text-center py-2 border-b border-border',
                                weeks: '',
                                week: '',
                                day: 'w-full h-12 p-1 align-top text-left border border-border relative focus-within:relative focus-within:z-20 font-normal aria-selected:opacity-100 hover:bg-accent/50 transition-colors focus:bg-accent',
                                selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
                                today: 'bg-accent/30',
                                outside: 'text-muted-foreground opacity-50 bg-muted/20',
                                disabled: 'text-muted-foreground opacity-50 bg-muted/20',
                                hidden: 'invisible',
                            }}
                        />
                    </TabsContent>

                    <TabsContent value="week" className="mt-0">
                        {renderWeekView()}
                    </TabsContent>

                    <TabsContent value="day" className="mt-0">
                        {renderDayView()}
                    </TabsContent>
                </Tabs>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        <span>Has interviews</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded border-2 border-primary" />
                        <span>Today</span>
                    </div>
                    {selectedDate && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDateSelect(null)}
                            className="ml-auto"
                        >
                            Clear selection
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
