/**
 * Wraps a database query with a timeout
 * @param queryPromise The database query promise
 * @param timeoutMs Timeout in milliseconds (default: 30000 = 30 seconds)
 * @returns The query result or throws timeout error
 */
export async function withTimeout<T>(
  queryPromise: Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(`Database query timeout after ${timeoutMs / 1000} seconds`)
        ),
      timeoutMs
    )
  );

  return Promise.race([queryPromise, timeoutPromise]);
}
