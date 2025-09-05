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
            this.updateLoadingMessage(5, 'Initializing TransitFLOW...', 'info');

            // Initialize theme first
            try {
                this.themeManager.initialize();
                this.updateLoadingMessage(15, 'Theme settings loaded successfully', 'success');
                await this.delay(200);
            } catch (error) {
                this.updateLoadingMessage(15, 'Warning: Using default theme settings', 'warning');
                await this.delay(200);
            }

            // Bind events
            try {
                this.eventManager.bindEvents();
                this.updateLoadingMessage(25, 'Event handlers configured', 'success');
                await this.delay(150);
            } catch (error) {
                this.updateLoadingMessage(25, 'Error setting up events: ' + error.message, 'error');
                await this.delay(300);
            }

            // Setup network monitoring
            try {
                this.networkManager.setupMonitoring();
                const networkStatus = this.networkManager.isOnline ? 'Online' : 'Offline';
                this.updateLoadingMessage(35, `Network status: ${networkStatus}`, 
                    this.networkManager.isOnline ? 'success' : 'warning');
                await this.delay(200);
            } catch (error) {
                this.updateLoadingMessage(35, 'Network monitoring setup failed', 'error');
                await this.delay(200);
            }

            // Check authentication status
            this.updateLoadingMessage(45, 'Checking authentication status...', 'info');
            await this.checkAuthStatus();

            // Process offline queue if needed
            if (this.networkManager.isOnline) {
                try {
                    this.updateLoadingMessage(75, 'Syncing offline data...', 'info');
                    await this.networkManager.processOfflineQueue();
                    this.updateLoadingMessage(80, 'Offline data synchronized', 'success');
                    await this.delay(150);
                } catch (error) {
                    this.updateLoadingMessage(80, 'Warning: Some offline data could not sync', 'warning');
                    await this.delay(150);
                }
            } else {
                this.updateLoadingMessage(75, 'Offline mode - data will sync when online', 'warning');
                await this.delay(150);
            }

            // Finalize initialization
            this.updateLoadingMessage(90, 'Preparing interface...', 'info');
            await this.delay(200);

            this.updateLoadingMessage(100, 'TransitFLOW ready!', 'success');

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
            this.updateLoadingMessage(100, 'Initialization failed: ' + error.message, 'error');

            setTimeout(() => {
                this.uiManager.hideLoadingOverlay();
                this.uiManager.showToast('Failed to initialize. Please refresh the page.', 'error');
                this.isInitializing = false;
            }, 2000); // Longer delay to show error message
        }
    }

    async checkAuthStatus() {
        console.log('Checking auth status with cookie-based auth...');

        try {
            // Don't show loading overlay again if we're already initializing
            if (!this.isInitializing) {
                this.uiManager.showLoadingOverlay(true);
                this.updateLoadingMessage(10, 'Connecting to authentication server...', 'info');
            }

            const response = await this.apiClient.call('/me', 'GET', null, false);

            if (!this.isInitializing) {
                this.updateLoadingMessage(50, 'Server connection established', 'success');
                await this.delay(200);
            }

            if (response.success && response.data && response.data.user) {
                this.currentUser = response.data.user;
                const userName = this.currentUser.firstName || this.currentUser.name || 'User';

                if (!this.isInitializing) {
                    this.updateLoadingMessage(70, `User authenticated: ${userName}`, 'success');
                    await this.delay(200);
                    this.updateLoadingMessage(85, 'Loading user profile data...', 'info');
                    await this.delay(300);
                }

                // Show welcome message and redirect
                const welcomeSteps = [
                    { progress: 90, text: 'Profile data loaded successfully', type: 'success', delay: 200 },
                    { progress: 95, text: 'Preparing personalized dashboard...', type: 'info', delay: 300 },
                    { progress: 100, text: `Welcome back, ${userName}!`, type: 'success', delay: 400 }
                ];

                this.simulateRealisticLoadingWithMessages(welcomeSteps, () => {
                    setTimeout(() => {
                        this.uiManager.hideLoadingOverlay(200);
                        this.uiManager.showToast(`Welcome back, ${userName}!`, 'success');

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
            'USER_NOT_FOUND': 'User account not found in database',
            'ACCOUNT_INACTIVE': 'Account is inactive or suspended',
            'SESSION_EXPIRED': 'Session has expired',
            'default': 'Authentication verification failed'
        };

        const message = messages[response.code] || messages.default;
        const type = response.code === 'ACCOUNT_INACTIVE' ? 'error' : 'warning';

        this.updateLoadingMessage(100, message, type);

        // Show toast only if not initializing to avoid conflicts
        if (!this.isInitializing) {
            setTimeout(() => {
                this.uiManager.showToast(message + '. Please log in again.', type);
            }, 1000);
        }
    }

    handleAuthCheckError(error) {
        const messages = {
            401: 'Session expired or invalid',
            403: 'Access denied - account restrictions',
            404: 'Authentication service unavailable',
            500: 'Server error during authentication',
            'NETWORK_ERROR': 'Unable to connect to authentication server',
            'default': 'Authentication check failed'
        };

        const message = messages[error.status] || messages[error.code] || messages.default;
        const type = error.status === 403 ? 'error' : 'warning';

        this.updateLoadingMessage(100, message, type);

        // Show toast only if not initializing to avoid conflicts
        if (!this.isInitializing) {
            setTimeout(() => {
                this.uiManager.showToast(message + '. Please log in again.', type);
            }, 1000);
        }
    }

    async login(formData) {
        try {
            this.uiManager.showLoadingOverlay(true);
            this.updateLoadingMessage(10, 'Validating login credentials...', 'info');

            // Start the API call and track progress
            const apiCallPromise = this.apiClient.call('/login', 'POST', formData);
            
            // Show realistic progress steps
            setTimeout(() => this.updateLoadingMessage(25, 'Connecting to server...', 'info'), 300);
            setTimeout(() => this.updateLoadingMessage(50, 'Verifying username and password...', 'info'), 800);

            const response = await apiCallPromise;

            if (response.success) {
                this.currentUser = response.data.user;
                const userName = this.currentUser.firstName || this.currentUser.name || 'User';
                
                this.updateLoadingMessage(75, 'Login successful! Setting up session...', 'success');
                await this.delay(300);
                
                this.updateLoadingMessage(90, `Welcome ${userName}! Loading your dashboard...`, 'success');
                await this.delay(300);
                
                this.updateLoadingMessage(100, 'Login complete!', 'success');

                setTimeout(() => {
                    this.uiManager.hideLoadingOverlay(200);
                    this.uiManager.showToast(`Welcome, ${userName}!`, 'success');

                    setTimeout(() => {
                        this.redirectToDashboard();
                    }, 800);
                }, 500);

                return response;
            } else {
                const errorMessage = this.getLoginErrorMessage(response.code, response.message);
                this.updateLoadingMessage(100, errorMessage, 'error');
                throw new Error(errorMessage);
            }
        } catch (error) {
            const errorMessage = this.getLoginErrorMessage(error.code, error.message);
            this.updateLoadingMessage(100, errorMessage, 'error');
            
            setTimeout(() => {
                this.uiManager.hideLoadingOverlay();
                this.uiManager.showToast(errorMessage, 'error');
            }, 1500); // Longer delay to show error message
            throw error;
        }
    }

    async register(formData) {
        try {
            this.uiManager.showLoadingOverlay(true);
            this.updateLoadingMessage(10, 'Validating registration information...', 'info');

            // Start the API call and track progress
            const apiCallPromise = this.apiClient.call('/register', 'POST', formData);
            
            // Show realistic progress steps
            setTimeout(() => this.updateLoadingMessage(25, 'Checking email availability...', 'info'), 400);
            setTimeout(() => this.updateLoadingMessage(45, 'Validating password requirements...', 'info'), 800);
            setTimeout(() => this.updateLoadingMessage(65, 'Creating your account...', 'info'), 1200);

            const response = await apiCallPromise;

            if (response.success) {
                this.tempUserData = response.data;
                this.userEmail = formData.email;

                this.updateLoadingMessage(85, 'Account created successfully!', 'success');
                await this.delay(300);
                
                this.updateLoadingMessage(95, 'Sending verification email...', 'info');
                await this.delay(400);
                
                this.updateLoadingMessage(100, 'Registration complete! Check your email.', 'success');

                setTimeout(() => {
                    this.uiManager.hideLoadingOverlay();
                    this.uiManager.showToast('Account created! Please check your email for verification.', 'success');
                    this.showStep('email-verification-form');
                }, 800);

                return response;
            } else {
                const errorMessage = this.getRegistrationErrorMessage(response.code, response.message);
                this.updateLoadingMessage(100, errorMessage, 'error');
                throw new Error(errorMessage);
            }
        } catch (error) {
            const errorMessage = this.getRegistrationErrorMessage(error.code, error.message);
            this.updateLoadingMessage(100, errorMessage, 'error');
            
            setTimeout(() => {
                this.uiManager.hideLoadingOverlay();
                this.uiManager.showToast(errorMessage, 'error');
            }, 1500);
            throw error;
        }
    }

    async forgotPassword(email) {
        try {
            this.uiManager.showLoadingOverlay(true);
            this.updateLoadingMessage(20, 'Validating email address...', 'info');

            // Start the API call and track progress
            const apiCallPromise = this.apiClient.call('/forgot-password', 'POST', { email });
            
            setTimeout(() => this.updateLoadingMessage(50, 'Checking account status...', 'info'), 400);
            setTimeout(() => this.updateLoadingMessage(75, 'Generating secure reset link...', 'info'), 800);

            const response = await apiCallPromise;

            if (response.success) {
                this.updateLoadingMessage(90, 'Reset link generated successfully', 'success');
                await this.delay(300);
                
                this.updateLoadingMessage(100, 'Password reset email sent!', 'success');

                setTimeout(() => {
                    this.uiManager.hideLoadingOverlay();
                    this.uiManager.showToast('Password reset link sent to your email!', 'success');
                    this.showStep('login-form');
                }, 600);

                return response;
            } else {
                const errorMessage = this.getForgotPasswordErrorMessage(response.code, response.message);
                this.updateLoadingMessage(100, errorMessage, 'error');
                throw new Error(errorMessage);
            }
        } catch (error) {
            const errorMessage = this.getForgotPasswordErrorMessage(error.code, error.message);
            this.updateLoadingMessage(100, errorMessage, 'error');
            
            setTimeout(() => {
                this.uiManager.hideLoadingOverlay();
                this.uiManager.showToast(errorMessage, 'error');
            }, 1500);
            throw error;
        }
    }

    // Helper method to update loading message with type
    updateLoadingMessage(progress, message, type = 'info') {
        this.uiManager.updateLoadingProgress(progress, message, type);
    }

    // Helper method for realistic loading with typed messages
    simulateRealisticLoadingWithMessages(steps, callback) {
        let stepIndex = 0;
        const processStep = () => {
            if (stepIndex < steps.length) {
                const step = steps[stepIndex];
                this.updateLoadingMessage(step.progress, step.text, step.type);
                stepIndex++;
                setTimeout(processStep, step.delay);
            } else if (callback) {
                callback();
            }
        };
        processStep();
    }

    // Error message helpers
    getLoginErrorMessage(code, defaultMessage) {
        const errorMessages = {
            'INVALID_CREDENTIALS': 'Invalid email or password',
            'ACCOUNT_LOCKED': 'Account temporarily locked due to multiple failed attempts',
            'ACCOUNT_INACTIVE': 'Account is inactive. Please contact support',
            'EMAIL_NOT_VERIFIED': 'Please verify your email before logging in',
            'TOO_MANY_ATTEMPTS': 'Too many login attempts. Please try again later',
            'SERVER_ERROR': 'Server error during login. Please try again',
            'NETWORK_ERROR': 'Connection error. Please check your internet'
        };
        return errorMessages[code] || defaultMessage || 'Login failed. Please try again';
    }

    getRegistrationErrorMessage(code, defaultMessage) {
        const errorMessages = {
            'EMAIL_EXISTS': 'An account with this email already exists',
            'WEAK_PASSWORD': 'Password does not meet security requirements',
            'INVALID_EMAIL': 'Please enter a valid email address',
            'USERNAME_TAKEN': 'This username is already taken',
            'REGISTRATION_DISABLED': 'New registrations are currently disabled',
            'SERVER_ERROR': 'Server error during registration. Please try again',
            'VALIDATION_ERROR': 'Please check your information and try again'
        };
        return errorMessages[code] || defaultMessage || 'Registration failed. Please try again';
    }

    getForgotPasswordErrorMessage(code, defaultMessage) {
        const errorMessages = {
            'EMAIL_NOT_FOUND': 'No account found with this email address',
            'RESET_LIMIT_EXCEEDED': 'Too many reset requests. Please wait before trying again',
            'EMAIL_SEND_FAILED': 'Failed to send reset email. Please try again',
            'ACCOUNT_INACTIVE': 'Account is inactive. Please contact support',
            'SERVER_ERROR': 'Server error. Please try again later'
        };
        return errorMessages[code] || defaultMessage || 'Failed to send reset link. Please try again';
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
        this.updateLoadingMessage(30, 'Preparing dashboard redirect...', 'info');

        setTimeout(() => {
            this.updateLoadingMessage(70, 'Loading dashboard components...', 'info');
            setTimeout(() => {
                this.updateLoadingMessage(100, 'Redirecting now...', 'success');
                setTimeout(() => {
                    window.location.href = '/account';
                }, 300);
            }, 400);
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
                try {
                    const savedTheme = localStorage.getItem('theme') || 'dark';
                    document.documentElement.setAttribute('data-theme', savedTheme);
                    console.log('Fallback theme manager initialized with theme:', savedTheme);
                } catch (error) {
                    console.warn('Could not initialize theme:', error);
                    document.documentElement.setAttribute('data-theme', 'dark');
                }
            },
            setTheme: (theme) => {
                try {
                    document.documentElement.setAttribute('data-theme', theme);
                    localStorage.setItem('theme', theme);
                    console.log('Fallback theme manager set theme:', theme);
                } catch (error) {
                    console.warn('Could not set theme:', error);
                }
            },
            toggle: () => {
                try {
                    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
                    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                    this.createFallbackThemeManager().setTheme(newTheme);
                    return newTheme;
                } catch (error) {
                    console.warn('Could not toggle theme:', error);
                    return 'dark';
                }
            },
            getCurrentTheme: () => {
                try {
                    return localStorage.getItem('theme') || 'dark';
                } catch (error) {
                    console.warn('Could not get current theme:', error);
                    return 'dark';
                }
            },
            cleanup: () => {
                console.log('Fallback theme manager cleanup');
            }
        };
    }
}