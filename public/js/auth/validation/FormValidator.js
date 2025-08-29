// validation/FormValidator.js
class FormValidator {
    constructor() {
        this.uiManager = null; // Will be injected
    }

    setUIManager(uiManager) {
        this.uiManager = uiManager;
    }

    // Validation rules
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    isValidPassword(password) {
        return password.length >= 8 && 
               /[a-z]/.test(password) && 
               /[A-Z]/.test(password) && 
               /\d/.test(password) && 
               /[@$!%*?&#+\-=_~`|\\(){}\[\]:";'<>,.\/]/.test(password);
    }

    isValidUsername(username) {
        return /^[a-zA-Z0-9_]{3,30}$/.test(username);
    }

    isValidPhone(phone) {
        return /^[\+]?[1-9][\d]{9,15}$/.test(phone.replace(/\D/g, ''));
    }

    isValidName(name) {
        return /^[a-zA-Z\s'-]{1,50}$/.test(name);
    }

    validateForm(form) {
        const inputs = form.querySelectorAll('input[required], select[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });

        return isValid;
    }

    validateField(input) {
        const value = input.value.trim();
        const type = input.type;
        const name = input.name;

        let isValid = true;
        let errorMessage = '';

        if (input.required && !value) {
            errorMessage = 'This field is required';
            isValid = false;
        } else if (type === 'email' && value && !this.isValidEmail(value)) {
            errorMessage = 'Please enter a valid email address';
            isValid = false;
        } else if (name === 'password' && value && !this.isValidPassword(value)) {
            errorMessage = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
            isValid = false;
        } else if (name === 'username' && value && !this.isValidUsername(value)) {
            errorMessage = 'Username must be 3-30 characters and contain only letters, numbers, and underscores';
            isValid = false;
        } else if (name === 'phone' && value && !this.isValidPhone(value)) {
            errorMessage = 'Please enter a valid phone number';
            isValid = false;
        } else if ((name === 'firstName' || name === 'lastName') && value && !this.isValidName(value)) {
            errorMessage = 'Name can only contain letters, spaces, hyphens, and apostrophes';
            isValid = false;
        } else if (name === 'otp' && value && !/^\d{6}$/.test(value)) {
            errorMessage = 'Please enter a valid 6-digit code';
            isValid = false;
        } else if (name === 'token' && value && !/^\d{6}$/.test(value)) {
            errorMessage = 'Please enter a valid 6-digit code';
            isValid = false;
        } else if (name === 'backupCode' && value && !/^[A-Z0-9]{8}$/i.test(value)) {
            errorMessage = 'Please enter a valid backup code';
            isValid = false;
        }

        if (!isValid && this.uiManager) {
            this.uiManager.setFieldError(input, errorMessage);
        } else if (this.uiManager) {
            this.uiManager.clearFieldError(input);
        }

        return isValid;
    }

    calculatePasswordStrength(password) {
        if (!password) return { percentage: 0, level: '', text: 'Enter a password' };

        let score = 0;
        let feedback = [];

        if (password.length >= 8) score += 2;
        else feedback.push('at least 8 characters');

        if (/[a-z]/.test(password)) score += 1;
        else feedback.push('lowercase letters');

        if (/[A-Z]/.test(password)) score += 1;
        else feedback.push('uppercase letters');

        if (/\d/.test(password)) score += 1;
        else feedback.push('numbers');

        if (/[@$!%*?&]/.test(password)) score += 1;
        else feedback.push('special characters');

        if (password.length >= 12) score += 1;
        if (/[^A-Za-z0-9@$!%*?&]/.test(password)) score += 1;

        let level, text, percentage;

        if (score < 3) {
            level = 'weak';
            text = `Weak - Add ${feedback.join(', ')}`;
            percentage = 25;
        } else if (score < 5) {
            level = 'fair';
            text = 'Fair - Consider adding more complexity';
            percentage = 50;
        } else if (score < 7) {
            level = 'good';
            text = 'Good password strength';
            percentage = 75;
        } else {
            level = 'strong';
            text = 'Strong password';
            percentage = 100;
        }

        return { percentage, level, text };
    }

    setupFormValidation() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            const inputs = form.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.addEventListener('blur', () => this.validateField(input));
                input.addEventListener('input', () => {
                    if (this.uiManager) {
                        this.uiManager.clearFieldError(input);
                    }
                });
            });
        });
    }

    checkPasswordStrength() {
        const input = document.getElementById('password');
        const strengthFill = document.getElementById('strength-fill');
        const strengthText = document.getElementById('strength-text');

        if (!input || !strengthFill || !strengthText) return;

        const password = input.value;
        const strength = this.calculatePasswordStrength(password);

        strengthFill.style.width = `${strength.percentage}%`;
        strengthFill.className = `strength-fill ${strength.level}`;
        strengthText.textContent = strength.text;
        strengthText.className = `strength-text ${strength.level}`;
    }

    formatPhoneNumber() {
        const input = document.getElementById('phone');
        if (!input) return;

        let value = input.value.replace(/\D/g, '');

        if (value.startsWith('92')) {
            value = value.replace(/^(\d{2})(\d{3})(\d{7})/, '+$1 $2 $3');
        } else if (value.startsWith('1')) {
            value = value.replace(/^(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 $2-$3-$4');
        }

        input.value = value;
    }
}