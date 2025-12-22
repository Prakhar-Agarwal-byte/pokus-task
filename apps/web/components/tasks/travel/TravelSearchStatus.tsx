'use client';

import { motion } from 'framer-motion';
import { Plane, Loader2, CheckCircle2, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface TravelSearchStatusProps {
  status: 'executing' | 'complete' | 'inProgress';
  progress: number;
  destination?: string;
}

export function TravelSearchStatus({ status, progress, destination }: TravelSearchStatusProps) {
  const isExecuting = status === 'executing' || status === 'inProgress';

  return (
    <Card className="my-4 overflow-hidden border-blue-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isExecuting ? 'bg-blue-100' : 'bg-blue-500'
            }`}
          >
            {isExecuting ? (
              <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-white" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium">
              {isExecuting ? 'Creating your perfect itinerary...' : 'Itinerary ready!'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {destination && (
                <Badge variant="secondary" className="gap-1">
                  <MapPin className="h-3 w-3" />
                  {destination}
                </Badge>
              )}
              {isExecuting && (
                <span className="text-sm text-muted-foreground">
                  {progress}% complete
                </span>
              )}
            </div>
          </div>
        </div>

        {isExecuting && (
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <Plane className="h-3 w-3" />
              <span>Finding the best activities and restaurants...</span>
            </div>
          </div>
        )}

        {!isExecuting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 p-3 bg-blue-100 rounded-lg"
          >
            <p className="text-sm text-blue-800">
              ✨ Your personalized itinerary is ready! Check the left panel to explore each day.
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
