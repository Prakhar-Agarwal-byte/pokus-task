'use client';

/**
 * Unified Chat Page - Main chat interface for Pokus AI
 * 
 * This component provides a dual-pane layout:
 * - Left Pane: Displays task results (pharmacies, itinerary) with visual cards
 * - Right Pane: CopilotKit chat interface with LLM integration
 * 
 * Architecture:
 * - Uses CopilotKit for LLM chat integration (useCopilotAction, useRenderToolCall)
 * - Backend tools update the left pane via useRenderToolCall setState calls
 * - search_pharmacies: Returns pharmacy list → displayed in left pane
 * - generate_itinerary: Returns structured itinerary → displayed in left pane
 * - Persisted state via localStorage for cross-session continuity
 * 
 * Key Features:
 * - Real-time tool call rendering in chat (loading states, completion badges)
 * - Automatic left pane population from tool results
 * - Dynamic chat suggestions based on task context
 * - LangGraph interrupt support for human-in-the-loop flows
 */

import { 
  useCopilotReadable, 
  useRenderToolCall, 
  useCopilotAction,
  useLangGraphInterrupt,
} from '@copilotkit/react-core';
import { CopilotChat, useCopilotChatSuggestions } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { 
  Bot, Pill, Plane, MapPin, Clock, CheckCircle2, AlertCircle, 
  Calendar, DollarSign, Heart, RotateCcw, Sparkles, Download,
  Phone, Store, Loader2, Search, PhoneCall, X, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PharmacyCard } from '@/components/tasks/medicine/PharmacyCard';
import { ItineraryDay } from '@/components/tasks/travel/ItineraryDay';
import { usePersistedState } from '@/lib/hooks';
import { useState, useEffect, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

// Backend AgentState type - must match supervisor.py AgentState
interface BackendAgentState {
  messages?: unknown[];
  next_agent?: string;
  task_type?: 'medicine' | 'travel' | 'general';
  iteration?: number;
  progress?: Array<{
    step: string;
    message: string;
    status: 'active' | 'complete' | 'error';
  }>;
  travel_preferences?: {
    destination?: string;
    start_date?: string;
    end_date?: string;
    budget?: string;
    interests?: string[];
    pace?: string;
    travelers?: number;
  };
  current_itinerary?: DayPlan[];
  medicine_context?: {
    medicine_name?: string;
    location?: string;
    urgent?: boolean;
  };
  pharmacy_results?: Pharmacy[];
  selected_pharmacy?: Pharmacy;
  user_preferences?: Record<string, unknown>;
}

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

interface Activity {
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
  activities: Activity[];
}

interface TravelPreferences {
  destination: string;
  startDate: string;
  endDate: string;
  budget: 'budget' | 'moderate' | 'luxury';
  interests: string[];
  pace: 'relaxed' | 'moderate' | 'packed';
  travelers: number;
}

interface UnifiedState {
  // Active task type
  activeTask: 'none' | 'medicine' | 'travel';
  
  // Medicine state
  medicine: {
    stage: 'idle' | 'searching' | 'found_pharmacies' | 'checking_availability' | 'calling' | 'completed';
    medicineName: string;
    location: string;
    pharmacies: Pharmacy[];
    selectedPharmacy: Pharmacy | null;
    callResult: {
      available: boolean;
      quantity: number;
      price: number;
      transcript: string[];
    } | null;
  };
  
  // Travel state
  travel: {
    stage: 'idle' | 'gathering_preferences' | 'searching' | 'planning' | 'refining' | 'completed';
    preferences: Partial<TravelPreferences>;
    itinerary: DayPlan[];
    totalCost: number;
    progress: number;
  };
}

const initialState: UnifiedState = {
  activeTask: 'none',
  medicine: {
    stage: 'idle',
    medicineName: '',
    location: '',
    pharmacies: [],
    selectedPharmacy: null,
    callResult: null,
  },
  travel: {
    stage: 'idle',
    preferences: {},
    itinerary: [],
    totalCost: 0,
    progress: 0,
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function UnifiedChatPage() {
  const [state, setState, clearState] = usePersistedState<UnifiedState>(
    'pokus_unified_state',
    initialState
  );

  // ============================================================================
  // BACKEND STATE MANAGEMENT - Track state locally since useCoAgent requires
  // agents registered in runtime config (not compatible with remote HTTP endpoints)
  // ============================================================================
  
  const [agentState, setAgentState] = useState<BackendAgentState>({
    progress: [],
    travel_preferences: {},
    current_itinerary: [],
    medicine_context: {},
    pharmacy_results: [],
    selected_pharmacy: undefined,
    user_preferences: {},
  });

  // ============================================================================
  // COPILOTKIT CHAT SUGGESTIONS - Context-aware suggestions
  // ============================================================================

  // Generate dynamic suggestions based on current task state
  const suggestionContext = useMemo(() => {
    if (agentState?.task_type === 'medicine') {
      const pharmacyCount = agentState.pharmacy_results?.length || 0;
      const hasMedicine = agentState.medicine_context?.medicine_name;
      if (pharmacyCount > 0) {
        return `User found ${pharmacyCount} pharmacies for ${hasMedicine}. Suggest: checking availability at specific pharmacy, calling top pharmacy, searching different area.`;
      }
      return `User is looking for medicine. Suggest: search for specific medicine, find 24-hour pharmacies, check medicine alternatives.`;
    }
    if (agentState?.task_type === 'travel') {
      const hasItinerary = (agentState.current_itinerary?.length || 0) > 0;
      const dest = agentState.travel_preferences?.destination;
      if (hasItinerary) {
        return `User has ${agentState.current_itinerary?.length}-day itinerary for ${dest}. Suggest: modifying specific day, adding activities, exporting itinerary.`;
      }
      if (dest) {
        return `User planning trip to ${dest}. Suggest: setting travel dates, choosing budget level, specifying interests.`;
      }
      return `User wants to plan travel. Suggest: popular destinations, weekend getaways, adventure trips.`;
    }
    return `User just started. Suggest: find medicine nearby, plan a vacation, ask what you can help with.`;
  }, [agentState?.task_type, agentState?.pharmacy_results?.length, agentState?.current_itinerary?.length, agentState?.travel_preferences?.destination, agentState?.medicine_context?.medicine_name]);

  useCopilotChatSuggestions({
    instructions: suggestionContext,
    minSuggestions: 2,
    maxSuggestions: 4,
  }, [suggestionContext]);

  // ============================================================================
  // FRONTEND ACTIONS - Actions the backend can trigger
  // ============================================================================

  // Action: Select a pharmacy (highlights in UI)
  useCopilotAction({
    name: 'select_pharmacy',
    description: 'Select a pharmacy from the search results to highlight it',
    parameters: [
      { name: 'pharmacy_id', type: 'string', description: 'ID of the pharmacy to select' },
      { name: 'pharmacy_name', type: 'string', description: 'Name of the pharmacy' },
    ],
    handler: async ({ pharmacy_id, pharmacy_name }) => {
      const pharmacy = state.medicine.pharmacies.find(p => p.id === pharmacy_id);
      if (pharmacy) {
        setState(prev => ({
          ...prev,
          medicine: { ...prev.medicine, selectedPharmacy: pharmacy }
        }));
      }
      return { selected: pharmacy_name, success: true };
    },
  });

  // Action: Export itinerary to file
  useCopilotAction({
    name: 'export_itinerary',
    description: 'Export the current travel itinerary to a downloadable file',
    parameters: [
      { name: 'format', type: 'string', description: 'Export format (text or json)' },
    ],
    handler: async ({ format }) => {
      if (state.travel.itinerary.length === 0) {
        return { success: false, message: 'No itinerary to export' };
      }
      
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(state.travel.itinerary, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.travel.preferences.destination || 'travel'}-itinerary.json`;
        a.click();
      } else {
        exportItinerary();
      }
      return { success: true, message: 'Itinerary exported!' };
    },
  });

  // Action: Save pharmacy to favorites (localStorage persistence)
  useCopilotAction({
    name: 'save_to_favorites',
    description: 'Save a pharmacy or destination to user favorites',
    parameters: [
      { name: 'type', type: 'string', description: 'Type: pharmacy or destination' },
      { name: 'name', type: 'string', description: 'Name to save' },
      { name: 'details', type: 'string', description: 'Additional details' },
    ],
    handler: async ({ type, name, details }) => {
      const favorites = JSON.parse(localStorage.getItem('pokus_favorites') || '[]');
      favorites.push({ type, name, details, savedAt: new Date().toISOString() });
      localStorage.setItem('pokus_favorites', JSON.stringify(favorites));
      return { success: true, message: `Saved ${name} to favorites!` };
    },
  });

  // ============================================================================
  // HUMAN-IN-THE-LOOP - Pharmacy Call Confirmation
  // ============================================================================

  useLangGraphInterrupt<{
    action?: string;
    pharmacy_name?: string;
    medicine_name?: string;
    quantity_needed?: number;
    description?: string;
  }>({
    // Only enable for pharmacy call confirmation events
    enabled: ({ eventValue }) => eventValue?.action === 'confirm_pharmacy_call',
    
    render: ({ event, resolve }) => {
      const { pharmacy_name, medicine_name, quantity_needed, description } = event?.value || {};

      return (
        <Card className="my-3 border-amber-300 bg-amber-50/80 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-800">
              <PhoneCall className="h-5 w-5" />
              Confirm Pharmacy Call
            </CardTitle>
            <CardDescription className="text-amber-700">
              {description || 'This will simulate a phone call to the pharmacy.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white/60 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-emerald-600" />
                <span className="font-medium">{pharmacy_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-blue-600" />
                <span>{medicine_name}</span>
                {(quantity_needed ?? 0) > 1 && (
                  <Badge variant="secondary">×{quantity_needed}</Badge>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => resolve(JSON.stringify({ approved: true }))}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <Phone className="h-4 w-4 mr-2" />
                Call Now
              </Button>
              <Button 
                variant="outline"
                onClick={() => resolve(JSON.stringify({ declined: true }))}
                className="flex-1 border-amber-300 hover:bg-amber-100"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
            
            <p className="text-xs text-amber-600 text-center">
              ⚠️ This is a simulated call for demonstration purposes
            </p>
          </CardContent>
        </Card>
      );
    },
  });

  // ============================================================================
  // TOOL CALL RENDERING - Frontend Actions (minimal status in chat)
  // ============================================================================

  // Render select_pharmacy action
  useRenderToolCall({
    name: 'select_pharmacy',
    render: ({ status, args }) => {
      const isLoading = status !== 'complete';
      return (
        <div className="flex items-center gap-2 text-sm py-2 px-3 my-1 bg-violet-50 rounded-lg border border-violet-200">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-violet-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          <span>{isLoading ? `Selecting ${args?.pharmacy_name}...` : `Selected ${args?.pharmacy_name}`}</span>
          <Badge variant="secondary" className="ml-auto">View in left panel →</Badge>
        </div>
      );
    },
  });

  // Render export_itinerary action
  useRenderToolCall({
    name: 'export_itinerary',
    render: ({ status, args }) => {
      const isLoading = status !== 'complete';
      return (
        <div className="flex items-center gap-2 text-sm py-2 px-3 my-1 bg-green-50 rounded-lg border border-green-200">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-green-600" /> : <Download className="h-4 w-4 text-green-600" />}
          <span>{isLoading ? 'Exporting itinerary...' : `Itinerary exported as ${args?.format || 'text'}`}</span>
        </div>
      );
    },
  });

  // Render save_to_favorites action
  useRenderToolCall({
    name: 'save_to_favorites',
    render: ({ status, args }) => {
      const isLoading = status !== 'complete';
      return (
        <div className="flex items-center gap-2 text-sm py-2 px-3 my-1 bg-pink-50 rounded-lg border border-pink-200">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-pink-600" /> : <Heart className="h-4 w-4 text-pink-600" />}
          <span>{isLoading ? `Saving ${args?.name}...` : `Saved ${args?.name} to favorites`}</span>
        </div>
      );
    },
  });

  // ============================================================================
  // TOOL CALL RENDERING - Medicine Tools (Update left pane + show status in chat)
  // ============================================================================
  
  // Render search_pharmacies tool calls - now receives structured response and updates left pane
  useRenderToolCall({
    name: 'search_pharmacies',
    render: ({ status, args, result }) => {
      const isLoading = status !== 'complete';
      
      // Set stage to searching while loading
      if (isLoading) {
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            activeTask: 'medicine',
            medicine: {
              ...prev.medicine,
              stage: 'searching',
              medicineName: args?.medicine_name || prev.medicine.medicineName,
              location: args?.location || prev.medicine.location,
            },
          }));
        }, 0);
      }
      
      // Update left pane with structured pharmacy data when complete
      if (status === 'complete' && result?.success && result?.pharmacies) {
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            activeTask: 'medicine',
            medicine: {
              ...prev.medicine,
              stage: 'found_pharmacies',
              medicineName: args?.medicine_name || prev.medicine.medicineName,
              location: args?.location || prev.medicine.location,
              pharmacies: result.pharmacies.map((p: { id?: string; name: string; address: string; distance_km?: number; rating?: number; phone?: string; is_open?: boolean; hours?: string; has_medicine?: boolean; estimated_price?: number }, i: number) => ({
                id: p.id || `pharmacy-${i}`,
                name: p.name,
                address: p.address,
                distance: p.distance_km || 1.0,
                phone: p.phone || 'Contact via website',
                openNow: p.is_open ?? true,
                hours: p.hours || 'Check website for hours',
                rating: p.rating || 4.0,
                hasStock: p.has_medicine ?? null,
                price: p.estimated_price || null,
              })),
            },
          }));
        }, 0);
      }
      
      const pharmacyCount = result?.pharmacies?.length || 0;
      
      return (
        <div className={`flex items-center gap-2 text-sm py-2 px-3 my-1 rounded-lg border ${result?.success ? 'bg-emerald-50 border-emerald-200' : result?.error ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span>Searching pharmacies for {args?.medicine_name} near {args?.location}...</span>
            </>
          ) : result?.success ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Found {pharmacyCount} pharmacies</span>
              <Badge variant="secondary" className="ml-auto">View in left panel →</Badge>
            </>
          ) : result?.error ? (
            <>
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-red-600">{result.message}</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span>No pharmacies found</span>
            </>
          )}
        </div>
      );
    },
  });

  // Render check_availability tool calls - updates left pane
  useRenderToolCall({
    name: 'check_availability',
    render: ({ status, args, result }) => {
      const isLoading = status !== 'complete';
      
      // Update pharmacy stock status in left pane
      if (status === 'complete' && result && args?.pharmacy_name) {
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            medicine: {
              ...prev.medicine,
              stage: 'checking_availability',
              pharmacies: prev.medicine.pharmacies.map(p => 
                p.name === args.pharmacy_name 
                  ? { ...p, hasStock: result.in_stock, price: result.price_per_unit || null }
                  : p
              ),
            },
          }));
        }, 0);
      }
      
      return (
        <div className={`flex items-center gap-2 text-sm py-2 px-3 my-1 rounded-lg border ${result?.in_stock ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span>Checking stock at {args?.pharmacy_name}...</span>
            </>
          ) : result ? (
            <>
              {result.in_stock ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              )}
              <span>{result.message}</span>
              {result.in_stock && result.price_per_unit && (
                <Badge variant="secondary" className="ml-auto">${result.price_per_unit}/unit</Badge>
              )}
            </>
          ) : null}
        </div>
      );
    },
  });

  // Render call_pharmacy tool calls - updates left pane with call result
  useRenderToolCall({
    name: 'call_pharmacy',
    render: ({ status, args, result }) => {
      const isLoading = status !== 'complete';
      
      // Update left pane with call result
      if (status === 'complete' && result) {
        setTimeout(() => {
          const selectedPharmacy = args?.pharmacy_name;
          setState(prev => ({
            ...prev,
            medicine: {
              ...prev.medicine,
              stage: 'completed',
              selectedPharmacy: prev.medicine.pharmacies.find(p => p.name === selectedPharmacy) || prev.medicine.selectedPharmacy,
              callResult: {
                available: result.available,
                quantity: result.quantity || 0,
                price: result.price || 0,
                transcript: result.transcript || [],
              },
            },
          }));
        }, 0);
      }
      
      return (
        <div className={`flex items-center gap-2 text-sm py-2 px-3 my-1 rounded-lg border ${result?.available ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Calling {args?.pharmacy_name}...</span>
              <Badge variant="outline" className="ml-auto">⚠️ Simulated</Badge>
            </>
          ) : result ? (
            <>
              {result.available ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              )}
              <span>{result.message}</span>
              {result.available && (
                <Badge variant="secondary" className="ml-auto">{result.quantity} units @ ${result.price?.toFixed(2)}</Badge>
              )}
            </>
          ) : null}
        </div>
      );
    },
  });

  // ============================================================================
  // TOOL CALL RENDERING - Travel Tools (Update left pane + show status in chat)
  // ============================================================================

  // Render update_preferences tool calls - updates left pane
  useRenderToolCall({
    name: 'update_preferences',
    render: ({ status, args }) => {
      const isLoading = status !== 'complete';
      
      // Update left pane with preferences
      if (status === 'complete' && args) {
        setTimeout(() => {
          setState(prev => {
            // Ensure interests is always an array
            const parseInterests = (interests: string | string[] | undefined): string[] => {
              if (!interests) return prev.travel.preferences.interests || [];
              if (Array.isArray(interests)) return interests;
              if (typeof interests === 'string') return interests.split(',').map(s => s.trim()).filter(Boolean);
              return [];
            };
            
            return {
              ...prev,
              activeTask: 'travel',
              travel: {
                ...prev.travel,
                stage: 'gathering_preferences',
                preferences: {
                  ...prev.travel.preferences,
                  destination: args.destination || prev.travel.preferences.destination,
                  startDate: args.start_date || prev.travel.preferences.startDate,
                  endDate: args.end_date || prev.travel.preferences.endDate,
                  budget: args.budget || prev.travel.preferences.budget,
                  interests: parseInterests(args.interests),
                  pace: args.pace || prev.travel.preferences.pace,
                  travelers: args.travelers || prev.travel.preferences.travelers,
                },
              },
            };
          });
        }, 0);
      }
      
      return (
        <div className="flex items-center gap-2 text-sm py-2 px-3 my-1 bg-blue-50 rounded-lg border border-blue-200">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          <span>{isLoading ? 'Saving preferences...' : 'Preferences saved'}</span>
          {args?.destination && <Badge variant="secondary" className="ml-auto">{args.destination}</Badge>}
        </div>
      );
    },
  });

  // Render generate_itinerary tool calls - now receives structured itinerary and updates left pane
  useRenderToolCall({
    name: 'generate_itinerary',
    render: ({ status, args, result }) => {
      const isLoading = status !== 'complete';
      
      // Set stage to planning while loading
      if (isLoading) {
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            activeTask: 'travel',
            travel: {
              ...prev.travel,
              stage: 'planning',
              progress: 50,
            },
          }));
        }, 0);
      }
      
      // Update left pane with structured itinerary when complete
      if (status === 'complete' && result?.success && result?.itinerary) {
        setTimeout(() => {
          const processedItinerary = result.itinerary.map((day: DayPlan, dayIndex: number) => ({
            ...day,
            day: day.day || dayIndex + 1,
            activities: (day.activities || []).map((act: Activity, actIndex: number) => ({
              ...act,
              id: act.id || `day${day.day || dayIndex + 1}-act${actIndex + 1}`,
              cost: act.cost || 0,
              type: act.type || 'activity',
            })),
          }));
          
          setState(prev => ({
            ...prev,
            activeTask: 'travel',
            travel: {
              ...prev.travel,
              stage: 'completed',
              itinerary: processedItinerary,
              totalCost: result.total_cost || processedItinerary.reduce((sum: number, day: DayPlan) => 
                sum + day.activities.reduce((daySum: number, act: Activity) => daySum + (act.cost || 0), 0), 0),
              progress: 100,
            },
          }));
        }, 0);
      }
      
      return (
        <div className={`flex items-center gap-2 text-sm py-2 px-3 my-1 rounded-lg border ${result?.success ? 'bg-emerald-50 border-emerald-200' : result?.error ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span>Planning {args?.destination}...</span>
            </>
          ) : result?.success ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{result.num_days}-day itinerary created!</span>
              <Badge variant="secondary" className="ml-auto">View in left panel →</Badge>
            </>
          ) : result?.error ? (
            <>
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-red-600">{result.message}</span>
            </>
          ) : null}
        </div>
      );
    },
  });

  // Render search_activities tool calls
  useRenderToolCall({
    name: 'search_activities',
    render: ({ status, args }) => {
      const isLoading = status !== 'complete';
      
      return (
        <div className="flex items-center gap-2 text-sm py-2 px-3 my-1 bg-purple-50 rounded-lg border border-purple-200">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
              <span>Finding {args?.activity_type} in {args?.destination}...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Found activities</span>
            </>
          )}
        </div>
      );
    },
  });

  // Render modify_itinerary tool calls - updates left pane
  useRenderToolCall({
    name: 'modify_itinerary',
    render: ({ status, args, result }) => {
      const isLoading = status !== 'complete';
      
      // Update left pane when itinerary is modified
      if (status === 'complete' && result?.itinerary) {
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            travel: {
              ...prev.travel,
              itinerary: result.itinerary,
              totalCost: result.total_estimated_cost || prev.travel.totalCost,
            },
          }));
        }, 0);
      }
      
      return (
        <div className="flex items-center gap-2 text-sm py-2 px-3 my-1 bg-amber-50 rounded-lg border border-amber-200">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          <span>{isLoading ? `Modifying day ${args?.day}...` : `Day ${args?.day} updated`}</span>
        </div>
      );
    },
  });

  // Reset all state
  const handleReset = () => {
    clearState();
  };

  // Make state readable to the agent
  useCopilotReadable({
    description: 'Current task state for medicine search and travel planning',
    value: state,
  });

  // Export itinerary
  const exportItinerary = () => {
    const text = state.travel.itinerary
      .map((day) => {
        const activities = day.activities.map((a) => `  ${a.time} - ${a.title} (${a.location}) - $${a.cost.toFixed(0)}`).join('\n');
        return `Day ${day.day}: ${day.theme}\n${day.date}\n${activities}`;
      })
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.travel.preferences.destination || 'travel'}-itinerary.txt`;
    a.click();
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Pokus AI</h1>
              <p className="text-sm text-muted-foreground">Ask me anything - find medicine or plan travel</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {state.activeTask !== 'none' && (
              <Badge variant="secondary" className="gap-1">
                {state.activeTask === 'medicine' ? <Pill className="h-3 w-3" /> : <Plane className="h-3 w-3" />}
                {state.activeTask === 'medicine' ? 'Medicine' : 'Travel'}
              </Badge>
            )}
            {(state.medicine.stage !== 'idle' || state.travel.stage !== 'idle') && (
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
            {state.travel.itinerary.length > 0 && (
              <Button variant="outline" size="sm" className="gap-2" onClick={exportItinerary}>
                <Download className="h-4 w-4" />
                Export
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6 h-[calc(100vh-140px)]">
          {/* Left side - Dynamic context display */}
          <div className="space-y-4 overflow-auto">
            {/* Empty state */}
            {state.activeTask === 'none' && (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Ready to help!</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Type a message to get started. I can help you find medicine nearby or plan your next trip.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-6">
                    <Badge variant="outline" className="gap-1">
                      <Pill className="h-3 w-3" /> "Find paracetamol near me"
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Plane className="h-3 w-3" /> "Plan a trip to Bali"
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Medicine context */}
            {state.activeTask === 'medicine' && (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Pill className="h-5 w-5 text-emerald-600" />
                      Medicine Search
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{state.medicine.medicineName || 'Searching...'}</Badge>
                      {state.medicine.location && (
                        <Badge variant="outline">
                          <MapPin className="h-3 w-3 mr-1" />
                          {state.medicine.location}
                        </Badge>
                      )}
                      <Badge variant={state.medicine.stage === 'completed' ? 'default' : 'outline'}>
                        {state.medicine.stage.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {state.medicine.pharmacies.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Nearby Pharmacies</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-3">
                          {state.medicine.pharmacies.map((pharmacy) => (
                            <PharmacyCard
                              key={pharmacy.id}
                              pharmacy={pharmacy}
                              isSelected={state.medicine.selectedPharmacy?.id === pharmacy.id}
                              medicine={state.medicine.medicineName}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                {state.medicine.callResult && (
                  <Card className={state.medicine.callResult.available ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {state.medicine.callResult.available ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-amber-600" />
                        )}
                        {state.medicine.callResult.available ? 'Reserved!' : 'Not Available'}
                      </CardTitle>
                      <Badge variant="outline" className="w-fit">⚠️ Simulated Call</Badge>
                    </CardHeader>
                    <CardContent>
                      {state.medicine.callResult.available && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-white rounded-lg">
                            <p className="text-xs text-muted-foreground">Quantity</p>
                            <p className="text-xl font-bold">{state.medicine.callResult.quantity} units</p>
                          </div>
                          <div className="p-3 bg-white rounded-lg">
                            <p className="text-xs text-muted-foreground">Price</p>
                            <p className="text-xl font-bold">${state.medicine.callResult.price.toFixed(2)}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Travel context */}
            {state.activeTask === 'travel' && (
              <>
                {Object.keys(state.travel.preferences).length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Plane className="h-5 w-5 text-blue-600" />
                        Trip Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {state.travel.preferences.destination && (
                          <Badge variant="default"><MapPin className="h-3 w-3 mr-1" />{state.travel.preferences.destination}</Badge>
                        )}
                        {state.travel.preferences.startDate && (
                          <Badge variant="secondary"><Calendar className="h-3 w-3 mr-1" />{state.travel.preferences.startDate}</Badge>
                        )}
                        {state.travel.preferences.budget && (
                          <Badge variant="outline"><DollarSign className="h-3 w-3 mr-1" />{state.travel.preferences.budget}</Badge>
                        )}
                        {state.travel.preferences.pace && (
                          <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{state.travel.preferences.pace}</Badge>
                        )}
                        {Array.isArray(state.travel.preferences.interests) && state.travel.preferences.interests.map((i) => (
                          <Badge key={i} variant="secondary"><Heart className="h-3 w-3 mr-1" />{i}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {state.travel.stage === 'planning' && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Creating Itinerary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Progress value={state.travel.progress} className="mb-2" />
                      <p className="text-sm text-muted-foreground">{state.travel.progress}% complete</p>
                    </CardContent>
                  </Card>
                )}

                {state.travel.itinerary.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">Your Itinerary</CardTitle>
                        <Badge variant="secondary">Total: ${Math.round(state.travel.totalCost)}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Tabs defaultValue="1">
                        <div className="px-6 pb-2">
                          <TabsList>
                            {state.travel.itinerary.map((d) => (
                              <TabsTrigger key={d.day} value={d.day.toString()}>Day {d.day}</TabsTrigger>
                            ))}
                          </TabsList>
                        </div>
                        <ScrollArea className="h-[300px] px-6 pb-6">
                          {state.travel.itinerary.map((day) => (
                            <TabsContent key={day.day} value={day.day.toString()}>
                              <ItineraryDay day={day} />
                            </TabsContent>
                          ))}
                        </ScrollArea>
                      </Tabs>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>

          {/* Right side - Chat */}
          <Card className="flex flex-col h-full min-h-0">
            <CardHeader className="pb-3 border-b flex-shrink-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Assistant
              </CardTitle>
              <CardDescription>
                Find medicine or plan travel - just ask!
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0 min-h-0 overflow-hidden">
              <CopilotChat
                className="h-full max-h-full"
                labels={{
                  title: 'Pokus AI',
                  initial: "👋 Hi! I'm Pokus AI, your personal assistant for finding medicine and planning travel.\n\n**🏥 Need Medicine?**\nJust tell me what you're looking for, and I'll help you find it at nearby pharmacies.\n\n**✈️ Planning a Trip?**\nShare your travel ideas, and I'll create a personalized itinerary for you.\n\n**I'll ask a few questions to make sure I get you the best results!** What can I help you with today?",
                }}
                instructions={`You are Pokus AI, a friendly and helpful assistant. Your MOST IMPORTANT job is to ask follow-up questions to understand the user's needs BEFORE taking any action.

## CORE PRINCIPLE: ASK FIRST, ACT LATER
- Never execute a tool without gathering sufficient information
- Ask clarifying questions one or two at a time (don't overwhelm)
- Confirm your understanding before taking action
- Be conversational and helpful throughout

## TASK 1: MEDICINE FINDING
When user mentions medicine, pharmacy, drugs, pills, or medication:

REQUIRED INFO before searching:
- Medicine name (and dosage/form if known)
- Location (city, neighborhood, or address)

GOOD TO ASK:
- Is this urgent? Need 24-hour pharmacies?
- How much do they need?
- Any pharmacy preferences?

ONLY THEN use:
- searchPharmacies → checkAvailability → callPharmacy (remind it's simulated)

## TASK 2: TRAVEL PLANNING  
When user mentions travel, trip, vacation, itinerary, or destination:

REQUIRED INFO before generating itinerary:
- Destination
- Dates or duration
- Budget level (budget/moderate/luxury)

GOOD TO ASK:
- Number of travelers
- Interests (culture, food, adventure, relaxation)
- Preferred pace (relaxed/moderate/packed)
- Any must-see places or dietary restrictions?

WORKFLOW:
1. updatePreferences - save the user's preferences
2. generateItinerary - research the destination (this returns data, write a friendly itinerary summary in chat)

## EXAMPLE GOOD RESPONSES:

User: "I need medicine"
You: "I'd be happy to help you find medicine! What medication are you looking for? If you know the specific name and dosage, that would help me find it faster."

User: "Plan a trip for me"
You: "Exciting! I'd love to help plan your trip! ✨ Where are you thinking of going? Any destinations that have been on your bucket list?"

## REMEMBER:
- NEVER search/generate without required info
- Be warm and conversational
- Confirm before acting: "Just to confirm, you're looking for X near Y?"
- Guide users step-by-step through the process`}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
