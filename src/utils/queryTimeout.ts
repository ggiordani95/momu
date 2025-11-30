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
  // Garantir que timeoutMs é um número positivo válido
  if (!timeoutMs || timeoutMs <= 0 || !isFinite(timeoutMs)) {
    timeoutMs = 30000; // Default para 30 segundos
  }

  let timeoutId: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(`Database query timeout after ${timeoutMs / 1000} seconds`)
      );
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([queryPromise, timeoutPromise]);
    // Limpar timeout se a query completou antes
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    return result;
  } catch (error) {
    // Limpar timeout em caso de erro
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    throw error;
  }
}
