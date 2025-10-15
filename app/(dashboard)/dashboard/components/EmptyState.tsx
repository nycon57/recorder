'use client';

import {
  FolderOpen,
  ArrowRight,
  Video,
  Upload,
  FileEdit,
  Sparkles,
  Zap,
  Search,
  MessageSquare,
} from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';

interface EmptyStateProps {
  onRecordClick?: () => void;
  onUploadClick?: () => void;
}

export function EmptyState({ onRecordClick, onUploadClick }: EmptyStateProps) {
  return (
    <Card className="border-dashed border-2 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        {/* Icon */}
        <div className="relative mb-6">
          <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-6">
            <FolderOpen className="size-16 text-primary" />
          </div>
          {/* Sparkle decoration */}
          <div className="absolute -top-2 -right-2 animate-pulse">
            <Sparkles className="size-8 text-yellow-500 fill-yellow-500" />
          </div>
        </div>

        {/* Heading */}
        <h3 className="text-3xl font-bold mb-3">
          Welcome to Your Knowledge Hub
        </h3>

        <p className="text-muted-foreground text-lg mb-4 max-w-md">
          Start capturing, organizing, and discovering insights from all your content.
        </p>

        <p className="text-sm text-muted-foreground mb-8 max-w-lg">
          Record your screen, upload files, or create notes. Everything is automatically transcribed,
          searchable, and enhanced with AI.
        </p>

        {/* Primary Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mb-10">
          <Button
            size="lg"
            onClick={onRecordClick}
            className="gap-2 shadow-lg shadow-primary/20"
          >
            <Video className="size-5" />
            Start Recording
            <ArrowRight className="size-4 ml-1" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onUploadClick}
            className="gap-2"
          >
            <Upload className="size-5" />
            Upload Content
          </Button>
        </div>

        {/* Quick Start Guide */}
        <div className="w-full max-w-3xl">
          <h4 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
            What You Can Do
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col items-center text-center p-4 rounded-lg bg-background border">
              <div className="inline-flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 p-3 mb-3">
                <Video className="size-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h5 className="font-semibold text-sm mb-2">Record & Upload</h5>
              <p className="text-xs text-muted-foreground">
                Capture screen recordings or upload videos, audio files, and documents
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-4 rounded-lg bg-background border">
              <div className="inline-flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 p-3 mb-3">
                <Search className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h5 className="font-semibold text-sm mb-2">Smart Search</h5>
              <p className="text-xs text-muted-foreground">
                Find anything instantly with AI-powered semantic search across all content
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-4 rounded-lg bg-background border">
              <div className="inline-flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 p-3 mb-3">
                <MessageSquare className="size-6 text-green-600 dark:text-green-400" />
              </div>
              <h5 className="font-semibold text-sm mb-2">AI Assistant</h5>
              <p className="text-xs text-muted-foreground">
                Chat with your content and get instant answers from your knowledge base
              </p>
            </div>
          </div>
        </div>

        {/* Features List */}
        <div className="mt-8 pt-8 border-t w-full max-w-md">
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Zap className="size-3 text-yellow-600" />
              <span>Auto-transcription</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3 text-purple-600" />
              <span>AI summaries</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Search className="size-3 text-blue-600" />
              <span>Semantic search</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
