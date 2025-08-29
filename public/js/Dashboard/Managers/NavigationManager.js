// File: managers/NavigationManager.js
class NavigationManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.baseUrl = '/account';
        this.currentPath = '';
        this.currentSubsection = null;
    }

    initNavigation() {
        // Get current path from URL
        const currentPath = this.getCurrentPathFromUrl();
        
        // Parse the path and show appropriate section/subsection
        this.navigateToPath(currentPath, false);

        // Handle browser back/forward navigation
        window.addEventListener('popstate', (e) => {
            const path = this.getCurrentPathFromUrl();
            this.navigateToPath(path, false);
        });

        // Intercept navigation link clicks
        this.setupNavigationListeners();
    }

    getCurrentPathFromUrl() {
        const path = window.location.pathname;
        // Remove base URL to get the relative path
        if (path.startsWith(this.baseUrl)) {
            const relativePath = path.substring(this.baseUrl.length);
            return relativePath || '/';
        }
        // If we're at /account (without trailing slash), return /
        if (path === this.baseUrl) {
            return '/';
        }
        return path || '/';
    }

    setupNavigationListeners() {
        // Handle sidebar navigation clicks
        document.addEventListener('click', (e) => {
            const navLink = e.target.closest('[data-section]');
            if (navLink) {
                e.preventDefault();
                const section = navLink.dataset.section;
                this.navigateToSection(section);
            }

            // Handle quick action buttons that might navigate to subsections
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                e.preventDefault();
                const action = actionBtn.dataset.action;
                this.handleQuickAction(action);
            }
        });
    }

    navigateToSection(section) {
        const path = section === 'dashboard' ? '' : `/${section}`;
        this.navigateToPath(path, true);
    }

    navigateToSubsection(section, subsection) {
        const path = section === 'dashboard' ? `/${subsection}` : `/${section}/${subsection}`;
        this.navigateToPath(path, true);
    }

    navigateToPath(path, pushState = true) {
        console.log('Navigating to path:', path);

        // Parse the path
        const pathSegments = path.split('/').filter(segment => segment !== '');
        let section = 'dashboard';
        let subsection = null;

        if (pathSegments.length === 0) {
            section = 'dashboard';
        } else if (pathSegments.length === 1) {
            section = pathSegments[0];
        } else if (pathSegments.length >= 2) {
            section = pathSegments[0];
            subsection = pathSegments[1];
        }

        // Validate section
        const validSections = ['dashboard', 'profile', 'security', 'notifications', 'settings', 'devices', 'sessions', 'analytics', 'audit-logs', 'admin'];
        if (!validSections.includes(section)) {
            console.warn('Invalid section, showing 404:', section);
            this.show404Page();
            return;
        }

        // Validate subsection if present
        if (subsection && !this.isValidSubsection(section, subsection)) {
            console.warn('Invalid subsection, showing 404:', section, subsection);
            this.show404Page();
            return;
        }

        // Update current state
        this.currentPath = path;
        this.currentSubsection = subsection;

        // Show the appropriate view
        if (subsection) {
            this.showSubsection(section, subsection, pushState);
        } else {
            this.showSection(section, pushState);
        }
    }

    isValidSubsection(section, subsection) {
        const validSubsections = {
            'profile': ['personal', 'location', 'avatar'],
            'security': ['change-password', 'two-factor', 'social-accounts', 'delete-account'],
            'settings': ['general', 'notifications', 'privacy', 'export-data'],
            'devices': ['trusted', 'history'],
            'sessions': ['active', 'history'],
            'notifications': ['preferences', 'history'],
            'analytics': ['overview', 'detailed'],
            'audit-logs': ['recent', 'search'],
            'admin': ['users', 'deleted-users', 'backups', 'maintenance']
        };
        
        return validSubsections[section] && validSubsections[section].includes(subsection);
    }

    show404Page() {
        // Hide all sections and subsections
        this.hideAllSections();
        this.hideAllSubsections();

        // Create or show 404 page
        let notFoundContainer = document.getElementById('not-found-section');
        if (!notFoundContainer) {
            notFoundContainer = document.createElement('section');
            notFoundContainer.id = 'not-found-section';
            notFoundContainer.className = 'content-section active';
            notFoundContainer.innerHTML = `
                <div class="not-found-container">
                    <div class="card">
                        <div class="card-body" style="text-align: center; padding: 60px 20px;">
                            <div class="not-found-icon">
                                <i class="fas fa-exclamation-triangle" style="font-size: 64px; color: #e74c3c; margin-bottom: 20px;"></i>
                            </div>
                            <h2>Page Not Found</h2>
                            <p>The page you are looking for doesn't exist or has been moved.</p>
                            <div style="margin-top: 30px;">
                                <button class="btn btn-primary" onclick="dashboard.navigationManager.navigateToSection('dashboard')">
                                    <i class="fas fa-home"></i>
                                    Go to Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            const mainContent = document.querySelector('.main-content');
            mainContent.appendChild(notFoundContainer);
        } else {
            notFoundContainer.classList.add('active');
        }

        // Update page title
        this.updatePageTitle('Page Not Found');
        
        // Update URL without adding to history
        history.replaceState(null, '', window.location.href);
    }

    showSection(sectionName, pushState = true) {
        console.log('Showing section:', sectionName);

        // Hide all sections and subsections
        this.hideAllSections();
        this.hideAllSubsections();

        // Show target section
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
            this.dashboard.currentSection = sectionName;
            this.currentSubsection = null;

            // Update page title and navigation
            this.updatePageTitle(sectionName);
            this.updateActiveNav(sectionName);

            // Load section data
            this.loadSectionData(sectionName);

            // Update URL
            if (pushState) {
                const newPath = sectionName === 'dashboard' ? '' : `/${sectionName}`;
                const newUrl = this.baseUrl + newPath;
                history.pushState({ section: sectionName, path: newPath }, '', newUrl);
            }

            // Close mobile sidebar
            this.closeMobileSidebar();
        }
    }

    showSubsection(section, subsection, pushState = true) {
        console.log('Showing subsection:', section, subsection);

        // Hide all sections first
        this.hideAllSections();

        // Create or show the subsection container
        this.createSubsectionContainer(section, subsection);

        // Update state
        this.dashboard.currentSection = section;
        this.currentSubsection = subsection;

        // Update page title and navigation
        this.updatePageTitle(section, subsection);
        this.updateActiveNav(section);

        // Load subsection data
        this.loadSubsectionData(section, subsection);

        // Update URL
        if (pushState) {
            const newPath = `/${section}/${subsection}`;
            const newUrl = this.baseUrl + newPath;
            history.pushState({ section, subsection, path: newPath }, '', newUrl);
        }

        // Close mobile sidebar
        this.closeMobileSidebar();
    }

    createSubsectionContainer(section, subsection) {
        // Remove existing subsection containers
        this.hideAllSubsections();

        // Create new subsection container
        const subsectionId = `${section}-${subsection}-subsection`;
        let subsectionContainer = document.getElementById(subsectionId);

        if (!subsectionContainer) {
            subsectionContainer = document.createElement('section');
            subsectionContainer.id = subsectionId;
            subsectionContainer.className = 'content-section subsection-container active';
            
            // Add back navigation
            const backNav = this.createBackNavigation(section);
            subsectionContainer.appendChild(backNav);

            // Add subsection content based on section and subsection
            const content = this.createSubsectionContent(section, subsection);
            subsectionContainer.appendChild(content);

            // Insert into main content
            const mainContent = document.querySelector('.main-content');
            mainContent.appendChild(subsectionContainer);
        } else {
            subsectionContainer.classList.add('active');
        }
    }

    createBackNavigation(section) {
        const backNav = document.createElement('div');
        backNav.className = 'back-navigation';
        backNav.innerHTML = `
            <button class="back-btn" onclick="dashboard.navigationManager.navigateToSection('${section}')">
                <i class="fas fa-arrow-left"></i>
                Back to ${this.getSectionTitle(section)}
            </button>
        `;
        return backNav;
    }

    createSubsectionContent(section, subsection) {
        const content = document.createElement('div');
        content.className = 'subsection-content';

        switch (section) {
            case 'profile':
                content.appendChild(this.createProfileSubsection(subsection));
                break;
            case 'security':
                content.appendChild(this.createSecuritySubsection(subsection));
                break;
            case 'settings':
                content.appendChild(this.createSettingsSubsection(subsection));
                break;
            case 'devices':
                content.appendChild(this.createDevicesSubsection(subsection));
                break;
            case 'sessions':
                content.appendChild(this.createSessionsSubsection(subsection));
                break;
            case 'notifications':
                content.appendChild(this.createNotificationsSubsection(subsection));
                break;
            case 'analytics':
                content.appendChild(this.createAnalyticsSubsection(subsection));
                break;
            case 'audit-logs':
                content.appendChild(this.createAuditLogsSubsection(subsection));
                break;
            case 'admin':
                content.appendChild(this.createAdminSubsection(subsection));
                break;
            default:
                content.innerHTML = `<div class="card">
                    <div class="card-header">
                        <h3>${this.getSubsectionTitle(section, subsection)}</h3>
                    </div>
                    <div class="card-body">
                        <p>Content for ${subsection} in ${section} section.</p>
                    </div>
                </div>`;
        }

        return content;
    }

    createProfileSubsection(subsection) {
        const container = document.createElement('div');
        
        switch (subsection) {
            case 'personal':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Personal Information</h3>
                        </div>
                        <div class="card-body">
                            <form id="personalInfoForm">
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label for="firstNameSub">First Name</label>
                                        <input type="text" id="firstNameSub" name="firstName">
                                    </div>
                                    <div class="form-group">
                                        <label for="lastNameSub">Last Name</label>
                                        <input type="text" id="lastNameSub" name="lastName">
                                    </div>
                                    <div class="form-group">
                                        <label for="phoneNumberSub">Phone Number</label>
                                        <input type="tel" id="phoneNumberSub" name="phone">
                                    </div>
                                    <div class="form-group">
                                        <label for="dateOfBirthSub">Date of Birth</label>
                                        <input type="date" id="dateOfBirthSub" name="dateOfBirth">
                                    </div>
                                    <div class="form-group">
                                        <label for="genderSub">Gender</label>
                                        <select id="genderSub" name="gender">
                                            <option value="">Select Gender</option>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                            <option value="prefer_not_to_say">Prefer not to say</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="websiteSub">Website</label>
                                        <input type="url" id="websiteSub" name="website">
                                    </div>
                                    <div class="form-group full-width">
                                        <label for="bioSub">Bio</label>
                                        <textarea id="bioSub" name="bio" rows="3"></textarea>
                                    </div>
                                </div>
                                <div class="form-actions">
                                    <button type="submit" class="btn btn-primary">Update Personal Info</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                break;
                
            case 'location':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Location Settings</h3>
                        </div>
                        <div class="card-body">
                            <form id="locationSubForm">
                                <div class="form-group">
                                    <label for="addressSub">Address</label>
                                    <textarea id="addressSub" name="address" rows="3" placeholder="Enter your home address"></textarea>
                                </div>
                                <div class="form-group">
                                    <label for="landmarkSub">Landmark (Optional)</label>
                                    <input type="text" id="landmarkSub" name="landmark" placeholder="Nearby landmark">
                                </div>
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label for="latitudeSub">Latitude</label>
                                        <input type="number" id="latitudeSub" name="latitude" step="any">
                                    </div>
                                    <div class="form-group">
                                        <label for="longitudeSub">Longitude</label>
                                        <input type="number" id="longitudeSub" name="longitude" step="any">
                                    </div>
                                </div>
                                <div class="form-actions">
                                    <button type="button" class="btn btn-secondary" id="getCurrentLocationSub">
                                        <i class="fas fa-location-arrow"></i>
                                        Use Current Location
                                    </button>
                                    <button type="submit" class="btn btn-primary">Update Location</button>
                                    <button type="button" class="btn btn-danger" id="removeLocationSub">Remove Location</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                break;
                
            case 'avatar':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Profile Picture</h3>
                        </div>
                        <div class="card-body">
                            <div class="profile-avatar-section">
                                <div class="avatar-container">
                                    <img src="" alt="Profile Picture" id="profilePictureSub" class="profile-picture">
                                    <button type="button" class="avatar-upload-btn" id="avatarUploadBtnSub">
                                        <i class="fas fa-camera"></i>
                                    </button>
                                    <input type="file" id="avatarInputSub" accept="image/*" hidden>
                                </div>
                                <div class="avatar-actions">
                                    <button type="button" class="btn btn-primary" id="uploadAvatarBtn">
                                        <i class="fas fa-upload"></i>
                                        Upload New Picture
                                    </button>
                                    <button type="button" class="btn btn-secondary" id="removeAvatarBtn">
                                        <i class="fas fa-trash"></i>
                                        Remove Picture
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                break;
        }
        
        return container;
    }

    createSecuritySubsection(subsection) {
        const container = document.createElement('div');
        
        switch (subsection) {
            case 'change-password':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Change Password</h3>
                        </div>
                        <div class="card-body">
                            <form id="passwordChangeForm">
                                <div class="form-group">
                                    <label for="currentPasswordSub">Current Password</label>
                                    <input type="password" id="currentPasswordSub" name="currentPassword" required>
                                </div>
                                <div class="form-group">
                                    <label for="newPasswordSub">New Password</label>
                                    <input type="password" id="newPasswordSub" name="newPassword" required>
                                </div>
                                <div class="form-group">
                                    <label for="confirmPasswordSub">Confirm New Password</label>
                                    <input type="password" id="confirmPasswordSub" name="confirmPassword" required>
                                </div>
                                <div class="form-actions">
                                    <button type="submit" class="btn btn-primary">Change Password</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                break;
            case 'two-factor':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Two-Factor Authentication</h3>
                        </div>
                        <div class="card-body">
                            <div id="twofaSubsectionStatus">
                                <div class="loading">Loading 2FA settings...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'social-accounts':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Social Accounts</h3>
                        </div>
                        <div class="card-body">
                            <div class="social-accounts-list" id="socialAccountsList">
                                <div class="loading">Loading social accounts...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'delete-account':
                container.innerHTML = `
                    <div class="card danger-zone-card">
                        <div class="card-header">
                            <h3>
                                <i class="fas fa-exclamation-triangle"></i>
                                Delete Account
                            </h3>
                        </div>
                        <div class="card-body">
                            <div class="danger-zone">
                                <div class="danger-item">
                                    <div class="danger-info">
                                        <h4>
                                            <i class="fas fa-trash-alt"></i>
                                            Permanently Delete Account
                                        </h4>
                                        <p>Once you delete your account, there is no going back. Please be certain.</p>
                                        <ul>
                                            <li>All your data will be permanently deleted</li>
                                            <li>Your username will become available to others</li>
                                            <li>You will lose access to all services</li>
                                            <li>This action cannot be undone</li>
                                        </ul>
                                    </div>
                                    <div class="danger-actions">
                                        <button class="btn btn-danger" id="deleteAccountBtnSub">
                                            Request Account Deletion
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                break;
        }
        
        return container;
    }

    createSettingsSubsection(subsection) {
        const container = document.createElement('div');
        
        switch (subsection) {
            case 'general':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>General Settings</h3>
                        </div>
                        <div class="card-body">
                            <form id="generalSettingsForm">
                                <div class="form-group">
                                    <label for="languageSub">Language</label>
                                    <select id="languageSub" name="language" class="form-select">
                                        <option value="en">English</option>
                                        <option value="es">Español</option>
                                        <option value="fr">Français</option>
                                        <option value="de">Deutsch</option>
                                        <option value="it">Italiano</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="timezoneSub">Timezone</label>
                                    <select id="timezoneSub" name="timezone" class="form-select">
                                        <option value="UTC">UTC</option>
                                        <option value="America/New_York">Eastern Time</option>
                                        <option value="America/Chicago">Central Time</option>
                                        <option value="Europe/London">London</option>
                                        <option value="Asia/Karachi">Karachi</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="themeSub">Theme</label>
                                    <select id="themeSub" name="theme" class="form-select">
                                        <option value="auto">Auto</option>
                                        <option value="light">Light</option>
                                        <option value="dark">Dark</option>
                                    </select>
                                </div>
                                <div class="form-actions">
                                    <button type="submit" class="btn btn-primary">Save General Settings</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                break;
            case 'notifications':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Notification Preferences</h3>
                        </div>
                        <div class="card-body">
                            <div class="notification-preferences" id="notificationPreferences">
                                <div class="loading">Loading notification preferences...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'privacy':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Privacy Settings</h3>
                        </div>
                        <div class="card-body">
                            <div class="privacy-options" id="privacyOptions">
                                <div class="loading">Loading privacy settings...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'export-data':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Export Your Data</h3>
                        </div>
                        <div class="card-body">
                            <div class="export-options">
                                <p>Download a copy of your data in various formats.</p>
                                <div class="export-actions">
                                    <button class="btn btn-primary" id="exportJsonBtn">
                                        <i class="fas fa-download"></i>
                                        Export as JSON
                                    </button>
                                    <button class="btn btn-secondary" id="exportCsvBtn">
                                        <i class="fas fa-file-csv"></i>
                                        Export as CSV
                                    </button>
                                    <button class="btn btn-info" id="exportPdfBtn">
                                        <i class="fas fa-file-pdf"></i>
                                        Generate PDF Report
                                    </button>
                                </div>
                                <div class="export-status" id="exportStatus" style="display: none;">
                                    <!-- Export status will be shown here -->
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                break;
        }
        
        return container;
    }

    createDevicesSubsection(subsection) {
        const container = document.createElement('div');
        
        switch (subsection) {
            case 'trusted':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Trusted Devices</h3>
                        </div>
                        <div class="card-body">
                            <div class="trusted-devices-list" id="trustedDevicesList">
                                <div class="loading">Loading trusted devices...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'history':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Device History</h3>
                        </div>
                        <div class="card-body">
                            <div class="device-history-list" id="deviceHistoryList">
                                <div class="loading">Loading device history...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
        }
        
        return container;
    }

    createSessionsSubsection(subsection) {
        const container = document.createElement('div');
        
        switch (subsection) {
            case 'active':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Active Sessions</h3>
                            <button class="btn btn-danger btn-sm" id="logoutAllDevicesSub">
                                <i class="fas fa-sign-out-alt"></i>
                                Logout All Devices
                            </button>
                        </div>
                        <div class="card-body">
                            <div class="active-sessions-list" id="activeSessionsList">
                                <div class="loading">Loading active sessions...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'history':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Session History</h3>
                        </div>
                        <div class="card-body">
                            <div class="session-history-list" id="sessionHistoryList">
                                <div class="loading">Loading session history...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
        }
        
        return container;
    }

    createNotificationsSubsection(subsection) {
        const container = document.createElement('div');
        
        switch (subsection) {
            case 'preferences':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Notification Preferences</h3>
                        </div>
                        <div class="card-body">
                            <div class="notification-prefs" id="notificationPrefs">
                                <div class="loading">Loading notification preferences...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'history':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Notification History</h3>
                        </div>
                        <div class="card-body">
                            <div class="notification-history" id="notificationHistory">
                                <div class="loading">Loading notification history...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
        }
        
        return container;
    }

    createAnalyticsSubsection(subsection) {
        const container = document.createElement('div');
        
        switch (subsection) {
            case 'overview':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Analytics Overview</h3>
                        </div>
                        <div class="card-body">
                            <div class="analytics-overview" id="analyticsOverview">
                                <div class="loading">Loading analytics overview...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'detailed':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Detailed Analytics</h3>
                        </div>
                        <div class="card-body">
                            <div class="detailed-analytics" id="detailedAnalytics">
                                <div class="loading">Loading detailed analytics...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
        }
        
        return container;
    }

    createAuditLogsSubsection(subsection) {
        const container = document.createElement('div');
        
        switch (subsection) {
            case 'recent':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Recent Audit Logs</h3>
                        </div>
                        <div class="card-body">
                            <div class="recent-audit-logs" id="recentAuditLogs">
                                <div class="loading">Loading recent audit logs...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'search':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Search Audit Logs</h3>
                            <div class="audit-filters">
                                <input type="text" id="auditSearchSub" placeholder="Search actions..." class="form-input">
                                <input type="date" id="auditFromDateSub" class="form-input">
                                <input type="date" id="auditToDateSub" class="form-input">
                                <button class="btn btn-primary" id="searchAuditBtn">Search</button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="audit-search-results" id="auditSearchResults">
                                <p>Use the filters above to search through audit logs.</p>
                            </div>
                        </div>
                    </div>
                `;
                break;
        }
        
        return container;
    }

    createAdminSubsection(subsection) {
        const container = document.createElement('div');
        
        switch (subsection) {
            case 'users':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>User Management</h3>
                            <div class="admin-filters">
                                <input type="text" id="adminUserSearchSub" placeholder="Search users..." class="form-input">
                                <select id="adminRoleFilterSub" class="form-select">
                                    <option value="">All Roles</option>
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="admin-users-list-sub" id="adminUsersListSub">
                                <div class="loading">Loading users...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'deleted-users':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Deleted Users</h3>
                            <div class="admin-filters">
                                <input type="text" id="deletedUserSearchSub" placeholder="Search deleted users..." class="form-input">
                                <select id="deletionReasonFilterSub" class="form-select">
                                    <option value="">All Reasons</option>
                                    <option value="user_request">User Request</option>
                                    <option value="admin_action">Admin Action</option>
                                </select>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="deleted-users-list-sub" id="deletedUsersListSub">
                                <div class="loading">Loading deleted users...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'backups':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>Backup Management</h3>
                            <div class="admin-actions">
                                <button id="createPeriodicBackupsSub" class="btn btn-primary">Create Backups</button>
                                <button id="cleanupExpiredBackupsSub" class="btn btn-warning">Cleanup</button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="backups-list-sub" id="backupsListSub">
                                <div class="loading">Loading backups...</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'maintenance':
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3>System Maintenance</h3>
                        </div>
                        <div class="card-body">
                            <div class="maintenance-actions">
                                <button id="cleanupExpiredDataSub" class="btn btn-warning btn-full">
                                    Cleanup Expired Data
                                </button>
                                <button id="processExpiredDeletionsSub" class="btn btn-secondary btn-full">
                                    Process Expired Deletions
                                </button>
                                <button id="fullSystemCleanupSub" class="btn btn-danger btn-full">
                                    Full System Cleanup
                                </button>
                            </div>
                            <div class="maintenance-results" id="maintenanceResults"></div>
                        </div>
                    </div>
                `;
                break;
        }
        
        return container;
    }

    handleQuickAction(action) {
        switch (action) {
            case 'change-password':
                this.navigateToSubsection('security', 'change-password');
                break;
            case 'setup-2fa':
                this.navigateToSubsection('security', 'two-factor');
                break;
            case 'export-data':
                this.navigateToSubsection('settings', 'export-data');
                break;
            case 'update-location':
                this.navigateToSubsection('profile', 'location');
                break;
            default:
                console.log('Unhandled quick action:', action);
        }
    }

    hideAllSections() {
        document.querySelectorAll('.content-section:not(.subsection-container)').forEach(section => {
            section.classList.remove('active');
        });
        // Also hide 404 page if it exists
        const notFoundSection = document.getElementById('not-found-section');
        if (notFoundSection) {
            notFoundSection.classList.remove('active');
        }
    }

    hideAllSubsections() {
        document.querySelectorAll('.subsection-container').forEach(subsection => {
            subsection.remove();
        });
    }

    updatePageTitle(section, subsection = null) {
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            if (subsection) {
                pageTitle.textContent = this.getSubsectionTitle(section, subsection);
            } else {
                pageTitle.textContent = this.getSectionTitle(section);
            }
        }

        // Update document title
        if (typeof this.dashboard.userManager.updateTitle === 'function') {
            this.dashboard.userManager.updateTitle();
        }
    }

    getSectionTitle(section) {
        const titles = {
            'dashboard': 'Dashboard',
            'profile': 'Profile',
            'security': 'Security',
            'notifications': 'Notifications',
            'settings': 'Settings',
            'devices': 'Devices',
            'sessions': 'Sessions',
            'analytics': 'Analytics',
            'audit-logs': 'Audit Logs',
            'admin': 'Admin Panel'
        };
        return titles[section] || 'Dashboard';
    }

    getSubsectionTitle(section, subsection) {
        const titles = {
            'security': {
                'change-password': 'Change Password',
                'two-factor': 'Two-Factor Authentication',
                'social-accounts': 'Social Accounts',
                'delete-account': 'Delete Account'
            },
            'profile': {
                'personal': 'Personal Information',
                'location': 'Location Settings',
                'avatar': 'Profile Picture'
            },
            'settings': {
                'general': 'General Settings',
                'notifications': 'Notification Preferences',
                'privacy': 'Privacy Settings',
                'export-data': 'Export Data'
            },
            'devices': {
                'trusted': 'Trusted Devices',
                'history': 'Device History'
            },
            'sessions': {
                'active': 'Active Sessions',
                'history': 'Session History'
            },
            'notifications': {
                'preferences': 'Notification Preferences',
                'history': 'Notification History'
            },
            'analytics': {
                'overview': 'Analytics Overview',
                'detailed': 'Detailed Analytics'
            },
            'audit-logs': {
                'recent': 'Recent Audit Logs',
                'search': 'Search Audit Logs'
            },
            'admin': {
                'users': 'User Management',
                'deleted-users': 'Deleted Users',
                'backups': 'Backup Management',
                'maintenance': 'System Maintenance'
            }
        };
        
        return titles[section]?.[subsection] || `${section} - ${subsection}`;
    }

    updateActiveNav(section) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(`[data-section="${section}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.remove('show');
        }
    }

    async loadSectionData(section) {
        console.log('Loading data for section:', section);

        try {
            switch (section) {
                case 'dashboard':
                    await this.dashboard.dashboardManager.loadDashboardData();
                    break;
                case 'profile':
                    await this.dashboard.userManager.loadProfileData();
                    break;
                case 'security':
                    await this.dashboard.securityManager.loadSecurityData();
                    break;
                case 'notifications':
                    await this.dashboard.notificationManager.loadNotifications();
                    break;
                case 'settings':
                    await this.dashboard.settingsManager.loadSettings();
                    break;
                case 'devices':
                    await this.dashboard.deviceManager.loadDevices();
                    break;
                case 'sessions':
                    await this.dashboard.sessionManager.loadSessions();
                    break;
                case 'analytics':
                    await this.dashboard.analyticsManager.loadAnalytics();
                    break;
                case 'audit-logs':
                    await this.dashboard.auditLogManager.loadAuditLogs();
                    break;
                case 'admin':
                    await this.dashboard.adminManager.loadAdminData();
                    break;
                default:
                    console.warn(`Unknown section: ${section}`);
            }
        } catch (error) {
            console.error(`Error loading data for section ${section}:`, error);
        }
    }

    async loadSubsectionData(section, subsection) {
        console.log('Loading data for subsection:', section, subsection);

        try {
            switch (section) {
                case 'profile':
                    if (subsection === 'personal') {
                        await this.dashboard.userManager.loadProfileData();
                    } else if (subsection === 'location') {
                        await this.dashboard.userManager.loadLocationData();
                    } else if (subsection === 'avatar') {
                        await this.dashboard.userManager.loadAvatarData();
                    }
                    break;
                case 'security':
                    if (subsection === 'two-factor') {
                        await this.dashboard.securityManager.loadTwoFactorStatus('twofaSubsectionStatus');
                    } else if (subsection === 'social-accounts') {
                        await this.dashboard.securityManager.loadSocialAccounts();
                    }
                    break;
                case 'settings':
                    if (subsection === 'notifications') {
                        await this.dashboard.settingsManager.loadNotificationSettings();
                    } else if (subsection === 'privacy') {
                        await this.dashboard.settingsManager.loadPrivacySettings();
                    }
                    break;
                case 'devices':
                    if (subsection === 'trusted') {
                        await this.dashboard.deviceManager.loadTrustedDevices();
                    } else if (subsection === 'history') {
                        await this.dashboard.deviceManager.loadDeviceHistory();
                    }
                    break;
                case 'sessions':
                    if (subsection === 'active') {
                        await this.dashboard.sessionManager.loadActiveSessions();
                    } else if (subsection === 'history') {
                        await this.dashboard.sessionManager.loadSessionHistory();
                    }
                    break;
                case 'notifications':
                    if (subsection === 'preferences') {
                        await this.dashboard.notificationManager.loadNotificationPreferences();
                    } else if (subsection === 'history') {
                        await this.dashboard.notificationManager.loadNotificationHistory();
                    }
                    break;
                case 'analytics':
                    if (subsection === 'overview') {
                        await this.dashboard.analyticsManager.loadAnalyticsOverview();
                    } else if (subsection === 'detailed') {
                        await this.dashboard.analyticsManager.loadDetailedAnalytics();
                    }
                    break;
                case 'audit-logs':
                    if (subsection === 'recent') {
                        await this.dashboard.auditLogManager.loadRecentAuditLogs();
                    } else if (subsection === 'search') {
                        // Search functionality will be handled by form submission
                    }
                    break;
                case 'admin':
                    if (subsection === 'users') {
                        await this.dashboard.adminManager.loadUsers();
                    } else if (subsection === 'deleted-users') {
                        await this.dashboard.adminManager.loadDeletedUsers();
                    } else if (subsection === 'backups') {
                        await this.dashboard.adminManager.loadBackups();
                    }
                    break;
                // Add other subsection data loading as needed
            }
        } catch (error) {
            console.error(`Error loading data for subsection ${section}/${subsection}:`, error);
        }
    }

    getCurrentSectionName() {
        if (this.currentSubsection) {
            return this.getSubsectionTitle(this.dashboard.currentSection, this.currentSubsection);
        }
        return this.getSectionTitle(this.dashboard.currentSection);
    }

    // Utility method to get current path
    getCurrentPath() {
        return this.currentPath;
    }

    // Method to check if we're in a subsection
    isInSubsection() {
        return this.currentSubsection !== null;
    }
}