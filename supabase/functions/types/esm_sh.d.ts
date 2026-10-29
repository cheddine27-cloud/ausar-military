declare module 'https://esm.sh/@supabase/supabase-js@2.84.0' {
  export * from '@supabase/supabase-js';
}
// Deno globals for edge functions (tsc only — runtime is Deno Deploy)
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};
