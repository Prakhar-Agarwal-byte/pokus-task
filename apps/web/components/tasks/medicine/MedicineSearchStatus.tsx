'use client';

import { motion } from 'framer-motion';
import { Search, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MedicineSearchStatusProps {
  status: 'executing' | 'complete' | 'inProgress';
  medicine?: string;
  location?: string;
}

export function MedicineSearchStatus({ status, medicine, location }: MedicineSearchStatusProps) {
  const isExecuting = status === 'executing' || status === 'inProgress';

  return (
    <Card className="my-4 overflow-hidden border-emerald-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isExecuting ? 'bg-emerald-100' : 'bg-emerald-500'
            }`}
          >
            {isExecuting ? (
              <Loader2 className="h-6 w-6 text-emerald-600 animate-spin" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-white" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium">
              {isExecuting ? 'Searching for pharmacies...' : 'Search complete!'}
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
              {medicine && (
                <Badge variant="secondary" className="gap-1">
                  <Search className="h-3 w-3" />
                  {medicine}
                </Badge>
              )}
              {location && (
                <Badge variant="outline" className="gap-1">
                  <MapPin className="h-3 w-3" />
                  {location}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {isExecuting && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 2, ease: 'easeInOut' }}
            className="h-1 bg-emerald-500 mt-4 rounded-full"
          />
        )}
      </CardContent>
    </Card>
  );
}
