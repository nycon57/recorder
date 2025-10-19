/**
 * Mock for fluent-ffmpeg package
 * Used in Jest tests to mock video processing
 */

interface FFmpegCommand {
  fps: jest.Mock;
  frames: jest.Mock;
  output: jest.Mock;
  outputOptions: jest.Mock;
  complexFilter: jest.Mock;
  on: jest.Mock;
  run: jest.Mock;
}

const mockFFmpegCommand: FFmpegCommand = {
  fps: jest.fn().mockReturnThis(),
  frames: jest.fn().mockReturnThis(),
  output: jest.fn().mockReturnThis(),
  outputOptions: jest.fn().mockReturnThis(),
  complexFilter: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  run: jest.fn().mockImplementation(function (this: FFmpegCommand) {
    // Simulate successful frame extraction
    const endCallback = (this.on as jest.Mock).mock.calls.find(
      (call) => call[0] === 'end'
    )?.[1];
    if (endCallback) {
      setTimeout(() => endCallback(), 10);
    }
    return this;
  }),
};

const mockFfmpeg = jest.fn(() => mockFFmpegCommand) as jest.Mock<FFmpegCommand, [], any> & {
  ffprobe: jest.Mock;
};

// Mock ffprobe
mockFfmpeg.ffprobe = jest.fn((videoPath: string, callback: Function) => {
  callback(null, {
    format: {
      duration: 60, // 60 seconds
    },
    streams: [
      {
        codec_type: 'video',
        width: 1920,
        height: 1080,
      },
    ],
  });
});

export default mockFfmpeg;

// Export mock instances for test manipulation
export const mockFFmpegInstance = mockFFmpegCommand;
