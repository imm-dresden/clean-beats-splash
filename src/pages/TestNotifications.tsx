import { TestNotifications } from '@/components/TestNotifications';
import { FCMDiagnostics } from '@/components/FCMDiagnostics';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function TestNotificationsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground gradient-hero">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings')}
            className="p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Notification Testing</h1>
        </div>
      </div>

      <div className="px-6 space-y-6">
        <FCMDiagnostics />
        <TestNotifications />
      </div>
    </div>
  );
}