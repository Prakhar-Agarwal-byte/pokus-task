'use client';

import { motion } from 'framer-motion';
import { MapPin, Calendar, DollarSign, Heart, Users, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PreferencesCardProps {
  preferences: Record<string, any>;
  status: 'executing' | 'complete' | 'inProgress';
}

export function PreferencesCard({ preferences, status }: PreferencesCardProps) {
  if (!preferences || Object.keys(preferences).length === 0) {
    return null;
  }

  const items = [
    { key: 'destination', icon: MapPin, label: 'Destination' },
    { key: 'startDate', icon: Calendar, label: 'Start Date' },
    { key: 'endDate', icon: Calendar, label: 'End Date' },
    { key: 'budget', icon: DollarSign, label: 'Budget' },
    { key: 'interests', icon: Heart, label: 'Interests' },
    { key: 'pace', icon: Clock, label: 'Pace' },
    { key: 'travelers', icon: Users, label: 'Travelers' },
  ];

  const activeItems = items.filter((item) => preferences[item.key] != null);

  return (
    <Card className="my-4 border-blue-200 bg-blue-50/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">Preferences Updated</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeItems.map((item, index) => {
            const Icon = item.icon;
            let value = preferences[item.key];
            
            // Format arrays
            if (Array.isArray(value)) {
              value = value.join(', ');
            }

            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Badge variant="secondary" className="gap-1.5 py-1.5">
                  <Icon className="h-3 w-3" />
                  <span className="font-medium">{value}</span>
                </Badge>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
