'use client';

import { motion } from 'framer-motion';
import { MapPin, Phone, Clock, Star, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Pharmacy {
  id: string;
  name: string;
  address: string;
  distance: number;
  phone: string;
  openNow: boolean;
  hours: string;
  rating: number;
  hasStock: boolean | null;
  price: number | null;
}

interface PharmacyCardProps {
  pharmacy: Pharmacy;
  isSelected?: boolean;
  medicine?: string;
}

export function PharmacyCard({ pharmacy, isSelected, medicine }: PharmacyCardProps) {
  const stockStatus = pharmacy.hasStock === null ? 'unknown' : pharmacy.hasStock ? 'available' : 'unavailable';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          'transition-all duration-200',
          isSelected && 'ring-2 ring-primary shadow-lg',
          stockStatus === 'available' && 'border-emerald-200 bg-emerald-50/50',
          stockStatus === 'unavailable' && 'border-red-200 bg-red-50/50 opacity-75'
        )}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">{pharmacy.name}</h3>
                <div className="flex items-center gap-1 text-amber-500">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  <span className="text-xs font-medium">{pharmacy.rating}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                <MapPin className="h-3.5 w-3.5" />
                <span>{pharmacy.address}</span>
                <span className="text-primary font-medium ml-1">({pharmacy.distance} km)</span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant={pharmacy.openNow ? 'success' : 'secondary'} className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {pharmacy.openNow ? 'Open Now' : 'Closed'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {pharmacy.hours}
                </Badge>
              </div>

              {/* Stock status */}
              <div className="flex items-center gap-2">
                {stockStatus === 'unknown' && (
                  <Badge variant="outline" className="text-xs">
                    <HelpCircle className="h-3 w-3 mr-1" />
                    Stock not checked
                  </Badge>
                )}
                {stockStatus === 'available' && (
                  <>
                    <Badge variant="success" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      In Stock
                    </Badge>
                    {pharmacy.price && (
                      <Badge variant="secondary" className="text-xs">
                        ${pharmacy.price.toFixed(2)}
                      </Badge>
                    )}
                  </>
                )}
                {stockStatus === 'unavailable' && (
                  <Badge variant="destructive" className="text-xs">
                    <XCircle className="h-3 w-3 mr-1" />
                    Out of Stock
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 ml-4">
              <Button size="sm" variant="outline" className="gap-1" asChild>
                <a href={`tel:${pharmacy.phone}`}>
                  <Phone className="h-3.5 w-3.5" />
                  Call
                </a>
              </Button>
            </div>
          </div>

          {isSelected && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-3 pt-3 border-t"
            >
              <p className="text-sm text-muted-foreground">
                📞 <strong>Phone:</strong> {pharmacy.phone}
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
