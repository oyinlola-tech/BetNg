// On a rejection no further item starts, the ones in flight are awaited, and the first error is rethrown:
// the caller never carries on while tasks it started are still running.
export async function mapWithConcurrency<TItem, TResult>(
  items: readonly TItem[],
  limit: number,
  task: (item: TItem) => Promise<TResult>,
): Promise<TResult[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("The concurrency limit is a positive whole number.");
  }

  const results = new Array<TResult>(items.length);
  let next = 0;
  let failure: { readonly error: unknown } | undefined;

  const worker = async (): Promise<void> => {
    while (failure === undefined && next < items.length) {
      const index = next;
      next += 1;

      try {
        results[index] = await task(items[index] as TItem);
      } catch (error) {
        failure ??= { error };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  if (failure !== undefined) {
    throw failure.error;
  }

  return results;
}

export function chunk<TItem>(items: readonly TItem[], size: number): TItem[][] {
  const chunks: TItem[][] = [];

  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }

  return chunks;
}
