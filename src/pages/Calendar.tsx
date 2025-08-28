import { Calendar as CalendarIcon, Clock, Music, Plus } from "lucide-react";

const Calendar = () => {
  const today = new Date();
  const currentMonth = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen gradient-hero">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between text-white">
          <div>
            <h1 className="text-2xl font-bold">Calendar</h1>
            <p className="text-accent opacity-80">{currentMonth}</p>
          </div>
          <Plus className="w-6 h-6 text-accent" />
        </div>
      </div>

      {/* Today's Events */}
      <div className="px-6 mb-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <div className="flex items-center space-x-3 mb-4">
            <CalendarIcon className="w-5 h-5 text-accent" />
            <h2 className="text-white text-lg font-semibold">Today</h2>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-4 bg-white/5 rounded-lg p-3">
              <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                <Music className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium">Studio Session</h3>
                <div className="flex items-center space-x-1 text-accent text-sm opacity-80">
                  <Clock className="w-3 h-3" />
                  <span>2:00 PM - 4:00 PM</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4 bg-white/5 rounded-lg p-3">
              <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                <Music className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium">Live Performance</h3>
                <div className="flex items-center space-x-1 text-accent text-sm opacity-80">
                  <Clock className="w-3 h-3" />
                  <span>7:00 PM - 9:00 PM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="px-6">
        <h2 className="text-white text-lg font-semibold mb-4">Upcoming</h2>
        
        <div className="space-y-3">
          {[
            { date: "Tomorrow", event: "Recording Session", time: "10:00 AM" },
            { date: "Friday", event: "Band Practice", time: "6:00 PM" },
            { date: "Saturday", event: "Open Mic Night", time: "8:00 PM" }
          ].map((item, index) => (
            <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">{item.event}</h3>
                  <p className="text-accent text-sm opacity-80">{item.date} at {item.time}</p>
                </div>
                <Music className="w-5 h-5 text-accent" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Calendar;