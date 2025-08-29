// File: managers/EventManager.js
class EventManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    initEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        const themeDropdown = document.getElementById('themeDropdown');

        // Remove existing listeners first
        themeToggle.replaceWith(themeToggle.cloneNode(true));
        const newThemeToggle = document.getElementById('themeToggle');

        newThemeToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            themeDropdown.classList.toggle('show');
        });

        // Theme options - also prevent duplicates
        document.querySelectorAll('.theme-option').forEach(option => {
            // Clone to remove existing listeners
            const newOption = option.cloneNode(true);
            option.parentNode.replaceChild(newOption, option);

            newOption.addEventListener('click', async () => {
                await this.dashboard.themeManager.applyTheme(newOption.dataset.theme);
                themeDropdown.classList.remove('show');
            });
        });

        // Close theme dropdown when clicking outside
        document.addEventListener('click', () => {
            themeDropdown.classList.remove('show');
        });

        // Sidebar toggles
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });

        document.getElementById('mobileSidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('show');
        });

        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                if (section) {
                    this.dashboard.navigationManager.showSection(section);
                }
            });
        });
    }

    initializeSecurityEventListeners() {
        // Account deletion modal event listeners
        const requestDeleteBtn = document.getElementById('requestDeleteBtn');
        const accountDeletionForm = document.getElementById('accountDeletionForm');
        const deletionModalClose = document.getElementById('deletionModalClose');
        const cancelDeletionBtn = document.getElementById('cancelDeletionBtn');
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');

        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', () => {
                this.dashboard.securityManager.requestAccountDeletionEmail();
            });
        }

        if (requestDeleteBtn) {
            requestDeleteBtn.addEventListener('click', () => {
                // Show account deletion modal
                this.dashboard.modalManager.showModaldeletion('accountDeletionModal');
                this.dashboard.securityManager.requestAccountDeletion();
            });
        }

        if (accountDeletionForm) {
            accountDeletionForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                this.dashboard.securityManager.confirmAccountDeletion(formData);
            });
        }

        if (deletionModalClose) {
            deletionModalClose.addEventListener('click', () => {
                this.dashboard.modalManager.hideModaldeletion('accountDeletionModal');
            });
        }

        if (cancelDeletionBtn) {
            cancelDeletionBtn.addEventListener('click', () => {
                this.dashboard.modalManager.hideModaldeletion('accountDeletionModal');
            });
        }

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.dashboard.authManager.logout();
        });

        // Forms
        this.dashboard.formManager.initForms();

        // Quick actions
        this.dashboard.formManager.initQuickActions();

        // Modal management
        this.dashboard.modalManager.initModals();
    }
}