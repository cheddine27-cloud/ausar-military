/**
 * Ausar Military — Advanced Performance Tracing Utility
 */

export interface PerformanceMetric {
  name: string;
  durationMs: number;
  timestamp: string;
  success: boolean;
}

export const AuditPerformance = {
  private_metrics: [] as PerformanceMetric[],

  /**
   * Traces and measures execution duration of an asynchronous task.
   */
  async trace<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; durationMs: number; success: boolean }> {
    const start = performance.now();
    let success = true;
    try {
      const result = await operation();
      return { result, durationMs: performance.now() - start, success };
    } catch (e) {
      success = false;
      throw e;
    } finally {
      const durationMs = performance.now() - start;
      const metric: PerformanceMetric = {
        name,
        durationMs,
        timestamp: new Date().toISOString(),
        success,
      };
      this.private_metrics.push(metric);

      // Report slow operations (exceeding 800ms) to developers console
      if (durationMs > 800) {
        console.warn(`[Performance trace]: Slow operation detected - "${name}" took ${durationMs.toFixed(2)}ms`);
      }
    }
  },

  /**
   * Retrieves all trace metrics recorded during the current app session.
   */
  getMetrics(): PerformanceMetric[] {
    return this.private_metrics;
  },

  /**
   * Clears accumulated metrics.
   */
  clearMetrics(): void {
    this.private_metrics = [];
  }
};
