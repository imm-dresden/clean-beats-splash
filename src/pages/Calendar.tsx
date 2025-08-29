import { useState, useEffect } from "react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, CalendarDays, CheckCircle, Clock, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const Calendar = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  // Real events from equipment cleaning schedules
  const [equipmentData, setEquipmentData] = useState<any[]>([]);
  const [cleaningLogs, setCleaningLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchEquipmentData();
    fetchCleaningLogs();
  }, []);

  const fetchEquipmentData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setEquipmentData(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
    }
  };

  const fetchCleaningLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('cleaning_logs')
        .select(`
          *,
          equipment:equipment_id (name, type, icon)
        `)
        .eq('user_id', user.id)
        .order('cleaned_at', { ascending: false });

      if (error) throw error;
      setCleaningLogs(data || []);
    } catch (error) {
      console.error('Error fetching cleaning logs:', error);
    }
  };

  // Convert equipment data to events
  const events = [
    // Cleaning due dates
    ...equipmentData.map(item => ({
      id: `due-${item.id}`,
      title: `${item.name} Cleaning Due`,
      date: item.next_cleaning_due ? new Date(item.next_cleaning_due) : null,
      type: "cleaning_due" as const,
      equipment: item,
      log: undefined
    })).filter(event => event.date),
    
    // Past cleaning logs
    ...cleaningLogs.map(log => ({
      id: `log-${log.id}`,
      title: `${log.equipment?.name || 'Equipment'} Cleaned`,
      date: new Date(log.cleaned_at),
      type: "cleaning_completed" as const,
      equipment: undefined,
      log: log
    }))
  ];

  const getEventsForDate = (date: Date | undefined) => {
    if (!date) return [];
    return events.filter(event => 
      event.date.toDateString() === date.toDateString()
    );
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "cleaning_due": return "bg-orange-500";
      case "cleaning_completed": return "bg-green-500";
      case "maintenance": return "bg-blue-500";
      case "session": return "bg-purple-500";
      case "inspection": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case "cleaning_due": return <Clock className="w-3 h-3" />;
      case "cleaning_completed": return <CheckCircle className="w-3 h-3" />;
      default: return <Music className="w-3 h-3" />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground gradient-hero p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-accent" />
            <h1 className="text-3xl font-bold">Calendar</h1>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Add Event
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Component */}
          <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border-0 p-3 pointer-events-auto"
                classNames={{
                  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                  month: "space-y-4",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-medium",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex",
                  head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
                  row: "flex w-full mt-2",
                  cell: "h-8 w-8 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                  day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_today: "bg-accent text-accent-foreground",
                  day_outside: "text-muted-foreground opacity-50",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                  day_hidden: "invisible",
                }}
              />
            </CardContent>
          </Card>

          {/* Events Sidebar */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>
                {selectedDate ? `Events for ${selectedDate.toLocaleDateString()}` : "Select a Date"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getEventsForDate(selectedDate).length > 0 ? (
                  getEventsForDate(selectedDate).map((event) => (
                    <div key={event.id} className="p-3 rounded-lg border border-border/50 bg-background/30">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${getEventTypeColor(event.type)}`}></div>
                        <h3 className="font-medium text-sm">{event.title}</h3>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          {getEventTypeIcon(event.type)}
                          {event.type.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(event.date, 'h:mm a')}
                        </span>
                      </div>
                      {event.equipment && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Equipment: {event.equipment.name} ({event.equipment.type})
                        </div>
                      )}
                      {event.log?.notes && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Notes: {event.log.notes}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">No events scheduled for this date</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events */}
        <Card className="mt-6 bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Upcoming Cleaning Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events
                .filter(event => event.type === 'cleaning_due' && event.date >= new Date())
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .slice(0, 6)
                .map((event) => (
                <div key={event.id} className="p-4 rounded-lg border border-border/50 bg-background/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${getEventTypeColor(event.type)}`}></div>
                    <h3 className="font-medium text-sm">{event.equipment?.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2 capitalize">
                    {event.equipment?.type} • {format(event.date, 'MMM dd, yyyy')}
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      {getEventTypeIcon(event.type)}
                      Due for cleaning
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {Math.ceil((event.date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {events.filter(event => event.type === 'cleaning_due' && event.date >= new Date()).length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-muted-foreground">All equipment is up to date!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Calendar;