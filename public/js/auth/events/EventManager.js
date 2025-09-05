// events/EventManager.js
class EventManager {
    constructor(authManager) {
        this.authManager = authManager;
        this.debounceTimers = {};
    }

    get uiManager() {
        return this.authManager.uiManager;
    }

    get validator() {
        return this.authManager.validator;
    }

    get formHandler() {
        return this.authManager.formHandler;
    }

    bindEvents() {
        this.bindThemeEvents();
        this.bindNavigationEvents();
        this.bindFormEvents();
        this.bindSpecialInputs();
        this.bindGlobalEvents();
        this.validator.setupFormValidation();
        this.bindProgressiveFormEvents(); // Add progressive form events
    }

    bindThemeEvents() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.authManager.themeManager.toggle();
            });
        }
    }

    bindNavigationEvents() {
        const navigationEvents = {
            'show-register': () => this.authManager.showStep('register-form'),
            'back-to-login': () => this.authManager.showStep('login-form'),
            'show-forgot-password': () => this.authManager.showStep('forgot-password-form'),
            'back-to-login-from-2fa': () => this.authManager.showStep('login-form'),
            'back-to-login-from-verification': () => this.authManager.showStep('login-form'),
            'back-to-login-from-forgot': () => this.authManager.showStep('login-form'),
            'show-backup-code': () => this.authManager.showStep('backup-code-form'),
            'back-to-2fa': () => this.authManager.showStep('two-factor-form'),
            'skip-2fa-setup': () => this.authManager.redirectToDashboard(),
            // New navigation for split login
            'show-social-login': () => this.uiManager.showLoginStep(2),
            'show-credential-login': () => this.uiManager.showLoginStep(1),
        };

        Object.entries(navigationEvents).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', (e) => {
                    e.preventDefault();
                    handler();
                });
            }
        });
    }

    bindFormEvents() {
        const formEvents = {
            'loginForm': (e) => this.formHandler.handleLogin(e),
            'registerForm': (e) => this.formHandler.handleRegister(e),
            'twoFactorForm': (e) => this.formHandler.handleTwoFactor(e),
            'backupCodeForm': (e) => this.formHandler.handleBackupCode(e),
            'emailVerificationForm': (e) => this.formHandler.handleEmailVerification(e),
            'forgotPasswordForm': (e) => this.formHandler.handleForgotPassword(e),
            'twoFactorSetupForm': (e) => this.formHandler.handleTwoFactorSetup(e)
        };

        Object.entries(formEvents).forEach(([formId, handler]) => {
            const form = document.getElementById(formId);
            if (form) {
                form.addEventListener('submit', handler);
            }
        });

        const resendVerification = document.getElementById('resend-verification');
        if (resendVerification) {
            resendVerification.addEventListener('click', (e) => this.formHandler.handleResendVerification(e));
        }
    }

    bindSpecialInputs() {
        // Password toggle buttons
        ['login-password-toggle', 'password-toggle'].forEach(id => {
            const toggle = document.getElementById(id);
            if (toggle) {
                toggle.addEventListener('click', () => this.uiManager.togglePasswordVisibility(id));
            }
        });

        // Username availability checking
        const usernameInput = document.getElementById('username');
        if (usernameInput) {
            usernameInput.addEventListener('input', () => this.checkUsernameAvailability());
            usernameInput.addEventListener('blur', () => this.checkUsernameAvailability());
        }

        // Email availability checking
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.addEventListener('blur', () => this.checkEmailAvailability());
        }

        // Password strength checking
        const passwordInput = document.getElementById('password');
        if (passwordInput) {
            passwordInput.addEventListener('input', () => this.validator.checkPasswordStrength());
        }

        // 2FA input handling
        const twoFactorInputs = document.querySelectorAll('.two-factor-input');
        twoFactorInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => this.handle2FAInput(e, index));
            input.addEventListener('keydown', (e) => this.handle2FAKeyDown(e, index));
            input.addEventListener('paste', (e) => this.handle2FAPaste(e));
        });

        // Phone number formatting
        const phoneInput = document.getElementById('phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', () => this.validator.formatPhoneNumber());
        }
    }

    bindGlobalEvents() {
        // Global error handling
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.uiManager.showToast('An unexpected error occurred. Please try again.', 'error');
        });

        // Focus management for accessibility
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

        // Keyboard shortcuts
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

    bindProgressiveFormEvents() {
        const stepTransitions = {
            'register-next-1': { next: 2, fields: ['first-name', 'last-name'] },
            'register-next-2': { next: 3, fields: ['date-of-birth', 'username'] },
            'register-next-3': { next: 4, fields: ['email', 'phone'] },
            'register-next-4': { next: 5, fields: ['password', 'user-type'] },
            'register-back-1': { back: 1 },
            'register-back-2': { back: 2 },
            'register-back-3': { back: 3 },
            'register-back-4': { back: 4 },
        };

        Object.entries(stepTransitions).forEach(([id, config]) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', () => {
                    if (config.next) {
                        const isValid = this.validator.validateStep(config.next - 1);
                        if (isValid) {
                            this.uiManager.showRegisterStep(config.next);
                            if (config.next === 3) { // Personalization on step 3
                                const firstName = document.getElementById('first-name').value;
                                this.uiManager.personalizeRegisterGreeting(firstName);
                            }
                            if (config.next === 5) { // Populate review
                                this.uiManager.populateReviewDetails();
                            }
                        }
                    } else if (config.back) {
                        this.uiManager.showRegisterStep(config.back);
                    }
                });
            }
        });

        // Bind edit buttons on the review page
        const reviewContainer = document.getElementById('review-details-container');
        if (reviewContainer) {
            reviewContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('review-edit-btn')) {
                    const step = e.target.dataset.step;
                    if (step) {
                        this.uiManager.showRegisterStep(parseInt(step));
                    }
                }
            });
        }
    }

    // Username availability checking with debouncing
    checkUsernameAvailability() {
        const input = document.getElementById('username');
        const statusIcon = document.getElementById('username-status');
        const suggestionsContainer = document.getElementById('username-suggestions');

        if (!input || !statusIcon) return;

        const username = input.value.trim();

        if (this.debounceTimers.username) {
            clearTimeout(this.debounceTimers.username);
        }

        statusIcon.style.display = 'none';
        input.classList.remove('success', 'error');
        if (suggestionsContainer) suggestionsContainer.classList.add('hidden');

        if (username.length < 3) return;

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.uiManager.setFieldError(input, 'Username can only contain letters, numbers, and underscores');
            return;
        }

        if (!this.authManager.isOnline) {
            this.uiManager.showToast('Cannot check username availability while offline', 'warning');
            return;
        }

        statusIcon.style.display = 'block';
        statusIcon.className = 'bx bx-loader-alt input-icon rotating';

        this.debounceTimers.username = setTimeout(async () => {
            try {
                const response = await this.authManager.apiClient.call(`/check-username/${encodeURIComponent(username)}`, 'GET');

                if (response.data.available) {
                    statusIcon.className = 'bx bx-check input-icon success';
                    input.classList.add('success');
                    if (suggestionsContainer) {
                        suggestionsContainer.classList.add('hidden');
                    }
                } else {
                    statusIcon.className = 'bx bx-x input-icon error';
                    input.classList.add('error');
                    this.uiManager.setFieldError(input, 'Username is not available');
                    this.showUsernameSuggestions(username);
                }
            } catch (error) {
                statusIcon.className = 'bx bx-error input-icon error';
                this.uiManager.setFieldError(input, 'Unable to check availability');
                if (suggestionsContainer) {
                    suggestionsContainer.classList.add('hidden');
                }
            } finally {
                statusIcon.classList.remove('rotating');
            }
        }, this.authManager.config.debounceDelay);
    }

    async showUsernameSuggestions(baseName) {
        const suggestionsContainer = document.getElementById('username-suggestions');
        if (!suggestionsContainer || !this.authManager.isOnline) return;

        try {
            const response = await this.authManager.apiClient.call(`/suggest-usernames?name=${encodeURIComponent(baseName)}`, 'GET');

            if (response.data.suggestions && response.data.suggestions.length > 0) {
                suggestionsContainer.innerHTML = `
                    <div class="suggestions-header">Suggestions:</div>
                    ${response.data.suggestions.map(suggestion =>
                        `<div class="suggestion-item" data-username="${suggestion}">${suggestion}</div>`
                    ).join('')}
                `;

                suggestionsContainer.classList.remove('hidden');

                suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
                    item.addEventListener('click', () => {
                        document.getElementById('username').value = item.dataset.username;
                        suggestionsContainer.classList.add('hidden');
                        this.checkUsernameAvailability();
                    });
                });
            }
        } catch (error) {
            console.warn('Failed to get username suggestions:', error.message);
        }
    }

    async checkEmailAvailability() {
        const input = document.getElementById('email');
        if (!input || !this.authManager.isOnline) return;

        const email = input.value.trim();
        if (!this.validator.isValidEmail(email)) return;

        try {
            const response = await this.authManager.apiClient.call(`/check-email/${encodeURIComponent(email)}`, 'GET');

            if (!response.data.available) {
                this.uiManager.setFieldError(input, 'Email is already registered');
            }
        } catch (error) {
            console.warn('Email availability check failed:', error.message);
        }
    }

    // 2FA Input handling
    handle2FAInput(e, index) {
        const input = e.target;
        const value = input.value;

        if (!/^\d?$/.test(value)) {
            input.value = '';
            return;
        }

        if (value && index < 5) {
            const nextInput = document.querySelector(`.two-factor-input[data-index="${index + 1}"]`);
            if (nextInput) {
                nextInput.focus();
            }
        }

        this.formHandler.update2FASubmitButton();
    }

    handle2FAKeyDown(e, index) {
        const input = e.target;

        if (e.key === 'Backspace' && !input.value && index > 0) {
            const prevInput = document.querySelector(`.two-factor-input[data-index="${index - 1}"]`);
            if (prevInput) {
                prevInput.focus();
                prevInput.value = '';
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            const prevInput = document.querySelector(`.two-factor-input[data-index="${index - 1}"]`);
            if (prevInput) prevInput.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            const nextInput = document.querySelector(`.two-factor-input[data-index="${index + 1}"]`);
            if (nextInput) nextInput.focus();
        }
    }

    handle2FAPaste(e) {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text');
        const digits = paste.replace(/\D/g, '').slice(0, 6);

        if (digits.length === 6) {
            const inputs = document.querySelectorAll('.two-factor-input');
            digits.split('').forEach((digit, index) => {
                if (inputs[index]) {
                    inputs[index].value = digit;
                }
            });
            this.formHandler.update2FASubmitButton();
        }
    }
}