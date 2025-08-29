// File: managers/SessionManager.js
class SessionManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    async loadSessions() {
        try {
            this.dashboard.loadingManager.showLoading(true);
            const response = await this.dashboard.apiManager.makeRequest('/sessions');
            const container = document.getElementById('sessionsList');

            if (response.data.sessions.length === 0) {
                container.innerHTML = '<p class="text-center">No active sessions</p>';
                return;
            }

            const sessionsHtml = response.data.sessions.map(session => `
            <div class="session-item ${session.isCurrent ? 'current-session' : ''}" data-session-id="${session.sessionId}">
    <div class="session-info">
        <div class="session-icon">
            <i class="${this.dashboard.deviceManager.getDeviceIcon(session.device.platform)}"></i>
        </div>
        <div class="session-details">
            <h4>
                ${session.device.deviceName || session.device.platform} 
                ${session.isCurrent ? '(Current)' : ''}
            </h4>
            
            <p>${session.device.browser} • ${session.device.os}</p>
            <p>
                IP: ${session.device.ipAddress} • 
                ${session.device.location?.city || 'Unknown City'} • 
                ${session.device.location?.country || 'Unknown Country'}
            </p>

            <p>Expires: ${new Date(session.expiresAt).toLocaleString()}</p>
            
            <p>Status: ${session.isActive ? 'Active' : 'Inactive'} • 
            </p>
        </div>
    </div>

    ${!session.isCurrent ? `
        <button class="btn btn-danger btn-sm session-revoke-btn" data-session-id="${session.sessionId}">
            <i class="fas fa-times"></i> Revoke
        </button>
    ` : '<span class="current-badge">Current</span>'}
</div>
        `).join('');

            container.innerHTML = sessionsHtml;

            // Add event delegation for revoke buttons
            container.addEventListener('click', (e) => {
                if (e.target.closest('.session-revoke-btn')) {
                    const button = e.target.closest('.session-revoke-btn');
                    const sessionId = button.dataset.sessionId;
                    this.revokeSession(sessionId);
                }
            });

        } catch (error) {
            document.getElementById('sessionsList').innerHTML =
                '<p class="text-center">Error loading sessions</p>';
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to load sessions');
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    async revokeSession(sessionId) {
        if (!await this.dashboard.modalManager.showConfirm('Are you sure you want to revoke this session? You will be logged out from that device.')) {
            return;
        }

        try {
            // Show loading state
            const button = document.querySelector(`[data-session-id="${sessionId}"].session-revoke-btn`);
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Revoking...';
            }

            await this.dashboard.apiManager.makeRequest(`/sessions/${sessionId}`, {
                method: 'DELETE'
            });

            // Remove the session from DOM
            const sessionItem = document.querySelector(`[data-session-id="${sessionId}"].session-item`);
            if (sessionItem) {
                sessionItem.remove();
            }

            // Check if no sessions left
            const remainingSessions = document.querySelectorAll('.session-item').length;
            if (remainingSessions === 0) {
                document.getElementById('sessionsList').innerHTML = '<p class="text-center">No active sessions</p>';
            }

            this.dashboard.toastManager.showToast('success', 'Success', 'Session revoked successfully');

        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to revoke session');

            // Reset button state on error
            const button = document.querySelector(`[data-session-id="${sessionId}"].session-revoke-btn`);
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-times"></i> Revoke';
            }
        }
    }

    async logoutAllDevices() {
        if (!await this.dashboard.modalManager.showConfirm('Are you sure you want to logout from all devices? You will need to login again.')) {
            return;
        }

        try {
            await this.dashboard.apiManager.makeRequest('/logout-all', { method: 'POST' });
            this.dashboard.toastManager.showToast('success', 'Success', 'Logged out from all devices');
            // Redirect to login after a delay
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to logout from all devices');
        }
    }
}