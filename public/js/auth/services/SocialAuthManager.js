// services/SocialAuthManager.js
class SocialAuthManager {
    constructor(config = {}) {
        this.config = {
            apiBbaseUrl_social: 'https://api-auth.transitflow.qzz.io/api/users',
            frontendBaseUrl: 'https://account.transitflow.qzz.io',
            popupWidth: 500,
            popupHeight: 600,
            popupTimeout: 300000, // 5 minutes
            pollInterval: 1000,
            maxRetries: 3,
            retryDelay: 1500,
            ...config
        };

        this.authManager = null;
        this.uiManager = null;
        this.networkManager = null;
        this.popupWindow = null;
        this.pollTimer = null;
        this.currentProvider = null;
        this.retryCount = 0;
        
        this.supportedProviders = ['google', 'facebook', 'apple', 'github', 'twitter', 'linkedin'];
        this.providerConfig = {
            google: {
                name: 'Google',
                color: '#db4437',
                icon: 'bxl-google'
            },
            facebook: {
                name: 'Facebook',
                color: '#4267B2',
                icon: 'bxl-facebook'
            },
            apple: {
                name: 'Apple',
                color: '#000000',
                icon: 'bxl-apple'
            },
            github: {
                name: 'GitHub',
                color: '#333333',
                icon: 'bxl-github'
            },
            twitter: {
                name: 'Twitter',
                color: '#1DA1F2',
                icon: 'bxl-twitter'
            },
            linkedin: {
                name: 'LinkedIn',
                color: '#0077B5',
                icon: 'bxl-linkedin'
            }
        };
    }

    // Initialization method
    initialize(authManager, uiManager, networkManager) {
        this.authManager = authManager;
        this.uiManager = uiManager;
        this.networkManager = networkManager;
        
        // Bind methods to preserve context
        this.handleLogin = this.handleLogin.bind(this);
        this.handlePopupMessage = this.handlePopupMessage.bind(this);
        
        this.setupEventListeners();
        this.handleUrlParameters();
        
        console.log('SocialAuthManager initialized successfully');
    }

    // Setup event listeners for social login buttons
    setupEventListeners() {
        // Listen for postMessage from OAuth popup
        window.addEventListener('message', this.handlePopupMessage);

        // Setup social login buttons
        this.supportedProviders.forEach(provider => {
            const button = document.getElementById(`${provider}-login`);
            if (button) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleLogin(provider);
                });
            }
        });

        // Handle page unload to cleanup popup
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Handle visibility change (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.popupWindow) {
                // User switched tabs, show a toast reminder
                setTimeout(() => {
                    if (this.popupWindow && !this.popupWindow.closed) {
                        this.uiManager?.showToast(
                            'Please complete the authentication in the popup window',
                            'info'
                        );
                    }
                }, 2000);
            }
        });
    }

    // Handle URL parameters for OAuth error redirects
    handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const code = urlParams.get('code');

        if (error) {
            setTimeout(() => {
                this.handleUrlError(error);
                this.cleanupUrl();
            }, 500);
        } else if (code) {
            // URL callback should not happen with popup flow, but handle gracefully
            setTimeout(() => {
                this.uiManager?.showToast('Login completed successfully!', 'success');
                this.cleanupUrl();
            }, 500);
        }
    }

    // Main social login handler
    async handleLogin(provider, options = {}) {
        if (!this.validateProvider(provider)) {
            return;
        }

        if (!this.networkManager?.isOnline) {
            this.uiManager?.showToast(
                'No internet connection. Please check your network and try again.',
                'error'
            );
            return;
        }

        try {
            this.currentProvider = provider;
            this.retryCount = 0;

            // Show loading state
            this.setButtonLoading(provider, true);
            this.uiManager?.showToast(
                `Connecting to ${this.getProviderName(provider)}...`,
                'info'
            );

            // Get OAuth URL from backend
            const authData = await this.getOAuthUrl(provider, options.redirectUri);

            if (!authData.authUrl) {
                throw new Error('Failed to get OAuth URL from server');
            }

            // Open popup and start authentication flow
            await this.openPopupAndAuthenticate(authData.authUrl);

        } catch (error) {
            console.error(`${provider} login error:`, error);
            this.handleSocialError(error, provider);
        } finally {
            this.setButtonLoading(provider, false);
        }
    }

    // Get OAuth URL from backend (login only)
    async getOAuthUrl(provider, redirectUri = null) {
        const params = new URLSearchParams();
        
        // Always set action to login (default behavior)
        params.append('action', 'login');
        
        if (redirectUri) {
            params.append('redirect_uri', redirectUri);
        }

        const queryString = params.toString() ? '?' + params.toString() : '';
        const url = `${this.config.apiBbaseUrl_social}/social/${provider}${queryString}`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await this.parseErrorResponse(response);
                throw new Error(errorData.message || errorData.error || `Failed to get ${provider} OAuth URL`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || data.error || 'Failed to get OAuth URL');
            }

            return data.data;

        } catch (error) {
            if (this.shouldRetry(error)) {
                return await this.retryWithBackoff(() => this.getOAuthUrl(provider, redirectUri));
            }
            throw error;
        }
    }

    // Open popup and handle authentication flow
    async openPopupAndAuthenticate(authUrl) {
        return new Promise((resolve, reject) => {
            try {
                // Calculate popup position (center of screen)
                const left = Math.max(0, (screen.width - this.config.popupWidth) / 2);
                const top = Math.max(0, (screen.height - this.config.popupHeight) / 2);

                const popupFeatures = [
                    `width=${this.config.popupWidth}`,
                    `height=${this.config.popupHeight}`,
                    `left=${left}`,
                    `top=${top}`,
                    'scrollbars=yes',
                    'resizable=yes',
                    'toolbar=no',
                    'location=no',
                    'directories=no',
                    'status=no',
                    'menubar=no'
                ].join(',');

                // Open popup
                this.popupWindow = window.open(authUrl, 'oauth_popup', popupFeatures);

                if (!this.popupWindow) {
                    throw new Error('Popup blocked. Please allow popups for this site and try again.');
                }

                // Focus the popup
                if (this.popupWindow.focus) {
                    this.popupWindow.focus();
                }

                // Set timeout for authentication
                const timeout = setTimeout(() => {
                    this.cleanup();
                    reject(new Error('Authentication timed out. Please try again.'));
                }, this.config.popupTimeout);

                // Store resolve/reject for message handler
                this.authPromise = { resolve, reject, timeout };

                // Start polling for popup closure
                this.startPopupPolling();

            } catch (error) {
                reject(error);
            }
        });
    }

    // Start polling for popup window closure
    startPopupPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
        }

        this.pollTimer = setInterval(() => {
            if (!this.popupWindow || this.popupWindow.closed) {
                this.handlePopupClosure();
            }
        }, this.config.pollInterval);
    }

    // Handle popup window closure (user cancelled)
    handlePopupClosure() {
        this.cleanup();
        
        if (this.authPromise) {
            this.authPromise.reject(new Error('Authentication cancelled by user'));
            this.authPromise = null;
        }

        this.uiManager?.showToast('Authentication cancelled', 'warning');
    }

    // Handle messages from popup window (postMessage API)
    handlePopupMessage(event) {
        // Verify origin for security
        const allowedOrigins = [
            'https://api-auth.transitflow.qzz.io',
            'https://account.transitflow.qzz.io',
            'https://chatwoot-production-5a33.up.railway.app'
        ];

        if (!allowedOrigins.includes(event.origin)) {
            console.warn('Received message from unauthorized origin:', event.origin);
            return;
        }

        if (!this.authPromise) {
            return;
        }

        const data = event.data;

        // Handle different message types from the unified OAuth flow
        if (data.type === 'social-auth-success' && data.action === 'login') {
            this.handleLoginSuccess(data);
        } else if (data.type === 'social-auth-error') {
            this.handleOAuthError(data.error, data.provider, data.errorCode);
        }
    }

    // Handle successful OAuth login
    async handleLoginSuccess(data) {
        try {
            this.cleanup();

            // The actual redirect happens in the popup, but we can show success message
            this.uiManager?.showToast(
                `Successfully logged in with ${this.getProviderName(data.provider)}!`,
                'success'
            );

            // Emit event for successful login
            this.emitEvent('loginSuccess', {
                provider: data.provider,
                message: data.message,
                loginMethod: 'social'
            });

            if (this.authPromise) {
                this.authPromise.resolve(data);
                this.authPromise = null;
            }

            // Close popup and redirect parent window
            setTimeout(() => {
                window.location.href = `${this.config.frontendBaseUrl}/dashboard`;
            }, 1500);

        } catch (error) {
            console.error('Error handling OAuth success:', error);
            this.handleSocialError(error, data.provider);
        }
    }

    // Handle OAuth errors with detailed error mapping
    handleOAuthError(error, provider, errorCode = null) {
        const errorMessages = {
            'OAUTH_PROVIDER_ERROR': `${this.getProviderName(provider)} access was denied or failed. Please try again.`,
            'MISSING_AUTH_CODE': `Authentication with ${this.getProviderName(provider)} failed. Please try again.`,
            'EMAIL_REQUIRED': `${this.getProviderName(provider)} must provide an email address to continue.`,
            'STATE_EXPIRED': 'Authentication session expired. Please try again.',
            'INVALID_STATE_ACTION': 'Security validation failed. Please try again.',
            'TOKEN_EXCHANGE_FAILED': `Failed to authenticate with ${this.getProviderName(provider)}. Please try again.`,
            'USER_INFO_FETCH_FAILED': `Failed to get your information from ${this.getProviderName(provider)}. Please try again.`,
            'PROVIDER_NOT_CONFIGURED': `${this.getProviderName(provider)} login is not available right now. Please try another method.`,
            'INVALID_REDIRECT_DOMAIN': 'Security error occurred. Please contact support.',
            'AUTHENTICATION_REQUIRED': 'You must be logged in to perform this action.',
            'INVALID_TOKEN': 'Your session has expired. Please login again.',
            'ACCOUNT_ALREADY_LINKED': 'This social account is already linked to another user.',
            'PROVIDER_ALREADY_LINKED': 'You already have this provider linked to your account.',
            'USER_NOT_FOUND': 'User account not found. Please contact support.',
            'INTERNAL_SERVER_ERROR': 'Server error occurred. Please try again later.',
            'NETWORK_ERROR': 'Network connection failed. Please check your internet and try again.',
            'TIMEOUT': 'Authentication timed out. Please try again.',
            'POPUP_BLOCKED': 'Popup was blocked. Please allow popups for this site and try again.',
            'CANCELLED': 'Authentication was cancelled.'
        };

        // Map generic errors
        const genericErrors = {
            'oauth_denied': 'OAUTH_PROVIDER_ERROR',
            'oauth_failed': 'TOKEN_EXCHANGE_FAILED',
            'account_disabled': 'INTERNAL_SERVER_ERROR',
            'rate_limited': 'INTERNAL_SERVER_ERROR',
            'server_error': 'INTERNAL_SERVER_ERROR',
            'network_error': 'NETWORK_ERROR',
            'popup_blocked': 'POPUP_BLOCKED',
            'timeout': 'TIMEOUT',
            'cancelled': 'CANCELLED',
            'invalid_provider': 'PROVIDER_NOT_CONFIGURED'
        };

        const mappedErrorCode = genericErrors[error] || errorCode || error;
        const message = errorMessages[mappedErrorCode] || errorMessages['TOKEN_EXCHANGE_FAILED'];
        const type = ['INTERNAL_SERVER_ERROR', 'PROVIDER_NOT_CONFIGURED'].includes(mappedErrorCode) ? 'error' : 'warning';

        this.cleanup();
        this.uiManager?.showToast(message, type);

        if (this.authPromise) {
            this.authPromise.reject(new Error(message));
            this.authPromise = null;
        }

        // Emit error event
        this.emitEvent('authError', {
            error: mappedErrorCode,
            provider,
            message
        });

        // Log error for debugging
        console.error('OAuth Error:', {
            originalError: error,
            errorCode,
            mappedErrorCode,
            provider,
            message
        });
    }

    // Handle URL-based errors (fallback)
    handleUrlError(error) {
        const errorMessages = {
            'access_denied': 'Access was denied. Please try again and allow access to continue.',
            'invalid_request': 'Invalid authentication request. Please try again.',
            'unauthorized': 'Authentication failed. Please try again.',
            'server_error': 'Server error occurred. Please try again later.'
        };

        const message = errorMessages[error] || 'Authentication failed. Please try again.';
        this.uiManager?.showToast(message, 'error');
    }

    // Handle general social authentication errors
    handleSocialError(error, provider) {
        console.error(`Social auth error (${provider}):`, error);

        let errorType = 'TOKEN_EXCHANGE_FAILED';
        
        // Map specific errors
        if (error.message.includes('popup') || error.message.includes('blocked')) {
            errorType = 'POPUP_BLOCKED';
        } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
            errorType = 'TIMEOUT';
        } else if (error.message.includes('cancelled')) {
            errorType = 'CANCELLED';
        } else if (error.message.includes('network') || error.name === 'NetworkError') {
            errorType = 'NETWORK_ERROR';
        } else if (error.message.includes('not configured') || error.message.includes('not available')) {
            errorType = 'PROVIDER_NOT_CONFIGURED';
        }

        this.handleOAuthError(errorType, provider);
    }

    // Parse error response from fetch
    async parseErrorResponse(response) {
        try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                const text = await response.text();
                return { message: text || 'Unknown error occurred' };
            }
        } catch (parseError) {
            return { 
                message: `HTTP ${response.status}: ${response.statusText}`,
                status: response.status 
            };
        }
    }

    // Utility methods
    validateProvider(provider) {
        if (!this.supportedProviders.includes(provider)) {
            this.uiManager?.showToast(`${provider} is not a supported login provider`, 'error');
            return false;
        }
        return true;
    }

    getProviderName(provider) {
        return this.providerConfig[provider]?.name || provider.charAt(0).toUpperCase() + provider.slice(1);
    }

    setButtonLoading(provider, isLoading) {
        const button = document.getElementById(`${provider}-login`);
        
        if (!button) return;

        if (isLoading) {
            button.disabled = true;
            button.setAttribute('data-original-text', button.textContent);
            button.setAttribute('data-original-html', button.innerHTML);
            const providerName = this.getProviderName(provider);
            button.innerHTML = `<i class="bx bx-loader-alt bx-spin"></i> Connecting to ${providerName}...`;
            button.classList.add('loading');
        } else {
            button.disabled = false;
            const originalHtml = button.getAttribute('data-original-html');
            if (originalHtml) {
                button.innerHTML = originalHtml;
                button.removeAttribute('data-original-text');
                button.removeAttribute('data-original-html');
            }
            button.classList.remove('loading');
        }
    }

    // Check if error should trigger a retry
    shouldRetry(error) {
        if (this.retryCount >= this.config.maxRetries) {
            return false;
        }

        const retryableErrors = [
            'NetworkError',
            'TypeError',
            'NETWORK_ERROR',
            'TIMEOUT'
        ];

        return retryableErrors.some(retryError => 
            error.name === retryError || 
            error.type === retryError || 
            error.message.toLowerCase().includes(retryError.toLowerCase()) ||
            error.message.includes('fetch')
        );
    }

    // Retry with exponential backoff
    async retryWithBackoff(operation) {
        this.retryCount++;
        const delay = this.config.retryDelay * Math.pow(2, this.retryCount - 1);
        
        this.uiManager?.showToast(
            `Connection failed. Retrying in ${Math.round(delay / 1000)} seconds... (${this.retryCount}/${this.config.maxRetries})`,
            'warning'
        );

        await new Promise(resolve => setTimeout(resolve, delay));
        return await operation();
    }

    // Event emission system for integration
    emitEvent(eventName, data) {
        const event = new CustomEvent(`socialAuth:${eventName}`, {
            detail: { ...data, timestamp: Date.now() }
        });
        document.dispatchEvent(event);
    }

    // Cleanup resources
    cleanup() {
        if (this.popupWindow && !this.popupWindow.closed) {
            try {
                this.popupWindow.close();
            } catch (e) {
                // Popup might already be closed or inaccessible
            }
        }
        
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }

        if (this.authPromise && this.authPromise.timeout) {
            clearTimeout(this.authPromise.timeout);
        }

        this.popupWindow = null;
        this.currentProvider = null;
        this.retryCount = 0;
    }

    // Clean up URL parameters
    cleanupUrl() {
        if (window.history && window.history.replaceState) {
            const currentPath = window.location.pathname;
            window.history.replaceState({}, document.title, currentPath);
        }
    }

    // Destroy method for complete cleanup
    destroy() {
        this.cleanup();
        window.removeEventListener('message', this.handlePopupMessage);
        window.removeEventListener('beforeunload', this.cleanup);
        document.removeEventListener('visibilitychange', () => {});
    }

    // Public API methods for external integration

    // Get current configuration
    getConfig() {
        return { ...this.config };
    }

    // Update configuration
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    // Check if provider is available/configured
    isProviderAvailable(provider) {
        return this.supportedProviders.includes(provider) && 
               this.providerConfig[provider];
    }

    // Get all available providers
    getAvailableProviders() {
        return this.supportedProviders.map(provider => ({
            id: provider,
            name: this.getProviderName(provider),
            ...this.providerConfig[provider]
        }));
    }

    // Get provider configuration
    getProviderConfig(provider) {
        return this.providerConfig[provider] || null;
    }

    // Check if currently processing authentication
    isAuthenticating() {
        return !!(this.popupWindow && !this.popupWindow.closed);
    }

    // Manual trigger for specific provider (programmatic usage)
    triggerLogin(provider, options = {}) {
        return this.handleLogin(provider, options);
    }
}