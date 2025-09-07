// ui/UIManager.js
class UIManager {
    constructor(config) {
        this.config = config;
        this.loadingProgress = 0;
        this.loadingInterval = null;
        this.loadingSteps = [
            "Initializing...",
            "Loading resources...",
            "Connecting to server...",
            "Authenticating...",
            "Loading user data...",
            "Preparing interface...",
            "Almost ready...",
            "Welcome to TransitFLOW!"
        ];
    }

    // Login and Register Step Management
    showLoginStep(stepNumber) {
        document.getElementById('login-step-1').classList.add('hidden');
        document.getElementById('login-step-2').classList.add('hidden');
        document.getElementById(`login-step-${stepNumber}`).classList.remove('hidden');
    }

    showRegisterStep(stepNumber) {
        const totalSteps = 5;
        for (let i = 1; i <= totalSteps; i++) {
            const stepId = (i === 5) ? 'register-step-5-review' : `register-step-${i}`;
            const element = document.getElementById(stepId);
            if (element) {
                element.classList.add('hidden');
            }
        }
        const nextStepId = (stepNumber === 5) ? 'register-step-5-review' : `register-step-${stepNumber}`;
        const nextElement = document.getElementById(nextStepId);
        if (nextElement) {
            nextElement.classList.remove('hidden');
        }
        this.updateRegisterProgress(stepNumber, totalSteps);
    }

    updateRegisterProgress(currentStep, totalSteps) {
        const progressFill = document.getElementById('register-progress-fill');
        if (progressFill) {
            const percentage = ((currentStep - 1) / (totalSteps - 1)) * 100;
            progressFill.style.width = `${percentage}%`;
        }
    }

    personalizeRegisterGreeting(name) {
        const greetingElement = document.getElementById('register-greeting');
        if (greetingElement && name) {
            greetingElement.textContent = `Thanks, ${name}! Let's get your contact info. (3/5)`;
        }
    }

    populateReviewDetails() {
        const container = document.getElementById('review-details-container');
        const form = document.getElementById('registerForm');
        if (!container || !form) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        const reviewContent = `
            <div class="review-section">
                <div class="review-section-header">
                    <h3 class="review-section-title">Name</h3>
                    <button type="button" class="review-edit-btn" data-step="1">Edit</button>
                </div>
                <div class="review-item">
                    <span class="review-item-label">First Name</span>
                    <span class="review-item-value">${data.firstName || ''}</span>
                </div>
                <div class="review-item">
                    <span class="review-item-label">Last Name</span>
                    <span class="review-item-value">${data.lastName || '-'}</span>
                </div>
            </div>
            <div class="review-section">
                <div class="review-section-header">
                    <h3 class="review-section-title">Identity</h3>
                    <button type="button" class="review-edit-btn" data-step="2">Edit</button>
                </div>
                <div class="review-item">
                    <span class="review-item-label">Date of Birth</span>
                    <span class="review-item-value">${data.dateOfBirth || ''}</span>
                </div>
                <div class="review-item">
                    <span class="review-item-label">Username</span>
                    <span class="review-item-value">${data.username || ''}</span>
                </div>
            </div>
            <div class="review-section">
                <div class="review-section-header">
                    <h3 class="review-section-title">Contact</h3>
                    <button type="button" class="review-edit-btn" data-step="3">Edit</button>
                </div>
                <div class="review-item">
                    <span class="review-item-label">Email</span>
                    <span class="review-item-value">${data.email || ''}</span>
                </div>
                <div class="review-item">
                    <span class="review-item-label">Phone</span>
                    <span class="review-item-value">${data.phone || '-'}</span>
                </div>
            </div>
            <div class="review-section">
                <div class="review-section-header">
                    <h3 class="review-section-title">Account</h3>
                    <button type="button" class="review-edit-btn" data-step="4">Edit</button>
                </div>
                <div class="review-item">
                    <span class="review-item-label">User Type</span>
                    <span class="review-item-value">${data.userType ? data.userType.charAt(0).toUpperCase() + data.userType.slice(1) : ''}</span>
                </div>
            </div>
        `;
        container.innerHTML = reviewContent;
    }

    // Toast Notification System
    showToast(message, type = 'info', duration = 5000) {
        const toastContainer = this.getOrCreateToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} toast-enter`;

        const iconMap = {
            success: 'bx-check-circle',
            error: 'bx-error-circle',
            warning: 'bx-error',
            info: 'bx-info-circle'
        };

        toast.innerHTML = `
            <div class="toast-content">
                <i class="bx ${iconMap[type]} toast-icon"></i>
                <span class="toast-message">${message}</span>
            </div>
            <button class="toast-close" aria-label="Close notification">
                <i class="bx bx-x"></i>
            </button>
        `;

        toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('toast-show'), 10);

        const autoRemove = setTimeout(() => {
            this.removeToast(toast);
        }, duration);

        toast.querySelector('.toast-close').addEventListener('click', () => {
            clearTimeout(autoRemove);
            this.removeToast(toast);
        });

        toast.addEventListener('click', (e) => {
            if (!e.target.closest('.toast-close')) {
                clearTimeout(autoRemove);
                this.removeToast(toast);
            }
        });

        return toast;
    }

    getOrCreateToastContainer() {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    removeToast(toast) {
        toast.classList.remove('toast-show');
        toast.classList.add('toast-exit');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    // Top Loader for Quick Actions
    showTopLoader() {
        let loader = document.getElementById('topLoader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'topLoader';
            loader.className = 'top-loader';
            loader.innerHTML = '<div class="top-loader-bar"></div>';
            document.body.appendChild(loader);
        }
        loader.style.display = 'block';
        loader.querySelector('.top-loader-bar').style.width = '0%';

        setTimeout(() => {
            loader.querySelector('.top-loader-bar').style.width = '70%';
        }, 100);
    }

    hideTopLoader() {
        const loader = document.getElementById('topLoader');
        if (loader) {
            loader.querySelector('.top-loader-bar').style.width = '100%';
            setTimeout(() => {
                loader.style.display = 'none';
            }, 200);
        }
    }

    // Instagram-style Loading Overlay
    showLoadingOverlay(withProgress = true, autoProgress = false) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.classList.remove('fade-out');

            if (withProgress) {
                this.updateLoadingProgress(0, 'Loading TransitFLOW...');

                if (autoProgress) {
                    this.startAutoProgress();
                }
            }
        }
    }

    hideLoadingOverlay(delay = 0) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            // Stop any auto progress
            this.stopAutoProgress();

            setTimeout(() => {
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    overlay.style.display = 'none';
                    overlay.classList.remove('fade-out');
                    this.resetLoadingProgress();
                }, 500);
            }, delay);
        }
    }

    updateLoadingProgress(progress, text = null, type = 'info') {
        const progressBar = document.getElementById('loadingProgressBar');
        const loadingText = document.getElementById('loadingText');
        const loadingPercentage = document.getElementById('loadingPercentage');

        if (progressBar) {
            progressBar.style.width = Math.min(Math.max(progress, 0), 100) + '%';

            // Add type-based styling to progress bar
            progressBar.className = 'journey-progress';
            if (type) {
                progressBar.classList.add(`progress-${type}`);
            }
        }

        if (loadingPercentage) {
            loadingPercentage.textContent = Math.round(Math.min(Math.max(progress, 0), 100)) + '%';
        }

        const dotsHtml = `
        <div class="loading-dots">
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
        </div>
        `;

        if (text && loadingText) {
            loadingText.innerHTML = text + dotsHtml;

            // Add type-based styling to text
            loadingText.className = 'loading-text';
            if (type) {
                loadingText.classList.add(`text-${type}`);
            }
        } else if (loadingText && !text) {
            // Auto-update text based on progress
            const stepIndex = Math.floor((progress / 100) * this.loadingSteps.length);
            if (stepIndex < this.loadingSteps.length && stepIndex >= 0) {
                loadingText.innerHTML = this.loadingSteps[stepIndex] + dotsHtml;
            }
        }

        this.loadingProgress = progress;
    }

    startAutoProgress(targetProgress = 90, duration = 3000) {
        this.stopAutoProgress();

        const startProgress = this.loadingProgress;
        const progressDiff = targetProgress - startProgress;
        const stepTime = 50; // Update every 50ms
        const totalSteps = duration / stepTime;
        let currentStep = 0;

        this.loadingInterval = setInterval(() => {
            currentStep++;

            // Use easing function for more realistic progress
            const easeProgress = this.easeOutCubic(currentStep / totalSteps);
            const newProgress = startProgress + (progressDiff * easeProgress);

            this.updateLoadingProgress(newProgress);

            if (currentStep >= totalSteps || newProgress >= targetProgress) {
                this.stopAutoProgress();
            }
        }, stepTime);
    }

    stopAutoProgress() {
        if (this.loadingInterval) {
            clearInterval(this.loadingInterval);
            this.loadingInterval = null;
        }
    }

    resetLoadingProgress() {
        this.loadingProgress = 0;
        this.stopAutoProgress();
    }

    // Easing function for smooth progress animation
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    // Enhanced method to simulate realistic loading with steps and types
    simulateRealisticLoading(steps = [], onComplete = null) {
        this.stopAutoProgress();

        if (steps.length === 0) {
            steps = [
                { progress: 10, text: "Initializing...", type: 'info', delay: 200 },
                { progress: 25, text: "Loading resources...", type: 'info', delay: 800 },
                { progress: 45, text: "Connecting to server...", type: 'info', delay: 600 },
                { progress: 65, text: "Authenticating...", type: 'info', delay: 700 },
                { progress: 80, text: "Loading user data...", type: 'info', delay: 500 },
                { progress: 95, text: "Preparing interface...", type: 'info', delay: 400 },
                { progress: 100, text: "Welcome to TransitFLOW!", type: 'success', delay: 300 }
            ];
        }

        let currentStepIndex = 0;

        const processNextStep = () => {
            if (currentStepIndex >= steps.length) {
                if (onComplete) onComplete();
                return;
            }

            const step = steps[currentStepIndex];
            this.updateLoadingProgress(step.progress, step.text, step.type || 'info');

            currentStepIndex++;
            setTimeout(processNextStep, step.delay || 500);
        };

        processNextStep();
    }

    // Offline Message Handling
    showOfflineMessage() {
        let offlineOverlay = document.getElementById('offlineOverlay');
        if (!offlineOverlay) {
            offlineOverlay = document.createElement('div');
            offlineOverlay.id = 'offlineOverlay';
            offlineOverlay.className = 'offline-overlay';
            offlineOverlay.innerHTML = `
                <div class="offline-content">
                    <i class="bx bx-wifi-off"></i>
                    <h3>No Internet Connection</h3>
                    <p>Your data will be saved locally and synced when connection is restored.</p>
                    <div class="offline-status">
                        <div class="pulse-dot"></div>
                        <span>Waiting for connection...</span>
                    </div>
                </div>
            `;
            document.body.appendChild(offlineOverlay);
        }
        offlineOverlay.style.display = 'flex';
    }

    hideOfflineMessage() {
        const offlineOverlay = document.getElementById('offlineOverlay');
        if (offlineOverlay) {
            offlineOverlay.style.display = 'none';
        }
    }

    // Form State Management
    setLoading(form, isLoading) {
        const submitButton = form.querySelector('button[type="submit"]');
        const inputs = form.querySelectorAll('input, select, button');

        if (isLoading) {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.setAttribute('data-original-text', submitButton.textContent);
                submitButton.innerHTML = '<i class="bx bx-loader-alt rotating"></i> Processing...';
            }
            inputs.forEach(input => input.disabled = true);
        } else {
            if (submitButton) {
                submitButton.disabled = false;
                const originalText = submitButton.getAttribute('data-original-text');
                if (originalText) {
                    submitButton.textContent = originalText;
                    submitButton.removeAttribute('data-original-text');
                }
            }
            inputs.forEach(input => input.disabled = false);
        }
    }

    focusFirstInput() {
        const currentStepElement = document.getElementById('login-form'); // Default fallback
        const targetElement = currentStepElement || document;

        const firstInput = targetElement.querySelector('input:not([readonly]):not([type="checkbox"])');
        if (firstInput) {
            firstInput.focus();
        }
    }

    // Field Error Management
    setFieldError(input, message) {
        this.clearFieldError(input);
        input.classList.add('error', 'is-invalid');

        let errorElement = input.closest('.form-group')?.querySelector('.form-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            errorElement.style.color = '#c33';
        }
    }

    clearFieldError(input) {
        input.classList.remove('error', 'is-invalid');
        const errorElement = input.closest('.form-group')?.querySelector('.form-error');
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    }

    clearAllFieldErrors() {
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            this.clearFieldError(input);
        });
    }

    // Two-Factor Authentication UI
    displayBackupCodes(codes) {
        const container = document.getElementById('backup-codes-display');
        const grid = document.getElementById('backup-codes-grid');

        if (container && grid) {
            grid.innerHTML = codes.map(code =>
                `<div class="backup-code">${code}</div>`
            ).join('');
            container.classList.remove('hidden');
        }
    }

    // Password Visibility Toggle
    togglePasswordVisibility(toggleId) {
        const toggle = document.getElementById(toggleId);
        if (!toggle) return;

        const input = toggle.previousElementSibling;
        if (!input) return;

        const icon = toggle.querySelector('i');
        if (!icon) return;

        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'bx bx-show';
        } else {
            input.type = 'password';
            icon.className = 'bx bx-hide';
        }
    }
}
