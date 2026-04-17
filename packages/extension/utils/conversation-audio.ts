type AudioContextLike = {
  state?: string;
  resume?: () => Promise<unknown> | unknown;
};

type AudioElementLike = {
  play?: () => Promise<unknown> | unknown;
};

type ConversationAudioOutputLike = {
  context?: AudioContextLike | null;
  audioElement?: AudioElementLike | null;
};

export type ConversationAudioLike = {
  output?: ConversationAudioOutputLike | null;
} | null;

export type AudioDocumentLike = {
  querySelectorAll?: (selector: string) => Iterable<AudioElementLike>;
} | null;

type PrimingScheduler = {
  setInterval: (callback: () => void, intervalMs: number) => unknown;
  clearInterval: (handle: unknown) => void;
};

function shouldResumeContext(
  context: AudioContextLike | null | undefined,
): boolean {
  if (!context || typeof context.resume !== 'function') return false;
  return context.state !== 'running' && context.state !== 'closed';
}

async function safelyInvoke(
  callback: (() => Promise<unknown> | unknown) | undefined,
): Promise<void> {
  if (typeof callback !== 'function') return;
  try {
    await callback();
  } catch {
    // Ignore autoplay and resume races; the priming window retries.
  }
}

function collectAudioElements(
  conversation: ConversationAudioLike,
  documentRoot: AudioDocumentLike,
): AudioElementLike[] {
  const unique = new Set<AudioElementLike>();
  const sdkAudio = conversation?.output?.audioElement;
  if (sdkAudio) {
    unique.add(sdkAudio);
  }

  if (documentRoot?.querySelectorAll) {
    for (const element of documentRoot.querySelectorAll('audio')) {
      unique.add(element);
    }
  }

  return Array.from(unique);
}

export async function primeConversationAudio(
  conversation: ConversationAudioLike,
  documentRoot: AudioDocumentLike,
): Promise<void> {
  const operations: Promise<void>[] = [];
  const context = conversation?.output?.context;

  if (shouldResumeContext(context)) {
    operations.push(safelyInvoke(() => context!.resume!()));
  }

  for (const audioElement of collectAudioElements(conversation, documentRoot)) {
    operations.push(safelyInvoke(audioElement.play));
  }

  await Promise.all(operations);
}

export function startConversationAudioPrimingWindow(args: {
  getConversation: () => ConversationAudioLike;
  documentRoot: AudioDocumentLike;
  attempts?: number;
  intervalMs?: number;
  scheduler?: PrimingScheduler;
}): () => void {
  const attempts = Math.max(1, args.attempts ?? 20);
  const intervalMs = Math.max(50, args.intervalMs ?? 250);
  const scheduler =
    args.scheduler ??
    ({
      setInterval: (callback: () => void, ms: number) =>
        setInterval(callback, ms),
      clearInterval: (handle: unknown) => clearInterval(handle as number),
    } satisfies PrimingScheduler);

  let runCount = 0;
  let stopped = false;
  let intervalHandle: unknown = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (intervalHandle !== null) {
      scheduler.clearInterval(intervalHandle);
      intervalHandle = null;
    }
  };

  const runPrime = () => {
    if (stopped) return;
    const conversation = args.getConversation();
    if (!conversation) {
      stop();
      return;
    }

    runCount += 1;
    void primeConversationAudio(conversation, args.documentRoot);

    if (runCount >= attempts) {
      stop();
    }
  };

  runPrime();

  if (!stopped && attempts > 1) {
    intervalHandle = scheduler.setInterval(runPrime, intervalMs);
  }

  return stop;
}
