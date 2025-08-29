// network/NetworkManager.js
class NetworkManager {
    constructor(config) {
        this.config = config;
        this.isOnline = navigator.onLine;
        this.offlineQueue = JSON.parse(localStorage.getItem(config.offlineQueueKey) || '[]');
        this.retryQueue = [];
        this.uiManager = null; // Will be injected
        this.apiClient = null; // Will be injected
    }

    setUIManager(uiManager) {
        this.uiManager = uiManager;
    }

    setApiClient(apiClient) {
        this.apiClient = apiClient;
    }

    setupMonitoring() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            if (this.uiManager) {
                this.uiManager.hideOfflineMessage();
                this.uiManager.showToast('Connection restored! Processing pending requests...', 'success');
            }
            this.processOfflineQueue();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            if (this.uiManager) {
                this.uiManager.showOfflineMessage();
                this.uiManager.showToast('Connection lost. Data will be saved locally.', 'warning');
            }
        });
    }

    saveOfflineData(action, data) {
        const offlineItem = {
            id: Date.now().toString(),
            action,
            data,
            timestamp: new Date().toISOString()
        };

        this.offlineQueue.push(offlineItem);
        localStorage.setItem(this.config.offlineQueueKey, JSON.stringify(this.offlineQueue));
    }

    async processOfflineQueue() {
        if (!this.isOnline || this.offlineQueue.length === 0 || !this.apiClient) {
            return;
        }

        if (this.uiManager) {
            this.uiManager.showToast(`Processing ${this.offlineQueue.length} pending request(s)...`, 'info');
        }

        const processedItems = [];

        for (const item of this.offlineQueue) {
            try {
                let response;
                switch (item.action) {
                    case 'login':
                        response = await this.apiClient.call('/login', 'POST', item.data);
                        if (response.success && this.uiManager) {
                            this.uiManager.showToast('Login completed successfully!', 'success');
                        }
                        break;
                    case 'register':
                        response = await this.apiClient.call('/register', 'POST', item.data);
                        if (response.success && this.uiManager) {
                            this.uiManager.showToast('Registration completed! Please verify your email.', 'success');
                        }
                        break;
                    case 'email_verify':
                        response = await this.apiClient.call('/verify-email', 'POST', item.data);
                        if (response.success && this.uiManager) {
                            this.uiManager.showToast('Email verified successfully!', 'success');
                        }
                        break;
                    case '2fa_verify':
                        response = await this.apiClient.call('/verify-2fa', 'POST', item.data);
                        if (response.success && this.uiManager) {
                            this.uiManager.showToast('2FA verified successfully!', 'success');
                        }
                        break;
                    case 'backup_code_verify':
                        response = await this.apiClient.call('/verify-2fa', 'POST', item.data);
                        if (response.success && this.uiManager) {
                            this.uiManager.showToast('Backup code verified successfully!', 'success');
                        }
                        break;
                    case 'forgot_password':
                        response = await this.apiClient.call('/forgot-password', 'POST', item.data);
                        if (response.success && this.uiManager) {
                            this.uiManager.showToast('Password reset email sent!', 'success');
                        }
                        break;
                    case '2fa_setup':
                        response = await this.apiClient.call('/2fa/verify-setup', 'POST', item.data, true);
                        if (response.success && this.uiManager) {
                            this.uiManager.showToast('2FA setup completed!', 'success');
                        }
                        break;
                }
                processedItems.push(item);
            } catch (error) {
                console.error('Failed to process offline item:', error);
                if (this.uiManager) {
                    this.uiManager.showToast(`Failed to process ${item.action}: ${this.getErrorMessage(error)}`, 'error');
                }
            }
        }

        // Remove processed items
        this.offlineQueue = this.offlineQueue.filter(item => !processedItems.includes(item));
        localStorage.setItem(this.config.offlineQueueKey, JSON.stringify(this.offlineQueue));

        if (processedItems.length > 0 && this.uiManager) {
            this.uiManager.showToast(`Successfully processed ${processedItems.length} request(s)!`, 'success');
        }
    }

    getErrorMessage(error) {
        if (this.apiClient) {
            return this.apiClient.getErrorMessage(error);
        }
        return 'An error occurred while processing the request.';
    }
}