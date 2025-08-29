// File: managers/SettingsManager.js
class SettingsManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    async loadSettings() {
        try {
            this.dashboard.loadingManager.showLoading(true);
            const response = await this.dashboard.apiManager.makeRequest('/settings');
            const settings = response?.data?.settings || {};

            // Apply theme from database if available
            if (settings.theme && settings.theme !== this.dashboard.currentTheme) {
                this.dashboard.currentTheme = settings.theme;
                this.dashboard.themeManager.applyTheme(settings.theme);
            }

            // Update general settings form safely
            const settingsForm = document.getElementById('settingsForm');
            if (settingsForm) {
                if (settingsForm.language) {
                    settingsForm.language.value = settings.language || 'en';
                }
                if (settingsForm.timezone) {
                    settingsForm.timezone.value = settings.timezone || 'UTC';
                }
                if (settingsForm.theme) {
                    settingsForm.theme.value = settings.theme || 'auto';
                }
                if (settingsForm.gender) {
                    settingsForm.gender.value = settings.gender || '';
                }
            }

            // Sync custom theme dropdown highlight
            if (settings.theme) {
                document.querySelectorAll('.theme-option').forEach(opt => {
                    opt.classList.toggle('active', opt.dataset.theme === settings.theme);
                });
            }

            // Load other settings sections
            await Promise.all([
                this.loadNotificationSettings(settings),
                this.loadPrivacySettings(settings)
            ]);

        } catch (error) {
            console.error('Error loading settings:', error);

            const settingsContainer = document.getElementById('settingsContainer');
            if (settingsContainer) {
                settingsContainer.innerHTML = '<p class="text-center">Failed to load settings</p>';
            }

            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to load settings');
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    async loadNotificationSettings(settings) {
        const container = document.getElementById('notificationSettings');
        const notifications = settings.notifications || {};

        const settingsHtml = `
        <div class="setting-group">
            <h4>Email Notifications</h4>
            <div class="setting-item">
                <div class="setting-info">
                    <h5>Security Alerts</h5>
                    <p>Get notified about security-related activities</p>
                </div>
                <div class="toggle-switch ${notifications.email?.security ? 'active' : ''}" 
                     data-setting="notifications.email.security">
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <h5>Account Updates</h5>
                    <p>Receive notifications about account changes</p>
                </div>
                <div class="toggle-switch ${notifications.email?.updates ? 'active' : ''}" 
                     data-setting="notifications.email.updates">
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <h5>Marketing</h5>
                    <p>Receive marketing emails</p>
                </div>
                <div class="toggle-switch ${notifications.email?.marketing ? 'active' : ''}" 
                     data-setting="notifications.email.marketing">
                </div>
            </div>
        </div>
        <div class="setting-group">
            <h4>Push Notifications</h4>
            <div class="setting-item">
                <div class="setting-info">
                    <h5>Security Alerts</h5>
                    <p>Push notifications for security events</p>
                </div>
                <div class="toggle-switch ${notifications.push?.security ? 'active' : ''}" 
                     data-setting="notifications.push.security">
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <h5>Updates</h5>
                    <p>Push notifications for account updates</p>
                </div>
                <div class="toggle-switch ${notifications.push?.updates ? 'active' : ''}" 
                     data-setting="notifications.push.updates">
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <h5>Marketing</h5>
                    <p>Push notifications for promotions</p>
                </div>
                <div class="toggle-switch ${notifications.push?.marketing ? 'active' : ''}" 
                     data-setting="notifications.push.marketing">
                </div>
            </div>
        </div>
        <div class="setting-group">
            <h4>SMS Notifications</h4>
            <div class="setting-item">
                <div class="setting-info">
                    <h5>Security Alerts</h5>
                    <p>SMS notifications for security events</p>
                </div>
                <div class="toggle-switch ${notifications.sms?.security ? 'active' : ''}" 
                     data-setting="notifications.sms.security">
                </div>
            </div>
        </div>
    `;

        container.innerHTML = settingsHtml;
        this.initToggleSwitches();
    }

    async loadPrivacySettings(settings) {
        const container = document.getElementById('privacySettings');
        const privacy = settings.privacy || {};

        const settingsHtml = `
        <div class="setting-group">
            <h4>Profile Visibility</h4>
            <div class="setting-item">
                <div class="setting-info">
                    <h5>Profile Visibility</h5>
                    <p>Control who can see your profile</p>
                </div>
                <div class="select-wrapper">
                    <select class="setting-select" data-setting="privacy.profileVisibility">
                        <option value="public" ${privacy.profileVisibility === 'public' ? 'selected' : ''}>Public</option>
                        <option value="friends" ${privacy.profileVisibility === 'friends' ? 'selected' : ''}>Friends Only</option>
                        <option value="private" ${privacy.profileVisibility === 'private' ? 'selected' : ''}>Private</option>
                    </select>
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <h5>Location Sharing</h5>
                    <p>Allow sharing your location with other users</p>
                </div>
                <div class="toggle-switch ${privacy.locationSharing ? 'active' : ''}" 
                     data-setting="privacy.locationSharing">
                </div>
            </div>
        </div>
        <div class="setting-group">
            <h4>Data Collection</h4>
            <div class="setting-item">
                <div class="setting-info">
                    <h5>Analytics</h5>
                    <p>Allow collection of usage analytics</p>
                </div>
                <div class="toggle-switch ${privacy.dataCollection?.analytics ? 'active' : ''}" 
                     data-setting="privacy.dataCollection.analytics">
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <h5>Marketing</h5>
                    <p>Receive marketing communications</p>
                </div>
                <div class="toggle-switch ${privacy.dataCollection?.marketing ? 'active' : ''}" 
                     data-setting="privacy.dataCollection.marketing">
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <h5>Personalization</h5>
                    <p>Allow data collection for personalized experience</p>
                </div>
                <div class="toggle-switch ${privacy.dataCollection?.personalization ? 'active' : ''}" 
                     data-setting="privacy.dataCollection.personalization">
                </div>
            </div>
        </div>
    `;

        container.innerHTML = settingsHtml;
        this.initToggleSwitches();
        this.initSelectElements();
    }

    initToggleSwitches() {
        // Remove existing event listeners to prevent duplicates
        document.querySelectorAll('.toggle-switch').forEach(toggle => {
            // Clone and replace to remove all event listeners
            const newToggle = toggle.cloneNode(true);
            toggle.parentNode.replaceChild(newToggle, toggle);
        });

        // Add fresh event listeners
        document.querySelectorAll('.toggle-switch').forEach(toggle => {
            toggle.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const setting = toggle.dataset.setting;

                // Temporarily disable the toggle to prevent double-clicks
                toggle.style.pointerEvents = 'none';

                try {
                    // Toggle the visual state immediately for better UX
                    const wasActive = toggle.classList.contains('active');
                    toggle.classList.toggle('active');
                    const newValue = toggle.classList.contains('active');
                    // Update the setting
                    await this.updateSetting(setting, newValue);

                } catch (error) {
                    // Revert the visual state if the update failed
                    toggle.classList.toggle('active');
                    this.dashboard.toastManager.showToast('error', 'Error', 'Failed to update setting');
                } finally {
                    // Re-enable the toggle
                    setTimeout(() => {
                        toggle.style.pointerEvents = 'auto';
                    }, 300);
                }
            });

            // Add visual feedback for hover
            toggle.addEventListener('mouseenter', () => {
                toggle.style.transform = 'scale(1.05)';
            });

            toggle.addEventListener('mouseleave', () => {
                toggle.style.transform = 'scale(1)';
            });
        });
    }

    initSelectElements() {
        document.querySelectorAll('.setting-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const setting = e.target.dataset.setting;
                const value = e.target.value;
                this.updateSetting(setting, value);
            });
        });
    }

    async updateSetting(settingPath, value) {
        try {
            // Create a unique key for this request
            const requestKey = `${settingPath}_${value}`;

            // Prevent duplicate requests
            if (this.dashboard.pendingSettingRequests && this.dashboard.pendingSettingRequests.has(requestKey)) {
                console.log('Duplicate request prevented for:', requestKey);
                return this.dashboard.pendingSettingRequests.get(requestKey);
            }

            // Validate the setting path
            if (!settingPath || typeof settingPath !== 'string') {
                throw new Error('Invalid setting path');
            }

            const pathParts = settingPath.split('.');
            const updateData = {};

            // Build nested object correctly
            let current = updateData;
            for (let i = 0; i < pathParts.length - 1; i++) {
                if (!current[pathParts[i]]) {
                    current[pathParts[i]] = {};
                }
                current = current[pathParts[i]];
            }
            current[pathParts[pathParts.length - 1]] = value;

            // Create and store the promise
            const requestPromise = this.dashboard.apiManager.makeRequest('/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            }).then(response => {
                if (response && response.success) {
                    // Only show success toast for non-theme settings to avoid spam
                    if (settingPath !== 'theme') {

                    }
                } else {
                    throw new Error(response?.message || 'Failed to update setting');
                    show.this.dashboard.toastManager.showToast('error', 'Error', response?.message || 'Failed to update setting');
                }
                return response;
            }).finally(() => {
                // Clean up the pending request
                this.dashboard.pendingSettingRequests.delete(requestKey);
            });

            this.dashboard.pendingSettingRequests.set(requestKey, requestPromise);
            return await requestPromise;

        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', error.message || 'Failed to update setting');
            throw error;
        }
    }

    validateSettingsStructure(settings) {
        return {
            language: settings.language || 'en',
            timezone: settings.timezone || 'UTC',
            theme: settings.theme || 'light',
            notifications: {
                email: {
                    enabled: settings.notifications?.email?.enabled ?? true,
                    security: settings.notifications?.email?.security ?? true,
                    marketing: settings.notifications?.email?.marketing ?? false,
                    updates: settings.notifications?.email?.updates ?? true
                },
                push: {
                    enabled: settings.notifications?.push?.enabled ?? true,
                    security: settings.notifications?.push?.security ?? true,
                    marketing: settings.notifications?.push?.marketing ?? false,
                    updates: settings.notifications?.push?.updates ?? true
                },
                sms: {
                    enabled: settings.notifications?.sms?.enabled ?? false,
                    security: settings.notifications?.sms?.security ?? false,
                    marketing: settings.notifications?.sms?.marketing ?? false
                }
            },
            privacy: {
                profileVisibility: settings.privacy?.profileVisibility || 'public',
                locationSharing: settings.privacy?.locationSharing ?? false,
                dataCollection: {
                    analytics: settings.privacy?.dataCollection?.analytics ?? true,
                    marketing: settings.privacy?.dataCollection?.marketing ?? false,
                    personalization: settings.privacy?.dataCollection?.personalization ?? true
                }
            }
        };
    }

    async updateGeneralSettings(formData) {
        try {
            this.dashboard.loadingManager.showLoading(true);

            const updateData = {};
            for (let [key, value] of formData.entries()) {
                updateData[key] = value;
            }

            // If theme is being updated, apply it immediately
            if (updateData.theme) {
                await this.dashboard.themeManager.applyTheme(updateData.theme);
            }

            const response = await this.dashboard.apiManager.makeRequest('/settings', {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });

            return response;

        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to update settings');
            throw error;
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }
}