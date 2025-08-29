// routing/RouterManager.js
class RouterManager {
    constructor(authManager) {
        this.authManager = authManager;
        this.routes = {
            '/': 'login-form',
            '/login': 'login-form', 
            '/register': 'register-form',
            '/signup': 'register-form',
            '/forgot-password': 'forgot-password-form',
            '/reset-password': 'forgot-password-form',
            '/verify-email': 'email-verification-form',
            '/2fa': 'two-factor-form',
            '/backup-code': 'backup-code-form'
        };
        
        this.currentRoute = '';
        this.isInitialized = false;
        
        this.init();
    }

    get uiManager() {
        return this.authManager.uiManager;
    }

    init() {
        if (this.isInitialized) return;
        
        // Handle initial page load
        this.handleRoute();

        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            this.handleRoute();
        });

        // Setup navigation listeners - integrate with existing auth system
        this.setupNavigationListeners();
        
        // Handle URL query parameters (for error states, etc.)
        this.handleQueryParameters();
        
        this.isInitialized = true;
    }

    handleRoute() {
        const path = window.location.pathname;
        const targetForm = this.routes[path] || 'login-form';
        
        // Don't update if already on the same route
        if (this.currentRoute === targetForm) return;
        
        this.currentRoute = targetForm;
        
        // Use the auth manager's showStep method to maintain consistency
        this.authManager.showStep(targetForm);
        
        // Update page title
        this.updatePageTitle(targetForm);
    }

    updatePageTitle(formId) {
        const titles = {
            'login-form': 'Sign In - TransitFLOW',
            'register-form': 'Sign Up - TransitFLOW', 
            'forgot-password-form': 'Reset Password - TransitFLOW',
            'email-verification-form': 'Verify Email - TransitFLOW',
            'two-factor-form': '2FA Verification - TransitFLOW',
            'backup-code-form': 'Backup Code - TransitFLOW'
        };
        
        document.title = titles[formId] || 'TransitFLOW - Authentication';
    }

    navigateTo(path, formId = null) {
        // Determine form ID from path if not provided
        if (!formId) {
            formId = this.routes[path] || 'login-form';
        }

        // Update URL without page reload
        const currentUrl = window.location.pathname;
        if (currentUrl !== path) {
            window.history.pushState({ formId, timestamp: Date.now() }, '', path);
        }
        
        // Update current route and show form
        this.currentRoute = formId;
        this.authManager.showStep(formId);
        this.updatePageTitle(formId);
    }

    setupNavigationListeners() {
        // Remove any existing listeners to prevent conflicts
        this.removeExistingListeners();
        
        // Navigation event mapping
        const navigationEvents = {
            'show-register': '/register',
            'show-forgot-password': '/forgot-password', 
            'back-to-login': '/login',
            'back-to-login-from-forgot': '/login',
            'back-to-login-from-2fa': '/login',
            'back-to-login-from-verification': '/login',
            'show-backup-code': '/backup-code',
            'back-to-2fa': '/2fa'
        };

        // Setup click handlers for navigation
        Object.entries(navigationEvents).forEach(([elementId, path]) => {
            const element = document.getElementById(elementId);
            if (element) {
                const handler = (e) => {
                    e.preventDefault();
                    this.navigateTo(path);
                };
                
                element.addEventListener('click', handler);
                // Store handler reference for cleanup
                element._routerHandler = handler;
            }
        });

        // Special handlers that need auth integration
        this.setupSpecialHandlers();
    }

    setupSpecialHandlers() {
        // Skip 2FA setup handler
        const skip2FA = document.getElementById('skip-2fa-setup');
        if (skip2FA && !skip2FA._routerHandler) {
            const handler = (e) => {
                e.preventDefault();
                this.        window.location.href = '/account';
            };
            skip2FA.addEventListener('click', handler);
            skip2FA._routerHandler = handler;
        }
    }

    removeExistingListeners() {
        const elementsWithHandlers = document.querySelectorAll('[id*="show-"], [id*="back-to-"]');
        elementsWithHandlers.forEach(element => {
            if (element._routerHandler) {
                element.removeEventListener('click', element._routerHandler);
                delete element._routerHandler;
            }
        });
    }

    handleQueryParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const success = urlParams.get('success');
        const message = urlParams.get('message');

        if (error || success || message) {
            setTimeout(() => {
                let alertMessage = '';
                let alertType = 'info';

                if (error) {
                    alertType = 'error';
                    switch (error) {
                        case 'missing-token':
                            alertMessage = 'Password reset link is missing required information. Please request a new reset link.';
                            break;
                        case 'invalid-token':
                            alertMessage = 'This password reset link is invalid or has expired. Please request a new reset link.';
                            break;
                        case 'server-error':
                            alertMessage = 'Server error occurred. Please try again later.';
                            break;
                        case 'session-expired':
                            alertMessage = 'Your session has expired. Please log in again.';
                            break;
                        case 'access-denied':
                            alertMessage = 'Access denied. Please check your credentials.';
                            break;
                        default:
                            alertMessage = decodeURIComponent(error);
                    }
                } else if (success) {
                    alertType = 'success';
                    switch (success) {
                        case 'password-reset':
                            alertMessage = 'Your password has been reset successfully. You can now log in.';
                            break;
                        case 'email-verified':
                            alertMessage = 'Your email has been verified successfully!';
                            break;
                        case 'account-created':
                            alertMessage = 'Account created successfully! Please check your email for verification.';
                            break;
                        default:
                            alertMessage = decodeURIComponent(success);
                    }
                } else if (message) {
                    alertMessage = decodeURIComponent(message);
                }

                // Show message using auth system's toast
                this.uiManager.showToast(alertMessage, alertType);

                // Clean up URL parameters
                this.cleanUpUrl();
            }, 500);
        }
    }

    cleanUpUrl() {
        const currentPath = window.location.pathname;
        window.history.replaceState({ formId: this.currentRoute }, document.title, currentPath);
    }

    // Public methods for integration with auth system
    show2FA() {
        this.navigateTo('/2fa');
    }

    showEmailVerification() {
        this.navigateTo('/verify-email');
    }

    showLogin() {
        this.navigateTo('/login');
    }

    showRegister() {
        this.navigateTo('/register');
    }

    redirectAfterLogin(url = '/account') {
        // Clean up any router state before redirect
        this.        window.location.href = '/account';
    }

    getCurrentRoute() {
        return this.currentRoute;
    }

    getCurrentPath() {
        return window.location.pathname;
    }

    // Cleanup method
    destroy() {
        this.removeExistingListeners();
        window.removeEventListener('popstate', this.handleRoute);
        this.isInitialized = false;
    }
}