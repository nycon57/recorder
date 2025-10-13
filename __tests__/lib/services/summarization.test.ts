import { generateRecordingSummary } from '@/lib/services/summarization';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getGoogleAI } from '@/lib/google/client';

// Mock dependencies
jest.mock('@/lib/supabase/admin');
jest.mock('@/lib/google/client');

describe('Summarization Service', () => {
  const mockRecordingId = 'test-recording-id';
  const mockOrgId = 'test-org-id';

  let mockSupabase: any;
  let mockGoogleAI: any;
  let mockModel: any;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn(),
    };
    (createAdminClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock Google AI
    mockModel = {
      generateContent: jest.fn(),
    };
    mockGoogleAI = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel),
    };
    (getGoogleAI as jest.Mock).mockReturnValue(mockGoogleAI);
  });

  describe('generateRecordingSummary', () => {
    it('should generate a summary successfully', async () => {
      // Mock database responses
      const mockRecording = {
        title: 'Test Recording',
        description: 'Test description',
        duration_sec: 120,
        metadata: {},
      };

      const mockTranscript = {
        text: 'This is a test transcript with some content. It discusses various topics and provides detailed information.',
        visual_events: [],
        video_metadata: {},
        provider: 'openai-whisper',
      };

      const mockDocument = {
        markdown: '# Test Document\n\nThis is a test document with structured content.',
      };

      // Setup Supabase mocks
      mockSupabase.from.mockImplementation((table: string) => {
        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        };

        if (table === 'recordings') {
          mockQuery.single.mockResolvedValue({ data: mockRecording, error: null });
        } else if (table === 'transcripts') {
          mockQuery.single.mockResolvedValue({ data: mockTranscript, error: null });
        } else if (table === 'documents') {
          mockQuery.single.mockResolvedValue({ data: mockDocument, error: null });
        }

        return mockQuery;
      });

      // Mock Gemini response
      const mockSummary = 'This is a comprehensive summary of the recording that covers all the key points discussed.';
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => mockSummary,
        },
      });

      // Execute
      const result = await generateRecordingSummary(mockRecordingId, mockOrgId);

      // Assertions
      expect(result).toHaveProperty('summaryText', mockSummary);
      expect(result).toHaveProperty('wordCount');
      expect(result).toHaveProperty('model');
      expect(result.wordCount).toBeGreaterThan(0);
      expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
    });

    it('should throw error if recording not found', async () => {
      // Mock recording not found
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Recording not found' },
        }),
      }));

      // Execute & Assert
      await expect(
        generateRecordingSummary(mockRecordingId, mockOrgId)
      ).rejects.toThrow('Failed to fetch recording');
    });

    it('should throw error if transcript not found', async () => {
      const mockRecording = {
        title: 'Test Recording',
        duration_sec: 120,
        metadata: {},
      };

      // Mock recording found but transcript not found
      mockSupabase.from.mockImplementation((table: string) => {
        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        };

        if (table === 'recordings') {
          mockQuery.single.mockResolvedValue({ data: mockRecording, error: null });
        } else if (table === 'transcripts') {
          mockQuery.single.mockResolvedValue({
            data: null,
            error: { message: 'Transcript not found' },
          });
        }

        return mockQuery;
      });

      // Execute & Assert
      await expect(
        generateRecordingSummary(mockRecordingId, mockOrgId)
      ).rejects.toThrow('Failed to fetch transcript');
    });

    it('should throw error if document not found', async () => {
      const mockRecording = {
        title: 'Test Recording',
        duration_sec: 120,
        metadata: {},
      };

      const mockTranscript = {
        text: 'Test transcript',
        visual_events: [],
        video_metadata: {},
        provider: 'openai-whisper',
      };

      // Mock recording and transcript found but document not found
      mockSupabase.from.mockImplementation((table: string) => {
        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        };

        if (table === 'recordings') {
          mockQuery.single.mockResolvedValue({ data: mockRecording, error: null });
        } else if (table === 'transcripts') {
          mockQuery.single.mockResolvedValue({ data: mockTranscript, error: null });
        } else if (table === 'documents') {
          mockQuery.single.mockResolvedValue({
            data: null,
            error: { message: 'Document not found' },
          });
        }

        return mockQuery;
      });

      // Execute & Assert
      await expect(
        generateRecordingSummary(mockRecordingId, mockOrgId)
      ).rejects.toThrow('Failed to fetch document');
    });

    it('should handle visual events in summary', async () => {
      const mockRecording = {
        title: 'Screen Recording Test',
        duration_sec: 300,
        metadata: {},
      };

      const mockTranscript = {
        text: 'This is a screen recording transcript.',
        visual_events: [
          { timestamp: 0, type: 'click', description: 'Clicked button' },
          { timestamp: 5, type: 'type', description: 'Typed text' },
          { timestamp: 10, type: 'scroll', description: 'Scrolled down' },
        ],
        video_metadata: {},
        provider: 'openai-whisper',
      };

      const mockDocument = {
        markdown: '# Screen Recording\n\nWith visual events.',
      };

      // Setup mocks
      mockSupabase.from.mockImplementation((table: string) => {
        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        };

        if (table === 'recordings') {
          mockQuery.single.mockResolvedValue({ data: mockRecording, error: null });
        } else if (table === 'transcripts') {
          mockQuery.single.mockResolvedValue({ data: mockTranscript, error: null });
        } else if (table === 'documents') {
          mockQuery.single.mockResolvedValue({ data: mockDocument, error: null });
        }

        return mockQuery;
      });

      const mockSummary = 'Summary with visual context included.';
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => mockSummary,
        },
      });

      // Execute
      const result = await generateRecordingSummary(mockRecordingId, mockOrgId);

      // Assert
      expect(result.summaryText).toBe(mockSummary);
      expect(mockModel.generateContent).toHaveBeenCalled();

      // Verify prompt includes visual events
      const callArgs = mockModel.generateContent.mock.calls[0][0];
      const promptText = callArgs.contents[0].parts[0].text;
      expect(promptText).toContain('Key Visual Events');
    });

    it('should throw error if Gemini returns empty summary', async () => {
      const mockRecording = {
        title: 'Test Recording',
        duration_sec: 120,
        metadata: {},
      };

      const mockTranscript = {
        text: 'Test transcript',
        visual_events: [],
        video_metadata: {},
        provider: 'openai-whisper',
      };

      const mockDocument = {
        markdown: '# Test',
      };

      mockSupabase.from.mockImplementation((table: string) => {
        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        };

        if (table === 'recordings') {
          mockQuery.single.mockResolvedValue({ data: mockRecording, error: null });
        } else if (table === 'transcripts') {
          mockQuery.single.mockResolvedValue({ data: mockTranscript, error: null });
        } else if (table === 'documents') {
          mockQuery.single.mockResolvedValue({ data: mockDocument, error: null });
        }

        return mockQuery;
      });

      // Mock empty response - need to override the default mock
      const emptyModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => '',
          },
        }),
      };
      mockGoogleAI.getGenerativeModel.mockReturnValue(emptyModel);

      // Execute & Assert
      await expect(
        generateRecordingSummary(mockRecordingId, mockOrgId)
      ).rejects.toThrow('Gemini returned empty or too short summary');
    });

    it('should calculate appropriate target word count', async () => {
      const mockRecording = {
        title: 'Test Recording',
        duration_sec: 600,
        metadata: {},
      };

      // Large content to test word count calculation
      const largeTranscript = {
        text: 'a'.repeat(5000),
        visual_events: [],
        video_metadata: {},
        provider: 'openai-whisper',
      };

      const largeDocument = {
        markdown: 'b'.repeat(5000),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        };

        if (table === 'recordings') {
          mockQuery.single.mockResolvedValue({ data: mockRecording, error: null });
        } else if (table === 'transcripts') {
          mockQuery.single.mockResolvedValue({ data: largeTranscript, error: null });
        } else if (table === 'documents') {
          mockQuery.single.mockResolvedValue({ data: largeDocument, error: null });
        }

        return mockQuery;
      });

      const mockSummary = 'Summary text here.';
      const largeContentModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => mockSummary,
          },
        }),
      };
      mockGoogleAI.getGenerativeModel.mockReturnValue(largeContentModel);

      // Execute
      await generateRecordingSummary(mockRecordingId, mockOrgId);

      // Verify target word count is capped at 1000
      const callArgs = largeContentModel.generateContent.mock.calls[0][0];
      const promptText = callArgs.contents[0].parts[0].text;
      expect(promptText).toContain('1000-word summary'); // Should be capped at max
    });
  });
});
