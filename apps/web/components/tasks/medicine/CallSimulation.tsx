'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Phone, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Pharmacy {
  id: string;
  name: string;
  address: string;
  phone: string;
}

interface CallResult {
  available: boolean;
  quantity: number;
  price: number;
  transcript: string[];
}

interface CallSimulationProps {
  status: 'executing' | 'complete' | 'inProgress';
  pharmacy?: Pharmacy;
  medicine?: string;
  callResult?: CallResult | null;
}

export function CallSimulation({ status, pharmacy, medicine, callResult }: CallSimulationProps) {
  const isExecuting = status === 'executing' || status === 'inProgress';

  return (
    <Card className="my-4 overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="relative">
              <Phone className="h-5 w-5 text-blue-600" />
              {isExecuting && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse" />
              )}
            </div>
            {isExecuting ? 'Calling Pharmacy...' : 'Call Complete'}
          </CardTitle>
          <Badge variant="warning">⚠️ Simulated</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {pharmacy && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="font-medium">{pharmacy.name}</p>
            <p className="text-sm text-muted-foreground">{pharmacy.phone}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {isExecuting ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-8"
            >
              <div className="relative">
                <Phone className="h-12 w-12 text-blue-600" />
                <motion.div
                  className="absolute inset-0 border-4 border-blue-400 rounded-full"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>
              <p className="mt-4 text-sm font-medium">Calling {pharmacy?.name}...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Checking availability for {medicine}
              </p>
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>This is a simulated call for demonstration</span>
              </div>
            </motion.div>
          ) : callResult ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Result summary */}
              <div
                className={`flex items-center gap-3 p-4 rounded-lg mb-4 ${
                  callResult.available
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {callResult.available ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  <XCircle className="h-6 w-6" />
                )}
                <div>
                  <p className="font-semibold">
                    {callResult.available ? 'Medicine Available!' : 'Out of Stock'}
                  </p>
                  {callResult.available && (
                    <p className="text-sm">
                      {callResult.quantity} units @ ${callResult.price.toFixed(2)} each
                    </p>
                  )}
                </div>
              </div>

              {/* Call transcript */}
              <div>
                <p className="text-sm font-medium mb-2">Call Transcript (Simulated)</p>
                <ScrollArea className="h-[200px] rounded-lg border bg-slate-50 p-3">
                  <div className="space-y-2">
                    {callResult.transcript.map((line, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`text-sm p-2 rounded-lg ${
                          line.startsWith('Pharmacist:')
                            ? 'bg-blue-100 text-blue-800 mr-8'
                            : 'bg-green-100 text-green-800 ml-8'
                        }`}
                      >
                        {line}
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
