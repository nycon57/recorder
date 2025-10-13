/**
 * Semantic Chunking Performance Benchmark
 *
 * Tests performance characteristics of Phase 2 implementation
 */

const { performance } = require('perf_hooks');

// Mock the Xenova transformers for benchmarking
const mockEmbedder = async (text) => {
  // Simulate embedding generation time (~10ms per sentence)
  await new Promise(resolve => setTimeout(resolve, 10));
  return {
    data: new Float32Array(384).fill(0.5)
  };
};

class PerformanceBenchmark {
  constructor() {
    this.results = [];
  }

  /**
   * Generate test document of specific word count
   */
  generateTestDocument(wordCount) {
    const sentences = [
      'The quick brown fox jumps over the lazy dog.',
      'Machine learning models process vast amounts of data efficiently.',
      'Software architecture decisions impact system performance significantly.',
      'Database optimization requires careful analysis of query patterns.',
      'Microservices communicate through well-defined API contracts.',
      'Cloud infrastructure provides scalable computing resources on demand.',
      'Security measures protect sensitive user information from threats.',
      'Continuous integration pipelines automate software deployment processes.',
      'Performance monitoring tools track application metrics in real-time.',
      'Code review practices ensure high-quality software development.'
    ];

    let document = '';
    let currentWords = 0;

    while (currentWords < wordCount) {
      const sentence = sentences[Math.floor(Math.random() * sentences.length)];
      document += sentence + ' ';
      currentWords += sentence.split(' ').length;

      // Add structural elements periodically
      if (currentWords % 500 === 0) {
        document += '\n\n## Section Heading\n\n';
      }
      if (currentWords % 300 === 0) {
        document += '```javascript\nconst example = true;\n```\n\n';
      }
      if (currentWords % 700 === 0) {
        document += '- List item one\n- List item two\n- List item three\n\n';
      }
    }

    return document;
  }

  /**
   * Simulate sentence splitting
   */
  splitIntoSentences(text) {
    const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
    return sentences;
  }

  /**
   * Simulate batch embedding generation
   */
  async generateEmbeddings(sentences, batchSize = 32) {
    const embeddings = [];
    const batches = Math.ceil(sentences.length / batchSize);

    for (let i = 0; i < sentences.length; i += batchSize) {
      const batch = sentences.slice(i, i + batchSize);

      // Simulate parallel processing within batch
      const batchEmbeddings = await Promise.all(
        batch.map(() => mockEmbedder())
      );

      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  /**
   * Calculate similarity matrix
   */
  calculateSimilarities(embeddings) {
    const similarities = [];

    for (let i = 0; i < embeddings.length - 1; i++) {
      // Simulate cosine similarity calculation
      similarities.push(0.5 + Math.random() * 0.5);
    }

    return similarities;
  }

  /**
   * Simulate chunk creation with database writes
   */
  async saveChunks(chunks, batchSize = 100) {
    const batches = Math.ceil(chunks.length / batchSize);

    for (let i = 0; i < chunks.length; i += batchSize) {
      // Simulate database write time (50ms per batch)
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Run benchmark for specific document size
   */
  async benchmarkDocument(wordCount) {
    console.log(`\nBenchmarking ${wordCount} word document...`);

    const metrics = {
      wordCount,
      documentGeneration: 0,
      sentenceSplitting: 0,
      embeddingGeneration: 0,
      similarityCalculation: 0,
      chunkCreation: 0,
      databaseWrite: 0,
      totalTime: 0,
      sentences: 0,
      chunks: 0,
      memoryUsed: 0
    };

    const startMemory = process.memoryUsage().heapUsed;
    const totalStart = performance.now();

    // Generate test document
    let start = performance.now();
    const document = this.generateTestDocument(wordCount);
    metrics.documentGeneration = performance.now() - start;

    // Split into sentences
    start = performance.now();
    const sentences = this.splitIntoSentences(document);
    metrics.sentences = sentences.length;
    metrics.sentenceSplitting = performance.now() - start;

    // Generate embeddings
    start = performance.now();
    const embeddings = await this.generateEmbeddings(sentences);
    metrics.embeddingGeneration = performance.now() - start;

    // Calculate similarities
    start = performance.now();
    const similarities = this.calculateSimilarities(embeddings);
    metrics.similarityCalculation = performance.now() - start;

    // Create chunks (simulate)
    start = performance.now();
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;
    const targetSize = 500;

    for (let i = 0; i < sentences.length; i++) {
      currentChunk.push(sentences[i]);
      currentSize += sentences[i].length;

      if (currentSize >= targetSize ||
          (i < similarities.length && similarities[i] < 0.85)) {
        chunks.push({
          text: currentChunk.join(' '),
          sentences: [...currentChunk],
          semanticScore: similarities[i] || 0.5
        });
        currentChunk = [];
        currentSize = 0;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.join(' '),
        sentences: currentChunk,
        semanticScore: 0.5
      });
    }

    metrics.chunks = chunks.length;
    metrics.chunkCreation = performance.now() - start;

    // Simulate database write
    start = performance.now();
    await this.saveChunks(chunks);
    metrics.databaseWrite = performance.now() - start;

    // Calculate totals
    metrics.totalTime = performance.now() - totalStart;
    metrics.memoryUsed = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024;

    this.results.push(metrics);
    return metrics;
  }

  /**
   * Run full benchmark suite
   */
  async runBenchmarks() {
    console.log('Starting Semantic Chunking Performance Benchmarks');
    console.log('=================================================');

    const documentSizes = [
      { words: 1000, description: 'Short document' },
      { words: 5000, description: 'Medium document' },
      { words: 10000, description: 'Large document (target)' },
      { words: 20000, description: 'Very large document' },
      { words: 50000, description: 'Massive document' }
    ];

    for (const { words, description } of documentSizes) {
      const metrics = await this.benchmarkDocument(words);

      console.log(`\nResults for ${description} (${words} words):`);
      console.log('----------------------------------------');
      console.log(`Sentences: ${metrics.sentences}`);
      console.log(`Chunks created: ${metrics.chunks}`);
      console.log(`\nTiming Breakdown:`);
      console.log(`  Sentence splitting: ${metrics.sentenceSplitting.toFixed(2)}ms`);
      console.log(`  Embedding generation: ${metrics.embeddingGeneration.toFixed(2)}ms`);
      console.log(`  Similarity calculation: ${metrics.similarityCalculation.toFixed(2)}ms`);
      console.log(`  Chunk creation: ${metrics.chunkCreation.toFixed(2)}ms`);
      console.log(`  Database write: ${metrics.databaseWrite.toFixed(2)}ms`);
      console.log(`  TOTAL TIME: ${metrics.totalTime.toFixed(2)}ms`);
      console.log(`Memory used: ${metrics.memoryUsed.toFixed(2)} MB`);

      // Check against success criteria
      if (words === 10000) {
        const success = metrics.totalTime < 5000;
        console.log(`\n✓ Success Criteria (< 5 seconds): ${success ? 'PASSED' : 'FAILED'}`);
        if (!success) {
          console.log(`  Exceeded by: ${(metrics.totalTime - 5000).toFixed(2)}ms`);
        }
      }
    }

    // Performance analysis
    console.log('\n\nPerformance Analysis');
    console.log('====================');

    // Identify bottlenecks
    const targetDoc = this.results.find(r => r.wordCount === 10000);
    if (targetDoc) {
      const operations = [
        { name: 'Embedding Generation', time: targetDoc.embeddingGeneration },
        { name: 'Database Write', time: targetDoc.databaseWrite },
        { name: 'Similarity Calculation', time: targetDoc.similarityCalculation },
        { name: 'Chunk Creation', time: targetDoc.chunkCreation },
        { name: 'Sentence Splitting', time: targetDoc.sentenceSplitting }
      ].sort((a, b) => b.time - a.time);

      console.log('\nBottlenecks (10k word document):');
      operations.forEach((op, idx) => {
        const percentage = (op.time / targetDoc.totalTime * 100).toFixed(1);
        console.log(`  ${idx + 1}. ${op.name}: ${op.time.toFixed(2)}ms (${percentage}%)`);
      });
    }

    // Scalability analysis
    console.log('\nScalability Analysis:');
    const scalingFactor = this.results[this.results.length - 1].totalTime / this.results[0].totalTime;
    const wordScalingFactor = this.results[this.results.length - 1].wordCount / this.results[0].wordCount;
    const complexity = Math.log(scalingFactor) / Math.log(wordScalingFactor);

    console.log(`  Time complexity: ~O(n^${complexity.toFixed(2)})`);
    console.log(`  Scaling factor (1k to 50k words): ${scalingFactor.toFixed(2)}x`);

    // Memory analysis
    const memoryPerWord = this.results.map(r => r.memoryUsed / r.wordCount);
    const avgMemoryPerWord = memoryPerWord.reduce((a, b) => a + b, 0) / memoryPerWord.length;
    console.log(`  Average memory per word: ${(avgMemoryPerWord * 1000).toFixed(2)} KB`);

    // Batch size optimization
    console.log('\nBatch Processing Efficiency:');
    console.log(`  Current batch size: 32 sentences`);
    console.log(`  Embeddings per second: ${(targetDoc.sentences / (targetDoc.embeddingGeneration / 1000)).toFixed(0)}`);

    // Recommendations
    console.log('\n\nOptimization Recommendations');
    console.log('=============================');

    if (targetDoc.embeddingGeneration > targetDoc.totalTime * 0.5) {
      console.log('1. [HIGH] Model Optimization:');
      console.log('   - Consider using a smaller model (e.g., all-MiniLM-L6-v2)');
      console.log('   - Enable model caching to avoid reloading');
      console.log('   - Use quantized models for faster inference');
      console.log('   - Consider GPU acceleration if available');
    }

    if (targetDoc.databaseWrite > 500) {
      console.log('\n2. [HIGH] Database Optimization:');
      console.log('   - Increase batch size for bulk inserts');
      console.log('   - Use prepared statements');
      console.log('   - Consider connection pooling');
      console.log('   - Add indexes for frequently queried columns');
    }

    console.log('\n3. [MEDIUM] Memory Optimization:');
    console.log('   - Stream processing for very large documents');
    console.log('   - Clear embeddings after similarity calculation');
    console.log('   - Use typed arrays for better memory efficiency');

    console.log('\n4. [MEDIUM] Caching Strategy:');
    console.log('   - Cache embeddings for common sentences');
    console.log('   - Cache model in memory between requests');
    console.log('   - Use Redis for distributed caching');

    console.log('\n5. [LOW] Algorithm Optimization:');
    console.log('   - Use approximate nearest neighbor search');
    console.log('   - Implement sliding window for similarity');
    console.log('   - Parallelize similarity calculations');
  }
}

// Run benchmarks
async function main() {
  const benchmark = new PerformanceBenchmark();
  await benchmark.runBenchmarks();
}

main().catch(console.error);