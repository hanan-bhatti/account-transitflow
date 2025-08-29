// File: managers/AuthManager.js
class AuthManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    async isAuthenticated() {
        try {
            const response = await this.dashboard.apiManager.makeRequest('/me');
            if (response.data && response.data.user) {
                this.currentUser = response.data.user;
                return true; // User is authenticated
            } else {
                this.currentUser = null;
                return false;
            }
        } catch (error) {
            console.error('Authentication check failed:', error);
            window.location.href = '/login';
            this.currentUser = null;

            if (error.status !== 401) {
                this.dashboard.toastManager.showToast('Authentication check failed', 'error');
                window.location.href = '/login';
            }

            return false;
        }
    }

    async checkAuthAndRedirect() {
        const isAuth = await this.isAuthenticated();

        if (!isAuth) {
            // Only redirect if user is not authenticated
            window.location.href = '/login';
        } else {
            // User is authenticated, you can proceed with your app logic
            console.log('User authenticated:', this.currentUser);
        }
    }

    async logout() {
        try {
            await this.dashboard.apiManager.makeRequest('/logout', { method: 'POST' });
        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to logout');
        }

        localStorage.removeItem('token');
        this.dashboard.toastManager.showToast('success', 'Success', 'Logged out successfully');

        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    }
}