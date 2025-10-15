'use client';

import { useRouter } from 'next/navigation';
import {
  Video,
  Upload,
  Search,
  MessageSquare,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';

/**
 * EmptyDashboard Component
 *
 * Welcoming dashboard for new users with no content
 * Highlights key features and provides clear onboarding steps
 */
export function EmptyDashboard() {
  const router = useRouter();

  const quickActions = [
    {
      icon: Video,
      title: 'Record Your Screen',
      description: 'Create your first recording with automatic transcription',
      action: () => router.push('/record'),
      buttonText: 'Start Recording',
      color: 'blue',
    },
    {
      icon: Upload,
      title: 'Upload Content',
      description: 'Import videos, audio, or documents to your library',
      action: () => router.push('/library'),
      buttonText: 'Upload Files',
      color: 'violet',
    },
    {
      icon: Search,
      title: 'Explore Search',
      description: 'Try our semantic search when you have content',
      action: () => router.push('/search'),
      buttonText: 'View Search',
      color: 'emerald',
    },
  ];

  const features = [
    {
      icon: Video,
      title: 'Record & Transcribe',
      description: 'Automatic speech-to-text for all your recordings',
    },
    {
      icon: MessageSquare,
      title: 'AI Assistant',
      description: 'Ask questions about your content with RAG-powered chat',
    },
    {
      icon: TrendingUp,
      title: 'Analytics',
      description: 'Track usage and insights across your knowledge base',
    },
    {
      icon: Zap,
      title: 'Smart Organization',
      description: 'Auto-tagging, semantic search, and powerful filters',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Welcome header */}
      <div className="text-center space-y-3 py-8">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to Record
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Your AI-powered knowledge management platform. Start by creating your first recording or uploading content.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {quickActions.map((action, index) => {
          const Icon = action.icon;
          const colorClasses = {
            blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
            violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
            emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
          }[action.color];

          return (
            <Card
              key={index}
              className="transition-all duration-200 hover:-translate-y-1 hover:shadow-lg cursor-pointer group"
              onClick={action.action}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className={`inline-flex items-center justify-center rounded-full p-4 ${colorClasses} group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200"
                  >
                    {action.buttonText}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Features overview */}
      <Card>
        <CardHeader>
          <CardTitle>What You Can Do</CardTitle>
          <CardDescription>
            Powerful features to help you manage and discover knowledge
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="flex gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors duration-200">
                  <div className="inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 flex-shrink-0">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{feature.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Getting started tips */}
      <Card className="border-dashed border-2">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 p-3">
              <Zap className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Pro Tip</h3>
              <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                All your recordings are automatically transcribed and searchable. You can ask the AI assistant questions about any content in your library using natural language.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
