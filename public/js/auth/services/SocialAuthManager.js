// services/SocialAuthManager.js
class SocialAuthManager {
    constructor(config = {}) {
        this.config = {
            apiBaseUrl: 'https://api-auth.transitflow.qzz.io/api/auth/social/social',
            redirectUri: 'https://account.transitflow.qzz.io/account',
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
        this.linkingMode = false;
        this.retryCount = 0;
        
        this.supportedProviders = ['google', 'facebook', 'github'];
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
            github: {
                name: 'GitHub',
                color: '#333',
                icon: 'bxl-github'
            }
        };

    }

    // Initialization method
    initialize(authManager, uiManager, networkManager) {
        this.authManager = authManager;
        this.uiManager = uiManager;
        this.networkManager = networkManager;
        
        // Bind methods to preserve context after dependencies are set
        console.log("DEBUG SocialAuthManager.initialize binding:", this.config.login);

        this.handleLogin = this.handleLogin.bind(this);
        this.handleLink = this.handleLink.bind(this);
        this.handlePopupMessage = this.handlePopupMessage.bind(this);
        
        this.setupEventListeners();
        this.handleUrlParameters();
        
        console.log('SocialAuthManager initialized successfully');
    }

    // Setup event listeners for social login buttons
    setupEventListeners() {
        // Listen for popup messages
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

            // Also handle dynamic buttons (for account linking)
            const linkButton = document.getElementById(`link-${provider}`);
            if (linkButton) {
                linkButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleLink(provider);
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
                        this.uiManager.showToast(
                            'Please complete the authentication in the popup window',
                            'info'
                        );
                    }
                }, 2000);
            }
        });
    }

    // Handle URL parameters for OAuth redirects
    handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const provider = urlParams.get('provider');
        const loginMethod = urlParams.get('loginMethod');

        if (error && provider) {
            setTimeout(() => {
                this.handleOAuthError(error, provider);
                this.cleanupUrl();
            }, 500);
        } else if (loginMethod === 'social' && provider) {
            // Successful OAuth login redirect
            setTimeout(() => {
                this.uiManager.showToast(
                    `Successfully logged in with ${this.getProviderName(provider)}!`,
                    'success'
                );
                this.cleanupUrl();
            }, 500);
        }
    }

    // Main social login handler
    async handleLogin(provider, options = {}) {
        if (!this.validateProvider(provider)) {
            return;
        }

        if (!this.networkManager.isOnline) {
            this.uiManager.showToast(
                'No internet connection. Please check your network and try again.',
                'error'
            );
            return;
        }

        try {
            this.currentProvider = provider;
            this.linkingMode = false;
            this.retryCount = 0;

            // Show loading state
            this.setButtonLoading(provider, true);
            this.uiManager.showToast(
                `Connecting to ${this.getProviderName(provider)}...`,
                'info'
            );

            // Get OAuth URL from backend
            const authData = await this.getOAuthUrl(provider, options.redirectUri);

            if (!authData.authUrl) {
                throw new Error('Failed to get OAuth URL from server');
            }

            // Open popup and start authentication flow
            await this.openPopupAndAuthenticate(authData.authUrl, authData.state);

        } catch (error) {
            console.error(`${provider} login error:`, error);
            this.handleSocialError(error, provider);
        } finally {
            this.setButtonLoading(provider, false);
        }
    }

    // Handle social account linking (for authenticated users)
    async handleLink(provider, options = {}) {
        if (!this.validateProvider(provider)) {
            return;
        }

        if (!this.authManager.currentUser) {
            this.uiManager.showToast('You must be logged in to link accounts', 'error');
            return;
        }

        if (!this.networkManager.isOnline) {
            this.uiManager.showToast(
                'No internet connection. Please check your network and try again.',
                'error'
            );
            return;
        }

        try {
            this.currentProvider = provider;
            this.linkingMode = true;
            this.retryCount = 0;

            // Show loading state
            this.setButtonLoading(provider, true, 'link');
            this.uiManager.showToast(
                `Connecting to ${this.getProviderName(provider)} for account linking...`,
                'info'
            );

            // Get OAuth URL for linking
            const authData = await this.getOAuthUrl(provider, options.redirectUri, true);

            if (!authData.authUrl) {
                throw new Error('Failed to get OAuth URL for linking');
            }

            // Open popup and start linking flow
            await this.openPopupAndAuthenticate(authData.authUrl, authData.state);

        } catch (error) {
            console.error(`${provider} linking error:`, error);
            this.handleSocialError(error, provider, true);
        } finally {
            this.setButtonLoading(provider, false, 'link');
        }
    }

    // Get OAuth URL from backend
    async getOAuthUrl(provider, redirectUri = null, isLinking = false) {
        const params = new URLSearchParams();
        
        if (redirectUri) {
            params.append('redirect_uri', redirectUri);
        }
        
        if (isLinking) {
            params.append('action', 'link');
        }

        const queryString = params.toString() ? '?' + params.toString() : '';
        const url = `${this.config.apiBaseUrl}/social/${provider}${queryString}`;
        
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
                throw new Error(errorData.message || `Failed to get ${provider} OAuth URL`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to get OAuth URL');
            }

            return data.data;

        } catch (error) {
            if (this.shouldRetry(error)) {
                return await this.retryWithBackoff(() => this.getOAuthUrl(provider, redirectUri, isLinking));
            }
            throw error;
        }
    }

    // Open popup and handle authentication flow
    async openPopupAndAuthenticate(authUrl, state) {
        return new Promise((resolve, reject) => {
            try {
                // Calculate popup position (center of screen)
                const left = (screen.width - this.config.popupWidth) / 2;
                const top = (screen.height - this.config.popupHeight) / 2;

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
                    throw new Error('Popup blocked. Please allow popups for this site.');
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

    // Handle popup window closure
    handlePopupClosure() {
        this.cleanup();
        
        if (this.authPromise) {
            this.authPromise.reject(new Error('Authentication cancelled by user'));
            this.authPromise = null;
        }

        this.uiManager.showToast('Authentication cancelled', 'warning');
    }

    // Handle messages from popup window
    handlePopupMessage(event) {
        // Verify origin for security
        const allowedOrigins = [
            'https://api-auth.transitflow.qzz.io',
            'https://account.transitflow.qzz.io',
            window.location.origin
        ];

        if (!allowedOrigins.includes(event.origin)) {
            console.warn('Received message from unauthorized origin:', event.origin);
            return;
        }

        if (!this.authPromise) {
            return;
        }

        const data = event.data;

        if (data.type === 'OAUTH_SUCCESS') {
            this.handleOAuthSuccess(data);
        } else if (data.type === 'OAUTH_ERROR') {
            this.handleOAuthError(data.error, data.provider, data.isLinking);
        } else if (data.type === 'OAUTH_CANCELLED') {
            this.handlePopupClosure();
        }
    }

    // Handle successful OAuth authentication
    async handleOAuthSuccess(data) {
        try {
            this.cleanup();

            if (this.linkingMode) {
                // Handle account linking success
                this.uiManager.showToast(
                    `${this.getProviderName(data.provider)} account linked successfully!`,
                    'success'
                );
                
                // Emit event for account linking
                this.emitEvent('accountLinked', {
                    provider: data.provider,
                    email: data.email,
                    displayName: data.displayName
                });

            } else {
                // Handle login success
                this.authManager.currentUser = data.user;
                this.authManager.authToken = data.token;

                this.uiManager.showToast(
                    `Welcome ${data.user.firstName || data.user.username}!`,
                    'success'
                );

                // Emit event for successful login
                this.emitEvent('loginSuccess', {
                    provider: data.provider,
                    user: data.user,
                    loginMethod: 'social'
                });

                // Redirect to dashboard
                setTimeout(() => {
                    this.authManager.redirectToDashboard();
                }, 1500);
            }

            if (this.authPromise) {
                this.authPromise.resolve(data);
                this.authPromise = null;
            }

        } catch (error) {
            console.error('Error handling OAuth success:', error);
            this.handleSocialError(error, data.provider);
        }
    }

    // Handle OAuth errors with detailed error mapping
    handleOAuthError(error, provider, isLinking = false) {
        const errorMessages = {
            'oauth_denied': `${this.getProviderName(provider)} access was denied. Please try again and allow access to continue.`,
            'oauth_failed': `Authentication with ${this.getProviderName(provider)} failed. Please try again.`,
            'account_not_linked': `This ${this.getProviderName(provider)} account is not linked to any TransitFLOW account. Please link it first or create a new account.`,
            'account_disabled': 'Your account has been disabled. Please contact support.',
            'account_exists': `An account with this ${this.getProviderName(provider)} email already exists. Please sign in with your existing account.`,
            'linking_failed': `Failed to link ${this.getProviderName(provider)} account. Please try again.`,
            'provider_error': `${this.getProviderName(provider)} is experiencing issues. Please try again later.`,
            'rate_limited': 'Too many authentication attempts. Please wait a few minutes before trying again.',
            'server_error': 'Server error occurred. Please try again later.',
            'network_error': 'Network connection failed. Please check your internet and try again.',
            'popup_blocked': 'Popup was blocked. Please allow popups for this site and try again.',
            'timeout': 'Authentication timed out. Please try again.',
            'cancelled': 'Authentication was cancelled.',
            'invalid_state': 'Security validation failed. Please try again.',
            'invalid_provider': `${this.getProviderName(provider)} is not supported or configured.`
        };

        const message = errorMessages[error] || errorMessages['oauth_failed'];
        const type = ['account_disabled', 'server_error', 'provider_error'].includes(error) ? 'error' : 'warning';

        this.cleanup();
        this.uiManager.showToast(message, type);

        if (this.authPromise) {
            this.authPromise.reject(new Error(message));
            this.authPromise = null;
        }

        // Emit error event
        this.emitEvent('authError', {
            error,
            provider,
            isLinking,
            message
        });

        // For specific errors, provide additional guidance
        if (error === 'account_not_linked') {
            setTimeout(() => {
                this.uiManager.showToast(
                    'Would you like to create a new account or link to an existing one?',
                    'info',
                    8000
                );
            }, 2000);
        }
    }

    // Handle general social authentication errors
    handleSocialError(error, provider, isLinking = false) {
        console.error(`Social auth error (${provider}):`, error);

        let errorType = 'oauth_failed';
        let message = error.message || `Authentication with ${this.getProviderName(provider)} failed`;

        // Map specific errors
        if (error.message.includes('popup') || error.message.includes('blocked')) {
            errorType = 'popup_blocked';
        } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
            errorType = 'timeout';
        } else if (error.message.includes('cancelled')) {
            errorType = 'cancelled';
        } else if (error.message.includes('network') || error.name === 'NetworkError') {
            errorType = 'network_error';
        } else if (error.status === 429) {
            errorType = 'rate_limited';
        } else if (error.status >= 500) {
            errorType = 'server_error';
        } else if (error.status === 400 && error.message.includes('provider')) {
            errorType = 'invalid_provider';
        }

        this.handleOAuthError(errorType, provider, isLinking);
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
            this.uiManager.showToast(`${provider} is not a supported provider`, 'error');
            return false;
        }
        return true;
    }

    getProviderName(provider) {
        return this.providerConfig[provider]?.name || provider.charAt(0).toUpperCase() + provider.slice(1);
    }

    setButtonLoading(provider, isLoading, mode = 'login') {
        const buttonId = mode === 'link' ? `link-${provider}` : `${provider}-login`;
        const button = document.getElementById(buttonId);
        
        if (!button) return;

        if (isLoading) {
            button.disabled = true;
            button.setAttribute('data-original-text', button.textContent);
            const providerName = this.getProviderName(provider);
            const actionText = mode === 'link' ? 'Linking' : 'Connecting';
            button.innerHTML = `<i class="bx bx-loader-alt rotating"></i> ${actionText} to ${providerName}...`;
        } else {
            button.disabled = false;
            const originalText = button.getAttribute('data-original-text');
            if (originalText) {
                button.textContent = originalText;
                button.removeAttribute('data-original-text');
            }
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
            'network_error',
            'timeout'
        ];

        return retryableErrors.some(retryError => 
            error.name === retryError || 
            error.type === retryError || 
            error.message.toLowerCase().includes(retryError.toLowerCase())
        );
    }

    // Retry with exponential backoff
    async retryWithBackoff(operation) {
        this.retryCount++;
        const delay = this.config.retryDelay * Math.pow(2, this.retryCount - 1);
        
        this.uiManager.showToast(
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
            this.popupWindow.close();
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
        this.linkingMode = false;
        this.retryCount = 0;
    }

    // Clean up URL parameters
    cleanupUrl() {
        const currentPath = window.location.pathname;
        window.history.replaceState({}, document.title, currentPath);
    }

    // Destroy method for complete cleanup
    destroy() {
        this.cleanup();
        window.removeEventListener('message', this.handlePopupMessage);
        window.removeEventListener('beforeunload', this.cleanup);
    }

    // Public API methods for external integration
    getLinkedAccounts(userId) {
        // This would typically fetch from your API
        return fetch(`${this.config.apiBaseUrl}/social/linked-accounts/${userId}`, {
            credentials: 'include'
        }).then(response => response.json());
    }

    async unlinkAccount(provider) {
        try {
            const response = await fetch(`${this.config.apiBaseUrl}/social/unlink`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ provider })
            });

            if (!response.ok) {
                const errorData = await this.parseErrorResponse(response);
                throw new Error(errorData.message || 'Failed to unlink account');
            }

            const data = await response.json();
            
            this.uiManager.showToast(
                `${this.getProviderName(provider)} account unlinked successfully`,
                'success'
            );

            this.emitEvent('accountUnlinked', { provider });
            
            return data;

        } catch (error) {
            console.error('Unlink error:', error);
            this.uiManager.showToast(
                `Failed to unlink ${this.getProviderName(provider)} account: ${error.message}`,
                'error'
            );
            throw error;
        }
    }

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
}