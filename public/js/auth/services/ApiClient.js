// services/ApiClient.js
class ApiClient {
    constructor(config) {
        this.config = config;
        this.uiManager = null; // Will be injected
    }

    setUIManager(uiManager) {
        this.uiManager = uiManager;
    }

    async call(endpoint, method = 'GET', data = null, requiresAuth = false, retryCount = 0) {
        if (!navigator.onLine) {
            const error = new Error('No internet connection');
            error.type = 'NETWORK_ERROR';
            throw error;
        }

        const url = `${this.config.apiBaseUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            credentials: 'include'
        };

        if (requiresAuth && this.authToken) {
            options.headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
            options.body = JSON.stringify(data);
        }

        if (this.uiManager) {
            this.uiManager.showTopLoader();
        }

        try {
            const response = await fetch(url, options);
            const responseData = await this.parseResponse(response);

            if (!response.ok) {
                const error = this.createErrorFromResponse(response, responseData);
                console.error('API Error:', {
                    endpoint,
                    method,
                    status: error.status,
                    message: error.message,
                    details: error.details,
                    response: responseData
                });
                throw error;
            }

            return responseData;

        } catch (error) {
            if (this.shouldRetry(error, retryCount)) {
                console.warn(`Network error, retrying... (${retryCount + 1}/${this.config.maxRetries})`);
                await this.delay(this.config.retryDelay * (retryCount + 1));
                return this.call(endpoint, method, data, requiresAuth, retryCount + 1);
            }

            if (error.name === 'TypeError' || error.name === 'NetworkError' || !error.status) {
                error.message = 'Network error. Please check your connection and try again.';
                error.type = 'NETWORK_ERROR';
                error.retryCount = retryCount;
            }

            throw error;
        } finally {
            if (this.uiManager) {
                this.uiManager.hideTopLoader();
            }
        }
    }

    async parseResponse(response) {
        let responseData = null;
        const contentType = response.headers.get('content-type');
        
        try {
            if (contentType && contentType.includes('application/json')) {
                responseData = await response.json();
            } else {
                const text = await response.text();
                try {
                    responseData = JSON.parse(text);
                } catch {
                    responseData = {
                        success: false,
                        error: text || 'Server returned invalid response format'
                    };
                }
            }
        } catch (parseError) {
            responseData = {
                success: false,
                error: 'Invalid server response',
                message: 'Server returned malformed data',
                status: response.status,
                statusText: response.statusText
            };
        }

        return responseData;
    }

    createErrorFromResponse(response, responseData) {
        const error = new Error();
        error.message = responseData?.error ||
            responseData?.message ||
            responseData?.data?.message ||
            `HTTP ${response.status}: ${response.statusText}`;

        error.status = response.status;
        error.statusText = response.statusText;
        error.response = responseData;
        error.details = responseData?.data?.details || responseData?.details || [];
        error.field = responseData?.data?.field || responseData?.field;
        error.code = responseData?.code || responseData?.data?.code;
        error.timestamp = responseData?.timestamp;

        // Set error type based on status
        const errorTypes = {
            400: 'VALIDATION_ERROR',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            422: 'UNPROCESSABLE_ENTITY',
            423: 'LOCKED',
            429: 'RATE_LIMITED',
            500: 'SERVER_ERROR'
        };

        error.type = errorTypes[response.status] || 'HTTP_ERROR';

        if (response.status === 401) {
            this.authToken = null;
        }

        return error;
    }

    shouldRetry(error, retryCount) {
        return (error.name === 'TypeError' || error.name === 'NetworkError' || !error.status) &&
               retryCount < this.config.maxRetries;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getErrorMessage(error) {
        const errorMessages = {
            400: 'Invalid information provided. Please check your input.',
            401: 'Invalid credentials. Please check your email/username and password.',
            403: 'Account access denied. Please contact support if this continues.',
            404: 'Service not found. Please try again later.',
            409: 'This information is already registered. Please use different details.',
            422: 'The information provided is not valid. Please check and try again.',
            429: 'Too many attempts. Please wait a few minutes before trying again.',
            500: 'Server is temporarily unavailable. Please try again later.',
            502: 'Service temporarily unavailable. Please try again in a few moments.',
            503: 'Service is under maintenance. Please try again later.',
            504: 'Request timed out. Please check your connection and try again.'
        };

        if (!navigator.onLine) {
            return 'No internet connection. Please check your network.';
        }

        if (error.message && !error.message.startsWith('HTTP')) {
            return error.message;
        }

        return errorMessages[error.status] || 'An unexpected error occurred. Please try again.';
    }
}