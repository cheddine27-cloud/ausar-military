import { supabase } from '@/lib/supabase';
import { EnvValidator } from './EnvValidator';

export interface SystemHealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    database: { status: 'online' | 'offline'; latencyMs: number };
    configuration: { status: 'valid' | 'invalid'; missingKeys: string[] };
  };
}

export const SystemStatus = {
  /**
   * Generates a comprehensive system status health check report.
   */
  async getHealthReport(): Promise<SystemHealthReport> {
    const envCheck = EnvValidator.validate();
    
    // Measure Supabase latency
    const start = performance.now();
    let dbStatus: 'online' | 'offline' = 'online';
    let latencyMs = 0;

    try {
      const { error } = await supabase.from('institutions').select('id').limit(1);
      latencyMs = performance.now() - start;
      if (error) {
        dbStatus = 'offline';
      }
    } catch (e) {
      dbStatus = 'offline';
      latencyMs = performance.now() - start;
    }

    const isHealthy = envCheck.isValid && dbStatus === 'online';

    return {
      status: isHealthy ? 'healthy' : envCheck.isValid ? 'degraded' : 'unhealthy',
      version: '3.6.0',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus,
          latencyMs,
        },
        configuration: {
          status: envCheck.isValid ? 'valid' : 'invalid',
          missingKeys: envCheck.missingKeys,
        },
      },
    };
  }
};
