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

    // Instagram-style loading overlay methods
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

    updateLoadingProgress(progress, text = null) {
        const progressBar = document.getElementById('loadingProgressBar');
        const loadingText = document.getElementById('loadingText');
        const loadingPercentage = document.getElementById('loadingPercentage');
        
        if (progressBar) {
            progressBar.style.width = Math.min(Math.max(progress, 0), 100) + '%';
        }
        
        if (loadingPercentage) {
            loadingPercentage.textContent = Math.round(Math.min(Math.max(progress, 0), 100)) + '%';
        }
        
        if (text && loadingText) {
            loadingText.textContent = text;
        } else if (loadingText && !text) {
            // Auto-update text based on progress
            const stepIndex = Math.floor((progress / 100) * this.loadingSteps.length);
            if (stepIndex < this.loadingSteps.length && stepIndex >= 0) {
                loadingText.textContent = this.loadingSteps[stepIndex];
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

    // Method to simulate realistic loading with steps
    simulateRealisticLoading(steps = [], onComplete = null) {
        this.stopAutoProgress();
        
        if (steps.length === 0) {
            steps = [
                { progress: 10, text: "Initializing...", delay: 200 },
                { progress: 25, text: "Loading resources...", delay: 800 },
                { progress: 45, text: "Connecting to server...", delay: 600 },
                { progress: 65, text: "Authenticating...", delay: 700 },
                { progress: 80, text: "Loading user data...", delay: 500 },
                { progress: 95, text: "Preparing interface...", delay: 400 },
                { progress: 100, text: "Welcome to TransitFLOW!", delay: 300 }
            ];
        }
        
        let currentStepIndex = 0;
        
        const processNextStep = () => {
            if (currentStepIndex >= steps.length) {
                if (onComplete) onComplete();
                return;
            }
            
            const step = steps[currentStepIndex];
            this.updateLoadingProgress(step.progress, step.text);
            
            currentStepIndex++;
            setTimeout(processNextStep, step.delay || 500);
        };
        
        processNextStep();
    }

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

    togglePasswordVisibility(toggleId) {
        const toggle = document.getElementById(toggleId);
        if (!toggle) return;

        const input = toggle.previousElementSibling;
        if (!input) return;

        if (input.type === 'password') {
            input.type = 'text';
            toggle.className = 'bx bx-show input-icon';
        } else {
            input.type = 'password';
            toggle.className = 'bx bx-hide input-icon';
        }
    }
}