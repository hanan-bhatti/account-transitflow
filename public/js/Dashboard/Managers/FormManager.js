// File: managers/FormManager.js
class FormManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    initForms() {
        // Profile form
        document.getElementById('profileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.dashboard.userManager.updateProfileDetails(new FormData(e.target));
        });

        // Password form
        document.getElementById('passwordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.dashboard.userManager.changePassword(new FormData(e.target));
        });

        // Location form
        document.getElementById('locationForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.dashboard.userManager.updateLocation(new FormData(e.target));
        });

        // Settings form
        document.getElementById('settingsForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.dashboard.settingsManager.updateGeneralSettings(new FormData(e.target));
        });

        // Avatar upload
        document.getElementById('avatarUploadBtn').addEventListener('click', () => {
            document.getElementById('avatarInput').click();
        });

        document.getElementById('avatarInput').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.dashboard.userManager.uploadAvatar(e.target.files[0]);
            }
        });

        // Get current location
        document.getElementById('getCurrentLocation').addEventListener('click', () => {
            this.dashboard.userManager.getCurrentLocation();
        });

        // Remove location
        document.getElementById('removeLocation').addEventListener('click', () => {
            this.dashboard.userManager.removeLocation();
        });

        // Mark all notifications as read
        document.getElementById('markAllRead').addEventListener('click', () => {
            this.dashboard.notificationManager.markAllNotificationsAsRead();
        });

        // Logout all devices
        document.getElementById('logoutAllDevices').addEventListener('click', () => {
            this.dashboard.sessionManager.logoutAllDevices();
        });
    }

    initQuickActions() {
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleQuickAction(action);
            });
        });
    }

    handleQuickAction(action) {
        try {
            switch (action) {
                case 'change-password':
                    this.dashboard.navigationManager.showSection('security');
                    break;
                case 'setup-2fa':
                    this.dashboard.securityManager.setup2FA();
                    break;
                case 'export-data':
                    this.dashboard.userManager.exportData();
                    break;
                case 'update-location':
                    this.dashboard.navigationManager.showSection('profile');
                    break;
                default:
                    console.warn(`Unknown quick action: ${action}`);
            }
        } catch (error) {
            console.error('Error handling quick action:', error);
            this.dashboard.toastManager?.showToast('error', 'Error', 'Failed to perform action');
        }
    }
}