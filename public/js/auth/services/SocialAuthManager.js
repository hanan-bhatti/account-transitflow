// services/SocialAuthManager.js
class SocialAuthManager {
    constructor(config = {}) {
        this.config = {
            apiBbaseUrl_social: 'https://api-auth.transitflow.qzz.io/api/users',
            frontendBaseUrl: 'https://account.transitflow.qzz.io',
            maxRetries: 3,
            retryDelay: 1500,
            useDirectRedirect: true, // New option to control redirect behavior
            ...config
        };

        this.authManager = null;
        this.uiManager = null;
        this.networkManager = null;
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
        
        this.setupEventListeners();
        this.handleUrlParameters();
        
        console.log('SocialAuthManager initialized successfully (same-tab mode)');
    }

    // Setup event listeners for social login buttons
    setupEventListeners() {
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
    }

    // Handle URL parameters for OAuth success/error redirects
    handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const code = urlParams.get('code');
        const linked = urlParams.get('linked');
        const success = urlParams.get('success');

        if (error) {
            setTimeout(() => {
                this.handleUrlError(error, urlParams.get('provider'));
                this.cleanupUrl();
            }, 500);
        } else if (linked && success) {
            // Handle successful account linking
            setTimeout(() => {
                this.uiManager?.showToast(
                    `Successfully linked your ${this.getProviderName(linked)} account!`,
                    'success'
                );
                this.cleanupUrl();
                this.emitEvent('accountLinked', { provider: linked });
            }, 500);
        } else if (code) {
            // OAuth callback completed - this shouldn't happen in same-tab flow
            // but we handle it gracefully
            setTimeout(() => {
                this.uiManager?.showToast('Login completed successfully!', 'success');
                this.cleanupUrl();
            }, 500);
        }
    }

    // Main social login handler - modified for same-tab navigation
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
                `Redirecting to ${this.getProviderName(provider)}...`,
                'info'
            );

            // Use direct redirect approach
            if (this.config.useDirectRedirect) {
                // Direct redirect to OAuth endpoint
                await this.redirectToOAuth(provider, options.redirectUri);
            } else {
                // Fetch URL then redirect (fallback)
                const authData = await this.getOAuthUrl(provider, options.redirectUri);
                if (authData.authUrl) {
                    window.location.href = authData.authUrl;
                } else {
                    throw new Error('Failed to get OAuth URL from server');
                }
            }

        } catch (error) {
            console.error(`${provider} login error:`, error);
            this.handleSocialError(error, provider);
            this.setButtonLoading(provider, false);
        }
    }

    // Direct redirect to OAuth endpoint (recommended approach)
    async redirectToOAuth(provider, redirectUri = null) {
        const params = new URLSearchParams();
        
        // Set action to login
        params.append('action', 'login');
        
        if (redirectUri) {
            params.append('redirect_uri', redirectUri);
        }

        const queryString = params.toString() ? '?' + params.toString() : '';
        const oauthUrl = `${this.config.apiBbaseUrl_social}/social/${provider}${queryString}`;
        
        // Emit event before redirect
        this.emitEvent('loginStarted', {
            provider,
            method: 'same-tab',
            url: oauthUrl
        });

        // Redirect to OAuth endpoint
        window.location.href = oauthUrl;
    }

    // Get OAuth URL from backend (fallback method)
    async getOAuthUrl(provider, redirectUri = null) {
        const params = new URLSearchParams();
        
        // Always set action to login and format to json
        params.append('action', 'login');
        params.append('format', 'json'); // Request JSON response
        
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

    // Handle URL-based errors (from OAuth redirect)
    handleUrlError(error, provider = null) {
        const errorMessages = {
            'access_denied': 'Access was denied. Please try again and allow access to continue.',
            'invalid_request': 'Invalid authentication request. Please try again.',
            'unauthorized': 'Authentication failed. Please try again.',
            'server_error': 'Server error occurred. Please try again later.',
            'oauth_error': 'OAuth provider error occurred. Please try again.',
            'email_required': 'Email address is required from your social account to continue.',
            'account_already_linked': 'This social account is already linked to another user.',
            'provider_already_linked': 'You already have this provider linked to your account.',
            'provider_not_configured': 'This login method is not available right now. Please try another method.'
        };

        const message = errorMessages[error] || 'Authentication failed. Please try again.';
        const providerName = provider ? this.getProviderName(provider) : 'social provider';
        const fullMessage = provider ? 
            message.replace('social account', `${providerName} account`).replace('provider', providerName) : 
            message;

        this.uiManager?.showToast(fullMessage, 'error');

        // Emit error event
        this.emitEvent('authError', {
            error,
            provider,
            message: fullMessage,
            source: 'url_redirect'
        });
    }

    // Handle general social authentication errors
    handleSocialError(error, provider) {
        console.error(`Social auth error (${provider}):`, error);

        let errorMessage = `Failed to authenticate with ${this.getProviderName(provider)}. Please try again.`;
        let errorType = 'error';
        
        // Map specific errors
        if (error.message.includes('network') || error.name === 'NetworkError') {
            errorMessage = 'Network connection failed. Please check your internet and try again.';
        } else if (error.message.includes('not configured') || error.message.includes('not available')) {
            errorMessage = `${this.getProviderName(provider)} login is not available right now. Please try another method.`;
        } else if (error.message.includes('blocked')) {
            errorMessage = 'Authentication was blocked. Please try again.';
        }

        this.uiManager?.showToast(errorMessage, errorType);

        // Emit error event
        this.emitEvent('authError', {
            error: error.message,
            provider,
            message: errorMessage,
            source: 'javascript'
        });
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
            button.innerHTML = `<i class="bx bx-loader-alt bx-spin"></i> Redirecting to ${providerName}...`;
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

    // Clean up URL parameters
    cleanupUrl() {
        if (window.history && window.history.replaceState) {
            const currentPath = window.location.pathname;
            window.history.replaceState({}, document.title, currentPath);
        }
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

    // Switch between direct redirect and fetch-then-redirect
    setRedirectMode(useDirectRedirect) {
        this.config.useDirectRedirect = useDirectRedirect;
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

    // Manual trigger for specific provider (programmatic usage)
    triggerLogin(provider, options = {}) {
        return this.handleLogin(provider, options);
    }

    // Create direct login URL for use in HTML links
    getLoginUrl(provider, redirectUri = null) {
        const params = new URLSearchParams();
        params.append('action', 'login');
        
        if (redirectUri) {
            params.append('redirect_uri', redirectUri);
        }

        const queryString = params.toString() ? '?' + params.toString() : '';
        return `${this.config.apiBbaseUrl_social}/social/${provider}${queryString}`;
    }

    // Method to generate HTML for social login buttons
    generateLoginButtonsHTML(containerClass = 'social-login-buttons') {
        const buttonsHTML = this.supportedProviders.map(provider => {
            const config = this.providerConfig[provider];
            const loginUrl = this.getLoginUrl(provider);
            
            return `
                <a href="${loginUrl}" 
                   class="social-login-btn ${provider}-btn" 
                   style="background-color: ${config.color};"
                   data-provider="${provider}">
                    <i class="bx ${config.icon}"></i>
                    Continue with ${config.name}
                </a>
            `;
        }).join('');

        return `<div class="${containerClass}">${buttonsHTML}</div>`;
    }

    // Destroy method for complete cleanup
    destroy() {
        // Remove any event listeners that were added
        this.supportedProviders.forEach(provider => {
            const button = document.getElementById(`${provider}-login`);
            if (button) {
                button.removeEventListener('click', this.handleLogin);
            }
        });
    }
}