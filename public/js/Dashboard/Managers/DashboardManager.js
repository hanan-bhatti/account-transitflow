// File: managers/DashboardManager.js
class DashboardManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    async loadDashboardData() {
        try {
            this.dashboard.loadingManager.showLoading(true);
            // Load analytics for dashboard stats
            this.dashboard.securityManager.load2FAStatus();
            
            const setup2FABtn = document.getElementById('setup-2fa-btn');
            if (setup2FABtn) { // Check if element exists
                if (this.dashboard.currentUser?.twoFactorAuth?.isEnabled) {
                    setup2FABtn.disabled = true;
                    setup2FABtn.style.cssText = 'cursor: not-allowed !important; opacity: 0.5 !important; pointer-events: all !important;';
                    setup2FABtn.textContent = '2 Factor Authentication Enabled';
                    
                    // Remove all hover effects by overriding hover styles
                    setup2FABtn.addEventListener('mouseenter', function(e) {
                        e.target.style.cssText = 'cursor: not-allowed !important; opacity: 0.5 !important; pointer-events: all !important; background-color: inherit !important; transform: none !important; box-shadow: none !important; border-color: inherit !important;';
                    });
                    setup2FABtn.addEventListener('mouseleave', function(e) {
                        e.target.style.cssText = 'cursor: not-allowed !important; opacity: 0.5 !important; pointer-events: all !important; background-color: inherit !important; transform: none !important; box-shadow: none !important; border-color: inherit !important;';
                    });
                } else {
                    setup2FABtn.textContent = 'Enable 2 Factor Authentication';
                    setup2FABtn.disabled = false;
                    setup2FABtn.style.cssText = ''; // Clear any inline styles
                    
                    // Remove event listeners when enabled
                    setup2FABtn.replaceWith(setup2FABtn.cloneNode(true));
                }
            }
            
            const analyticsResponse = await this.dashboard.apiManager.makeRequest('/analytics');
            const analytics = analyticsResponse.data.analytics;

            // Update stat cards
            document.getElementById('accountAge').textContent = analytics.accountAge || 0;
            document.getElementById('totalLogins').textContent = analytics.totalLogins || 0;
            document.getElementById('avgSessions').textContent = analytics.avgSessionsPerDay || 0;

            // Calculate security score
            let securityScore = 100;
            if (!this.dashboard.currentUser?.isEmailVerified) securityScore -= 20;
            if (!this.dashboard.currentUser?.twoFactorAuth?.isEnabled) securityScore -= 30;
            if (!this.dashboard.currentUser?.phone) securityScore -= 10;

            document.getElementById('securityScore').textContent = `${securityScore}%`;

            // Load recent activity
            await this.loadRecentActivity();

        } catch (error) {
            document.getElementById('dashboardContent').innerHTML =
                '<p class="text-center">Error loading dashboard data</p>';
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to load dashboard data');
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    async loadRecentActivity() {
        try {
            const response = await this.dashboard.apiManager.makeRequest('/audit-logs?limit=5');
            const activityList = document.getElementById('recentActivity');

            if (response.data.auditLogs.length === 0) {
                activityList.innerHTML = '<p class="text-center">No recent activity</p>';
                return;
            }

            const activitiesHtml = response.data.auditLogs.map(log => {
                const iconMap = {
                    'login': 'fas fa-sign-in-alt',
                    'logout': 'fas fa-sign-out-alt',
                    'profile_update': 'fas fa-user-edit',
                    'password_change': 'fas fa-key',
                    '2fa_enabled': 'fas fa-shield-alt',
                    'default': 'fas fa-info-circle'
                };

                const icon = iconMap[log.action] || iconMap.default;
                const time = new Date(log.timestamp).toLocaleString();

                return `
                    <div class="activity-item">
                        <div class="activity-icon">
                            <i class="${icon}"></i>
                        </div>
                        <div class="activity-info">
                            <h4>${this.dashboard.auditLogManager.formatActionName(log.action)}</h4>
                        </div>
                        <div class="activity-time">${time}</div>
                    </div>
                `;
            }).join('');

            activityList.innerHTML = activitiesHtml;

        } catch (error) {
            document.getElementById('recentActivity').innerHTML =
                '<p class="text-center">Error loading activity</p>';
        }
    }
}