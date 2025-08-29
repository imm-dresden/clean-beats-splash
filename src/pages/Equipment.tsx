import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Camera, Bell, Calendar, Clock, Filter, SortAsc, CheckCircle, Target, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { notificationService } from "@/services/notificationService";

interface Equipment {
  id: string;
  name: string;
  type: string;
  description?: string;
  cleaning_frequency_days: number;
  notifications_enabled: boolean;
  show_on_profile: boolean;
  photo_url?: string;
  icon?: string;
  last_cleaned_at?: string;
  next_cleaning_due?: string;
  created_at: string;
}

interface CleaningLog {
  id: string;
  equipment_id: string;
  cleaned_at: string;
  notes?: string;
  photo_url?: string;
  equipment?: { name: string; type: string };
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

const Equipment = () => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [cleaningLogs, setCleaningLogs] = useState<CleaningLog[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCleaningDialogOpen, setIsCleaningDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    type: "",
    description: "",
    cleaning_frequency_days: 30,
    notifications_enabled: true,
    show_on_profile: false,
    icon: "other",
    photo_url: ""
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [cleaningFormData, setCleaningFormData] = useState({
    notes: "",
    cleaned_at: new Date().toISOString().slice(0, 16)
  });

  useEffect(() => {
    fetchEquipment();
    fetchCleaningLogs();
    initializeNotifications();
  }, []);

  const initializeNotifications = async () => {
    const hasPermission = await notificationService.requestPermissions();
    if (!hasPermission) {
      toast({
        title: "Notification permissions denied",
        description: "You won't receive cleaning reminders.",
        variant: "destructive"
      });
    }
  };

  const uploadFile = async (file: File, equipmentId: string): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${equipmentId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('equipment-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('equipment-photos')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload image",
        variant: "destructive"
      });
      return null;
    }
  };

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
          equipment:equipment_id (name, type)
        `)
        .eq('user_id', user.id)
        .order('cleaned_at', { ascending: false });

      if (error) throw error;
      setCleaningLogs(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch cleaning logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First insert the equipment to get the ID
      const { data: newEquipment, error: insertError } = await supabase
        .from('equipment')
        .insert([{
          name: formData.name,
          type: formData.type,
          description: formData.description,
          cleaning_frequency_days: parseInt(formData.cleaning_frequency_days.toString()),
          notifications_enabled: formData.notifications_enabled,
          show_on_profile: formData.show_on_profile,
          icon: formData.icon,
          user_id: user.id,
          photo_url: formData.photo_url // Use URL if provided
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      let finalPhotoUrl = formData.photo_url;

      // Upload file if selected
      if (selectedFile && newEquipment) {
        const uploadedUrl = await uploadFile(selectedFile, newEquipment.id);
        if (uploadedUrl) {
          finalPhotoUrl = uploadedUrl;
          // Update equipment with uploaded photo URL
          const { error: updateError } = await supabase
            .from('equipment')
            .update({ photo_url: uploadedUrl })
            .eq('id', newEquipment.id);

          if (updateError) throw updateError;
          newEquipment.photo_url = uploadedUrl;
        }
      }

      // Schedule notification for new equipment
      if (newEquipment.notifications_enabled && newEquipment.next_cleaning_due) {
        await notificationService.scheduleCleaningNotification({
          equipmentId: newEquipment.id,
          equipmentName: newEquipment.name,
          nextCleaningDue: newEquipment.next_cleaning_due
        });
      }

      setEquipment([...equipment, newEquipment]);
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Equipment added successfully!"
      });
    } catch (error: any) {
      console.error('Error adding equipment:', error);
      toast({
        title: "Error",
        description: "Failed to add equipment",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment) return;
    setUploading(true);

    try {
      let finalPhotoUrl = formData.photo_url;

      // Upload new file if selected
      if (selectedFile) {
        const uploadedUrl = await uploadFile(selectedFile, selectedEquipment.id);
        if (uploadedUrl) {
          finalPhotoUrl = uploadedUrl;
        }
      }

      const { data, error } = await supabase
        .from('equipment')
        .update({
          ...formData,
          photo_url: finalPhotoUrl,
          cleaning_frequency_days: parseInt(formData.cleaning_frequency_days.toString())
        })
        .eq('id', selectedEquipment.id)
        .select()
        .single();

      if (error) throw error;

      // Cancel old notification and schedule new one if needed
      await notificationService.cancelNotification(selectedEquipment.id);
      if (data.notifications_enabled && data.next_cleaning_due) {
        await notificationService.scheduleCleaningNotification({
          equipmentId: data.id,
          equipmentName: data.name,
          nextCleaningDue: data.next_cleaning_due
        });
      }

      setEquipment(equipment.map(item => 
        item.id === selectedEquipment.id ? data : item
      ));
      setIsEditDialogOpen(false);
      setSelectedEquipment(null);
      resetForm();
      toast({
        title: "Success",
        description: "Equipment updated successfully!"
      });
    } catch (error: any) {
      console.error('Error updating equipment:', error);
      toast({
        title: "Error", 
        description: "Failed to update equipment",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Equipment deleted successfully",
      });

      fetchEquipment();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete equipment",
        variant: "destructive",
      });
    }
  };

  const handleLogCleaning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if equipment was already cleaned today
      const today = new Date().toISOString().split('T')[0];
      const { data: existingLogs, error: checkError } = await supabase
        .from('cleaning_logs')
        .select('id')
        .eq('equipment_id', selectedEquipment.id)
        .eq('user_id', user.id)
        .gte('cleaned_at', today + 'T00:00:00.000Z')
        .lt('cleaned_at', today + 'T23:59:59.999Z');

      if (checkError) throw checkError;

      if (existingLogs && existingLogs.length > 0) {
        toast({
          title: "Already Cleaned Today",
          description: "This equipment has already been cleaned today. Only one cleaning per day is allowed.",
          variant: "destructive"
        });
        return;
      }

      const cleanedAt = new Date(cleaningFormData.cleaned_at).toISOString();
      const nextDue = new Date(cleanedAt);
      nextDue.setDate(nextDue.getDate() + selectedEquipment.cleaning_frequency_days);

      const { error } = await supabase
        .from('cleaning_logs')
        .insert([{
          equipment_id: selectedEquipment.id,
          user_id: user.id,
          cleaned_at: cleanedAt,
          notes: cleaningFormData.notes,
        }]);

      if (error) throw error;

      // Update the equipment with new cleaning date
      const updatedEquipment = equipment.map(item => 
        item.id === selectedEquipment.id 
          ? { ...item, last_cleaned_at: cleanedAt, next_cleaning_due: nextDue.toISOString() }
          : item
      );
      setEquipment(updatedEquipment);

      // Schedule new notification if notifications are enabled
      const updatedItem = updatedEquipment.find(item => item.id === selectedEquipment.id);
      if (updatedItem?.notifications_enabled && nextDue) {
        await notificationService.scheduleCleaningNotification({
          equipmentId: updatedItem.id,
          equipmentName: updatedItem.name,
          nextCleaningDue: nextDue.toISOString()
        });
      }
      
      // Refresh cleaning logs
      fetchCleaningLogs();
      
      setIsCleaningDialogOpen(false);
      setSelectedEquipment(null);
      setCleaningFormData({ notes: "", cleaned_at: new Date().toISOString().slice(0, 16) });
      toast({
        title: "Success",
        description: "Cleaning logged successfully!"
      });
    } catch (error: any) {
      console.error('Error logging cleaning:', error);
      toast({
        title: "Error",
        description: "Failed to log cleaning",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "",
      description: "",
      cleaning_frequency_days: 30,
      notifications_enabled: true,
      show_on_profile: false,
      icon: "other",
      photo_url: ""
    });
    setSelectedFile(null);
    setSelectedEquipment(null);
  };

  const openEditDialog = (item: Equipment) => {
    setSelectedEquipment(item);
    setFormData({
      name: item.name,
      type: item.type,
      description: item.description || "",
      cleaning_frequency_days: item.cleaning_frequency_days,
      notifications_enabled: item.notifications_enabled,
      show_on_profile: item.show_on_profile,
      icon: item.icon || "other",
      photo_url: item.photo_url || ""
    });
    setSelectedFile(null);
    setIsEditDialogOpen(true);
  };

  const openCleaningDialog = (item: Equipment) => {
    setSelectedEquipment(item);
    setIsCleaningDialogOpen(true);
  };

  const getFilteredAndSortedEquipment = () => {
    let filtered = equipment;
    
    if (filterType !== "all") {
      filtered = equipment.filter(item => item.type === filterType);
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "next_cleaning":
          return new Date(a.next_cleaning_due || 0).getTime() - new Date(b.next_cleaning_due || 0).getTime();
        case "last_cleaned":
          return new Date(b.last_cleaned_at || 0).getTime() - new Date(a.last_cleaned_at || 0).getTime();
        default:
          return 0;
      }
    });
  };

  const getUpcomingCleanings = () => {
    const now = new Date();
    const upcoming = equipment
      .filter(item => item.next_cleaning_due)
      .sort((a, b) => new Date(a.next_cleaning_due!).getTime() - new Date(b.next_cleaning_due!).getTime())
      .slice(0, 5);
    
    return upcoming;
  };

  const getCleaningStreak = (equipmentId: string) => {
    const logs = cleaningLogs
      .filter(log => log.equipment_id === equipmentId)
      .sort((a, b) => new Date(b.cleaned_at).getTime() - new Date(a.cleaned_at).getTime());
    
    if (logs.length === 0) return 0;

    let streak = 1;
    const equipment_item = equipment.find(e => e.id === equipmentId);
    const frequency = equipment_item?.cleaning_frequency_days || 30;

    for (let i = 0; i < logs.length - 1; i++) {
      const current = new Date(logs[i].cleaned_at);
      const previous = new Date(logs[i + 1].cleaned_at);
      const daysBetween = Math.abs(current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysBetween <= frequency + 3) { // Allow 3 days grace period
        streak++;
      } else {
        break;
      }
    }

    return streak;
  };

  const getDaysUntilDue = (dueDateString?: string) => {
    if (!dueDateString) return null;
    const now = new Date();
    const dueDate = new Date(dueDateString);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground gradient-hero flex items-center justify-center">
        <div className="text-xl">Loading equipment...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground gradient-hero p-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Music className="w-8 h-8 text-accent" />
            <h1 className="text-3xl font-bold">Equipment Management</h1>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Equipment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Equipment</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Equipment Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select equipment type" />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start">
                      <SelectItem value="guitar">Guitar</SelectItem>
                      <SelectItem value="drums">Drums</SelectItem>
                      <SelectItem value="microphone">Microphone</SelectItem>
                      <SelectItem value="speaker">Speaker</SelectItem>
                      <SelectItem value="keyboard">Keyboard</SelectItem>
                      <SelectItem value="violin">Violin</SelectItem>
                      <SelectItem value="trumpet">Trumpet</SelectItem>
                      <SelectItem value="saxophone">Saxophone</SelectItem>
                      <SelectItem value="amplifier">Amplifier</SelectItem>
                      <SelectItem value="mixer">Mixer</SelectItem>
                      <SelectItem value="headphones">Headphones</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="icon">Icon</Label>
                  <Select value={formData.icon} onValueChange={(value) => setFormData({ ...formData, icon: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start">
                      {Object.entries(equipmentIcons).map(([key, icon]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">
                            <span>{icon}</span>
                            <span className="capitalize">{key}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Cleaning Requirements</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Special cleaning instructions or requirements..."
                    className="min-h-[80px]"
                  />
                </div>
                <div>
                  <Label htmlFor="photo">Equipment Photo</Label>
                  <div className="space-y-3">
                    <Input
                      id="photo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="cursor-pointer"
                    />
                    <div className="text-sm text-muted-foreground">
                      Or provide a URL:
                    </div>
                    <Input
                      type="url"
                      value={formData.photo_url}
                      onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                      placeholder="https://example.com/photo.jpg"
                    />
                    {(selectedFile || formData.photo_url) && (
                      <div className="text-sm text-muted-foreground">
                        {selectedFile ? `Selected: ${selectedFile.name}` : `URL: ${formData.photo_url}`}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="frequency">Cleaning Frequency (days)</Label>
                  <Input
                    id="frequency"
                    type="number"
                    min="1"
                    value={formData.cleaning_frequency_days}
                    onChange={(e) => setFormData({ ...formData, cleaning_frequency_days: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="notifications"
                    checked={formData.notifications_enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, notifications_enabled: checked })}
                  />
                  <Label htmlFor="notifications">Enable notifications</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="profile"
                    checked={formData.show_on_profile}
                    onCheckedChange={(checked) => setFormData({ ...formData, show_on_profile: checked })}
                  />
                  <Label htmlFor="profile">Show on profile</Label>
                </div>
                <Button type="submit" className="w-full" disabled={uploading}>
                  {uploading ? "Adding..." : "Add Equipment"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="equipment" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="equipment">My Equipment</TabsTrigger>
            <TabsTrigger value="schedule">Cleaning Schedule</TabsTrigger>
            <TabsTrigger value="history">Cleaning History</TabsTrigger>
          </TabsList>

          <TabsContent value="equipment">
            {/* Filters and Sort */}
            <div className="flex gap-4 mb-6">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="guitar">Guitar</SelectItem>
                  <SelectItem value="drums">Drums</SelectItem>
                  <SelectItem value="microphone">Microphone</SelectItem>
                  <SelectItem value="speaker">Speaker</SelectItem>
                  <SelectItem value="keyboard">Keyboard</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="next_cleaning">Next Cleaning</SelectItem>
                  <SelectItem value="last_cleaned">Last Cleaned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Equipment Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getFilteredAndSortedEquipment().map((item) => {
                const daysUntilDue = getDaysUntilDue(item.next_cleaning_due);
                const streak = getCleaningStreak(item.id);
                
                return (
                  <Card key={item.id} className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {item.photo_url ? (
                            <img 
                              src={item.photo_url} 
                              alt={item.name}
                              className="w-12 h-12 rounded-lg object-cover border border-border/50"
                            />
                          ) : (
                            <span className="text-2xl">{equipmentIcons[item.icon as keyof typeof equipmentIcons] || equipmentIcons.other}</span>
                          )}
                          <div>
                            <CardTitle className="text-lg">{item.name}</CardTitle>
                            <p className="text-sm text-muted-foreground capitalize">{item.type}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(item)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        {item.last_cleaned_at && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Last cleaned: </span>
                            <span>{format(new Date(item.last_cleaned_at), 'MMM dd, yyyy')}</span>
                          </div>
                        )}
                        {item.next_cleaning_due && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Next cleaning: </span>
                            <span className={daysUntilDue !== null && daysUntilDue < 0 ? "text-red-500" : ""}>
                              {format(new Date(item.next_cleaning_due), 'MMM dd, yyyy')}
                              {daysUntilDue !== null && (
                                <span className="ml-1">
                                  ({daysUntilDue > 0 ? `in ${daysUntilDue} days` : 
                                    daysUntilDue === 0 ? 'today' : 
                                    `${Math.abs(daysUntilDue)} days overdue`})
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🔥</span>
                          <span className="text-sm">Cleaning streak: {streak}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => openCleaningDialog(item)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Log Cleaning
                        </Button>
                      </div>
                      
                      <div className="flex gap-2">
                        {item.notifications_enabled && (
                          <Badge variant="secondary">
                            <Bell className="w-3 h-3 mr-1" />
                            Notifications
                          </Badge>
                        )}
                        {item.show_on_profile && (
                          <Badge variant="secondary">
                            On Profile
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {equipment.length === 0 && (
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardContent className="text-center py-12">
                  <Music className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No equipment added yet</h3>
                  <p className="text-muted-foreground mb-4">Start by adding your first piece of equipment</p>
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Equipment
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="schedule">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle>Upcoming Cleaning Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {getUpcomingCleanings().map((item) => {
                    const daysUntilDue = getDaysUntilDue(item.next_cleaning_due);
                    
                    return (
                      <div key={item.id} className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background/30">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{equipmentIcons[item.icon as keyof typeof equipmentIcons] || equipmentIcons.other}</span>
                          <div>
                            <h3 className="font-medium">{item.name}</h3>
                            <p className="text-sm text-muted-foreground capitalize">{item.type}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {item.next_cleaning_due && format(new Date(item.next_cleaning_due), 'MMM dd, yyyy')}
                          </div>
                          {daysUntilDue !== null && (
                            <div className={`text-sm ${daysUntilDue < 0 ? 'text-red-500' : daysUntilDue === 0 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                              {daysUntilDue > 0 ? `in ${daysUntilDue} days` : 
                               daysUntilDue === 0 ? 'Due today' : 
                               `${Math.abs(daysUntilDue)} days overdue`}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {getUpcomingCleanings().length === 0 && (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No upcoming cleanings scheduled</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle>Cleaning History & Streaks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cleaningLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background/30">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <div>
                          <h3 className="font-medium">{log.equipment?.name}</h3>
                          <p className="text-sm text-muted-foreground capitalize">{log.equipment?.type}</p>
                          {log.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{log.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {format(new Date(log.cleaned_at), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(log.cleaned_at), 'h:mm a')}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {cleaningLogs.length === 0 && (
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No cleaning history yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Equipment Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Equipment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Equipment Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-type">Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select equipment type" />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start">
                    <SelectItem value="guitar">Guitar</SelectItem>
                    <SelectItem value="drums">Drums</SelectItem>
                    <SelectItem value="microphone">Microphone</SelectItem>
                    <SelectItem value="speaker">Speaker</SelectItem>
                    <SelectItem value="keyboard">Keyboard</SelectItem>
                    <SelectItem value="violin">Violin</SelectItem>
                    <SelectItem value="trumpet">Trumpet</SelectItem>
                    <SelectItem value="saxophone">Saxophone</SelectItem>
                    <SelectItem value="amplifier">Amplifier</SelectItem>
                    <SelectItem value="mixer">Mixer</SelectItem>
                    <SelectItem value="headphones">Headphones</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-icon">Icon</Label>
                <Select value={formData.icon} onValueChange={(value) => setFormData({ ...formData, icon: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start">
                    {Object.entries(equipmentIcons).map(([key, icon]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span>{icon}</span>
                          <span className="capitalize">{key}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-description">Cleaning Requirements</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Special cleaning instructions or requirements..."
                  className="min-h-[80px]"
                />
              </div>
                  <div>
                    <Label htmlFor="edit-photo">Equipment Photo</Label>
                    <div className="space-y-3">
                      <Input
                        id="edit-photo"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="cursor-pointer"
                      />
                      <div className="text-sm text-muted-foreground">
                        Or provide a URL:
                      </div>
                      <Input
                        type="url"
                        value={formData.photo_url}
                        onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                        placeholder="https://example.com/photo.jpg"
                      />
                      {(selectedFile || formData.photo_url) && (
                        <div className="text-sm text-muted-foreground">
                          {selectedFile ? `Selected: ${selectedFile.name}` : `Current: ${formData.photo_url}`}
                        </div>
                      )}
                    </div>
                  </div>
              <div>
                <Label htmlFor="edit-frequency">Cleaning Frequency (days)</Label>
                <Input
                  id="edit-frequency"
                  type="number"
                  min="1"
                  value={formData.cleaning_frequency_days}
                  onChange={(e) => setFormData({ ...formData, cleaning_frequency_days: parseInt(e.target.value) })}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-notifications"
                  checked={formData.notifications_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, notifications_enabled: checked })}
                />
                <Label htmlFor="edit-notifications">Enable notifications</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-profile"
                  checked={formData.show_on_profile}
                  onCheckedChange={(checked) => setFormData({ ...formData, show_on_profile: checked })}
                />
                <Label htmlFor="edit-profile">Show on profile</Label>
              </div>
                  <Button type="submit" className="w-full" disabled={uploading}>
                    {uploading ? "Updating..." : "Update Equipment"}
                  </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Log Cleaning Dialog */}
        <Dialog open={isCleaningDialogOpen} onOpenChange={setIsCleaningDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Log Cleaning - {selectedEquipment?.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleLogCleaning} className="space-y-4">
              <div>
                <Label htmlFor="cleaned-at">Cleaned At</Label>
                <Input
                  id="cleaned-at"
                  type="datetime-local"
                  value={cleaningFormData.cleaned_at}
                  onChange={(e) => setCleaningFormData({ ...cleaningFormData, cleaned_at: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={cleaningFormData.notes}
                  onChange={(e) => setCleaningFormData({ ...cleaningFormData, notes: e.target.value })}
                  placeholder="Add any notes about the cleaning..."
                />
              </div>
              <Button type="submit" className="w-full">Log Cleaning</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Equipment;