// forms/FormHandler.js
class FormHandler {
    constructor(authManager) {
        this.authManager = authManager;
        this.debounceTimers = {};
    }

    get apiClient() {
        return this.authManager.apiClient;
    }

    get uiManager() {
        return this.authManager.uiManager;
    }

    get validator() {
        return this.authManager.validator;
    }

    get networkManager() {
        return this.authManager.networkManager;
    }

    async handleLogin(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const loginData = Object.fromEntries(formData);
        loginData.rememberMe = formData.has('rememberMe');

        if (!loginData.identifier || !loginData.password) {
            this.uiManager.showToast('Please enter both email/username and password', 'error');
            return;
        }

        if (!this.authManager.isOnline) {
            this.networkManager.saveOfflineData('login', loginData);
            this.uiManager.showToast('No internet connection. Data saved locally and will be processed when online.', 'warning');
            return;
        }

        try {
            this.uiManager.setLoading(e.target, true);
            const response = await this.apiClient.call('/login', 'POST', loginData);

            if (response.success) {
                if (response.data.requires2FA) {
                    this.authManager.tempSessionId = response.data.tempSessionId;
                    this.authManager.showStep('two-factor-form');
                    this.uiManager.showToast('Please enter your 2FA code', 'info');
                } else {
                    this.authManager.authToken = response.data.token;
                    if (response.data.requiresEmailVerification) {
                        this.authManager.userEmail = loginData.identifier;
                        this.authManager.showStep('email-verification-form');
                        this.uiManager.showToast('Please verify your email address', 'info');
                    } else {
                        this.uiManager.showToast('Login successful! Redirecting...', 'success');
                        setTimeout(() => this.authManager.redirectToDashboard(), 1500);
                    }
                }
            }
        } catch (error) {
            this.handleAuthError(error);
        } finally {
            this.uiManager.setLoading(e.target, false);
        }
    }

    async handleRegister(e) {
        e.preventDefault();

        if (!this.validator.validateForm(e.target)) {
            return;
        }

        const formData = new FormData(e.target);
        const registerData = Object.fromEntries(formData);

        const cleanedData = {
            firstName: registerData.firstName?.trim() || null,
            lastName: registerData.lastName?.trim() || null,
            username: registerData.username?.trim().toLowerCase(),
            email: registerData.email?.trim().toLowerCase(),
            phone: registerData.phone?.trim() || null,
            password: registerData.password,
            userType: registerData.userType || 'individual'
        };

        // Remove null/empty values except for required fields
        Object.keys(cleanedData).forEach(key => {
            if (cleanedData[key] === null || cleanedData[key] === '') {
                if (!['username', 'email', 'password', 'userType'].includes(key)) {
                    delete cleanedData[key];
                }
            }
        });

        if (!this.authManager.isOnline) {
            this.networkManager.saveOfflineData('register', cleanedData);
            this.uiManager.showToast('No internet connection. Registration data saved locally and will be processed when online.', 'warning');
            return;
        }

        try {
            this.uiManager.setLoading(e.target, true);
            this.uiManager.clearAllFieldErrors();

            const response = await this.apiClient.call('/register', 'POST', cleanedData);

            if (response.success) {
                this.authManager.userEmail = cleanedData.email;
                this.authManager.tempUserData = response.data.user;
                this.uiManager.showToast(response.message || 'Account created! Please check your email for verification code.', 'success');
                this.authManager.showStep('email-verification-form');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.handleRegistrationError(error);
        } finally {
            this.uiManager.setLoading(e.target, false);
        }
    }

    async handleTwoFactor(e) {
        e.preventDefault();

        const token = this.get2FACode();

        if (!token || token.length !== 6) {
            this.uiManager.showToast('Please enter a valid 6-digit code', 'error');
            return;
        }

        if (!this.authManager.tempSessionId) {
            this.uiManager.showToast('Session expired. Please login again.', 'error');
            this.authManager.showStep('login-form');
            return;
        }

        if (!this.authManager.isOnline) {
            this.networkManager.saveOfflineData('2fa_verify', {
                tempSessionId: this.authManager.tempSessionId,
                twoFactorCode: token
            });
            this.uiManager.showToast('No internet connection. Verification will be processed when online.', 'warning');
            return;
        }

        try {
            this.uiManager.setLoading(e.target, true);
            const response = await this.apiClient.call('/verify-2fa', 'POST', {
                tempSessionId: this.authManager.tempSessionId,
                twoFactorCode: token
            });

            if (response.success) {
                this.authManager.authToken = response.data.token;
                this.authManager.tempSessionId = null;

                if (response.data.requiresEmailVerification) {
                    this.authManager.showStep('email-verification-form');
                    this.uiManager.showToast('Please verify your email address', 'info');
                } else {
                    this.uiManager.showToast('2FA verified! Redirecting...', 'success');
                    setTimeout(() => this.authManager.redirectToDashboard(), 1500);
                }
            }
        } catch (error) {
            this.handleAuthError(error);
            this.clear2FAInputs();
        } finally {
            this.uiManager.setLoading(e.target, false);
        }
    }

    async handleBackupCode(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const backupCode = formData.get('backupCode');

        if (!backupCode || backupCode.length !== 8) {
            this.uiManager.showToast('Please enter a valid 8-character backup code', 'error');
            return;
        }

        if (!this.authManager.tempSessionId) {
            this.uiManager.showToast('Session expired. Please login again.', 'error');
            this.authManager.showStep('login-form');
            return;
        }

        if (!this.authManager.isOnline) {
            this.networkManager.saveOfflineData('backup_code_verify', {
                tempSessionId: this.authManager.tempSessionId,
                twoFactorCode: backupCode
            });
            this.uiManager.showToast('No internet connection. Verification will be processed when online.', 'warning');
            return;
        }

        try {
            this.uiManager.setLoading(e.target, true);
            const response = await this.apiClient.call('/verify-2fa', 'POST', {
                tempSessionId: this.authManager.tempSessionId,
                twoFactorCode: backupCode
            });

            if (response.success) {
                this.authManager.authToken = response.data.token;
                this.authManager.tempSessionId = null;

                if (response.data.requiresEmailVerification) {
                    this.authManager.showStep('email-verification-form');
                    this.uiManager.showToast('Please verify your email address', 'info');
                } else {
                    this.uiManager.showToast('Backup code verified! Redirecting...', 'success');
                    setTimeout(() => this.authManager.redirectToDashboard(), 1500);
                }
            }
        } catch (error) {
            this.handleAuthError(error);
            e.target.reset();
        } finally {
            this.uiManager.setLoading(e.target, false);
        }
    }

    async handleEmailVerification(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const otp = formData.get('otp');

        if (!this.authManager.userEmail) {
            this.uiManager.showToast('Session expired. Please try again.', 'error');
            this.authManager.showStep('login-form');
            return;
        }

        if (!this.authManager.isOnline) {
            this.networkManager.saveOfflineData('email_verify', { 
                email: this.authManager.userEmail, 
                otp 
            });
            this.uiManager.showToast('No internet connection. Verification will be processed when online.', 'warning');
            return;
        }

        try {
            this.uiManager.setLoading(e.target, true);
            const response = await this.apiClient.call('/verify-email', 'POST', {
                email: this.authManager.userEmail,
                otp: otp
            });

            if (response.success) {
                this.uiManager.showToast('Email verified successfully!', 'success');

                if (response.data.user) {
                    this.authManager.tempUserData = response.data.user;
                    setTimeout(() => this.authManager.redirectToDashboard(), 1500);
                } else {
                    setTimeout(() => this.authManager.showStep('login-form'), 1500);
                }
            }
        } catch (error) {
            this.handleAuthError(error);
        } finally {
            this.uiManager.setLoading(e.target, false);
        }
    }

    async handleResendVerification(e) {
        e.preventDefault();

        if (!this.authManager.userEmail) {
            this.uiManager.showToast('Session expired. Please try again.', 'error');
            this.authManager.showStep('login-form');
            return;
        }

        if (!this.authManager.isOnline) {
            this.uiManager.showToast('No internet connection. Please try again when online.', 'warning');
            return;
        }

        try {
            this.uiManager.setLoading(e.target, true);
            await this.apiClient.call('/resend-verification', 'POST', { 
                email: this.authManager.userEmail 
            });
            this.uiManager.showToast('Verification code sent!', 'success');
        } catch (error) {
            this.handleAuthError(error);
        } finally {
            this.uiManager.setLoading(e.target, false);
        }
    }

    async handleForgotPassword(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const email = formData.get('email');

        if (!this.authManager.isOnline) {
            this.networkManager.saveOfflineData('forgot_password', { email });
            this.uiManager.showToast('No internet connection. Request will be processed when online.', 'warning');
            return;
        }

        try {
            this.uiManager.setLoading(e.target, true);
            await this.apiClient.call('/forgot-password', 'POST', { email });
            this.uiManager.showToast('If an account exists, you will receive a password reset email.', 'success');
        } catch (error) {
            this.handleAuthError(error);
        } finally {
            this.uiManager.setLoading(e.target, false);
        }
    }

    async handleTwoFactorSetup(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const token = formData.get('token');

        if (!this.authManager.isOnline) {
            this.networkManager.saveOfflineData('2fa_setup', { token });
            this.uiManager.showToast('No internet connection. Setup will be completed when online.', 'warning');
            return;
        }

        try {
            this.uiManager.setLoading(e.target, true);
            const response = await this.apiClient.call('/2fa/verify-setup', 'POST', { token }, true);

            if (response.success && response.data.backupCodes) {
                this.uiManager.displayBackupCodes(response.data.backupCodes);
                this.uiManager.showToast('2FA enabled successfully!', 'success');
                document.getElementById('twoFactorSetupForm').style.display = 'none';
            }
        } catch (error) {
            this.handleAuthError(error);
        } finally {
            this.uiManager.setLoading(e.target, false);
        }
    }

    // Error handling methods
    handleAuthError(error) {
        console.error('Auth error:', error);

        const status = error.status || error.response?.status;
        const data = error.response || error;
        const message = error.message || data?.message;

        const statusMessages = {
            400: message || 'Please check your input and try again',
            401: this.get401Message(message),
            403: message || 'Account has been deactivated. Please contact support.',
            423: message || 'Account is temporarily locked',
            429: message || 'Too many attempts. Please try again later.',
            500: 'Server error. Please try again later.',
            'default': message || 'An error occurred. Please try again.'
        };

        const finalMessage = statusMessages[status] || statusMessages.default;
        const type = status === 403 ? 'error' : 'error';
        this.uiManager.showToast(finalMessage, type);
    }

    get401Message(message) {
        if (message && message.includes('2FA')) return 'Invalid 2FA code. Please try again.';
        if (message && message.includes('credential')) return 'Invalid email/username or password';
        if (message && message.includes('session')) {
            this.authManager.showStep('login-form');
            this.authManager.tempSessionId = null;
            return 'Session expired. Please login again.';
        }
        if (message && message.includes('expired')) {
            this.authManager.showStep('login-form');
            this.authManager.tempSessionId = null;
            return 'Verification session expired. Please login again.';
        }
        return message || 'Invalid credentials';
    }

    handleRegistrationError(error) {
        let message = 'An error occurred during registration. Please try again.';

        if (error.message) {
            message = error.message;
        } else if (error.error && error.error.message) {
            message = error.error.message;
        } else if (typeof error === 'string') {
            message = error;
        }

        this.uiManager.showToast(message, 'error');

        // Handle field-specific errors
        let fieldErrors = {};

        if (error.error && error.error.details) {
            fieldErrors = error.error.details;
        } else if (error.details) {
            fieldErrors = error.details;
        } else if (error.field && error.message) {
            fieldErrors[error.field] = error.message;
        } else if (error.validationErrors) {
            fieldErrors = error.validationErrors;
        }

        Object.keys(fieldErrors).forEach(fieldName => {
            const errorMessage = fieldErrors[fieldName];
            if (errorMessage && errorMessage !== null) {
                const input = document.getElementById(fieldName) ||
                    document.querySelector(`[name="${fieldName}"]`) ||
                    document.querySelector(`input[name="${fieldName}"]`) ||
                    document.querySelector(`select[name="${fieldName}"]`);

                if (input) {
                    this.uiManager.setFieldError(input, errorMessage);
                } else {
                    console.warn(`Field not found for error: ${fieldName}`, errorMessage);
                }
            }
        });
    }

    // 2FA Helper methods
    get2FACode() {
        const inputs = document.querySelectorAll('.two-factor-input');
        return Array.from(inputs).map(input => input.value).join('');
    }

    clear2FAInputs() {
        const inputs = document.querySelectorAll('.two-factor-input');
        inputs.forEach(input => {
            input.value = '';
        });
        if (inputs[0]) inputs[0].focus();
        this.update2FASubmitButton();
    }

    update2FASubmitButton() {
        const code = this.get2FACode();
        const submitButton = document.querySelector('#twoFactorForm button[type="submit"]');

        if (submitButton) {
            submitButton.disabled = code.length !== 6;
        }
    }
}