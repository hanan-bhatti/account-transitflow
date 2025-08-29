// File: managers/AuditLogManager.js
class AuditLogManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    async loadAuditLogs() {
        try {
            this.dashboard.loadingManager.showLoading(true);
            const response = await this.dashboard.apiManager.makeRequest('/audit-logs');
            const container = document.getElementById('auditLogsList');

            if (response.data.auditLogs.length === 0) {
                container.innerHTML = '<p class="text-center">No audit logs</p>';
                return;
            }

            const logsHtml = response.data.auditLogs.map(log => {
                let formattedDetails = 'No details available';

                if (typeof log.details === 'object' && log.details !== null) {
                    const { userType, deviceInfo } = log.details;
                    const lines = [];

                    if (userType) lines.push(`<p>User Type: ${userType}</p>`);
                    if (deviceInfo?.deviceName) lines.push(`<p>Device: ${deviceInfo.deviceName}</p>`);
                    if (deviceInfo?.location && deviceInfo.location !== 'Unknown Location') {
                        lines.push(`<p>Location: ${deviceInfo.location.city}, ${deviceInfo.location.country || 'Unknown Country'}</p>`);
                    }
                    if (deviceInfo?.ipAddress && deviceInfo.ipAddress !== '::1') {
                        lines.push(`<p>IP: ${deviceInfo.ipAddress}</p>`);
                    }

                    formattedDetails = lines.join('');
                } else if (typeof log.details === 'string') {
                    formattedDetails = log.details;
                }

                return `
                <div class="audit-log-item">
                    <div class="audit-action">${this.formatActionName(log.action)}</div>
                    <div class="audit-details">${formattedDetails}</div>
                    <div class="audit-time">${new Date(log.timestamp).toLocaleString()}</div>
                </div>
            `;
            }).join('');

            container.innerHTML = logsHtml;

        } catch (error) {
            document.getElementById('auditLogsList').innerHTML =
                '<p class="text-center">Error loading audit logs</p>';
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to load audit logs');
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    formatActionName(action) {
        return action.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }
}