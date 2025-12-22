'use client';

import { motion } from 'framer-motion';
import { Clock, MapPin, DollarSign, Lightbulb, Utensils, Camera, Car, Home, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ActivityItem {
  id: string;
  time: string;
  title: string;
  description: string;
  duration: string;
  type: 'attraction' | 'food' | 'transport' | 'accommodation' | 'activity';
  cost: number;
  location: string;
  tips?: string;
}

interface DayPlan {
  day: number;
  date: string;
  theme: string;
  activities: ActivityItem[];
}

interface ItineraryDayProps {
  day: DayPlan;
}

const typeIcons = {
  attraction: Camera,
  food: Utensils,
  transport: Car,
  accommodation: Home,
  activity: Activity,
};

const typeColors = {
  attraction: 'text-purple-600 bg-purple-100',
  food: 'text-orange-600 bg-orange-100',
  transport: 'text-blue-600 bg-blue-100',
  accommodation: 'text-green-600 bg-green-100',
  activity: 'text-pink-600 bg-pink-100',
};

export function ItineraryDay({ day }: ItineraryDayProps) {
  const totalCost = day.activities.reduce((sum, a) => sum + a.cost, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">{day.theme}</h3>
          <p className="text-sm text-muted-foreground">{day.date}</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <DollarSign className="h-3 w-3" />
          {Math.round(totalCost)}
        </Badge>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-200" />

        <div className="space-y-4">
          {day.activities.map((activity, index) => {
            const Icon = typeIcons[activity.type] || Activity;
            const colorClass = typeColors[activity.type] || 'text-gray-600 bg-gray-100';

            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative pl-14"
              >
                {/* Timeline dot */}
                <div
                  className={`absolute left-4 top-3 w-5 h-5 rounded-full flex items-center justify-center ${colorClass}`}
                >
                  <Icon className="h-3 w-3" />
                </div>

                <Card className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs font-normal">
                            {activity.time}
                          </Badge>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {activity.type}
                          </Badge>
                        </div>
                        <h4 className="font-medium">{activity.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {activity.duration}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {activity.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {activity.cost.toFixed(0)}
                          </span>
                        </div>
                        {activity.tips && (
                          <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-800 flex items-start gap-1">
                            <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span>{activity.tips}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
