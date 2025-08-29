import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Camera, Bell, Calendar, Clock, Filter, SortAsc, CheckCircle, Target, Music, User } from "lucide-react";
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

// Debug: Verify User icon is imported
console.log("User icon imported:", User);

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

interface CleaningEquipment {
  id: string;
  name: string;
  type: string;
  description?: string;
  photo_url?: string;
  icon?: string;
  quantity: number;
  purchase_date?: string;
  replacement_frequency_days?: number;
  next_replacement_due?: string;
  last_restocked_at?: string;
  cost_per_unit?: number;
  supplier?: string;
  notes?: string;
  show_on_profile: boolean;
  created_at: string;
  updated_at: string;
}

interface CleaningLog {
  id: string;
  equipment_id: string;
  cleaned_at: string;
  notes?: string;
  photo_url?: string;
  equipment?: { name: string; type: string };
}

const cleaningEquipmentIcons = {
  cloth: "🧽",
  brush: "🧹", 
  spray: "🧴",
  polish: "✨",
  oil: "💧",
  string_cleaner: "🎻",
  drum_cleaner: "🥁",
  case_cleaner: "🧳",
  disinfectant: "🦠",
  vacuum: "🌪️",
  microfiber: "🧽",
  solution: "🧪",
  other: "🧰"
};

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
  const [cleaningEquipment, setCleaningEquipment] = useState<CleaningEquipment[]>([]);
  const [cleaningLogs, setCleaningLogs] = useState<CleaningLog[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCleaningDialogOpen, setIsCleaningDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isAddCleaningEquipmentDialogOpen, setIsAddCleaningEquipmentDialogOpen] = useState(false);
  const [isEditCleaningEquipmentDialogOpen, setIsEditCleaningEquipmentDialogOpen] = useState(false);
  const [isCleaningEquipmentDetailDialogOpen, setIsCleaningEquipmentDetailDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [selectedCleaningEquipment, setSelectedCleaningEquipment] = useState<CleaningEquipment | null>(null);
  const [detailEquipment, setDetailEquipment] = useState<Equipment | null>(null);
  const [detailCleaningEquipment, setDetailCleaningEquipment] = useState<CleaningEquipment | null>(null);
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

  const [cleaningEquipmentFormData, setCleaningEquipmentFormData] = useState({
    name: "",
    type: "",
    description: "",
    quantity: 1,
    replacement_frequency_days: 90,
    cost_per_unit: 0,
    supplier: "",
    notes: "",
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
    fetchCleaningEquipment();
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

  const fetchCleaningEquipment = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('cleaning_equipment')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setCleaningEquipment(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch cleaning equipment",
        variant: "destructive",
      });
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

  const openDetailDialog = (item: Equipment) => {
    setDetailEquipment(item);
    setIsDetailDialogOpen(true);
  };

  const openCleaningEquipmentDetailDialog = (item: CleaningEquipment) => {
    setDetailCleaningEquipment(item);
    setIsCleaningEquipmentDetailDialogOpen(true);
  };

  const openEditCleaningEquipmentDialog = (item: CleaningEquipment) => {
    setSelectedCleaningEquipment(item);
    setCleaningEquipmentFormData({
      name: item.name,
      type: item.type,
      description: item.description || "",
      quantity: item.quantity,
      replacement_frequency_days: item.replacement_frequency_days || 90,
      cost_per_unit: item.cost_per_unit || 0,
      supplier: item.supplier || "",
      notes: item.notes || "",
      show_on_profile: item.show_on_profile,
      icon: item.icon || "other",
      photo_url: item.photo_url || ""
    });
    setIsEditCleaningEquipmentDialogOpen(true);
  };

  const handleCleaningEquipmentSubmit = async (e: React.FormEvent, action: 'add' | 'edit') => {
    e.preventDefault();
    setUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (action === 'add') {
        const { data, error } = await supabase
          .from('cleaning_equipment')
          .insert([{
            ...cleaningEquipmentFormData,
            user_id: user.id,
          }])
          .select()
          .single();

        if (error) throw error;

        setCleaningEquipment([...cleaningEquipment, data]);
        setIsAddCleaningEquipmentDialogOpen(false);
        toast({
          title: "Success",
          description: "Cleaning equipment added successfully!"
        });
      } else {
        if (!selectedCleaningEquipment) return;

        const { data, error } = await supabase
          .from('cleaning_equipment')
          .update(cleaningEquipmentFormData)
          .eq('id', selectedCleaningEquipment.id)
          .select()
          .single();

        if (error) throw error;

        setCleaningEquipment(cleaningEquipment.map(item => 
          item.id === selectedCleaningEquipment.id ? data : item
        ));
        setIsEditCleaningEquipmentDialogOpen(false);
        setSelectedCleaningEquipment(null);
        toast({
          title: "Success",
          description: "Cleaning equipment updated successfully!"
        });
      }

      resetCleaningEquipmentForm();
    } catch (error: any) {
      console.error('Error with cleaning equipment:', error);
      toast({
        title: "Error",
        description: `Failed to ${action} cleaning equipment`,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCleaningEquipment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('cleaning_equipment')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCleaningEquipment(cleaningEquipment.filter(item => item.id !== id));
      toast({
        title: "Success",
        description: "Cleaning equipment deleted successfully!"
      });
    } catch (error: any) {
      console.error('Error deleting cleaning equipment:', error);
      toast({
        title: "Error",
        description: "Failed to delete cleaning equipment",
        variant: "destructive"
      });
    }
  };

  const resetCleaningEquipmentForm = () => {
    setCleaningEquipmentFormData({
      name: "",
      type: "",
      description: "",
      quantity: 1,
      replacement_frequency_days: 90,
      cost_per_unit: 0,
      supplier: "",
      notes: "",
      show_on_profile: false,
      icon: "other",
      photo_url: ""
    });
    setSelectedFile(null);
  };

  const getDaysUntilReplacement = (dueDateString?: string) => {
    if (!dueDateString) return null;
    const now = new Date();
    const dueDate = new Date(dueDateString);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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
            <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Add New Equipment</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-4 p-1">
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
                  <div className="flex-shrink-0 pt-4 border-t">
                    <Button type="submit" className="w-full" disabled={uploading}>
                      {uploading ? "Adding..." : "Add Equipment"}
                    </Button>
                  </div>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="musical-equipment" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="musical-equipment">Musical Equipment</TabsTrigger>
            <TabsTrigger value="cleaning-equipment">Cleaning Equipment</TabsTrigger>
            <TabsTrigger value="schedule">Cleaning Schedule</TabsTrigger>
            <TabsTrigger value="history">Cleaning History</TabsTrigger>
          </TabsList>

          <TabsContent value="musical-equipment">
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
                    <CardContent className="space-y-3" onClick={() => openDetailDialog(item)}>
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
                          onClick={(e) => {
                            e.stopPropagation();
                            openCleaningDialog(item);
                          }}
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

          <TabsContent value="cleaning-equipment">
            {/* Cleaning Equipment Section */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Cleaning Equipment</h2>
              <Dialog open={isAddCleaningEquipmentDialogOpen} onOpenChange={setIsAddCleaningEquipmentDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Cleaning Equipment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
                  <DialogHeader className="flex-shrink-0">
                    <DialogTitle>Add New Cleaning Equipment</DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto">
                    <form onSubmit={(e) => handleCleaningEquipmentSubmit(e, 'add')} className="space-y-4 p-1">
                      <div>
                        <Label htmlFor="cleaning-name">Item Name</Label>
                        <Input
                          id="cleaning-name"
                          value={cleaningEquipmentFormData.name}
                          onChange={(e) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="cleaning-type">Type</Label>
                        <Select 
                          value={cleaningEquipmentFormData.type} 
                          onValueChange={(value) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select cleaning equipment type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cloth">Cleaning Cloth</SelectItem>
                            <SelectItem value="brush">Brush</SelectItem>
                            <SelectItem value="spray">Cleaning Spray</SelectItem>
                            <SelectItem value="polish">Polish</SelectItem>
                            <SelectItem value="oil">Oil</SelectItem>
                            <SelectItem value="string_cleaner">String Cleaner</SelectItem>
                            <SelectItem value="drum_cleaner">Drum Cleaner</SelectItem>
                            <SelectItem value="case_cleaner">Case Cleaner</SelectItem>
                            <SelectItem value="disinfectant">Disinfectant</SelectItem>
                            <SelectItem value="vacuum">Vacuum</SelectItem>
                            <SelectItem value="microfiber">Microfiber</SelectItem>
                            <SelectItem value="solution">Solution</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="cleaning-icon">Icon</Label>
                        <Select 
                          value={cleaningEquipmentFormData.icon} 
                          onValueChange={(value) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, icon: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(cleaningEquipmentIcons).map(([key, icon]) => (
                              <SelectItem key={key} value={key}>
                                <span className="flex items-center gap-2">
                                  <span>{icon}</span>
                                  <span className="capitalize">{key.replace('_', ' ')}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="cleaning-quantity">Quantity</Label>
                        <Input
                          id="cleaning-quantity"
                          type="number"
                          min="1"
                          value={cleaningEquipmentFormData.quantity}
                          onChange={(e) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, quantity: parseInt(e.target.value) })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="cleaning-description">Description/Notes</Label>
                        <Textarea
                          id="cleaning-description"
                          value={cleaningEquipmentFormData.description}
                          onChange={(e) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, description: e.target.value })}
                          placeholder="Usage instructions, special notes..."
                          className="min-h-[80px]"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cleaning-replacement">Replacement Frequency (days)</Label>
                        <Input
                          id="cleaning-replacement"
                          type="number"
                          min="1"
                          value={cleaningEquipmentFormData.replacement_frequency_days}
                          onChange={(e) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, replacement_frequency_days: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="cleaning-cost">Cost per Unit ($)</Label>
                        <Input
                          id="cleaning-cost"
                          type="number"
                          step="0.01"
                          min="0"
                          value={cleaningEquipmentFormData.cost_per_unit}
                          onChange={(e) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, cost_per_unit: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="cleaning-supplier">Supplier</Label>
                        <Input
                          id="cleaning-supplier"
                          value={cleaningEquipmentFormData.supplier}
                          onChange={(e) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, supplier: e.target.value })}
                          placeholder="Where to buy this item..."
                        />
                      </div>
                      <div className="flex-shrink-0 pt-4 border-t">
                        <Button type="submit" className="w-full" disabled={uploading}>
                          {uploading ? "Adding..." : "Add Cleaning Equipment"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Cleaning Equipment Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cleaningEquipment.map((item) => (
                <Card key={item.id} className="glass-card hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader 
                    className="pb-2"
                    onClick={() => openCleaningEquipmentDetailDialog(item)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 mb-4">
                        {item.photo_url ? (
                          <img 
                            src={item.photo_url} 
                            alt={item.name}
                            className="w-16 h-16 object-cover rounded-lg border"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center text-2xl">
                            {cleaningEquipmentIcons[item.type as keyof typeof cleaningEquipmentIcons] || item.icon || "🧰"}
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{item.name}</h3>
                          <p className="text-sm text-muted-foreground capitalize">{item.type.replace('_', ' ')}</p>
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditCleaningEquipmentDialog(item);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCleaningEquipment(item.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3" onClick={() => openCleaningEquipmentDetailDialog(item)}>
                    <div className="space-y-2">
                      {item.next_replacement_due && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Next replacement: </span>
                          <span className={getDaysUntilReplacement(item.next_replacement_due) !== null && getDaysUntilReplacement(item.next_replacement_due)! < 0 ? "text-red-500" : ""}>
                            {format(new Date(item.next_replacement_due), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      )}
                      {item.cost_per_unit && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Cost: </span>
                          <span>${item.cost_per_unit}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {item.show_on_profile && (
                        <Badge variant="secondary">
                          On Profile
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {cleaningEquipment.length === 0 && (
              <Card className="glass-card">
                <CardContent className="text-center py-12">
                  <div className="text-4xl mb-4">🧰</div>
                  <h3 className="text-lg font-medium mb-2">No cleaning equipment added yet</h3>
                  <p className="text-muted-foreground mb-4">Start by adding your first cleaning item</p>
                  <Button onClick={() => setIsAddCleaningEquipmentDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Cleaning Equipment
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
            <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Edit Equipment</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto">
                <form onSubmit={handleUpdate} className="space-y-4 p-1">
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
                  <div className="flex-shrink-0 pt-4 border-t">
                    <Button type="submit" className="w-full" disabled={uploading}>
                      {uploading ? "Updating..." : "Update Equipment"}
                    </Button>
                  </div>
                </form>
              </div>
            </DialogContent>
        </Dialog>

        {/* Log Cleaning Dialog */}
        <Dialog open={isCleaningDialogOpen} onOpenChange={setIsCleaningDialogOpen}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Log Cleaning - {selectedEquipment?.name}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto">
                <form onSubmit={handleLogCleaning} className="space-y-4 p-1">
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
                  <div className="flex-shrink-0 pt-4 border-t">
                    <Button type="submit" className="w-full">
                      Log Cleaning
                    </Button>
                  </div>
                </form>
              </div>
            </DialogContent>
        </Dialog>

        {/* Equipment Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-3">
                {detailEquipment?.photo_url ? (
                  <img 
                    src={detailEquipment.photo_url} 
                    alt={detailEquipment.name}
                    className="w-12 h-12 object-cover rounded-lg border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-xl">
                    {detailEquipment && equipmentIcons[detailEquipment.type as keyof typeof equipmentIcons] || detailEquipment?.icon || "🎵"}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold">{detailEquipment?.name}</h2>
                  <p className="text-sm text-muted-foreground capitalize">{detailEquipment?.type}</p>
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-6 p-1">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Equipment Type</Label>
                      <p className="capitalize">{detailEquipment?.type}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Cleaning Frequency</Label>
                      <p>Every {detailEquipment?.cleaning_frequency_days} days</p>
                    </div>
                  </div>
                  
                  {detailEquipment?.description && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Cleaning Requirements</Label>
                      <p className="text-sm mt-1">{detailEquipment.description}</p>
                    </div>
                  )}
                </div>

                {/* Cleaning Schedule */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Cleaning Schedule</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {detailEquipment?.last_cleaned_at && (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <Label className="text-sm font-medium text-muted-foreground">Last Cleaned</Label>
                        <p className="text-lg font-medium">{format(new Date(detailEquipment.last_cleaned_at), 'EEEE, MMMM d, yyyy')}</p>
                        <p className="text-sm text-muted-foreground">{format(new Date(detailEquipment.last_cleaned_at), 'h:mm a')}</p>
                      </div>
                    )}
                    
                    {detailEquipment?.next_cleaning_due && (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <Label className="text-sm font-medium text-muted-foreground">Next Cleaning Due</Label>
                        <p className="text-lg font-medium">{format(new Date(detailEquipment.next_cleaning_due), 'EEEE, MMMM d, yyyy')}</p>
                        {(() => {
                          const daysUntilDue = getDaysUntilDue(detailEquipment.next_cleaning_due);
                          return daysUntilDue !== null && (
                            <p className={`text-sm ${daysUntilDue < 0 ? 'text-red-500' : daysUntilDue === 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                              {daysUntilDue > 0 ? `Due in ${daysUntilDue} days` : 
                               daysUntilDue === 0 ? 'Due today' : 
                               `${Math.abs(daysUntilDue)} days overdue`}
                            </p>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cleaning Statistics */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Statistics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-primary">🔥</div>
                      <p className="text-lg font-medium">{detailEquipment ? getCleaningStreak(detailEquipment.id) : 0}</p>
                      <p className="text-sm text-muted-foreground">Cleaning Streak</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-primary">📅</div>
                      <p className="text-lg font-medium">{detailEquipment?.cleaning_frequency_days || 0}</p>
                      <p className="text-sm text-muted-foreground">Day Frequency</p>
                    </div>
                  </div>
                </div>

                {/* Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Settings</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        <span>Notifications</span>
                      </div>
                      <Badge variant={detailEquipment?.notifications_enabled ? "default" : "secondary"}>
                        {detailEquipment?.notifications_enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>Show on Profile</span>
                    </div>
                    <Badge variant={detailEquipment?.show_on_profile ? "default" : "secondary"}>
                      {detailEquipment?.show_on_profile ? "Visible" : "Hidden"}
                    </Badge>
                  </div>
                  </div>
                </div>

                {/* Recent Cleaning History */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Recent Cleaning History</h3>
                  <div className="space-y-2">
                    {cleaningLogs
                      .filter(log => log.equipment_id === detailEquipment?.id)
                      .slice(0, 5)
                      .map((log) => (
                        <div key={log.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{format(new Date(log.cleaned_at), 'MMM dd, yyyy')}</p>
                            {log.notes && <p className="text-sm text-muted-foreground">{log.notes}</p>}
                          </div>
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        </div>
                      ))}
                    {cleaningLogs.filter(log => log.equipment_id === detailEquipment?.id).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No cleaning history yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 pt-4 border-t">
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    if (detailEquipment) {
                      setIsDetailDialogOpen(false);
                      openEditDialog(detailEquipment);
                    }
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Equipment
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => {
                    if (detailEquipment) {
                      setIsDetailDialogOpen(false);
                      openCleaningDialog(detailEquipment);
                    }
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Log Cleaning
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Cleaning Equipment Dialog */}
        <Dialog open={isEditCleaningEquipmentDialogOpen} onOpenChange={setIsEditCleaningEquipmentDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Edit Cleaning Equipment</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              <form onSubmit={(e) => handleCleaningEquipmentSubmit(e, 'edit')} className="space-y-4 p-1">
                <div>
                  <Label htmlFor="edit-cleaning-name">Item Name</Label>
                  <Input
                    id="edit-cleaning-name"
                    value={cleaningEquipmentFormData.name}
                    onChange={(e) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-cleaning-type">Type</Label>
                  <Select 
                    value={cleaningEquipmentFormData.type} 
                    onValueChange={(value) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select cleaning equipment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cloth">Cleaning Cloth</SelectItem>
                      <SelectItem value="brush">Brush</SelectItem>
                      <SelectItem value="spray">Cleaning Spray</SelectItem>
                      <SelectItem value="polish">Polish</SelectItem>
                      <SelectItem value="oil">Oil</SelectItem>
                      <SelectItem value="string_cleaner">String Cleaner</SelectItem>
                      <SelectItem value="drum_cleaner">Drum Cleaner</SelectItem>
                      <SelectItem value="case_cleaner">Case Cleaner</SelectItem>
                      <SelectItem value="disinfectant">Disinfectant</SelectItem>
                      <SelectItem value="vacuum">Vacuum</SelectItem>
                      <SelectItem value="microfiber">Microfiber</SelectItem>
                      <SelectItem value="solution">Solution</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-cleaning-icon">Icon</Label>
                  <Select 
                    value={cleaningEquipmentFormData.icon} 
                    onValueChange={(value) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, icon: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(cleaningEquipmentIcons).map(([key, icon]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">
                            <span>{icon}</span>
                            <span className="capitalize">{key.replace('_', ' ')}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-cleaning-quantity">Quantity</Label>
                  <Input
                    id="edit-cleaning-quantity"
                    type="number"
                    min="1"
                    value={cleaningEquipmentFormData.quantity}
                    onChange={(e) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, quantity: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-cleaning-description">Description/Notes</Label>
                  <Textarea
                    id="edit-cleaning-description"
                    value={cleaningEquipmentFormData.description}
                    onChange={(e) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, description: e.target.value })}
                    placeholder="Usage instructions, special notes..."
                    className="min-h-[80px]"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-cleaning-replacement">Replacement Frequency (days)</Label>
                  <Input
                    id="edit-cleaning-replacement"
                    type="number"
                    min="1"
                    value={cleaningEquipmentFormData.replacement_frequency_days}
                    onChange={(e) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, replacement_frequency_days: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-cleaning-cost">Cost per Unit ($)</Label>
                  <Input
                    id="edit-cleaning-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={cleaningEquipmentFormData.cost_per_unit}
                    onChange={(e) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, cost_per_unit: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-cleaning-supplier">Supplier</Label>
                  <Input
                    id="edit-cleaning-supplier"
                    value={cleaningEquipmentFormData.supplier}
                    onChange={(e) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, supplier: e.target.value })}
                    placeholder="Where to buy this item..."
                  />
                </div>
                <div className="flex-shrink-0 pt-4 border-t">
                  <Button type="submit" className="w-full" disabled={uploading}>
                    {uploading ? "Updating..." : "Update Cleaning Equipment"}
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cleaning Equipment Detail Dialog */}
        <Dialog open={isCleaningEquipmentDetailDialogOpen} onOpenChange={setIsCleaningEquipmentDetailDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-3">
                {detailCleaningEquipment?.photo_url ? (
                  <img 
                    src={detailCleaningEquipment.photo_url} 
                    alt={detailCleaningEquipment.name}
                    className="w-12 h-12 object-cover rounded-lg border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-xl">
                    {detailCleaningEquipment && cleaningEquipmentIcons[detailCleaningEquipment.type as keyof typeof cleaningEquipmentIcons] || detailCleaningEquipment?.icon || "🧰"}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold">{detailCleaningEquipment?.name}</h2>
                  <p className="text-sm text-muted-foreground capitalize">{detailCleaningEquipment?.type?.replace('_', ' ')}</p>
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-6 p-1">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Item Type</Label>
                      <p className="capitalize">{detailCleaningEquipment?.type?.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Quantity</Label>
                      <p>{detailCleaningEquipment?.quantity}</p>
                    </div>
                  </div>
                  
                  {detailCleaningEquipment?.description && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                      <p className="text-sm mt-1">{detailCleaningEquipment.description}</p>
                    </div>
                  )}
                </div>

                {/* Replacement Schedule */}
                {detailCleaningEquipment?.replacement_frequency_days && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Replacement Schedule</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <Label className="text-sm font-medium text-muted-foreground">Replacement Frequency</Label>
                        <p className="text-lg font-medium">Every {detailCleaningEquipment.replacement_frequency_days} days</p>
                      </div>
                      
                      {detailCleaningEquipment?.next_replacement_due && (
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <Label className="text-sm font-medium text-muted-foreground">Next Replacement Due</Label>
                          <p className="text-lg font-medium">{format(new Date(detailCleaningEquipment.next_replacement_due), 'EEEE, MMMM d, yyyy')}</p>
                          {(() => {
                            const daysUntilDue = getDaysUntilReplacement(detailCleaningEquipment.next_replacement_due);
                            return daysUntilDue !== null && (
                              <p className={`text-sm ${daysUntilDue < 0 ? 'text-red-500' : daysUntilDue === 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                                {daysUntilDue > 0 ? `Due in ${daysUntilDue} days` : 
                                 daysUntilDue === 0 ? 'Due today' : 
                                 `${Math.abs(daysUntilDue)} days overdue`}
                              </p>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Cost & Supplier */}
                {(detailCleaningEquipment?.cost_per_unit || detailCleaningEquipment?.supplier) && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Purchase Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {detailCleaningEquipment?.cost_per_unit && (
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Cost per Unit</Label>
                          <p>${detailCleaningEquipment.cost_per_unit}</p>
                        </div>
                      )}
                      {detailCleaningEquipment?.supplier && (
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Supplier</Label>
                          <p>{detailCleaningEquipment.supplier}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {detailCleaningEquipment?.notes && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Notes</h3>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm">{detailCleaningEquipment.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 pt-4 border-t">
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    if (detailCleaningEquipment) {
                      setIsCleaningEquipmentDetailDialogOpen(false);
                      openEditCleaningEquipmentDialog(detailCleaningEquipment);
                    }
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Item
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Equipment;