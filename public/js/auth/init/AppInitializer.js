// init/AppInitializer.js
class AppInitializer {
    constructor() {
        this.authManager = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;

        try {
            await this.setupEnvironment();
            this.createRequiredElements();
            this.setupGlobalErrorHandling();
            this.setupAccessibilityFeatures();
            this.setupPerformanceMonitoring();
            this.initializeAuthSystem();
            this.registerServiceWorker();
            this.setupDevMode();

            this.isInitialized = true;
            console.log('🚀 TransitFLOW Auth System initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showFallbackError();
        }
    }

    async setupEnvironment() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
    }

    createRequiredElements() {
        // Create toast container if it doesn't exist
        if (!document.getElementById('toastContainer')) {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container';
            toastContainer.setAttribute('aria-live', 'polite');
            toastContainer.setAttribute('aria-label', 'Notifications');
            document.body.appendChild(toastContainer);
        }

        // Create top loader if it doesn't exist
        if (!document.getElementById('topLoader')) {
            const topLoader = document.createElement('div');
            topLoader.id = 'topLoader';
            topLoader.className = 'top-loader';
            topLoader.innerHTML = '<div class="top-loader-bar"></div>';
            topLoader.setAttribute('aria-hidden', 'true');
            document.body.appendChild(topLoader);
        }

        // Create loading overlay if it doesn't exist
        if (!document.getElementById('loadingOverlay')) {
            const loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loadingOverlay';
            loadingOverlay.className = 'loading-overlay';
            loadingOverlay.innerHTML = `
                <div class="loading-content">
                    <div class="spinner"></div>
                    <p>Loading...</p>
                </div>
            `;
            loadingOverlay.style.display = 'none';
            document.body.appendChild(loadingOverlay);
        }
    }

    setupGlobalErrorHandling() {
        // Handle uncaught errors
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            if (this.authManager) {
                this.authManager.uiManager.showToast(
                    'An unexpected error occurred. Please refresh the page if the problem persists.',
                    'error'
                );
            }
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            if (this.authManager) {
                this.authManager.uiManager.showToast(
                    'A network error occurred. Please check your connection and try again.',
                    'error'
                );
            }
            event.preventDefault();
        });

        // Handle network status changes
        window.addEventListener('online', () => {
            if (this.authManager) {
                this.authManager.uiManager.showToast('Connection restored! 🎉', 'success');
            }
        });

        window.addEventListener('offline', () => {
            if (this.authManager) {
                this.authManager.uiManager.showToast(
                    'Connection lost. Working offline...',
                    'warning',
                    8000
                );
            }
        });
    }

    setupAccessibilityFeatures() {
        // Add focus management for better keyboard navigation
        document.addEventListener('focusin', (e) => {
            if (e.target.matches('.form-input, .two-factor-input')) {
                e.target.parentElement.classList.add('focused');
            }
        });

        document.addEventListener('focusout', (e) => {
            if (e.target.matches('.form-input, .two-factor-input')) {
                e.target.parentElement.classList.remove('focused');
            }
        });

        // Add ARIA labels dynamically for better screen reader support
        this.enhanceAccessibility();
    }

    enhanceAccessibility() {
        // Add ARIA labels to forms if missing
        const forms = document.querySelectorAll('form');
        forms.forEach((form, index) => {
            if (!form.getAttribute('aria-label')) {
                const formName = form.id || `Form ${index + 1}`;
                form.setAttribute('aria-label', formName);
            }
        });

        // Ensure all inputs have proper labels
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
            if (!input.getAttribute('aria-label') && !document.querySelector(`label[for="${input.id}"]`)) {
                const placeholder = input.getAttribute('placeholder');
                if (placeholder) {
                    input.setAttribute('aria-label', placeholder);
                }
            }
        });
    }

    setupPerformanceMonitoring() {
        if ('performance' in window && 'mark' in performance) {
            performance.mark('auth-system-init-start');

            window.addEventListener('load', () => {
                performance.mark('auth-system-ready');

                try {
                    performance.measure(
                        'auth-system-init',
                        'auth-system-init-start',
                        'auth-system-ready'
                    );

                    const measure = performance.getEntriesByName('auth-system-init')[0];
                    console.log(`Auth system initialized in ${measure.duration.toFixed(2)}ms`);
                } catch (error) {
                    console.warn('Performance measurement failed:', error);
                }
            });
        }
    }

    initializeAuthSystem() {
        try {
            // Create the main auth manager instance
            this.authManager = new AuthManager();

            // Set up component dependencies
            this.authManager.apiClient.setUIManager(this.authManager.uiManager);
            this.authManager.validator.setUIManager(this.authManager.uiManager);
            this.authManager.networkManager.setUIManager(this.authManager.uiManager);
            this.authManager.networkManager.setApiClient(this.authManager.apiClient);

            // Expose globally for external access
            window.transitFlowAuth = this.authManager;

            // Add custom event listeners for auth state changes
            this.setupAuthEventListeners();

        } catch (error) {
            console.error('Failed to initialize auth system:', error);
            throw error;
        }
    }

    setupAuthEventListeners() {
        document.addEventListener('authStateChange', (e) => {
            const { state, user } = e.detail;
            console.log('Auth state changed:', state, user);

            switch (state) {
                case 'authenticated':
                    window.location.href = '/account';
                    break;
                case 'unauthenticated':
                    window.location.href = '/';
                    break;
                case 'pending':
                    this.authManager.uiManager.showLoadingOverlay();
                    break;
            }
        });
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('ServiceWorker registered:', registration);

                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    if (this.authManager) {
                                        this.authManager.uiManager.showToast(
                                            'App update available. Refresh to get the latest version.',
                                            'info',
                                            10000
                                        );
                                    }
                                }
                            });
                        }
                    });
                })
                .catch((error) => {
                    console.warn('ServiceWorker registration failed:', error);
                });
        }
    }

    setupDevMode() {
        const isDev = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('dev');

        if (isDev) {
            console.log('🔧 TransitFLOW Auth running in development mode');
            
            // Development utilities
            window.authDebug = {
                showAllToasts: () => {
                    if (this.authManager) {
                        this.authManager.uiManager.showToast('Success message example', 'success');
                        setTimeout(() => this.authManager.uiManager.showToast('Error message example', 'error'), 200);
                        setTimeout(() => this.authManager.uiManager.showToast('Warning message example', 'warning'), 400);
                        setTimeout(() => this.authManager.uiManager.showToast('Info message example', 'info'), 600);
                    }
                },
                testOfflineMode: () => {
                    if (this.authManager) {
                        this.authManager.networkManager.isOnline = false;
                        this.authManager.uiManager.showOfflineMessage();
                    }
                },
                testOnlineMode: () => {
                    if (this.authManager) {
                        this.authManager.networkManager.isOnline = true;
                        this.authManager.uiManager.hideOfflineMessage();
                        this.authManager.networkManager.processOfflineQueue();
                    }
                },
                clearStorage: () => {
                    localStorage.clear();
                    sessionStorage.clear();
                    location.reload();
                },
                getAuthManager: () => this.authManager,
                simulateError: (type = 'network') => {
                    const errors = {
                        network: new Error('Network connection failed'),
                        validation: { status: 400, message: 'Validation failed' },
                        server: { status: 500, message: 'Internal server error' }
                    };
                    throw errors[type] || errors.network;
                }
            };

            // Add development styles
            this.injectDevStyles();
        }
    }

    injectDevStyles() {
        const devStyles = document.createElement('style');
        devStyles.id = 'dev-styles';
        devStyles.textContent = `
            .dev-info {
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 10000;
            }
        `;
        document.head.appendChild(devStyles);

        const devInfo = document.createElement('div');
        devInfo.className = 'dev-info';
        devInfo.textContent = 'DEV MODE';
        document.body.appendChild(devInfo);
    }

    showFallbackError() {
        const fallbackToast = document.createElement('div');
        fallbackToast.className = 'toast toast-error';
        fallbackToast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 16px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 400px;
        `;
        
        fallbackToast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span>⚠️</span>
                <span>Failed to initialize authentication system. Please refresh the page.</span>
            </div>
        `;

        document.body.appendChild(fallbackToast);

        setTimeout(() => {
            if (fallbackToast.parentNode) {
                fallbackToast.parentNode.removeChild(fallbackToast);
            }
        }, 8000);
    }

    // Public API for external integration
    getPublicAPI() {
        return {
            getInstance: () => this.authManager,
            showToast: (message, type, duration) => {
                if (this.authManager) {
                    return this.authManager.uiManager.showToast(message, type, duration);
                }
            },
            isOnline: () => this.authManager ? this.authManager.isOnline : navigator.onLine,
            getCurrentStep: () => this.authManager ? this.authManager.currentStep : null,
            getAuthToken: () => this.authManager ? this.authManager.authToken : null,
            logout: () => {
                if (this.authManager) {
                    this.authManager.showStep('login-form');
                    this.authManager.uiManager.showToast('You have been logged out', 'info');
                }
            },
            isInitialized: () => this.isInitialized
        };
    }
}

// Auto-initialize when script loads
(function() {
    'use strict';
    
    const initializer = new AppInitializer();
    
    // Initialize immediately or wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initializer.init());
    } else {
        initializer.init();
    }
    
    // Expose public API
    window.TransitFlowAuthAPI = initializer.getPublicAPI();
    
    console.log('🌟 TransitFLOW Auth System loaded');
})();