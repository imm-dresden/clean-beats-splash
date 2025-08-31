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
  const [activeTab, setActiveTab] = useState<string>("musical-equipment");
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
    try {
      await notificationService.initializePushNotifications();
    } catch (error) {
      console.error('Error initializing notifications:', error);
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

  // Smart add function that opens the right dialog based on active tab
  const handleSmartAdd = () => {
    if (activeTab === "musical-equipment") {
      setIsAddDialogOpen(true);
    } else if (activeTab === "cleaning-equipment") {
      setIsAddCleaningEquipmentDialogOpen(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: newEquipment, error } = await supabase
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
          photo_url: formData.photo_url
        }])
        .select()
        .single();

      if (error) throw error;

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

  const handleCleaningEquipmentSubmit = async (e: React.FormEvent, action: "add" | "edit") => {
    e.preventDefault();
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (action === "add") {
        const { data, error } = await supabase
          .from('cleaning_equipment')
          .insert([{
            ...cleaningEquipmentFormData,
            user_id: user.id
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground gradient-hero flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading equipment...</p>
        </div>
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
          <Button onClick={handleSmartAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            {activeTab === "musical-equipment" ? "Add Equipment" : "Add Cleaning Equipment"}
          </Button>
        </div>

        {/* Musical Equipment Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                  <SelectContent>
                    <SelectItem value="guitar">Guitar</SelectItem>
                    <SelectItem value="drums">Drums</SelectItem>
                    <SelectItem value="microphone">Microphone</SelectItem>
                    <SelectItem value="speaker">Speaker</SelectItem>
                    <SelectItem value="keyboard">Keyboard</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your equipment..."
                />
              </div>
              <div>
                <Label htmlFor="frequency">Cleaning Frequency (Days)</Label>
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

        {/* Cleaning Equipment Dialog */}
        <Dialog open={isAddCleaningEquipmentDialogOpen} onOpenChange={setIsAddCleaningEquipmentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Cleaning Equipment</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => handleCleaningEquipmentSubmit(e, "add")} className="space-y-4">
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
                <Select value={cleaningEquipmentFormData.type} onValueChange={(value) => setCleaningEquipmentFormData({ ...cleaningEquipmentFormData, type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cloth">Cleaning Cloth</SelectItem>
                    <SelectItem value="brush">Brush</SelectItem>
                    <SelectItem value="spray">Cleaning Spray</SelectItem>
                    <SelectItem value="polish">Polish</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
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
              <Button type="submit" className="w-full" disabled={uploading}>
                {uploading ? "Adding..." : "Add Cleaning Equipment"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Tabs defaultValue="musical-equipment" onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 h-auto p-1">
            <TabsTrigger 
              value="musical-equipment" 
              className="text-xs sm:text-sm px-2 py-2 whitespace-nowrap"
            >
              Musical
            </TabsTrigger>
            <TabsTrigger 
              value="cleaning-equipment" 
              className="text-xs sm:text-sm px-2 py-2 whitespace-nowrap"
            >
              Cleaning
            </TabsTrigger>
            <TabsTrigger 
              value="schedule" 
              className="text-xs sm:text-sm px-2 py-2 whitespace-nowrap"
            >
              Schedule
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="text-xs sm:text-sm px-2 py-2 whitespace-nowrap"
            >
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="musical-equipment">
            {equipment.length === 0 ? (
              <Card className="glass-card">
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
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {equipment.map((item) => (
                  <Card key={item.id} className="glass-card hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{item.name}</span>
                        <Badge variant="outline">{item.type}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">{item.description}</p>
                      <div className="space-y-2">
                        <p className="text-sm">
                          <span className="font-medium">Frequency:</span> Every {item.cleaning_frequency_days} days
                        </p>
                        {item.last_cleaned_at && (
                          <p className="text-sm">
                            <span className="font-medium">Last cleaned:</span> {format(new Date(item.last_cleaned_at), 'MMM d, yyyy')}
                          </p>
                        )}
                        {item.next_cleaning_due && (
                          <p className="text-sm">
                            <span className="font-medium">Next due:</span> {format(new Date(item.next_cleaning_due), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="cleaning-equipment">
            {cleaningEquipment.length === 0 ? (
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
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cleaningEquipment.map((item) => (
                  <Card key={item.id} className="glass-card hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{item.name}</span>
                        <Badge variant="outline">{item.type}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">{item.description}</p>
                      <div className="space-y-2">
                        <p className="text-sm">
                          <span className="font-medium">Quantity:</span> {item.quantity}
                        </p>
                        {item.cost_per_unit && (
                          <p className="text-sm">
                            <span className="font-medium">Cost:</span> ${item.cost_per_unit}
                          </p>
                        )}
                        {item.supplier && (
                          <p className="text-sm">
                            <span className="font-medium">Supplier:</span> {item.supplier}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="schedule">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Cleaning Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Schedule view coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Cleaning History</CardTitle>
              </CardHeader>
              <CardContent>
                {cleaningLogs.length === 0 ? (
                  <p className="text-muted-foreground">No cleaning logs yet</p>
                ) : (
                  <div className="space-y-4">
                    {cleaningLogs.map((log) => (
                      <div key={log.id} className="border-l-2 border-accent pl-4 py-2">
                        <p className="font-medium">{log.equipment?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Cleaned on {format(new Date(log.cleaned_at), 'MMM d, yyyy h:mm a')}
                        </p>
                        {log.notes && (
                          <p className="text-sm mt-1">{log.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Equipment;