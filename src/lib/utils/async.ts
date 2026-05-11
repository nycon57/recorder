export function mapSequentially<T, R>(
  items: readonly T[],
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  return items.reduce<Promise<R[]>>(
    (chain, item, index) =>
      chain.then((results) =>
        task(item, index).then((result) => results.concat(result)),
      ),
    Promise.resolve([]),
  );
}

export function mapBatchesSequentially<T, R>(
  items: readonly T[],
  batchSize: number,
  task: (batch: T[], batchIndex: number) => Promise<R[]>,
): Promise<R[]> {
  const batchCount = Math.ceil(items.length / batchSize);
  const batches = Array.from({ length: batchCount }, (_, index) =>
    items.slice(index * batchSize, index * batchSize + batchSize),
  );

  return mapSequentially(batches, task).then((results) => results.flat());
}
