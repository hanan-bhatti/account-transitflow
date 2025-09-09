// core/InitManager.js
class InitManager {
    constructor() {
        this.authManager = null;
        this.isInitialized = false;
        this.initializationAttempts = 0;
        this.maxAttempts = 10;
    }

    async initialize() {
        if (this.isInitialized) return this.authManager;

        try {
            // Mark performance point
            if ('performance' in window && 'mark' in performance) {
                performance.mark('auth-system-init-start');
            }

            // Create required elements
            this.createRequiredElements();
            
            // Inject styles if needed
            this.injectStyles();

            // Setup global error handling
            this.setupGlobalErrorHandling();

            // Setup accessibility features
            this.setupAccessibilityFeatures();

            // Initialize auth manager with all components
            this.authManager = new AuthManager();

            // Initialize the auth manager
            await this.authManager.init();

            // Setup cross-component references
            this.setupCrossReferences();

            // Initialize router
            this.authManager.router = new RouterManager(this.authManager);

            // Register service worker if available
            this.registerServiceWorker();

            // Setup development helpers
            this.setupDevelopmentHelpers();

            // Mark as initialized
            this.isInitialized = true;

            // Performance measurement
            this.markPerformance();

            console.log('🚀 TransitFLOW Auth System initialized successfully');
            return this.authManager;

        } catch (error) {
            console.error('Failed to initialize auth system:', error);
            this.showFallbackError();
            throw error;
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
    }

    injectStyles() {
        if (!document.getElementById('transitflow-auth-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'transitflow-auth-styles';
            styleSheet.textContent = `
                /* Top Loader Styles */
                .top-loader {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 3px;
                    z-index: 10001;
                    display: none;
                }
                
                .top-loader-bar {
                    height: 100%;
                    background: linear-gradient(135deg, var(--transit-blue), var(--transit-orange));
                    width: 0%;
                    z-index: 10001;
                    transition: width 0.3s ease;
                }
                
                /* Offline Overlay Styles */
                .offline-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    z-index: 10002;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }
                
                .offline-content {
                    text-align: center;
                    padding: 40px;
                    background: rgba(0, 0, 0, 0.9);
                    border-radius: 12px;
                    max-width: 400px;
                }
                
                .offline-content i {
                    font-size: 48px;
                    margin-bottom: 16px;
                    color: #f59e0b;
                }
                
                .offline-status {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    margin-top: 20px;
                }
                
                .pulse-dot {
                    width: 8px;
                    height: 8px;
                    background: #f59e0b;
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
                
                /* Utility Classes */
                .rotating {
                    animation: rotate 1s linear infinite;
                }
                
                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(styleSheet);
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
                this.authManager.uiManager.showToast('Connection lost. Working offline...', 'warning', 8000);
            }
        });
    }

    setupAccessibilityFeatures() {
        document.addEventListener('keydown', (e) => {
            // ESC key to dismiss toasts
            if (e.key === 'Escape') {
                const toasts = document.querySelectorAll('.toast');
                toasts.forEach(toast => {
                    const closeButton = toast.querySelector('.toast-close');
                    if (closeButton) closeButton.click();
                });
            }

            // Alt + T to focus first visible input
            if (e.altKey && e.key === 't') {
                e.preventDefault();
                const firstInput = document.querySelector('input:not([type="hidden"]):not([readonly]):not([disabled])');
                if (firstInput) firstInput.focus();
            }

            // Ctrl/Cmd + Enter to submit current form
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const focusedElement = document.activeElement;
                const form = focusedElement.closest('form');
                if (form) {
                    e.preventDefault();
                    const submitButton = form.querySelector('button[type="submit"]');
                    if (submitButton && !submitButton.disabled) {
                        submitButton.click();
                    }
                }
            }
        });
    }

    setupCrossReferences() {
        // Set up cross-references between components
        this.authManager.apiClient.setUIManager(this.authManager.uiManager);
        this.authManager.validator.setUIManager(this.authManager.uiManager);
        this.authManager.networkManager.setUIManager(this.authManager.uiManager);
        this.authManager.networkManager.setApiClient(this.authManager.apiClient);
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

    setupDevelopmentHelpers() {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('🔧 TransitFLOW Auth running in development mode');
            
            window.authDebug = {
                showAllToasts: () => {
                    this.authManager.uiManager.showToast('Success message example', 'success');
                    setTimeout(() => this.authManager.uiManager.showToast('Error message example', 'error'), 200);
                    setTimeout(() => this.authManager.uiManager.showToast('Warning message example', 'warning'), 400);
                    setTimeout(() => this.authManager.uiManager.showToast('Info message example', 'info'), 600);
                },
                testOfflineMode: () => {
                    this.authManager.networkManager.isOnline = false;
                    this.authManager.uiManager.showOfflineMessage();
                },
                testOnlineMode: () => {
                    this.authManager.networkManager.isOnline = true;
                    this.authManager.uiManager.hideOfflineMessage();
                    this.authManager.networkManager.processOfflineQueue();
                },
                clearStorage: () => {
                    localStorage.clear();
                    sessionStorage.clear();
                    location.reload();
                },
                getAuthManager: () => this.authManager,
                getCurrentStep: () => this.authManager.currentStep,
                showStep: (step) => this.authManager.showStep(step)
            };
        }
    }

    markPerformance() {
        if ('performance' in window && 'mark' in performance) {
            performance.mark('auth-system-ready');
            try {
                performance.measure('auth-system-init', 'auth-system-init-start', 'auth-system-ready');
                const measure = performance.getEntriesByName('auth-system-init')[0];
                console.log(`🚀 Auth system initialized in ${measure.duration.toFixed(2)}ms`);
            } catch (error) {
                console.warn('Performance measurement failed:', error);
            }
        }
    }

    showFallbackError() {
        const fallbackToast = document.createElement('div');
        fallbackToast.className = 'toast toast-error toast-show';
        fallbackToast.innerHTML = `
            <div class="toast-content">
                <i class="bx bx-error-circle toast-icon"></i>
                <span class="toast-message">Failed to initialize authentication system. Please refresh the page.</span>
            </div>
        `;

        const container = document.getElementById('toastContainer') || document.body;
        container.appendChild(fallbackToast);

        setTimeout(() => {
            if (fallbackToast.parentNode) {
                fallbackToast.parentNode.removeChild(fallbackToast);
            }
        }, 8000);
    }

    // Public API
    getAuthManager() {
        return this.authManager;
    }

    isSystemInitialized() {
        return this.isInitialized;
    }
}

// Global initialization
(function() {
    'use strict';

    let initManager = null;

    function initializeSystem() {
        if (initManager) return;

        initManager = new InitManager();
        
        initManager.initialize()
            .then((authManager) => {
                // Expose to global scope
                window.transitFlowAuth = authManager;
                
                // Expose public API
                window.TransitFlowAuthAPI = {
                    getInstance: () => authManager,
                    showToast: (message, type, duration) => authManager.uiManager.showToast(message, type, duration),
                    isOnline: () => authManager.isOnline,
                    getCurrentStep: () => authManager.currentStep,
                    getAuthToken: () => authManager.authToken,
                    logout: () => {
                        authManager.showStep('login-form');
                        authManager.uiManager.showToast('You have been logged out', 'info');
                    },
                    navigateTo: (path) => authManager.router ? authManager.router.navigateTo(path) : null
                };

                // Dispatch custom event
                const event = new CustomEvent('transitFlowAuthReady', {
                    detail: { authManager }
                });
                document.dispatchEvent(event);
            })
            .catch((error) => {
                console.error('System initialization failed:', error);
            });
    }

    // Initialize based on DOM state
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSystem);
    } else {
        initializeSystem();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (initManager && initManager.authManager && initManager.authManager.router) {
            initManager.authManager.router.destroy();
        }
    });

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InitManager, AuthManager, ApiClient, UIManager, FormValidator, NetworkManager, AuthThemeManager, FormHandler, EventManager, RouterManager };
} else if (typeof define === 'function' && define.amd) {
    define([], function() {
        return { InitManager, AuthManager, ApiClient, UIManager, FormValidator, NetworkManager, AuthThemeManager, FormHandler, EventManager, RouterManager };
    });
}