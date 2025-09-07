// File: managers/ApiManager.js
class ApiManager {
    constructor(apiBase, dashboard = null) {
        this.apiBase = apiBase;
        this.dashboard = dashboard;
        this.requestCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.maxRetries = 3;
    }

    async makeRequest(endpoint, options = {}) {
        const token = this.getAuthToken();
        
        // Check cache for GET requests first
        const cacheKey = this.getCacheKey(endpoint, options);
        if (options.method !== 'POST' && options.method !== 'PUT' && options.method !== 'DELETE' && options.useCache !== false) {
            const cached = this.getCachedResponse(cacheKey);
            if (cached) {
                return cached;
            }
        }

        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...options.headers
            },
            credentials: 'include',
            ...options
        };

        // Remove sensitive data from config before processing
        const sanitizedConfig = { ...config };
        delete sanitizedConfig.headers?.Authorization;

        const timeoutMs = options.timeout || 30000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        let attempt = 0;
        const maxRetries = options.maxRetries || this.maxRetries;

        while (attempt < maxRetries) {
            try {
                const response = await fetch(`${this.apiBase}${endpoint}`, {
                    ...config,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const error = await this.handleErrorResponse(response);
                    
                    // Retry logic for certain status codes
                    if (attempt < maxRetries - 1 && this.shouldRetry(response.status)) {
                        attempt++;
                        await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
                        continue;
                    }
                    
                    throw error;
                }

                const data = await response.json();
                
                // Cache successful GET requests
                if ((config.method === 'GET' || !config.method) && options.useCache !== false) {
                    this.setCachedResponse(cacheKey, data);
                }
                
                return data;

            } catch (error) {
                clearTimeout(timeoutId);

                if (attempt >= maxRetries - 1) {
                    this.handleRequestError(error, endpoint);
                    throw error;
                }

                if (error.name === 'AbortError' || !this.shouldRetryError(error)) {
                    this.handleRequestError(error, endpoint);
                    throw error;
                }

                attempt++;
                await this.delay(Math.pow(2, attempt) * 1000);
            }
        }
    }

    async handleErrorResponse(response) {
        let errorMessage = 'Request failed';
        let errorData = null;

        try {
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                errorData = await response.json();
                // Sanitize error data to prevent information leakage
                errorMessage = this.sanitizeErrorMessage(errorData);
            } else {
                errorMessage = this.getGenericErrorMessage(response.status);
            }
        } catch (parseError) {
            errorMessage = this.getGenericErrorMessage(response.status);
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = this.sanitizeErrorData(errorData);
        
        if (response.status === 401) {
            this.handleAuthenticationError();
        }
        
        return error;
    }

    handleRequestError(error, endpoint) {
        // Map errors to user-friendly messages without exposing system details
        if (error.name === 'AbortError') {
            this.showToast('error', 'Request Timeout', 'The request took too long. Please try again.');
        } else if (error instanceof TypeError && error.message.includes('fetch')) {
            this.showToast('error', 'Connection Error', 'Unable to connect. Please check your network.');
        } else if (error.status === 401) {
            this.showToast('error', 'Session Expired', 'Please log in again.');
            this.handleAuthenticationError();
        } else if (error.status === 403) {
            if (error.message?.toLowerCase().includes('2fa') || error.message?.toLowerCase().includes('two-factor')) {
                this.showToast('warning', 'Verification Required', 'Additional verification needed.');
            } else {
                this.showToast('error', 'Access Denied', 'You do not have permission for this action.');
            }
        } else if (error.status === 404) {
            this.showToast('error', 'Not Found', 'The requested resource was not found.');
        } else if (error.status >= 500) {
            this.showToast('error', 'Service Error', 'A service error occurred. Please try again later.');
        } else {
            this.showToast('error', 'Error', 'An error occurred. Please try again.');
        }
    }

    shouldRetry(status) {
        // Retry on server errors and rate limiting, but not client errors
        return status >= 500 || status === 429;
    }

    shouldRetryError(error) {
        return error.name !== 'AbortError' && 
               !error.message?.includes('fetch') && 
               error.status !== 401 && 
               error.status !== 403 && 
               error.status !== 404;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async testServerConnectivity() {
        try {
            const response = await fetch(`${this.apiBase}/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(10000)
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    getAuthToken() {
        let token = null;

        try {
            // Check localStorage first
            if (typeof localStorage !== 'undefined') {
                token = localStorage.getItem('authToken') || localStorage.getItem('token');
                if (token) return this.validateToken(token);
            }

            // Check sessionStorage
            if (typeof sessionStorage !== 'undefined') {
                token = sessionStorage.getItem('authToken') || sessionStorage.getItem('token');
                if (token) return this.validateToken(token);
            }

            // Check cookies as fallback
            token = this.getCookie('token') || this.getCookie('authToken');
            if (token) return this.validateToken(token);

            return null;
        } catch (error) {
            // Clear potentially corrupted tokens
            this.clearAuthTokens();
            return null;
        }
    }

    validateToken(token) {
        // Basic token validation
        if (!token || typeof token !== 'string') {
            return null;
        }
        
        // Check if token format looks valid (basic checks)
        if (token.length < 10 || token.includes(' ')) {
            return null;
        }

        return token;
    }

    getCookie(name) {
        if (typeof document === 'undefined') return null;
        
        try {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) {
                return decodeURIComponent(parts.pop().split(';').shift());
            }
        } catch (error) {
            // Handle cookie parsing errors silently
        }
        return null;
    }

    handleAuthenticationError() {
        this.clearAuthTokens();
        this.clearCache();
        
        // Trigger authentication flow if available
        if (this.dashboard?.authManager) {
            this.dashboard.authManager.handleLogout();
        }
    }

    clearAuthTokens() {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('authToken');
                localStorage.removeItem('token');
            }
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem('authToken');
                sessionStorage.removeItem('token');
            }
        } catch (error) {
            // Silently handle storage errors
        }
    }

    showToast(type, title, message) {
        if (this.dashboard?.toastManager) {
            this.dashboard.toastManager.showToast(type, title, message);
        }
    }

    setAuthToken(token, storage = 'localStorage') {
        if (!this.validateToken(token)) {
            throw new Error('Invalid token format');
        }

        try {
            switch (storage) {
                case 'localStorage':
                    if (typeof localStorage !== 'undefined') {
                        localStorage.setItem('authToken', token);
                    }
                    break;
                case 'sessionStorage':
                    if (typeof sessionStorage !== 'undefined') {
                        sessionStorage.setItem('authToken', token);
                    }
                    break;
            }
        } catch (error) {
            throw new Error('Failed to store authentication token');
        }
    }

    // Cache management methods
    getCacheKey(endpoint, options) {
        const method = options.method || 'GET';
        const body = options.body ? JSON.stringify(options.body) : '';
        return `${method}:${endpoint}:${this.hashString(body)}`;
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }

    getCachedResponse(key) {
        const cached = this.requestCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        if (cached) {
            this.requestCache.delete(key);
        }
        return null;
    }

    setCachedResponse(key, data) {
        // Prevent cache from growing too large
        if (this.requestCache.size > 100) {
            const firstKey = this.requestCache.keys().next().value;
            this.requestCache.delete(firstKey);
        }
        
        this.requestCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.requestCache.clear();
    }

    // Security helper methods
    sanitizeErrorMessage(errorData) {
        // Return generic messages for security
        const safeMessages = {
            validation: 'Invalid input provided',
            authentication: 'Authentication failed',
            authorization: 'Access denied',
            server: 'Service temporarily unavailable',
            default: 'An error occurred'
        };

        if (errorData?.type && safeMessages[errorData.type]) {
            return safeMessages[errorData.type];
        }

        if (errorData?.message && typeof errorData.message === 'string') {
            // Only return safe, user-facing messages
            const safeKeywords = ['validation', 'required', 'invalid', 'expired', 'not found'];
            if (safeKeywords.some(keyword => errorData.message.toLowerCase().includes(keyword))) {
                return errorData.message.substring(0, 200); // Limit length
            }
        }

        return safeMessages.default;
    }

    sanitizeErrorData(errorData) {
        if (!errorData || typeof errorData !== 'object') {
            return null;
        }

        // Only return safe fields that don't expose system information
        const safeFields = ['message', 'code', 'field'];
        const sanitized = {};

        for (const field of safeFields) {
            if (errorData[field] && typeof errorData[field] === 'string') {
                sanitized[field] = errorData[field].substring(0, 200);
            }
        }

        return Object.keys(sanitized).length > 0 ? sanitized : null;
    }

    getGenericErrorMessage(status) {
        const messages = {
            400: 'Invalid request',
            401: 'Authentication required',
            403: 'Access forbidden',
            404: 'Resource not found',
            429: 'Too many requests',
            500: 'Service error',
            502: 'Service unavailable',
            503: 'Service unavailable',
            504: 'Request timeout'
        };

        return messages[status] || 'An error occurred';
    }

    // Cleanup method for when the manager is destroyed
    destroy() {
        this.clearCache();
        this.requestCache = null;
        this.dashboard = null;
    }
}