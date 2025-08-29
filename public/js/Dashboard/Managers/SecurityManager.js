// File: managers/SecurityManager.js
class SecurityManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.deletionInputHandler = null;
        this.eventListeners = new Map(); // Track event listeners for cleanup
    }

    // Helper method to add tracked event listeners
    addTrackedEventListener(element, event, handler, options = {}) {
        if (!element) return;

        const key = `${element.id || element.className}_${event}`;

        // Remove existing listener if present
        if (this.eventListeners.has(key)) {
            const oldHandler = this.eventListeners.get(key);
            element.removeEventListener(event, oldHandler, options);
        }

        element.addEventListener(event, handler, options);
        this.eventListeners.set(key, handler);
    }

    // Cleanup method for event listeners
    cleanup() {
        this.eventListeners.clear();
    }

    async loadSecurityData() {
        try {
            await this.load2FAStatus();
            await this.loadSocialAccounts();
            await this.loadDeletionStatus();
            this.initializeBackupCodes();
            this.initializeDeletionControls();
        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to load security data');
        }
    }

    async loadDeletionStatus() {
        try {
            const response = await this.dashboard.apiManager.makeRequest('/deletion-status');
            const status = response.data;

            const deleteAccountBtn = document.getElementById('deleteAccountBtn');
            const requestDeleteBtn = document.getElementById('requestDeleteBtn');

            if (status.hasPendingDeletion) {
                // User has pending deletion request
                if (deleteAccountBtn) {
                    deleteAccountBtn.textContent = 'Cancel Deletion Request';
                    deleteAccountBtn.className = 'btn btn-warning';
                    deleteAccountBtn.title = `Deletion expires: ${new Date(status.deletionTokenExpires).toLocaleString()}`;
                }

                // Show status information
                this.showDeletionPendingStatus(status);
            } else {
                // Normal state - no pending deletion
                if (deleteAccountBtn) {
                    deleteAccountBtn.textContent = 'Request Account Deletion';
                    deleteAccountBtn.className = 'btn btn-danger';
                    deleteAccountBtn.title = 'Request account deletion via email';
                }
            }

        } catch (error) {
            console.error('Failed to load deletion status:', error);
        }
    }

    showDeletionPendingStatus(status) {
        const dangerZone = document.querySelector('.danger-zone');
        if (!dangerZone) return;

        const existingAlert = dangerZone.querySelector('.deletion-pending-alert');
        if (existingAlert) {
            existingAlert.remove();
        }

        const timeRemaining = Math.max(0, new Date(status.deletionTokenExpires) - new Date());
        const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));

        const alertDiv = document.createElement('div');
        alertDiv.className = 'deletion-pending-alert alert alert-warning';
        alertDiv.innerHTML = `
            <div class="d-flex align-items-center justify-content-between">
                <div>
                    <h5><i class="fas fa-clock"></i> Account Deletion Pending</h5>
                    <p class="mb-0">
                        Your account deletion was requested on ${new Date(status.deletionRequestedAt).toLocaleDateString()}.
                        ${hoursRemaining > 0 ? `Confirmation expires in ${hoursRemaining} hours.` : 'Confirmation has expired.'}
                    </p>
                    <small class="text-muted">Check your email for the confirmation link.</small>
                </div>
                <button class="btn btn-sm btn-outline-warning" id="cancelDeletionBtn">
                    Cancel Request
                </button>
            </div>
        `;

        dangerZone.insertBefore(alertDiv, dangerZone.firstChild);

        // Add event listener for cancel button
        const cancelBtn = document.getElementById('cancelDeletionBtn');
        this.addTrackedEventListener(cancelBtn, 'click', () => this.cancelDeletionRequest());
    }

    initializeDeletionControls() {
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');
        const requestDeleteBtn = document.getElementById('requestDeleteBtn');

        if (deleteAccountBtn) {
            this.addTrackedEventListener(deleteAccountBtn, 'click', () => this.handleDeleteAccountClick());
        }

        if (requestDeleteBtn) {
            this.addTrackedEventListener(requestDeleteBtn, 'click', () => this.requestAccountDeletion());
        }
    }

    async handleDeleteAccountClick() {
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');
        if (!deleteAccountBtn) return;

        // Check if this is a cancel deletion request
        if (deleteAccountBtn.textContent.includes('Cancel')) {
            await this.cancelDeletionRequest();
        } else {
            // Regular deletion request
            await this.requestAccountDeletionEmail();
        }
    }

    async cancelDeletionRequest() {
        const confirmed = await this.dashboard.modalManager.showConfirm(
            'Are you sure you want to cancel your account deletion request?'
        );

        if (!confirmed) return;

        try {
            this.dashboard.loadingManager.showLoading(true);

            await this.dashboard.apiManager.makeRequest('/cancel-deletion', {
                method: 'POST'
            });

            this.dashboard.toastManager.showToast('success', 'Success', 'Account deletion request cancelled successfully.');

            // Reload deletion status to update UI
            await this.loadDeletionStatus();

            // Remove pending deletion alert
            const alert = document.querySelector('.deletion-pending-alert');
            if (alert) {
                alert.remove();
            }

        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error',
                error.message || 'Failed to cancel deletion request');
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    async requestAccountDeletionEmail() {
        try {
            const password = await this.getPasswordForDeletion();
            if (!password) return;

            this.dashboard.loadingManager.showLoading(true);

            const response = await this.dashboard.apiManager.makeRequest('/delete-request', {
                method: 'POST',
                body: JSON.stringify({ password })
            });

            this.dashboard.toastManager.showToast('success', 'Deletion Requested',
                'Please check your email for confirmation instructions. The link will expire in 24 hours.');

            // Reload deletion status to show pending state
            await this.loadDeletionStatus();

        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Request Failed',
                error.message || 'Failed to request account deletion');
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    async load2FAStatus() {
        const statusContainer = document.getElementById('twofaStatus');
        const backupCodesSection = document.getElementById('backupCodesSection');

        if (this.dashboard.currentUser?.twoFactorAuth?.isEnabled) {
            const setup2FABtn = document.getElementById('setup-2fa-btn');
            setup2FABtn.disabled = true;
            setup2FABtn.style.cssText = 'cursor: not-allowed !important; opacity: 0.5 !important; pointer-events: all !important;';
            setup2FABtn.textContent = '2 Factor Authentication Enabled';

            // Remove all hover effects by overriding hover styles
            this.addTrackedEventListener(setup2FABtn, 'mouseenter', function (e) {
                e.target.style.cssText = 'cursor: not-allowed !important; opacity: 0.5 !important; pointer-events: all !important; background-color: inherit !important; transform: none !important; box-shadow: none !important; border-color: inherit !important;';
            });
            this.addTrackedEventListener(setup2FABtn, 'mouseleave', function (e) {
                e.target.style.cssText = 'cursor: not-allowed !important; opacity: 0.5 !important; pointer-events: all !important; background-color: inherit !important; transform: none !important; box-shadow: none !important; border-color: inherit !important;';
            });

            const StatusHeader = document.getElementById('twofaHeader');
            StatusHeader.textContent = 'Two-Factor Authentication Enabled';
            StatusHeader.classList.remove('twofaheader-disabled');
            StatusHeader.classList.add('twofaheader-enabled');
            statusContainer.innerHTML = `
            <div class="twofa-enabled">
                <i class="fas fa-shield-alt" style="color: var(--success); font-size: 24px; margin-bottom: 12px;"></i>
                <h4>Two-Factor Authentication is Enabled</h4>
                <p>Your account is protected with 2 factor Authentication</p>
                <button class="btn btn-danger btn-sm" id="disable2FABtn">
                    Disable 2 step factor Authentication
                </button>
            </div>
        `;

            // Show backup codes section when 2FA is enabled
            backupCodesSection.style.display = 'block';

            // Add event listeners
            const disable2FABtn = document.getElementById('disable2FABtn');
            this.addTrackedEventListener(disable2FABtn, 'click', () => this.disable2FA());

        } else {
            const StatusHeader = document.getElementById('twofaHeader');
            StatusHeader.textContent = 'Two-Factor Authentication Disabled';
            StatusHeader.classList.remove('twofaheader-enabled');
            StatusHeader.classList.add('twofaheader-disabled');
            statusContainer.innerHTML = `
            <div class="twofa-disabled">
                <i class="fas fa-exclamation-triangle" style="color: var(--warning); font-size: 24px; margin-bottom: 12px;"></i>
                <h4>Two-Factor Authentication is Disabled</h4>
                <p>Enable 2 step factor Authentication to secure your account</p>
                <button class="btn btn-primary" id="setup2FABtn">
                    Setup 2 step factor Authentication
                </button>
            </div>
        `;

            // Hide backup codes section when 2FA is disabled
            backupCodesSection.style.display = 'none';

            // Add event listener
            const setup2FABtn = document.getElementById('setup2FABtn');
            this.addTrackedEventListener(setup2FABtn, 'click', () => this.setup2FA());
        }
    }

    async loadSocialAccounts() {
        try {
            // Load both linked accounts and available providers
            const [accountsResponse, availableResponse, statsResponse] = await Promise.all([
                this.dashboard.apiManager.makeRequest('/social-accounts'),
                this.dashboard.apiManager.makeRequest('/social-accounts/available'),
                this.dashboard.apiManager.makeRequest('/social-accounts/stats')
            ]);

            this.renderSocialAccountsInterface(accountsResponse.data, availableResponse.data, statsResponse.data);

        } catch (error) {
            console.error('Failed to load social accounts:', error);
            this.renderSocialAccountsError();
        }
    }

    renderSocialAccountsInterface(accountsData, availableData, statsData) {
        const container = document.getElementById('socialAccounts');
        if (!container) return;

        const linkedAccounts = accountsData.socialAccounts || [];
        const availableProviders = availableData.availableProviders || [];

        // Filter for our supported providers only
        const supportedProviders = ['google', 'github', 'facebook'];
        const filteredLinked = linkedAccounts.filter(account =>
            supportedProviders.includes(account.provider)
        );
        const filteredAvailable = availableProviders.filter(provider =>
            supportedProviders.includes(provider.provider)
        );

        container.innerHTML = `
        <div class="social-accounts-container">
            ${this.renderLinkedAccounts(filteredLinked)}
            ${this.renderAvailableProviders(filteredAvailable)}
            ${this.renderSocialStats(statsData)}
        </div>
    `;

        this.attachSocialEventListeners();
    }

    renderLinkedAccounts(linkedAccounts) {
        if (linkedAccounts.length === 0) {
            return `
            <div class="linked-accounts-section">
                <h4 class="section-title">Linked Accounts</h4>
                <div class="no-accounts">
                    <i class="fas fa-link text-muted"></i>
                    <p class="text-muted mb-0">No social accounts linked yet</p>
                </div>
            </div>
        `;
        }

        return `
        <div class="linked-accounts-section">
            <h4 class="section-title">Linked Accounts</h4>
            <div class="social-accounts-grid">
                ${linkedAccounts.map(account => this.renderLinkedAccount(account)).join('')}
            </div>
        </div>
    `;
    }

    renderLinkedAccount(account) {
        const providerConfig = this.getProviderConfig(account.provider);
        const lastSync = account.lastSync ? new Date(account.lastSync).toLocaleDateString() : 'Never';
        const isStale = account.lastSync && (Date.now() - new Date(account.lastSync).getTime()) > (30 * 24 * 60 * 60 * 1000);

        return `
        <div class="social-account-card" data-provider="${account.provider}">
            <div class="account-header">
                <div class="provider-icon ${account.provider}">
                    <i class="${providerConfig.icon}"></i>
                </div>
                <div class="account-info">
                    <h5 class="provider-name">${providerConfig.name}</h5>
                    <p class="account-email">${account.email || 'No email'}</p>
                </div>
                <div class="account-actions">
                    <button class="btn-icon sync-account-btn" 
                            data-provider="${account.provider}" 
                            title="Sync account data">
                        <i class="fas fa-sync-alt ${isStale ? 'text-warning' : ''}"></i>
                    </button>
                    <button class="btn-icon unlink-account-btn" 
                            data-provider="${account.provider}" 
                            title="Unlink account">
                        <i class="fas fa-unlink text-danger"></i>
                    </button>
                </div>
            </div>
            <div class="account-meta">
                <small class="text-muted">
                    <i class="fas fa-clock"></i>
                    Last synced: ${lastSync}
                    ${isStale ? '<span class="text-warning"> (Outdated)</span>' : ''}
                </small>
            </div>
        </div>
    `;
    }

    renderAvailableProviders(availableProviders) {
        if (availableProviders.length === 0) {
            return `
            <div class="available-providers-section">
                <h4 class="section-title">Available Providers</h4>
                <div class="no-providers">
                    <i class="fas fa-check-circle text-success"></i>
                    <p class="text-success mb-0">All supported accounts are linked</p>
                </div>
            </div>
        `;
        }

        return `
        <div class="available-providers-section">
            <h4 class="section-title">Link New Account</h4>
            <div class="providers-grid">
                ${availableProviders.map(provider => this.renderAvailableProvider(provider)).join('')}
            </div>
        </div>
    `;
    }

    renderAvailableProvider(provider) {
        const providerConfig = this.getProviderConfig(provider.provider);

        if (!provider.configured) {
            return `
            <div class="provider-card disabled">
                <div class="provider-icon ${provider.provider}">
                    <i class="${providerConfig.icon}"></i>
                </div>
                <span class="provider-name">${providerConfig.name}</span>
                <span class="status-badge disabled">Not Available</span>
            </div>
        `;
        }

        return `
        <div class="provider-card available" data-provider="${provider.provider}">
            <div class="provider-icon ${provider.provider}">
                <i class="${providerConfig.icon}"></i>
            </div>
            <span class="provider-name">${providerConfig.name}</span>
            <button class="link-provider-btn" data-provider="${provider.provider}">
                <i class="fas fa-plus"></i> Link
            </button>
        </div>
    `;
    }

    renderSocialStats(statsData) {
        if (!statsData || !statsData.security) return '';

        const { security, recommendations } = statsData;
        const hasRecommendations = recommendations && recommendations.length > 0;

        return `
        <div class="social-stats-section ${hasRecommendations ? 'has-recommendations' : ''}">
            <div class="stats-header">
                <h4 class="section-title">Security Overview</h4>
                <div class="auth-methods-count">
                    <span class="badge ${security.totalAuthMethods >= 2 ? 'badge-success' : 'badge-warning'}">
                        ${security.totalAuthMethods} auth method${security.totalAuthMethods !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>
            ${hasRecommendations ? this.renderRecommendations(recommendations) : ''}
        </div>
    `;
    }

    renderRecommendations(recommendations) {
        return `
        <div class="recommendations-list">
            ${recommendations.map(rec => `
                <div class="recommendation-item ${rec.priority}">
                    <div class="rec-icon">
                        <i class="fas ${this.getRecommendationIcon(rec.type)}"></i>
                    </div>
                    <div class="rec-content">
                        <p class="rec-message">${rec.message}</p>
                        ${rec.action ? this.renderRecommendationAction(rec) : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    }

    renderRecommendationAction(rec) {
        switch (rec.action) {
            case 'set_password':
                return '<button class="btn-sm btn-outline-primary rec-action-btn" data-action="set_password">Set Password</button>';
            case 'link_more_accounts':
                return '<button class="btn-sm btn-outline-info rec-action-btn" data-action="link_accounts">Link Accounts</button>';
            case 'sync_accounts':
                return `<button class="btn-sm btn-outline-warning rec-action-btn" data-action="sync_accounts" data-providers="${rec.providers?.join(',')}">Sync Accounts</button>`;
            default:
                return '';
        }
    }

    getRecommendationIcon(type) {
        const icons = {
            'security': 'fa-shield-alt',
            'convenience': 'fa-link',
            'maintenance': 'fa-sync-alt'
        };
        return icons[type] || 'fa-info-circle';
    }

    renderSocialAccountsError() {
        const container = document.getElementById('socialAccounts');
        if (container) {
            container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle text-warning"></i>
                <p class="text-muted">Failed to load social accounts</p>
                <button class="btn btn-sm btn-outline-primary retry-load-btn">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;

            const retryBtn = container.querySelector('.retry-load-btn');
            this.addTrackedEventListener(retryBtn, 'click', () => this.loadSocialAccounts());
        }
    }

    attachSocialEventListeners() {
        const container = document.getElementById('socialAccounts');
        if (!container) return;

        // Link provider buttons
        container.querySelectorAll('.link-provider-btn').forEach(btn => {
            this.addTrackedEventListener(btn, 'click', async (e) => {
                const provider = btn.dataset.provider;
                await this.linkSocialProvider(provider);
            });
        });

        // Unlink account buttons
        container.querySelectorAll('.unlink-account-btn').forEach(btn => {
            this.addTrackedEventListener(btn, 'click', async (e) => {
                const provider = btn.dataset.provider;
                await this.unlinkSocialProvider(provider);
            });
        });

        // Sync account buttons
        container.querySelectorAll('.sync-account-btn').forEach(btn => {
            this.addTrackedEventListener(btn, 'click', async (e) => {
                const provider = btn.dataset.provider;
                await this.syncSocialProvider(provider);
            });
        });

        // Recommendation action buttons
        container.querySelectorAll('.rec-action-btn').forEach(btn => {
            this.addTrackedEventListener(btn, 'click', (e) => {
                const action = btn.dataset.action;
                this.handleRecommendationAction(action, btn.dataset);
            });
        });
    }

    async linkSocialProvider(provider) {
        try {
            this.dashboard.loadingManager.showLoading(true);

            // Get OAuth URL for linking
            const response = await this.dashboard.apiManager.makeRequest(`/oauth/${provider}`);

            if (response.data && response.data.authUrl) {
                // Open OAuth flow in new window
                const width = 600;
                const height = 700;
                const left = (window.screen.width / 2) - (width / 2);
                const top = (window.screen.height / 2) - (height / 2);

                const authWindow = window.open(
                    response.data.authUrl,
                    'socialAuth',
                    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                );

                // Monitor for completion
                this.monitorAuthWindow(authWindow, provider);
            }

        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Link Failed',
                `Failed to initiate ${provider} linking: ${error.message}`);
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    async unlinkSocialProvider(provider) {
        const providerName = this.getProviderConfig(provider).name;

        const confirmed = await this.dashboard.modalManager.showConfirm(
            `Are you sure you want to unlink your ${providerName} account?`,
            'This will remove access via this social account.'
        );

        if (!confirmed) return;

        try {
            this.dashboard.loadingManager.showLoading(true);

            await this.dashboard.apiManager.makeRequest(`/social-accounts/${provider}`, {
                method: 'DELETE'
            });

            this.dashboard.toastManager.showToast('success', 'Account Unlinked',
                `${providerName} account has been unlinked successfully`);

            // Reload social accounts
            await this.loadSocialAccounts();

        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Unlink Failed',
                error.message || `Failed to unlink ${providerName} account`);
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    async syncSocialProvider(provider) {
        const providerName = this.getProviderConfig(provider).name;

        try {
            // Show syncing state
            const syncBtn = document.querySelector(`[data-provider="${provider}"].sync-account-btn`);
            if (syncBtn) {
                syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                syncBtn.disabled = true;
            }

            const response = await this.dashboard.apiManager.makeRequest(`/social-accounts/sync/${provider}`, {
                method: 'POST'
            });

            this.dashboard.toastManager.showToast('success', 'Account Synced',
                `${providerName} account data has been synchronized`);

            // Reload social accounts to show updated data
            await this.loadSocialAccounts();

        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Sync Failed',
                error.message || `Failed to sync ${providerName} account`);

            // Reset button state on error
            const syncBtn = document.querySelector(`[data-provider="${provider}"].sync-account-btn`);
            if (syncBtn) {
                syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                syncBtn.disabled = false;
            }
        }
    }

    monitorAuthWindow(authWindow, provider) {
        const checkClosed = setInterval(() => {
            if (authWindow.closed) {
                clearInterval(checkClosed);

                // Wait a moment for any redirects to complete, then reload
                setTimeout(async () => {
                    try {
                        await this.loadSocialAccounts();
                        this.dashboard.toastManager.showToast('info', 'Checking Status',
                            'Checking account linking status...');
                    } catch (error) {
                        // Silent fail - user might have cancelled
                    }
                }, 1000);
            }
        }, 1000);

        // Clean up if window doesn't close within 10 minutes
        setTimeout(() => {
            clearInterval(checkClosed);
            if (!authWindow.closed) {
                authWindow.close();
            }
        }, 600000);
    }

    handleRecommendationAction(action, data) {
        switch (action) {
            case 'set_password':
                // Navigate to password settings or show password setup modal
                this.dashboard.toastManager.showToast('info', 'Security Tip',
                    'Consider setting a password for backup authentication');
                break;

            case 'link_accounts':
                // Scroll to available providers section
                const availableSection = document.querySelector('.available-providers-section');
                if (availableSection) {
                    availableSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                break;

            case 'sync_accounts':
                // Sync all recommended accounts
                if (data.providers) {
                    const providers = data.providers.split(',');
                    providers.forEach(provider => this.syncSocialProvider(provider));
                }
                break;
        }
    }

    getProviderConfig(provider) {
        const configs = {
            google: {
                name: 'Google',
                icon: 'fab fa-google',
                color: '#db4437'
            },
            github: {
                name: 'GitHub',
                icon: 'fab fa-github',
                color: '#333333'
            },
            facebook: {
                name: 'Facebook',
                icon: 'fab fa-facebook-f',
                color: '#4267b2'
            }
        };

        return configs[provider] || {
            name: provider.charAt(0).toUpperCase() + provider.slice(1),
            icon: 'fas fa-link',
            color: '#6c757d'
        };
    }

    // Keep existing unlinkSocial method for backward compatibility
    async unlinkSocial(provider) {
        return this.unlinkSocialProvider(provider);
    }

    async requestAccountDeletion() {
        this.dashboard.modalManager.showModaldeletion('accountDeletionModal');
        this.dashboard.toastManager.showToast('info', 'Info', 'Type "DELETE MY ACCOUNT" to confirm deletion');

        // Enable/disable the delete button based on confirmation text
        const confirmTextInput = document.getElementById('deleteConfirmText');
        const confirmButton = document.getElementById('confirmDeletionBtn');
        const passwordInput = document.getElementById('deletePassword');
        const deletionForm = document.getElementById('accountDeletionForm');

        if (!confirmTextInput || !confirmButton) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Required elements for account deletion not found');
            return;
        }

        const inputHandler = () => {
            const typed = confirmTextInput.value.trim().toUpperCase();
            const required = 'DELETE MY ACCOUNT';

            if (required === typed) {
                confirmButton.disabled = false;
                confirmButton.style.opacity = '1';
                if (!passwordInput.value) {
                    passwordInput.focus();
                }
            } else {
                confirmButton.disabled = true;
                confirmButton.style.opacity = '0.6';
                confirmButton.style.background = '#894e54';
            }
        };

        this.addTrackedEventListener(confirmTextInput, 'input', inputHandler);

        // Allow pressing Enter in password field to submit
        if (passwordInput) {
            this.addTrackedEventListener(passwordInput, 'keypress', (e) => {
                if (e.key === 'Enter' && !confirmButton.disabled && deletionForm) {
                    e.preventDefault();
                    deletionForm.requestSubmit();
                }
            });
        }

        // Handle form submission
        if (deletionForm) {
            this.addTrackedEventListener(deletionForm, 'submit', (e) => {
                e.preventDefault();
                const formData = new FormData(deletionForm);
                this.confirmAccountDeletion(formData);
            });
        }

        // Handle cancel button
        const cancelBtn = document.getElementById('cancelDeletionBtn');
        if (cancelBtn) {
            this.addTrackedEventListener(cancelBtn, 'click', () => {
                this.dashboard.modalManager.hideModal('accountDeletionModal');
            });
        }

        // Handle modal close
        const modalClose = document.getElementById('deletionModalClose');
        if (modalClose) {
            this.addTrackedEventListener(modalClose, 'click', () => {
                this.dashboard.modalManager.hideModal('accountDeletionModal');
            });
        }
    }

    async confirmAccountDeletion(formData) {
        try {
            this.dashboard.loadingManager.showLoading(true);

            const response = await this.dashboard.apiManager.makeRequest('/account', {
                method: 'DELETE',
                body: JSON.stringify({
                    confirmText: formData.get('confirmText'),
                    password: formData.get('password')
                })
            });

            this.dashboard.modalManager.hideModal('accountDeletionModal');
            this.dashboard.toastManager.showToast('success', 'Account Deleted',
                'Your account has been successfully deleted. You will be redirected shortly.');

            // Clear any stored auth data and redirect after delay
            setTimeout(() => {
                // Clear all storage
                localStorage.clear();
                sessionStorage.clear();

                // Clear all cookies
                document.cookie.split(";").forEach(cookie => {
                    const eqPos = cookie.indexOf("=");
                    const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
                    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;";
                });

                window.location.href = '/';
            }, 3000);

        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Deletion Failed',
                error.message || 'Failed to delete account');
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    async getModalInput(title, message, options = {}) {
        return new Promise((resolve, reject) => {
            const {
                inputType = 'text',
                placeholder = '',
                required = false,
                confirmButtonText = 'Confirm',
                confirmButtonColor = '#007bff',
                inputId = 'modalInput'
            } = options;

            const modalContent = `
            <div class="input-container">
                <p>${message}</p>
                <input 
                    type="${inputType}" 
                    id="${inputId}" 
                    placeholder="${placeholder}" 
                    style="width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ccc; border-radius: 4px;">
                <div class="modal-actions" style="margin-top: 15px; text-align: right;">
                    <button id="modalCancel" style="margin-right: 10px; padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button id="modalConfirm" style="padding: 8px 16px; background: ${confirmButtonColor}; color: white; border: none; border-radius: 4px; cursor: pointer;">${confirmButtonText}</button>
                </div>
            </div>
        `;

            // Show modal with input
            this.dashboard.modalManager.showModal(title, modalContent);

            // Get references to the input and buttons
            const input = document.getElementById(inputId);
            const cancelBtn = document.getElementById('modalCancel');
            const confirmBtn = document.getElementById('modalConfirm');
            const modalCloseBtn = document.getElementById('modalClose');

            // Focus on input
            if (input) input.focus();

            // Handle confirm button click
            if (confirmBtn) {
                confirmBtn.onclick = () => {
                    const value = input ? input.value : '';
                    if (required && !value.trim()) {
                        this.dashboard.toastManager.showToast('error', 'Validation Error', 'This field is required');
                        if (input) input.focus();
                        return;
                    }
                    this.dashboard.modalManager.hideModal();
                    resolve(value || null);
                };
            }

            // Handle cancel button click
            if (cancelBtn) {
                cancelBtn.onclick = () => {
                    this.dashboard.modalManager.hideModal();
                    resolve(null);
                };
            }

            // Handle modal close button click
            if (modalCloseBtn) {
                modalCloseBtn.onclick = () => {
                    this.dashboard.modalManager.hideModal();
                    resolve(null);
                };
            }

            // Handle Enter key press in input
            if (input) {
                input.onkeypress = (e) => {
                    if (e.key === 'Enter' && confirmBtn) {
                        confirmBtn.click();
                    }
                };
            }

            // Handle Escape key press
            const escapeHandler = (e) => {
                if (e.key === 'Escape' && cancelBtn) {
                    cancelBtn.click();
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
        });
    }

    async getPasswordForDeletion() {
        return await this.getModalInput(
            'Account Deletion',
            'Please enter your password to confirm account deletion:',
            {
                inputType: 'password',
                placeholder: 'Enter your password',
                required: true,
                confirmButtonText: 'Confirm Delete',
                confirmButtonColor: '#dc3545'
            }
        );
    }

    async getPasswordFor2FA() {
        return await this.getModalInput(
            'Disable 2FA',
            'Please enter your password to disable 2FA:',
            {
                inputType: 'password',
                placeholder: 'Enter your password',
                required: true,
                confirmButtonText: 'Disable 2FA',
                confirmButtonColor: '#ffc107'
            }
        );
    }

    async getNewRole() {
        return await this.getModalInput(
            'Change User Role',
            'Enter new role (user, moderator, admin, superadmin):',
            {
                placeholder: 'e.g., moderator',
                required: true,
                confirmButtonText: 'Update Role',
                confirmButtonColor: '#28a745'
            }
        );
    }

    async getReason(action) {
        return await this.getModalInput(
            'Reason Required',
            `Reason for ${action}ing this user (optional):`,
            {
                placeholder: 'Enter reason...',
                required: false,
                confirmButtonText: 'Continue',
                confirmButtonColor: '#007bff'
            }
        );
    }

    initializeBackupCodes() {
        // Add event listeners for backup codes buttons
        const viewBackupCodesBtn = document.getElementById('viewBackupCodesBtn');
        const regenerateBackupCodesBtn = document.getElementById('regenerateBackupCodesBtn');

        if (viewBackupCodesBtn) {
            this.addTrackedEventListener(viewBackupCodesBtn, 'click', () => this.viewBackupCodes());
        }

        if (regenerateBackupCodesBtn) {
            this.addTrackedEventListener(regenerateBackupCodesBtn, 'click', () => this.regenerateBackupCodes());
        }
    }

    viewBackupCodes() {
        const backupCodesDisplay = document.getElementById('backupCodesDisplay');

        if (backupCodesDisplay.style.display === 'none' || !backupCodesDisplay.style.display) {
            // Show and load backup codes
            this.loadBackupCodes();
        } else {
            // Hide backup codes
            backupCodesDisplay.style.display = 'none';
            // Update button text
            const viewBtn = document.getElementById('viewBackupCodesBtn');
            if (viewBtn) {
                viewBtn.innerHTML = '<i class="fas fa-eye"></i> View Backup Codes';
            }
        }
    }

    async loadBackupCodes() {
        try {
            // Check if user is authenticated first
            const token = this.dashboard.apiManager.getCookie('authToken') || {};
            console.log('Token found:', !!token);
            if (!token) {
                console.error('No authentication token found');
                this.showBackupCodesMessage('warning', 'Authentication Required',
                    'Please log in to view backup codes.',
                    `<button class="btn btn-primary" onclick="window.location.href='/login'">
                <i class="fas fa-sign-in-alt"></i> Log In
            </button>`
                );
                return;
            }

            // Check if current user data is loaded
            if (!this.dashboard.currentUser) {
                console.error('User data not loaded');
                this.showBackupCodesMessage('info', 'Loading User Data...',
                    'Please wait while we load your account information.',
                    '<div class="spinner-border spinner-border-sm" role="status"></div>'
                );

                // Try to load user data first
                await this.dashboard.userManager.loadUserData();

                // Check again after loading
                if (!this.dashboard.currentUser) {
                    this.showBackupCodesMessage('warning', 'Authentication Required',
                        'Please log in to view backup codes.',
                        `<button class="btn btn-primary" onclick="window.location.href='/login'">
                    <i class="fas fa-sign-in-alt"></i> Log In
                </button>`
                    );
                    return;
                }
            }

            // Always check if 2FA is enabled first
            if (!this.dashboard.currentUser?.twoFactorAuth?.isEnabled) {
                // 2FA not enabled - show setup message
                this.showBackupCodesMessage('info', '2FA Not Enabled',
                    'You need to enable Two-Factor Authentication before you can generate backup codes.',
                    `<button class="btn btn-primary" id="enable2FAFromBackup">
                <i class="fas fa-shield-alt"></i> Enable 2FA
            </button>`
                );

                const enableBtn = document.getElementById('enable2FAFromBackup');
                this.addTrackedEventListener(enableBtn, 'click', () => this.setup2FA());
                return;
            }

            // Show loading state
            this.showBackupCodesMessage('info', 'Loading...',
                'Fetching backup codes status...',
                '<div class="spinner-border spinner-border-sm" role="status"></div>'
            );

            // 2FA is enabled - get backup codes status
            console.log('About to make backup codes request...');
            const response = await this.dashboard.apiManager.makeRequest('/2fa/backup-codes', { method: 'GET' });
            console.log('Backup codes response received:', response);

            // Show the backup codes display
            const backupCodesDisplay = document.getElementById('backupCodesDisplay');
            const container = document.getElementById('backupCodesList');

            if (!backupCodesDisplay || !container) {
                console.error('Required DOM elements not found');
                this.dashboard.toastManager.showToast('error', 'Error', 'Interface error - please refresh the page');
                return;
            }

            backupCodesDisplay.style.display = 'block';

            // Update view button text
            const viewBtn = document.getElementById('viewBackupCodesBtn');
            if (viewBtn) {
                viewBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Backup Codes';
            }

            if (response.data.hasBackupCodes) {
                // User has existing backup codes
                container.innerHTML = `
            <div class="backup-codes-status">
                <div class="alert alert-success">
                    <strong><i class="fas fa-check-circle"></i> Backup codes are available</strong>
                    <p>You have ${response.data.codeCount} backup codes.</p>
                    <p class="text-muted">For security reasons, backup codes are not displayed here. 
                    Use the "Generate New Backup Codes" button to create and view new ones.</p>
                </div>
            </div>
        `;
            } else {
                // No backup codes available
                container.innerHTML = `
            <div class="backup-codes-status">
                <div class="alert alert-warning">
                    <strong><i class="fas fa-exclamation-triangle"></i> No backup codes available</strong>
                    <p>Generate backup codes to secure your account in case you lose access to your authenticator app.</p>
                </div>
            </div>
        `;
            }

        } catch (error) {
            console.error('Error loading backup codes:', error);

            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                this.showBackupCodesMessage('warning', 'Authentication Required',
                    'Your session has expired. Please log in again.',
                    `<button class="btn btn-primary" onclick="window.location.href='/login'">
                <i class="fas fa-sign-in-alt"></i> Log In
            </button>`
                );
            } else if (error.message.includes('Two-factor authentication required')) {
                this.showBackupCodesMessage('warning', '2FA Verification Required',
                    'Please verify your 2FA code first to access backup codes.',
                    `<button class="btn btn-primary" id="verify2FAFromBackup">
                <i class="fas fa-key"></i> Verify 2FA
            </button>`
                );

                const verifyBtn = document.getElementById('verify2FAFromBackup');
                this.addTrackedEventListener(verifyBtn, 'click', () => this.show2FAVerification());
            } else if (error.message.includes('2FA is not enabled')) {
                this.showBackupCodesMessage('info', '2FA Not Enabled',
                    'You need to enable Two-Factor Authentication first.',
                    `<button class="btn btn-primary" id="enable2FAFromError">
                <i class="fas fa-shield-alt"></i> Enable 2FA
            </button>`
                );

                const enableBtn = document.getElementById('enable2FAFromError');
                this.addTrackedEventListener(enableBtn, 'click', () => this.setup2FA());
            } else {
                this.showBackupCodesMessage('danger', 'Error',
                    'Failed to load backup codes. Please try again.',
                    `<button class="btn btn-outline-primary" id="retryLoadBackupCodes">
                <i class="fas fa-redo"></i> Retry
            </button>`
                );

                const retryBtn = document.getElementById('retryLoadBackupCodes');
                this.addTrackedEventListener(retryBtn, 'click', () => this.loadBackupCodes());
                this.dashboard.toastManager.showToast('error', 'Error', 'Failed to load backup codes');
            }
        }
    }

    showBackupCodesMessage(type, title, message, buttonHtml = '') {
        const backupCodesDisplay = document.getElementById('backupCodesDisplay');
        const container = document.getElementById('backupCodesList');

        if (backupCodesDisplay) {
            backupCodesDisplay.style.display = 'block';
        }

        // Update view button text
        const viewBtn = document.getElementById('viewBackupCodesBtn');
        if (viewBtn) {
            viewBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Backup Codes';
        }

        if (container) {
            container.innerHTML = `
        <div class="alert alert-${type}">
            <strong><i class="fas fa-info-circle"></i> ${title}</strong>
            <p>${message}</p>
            ${buttonHtml}
        </div>
    `;
        }
    }

    async regenerateBackupCodes() {
        try {
            // Check if 2FA is enabled first
            if (!this.dashboard.currentUser?.twoFactorAuth?.isEnabled) {
                this.dashboard.toastManager.showToast('error', 'Error', '2FA is not enabled. Please enable 2FA first.');
                return;
            }

            // Show confirmation dialog ONLY ONCE
            const confirmed = await this.dashboard.modalManager.showConfirm('Are you sure you want to generate new backup codes? This will invalidate your existing codes.');
            if (!confirmed) {
                return;
            }

            if (confirmed) {
                // Show loading state
                this.dashboard.loadingManager.showLoading(true);

                // Show loading in backup codes area
                this.showBackupCodesMessage('info', 'Generating...',
                    'Creating new backup codes...',
                    '<div class="spinner-border spinner-border-sm" role="status"></div>'
                );

                // Call the regenerate endpoint
                const response = await this.dashboard.apiManager.makeRequest('/2fa/backup-codes/regenerate', {
                    method: 'POST'
                });

                // IMMEDIATELY display the newly generated codes (don't call loadBackupCodes again)
                if (response.data && response.data.backupCodes) {
                    this.displayBackupCodes(response.data.backupCodes);
                } else {
                    throw new Error('No backup codes received from server');
                }
            }

        } catch (error) {
            console.error('Error generating backup codes:', error);

            if (error.message.includes('Two-factor authentication required')) {
                this.dashboard.toastManager.showToast('warning', '2FA Required', 'Please verify your 2FA code first');
                this.show2FAVerification();
            } else if (error.message.includes('2FA is not enabled')) {
                this.dashboard.toastManager.showToast('error', 'Error', '2FA is not enabled. Please enable 2FA first.');
                this.showBackupCodesMessage('info', '2FA Not Enabled',
                    'You need to enable Two-Factor Authentication first.',
                    `<button class="btn btn-primary" id="enable2FAButtonFromRegen">
                <i class="fas fa-shield-alt"></i> Enable 2FA
            </button>`
                );
                const enable2FAButton = document.getElementById('enable2FAButtonFromRegen');
                this.addTrackedEventListener(enable2FAButton, 'click', () => this.setup2FA());
            } else {
                this.showBackupCodesMessage('danger', 'Error',
                    'Failed to generate new backup codes. Please try again.',
                    `<button class="btn btn-outline-primary" id="retryRegenerateBackupCodes">
                <i class="fas fa-redo"></i> Retry
            </button>`
                );
                const retryButton = document.getElementById('retryRegenerateBackupCodes');
                this.addTrackedEventListener(retryButton, 'click', () => this.regenerateBackupCodes());
                this.dashboard.toastManager.showToast('error', 'Error', 'Failed to generate new backup codes');
            }
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    displayBackupCodes(codes) {
        const backupCodesDisplay = document.getElementById('backupCodesDisplay');
        const container = document.getElementById('backupCodesList');

        if (backupCodesDisplay) {
            backupCodesDisplay.style.display = 'block';
        }

        // Update view button text
        const viewBtn = document.getElementById('viewBackupCodesBtn');
        if (viewBtn && viewBtn.classList.contains('active')) {
            viewBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Backup Codes';
        }

        if (container) {
            container.innerHTML = `
            <div class="backup-codes-generated">
                <div class="alert alert-danger">
                    <strong><i class="fas fa-exclamation-triangle"></i> Important: Save These Codes Now!</strong>
                    <p>These backup codes will not be shown again. Save them securely before closing this page.</p>
                </div>
                
                <div class="backup-codes-grid">
                    ${codes.map((code, index) => `
                    <div class="backup-code-item">
                        <span class="code-number">${index + 1}.</span>
                        <code class="code-value">${code}</code>
                        <button class="btn btn-sm btn-outline-secondary copy-code-btn" 
                            data-code="${code}"
                            title="Copy this code">
                        <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    `).join('')}
                </div>
                
                <div class="backup-codes-actions mt-3">
                    <button class="btn btn-success download-codes-btn" data-codes="${codes.join(',')}">
                    <i class="fas fa-download"></i> Download Codes
                    </button>
                    <button class="btn btn-info copy-all-codes-btn" data-codes="${codes.join('\\n')}">
                    <i class="fas fa-clipboard"></i> Copy All Codes
                    </button>
                    <button class="btn btn-secondary view-backup-codes-btn">
                    <i class="fas fa-check"></i> I've Saved These Codes
                    </button>
                </div>
            </div>
        `;

            // Attach event listeners to dynamically created elements
            container.querySelectorAll('.copy-code-btn').forEach(btn => {
                this.addTrackedEventListener(btn, 'click', () => {
                    const code = btn.dataset.code;
                    this.copyToClipboard(code);
                });
            });

            container.querySelectorAll('.download-codes-btn').forEach(btn => {
                this.addTrackedEventListener(btn, 'click', () => {
                    const codes = btn.dataset.codes;
                    this.downloadBackupCodes(codes);
                });
            });

            container.querySelectorAll('.copy-all-codes-btn').forEach(btn => {
                this.addTrackedEventListener(btn, 'click', () => {
                    const codes = btn.dataset.codes;
                    this.copyAllBackupCodes(codes);
                });
            });

            container.querySelectorAll('.view-backup-codes-btn').forEach(btn => {
                this.addTrackedEventListener(btn, 'click', () => {
                    this.viewBackupCodes();
                });
            });
        }

        // Show the warning section
        const warningSection = document.querySelector('.backup-codes-warning');
        if (warningSection) {
            warningSection.style.display = 'block';
        }
    }

    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.dashboard.toastManager.showToast('success', 'Copied', 'Code copied to clipboard');
            }).catch(() => {
                this.fallbackCopyToClipboard(text);
            });
        } else {
            this.fallbackCopyToClipboard(text);
        }
    }

    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.opacity = '0';

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            this.dashboard.toastManager.showToast('success', 'Copied', 'Text copied to clipboard');
        } catch (err) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to copy text');
        }

        document.body.removeChild(textArea);
    }

    copyAllBackupCodes(codesText) {
        const formattedCodes = `TransitFLOW Backup Codes\nGenerated: ${new Date().toLocaleString()}\n\n${codesText.split('\n').map((code, index) => `${index + 1}. ${code}`).join('\n')}\n\nKeep these codes safe! Each code can only be used once.`;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(formattedCodes).then(() => {
                this.dashboard.toastManager.showToast('success', 'Copied', 'All backup codes copied to clipboard');
            }).catch(() => {
                this.fallbackCopyToClipboard(formattedCodes);
            });
        } else {
            this.fallbackCopyToClipboard(formattedCodes);
        }
    }

    downloadBackupCodes(codesString) {
        const codes = codesString.split(',');
        const content = `TransitFLOW - Two-Factor Authentication Backup Codes\n\n` +
            `Generated: ${new Date().toLocaleString()}\n` +
            `Account: ${this.dashboard.currentUser.email}\n\n` +
            `IMPORTANT: Keep these codes safe and secure!\n` +
            `Each code can only be used once.\n\n` +
            `Backup Codes:\n` +
            codes.map((code, index) => `${index + 1}. ${code}`).join('\n') +
            `\n\nIf you lose access to your authenticator app, you can use these codes to regain access to your account.\n` +
            `Generate new backup codes if you suspect these have been compromised.`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transitflow-backup-codes-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.dashboard.toastManager.showToast('success', 'Downloaded', 'Backup codes saved to file');
    }

    async setup2FA() {
        try {
            const response = await this.dashboard.apiManager.makeRequest('/2fa/setup', { method: 'POST' });
            this.show2FASetupModal(response.data);
        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to setup 2FA');
        }
    }

    show2FASetupModal(setupData) {
        const modalBody = document.getElementById('modalBody');
        if (modalBody) {
            modalBody.innerHTML = `
            <div class="two-factor-setup">
                <div class="text-center mb-4">
                    <h3>Setup Two-Factor Authentication</h3>
                    <p>Scan this QR code with your authenticator app:</p>
                    <div class="qr-code-container text-center mb-3">
                        <img src="${setupData.qrCodeUrl}" alt="QR Code" class="qr-code">
                    </div>
                    <p class="p-of-secret-key"><strong>Secret Key: Click to copy key</strong> <code id="secretKey" class="secret-key-copy" title="Click to copy">${setupData.secret}</code></p>
                </div>
                
                <div class="verification-section mb-3">
                    <label for="verificationCode" class="form-label">Enter verification code:</label>
                    <input type="text" id="twoFAToken" class="form-control" maxlength="6" placeholder="xxxxxx" required>
                </div>
                
                <div class="modal-buttons d-flex justify-content-end gap-2 mb-4">
                    <button type="button" id="cancel2FA" class="btn btn-secondary">Cancel</button>
                    <button type="button" id="verify2FA" class="btn btn-primary">Verify & Enable</button>
                </div>
                
                <div class="backup-codes-section">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h4 class="mb-0">Backup Codes</h4>
                        <div class="backup-actions">
                            <button type="button" id="copyAllCodes" class="btn btn-sm btn-outline-primary me-2" title="Copy all codes">
                                <i class="fas fa-copy"></i> Copy All
                            </button>
                            <button type="button" id="downloadCodes" class="btn btn-sm btn-outline-secondary" title="Download codes as file">
                                <i class="fas fa-download"></i> Download
                            </button>
                        </div>
                    </div>
                    <p>Save these backup codes in a safe place:</p>
                    <div class="backup-codes row">
                        ${setupData.backupCodes.map((code, index) => `
                            <div class="col-6 mb-2">
                                <code class="backup-code" data-code="${code}" title="Click to copy">${code}</code>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

            // Add event listeners after DOM is updated
            const cancelBtn = document.getElementById('cancel2FA');
            const verifyBtn = document.getElementById('verify2FA');
            const verificationInput = document.getElementById('twoFAToken');
            const secretKey = document.getElementById('secretKey');
            const copyAllBtn = document.getElementById('copyAllCodes');
            const downloadBtn = document.getElementById('downloadCodes');
            const backupCodeElements = document.querySelectorAll('.backup-code');

            // Secret key copy handler
            if (secretKey) {
                this.addTrackedEventListener(secretKey, 'click', async () => {
                    try {
                        await navigator.clipboard.writeText(setupData.secret);

                        // Visual feedback
                        const originalText = secretKey.textContent;
                        secretKey.textContent = 'Copied!';
                        secretKey.style.backgroundColor = '#d4edda';
                        secretKey.style.color = '#155724';

                        setTimeout(() => {
                            secretKey.textContent = originalText;
                            secretKey.style.backgroundColor = '';
                            secretKey.style.color = '';
                        }, 2000);

                    } catch (err) {
                        // Fallback for older browsers
                        this.fallbackCopyToClipboard(setupData.secret);

                        // Visual feedback for fallback
                        const originalText = secretKey.textContent;
                        secretKey.textContent = 'Copied!';
                        setTimeout(() => {
                            secretKey.textContent = originalText;
                        }, 2000);
                    }
                });

                // Add cursor pointer style
                secretKey.style.cursor = 'pointer';
            }

            // Individual backup code copy handlers
            backupCodeElements.forEach(codeElement => {
                codeElement.style.cursor = 'pointer';
                this.addTrackedEventListener(codeElement, 'click', () => {
                    const code = codeElement.getAttribute('data-code');
                    this.copyToClipboard(code);

                    // Visual feedback
                    const originalText = codeElement.textContent;
                    const originalBg = codeElement.style.backgroundColor;
                    const originalColor = codeElement.style.color;

                    codeElement.textContent = 'Copied!';
                    codeElement.style.backgroundColor = '#d4edda';
                    codeElement.style.color = '#155724';

                    setTimeout(() => {
                        codeElement.textContent = originalText;
                        codeElement.style.backgroundColor = originalBg;
                        codeElement.style.color = originalColor;
                    }, 1500);
                });
            });

            // Copy all backup codes handler
            if (copyAllBtn) {
                this.addTrackedEventListener(copyAllBtn, 'click', () => {
                    const codesText = setupData.backupCodes.join('\n');
                    this.copyAllBackupCodes(codesText);
                });
            }

            // Download backup codes handler
            if (downloadBtn) {
                this.addTrackedEventListener(downloadBtn, 'click', () => {
                    const codesString = setupData.backupCodes.join(',');
                    this.downloadBackupCodes(codesString);
                });
            }

            // Cancel button handler
            if (cancelBtn) {
                this.addTrackedEventListener(cancelBtn, 'click', () => {
                    this.dashboard.modalManager.hideModal();
                });
            }

            // Verify button handler
            if (verifyBtn) {
                this.addTrackedEventListener(verifyBtn, 'click', () => {
                    const code = verificationInput ? verificationInput.value.trim() : '';
                    if (!code) {
                        this.dashboard.toastManager.showToast('error', 'Invalid Code', 'Please enter a verification code');
                        return;
                    } else if (code.length === 6) {
                        this.verify2FASetup(code);
                    } else {
                        this.dashboard.toastManager.showToast('error', 'Invalid Code', 'Please enter a 6-digit verification code');
                    }
                });
            }

            // Allow Enter key to submit
            if (verificationInput) {
                this.addTrackedEventListener(verificationInput, 'keypress', (e) => {
                    if (e.key === 'Enter' && verifyBtn) {
                        verifyBtn.click();
                    }
                });

                // Auto-focus the input
                setTimeout(() => {
                    verificationInput.focus();
                }, 100);
            }
        }

        this.dashboard.modalManager.showModal('Setup 2FA');
    }

    async verify2FASetup() {
        try {
            const token = document.getElementById('twoFAToken')?.value;
            if (!token || token.length !== 6) {
                this.dashboard.toastManager.showToast('error', 'Invalid Token', 'Please enter a valid 6-digit token');
                return;
            }
            await this.dashboard.apiManager.makeRequest('/2fa/verify-setup', {
                method: 'POST',
                body: JSON.stringify({ token })
            });

            this.dashboard.modalManager.hideModal();
            await this.load2FAStatus();
            this.dashboard.toastManager.showToast('success', 'Success', '2FA enabled successfully');

        } catch (error) {
            console.error('Error verifying 2FA setup:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to verify 2FA setup');
        }
    }

    async disable2FA() {
        const password = await this.getPasswordFor2FA();
        if (!password) return;

        try {
            await this.dashboard.apiManager.makeRequest('/2fa/disable', {
                method: 'DELETE',
                body: JSON.stringify({ password })
            });

            await this.load2FAStatus();
            this.dashboard.toastManager.showToast('success', 'Success', '2FA disabled successfully');

        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to disable 2FA');
        }
    }

    async unlinkSocial(provider) {
        if (!await this.dashboard.modalManager.showConfirm(`Are you sure you want to unlink your ${provider} account?`)) {
            return;
        }

        try {
            await this.dashboard.apiManager.makeRequest(`/social-accounts/${provider}`, { method: 'DELETE' });
            await this.loadSocialAccounts();
            this.dashboard.toastManager.showToast('success', 'Success', `${provider} account unlinked`);
        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', `Failed to unlink ${provider} account`);
        }
    }

    // Add method for checking deletion token (for external confirmation pages)
    async checkDeletionToken(token) {
        try {
            const response = await this.dashboard.apiManager.makeRequest(`/check-deletion-token?token=${encodeURIComponent(token)}`);
            return response.data;
        } catch (error) {
            console.error('Error checking deletion token:', error);
            return { isValid: false };
        }
    }

    // Method to handle external deletion confirmation
    async handleExternalDeletionConfirmation(token, confirmText, password) {
        try {
            this.dashboard.loadingManager.showLoading(true);

            const response = await this.dashboard.apiManager.makeRequest('/confirm-deletion', {
                method: 'POST',
                body: JSON.stringify({
                    token,
                    confirmText,
                    password
                })
            });

            return {
                success: true,
                data: response.data
            };

        } catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to confirm deletion'
            };
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }
}