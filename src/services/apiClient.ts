/**
 * Generic API Client with Supabase Authentication
 * Handles automatic token refresh and authenticated requests to external APIs
 */

import { supabase } from './supabaseClient';

/**
 * Get the current access token from Supabase session
 * Automatically refreshes if needed through Supabase SDK
 */
export async function getAccessToken(): Promise<string | null> {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Error getting session:', error);
        return null;
    }

    return session?.access_token ?? null;
}

/**
 * Refresh the current session manually
 * This is called when we receive a 401 from an external API
 */
export async function refreshSession(): Promise<string | null> {
    const { data: { session }, error } = await supabase.auth.refreshSession();

    if (error) {
        console.error('Error refreshing session:', error);
        return null;
    }

    return session?.access_token ?? null;
}

/**
 * Check if the current session is valid and not expired
 */
export async function isSessionValid(): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        return false;
    }

    // Check if token is expired
    const expiresAt = session.expires_at;
    if (!expiresAt) {
        return false;
    }

    const now = Math.floor(Date.now() / 1000);
    return now < expiresAt;
}

/**
 * Make an authenticated request to an external API
 * Automatically handles token refresh on 401 responses
 *
 * @param url - The full URL to request
 * @param options - Fetch options (method, body, headers, etc.)
 * @param retryOnUnauthorized - Whether to retry once with refreshed token on 401
 * @returns Parsed JSON response
 * @throws Error if request fails or authentication is invalid
 */
export async function makeAuthenticatedRequest<T>(
    url: string,
    options: RequestInit = {},
    retryOnUnauthorized: boolean = true
): Promise<T> {
    const token = await getAccessToken();

    if (!token) {
        throw new Error('No access token available. Please login again.');
    }

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
    };

    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });

        // If 401 and we haven't retried yet, try to refresh token and retry
        if (response.status === 401 && retryOnUnauthorized) {

            const newToken = await refreshSession();

            if (!newToken) {
                throw new Error('Failed to refresh session. Please login again.');
            }

            // Retry the request with the new token
            const retryHeaders: HeadersInit = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${newToken}`,
                ...options.headers,
            };

            const retryResponse = await fetch(url, {
                ...options,
                headers: retryHeaders,
            });

            if (!retryResponse.ok) {
                const errorText = await retryResponse.text();
                throw new Error(
                    `API request failed after token refresh: ${retryResponse.status} ${retryResponse.statusText}. ${errorText}`
                );
            }

            return retryResponse.json() as Promise<T>;
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `API request failed: ${response.status} ${response.statusText}. ${errorText}`
            );
        }

        return response.json() as Promise<T>;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`Network error: ${String(error)}`);
    }
}

/**
 * Make an authenticated GET request
 */
export async function get<T>(url: string, options?: RequestInit): Promise<T> {
    return makeAuthenticatedRequest<T>(url, {
        ...options,
        method: 'GET',
    });
}

/**
 * Make an authenticated POST request
 */
export async function post<T>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    return makeAuthenticatedRequest<T>(url, {
        ...options,
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
    });
}

/**
 * Make an authenticated PUT request
 */
export async function put<T>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    return makeAuthenticatedRequest<T>(url, {
        ...options,
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
    });
}

/**
 * Make an authenticated PATCH request
 */
export async function patch<T>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    return makeAuthenticatedRequest<T>(url, {
        ...options,
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
    });
}

/**
 * Make an authenticated DELETE request
 */
export async function del<T>(url: string, options?: RequestInit): Promise<T> {
    return makeAuthenticatedRequest<T>(url, {
        ...options,
        method: 'DELETE',
    });
}
