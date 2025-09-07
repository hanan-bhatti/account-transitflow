// File: managers/ApiManager.js

/**
 * Custom error class for API-related errors
 */
class ApiError extends Error {
    constructor(message, status = 500, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

/**
 * Simple LRU (Least Recently Used) cache implementation
 */
class LRUCache {
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        if (this.cache.has(key)) {
            // Move to end (most recently used)
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value);
            return value;
        }
        return undefined;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    get size() {
        return this.cache.size;
    }
}

/**
 * Advanced API Manager with improved error handling, caching, and retry logic
 */
class ApiManager {
    /**
     * @param {string} apiBase - Base URL for API requests
     * @param {Object} config - Configuration object
     * @param {Object} config.dashboard - Dashboard instance for integration
     * @param {number} config.cacheTimeout - Cache timeout in milliseconds (default: 5 minutes)
     * @param {number} config.maxRetries - Maximum number of retries (default: 3)
     * @param {number} config.timeout - Request timeout in milliseconds (default: 30 seconds)
     * @param {number} config.maxCacheSize - Maximum cache size (default: 100)
     * @param {boolean} config.enableCache - Enable/disable caching (default: true)
     * @param {boolean} config.debugMode - Enable debug logging (default: false)
     * @param {Function} config.toastHandler - Custom toast handler function
     */
    constructor(apiBase, config = {}) {
        this.apiBase = apiBase;
        this.dashboard = config.dashboard ?? null;
        this.config = {
            cacheTimeout: config.cacheTimeout ?? 5 * 60 * 1000, // 5 minutes
            maxRetries: config.maxRetries ?? 3,
            timeout: config.timeout ?? 30000, // 30 seconds
            maxCacheSize: config.maxCacheSize ?? 100,
            enableCache: config.enableCache ?? true,
            debugMode: config.debugMode ?? false,
            toastHandler: config.toastHandler ?? null
        };
        
        this.requestCache = this.config.enableCache ? new LRUCache(this.config.maxCacheSize) : null;
        this.isDestroyed = false;
        this.activeRequests = new Set();
        
        // Request/Response interceptors
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        
        this._debugLog('ApiManager initialized', { apiBase, config: this.config });
    }

    /**
     * Add a request interceptor
     * @param {Function} interceptor - Function that receives and can modify request config
     */
    addRequestInterceptor(interceptor) {
        if (typeof interceptor === 'function') {
            this.requestInterceptors.push(interceptor);
        }
    }

    /**
     * Add a response interceptor
     * @param {Function} interceptor - Function that receives and can modify response data
     */
    addResponseInterceptor(interceptor) {
        if (typeof interceptor === 'function') {
            this.responseInterceptors.push(interceptor);
        }
    }

    /**
     * Main method for making API requests
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @param {boolean} options.returnController - Return AbortController for cancellation
     * @returns {Promise<Object|{data: Object, controller: AbortController}>}
     */
    async makeRequest(endpoint, options = {}) {
        this._ensureNotDestroyed();
        
        const controller = new AbortController();
        this.activeRequests.add(controller);
        
        try {
            const result = await this._executeRequest(endpoint, options, controller);
            
            if (options.returnController) {
                return { data: result, controller };
            }
            
            return result;
        } finally {
            this.activeRequests.delete(controller);
        }
    }

    /**
     * Execute the actual request with caching, retries, and interceptors
     * @private
     */
    async _executeRequest(endpoint, options, controller) {
        const token = this.getAuthToken();
        const cacheKey = this._getCacheKey(endpoint, options);
        
        // Check cache for GET requests first
        if (this._shouldUseCache(options) && this.requestCache) {
            const cached = this._getCachedResponse(cacheKey);
            if (cached) {
                this._debugLog('Cache hit', { endpoint, cacheKey });
                return cached;
            }
        }

        // Prepare request config
        let requestConfig = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...options.headers
            },
            signal: controller.signal,
            ...options
        };

        // Apply request interceptors
        for (const interceptor of this.requestInterceptors) {
            try {
                requestConfig = await interceptor(requestConfig) ?? requestConfig;
            } catch (error) {
                this._debugLog('Request interceptor error', error);
            }
        }

        // Execute request with retry logic
        const response = await this._retryableFetch(endpoint, requestConfig, controller);
        let data = await this._parseResponse(response);

        // Apply response interceptors
        for (const interceptor of this.responseInterceptors) {
            try {
                data = await interceptor(data, response) ?? data;
            } catch (error) {
                this._debugLog('Response interceptor error', error);
            }
        }

        // Cache successful GET requests
        if (this._shouldUseCache(requestConfig) && this.requestCache) {
            this._setCachedResponse(cacheKey, data);
            this._debugLog('Response cached', { endpoint, cacheKey });
        }

        return data;
    }

    /**
     * Retryable fetch with exponential backoff
     * @private
     */
    async _retryableFetch(endpoint, config, controller) {
        const maxRetries = config.maxRetries ?? this.config.maxRetries;
        const timeout = config.timeout ?? this.config.timeout;
        
        let attempt = 0;
        let lastError;

        while (attempt < maxRetries) {
            try {
                this._debugLog(`Request attempt ${attempt + 1}`, { endpoint, method: config.method });
                
                // Create timeout signal
                const timeoutSignal = AbortSignal.timeout(timeout);
                const combinedSignal = this._combineAbortSignals([controller.signal, timeoutSignal]);
                
                const response = await fetch(`${this.apiBase}${endpoint}`, {
                    ...config,
                    signal: combinedSignal
                });

                if (!response.ok) {
                    const error = await this._createApiError(response);
                    
                    // Check if we should retry
                    if (attempt < maxRetries - 1 && this._shouldRetryStatus(response.status)) {
                        this._debugLog(`Retrying request (${response.status})`, { endpoint, attempt: attempt + 1 });
                        attempt++;
                        await this._delay(this._calculateBackoff(attempt));
                        continue;
                    }
                    
                    throw error;
                }

                this._debugLog('Request successful', { endpoint, status: response.status });
                return response;

            } catch (error) {
                lastError = error;

                // Don't retry on abort or certain errors
                if (attempt >= maxRetries - 1 || !this._shouldRetryError(error)) {
                    this._handleRequestError(error, endpoint);
                    throw error;
                }

                this._debugLog('Request error, retrying', { endpoint, error: error.message, attempt: attempt + 1 });
                attempt++;
                await this._delay(this._calculateBackoff(attempt));
            }
        }

        throw lastError;
    }

    /**
     * Combine multiple AbortSignals
     * @private
     */
    _combineAbortSignals(signals) {
        const controller = new AbortController();
        
        signals.forEach(signal => {
            if (signal?.aborted) {
                controller.abort();
            } else if (signal) {
                signal.addEventListener('abort', () => controller.abort());
            }
        });
        
        return controller.signal;
    }

    /**
     * Calculate exponential backoff delay
     * @private
     */
    _calculateBackoff(attempt) {
        const baseDelay = 1000; // 1 second
        const maxDelay = 30000; // 30 seconds
        const delay = baseDelay * Math.pow(2, attempt - 1);
        return Math.min(delay, maxDelay) + Math.random() * 1000; // Add jitter
    }

    /**
     * Parse response based on content type
     * @private
     */
    async _parseResponse(response) {
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
            return await response.json();
        } else if (contentType?.includes('text/')) {
            return await response.text();
        } else {
            return await response.blob();
        }
    }

    /**
     * Create ApiError from response
     * @private
     */
    async _createApiError(response) {
        let errorMessage = this._getGenericErrorMessage(response.status);
        let errorData = null;

        try {
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                errorData = await response.json();
                errorMessage = this._sanitizeErrorMessage(errorData);
            }
        } catch (parseError) {
            this._debugLog('Error parsing error response', parseError);
        }

        const error = new ApiError(errorMessage, response.status, this._sanitizeErrorData(errorData));
        
        if (response.status === 401) {
            this._handleAuthenticationError();
        }
        
        return error;
    }

    /**
     * Determine if request should use cache
     * @private
     */
    _shouldUseCache(options) {
        return this.config.enableCache && 
               options.useCache !== false && 
               (options.method === 'GET' || !options.method);
    }

    /**
     * Determine if status code should trigger a retry
     * @private
     */
    _shouldRetryStatus(status) {
        return status === 408 || status === 429 || status >= 500;
    }

    /**
     * Determine if error should trigger a retry
     * @private
     */
    _shouldRetryError(error) {
        return error.name !== 'AbortError' && 
               error.name !== 'TimeoutError' &&
               ![401, 403, 404].includes(error.status);
    }

    /**
     * Handle request errors and show appropriate toast messages
     * @private
     */
    _handleRequestError(error, endpoint) {
        const errorMappings = {
            AbortError: { type: 'warning', title: 'Request Cancelled', message: 'The request was cancelled.' },
            TimeoutError: { type: 'error', title: 'Request Timeout', message: 'The request took too long. Please try again.' },
            TypeError: { type: 'error', title: 'Connection Error', message: 'Unable to connect. Please check your network.' }
        };

        const statusMappings = {
            401: { type: 'error', title: 'Session Expired', message: 'Please log in again.' },
            403: { type: 'error', title: 'Access Denied', message: 'You do not have permission for this action.' },
            404: { type: 'error', title: 'Not Found', message: 'The requested resource was not found.' },
            429: { type: 'warning', title: 'Rate Limited', message: 'Too many requests. Please wait and try again.' },
            500: { type: 'error', title: 'Server Error', message: 'A server error occurred. Please try again later.' }
        };

        let toastConfig = errorMappings[error.name] || 
                         statusMappings[error.status] || 
                         { type: 'error', title: 'Error', message: 'An unexpected error occurred.' };

        // Special handling for 2FA requirements
        if (error.status === 403 && error.message?.toLowerCase().includes('2fa')) {
            toastConfig = { type: 'warning', title: 'Verification Required', message: 'Additional verification needed.' };
        }

        this._showToast(toastConfig.type, toastConfig.title, toastConfig.message);
        this._debugLog('Request error handled', { endpoint, error: error.message, status: error.status });
    }

    /**
     * Get authentication token with JWT validation
     * @returns {string|null}
     */
    getAuthToken() {
        try {
            const sources = [
                () => this._getStorageToken('localStorage'),
                () => this._getStorageToken('sessionStorage'),
                () => this._getCookieToken('token'),
                () => this._getCookieToken('authToken')
            ];

            for (const getToken of sources) {
                const token = getToken();
                if (token && this._validateToken(token)) {
                    return token;
                }
            }

            return null;
        } catch (error) {
            this._debugLog('Error getting auth token', error);
            this._clearAuthTokens();
            return null;
        }
    }

    /**
     * Get token from storage
     * @private
     */
    _getStorageToken(storageType) {
        try {
            const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
            if (typeof storage === 'undefined') return null;
            
            return storage.getItem('authToken') || storage.getItem('token');
        } catch (error) {
            this._debugLog(`Error accessing ${storageType}`, error);
            return null;
        }
    }

    /**
     * Get token from cookies with improved parsing
     * @private
     */
    _getCookieToken(name) {
        if (typeof document === 'undefined') return null;
        
        try {
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
                const [key, ...valueParts] = cookie.trim().split('=');
                if (key === name) {
                    return decodeURIComponent(valueParts.join('='));
                }
            }
        } catch (error) {
            this._debugLog('Error parsing cookies', error);
        }
        
        return null;
    }

    /**
     * Validate token format and JWT expiration
     * @private
     */
    _validateToken(token) {
        if (!token || typeof token !== 'string' || token.length < 10) {
            return false;
        }

        // Basic JWT validation
        if (token.includes('.')) {
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(atob(parts[1]));
                    const now = Math.floor(Date.now() / 1000);
                    
                    // Check expiration
                    if (payload.exp && payload.exp < now) {
                        this._debugLog('Token expired', { exp: payload.exp, now });
                        return false;
                    }
                }
            } catch (error) {
                this._debugLog('JWT validation error', error);
                return false;
            }
        }

        return true;
    }

    /**
     * Set authentication token
     * @param {string} token - JWT token
     * @param {string} storage - Storage type ('localStorage' or 'sessionStorage')
     */
    setAuthToken(token, storage = 'localStorage') {
        if (!this._validateToken(token)) {
            throw new ApiError('Invalid token format', 400);
        }

        try {
            const storageObj = storage === 'localStorage' ? localStorage : sessionStorage;
            if (typeof storageObj !== 'undefined') {
                storageObj.setItem('authToken', token);
                this._debugLog('Token stored', { storage });
            }
        } catch (error) {
            this._debugLog('Error storing token', error);
            throw new ApiError('Failed to store authentication token', 500);
        }
    }

    /**
     * Handle authentication errors
     * @private
     */
    _handleAuthenticationError() {
        this._clearAuthTokens();
        this._clearCache();
        
        if (this.dashboard?.authManager) {
            this.dashboard.authManager.handleLogout();
        }
    }

    /**
     * Clear all authentication tokens
     * @private
     */
    _clearAuthTokens() {
        const storageTypes = ['localStorage', 'sessionStorage'];
        const tokenKeys = ['authToken', 'token'];

        for (const storageType of storageTypes) {
            try {
                const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
                if (typeof storage !== 'undefined') {
                    for (const key of tokenKeys) {
                        storage.removeItem(key);
                    }
                }
            } catch (error) {
                this._debugLog(`Error clearing ${storageType}`, error);
            }
        }
    }

    /**
     * Batch GET requests
     * @param {Array<string>} endpoints - Array of endpoints
     * @param {Object} options - Common options for all requests
     * @returns {Promise<Array>}
     */
    async batchGet(endpoints, options = {}) {
        this._ensureNotDestroyed();
        
        const promises = endpoints.map(endpoint => 
            this.makeRequest(endpoint, { ...options, method: 'GET' })
                .catch(error => ({ error, endpoint }))
        );
        
        return await Promise.all(promises);
    }

    /**
     * Test server connectivity
     * @returns {Promise<boolean>}
     */
    async testServerConnectivity() {
        try {
            const response = await fetch(`${this.apiBase}/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(10000)
            });
            return response.ok;
        } catch (error) {
            this._debugLog('Connectivity test failed', error);
            return false;
        }
    }

    /**
     * Cancel all active requests
     */
    cancelAllRequests() {
        this.activeRequests.forEach(controller => {
            controller.abort();
        });
        this.activeRequests.clear();
        this._debugLog('All active requests cancelled');
    }

    /**
     * Clear cache
     */
    clearCache() {
        if (this.requestCache) {
            this.requestCache.clear();
            this._debugLog('Cache cleared');
        }
    }

    // Cache management methods

    /**
     * Generate cache key using stable hash
     * @private
     */
    _getCacheKey(endpoint, options) {
        const method = options.method || 'GET';
        const body = options.body ? JSON.stringify(options.body) : '';
        const key = `${method}:${endpoint}:${body}`;
        return this._stableHash(key);
    }

    /**
     * Stable hash function (simplified murmurhash)
     * @private
     */
    _stableHash(str) {
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        for (let i = 0, ch; i < str.length; i++) {
            ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
    }

    /**
     * Get cached response
     * @private
     */
    _getCachedResponse(key) {
        if (!this.requestCache) return null;
        
        const cached = this.requestCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
            return cached.data;
        }
        if (cached) {
            this.requestCache.delete(key);
        }
        return null;
    }

    /**
     * Set cached response
     * @private
     */
    _setCachedResponse(key, data) {
        if (!this.requestCache) return;
        
        this.requestCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    // Error handling and messaging

    /**
     * Show toast message
     * @private
     */
    _showToast(type, title, message) {
        if (this.config.toastHandler) {
            this.config.toastHandler(type, title, message);
        } else if (this.dashboard?.toastManager) {
            this.dashboard.toastManager.showToast(type, title, message);
        }
    }

    /**
     * Sanitize error message for user display
     * @private
     */
    _sanitizeErrorMessage(errorData) {
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
            const safeKeywords = ['validation', 'required', 'invalid', 'expired', 'not found'];
            if (safeKeywords.some(keyword => errorData.message.toLowerCase().includes(keyword))) {
                return errorData.message.substring(0, 200);
            }
        }

        return safeMessages.default;
    }

    /**
     * Sanitize error data
     * @private
     */
    _sanitizeErrorData(errorData) {
        if (!errorData || typeof errorData !== 'object') {
            return null;
        }

        const safeFields = ['message', 'code', 'field', 'details'];
        const sanitized = {};

        for (const field of safeFields) {
            if (errorData[field] && typeof errorData[field] === 'string') {
                sanitized[field] = errorData[field].substring(0, 200);
            }
        }

        return Object.keys(sanitized).length > 0 ? sanitized : null;
    }

    /**
     * Get generic error message for status code
     * @private
     */
    _getGenericErrorMessage(status) {
        const messages = {
            400: 'Invalid request',
            401: 'Authentication required',
            403: 'Access forbidden',
            404: 'Resource not found',
            408: 'Request timeout',
            429: 'Too many requests',
            500: 'Internal server error',
            502: 'Bad gateway',
            503: 'Service unavailable',
            504: 'Gateway timeout'
        };

        return messages[status] || 'An error occurred';
    }

    // Utility methods

    /**
     * Debug logging
     * @private
     */
    _debugLog(message, data = null) {
        if (this.config.debugMode) {
            const timestamp = new Date().toISOString();
            console.log(`[ApiManager ${timestamp}] ${message}`, data || '');
        }
    }

    /**
     * Delay utility
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Ensure manager is not destroyed
     * @private
     */
    _ensureNotDestroyed() {
        if (this.isDestroyed) {
            throw new ApiError('ApiManager has been destroyed', 500);
        }
    }

    /**
     * Cleanup method
     */
    destroy() {
        if (this.isDestroyed) return;
        
        this.cancelAllRequests();
        this.clearCache();
        
        this.requestCache = null;
        this.dashboard = null;
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        this.isDestroyed = true;
        
        this._debugLog('ApiManager destroyed');
    }
}

// Export classes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApiManager, ApiError, LRUCache };
} else if (typeof window !== 'undefined') {
    window.ApiManager = ApiManager;
    window.ApiError = ApiError;
    window.LRUCache = LRUCache;
}