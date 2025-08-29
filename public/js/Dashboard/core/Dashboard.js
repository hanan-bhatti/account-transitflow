// File: core/Dashboard.js
class Dashboard {
    constructor() {
        this.apiBase = 'https://api-auth.transitflow.qzz.io/api/users';
        this.currentUser = null;
        this.currentTheme = localStorage.getItem('theme') || 'auto';
        this.currentSection = 'dashboard'; // Changed to lowercase to match navigation
        this.currentDynamicTheme = JSON.parse(localStorage.getItem('dynamicThemeInfo')) || null;
        this.pendingSettingRequests = new Map(); // Shared for settings updates
        this.themeRefreshTimeout = null;
        this.isInitialized = false;

        // Initialize managers
        this.apiManager = new ApiManager(this.apiBase);
        this.themeManager = new ThemeManager(this);
        this.authManager = new AuthManager(this);
        this.userManager = new UserManager(this);
        this.navigationManager = new NavigationManager(this);
        this.eventManager = new EventManager(this);
        this.formManager = new FormManager(this);
        this.securityManager = new SecurityManager(this);
        this.notificationManager = new NotificationManager(this);
        this.settingsManager = new SettingsManager(this);
        this.deviceManager = new DeviceManager(this);
        this.sessionManager = new SessionManager(this);
        this.analyticsManager = new AnalyticsManager(this);
        this.auditLogManager = new AuditLogManager(this);
        this.adminManager = new AdminManager(this);
        this.modalManager = new ModalManager(this);
        this.toastManager = new ToastManager(this);
        this.loadingManager = new LoadingManager(this);
        this.dashboardManager = new DashboardManager(this);
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('Initializing Dashboard...');

        try {
            // Show loading state
            this.loadingManager.showLoading(true);

            // Initialize theme first (before authentication check)
            this.themeManager.applyTheme(this.currentTheme);
            this.themeManager.initTheme();

            // Check authentication status
            const isAuthenticated = await this.authManager.isAuthenticated();
            if (!isAuthenticated) {
                console.log('User not authenticated, redirecting to login...');
                window.location.href = '/login';
                return;
            }

            // Load current user data
            await this.userManager.loadCurrentUser();

            // Initialize event listeners
            this.eventManager.initEventListeners();
            this.eventManager.initializeSecurityEventListeners();

            // Initialize navigation (this handles the current URL routing)
            this.navigationManager.initNavigation();

            // Update user display and sync theme
            this.userManager.updateUserDisplay();
            await this.userManager.syncThemeWithDatabase();

            // Load notifications in background
            this.notificationManager.loadNotifications();

            this.isInitialized = true;
            console.log('Dashboard initialized successfully');

        } catch (error) {
            console.error('Error initializing dashboard:', error);
            this.toastManager.show('Failed to initialize dashboard', 'error');
            
            // On critical errors, redirect to login after a delay
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } finally {
            // Always hide loader
            this.loadingManager.showLoading(false);
        }
    }

    // Method to refresh current section data
    async refreshCurrentSection() {
        if (!this.isInitialized) return;
        
        try {
            if (this.navigationManager.isInSubsection()) {
                await this.navigationManager.loadSubsectionData(
                    this.currentSection, 
                    this.navigationManager.currentSubsection
                );
            } else {
                await this.navigationManager.loadSectionData(this.currentSection);
            }
        } catch (error) {
            console.error('Error refreshing current section:', error);
            this.toastManager.show('Failed to refresh section data', 'error');
        }
    }

    // Method to navigate programmatically
    navigateTo(section, subsection = null) {
        if (subsection) {
            this.navigationManager.navigateToSubsection(section, subsection);
        } else {
            this.navigationManager.navigateToSection(section);
        }
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Set current user
    setCurrentUser(user) {
        this.currentUser = user;
        this.userManager.updateUserDisplay();
    }

    // Get current section info
    getCurrentSectionInfo() {
        return {
            section: this.currentSection,
            subsection: this.navigationManager.currentSubsection,
            path: this.navigationManager.getCurrentPath(),
            title: this.navigationManager.getCurrentSectionName()
        };
    }

    // Handle logout
    async logout() {
        try {
            await this.authManager.logout();
        } catch (error) {
            console.error('Error during logout:', error);
            // Force redirect even if API call fails
            window.location.href = '/login';
        }
    }

    // Update theme
    setTheme(theme) {
        this.currentTheme = theme;
        this.themeManager.setTheme(theme);
    }

    // Show toast notification
    showToast(message, type = 'info') {
        this.toastManager.show(message, type);
    }

    // Show modal
    showModal(title, content, options = {}) {
        this.modalManager.show(title, content, options);
    }

    // Close modal
    closeModal() {
        this.modalManager.close();
    }

    // Cleanup method
    cleanup() {
        if (this.themeRefreshTimeout) {
            clearTimeout(this.themeRefreshTimeout);
            this.themeRefreshTimeout = null;
        }
        
        // Clear any pending requests
        this.pendingSettingRequests.clear();
    }

    // Handle errors globally
    handleError(error, context = 'Unknown') {
        console.error(`Dashboard error in ${context}:`, error);
        
        // Show user-friendly error message
        let message = 'An unexpected error occurred';
        if (error.message) {
            message = error.message;
        }
        
        this.toastManager.show(message, 'error');
        
        // If it's an authentication error, redirect to login
        if (error.status === 401 || error.message.includes('authentication')) {
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
    window.dashboard.init();
});

// Handle browser navigation events
window.addEventListener('beforeunload', () => {
    if (window.dashboard) {
        window.dashboard.cleanup();
    }
});

// Add toast slide out animation styles
const style = document.createElement('style');
style.textContent = `
@keyframes toastSlideOut {
    from {
        opacity: 1;
        transform: translateX(0);
    }
    to {
        opacity: 0;
        transform: translateX(100%);
    }
}

/* Loading state styles for clean navigation */
.content-section.loading {
    opacity: 0.6;
    pointer-events: none;
}

.subsection-container.loading {
    opacity: 0.6;
    pointer-events: none;
}
`;
document.head.appendChild(style);