import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Clock, Music, ChevronLeft, ChevronRight, Plus, MapPin, Edit, Trash } from "lucide-react";
import { format, addDays, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isSameMonth, parse } from "date-fns";
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

interface Event {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  start_date: string;
  end_date?: string;
  location?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
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

const eventTypeIcons = {
  gig: "🎸",
  show: "🎭",
  jam: "🎵",
  rehearsal: "🎶",
  recording: "🎙️",
  other: "📅"
};

const Calendar = () => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [cleaningEvents, setCleaningEvents] = useState<CleaningEvent[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'gig',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    location: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchEquipment();
    fetchEvents();
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

  const fetchEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date');

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch events",
        variant: "destructive",
      });
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
    const cleaningEventsForDate = cleaningEvents.filter(event => isSameDay(event.date, date));
    const regularEventsForDate = events.filter(event => isSameDay(new Date(event.start_date), date));
    return { cleaningEvents: cleaningEventsForDate, events: regularEventsForDate };
  };

  const getEventsForMonth = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    const monthCleaningEvents = cleaningEvents.filter(event => 
      event.date >= monthStart && event.date <= monthEnd
    );
    
    const monthRegularEvents = events.filter(event => {
      const eventDate = new Date(event.start_date);
      return eventDate >= monthStart && eventDate <= monthEnd;
    });
    
    return { cleaningEvents: monthCleaningEvents, events: monthRegularEvents };
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

  const handleEventSubmit = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startDateTime = eventForm.start_date && eventForm.start_time 
        ? new Date(`${eventForm.start_date}T${eventForm.start_time}`).toISOString()
        : new Date().toISOString();
      
      const endDateTime = eventForm.end_date && eventForm.end_time
        ? new Date(`${eventForm.end_date}T${eventForm.end_time}`).toISOString()
        : null;

      const eventData = {
        title: eventForm.title,
        description: eventForm.description,
        event_type: eventForm.event_type,
        location: eventForm.location,
        user_id: user.id,
        start_date: startDateTime,
        end_date: endDateTime,
      };

      if (editingEvent) {
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', editingEvent.id);
        
        if (error) throw error;
        toast({ title: "Success", description: "Event updated successfully" });
      } else {
        const { error } = await supabase
          .from('events')
          .insert([eventData]);
        
        if (error) throw error;
        toast({ title: "Success", description: "Event created successfully" });
      }

      setShowEventDialog(false);
      setEditingEvent(null);
      setEventForm({
        title: '',
        description: '',
        event_type: 'gig',
        start_date: '',
        start_time: '',
        end_date: '',
        end_time: '',
        location: ''
      });
      fetchEvents();
    } catch (error) {
      toast({
        title: "Error",
        description: editingEvent ? "Failed to update event" : "Failed to create event",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);
      
      if (error) throw error;
      toast({ title: "Success", description: "Event deleted successfully" });
      fetchEvents();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    }
  };

  const openEventDialog = (event?: Event, date?: Date) => {
    if (event) {
      setEditingEvent(event);
      const startDate = new Date(event.start_date);
      const endDate = event.end_date ? new Date(event.end_date) : null;
      
      setEventForm({
        title: event.title,
        description: event.description || '',
        event_type: event.event_type,
        start_date: format(startDate, "yyyy-MM-dd"),
        start_time: format(startDate, "HH:mm"),
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : '',
        end_time: endDate ? format(endDate, "HH:mm") : '',
        location: event.location || ''
      });
    } else {
      setEditingEvent(null);
      const defaultDate = date || selectedDate || new Date();
      setEventForm({
        title: '',
        description: '',
        event_type: 'gig',
        start_date: format(defaultDate, "yyyy-MM-dd"),
        start_time: format(new Date(), "HH:mm"),
        end_date: '',
        end_time: '',
        location: ''
      });
    }
    setShowEventDialog(true);
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-accent" />
            <h1 className="text-3xl font-bold">Calendar</h1>
          </div>
          <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => openEventDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>{editingEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={eventForm.title}
                    onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Event title"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="event_type">Type</Label>
                  <Select value={eventForm.event_type} onValueChange={(value) => setEventForm(prev => ({ ...prev, event_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gig">🎸 Gig</SelectItem>
                      <SelectItem value="show">🎭 Show</SelectItem>
                      <SelectItem value="jam">🎵 Jam Session</SelectItem>
                      <SelectItem value="rehearsal">🎶 Rehearsal</SelectItem>
                      <SelectItem value="recording">🎙️ Recording</SelectItem>
                      <SelectItem value="other">📅 Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={eventForm.start_date}
                    onChange={(e) => setEventForm(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={eventForm.start_time}
                    onChange={(e) => setEventForm(prev => ({ ...prev, start_time: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_date">End Date (Optional)</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={eventForm.end_date}
                    onChange={(e) => setEventForm(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_time">End Time (Optional)</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={eventForm.end_time}
                    onChange={(e) => setEventForm(prev => ({ ...prev, end_time: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={eventForm.location}
                    onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Venue or location"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={eventForm.description}
                    onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Additional details"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleEventSubmit}
                    disabled={!eventForm.title}
                    className="flex-1"
                  >
                    {editingEvent ? 'Update Event' : 'Create Event'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowEventDialog(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
                    const dayData = getEventsForDate(day);
                    const hasCleaningEvents = dayData.cleaningEvents.length > 0;
                    const hasRegularEvents = dayData.events.length > 0;
                    const hasAnyEvents = hasCleaningEvents || hasRegularEvents;
                    const hasOverdue = dayData.cleaningEvents.some(e => e.isOverdue);
                    const hasDueToday = dayData.cleaningEvents.some(e => e.isDueToday);
                    
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`
                          min-h-[60px] p-1 text-sm border rounded-lg transition-colors
                          ${isSameMonth(day, currentDate) ? 'text-foreground' : 'text-muted-foreground'}
                          ${isToday(day) ? 'bg-accent text-accent-foreground font-bold' : ''}
                          ${selectedDate && isSameDay(day, selectedDate) ? 'ring-2 ring-primary' : ''}
                          ${hasAnyEvents && !isToday(day) ? 'bg-primary/10' : ''}
                          ${hasOverdue ? 'bg-destructive/20 border-destructive' : ''}
                          ${hasDueToday ? 'bg-yellow-500/20 border-yellow-500' : ''}
                          hover:bg-muted
                        `}
                      >
                        <div className="font-medium">{format(day, 'd')}</div>
                        {hasAnyEvents && (
                          <div className="flex flex-wrap gap-0.5 mt-1">
                            {/* Cleaning events */}
                            {dayData.cleaningEvents.slice(0, 2).map((event, idx) => (
                              <div 
                                key={`cleaning-${idx}`} 
                                className={`
                                  w-1.5 h-1.5 rounded-full
                                  ${event.isOverdue ? 'bg-destructive' : 
                                    event.isDueToday ? 'bg-yellow-500' : 'bg-primary'}
                                `}
                              />
                            ))}
                            {/* Regular events */}
                            {dayData.events.slice(0, 2).map((event, idx) => (
                              <div 
                                key={`event-${idx}`} 
                                className="w-1.5 h-1.5 rounded-full bg-accent"
                              />
                            ))}
                            {(dayData.cleaningEvents.length + dayData.events.length) > 2 && (
                              <div className="text-xs">+{(dayData.cleaningEvents.length + dayData.events.length) - 2}</div>
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
                  {(() => {
                    const dayData = getEventsForDate(selectedDate);
                    const hasAnyEvents = dayData.cleaningEvents.length > 0 || dayData.events.length > 0;
                    
                    return hasAnyEvents ? (
                      <div className="space-y-4">
                        {/* Regular Events */}
                        {dayData.events.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-medium text-sm text-muted-foreground">Events</h4>
                            {dayData.events.map((event) => (
                              <div
                                key={event.id}
                                className="p-3 rounded-lg border bg-accent/10 border-accent"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-2 flex-1">
                                    <span className="text-lg">
                                      {eventTypeIcons[event.event_type as keyof typeof eventTypeIcons] || "📅"}
                                    </span>
                                    <div className="flex-1">
                                      <div className="font-medium">{event.title}</div>
                                      <div className="text-sm text-muted-foreground capitalize">
                                        {event.event_type}
                                      </div>
                                      {event.location && (
                                        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                          <MapPin className="w-3 h-3" />
                                          {event.location}
                                        </div>
                                      )}
                                      {event.description && (
                                        <div className="text-sm text-muted-foreground mt-1">
                                          {event.description}
                                        </div>
                                      )}
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {format(new Date(event.start_date), 'HH:mm')}
                                        {event.end_date && ` - ${format(new Date(event.end_date), 'HH:mm')}`}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEventDialog(event)}
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteEvent(event.id)}
                                    >
                                      <Trash className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Cleaning Events */}
                        {dayData.cleaningEvents.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-medium text-sm text-muted-foreground">Equipment Cleaning</h4>
                            {dayData.cleaningEvents.map((event) => (
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
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground mb-3">
                          No events scheduled for this date
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openEventDialog(undefined, selectedDate)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Event
                        </Button>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Monthly Summary */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">This Month</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const monthData = getEventsForMonth();
                  const hasAnyEvents = monthData.cleaningEvents.length > 0 || monthData.events.length > 0;
                  
                  return hasAnyEvents ? (
                    <div className="space-y-4">
                      {/* Regular Events */}
                      {monthData.events.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm text-muted-foreground">Events</h4>
                          {monthData.events.slice(0, 5).map((event) => (
                            <div
                              key={event.id}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                            >
                              <span className="text-lg">
                                {eventTypeIcons[event.event_type as keyof typeof eventTypeIcons] || "📅"}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{event.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(event.start_date), 'MMM d, HH:mm')}
                                  {event.location && ` • ${event.location}`}
                                </div>
                              </div>
                            </div>
                          ))}
                          {monthData.events.length > 5 && (
                            <p className="text-sm text-muted-foreground text-center">
                              +{monthData.events.length - 5} more events
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Cleaning Events */}
                      {monthData.cleaningEvents.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm text-muted-foreground">Equipment Cleaning</h4>
                          {monthData.cleaningEvents.slice(0, 5).map((event) => (
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
                          {monthData.cleaningEvents.length > 5 && (
                            <p className="text-sm text-muted-foreground text-center">
                              +{monthData.cleaningEvents.length - 5} more cleaning tasks
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No events scheduled this month
                    </p>
                  );
                })()}
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
                    <span className="text-sm">Events This Month</span>
                    <span className="font-medium">{getEventsForMonth().events.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Cleaning This Month</span>
                    <span className="font-medium">{getEventsForMonth().cleaningEvents.length}</span>
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