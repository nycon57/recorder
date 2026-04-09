/**
 * Mock data for the Search Demo component
 */

export interface SearchResult {
  id: string;
  title: string;
  type: 'recording' | 'document' | 'transcript';
  matchScore: number;
  excerpt: string;
  highlightedTerms: string[];
  timestamp?: string;
  duration?: string;
  author: string;
  createdAt: string;
}

export interface SearchQuery {
  text: string;
  results: SearchResult[];
  totalCount: number;
  suggestions: string[];
}

export interface SearchDemoData {
  queries: SearchQuery[];
}

export const searchDemoData: SearchDemoData = {
  queries: [
    {
      text: 'How do we handle authentication?',
      totalCount: 12,
      results: [
        {
          id: '1',
          title: 'API Authentication Setup',
          type: 'recording',
          matchScore: 98,
          excerpt: '...we use JWT tokens for all API calls. The token is validated on every request through our middleware...',
          highlightedTerms: ['JWT tokens', 'API calls', 'authentication'],
          timestamp: '2:34',
          duration: '15:42',
          author: 'Sarah Chen',
          createdAt: '2 days ago',
        },
        {
          id: '2',
          title: 'Security Best Practices',
          type: 'recording',
          matchScore: 94,
          excerpt: '...the OAuth flow handles the authentication process. Users sign in with Google or email and receive a session cookie...',
          highlightedTerms: ['OAuth', 'authentication', 'session'],
          timestamp: '5:12',
          duration: '23:18',
          author: 'Marcus Johnson',
          createdAt: '1 week ago',
        },
        {
          id: '3',
          title: 'Auth Architecture Documentation',
          type: 'document',
          matchScore: 89,
          excerpt: '...the authentication layer sits between the client and API gateway, validating tokens before requests reach...',
          highlightedTerms: ['authentication layer', 'tokens', 'API gateway'],
          author: 'Engineering Team',
          createdAt: '3 weeks ago',
        },
      ],
      suggestions: ['JWT tokens', 'OAuth flow', 'session management', 'API security'],
    },
    {
      text: 'Deployment process for production',
      totalCount: 8,
      results: [
        {
          id: '4',
          title: 'Production Deployment Walkthrough',
          type: 'recording',
          matchScore: 96,
          excerpt: '...first we run the CI pipeline, then the staging tests, and finally deploy to production using Railway...',
          highlightedTerms: ['production', 'deploy', 'Railway'],
          timestamp: '1:15',
          duration: '12:30',
          author: 'David Park',
          createdAt: '5 days ago',
        },
        {
          id: '5',
          title: 'CI/CD Pipeline Configuration',
          type: 'document',
          matchScore: 91,
          excerpt: '...the deployment process is automated through GitHub Actions. Each push to main triggers...',
          highlightedTerms: ['deployment', 'GitHub Actions', 'automated'],
          author: 'DevOps Team',
          createdAt: '2 weeks ago',
        },
        {
          id: '6',
          title: 'Rollback Procedures',
          type: 'recording',
          matchScore: 85,
          excerpt: '...if the production deployment fails, we can quickly rollback using the Railway dashboard...',
          highlightedTerms: ['production', 'rollback', 'deployment'],
          timestamp: '8:45',
          duration: '18:22',
          author: 'Elena Rodriguez',
          createdAt: '1 month ago',
        },
      ],
      suggestions: ['Railway deployment', 'CI/CD pipeline', 'staging environment', 'rollback'],
    },
    {
      text: 'How to onboard new engineers',
      totalCount: 15,
      results: [
        {
          id: '7',
          title: 'New Engineer Onboarding Guide',
          type: 'recording',
          matchScore: 99,
          excerpt: '...welcome to the team! In this video I\'ll walk you through setting up your development environment...',
          highlightedTerms: ['onboarding', 'development environment', 'setup'],
          timestamp: '0:30',
          duration: '45:00',
          author: 'Alex Kim',
          createdAt: '1 week ago',
        },
        {
          id: '8',
          title: 'Codebase Architecture Overview',
          type: 'recording',
          matchScore: 92,
          excerpt: '...new engineers should understand our monorepo structure. We have the web app, worker process...',
          highlightedTerms: ['engineers', 'monorepo', 'architecture'],
          timestamp: '3:20',
          duration: '28:15',
          author: 'Rachel Adams',
          createdAt: '3 weeks ago',
        },
        {
          id: '9',
          title: 'First Week Checklist',
          type: 'document',
          matchScore: 88,
          excerpt: '...new team members should complete these tasks in their first week: dev setup, meet the team...',
          highlightedTerms: ['new', 'team members', 'first week'],
          author: 'HR Team',
          createdAt: '1 month ago',
        },
      ],
      suggestions: ['dev setup', 'team introductions', 'codebase tour', 'first PR'],
    },
  ],
};

// Helper to get a query by index
export function getQueryByIndex(index: number): SearchQuery {
  return searchDemoData.queries[index % searchDemoData.queries.length];
}

// Helper to get icon for content type
export function getTypeIcon(type: SearchResult['type']): string {
  switch (type) {
    case 'recording':
      return 'Video';
    case 'document':
      return 'FileText';
    case 'transcript':
      return 'Mic';
    default:
      return 'File';
  }
}

// Helper to format match score as percentage
export function formatMatchScore(score: number): string {
  return `${score}% match`;
}
