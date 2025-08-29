import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Clock, Music, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isSameMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Equipment {
  id: string;
  name: string;
  type: string;
  icon?: string;
  cleaning_frequency_days: number;
  next_cleaning_due?: string;
  notifications_enabled: boolean;
}

interface CleaningEvent {
  id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentType: string;
  equipmentIcon?: string;
  date: Date;
  isOverdue: boolean;
  isDueToday: boolean;
  notifications_enabled: boolean;
}

const equipmentIcons = {
  guitar: "🎸",
  drums: "🥁", 
  microphone: "🎤",
  speaker: "🔊",
  keyboard: "🎹",
  violin: "🎻",
  trumpet: "🎺",
  saxophone: "🎷",
  amplifier: "📢",
  mixer: "🎛️",
  headphones: "🎧",
  other: "🎵"
};

const Calendar = () => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [cleaningEvents, setCleaningEvents] = useState<CleaningEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchEquipment();
  }, []);

  useEffect(() => {
    generateCleaningEvents();
  }, [equipment, currentDate]);

  const fetchEquipment = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setEquipment(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch equipment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCleaningEvents = () => {
    const events: CleaningEvent[] = [];
    const today = new Date();
    const oneYearFromToday = addDays(today, 365);

    equipment.forEach((item) => {
      if (!item.next_cleaning_due) return;

      const startDate = new Date(item.next_cleaning_due);
      const frequency = item.cleaning_frequency_days;
      
      // Generate recurring events for up to one year
      let currentEventDate = new Date(startDate);
      while (currentEventDate <= oneYearFromToday) {
        const isOverdue = currentEventDate < today && !isSameDay(currentEventDate, today);
        const isDueToday = isSameDay(currentEventDate, today);

        events.push({
          id: `${item.id}-${currentEventDate.getTime()}`,
          equipmentId: item.id,
          equipmentName: item.name,
          equipmentType: item.type,
          equipmentIcon: item.icon,
          date: new Date(currentEventDate),
          isOverdue,
          isDueToday,
          notifications_enabled: item.notifications_enabled
        });

        // Add the frequency to get the next cleaning date
        currentEventDate = addDays(currentEventDate, frequency);
      }
    });

    // Sort events by date
    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    setCleaningEvents(events);
  };

  const getEventsForDate = (date: Date) => {
    return cleaningEvents.filter(event => isSameDay(event.date, date));
  };

  const getEventsForMonth = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    return cleaningEvents.filter(event => 
      event.date >= monthStart && event.date <= monthEnd
    );
  };

  const getDaysInMonth = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    setSelectedDate(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground gradient-hero flex items-center justify-center">
        <div className="text-xl">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground gradient-hero p-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <CalendarIcon className="w-8 h-8 text-accent" />
          <h1 className="text-3xl font-bold">Cleaning Calendar</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar View */}
          <div className="lg:col-span-2">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">
                    {format(currentDate, 'MMMM yyyy')}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigateMonth('prev')}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigateMonth('next')}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                  {getDaysInMonth().map(day => {
                    const dayEvents = getEventsForDate(day);
                    const hasEvents = dayEvents.length > 0;
                    const hasOverdue = dayEvents.some(e => e.isOverdue);
                    const hasDueToday = dayEvents.some(e => e.isDueToday);
                    
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`
                          min-h-[60px] p-1 text-sm border rounded-lg transition-colors
                          ${isSameMonth(day, currentDate) ? 'text-foreground' : 'text-muted-foreground'}
                          ${isToday(day) ? 'bg-accent text-accent-foreground font-bold' : ''}
                          ${selectedDate && isSameDay(day, selectedDate) ? 'ring-2 ring-primary' : ''}
                          ${hasEvents && !isToday(day) ? 'bg-primary/10' : ''}
                          ${hasOverdue ? 'bg-destructive/20 border-destructive' : ''}
                          ${hasDueToday ? 'bg-yellow-500/20 border-yellow-500' : ''}
                          hover:bg-muted
                        `}
                      >
                        <div className="font-medium">{format(day, 'd')}</div>
                        {hasEvents && (
                          <div className="flex flex-wrap gap-0.5 mt-1">
                            {dayEvents.slice(0, 3).map((event, idx) => (
                              <div 
                                key={idx} 
                                className={`
                                  w-1.5 h-1.5 rounded-full
                                  ${event.isOverdue ? 'bg-destructive' : 
                                    event.isDueToday ? 'bg-yellow-500' : 'bg-primary'}
                                `}
                              />
                            ))}
                            {dayEvents.length > 3 && (
                              <div className="text-xs">+{dayEvents.length - 3}</div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Selected Date Events */}
            {selectedDate && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getEventsForDate(selectedDate).length > 0 ? (
                    <div className="space-y-3">
                      {getEventsForDate(selectedDate).map((event) => (
                        <div
                          key={event.id}
                          className={`
                            p-3 rounded-lg border
                            ${event.isOverdue ? 'bg-destructive/10 border-destructive' : 
                              event.isDueToday ? 'bg-yellow-500/10 border-yellow-500' : 'bg-primary/10 border-primary'}
                          `}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {equipmentIcons[event.equipmentType as keyof typeof equipmentIcons] || event.equipmentIcon || "🎵"}
                            </span>
                            <div className="flex-1">
                              <div className="font-medium">{event.equipmentName}</div>
                              <div className="text-sm text-muted-foreground capitalize">
                                {event.equipmentType}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {event.isOverdue && (
                                <Badge variant="destructive" className="text-xs">Overdue</Badge>
                              )}
                              {event.isDueToday && (
                                <Badge className="text-xs bg-yellow-500 text-yellow-50">Due Today</Badge>
                              )}
                              {event.notifications_enabled && (
                                <div className="text-xs text-muted-foreground">🔔 Enabled</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No cleaning scheduled for this date
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Monthly Summary */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">This Month</CardTitle>
              </CardHeader>
              <CardContent>
                {getEventsForMonth().length > 0 ? (
                  <div className="space-y-3">
                    {getEventsForMonth().slice(0, 10).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                      >
                        <span className="text-lg">
                          {equipmentIcons[event.equipmentType as keyof typeof equipmentIcons] || event.equipmentIcon || "🎵"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{event.equipmentName}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(event.date, 'MMM d')}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          {event.isOverdue && (
                            <Badge variant="destructive" className="text-xs">Overdue</Badge>
                          )}
                          {event.isDueToday && (
                            <Badge className="text-xs bg-yellow-500 text-yellow-50">Today</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {getEventsForMonth().length > 10 && (
                      <p className="text-sm text-muted-foreground text-center pt-2">
                        +{getEventsForMonth().length - 10} more this month
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No cleaning scheduled this month
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Total Equipment</span>
                    <span className="font-medium">{equipment.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">This Month</span>
                    <span className="font-medium">{getEventsForMonth().length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-destructive">Overdue</span>
                    <span className="font-medium text-destructive">
                      {cleaningEvents.filter(e => e.isOverdue).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-yellow-600">Due Today</span>
                    <span className="font-medium text-yellow-600">
                      {cleaningEvents.filter(e => e.isDueToday).length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;