// File: managers/DeviceManager.js
class DeviceManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    async loadDevices() {
        try {
            this.dashboard.loadingManager.showLoading(true);
            const response = await this.dashboard.apiManager.makeRequest('/devices');
            const container = document.getElementById('devicesList');

            if (response.data.devices.length === 0) {
                container.innerHTML = '<p class="text-center">No devices found</p>';
                return;
            }

            const devicesHtml = response.data.devices.map(device => {
                const isTrustedLabel = device.isTrusted
                    ? '<span class="badge bg-success">Trusted</span>'
                    : '<span class="badge bg-secondary">Not Trusted</span>';

                const suspiciousLabel = device.suspiciousActivity?.reported
                    ? '<span class="badge bg-danger">Suspicious Activity</span>'
                    : '';

                const markTrustedButton = !device.isTrusted
                    ? `<button class="btn btn-primary btn-sm mark-trusted-btn" data-device-id="${device.deviceId}">
                        Mark as Trusted
                   </button>`
                    : '';

                const reportSuspiciousButton = device.isTrusted
                    ? `<button class="btn btn-warning btn-sm report-suspicious-btn" data-device-id="${device.deviceId}">
                        Report Suspicious
                   </button>`
                    : '';

                return `
                <div class="device-item" data-device-id="${device.deviceId}">
                    <div class="device-info">
                        <div class="device-icon">
                            <i class="${this.getDeviceIcon(device.platform)}"></i>
                        </div>
                        <div class="device-details">
                            <h4>${device.deviceName || device.platform} ${isTrustedLabel} ${suspiciousLabel}</h4>
                            <p>${device.browser} • ${device.os}</p>
                            <p>Last used: ${new Date(device.lastUsed).toLocaleString()}</p>
                            ${device.suspiciousActivity?.reported ? 
                                `<p class="text-danger"><small>Suspicious activity reported: ${device.suspiciousActivity.activityType || 'General'}</small></p>` : ''}
                        </div>
                    </div>
                    <div class="device-actions">
                        ${markTrustedButton}
                        ${reportSuspiciousButton}
                        <button class="btn btn-danger btn-sm remove-device-btn" data-device-id="${device.deviceId}">
                            Remove
                        </button>
                    </div>
                </div>
            `;
            }).join('');

            // Add bulk actions header if there are multiple devices
            const bulkActionsHtml = response.data.devices.length > 1 ? `
                <div class="bulk-actions-header">
                    <div class="bulk-select-all">
                        <label class="checkbox-label">
                            <input type="checkbox" id="selectAllDevices">
                            <span>Select All</span>
                        </label>
                    </div>
                    <div class="bulk-actions">
                        <button class="btn btn-danger btn-sm" id="bulkRemoveDevices" disabled>
                            Remove Selected
                        </button>
                    </div>
                </div>
            ` : '';

            container.innerHTML = bulkActionsHtml + devicesHtml;

            this.attachEventListeners(container);

        } catch (error) {
            document.getElementById('devicesList').innerHTML =
                '<p class="text-center">Error loading devices</p>';
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to load devices');
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    attachEventListeners(container) {
        // Remove device buttons
        container.querySelectorAll('.remove-device-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deviceId = e.currentTarget.getAttribute('data-device-id');
                this.removeDevice(deviceId);
            });
        });

        // Mark as trusted buttons
        container.querySelectorAll('.mark-trusted-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deviceId = e.currentTarget.getAttribute('data-device-id');
                this.markAsTrusted(deviceId);
            });
        });

        // Report suspicious activity buttons
        container.querySelectorAll('.report-suspicious-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deviceId = e.currentTarget.getAttribute('data-device-id');
                this.showReportSuspiciousModal(deviceId);
            });
        });

        // Bulk selection functionality
        const selectAllCheckbox = container.querySelector('#selectAllDevices');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const deviceCheckboxes = container.querySelectorAll('.device-checkbox');
                const bulkRemoveBtn = container.querySelector('#bulkRemoveDevices');
                
                deviceCheckboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
                
                bulkRemoveBtn.disabled = !e.target.checked;
            });
        }

        // Individual device selection
        container.querySelectorAll('.device-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateBulkActionButtons(container);
            });
        });

        // Bulk remove button
        const bulkRemoveBtn = container.querySelector('#bulkRemoveDevices');
        if (bulkRemoveBtn) {
            bulkRemoveBtn.addEventListener('click', () => {
                this.bulkRemoveDevices(container);
            });
        }
    }

    updateBulkActionButtons(container) {
        const selectedDevices = container.querySelectorAll('.device-checkbox:checked');
        const bulkRemoveBtn = container.querySelector('#bulkRemoveDevices');
        const selectAllCheckbox = container.querySelector('#selectAllDevices');
        
        if (bulkRemoveBtn) {
            bulkRemoveBtn.disabled = selectedDevices.length === 0;
            bulkRemoveBtn.textContent = selectedDevices.length > 0 
                ? `Remove Selected (${selectedDevices.length})` 
                : 'Remove Selected';
        }

        // Update select all checkbox state
        if (selectAllCheckbox) {
            const allCheckboxes = container.querySelectorAll('.device-checkbox');
            const checkedCount = selectedDevices.length;
            
            if (checkedCount === 0) {
                selectAllCheckbox.indeterminate = false;
                selectAllCheckbox.checked = false;
            } else if (checkedCount === allCheckboxes.length) {
                selectAllCheckbox.indeterminate = false;
                selectAllCheckbox.checked = true;
            } else {
                selectAllCheckbox.indeterminate = true;
            }
        }
    }

    getDeviceIcon(platform) {
        const icons = {
            'mobile': 'fas fa-mobile-alt',
            'tablet': 'fas fa-tablet-alt',
            'desktop': 'fas fa-desktop',
            'default': 'fas fa-laptop'
        };
        return icons[platform?.toLowerCase()] || icons.default;
    }

    async removeDevice(deviceId) {
        if (!await this.dashboard.modalManager.showConfirm('Are you sure you want to remove this device?')) {
            return;
        }

        try {
            await this.dashboard.apiManager.makeRequest(`/devices/${deviceId}`, { method: 'DELETE' });
            await this.loadDevices();
            this.dashboard.toastManager.showToast('success', 'Success', 'Device removed successfully');
        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to remove device');
        }
    }

    async markAsTrusted(deviceId) {
        try {
            await this.dashboard.apiManager.makeRequest(`/devices/${deviceId}/trust`, {
                method: 'PATCH'
            });
            this.dashboard.toastManager.showToast('success', 'Success', 'Device marked as trusted');
            this.loadDevices(); // Refresh the list
        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to mark device as trusted');
        }
    }

    async reportSuspiciousActivity(deviceId, activityData) {
        try {
            // Fix: Properly serialize the request body as JSON
            await this.dashboard.apiManager.makeRequest(`/devices/${deviceId}/suspicious-activity`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(activityData) // Fixed: Convert object to JSON string
            });
            this.dashboard.toastManager.showToast('success', 'Success', 'Suspicious activity reported. Device trust revoked for security.');
            this.loadDevices(); // Refresh the list
        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to report suspicious activity');
        }
    }

    async bulkRemoveDevices(container) {
        const selectedCheckboxes = container.querySelectorAll('.device-checkbox:checked');
        const deviceIds = Array.from(selectedCheckboxes).map(cb => cb.value);

        if (deviceIds.length === 0) {
            this.dashboard.toastManager.showToast('warning', 'Warning', 'No devices selected');
            return;
        }

        const confirmMessage = `Are you sure you want to remove ${deviceIds.length} selected device(s)?`;
        if (!await this.dashboard.modalManager.showConfirm(confirmMessage)) {
            return;
        }

        try {
            // Fix: Properly serialize the request body as JSON
            await this.dashboard.apiManager.makeRequest('/devices/bulk-remove', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ deviceIds }) // Fixed: Convert object to JSON string
            });
            
            this.dashboard.toastManager.showToast('success', 'Success', 
                `Successfully removed ${deviceIds.length} device(s)`);
            this.loadDevices(); // Refresh the list
        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to remove selected devices');
        }
    }

    showReportSuspiciousModal(deviceId) {
        const modalContent = `
            <form id="reportSuspiciousForm">
                <div class="form-group">
                    <label for="activityType">Activity Type</label>
                    <select id="activityType" name="activityType" class="form-select" required>
                        <option value="">Select activity type</option>
                        <option value="unauthorized_access">Unauthorized Access</option>
                        <option value="unusual_behavior">Unusual Behavior</option>
                        <option value="malware_suspected">Malware Suspected</option>
                        <option value="compromised_account">Compromised Account</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="description">Description</label>
                    <textarea id="description" name="description" class="form-textarea" rows="3" 
                        placeholder="Please describe the suspicious activity..." required></textarea>
                </div>
                <div class="form-group">
                    <label for="ipAddress">IP Address (if known)</label>
                    <input type="text" id="ipAddress" name="ipAddress" class="form-input" 
                        placeholder="e.g., 192.168.1.1">
                </div>
                <div class="form-group">
                    <label for="location">Location (if known)</label>
                    <input type="text" id="location" name="location" class="form-input" 
                        placeholder="e.g., New York, USA">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="cancelReport">Cancel</button>
                    <button type="submit" class="btn btn-danger">Report & Revoke Trust</button>
                </div>
            </form>
        `;

        this.dashboard.modalManager.showModal('Report Suspicious Activity', modalContent);

        // Attach form event listeners
        const form = document.getElementById('reportSuspiciousForm');
        const cancelBtn = document.getElementById('cancelReport');

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(form);
                
                // Fix: Properly construct the activity data object
                const activityData = {
                    activityType: formData.get('activityType'),
                    description: formData.get('description'),
                    ipAddress: formData.get('ipAddress') || null,
                    location: formData.get('location') || null
                };

                // Filter out null/empty values to keep the payload clean
                const cleanedActivityData = Object.fromEntries(
                    Object.entries(activityData).filter(([_, value]) => value !== null && value !== '')
                );

                await this.reportSuspiciousActivity(deviceId, cleanedActivityData);
                this.dashboard.modalManager.hideModal();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.dashboard.modalManager.hideModal();
            });
        }
    }
}