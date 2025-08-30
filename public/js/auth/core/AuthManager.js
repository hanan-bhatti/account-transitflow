// core/AuthManager.js
class AuthManager {
    constructor(config = {}) {
        this.config = {
            apiBaseUrl: 'https://api-auth.transitflow.qzz.io/api/auth',
            debounceDelay: 500,
            tokenKey: 'authToken',
            userKey: 'userData',
            themeKey: 'theme',
            offlineQueueKey: 'offlineQueue',
            offlineDataKey: 'offlineData',
            maxRetries: 3,
            retryDelay: 1000,
            ...config
        };

        this.currentStep = 'login-form';
        this.tempSessionId = null;
        this.rememberMe = false;
        this.userEmail = null;
        this.tempUserData = null;
        this.authToken = null;
        this.currentUser = null;
        this.isInitializing = true;

        // Initialize components
        this.apiClient = new ApiClient(this.config);
        this.uiManager = new UIManager(this.config);
        this.validator = new FormValidator();
        this.networkManager = new NetworkManager(this.config);
        this.socialAuthManager = new SocialAuthManager(this.config);
        this.socialAuthManager.initialize(this, this.uiManager, this.networkManager);
        // Ensure AuthThemeManager is available with fallback
        if (typeof AuthThemeManager === 'undefined') {
            console.warn('AuthThemeManager not found, creating fallback theme manager');
            this.themeManager = this.createFallbackThemeManager();
        } else {
            this.themeManager = new AuthThemeManager(this.config);
        }
        this.formHandler = new FormHandler(this);
        this.eventManager = new EventManager(this);
    }

    async init() {
        try {
            // Show loading overlay immediately with auto progress
            this.uiManager.showLoadingOverlay(true, false);
            this.uiManager.updateLoadingProgress(5, 'Initializing TransitFLOW...');

            // Initialize theme first
            this.themeManager.initialize();
            this.uiManager.updateLoadingProgress(15, 'Loading theme settings...');

            await this.delay(200); // Small delay for visual feedback

            // Bind events
            this.eventManager.bindEvents();
            this.uiManager.updateLoadingProgress(25, 'Setting up event handlers...');

            await this.delay(150);

            // Setup network monitoring
            this.networkManager.setupMonitoring();
            this.uiManager.updateLoadingProgress(35, 'Checking network status...');

            await this.delay(200);

            // Check authentication status
            this.uiManager.updateLoadingProgress(45, 'Checking authentication...');
            await this.checkAuthStatus();

            // Process offline queue if needed
            if (this.networkManager.isOnline) {
                this.uiManager.updateLoadingProgress(75, 'Syncing offline data...');
                await this.networkManager.processOfflineQueue();
                await this.delay(150);
            }

            // Finalize initialization
            this.uiManager.updateLoadingProgress(90, 'Preparing interface...');
            await this.delay(200);

            this.uiManager.updateLoadingProgress(100, 'Ready!');

            // Only hide loading if we're not redirecting to dashboard
            if (!this.currentUser) {
                setTimeout(() => {
                    this.uiManager.hideLoadingOverlay();
                    this.uiManager.focusFirstInput();
                    this.isInitializing = false;
                }, 500);
            } else {
                this.isInitializing = false;
            }

        } catch (error) {
            console.error('Failed to initialize auth system:', error);
            this.uiManager.updateLoadingProgress(100, 'Initialization failed');

            setTimeout(() => {
                this.uiManager.hideLoadingOverlay();
                this.uiManager.showToast('Failed to initialize. Please refresh the page.', 'error');
                this.isInitializing = false;
            }, 1000);
        }
    }

    async checkAuthStatus() {
        console.log('Checking auth status with cookie-based auth...');

        try {
            // Don't show loading overlay again if we're already initializing
            if (!this.isInitializing) {
                this.uiManager.showLoadingOverlay(true);
                this.uiManager.updateLoadingProgress(10, 'Connecting to server...');
            }

            const response = await this.apiClient.call('/me/quick', 'GET', null, false);

            if (!this.isInitializing) {
                this.uiManager.updateLoadingProgress(50, 'Verifying credentials...');
                await this.delay(200);
            }

            if (response.success && response.data && response.data.user) {
                this.currentUser = response.data.user;

                if (!this.isInitializing) {
                    this.uiManager.updateLoadingProgress(80, 'Loading user profile...');
                    await this.delay(300);
                }

                // Show welcome message and redirect
                const welcomeSteps = [
                    { progress: 90, text: 'Loading user data...', delay: 200 },
                    { progress: 95, text: 'Preparing dashboard...', delay: 300 },
                    { progress: 100, text: 'Welcome back!', delay: 400 }
                ];

                this.uiManager.simulateRealisticLoading(welcomeSteps, () => {
                    setTimeout(() => {
                        this.uiManager.hideLoadingOverlay(200);
                        this.uiManager.showToast(`Welcome back, ${this.currentUser.firstName || 'User'}!`, 'success');

                        setTimeout(() => {
                            this.redirectToDashboard();
                        }, 800);
                    }, 300);
                });

            } else {
                this.handleAuthCheckFailure(response);
            }
        } catch (error) {
            console.error('Auth check error:', error);
            this.handleAuthCheckError(error);
        } finally {
            // Only hide loading overlay if we're not initializing and user is not authenticated
            if (!this.isInitializing && !this.currentUser) {
                this.uiManager.hideLoadingOverlay();
            }
        }
    }

    handleAuthCheckFailure(response) {
        const messages = {
            'USER_NOT_FOUND': 'User account not found. Please log in again.',
            'ACCOUNT_INACTIVE': 'Account is inactive. Please contact support.',
            'default': 'Authentication failed. Please log in again.'
        };

        const message = messages[response.code] || messages.default;
        const type = response.code === 'ACCOUNT_INACTIVE' ? 'error' : 'warning';

        // Show toast only if not initializing to avoid conflicts
        if (!this.isInitializing) {
            this.uiManager.showToast(message, type);
        }
    }

    handleAuthCheckError(error) {
        const messages = {
            401: 'Session expired. Please log in again.',
            403: 'Account access denied. Please contact support.',
            404: 'User account not found. Please log in again.',
            'default': 'Authentication check failed. Please log in again.'
        };

        const message = messages[error.status] || messages.default;
        const type = error.status === 403 ? 'error' : 'warning';

        // Show toast only if not initializing to avoid conflicts
        if (!this.isInitializing) {
            this.uiManager.showToast(message, type);
        }
    }

    async login(formData) {
        try {
            this.uiManager.showLoadingOverlay(true);

            const loginSteps = [
                { progress: 10, text: 'Validating credentials...', delay: 200 },
                { progress: 30, text: 'Connecting to server...', delay: 400 },
                { progress: 60, text: 'Authenticating user...', delay: 600 },
                { progress: 80, text: 'Setting up session...', delay: 300 },
                { progress: 95, text: 'Loading profile...', delay: 200 },
                { progress: 100, text: 'Login successful!', delay: 300 }
            ];

            // Start the loading animation
            let stepIndex = 0;
            const processStep = () => {
                if (stepIndex < loginSteps.length) {
                    const step = loginSteps[stepIndex];
                    this.uiManager.updateLoadingProgress(step.progress, step.text);
                    stepIndex++;
                    setTimeout(processStep, step.delay);
                }
            };
            processStep();

            // Make the actual API call
            const response = await this.apiClient.call('/login', 'POST', formData);

            if (response.success) {
                this.currentUser = response.data.user;
                this.uiManager.updateLoadingProgress(100, 'Welcome!');

                setTimeout(() => {
                    this.uiManager.hideLoadingOverlay(200);
                    this.uiManager.showToast(`Welcome, ${this.currentUser.firstName || 'User'}!`, 'success');

                    setTimeout(() => {
                        this.redirectToDashboard();
                    }, 800);
                }, 500);

                return response;
            } else {
                throw new Error(response.message || 'Login failed');
            }
        } catch (error) {
            this.uiManager.updateLoadingProgress(100, 'Login failed');
            setTimeout(() => {
                this.uiManager.hideLoadingOverlay();
                this.uiManager.showToast(error.message || 'Login failed. Please try again.', 'error');
            }, 500);
            throw error;
        }
    }

    async register(formData) {
        try {
            this.uiManager.showLoadingOverlay(true);

            const registerSteps = [
                { progress: 10, text: 'Validating information...', delay: 300 },
                { progress: 25, text: 'Checking availability...', delay: 500 },
                { progress: 50, text: 'Creating account...', delay: 800 },
                { progress: 75, text: 'Setting up profile...', delay: 400 },
                { progress: 90, text: 'Sending verification...', delay: 300 },
                { progress: 100, text: 'Account created!', delay: 200 }
            ];

            this.uiManager.simulateRealisticLoading(registerSteps);

            const response = await this.apiClient.call('/register', 'POST', formData);

            if (response.success) {
                this.tempUserData = response.data;
                this.userEmail = formData.email;

                setTimeout(() => {
                    this.uiManager.hideLoadingOverlay();
                    this.uiManager.showToast('Account created! Please check your email for verification.', 'success');
                    this.showStep('email-verification-form');
                }, 800);

                return response;
            } else {
                throw new Error(response.message || 'Registration failed');
            }
        } catch (error) {
            this.uiManager.updateLoadingProgress(100, 'Registration failed');
            setTimeout(() => {
                this.uiManager.hideLoadingOverlay();
                this.uiManager.showToast(error.message || 'Registration failed. Please try again.', 'error');
            }, 500);
            throw error;
        }
    }

    async forgotPassword(email) {
        try {
            this.uiManager.showLoadingOverlay(true);

            const forgotSteps = [
                { progress: 20, text: 'Validating email...', delay: 300 },
                { progress: 60, text: 'Generating reset link...', delay: 500 },
                { progress: 90, text: 'Sending email...', delay: 400 },
                { progress: 100, text: 'Reset link sent!', delay: 200 }
            ];

            this.uiManager.simulateRealisticLoading(forgotSteps);

            const response = await this.apiClient.call('/forgot-password', 'POST', { email });

            if (response.success) {
                setTimeout(() => {
                    this.uiManager.hideLoadingOverlay();
                    this.uiManager.showToast('Password reset link sent to your email!', 'success');
                    this.showStep('login-form');
                }, 600);

                return response;
            } else {
                throw new Error(response.message || 'Failed to send reset link');
            }
        } catch (error) {
            this.uiManager.updateLoadingProgress(100, 'Failed to send reset link');
            setTimeout(() => {
                this.uiManager.hideLoadingOverlay();
                this.uiManager.showToast(error.message || 'Failed to send reset link. Please try again.', 'error');
            }, 500);
            throw error;
        }
    }

    // Helper method for delays
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showStep(stepId) {
        const allSteps = document.querySelectorAll('.auth-step');
        allSteps.forEach(step => step.classList.add('hidden'));

        const targetStep = document.getElementById(stepId);
        if (targetStep) {
            targetStep.classList.remove('hidden');
            this.currentStep = stepId;
            setTimeout(() => this.uiManager.focusFirstInput(), 100);
        }
    }

    redirectToDashboard() {
        // Show a final loading state before redirect
        this.uiManager.showLoadingOverlay(true);
        this.uiManager.updateLoadingProgress(50, 'Redirecting to dashboard...');

        setTimeout(() => {
            this.uiManager.updateLoadingProgress(100, 'Loading dashboard...');
            setTimeout(() => {
                window.location.href = '/account';
            }, 300);
        }, 500);
    }

    // Getters for other components to access
    get isOnline() {
        return this.networkManager.isOnline;
    }

    get offlineQueue() {
        return this.networkManager.offlineQueue;
    }

    /**
     * Create fallback theme manager when AuthThemeManager is not available
     * @private
     * @returns {Object} Fallback theme manager
     */
    createFallbackThemeManager() {
        return {
            currentTheme: 'dark',
            initialize: () => {
                const savedTheme = localStorage.getItem('theme') || 'dark';
                document.documentElement.setAttribute('data-theme', savedTheme);
                console.log('Fallback theme manager initialized with theme:', savedTheme);
            },
            setTheme: (theme) => {
                document.documentElement.setAttribute('data-theme', theme);
                localStorage.setItem('theme', theme);
                console.log('Fallback theme manager set theme:', theme);
            },
            toggle: () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                this.createFallbackThemeManager().setTheme(newTheme);
                return newTheme;
            },
            getCurrentTheme: () => {
                return localStorage.getItem('theme') || 'dark';
            },
            cleanup: () => {
                console.log('Fallback theme manager cleanup');
            }
        };
    }
}