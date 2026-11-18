import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const TRANSIENT_NETWORK_ERROR_PATTERNS = [
    'failed to fetch',
    'networkerror',
    'load failed',
    'err_http2_server_refused_stream',
    'server_refused_stream',
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isTransientFetchError(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return TRANSIENT_NETWORK_ERROR_PATTERNS.some(pattern => message.includes(pattern));
}

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const maxAttempts = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fetch(input, init);
        } catch (error) {
            lastError = error;
            const shouldRetry = attempt < maxAttempts && isTransientFetchError(error);
            if (!shouldRetry) {
                throw error;
            }

            // Small exponential backoff to recover from transient HTTP/2 stream refusal.
            await sleep(200 * attempt);
        }
    }

    throw lastError;
}

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase URL or Anon Key. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase = createClient(
    supabaseUrl || '',
    supabaseAnonKey || '',
    {
        global: {
            fetch: fetchWithRetry,
        },
    }
);
