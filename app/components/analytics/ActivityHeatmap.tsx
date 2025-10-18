'use client';

import { useEffect, useState } from 'react';

interface ActivityHeatmapProps {
  timeRange: string;
}

interface HeatmapData {
  day: string;
  hour: number;
  count: number;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function ActivityHeatmap({ timeRange }: ActivityHeatmapProps) {
  const [data, setData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxCount, setMaxCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/analytics/user/charts/heatmap?timeRange=${timeRange}`);
        if (!response.ok) {
          setError('Failed to load activity data');
          return;
        }
        const result = await response.json();
        const heatmapData = result.data || [];
        setData(heatmapData);

        // Calculate max count for color intensity
        const max = Math.max(...heatmapData.map((d: HeatmapData) => d.count), 1);
        setMaxCount(max);
      } catch (err) {
        console.error('Error fetching chart data:', err);
        setError('An error occurred while loading data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  const getIntensity = (count: number) => {
    if (count === 0) return 0;
    return (count / maxCount) * 100;
  };

  const getColor = (intensity: number) => {
    if (intensity === 0) return 'bg-muted/30';
    if (intensity < 25) return 'bg-primary/20';
    if (intensity < 50) return 'bg-primary/40';
    if (intensity < 75) return 'bg-primary/60';
    return 'bg-primary';
  };

  const getCellData = (day: string, hour: number) => {
    return data.find((d) => d.day === day && d.hour === hour) || { day, hour, count: 0 };
  };

  if (loading) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Hour labels */}
        <div className="flex gap-1 mb-2">
          <div className="w-12" />
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="flex-1 text-center text-xs text-muted-foreground"
            >
              {hour % 3 === 0 ? `${hour}h` : ''}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        {DAYS.map((day) => (
          <div key={day} className="flex gap-1 mb-1">
            <div className="w-12 text-xs text-muted-foreground flex items-center">
              {day}
            </div>
            {HOURS.map((hour) => {
              const cellData = getCellData(day, hour);
              const intensity = getIntensity(cellData.count);
              const colorClass = getColor(intensity);

              return (
                <div
                  key={`${day}-${hour}`}
                  className={`flex-1 h-8 rounded ${colorClass} transition-all hover:ring-2 hover:ring-primary cursor-pointer group relative`}
                  title={`${day} ${hour}:00 - ${cellData.count} searches`}
                >
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    <p className="text-xs font-medium">{day} {hour}:00</p>
                    <p className="text-xs text-muted-foreground">{cellData.count} searches</p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4">
          <span className="text-xs text-muted-foreground">Less</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded bg-muted/30" />
            <div className="w-4 h-4 rounded bg-primary/20" />
            <div className="w-4 h-4 rounded bg-primary/40" />
            <div className="w-4 h-4 rounded bg-primary/60" />
            <div className="w-4 h-4 rounded bg-primary" />
          </div>
          <span className="text-xs text-muted-foreground">More</span>
        </div>
      </div>
    </div>
  );
}
