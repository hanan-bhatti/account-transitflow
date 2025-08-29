// File: managers/AnalyticsManager.js
class AnalyticsManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    async loadAnalytics() {
        try {
            this.dashboard.loadingManager.showLoading(true);
            const response = await this.dashboard.apiManager.makeRequest('/analytics');
            const analytics = response.data.analytics;
            const container = document.getElementById('analyticsGrid');

            // Add debugging to see what data we're getting
            const analyticsHtml = `
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-calendar"></i>
                </div>
                <div class="stat-info">
                    <h3>${analytics.accountAge || 0}</h3>
                    <p>Days Active</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-sign-in-alt"></i>
                </div>
                <div class="stat-info">
                    <h3>${analytics.totalLogins || 0}</h3>
                    <p>Total Logins</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="stat-info">
                    <h3>${analytics.avgSessionsPerDay || 0}</h3>
                    <p>Avg Sessions/Day</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-chart-line"></i>
                </div>
                <div class="stat-info">
                    <h3>${analytics.totalSessions || 0}</h3>
                    <p>Total Sessions</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-mobile-alt"></i>
                </div>
                <div class="stat-info">
                    <h3>${analytics.uniqueDevices || analytics.deviceCount || 0}</h3>
                    <p>Unique Devices</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-globe"></i>
                </div>
                <div class="stat-info">
                    <h3>${analytics.uniqueLocations || 0}</h3>
                    <p>Unique Locations</p>
                </div>
            </div>
        `;

            container.innerHTML = analyticsHtml;

        } catch (error) {
            container.innerHTML = '<p class="text-center">Error loading analytics</p>';
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to load analytics');
            document.getElementById('analyticsGrid').innerHTML =
                '<p class="text-center">Error loading analytics</p>';
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }
}