/**
 * Mock data for the Documentation Demo component
 */

export interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed';
  duration?: number; // seconds to complete (for animation)
}

export interface DocumentSection {
  type: 'heading' | 'paragraph' | 'list' | 'code';
  level?: 1 | 2 | 3; // for headings
  content: string;
  items?: string[]; // for lists
  language?: string; // for code blocks
}

export interface DocumentationDemoData {
  recording: {
    title: string;
    thumbnail: string; // CSS gradient placeholder
    duration: string;
    author: string;
    createdAt: string;
  };
  processingSteps: ProcessingStep[];
  document: {
    title: string;
    sections: DocumentSection[];
  };
  exportFormats: Array<{
    id: string;
    label: string;
    icon: string;
  }>;
}

export const documentationDemoData: DocumentationDemoData = {
  recording: {
    title: 'Setting up the Deployment Pipeline',
    thumbnail: 'linear-gradient(135deg, #03624c 0%, #00df82 100%)',
    duration: '15:32',
    author: 'Sarah Chen',
    createdAt: 'Today',
  },
  processingSteps: [
    { id: 'transcribe', label: 'Transcribed', status: 'completed', duration: 1.5 },
    { id: 'analyze', label: 'Analyzed', status: 'completed', duration: 2 },
    { id: 'generate', label: 'Generating', status: 'in_progress', duration: 3 },
  ],
  document: {
    title: 'Deployment Pipeline Setup Guide',
    sections: [
      {
        type: 'heading',
        level: 1,
        content: 'Deployment Pipeline',
      },
      {
        type: 'heading',
        level: 2,
        content: 'Overview',
      },
      {
        type: 'paragraph',
        content: 'This guide explains how to set up and configure the production deployment pipeline for our application using Railway and GitHub Actions.',
      },
      {
        type: 'heading',
        level: 2,
        content: 'Prerequisites',
      },
      {
        type: 'list',
        content: '',
        items: [
          'Access to the Railway dashboard',
          'GitHub repository write permissions',
          'Environment variables configured',
        ],
      },
      {
        type: 'heading',
        level: 2,
        content: 'Steps',
      },
      {
        type: 'list',
        content: '',
        items: [
          'Configure the Railway project settings',
          'Set up environment variables in Railway',
          'Create the GitHub Actions workflow file',
          'Test the deployment pipeline',
          'Monitor the first production deployment',
        ],
      },
      {
        type: 'heading',
        level: 2,
        content: 'Key Points',
      },
      {
        type: 'list',
        content: '',
        items: [
          'Always test changes in staging first',
          'Use environment-specific variables',
          'Enable automatic rollbacks for safety',
        ],
      },
      {
        type: 'heading',
        level: 2,
        content: 'Deployment Command',
      },
      {
        type: 'code',
        content: 'railway up --detach',
        language: 'bash',
      },
      {
        type: 'heading',
        level: 2,
        content: 'Verify Deployment',
      },
      {
        type: 'code',
        content: 'railway logs --latest',
        language: 'bash',
      },
    ],
  },
  exportFormats: [
    { id: 'markdown', label: 'Markdown', icon: 'FileText' },
    { id: 'notion', label: 'Notion', icon: 'ArrowUpRight' },
    { id: 'gdocs', label: 'Google Docs', icon: 'ArrowUpRight' },
    { id: 'pdf', label: 'PDF', icon: 'FileText' },
  ],
};

// Calculate progress percentage based on processing steps
export function getProcessingProgress(): number {
  const steps = documentationDemoData.processingSteps;
  const completed = steps.filter((s) => s.status === 'completed').length;
  const inProgress = steps.filter((s) => s.status === 'in_progress').length;
  return Math.round(((completed + inProgress * 0.5) / steps.length) * 100);
}

// Get step icon based on status
export function getStepIcon(status: ProcessingStep['status']): string {
  switch (status) {
    case 'completed':
      return 'Check';
    case 'in_progress':
      return 'Loader';
    case 'pending':
      return 'Circle';
    default:
      return 'Circle';
  }
}

// Simulate document reveal - returns sections to show based on progress
export function getSectionsToShow(progress: number): DocumentSection[] {
  const totalSections = documentationDemoData.document.sections.length;
  const sectionsToShow = Math.floor((progress / 100) * totalSections);
  return documentationDemoData.document.sections.slice(0, sectionsToShow);
}
