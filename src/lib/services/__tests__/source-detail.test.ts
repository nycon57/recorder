import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSourceDetailTimeline,
  resolvePreferredSourceKnowledgePage,
  supportsWorkflowExtraction,
} from '../source-detail';

test('supportsWorkflowExtraction is enabled only for recording and video sources', () => {
  assert.equal(supportsWorkflowExtraction('recording'), true);
  assert.equal(supportsWorkflowExtraction('video'), true);
  assert.equal(supportsWorkflowExtraction('audio'), false);
  assert.equal(supportsWorkflowExtraction('document'), false);
  assert.equal(supportsWorkflowExtraction('text'), false);
  assert.equal(supportsWorkflowExtraction(null), false);
});

test('buildSourceDetailTimeline tracks in-progress transcript and pending downstream stages', () => {
  const stages = buildSourceDetailTimeline({
    contentType: 'audio',
    status: 'transcribing',
    hasTranscript: false,
    hasDocument: false,
    hasWorkflow: false,
    hasKnowledgePage: false,
  });

  assert.deepEqual(
    stages.map((stage) => [stage.id, stage.state]),
    [
      ['upload', 'completed'],
      ['transcript', 'in_progress'],
      ['document', 'pending'],
      ['knowledge', 'pending'],
    ]
  );
});

test('buildSourceDetailTimeline marks every stage completed when artifacts are present', () => {
  const stages = buildSourceDetailTimeline({
    contentType: 'video',
    status: 'completed',
    hasTranscript: true,
    hasDocument: true,
    hasWorkflow: true,
    hasKnowledgePage: true,
  });

  assert.deepEqual(
    stages.map((stage) => [stage.id, stage.state]),
    [
      ['upload', 'completed'],
      ['transcript', 'completed'],
      ['document', 'completed'],
      ['workflow', 'completed'],
      ['knowledge', 'completed'],
    ]
  );
});

test('buildSourceDetailTimeline keeps compiled knowledge stage in progress after completion without linked page', () => {
  const stages = buildSourceDetailTimeline({
    contentType: 'document',
    status: 'completed',
    hasTranscript: true,
    hasDocument: true,
    hasWorkflow: false,
    hasKnowledgePage: false,
  });

  assert.deepEqual(
    stages.map((stage) => [stage.id, stage.state]),
    [
      ['upload', 'completed'],
      ['transcript', 'completed'],
      ['document', 'completed'],
      ['knowledge', 'in_progress'],
    ]
  );
});

test('buildSourceDetailTimeline marks downstream stages failed when processing errors after transcript', () => {
  const stages = buildSourceDetailTimeline({
    contentType: 'audio',
    status: 'error',
    hasTranscript: true,
    hasDocument: false,
    hasWorkflow: false,
    hasKnowledgePage: false,
  });

  assert.deepEqual(
    stages.map((stage) => [stage.id, stage.state]),
    [
      ['upload', 'completed'],
      ['transcript', 'completed'],
      ['document', 'failed'],
      ['knowledge', 'failed'],
    ]
  );
});

test('resolvePreferredSourceKnowledgePage prefers active pages and then latest update time', () => {
  const selected = resolvePreferredSourceKnowledgePage([
    {
      id: 'superseded-recent',
      topic: 'Superseded Page',
      app: 'hubspot',
      screen: 'contact',
      confidence: 0.72,
      compilation_log: null,
      valid_until: '2026-04-10T10:00:00.000Z',
      updated_at: '2026-04-12T12:00:00.000Z',
    },
    {
      id: 'active-older',
      topic: 'Active Older',
      app: 'hubspot',
      screen: 'contact',
      confidence: 0.8,
      compilation_log: null,
      valid_until: null,
      updated_at: '2026-04-09T12:00:00.000Z',
    },
    {
      id: 'active-newer',
      topic: 'Active Newer',
      app: 'hubspot',
      screen: 'contact',
      confidence: 0.84,
      compilation_log: null,
      valid_until: null,
      updated_at: '2026-04-11T12:00:00.000Z',
    },
  ]);

  assert.equal(selected?.id, 'active-newer');
});

test('resolvePreferredSourceKnowledgePage falls back to latest superseded page when no active page exists', () => {
  const selected = resolvePreferredSourceKnowledgePage([
    {
      id: 'superseded-older',
      topic: 'Old',
      app: null,
      screen: null,
      confidence: 0.55,
      compilation_log: null,
      valid_until: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T00:00:00.000Z',
    },
    {
      id: 'superseded-newer',
      topic: 'New',
      app: null,
      screen: null,
      confidence: 0.58,
      compilation_log: null,
      valid_until: '2026-04-02T00:00:00.000Z',
      updated_at: '2026-04-03T00:00:00.000Z',
    },
  ]);

  assert.equal(selected?.id, 'superseded-newer');
});
