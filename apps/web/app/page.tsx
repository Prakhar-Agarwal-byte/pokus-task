'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Bot, Zap, Shield, Pill, Plane, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    icon: Bot,
    title: 'Multi-Agent Architecture',
    description: 'Supervisor routes to specialized Medicine and Travel agents, each with their own AI.',
  },
  {
    icon: Sparkles,
    title: 'Generative UI',
    description: 'Dynamic interfaces that adapt to your task progress and needs.',
  },
  {
    icon: Zap,
    title: 'Real-Time Execution',
    description: 'Watch agents work in real-time with streaming updates.',
  },
  {
    icon: Shield,
    title: 'Simulated Actions',
    description: 'Safe end-mile execution with clearly labeled simulated results.',
  },
];

const examples = [
  { icon: Pill, text: 'Find paracetamol near downtown SF', type: 'medicine' },
  { icon: Plane, text: 'Plan a 5-day trip to Bali', type: 'travel' },
  { icon: Pill, text: 'I need ibuprofen, I\'m at 123 Main St', type: 'medicine' },
  { icon: Plane, text: 'Create an itinerary for Tokyo with focus on food', type: 'travel' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
        <div className="container mx-auto px-4 py-20 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              AI-Powered Task Completion
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-6">
              Complete{' '}
              <span className="gradient-text">Real-World Tasks</span>
              <br />
              with AI Agents
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Not just answers — actual task completion. Our multi-agent system handles
              everything from finding nearby medicine to planning your perfect trip.
            </p>
            
            {/* Main CTA */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <Button asChild size="lg" className="gap-2 text-lg px-8 py-6 h-auto">
                <Link href="/chat">
                  <MessageSquare className="h-5 w-5" />
                  Start Chat
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </motion.div>

            {/* Example prompts */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="mt-8"
            >
              <p className="text-sm text-muted-foreground mb-3">Try asking:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {examples.map((example, i) => (
                  <Link key={i} href="/chat">
                    <Badge 
                      variant="outline" 
                      className="gap-1.5 py-2 px-3 cursor-pointer hover:bg-muted transition-colors"
                    >
                      <example.icon className="h-3.5 w-3.5" />
                      {example.text}
                    </Badge>
                  </Link>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">What I Can Do</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              One unified chat interface. Two powerful capabilities. Just ask naturally.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4">
                    <Pill className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-2xl">Find Medicine</CardTitle>
                  <CardDescription className="text-base">
                    Search pharmacies, check availability, and simulate reservation calls.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>✓ Real-time pharmacy search</li>
                    <li>✓ Stock availability checking</li>
                    <li>✓ Simulated phone calls with transcripts</li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4">
                    <Plane className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-2xl">Plan Travel</CardTitle>
                  <CardDescription className="text-base">
                    Create personalized itineraries with activities, dining, and costs.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>✓ Multi-day itinerary generation</li>
                    <li>✓ Budget-aware planning</li>
                    <li>✓ Iterative refinement</li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="text-center">
            <Button asChild size="lg" className="gap-2">
              <Link href="/chat">
                Start Chat <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="py-20 bg-slate-50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our system uses a multi-agent architecture to break down complex tasks
              and complete them step by step.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full text-center">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            Built for{' '}
            <a href="https://pokus.ai" className="text-primary hover:underline">
              Pokus.ai
            </a>{' '}
            Founding Engineer Assignment
          </p>
        </div>
      </footer>
    </div>
  );
}
