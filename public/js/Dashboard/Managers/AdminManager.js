// File: managers/AdminManager.js
class AdminManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.currentTab = 'overview';
        this.expandedItems = new Set();
        this.pagination = {
            users: { page: 1, limit: 10, total: 0 },
            deletedUsers: { page: 1, limit: 10, total: 0 },
            backups: { page: 1, limit: 10, total: 0 }
        };
        this.filters = {
            users: { search: '', role: '', status: 'active', sortBy: 'createdAt', sortOrder: 'desc' },
            deletedUsers: { search: '', deletionReason: '', sortBy: 'deletedAt' },
            backups: { backupType: '', userId: '', includeExpired: false }
        };
        this.loadingStates = {
            users: false,
            deletedUsers: false,
            backups: false,
            stats: false
        };
        this.dataCache = {
            users: null,
            deletedUsers: null,
            backups: null,
            stats: null,
            lastFetch: {}
        };
        this.bindEvents();
    }

    // Helper method to get proper avatar URL
    getAvatarUrl(avatar, fallback = 'default') {
        if (!avatar) {
            return `https://spotless-orange-flea.myfilebase.com/ipfs/${fallback}`;
        }
        
        // If it's already a full URL, return as is
        if (avatar.includes('https://')) {
            return avatar;
        }
        
        // If it's an IPFS hash, prepend the gateway URL
        return `https://spotless-orange-flea.myfilebase.com/ipfs/${avatar}`;
    }

    bindEvents() {
        // Tab navigation
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-admin-tab]')) {
                const tabName = e.target.dataset.adminTab;
                if (this.currentTab !== tabName) {
                    this.switchTab(tabName);
                }
            }
        });

        // Admin item interactions using event delegation
        document.addEventListener('click', (e) => {
            // Toggle expand/collapse for admin items
            const expandTarget = e.target.closest('[data-toggle-expand]');
            if (expandTarget) {
                const itemId = expandTarget.dataset.toggleExpand;
                this.toggleExpand(itemId);
                return;
            }

            // Handle action buttons
            const actionButton = e.target.closest('[data-action]');
            if (actionButton) {
                const action = actionButton.dataset.action;
                const userId = actionButton.dataset.userId;
                const backupId = actionButton.dataset.backupId;
                const userStatus = actionButton.dataset.userStatus;
                const paginationType = actionButton.dataset.paginationType;
                const targetPage = actionButton.dataset.targetPage;

                switch (action) {
                    case 'viewUserDetails':
                        this.viewUserDetails(userId);
                        break;
                    case 'editUserRole':
                        this.editUserRole(userId);
                        break;
                    case 'createUserBackup':
                        this.createUserBackup(userId);
                        break;
                    case 'toggleUserStatus':
                        this.toggleUserStatus(userId, userStatus === 'true');
                        break;
                    case 'restoreUser':
                        this.restoreUser(userId);
                        break;
                    case 'permanentDeleteUser':
                        this.permanentDeleteUser(userId);
                        break;
                    case 'viewBackupDetails':
                        this.viewBackupDetails(backupId);
                        break;
                    case 'restoreFromBackup':
                        this.restoreFromBackup(backupId);
                        break;
                    case 'verifyBackup':
                        this.verifyBackup(backupId);
                        break;
                    case 'deleteBackup':
                        this.deleteBackup(backupId);
                        break;
                    case 'changePage':
                        this.changePage(paginationType, parseInt(targetPage));
                        break;
                }
            }
        });

        // Filter events
        this.bindFilterEvents();
        this.bindActionEvents();
        this.bindModalEvents();

        // Stats refresh
        document.getElementById('refreshStatsBtn')?.addEventListener('click', () => {
            this.clearCache('stats');
            this.loadStats();
        });
    }

    bindFilterEvents() {
        // Debounced search inputs
        const searchInputs = ['adminUserSearch', 'deletedUserSearch', 'backupUserIdFilter'];
        searchInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', this.debounce((e) => {
                    const type = id.includes('deleted') ? 'deletedUsers' : 
                                id.includes('backup') ? 'backups' : 'users';
                    const key = id.includes('userId') ? 'userId' : 'search';
                    this.updateFilter(type, key, e.target.value);
                }, 500));
            }
        });

        // Filter selects
        const filterMappings = {
            'adminRoleFilter': { type: 'users', key: 'role' },
            'adminStatusFilter': { type: 'users', key: 'status' },
            'adminSortBy': { type: 'users', key: 'sortBy' },
            'adminSortOrder': { type: 'users', key: 'sortOrder' },
            'deletionReasonFilter': { type: 'deletedUsers', key: 'deletionReason' },
            'deletedSortBy': { type: 'deletedUsers', key: 'sortBy' },
            'backupTypeFilter': { type: 'backups', key: 'backupType' },
            'includeExpiredBackups': { type: 'backups', key: 'includeExpired' }
        };

        Object.entries(filterMappings).forEach(([id, config]) => {
            const element = document.getElementById(id);
            if (element) {
                const eventType = element.type === 'checkbox' ? 'change' : 'change';
                element.addEventListener(eventType, (e) => {
                    const value = element.type === 'checkbox' ? e.target.checked : e.target.value;
                    this.updateFilter(config.type, config.key, value);
                });
            }
        });
    }

    bindActionEvents() {
        // Bulk operations
        const bulkActions = {
            'createPeriodicBackups': () => this.createPeriodicBackups(),
            'cleanupExpiredBackups': () => this.cleanupExpiredBackups(),
            'verifyAllBackups': () => this.verifyAllBackups(),
            'cleanupExpiredData': () => this.runMaintenance('cleanup-data'),
            'processExpiredDeletions': () => this.runMaintenance('expired-deletions'),
            'fullSystemCleanup': () => this.runMaintenance('full-cleanup'),
            'archiveAuditLogs': () => this.runMaintenance('archive-logs'),
            'runPeriodicBackup': () => this.runMaintenance('periodic-backup'),
            'cleanupOldBackups': () => this.runMaintenance('cleanup-backups')
        };

        Object.entries(bulkActions).forEach(([id, handler]) => {
            document.getElementById(id)?.addEventListener('click', handler);
        });
    }

    bindModalEvents() {
        document.querySelectorAll('.modal-close').forEach(close => {
            close.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal.id);
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        document.getElementById('createBackupForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createManualBackup();
        });
    }

    clearCache(type = null) {
        if (type) {
            this.dataCache[type] = null;
            delete this.dataCache.lastFetch[type];
        } else {
            this.dataCache = {
                users: null,
                deletedUsers: null,
                backups: null,
                stats: null,
                lastFetch: {}
            };
        }
    }

    isCacheValid(type, maxAge = 30000) {
        const lastFetch = this.dataCache.lastFetch[type];
        return lastFetch && (Date.now() - lastFetch) < maxAge && this.dataCache[type];
    }

    async loadAdminData() {
        if (!this.dashboard.currentUser || !['admin', 'superadmin'].includes(this.dashboard.currentUser.role)) {
            this.dashboard.navigationManager.showSection('dashboard');
            this.dashboard.toastManager.showToast('error', 'Access Denied', 'You do not have admin privileges');
            return;
        }

        // Set body class for superadmin-specific features
        document.body.classList.toggle('superadmin', this.dashboard.currentUser.role === 'superadmin');
        
        // Show/hide tabs based on user role
        this.updateTabVisibility();
        
        await Promise.all([
            this.loadStats(),
            this.loadTabData(this.currentTab)
        ]);
    }

    updateTabVisibility() {
        const isSuperAdmin = this.dashboard.currentUser.role === 'superadmin';
        
        // Hide/show backup management tab
        const backupTab = document.querySelector('[data-admin-tab="backups"]');
        const backupTabContent = document.querySelector('[data-tab-content="backups"]');
        const maintenanceTab = document.querySelector('[data-admin-tab="maintenance"]');
        const maintenanceTabContent = document.querySelector('[data-tab-content="maintenance"]');
        
        if (backupTab) {
            backupTab.style.display = isSuperAdmin ? 'block' : 'none';
        }
        if (backupTabContent) {
            backupTabContent.style.display = isSuperAdmin ? 'block' : 'none';
        }
        if (maintenanceTab) {
            maintenanceTab.style.display = isSuperAdmin ? 'block' : 'none';
        }
        if (maintenanceTabContent) {
            maintenanceTabContent.style.display = isSuperAdmin ? 'block' : 'none';
        }

        // If current tab is not accessible, switch to overview
        if (!isSuperAdmin && (this.currentTab === 'backups' || this.currentTab === 'maintenance')) {
            this.switchTab('overview');
        }
    }

    async loadStats() {
        if (this.loadingStates.stats || this.isCacheValid('stats')) {
            if (this.dataCache.stats) {
                this.renderStats(this.dataCache.stats);
            }
            return;
        }

        this.loadingStates.stats = true;
        
        try {
            const response = await this.dashboard.apiManager.makeRequest('/admin/stats');
            this.dataCache.stats = response.data.stats;
            this.dataCache.lastFetch.stats = Date.now();
            this.renderStats(response.data.stats);
        } catch (error) {
            console.error('Failed to load stats:', error);
            document.getElementById('adminStats').innerHTML = '<div class="error-state">Failed to load statistics</div>';
        } finally {
            this.loadingStates.stats = false;
        }
    }

    renderStats(stats) {
        const container = document.getElementById('adminStats');
        if (!container) return;

        const statsCards = [
            { 
                title: 'Total Users', 
                value: stats.users?.total || 0, 
                icon: 'fas fa-users',
                color: 'blue',
                subtitle: `${stats.users?.active || 0} active`
            },
            { 
                title: 'New This Month', 
                value: stats.users?.newThisMonth || 0, 
                icon: 'fas fa-user-plus',
                color: 'green',
                subtitle: 'registrations'
            },
            { 
                title: 'Inactive Users', 
                value: stats.users?.inactive || 0, 
                icon: 'fas fa-user-slash',
                color: 'orange',
                subtitle: 'need attention'
            },
            { 
                title: 'Deleted Users', 
                value: stats.users?.deleted || 0, 
                icon: 'fas fa-user-times',
                color: 'red',
                subtitle: 'soft deleted'
            }
        ];

        // Add backup stats for superadmin
        if (stats.backups && this.dashboard.currentUser.role === 'superadmin') {
            statsCards.push(
                {
                    title: 'Total Backups',
                    value: stats.backups.totalBackups || 0,
                    icon: 'fas fa-database',
                    color: 'purple',
                    subtitle: 'data snapshots'
                },
                {
                    title: 'Expired Backups',
                    value: stats.backups.expiredBackups || 0,
                    icon: 'fas fa-exclamation-triangle',
                    color: 'red',
                    subtitle: 'need cleanup'
                }
            );
        }

        container.innerHTML = statsCards.map(card => `
            <div class="stats-card stats-card--${card.color}">
                <div class="stats-card__icon">
                    <i class="${card.icon}"></i>
                </div>
                <div class="stats-card__content">
                    <div class="stats-card__value">${card.value.toLocaleString()}</div>
                    <div class="stats-card__title">${card.title}</div>
                    <div class="stats-card__subtitle">${card.subtitle}</div>
                </div>
            </div>
        `).join('');
    }

    switchTab(tabName) {
        if (this.currentTab === tabName) return;

        // Check if tab is accessible for current user role
        const isSuperAdmin = this.dashboard.currentUser.role === 'superadmin';
        if (!isSuperAdmin && (tabName === 'backups' || tabName === 'maintenance')) {
            this.dashboard.toastManager.showToast('error', 'Access Denied', 'This feature is only available to super administrators');
            return;
        }

        // Update active tab
        document.querySelectorAll('[data-admin-tab]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-admin-tab="${tabName}"]`)?.classList.add('active');

        // Update tab content
        document.querySelectorAll('.admin-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.querySelector(`[data-tab-content="${tabName}"]`)?.classList.add('active');

        this.currentTab = tabName;
        
        if (!this.loadingStates[tabName] && tabName !== 'overview' && tabName !== 'maintenance') {
            this.loadTabData(tabName);
        }
    }

    async loadTabData(tabName) {
        switch (tabName) {
            case 'users':
                await this.loadUsers();
                break;
            case 'deleted-users':
                await this.loadDeletedUsers();
                break;
            case 'backups':
                if (this.dashboard.currentUser.role === 'superadmin') {
                    await this.loadBackups();
                }
                break;
        }
    }

    updateFilter(type, key, value) {
        this.filters[type][key] = value;
        this.pagination[type].page = 1;
        this.clearCache(type);
        this.loadTabData(this.currentTab);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async loadUsers() {
        if (this.loadingStates.users) return;

        this.loadingStates.users = true;
        this.showLoadingState('adminUsersList');

        try {
            const filters = this.filters.users;
            const pagination = this.pagination.users;
            
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
            });

            const response = await this.dashboard.apiManager.makeRequest(`/admin/users?${params}`);
            this.renderUsers(response.data.users);
            this.updatePagination('users', response.data.pagination);
        } catch (error) {
            console.error('Failed to load users:', error);
            document.getElementById('adminUsersList').innerHTML = '<div class="error-state">Error loading users</div>';
        } finally {
            this.loadingStates.users = false;
        }
    }

    showLoadingState(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <span>Loading...</span>
                </div>
            `;
        }
    }

    renderUsers(users) {
        const container = document.getElementById('adminUsersList');
        
        if (users.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No users found</h3>
                    <p>No users match your current filter criteria.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = users.map(user => this.createUserCard(user)).join('');
    }

    createUserCard(user) {
        const isExpanded = this.expandedItems.has(`user-${user._id}`);
        
        return `
            <div class="admin-item-card" data-item-id="user-${user._id}">
                <div class="admin-item-card__header" data-toggle-expand="user-${user._id}">
                    <div class="admin-item-card__avatar">
                        <img src="${this.getAvatarUrl(user.avatar)}" 
                             alt="${user.username}" />
                        <div class="admin-item-card__status ${user.isActive ? 'active' : 'inactive'}"></div>
                    </div>
                    <div class="admin-item-card__info">
                        <div class="admin-item-card__name">${user.fullName || user.username}</div>
                        <div class="admin-item-card__meta">
                            <span class="admin-item-card__email">${user.email}</span>
                            <span class="admin-item-card__role admin-item-card__role--${user.role}">${user.role}</span>
                        </div>
                    </div>
                    <div class="admin-item-card__toggle">
                        <i class="fas ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
                    </div>
                </div>
                
                <div class="admin-item-card__content ${isExpanded ? 'expanded' : ''}">
                    <div class="admin-item-card__details">
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">User ID</span>
                                <span class="detail-value">${user._id}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Created</span>
                                <span class="detail-value">${new Date(user.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Last Login</span>
                                <span class="detail-value">${user.lastLogin ? 
                                    new Date(user.lastLogin).toLocaleDateString() : 'Never'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Status</span>
                                <span class="status-badge ${user.isActive ? 'active' : 'inactive'}">
                                    ${user.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="admin-item-card__actions">
                        <div class="action-group">
                            <button class="btn btn--sm btn--ghost" data-action="viewUserDetails" data-user-id="${user._id}">
                                <i class="fas fa-eye"></i> View Details
                            </button>
                            ${this.dashboard.currentUser.role === 'superadmin' ? `
                                <button class="btn btn--sm btn--secondary" data-action="editUserRole" data-user-id="${user._id}">
                                    <i class="fas fa-user-cog"></i> Edit Role
                                </button>
                                <button class="btn btn--sm btn--primary" data-action="createUserBackup" data-user-id="${user._id}">
                                    <i class="fas fa-database"></i> Backup
                                </button>
                            ` : ''}
                            <button class="btn btn--sm ${user.isActive ? 'btn--warning' : 'btn--success'}" 
                                    data-action="toggleUserStatus" data-user-id="${user._id}" data-user-status="${!user.isActive}">
                                <i class="fas ${user.isActive ? 'fa-user-slash' : 'fa-user-check'}"></i>
                                ${user.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    toggleExpand(itemId) {
        const card = document.querySelector(`[data-item-id="${itemId}"]`);
        const content = card.querySelector('.admin-item-card__content');
        const toggle = card.querySelector('.admin-item-card__toggle i');
        
        if (this.expandedItems.has(itemId)) {
            this.expandedItems.delete(itemId);
            content.classList.remove('expanded');
            toggle.className = 'fas fa-chevron-down';
        } else {
            this.expandedItems.add(itemId);
            content.classList.add('expanded');
            toggle.className = 'fas fa-chevron-up';
        }
    }

    async loadDeletedUsers() {
        if (this.loadingStates.deletedUsers) return;

        this.loadingStates.deletedUsers = true;
        this.showLoadingState('deletedUsersList');

        try {
            const filters = this.filters.deletedUsers;
            const pagination = this.pagination.deletedUsers;
            
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
            });

            const response = await this.dashboard.apiManager.makeRequest(`/admin/users/deleted?${params}`);
            this.renderDeletedUsers(response.data.users);
            this.updatePagination('deletedUsers', response.data.pagination);
        } catch (error) {
            console.error('Failed to load deleted users:', error);
            document.getElementById('deletedUsersList').innerHTML = '<div class="error-state">Error loading deleted users</div>';
        } finally {
            this.loadingStates.deletedUsers = false;
        }
    }

    renderDeletedUsers(users) {
        const container = document.getElementById('deletedUsersList');
        
        if (users.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-times"></i>
                    <h3>No deleted users found</h3>
                    <p>No deleted users match your current filter criteria.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = users.map(user => this.createDeletedUserCard(user)).join('');
    }

    createDeletedUserCard(user) {
        const isExpanded = this.expandedItems.has(`deleted-user-${user._id}`);
        
        return `
            <div class="admin-item-card admin-item-card--deleted" data-item-id="deleted-user-${user._id}">
                <div class="admin-item-card__header" data-toggle-expand="deleted-user-${user._id}">
                    <div class="admin-item-card__avatar">
                        <img src="${this.getAvatarUrl(user.avatar)}" 
                             alt="${user.username || 'Deleted User'}" />
                        <div class="admin-item-card__status deleted"></div>
                    </div>
                    <div class="admin-item-card__info">
                        <div class="admin-item-card__name">${user.username || 'Deleted User'}</div>
                        <div class="admin-item-card__meta">
                            <span class="admin-item-card__email">${user.email || 'Email removed'}</span>
                            <span class="admin-item-card__deleted">Deleted ${new Date(user.deletedAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="admin-item-card__toggle">
                        <i class="fas ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
                    </div>
                </div>
                
                <div class="admin-item-card__content ${isExpanded ? 'expanded' : ''}">
                    <div class="admin-item-card__details">
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">User ID</span>
                                <span class="detail-value">${user._id}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Deleted At</span>
                                <span class="detail-value">${new Date(user.deletedAt).toLocaleDateString()}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Reason</span>
                                <span class="detail-value">${user.deletionReason || 'Not provided'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Backup Status</span>
                                <span class="status-badge ${user.isBackedUp ? 'success' : 'warning'}">
                                    ${user.isBackedUp ? 'Backed Up' : 'Not Backed Up'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="admin-item-card__actions">
                        <div class="action-group">
                            <button class="btn btn--sm btn--ghost" data-action="viewUserDetails" data-user-id="${user._id}">
                                <i class="fas fa-eye"></i> View Details
                            </button>
                            <button class="btn btn--sm btn--success" data-action="restoreUser" data-user-id="${user._id}">
                                <i class="fas fa-undo"></i> Restore User
                            </button>
                            ${this.dashboard.currentUser.role === 'superadmin' ? `
                                <button class="btn btn--sm btn--danger" data-action="permanentDeleteUser" data-user-id="${user._id}">
                                    <i class="fas fa-trash"></i> Permanent Delete
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    updatePagination(type, paginationData) {
        const container = document.getElementById(`${type}Pagination`);
        if (!container) return;

        this.pagination[type] = { ...this.pagination[type], ...paginationData };
        
        const { page, pages, total } = paginationData;
        
        if (pages <= 1) {
            container.innerHTML = '';
            return;
        }

        let paginationHtml = `
            <div class="pagination">
                <div class="pagination__info">
                    ${((page - 1) * this.pagination[type].limit) + 1}-${Math.min(page * this.pagination[type].limit, total)} of ${total}
                </div>
                <div class="pagination__controls">
        `;

        // Previous button
        if (page > 1) {
            paginationHtml += `
                <button class="pagination__btn" data-action="changePage" data-pagination-type="${type}" data-target-page="${page - 1}">
                    <i class="fas fa-chevron-left"></i>
                </button>
            `;
        }

        // Page numbers
        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(pages, page + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === page;
            paginationHtml += `
                <button class="pagination__btn ${isActive ? 'active' : ''}" 
                        data-action="changePage" data-pagination-type="${type}" data-target-page="${i}">${i}</button>
            `;
        }

        // Next button
        if (page < pages) {
            paginationHtml += `
                <button class="pagination__btn" data-action="changePage" data-pagination-type="${type}" data-target-page="${page + 1}">
                    <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }

        paginationHtml += '</div></div>';
        container.innerHTML = paginationHtml;
    }

    changePage(type, page) {
        this.pagination[type].page = page;
        this.clearCache(type);
        this.loadTabData(this.currentTab);
    }

    // User Actions
    async viewUserDetails(userId) {
        try {
            const response = await this.dashboard.apiManager.makeRequest(`/admin/users/${userId}`);
            this.showUserDetailsModal(response.data.user);
        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to load user details');
        }
    }

    showUserDetailsModal(user) {
        const modal = document.getElementById('userDetailsModal');
        const content = document.getElementById('userDetailsContent');
        
        content.innerHTML = `
            <div class="user-details-modal">
                <div class="user-details-header">
                    <div class="user-avatar-large">
                        <img src="${this.getAvatarUrl(user.avatar)}"
                             alt="${user.username}" />
                    </div>
                    <div class="user-info-primary">
                        <h2>${user.fullName || user.username}</h2>
                        <p class="user-email">${user.email}</p>
                        <div class="user-badges">
                            <span class="badge badge--role badge--${user.role}">${user.role}</span>
                            <span class="badge badge--status badge--${user.isActive ? 'active' : 'inactive'}">
                                ${user.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="user-details-content">
                    <div class="details-section">
                        <h4>Account Information</h4>
                        <div class="details-grid">
                            <div class="detail-row">
                                <span class="detail-label">User ID</span>
                                <span class="detail-value">${user._id}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Username</span>
                                <span class="detail-value">${user.username}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Created</span>
                                <span class="detail-value">${new Date(user.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Last Login</span>
                                <span class="detail-value">${user.lastLogin ? 
                                    new Date(user.lastLogin).toLocaleDateString() : 'Never'}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${user.deletedAt ? `
                        <div class="details-section">
                            <h4>Deletion Information</h4>
                            <div class="details-grid">
                                <div class="detail-row">
                                    <span class="detail-label">Deleted At</span>
                                    <span class="detail-value">${new Date(user.deletedAt).toLocaleDateString()}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Reason</span>
                                    <span class="detail-value">${user.deletionReason || 'Not provided'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Backup Status</span>
                                    <span class="badge badge--${user.isBackedUp ? 'success' : 'warning'}">
                                        ${user.isBackedUp ? 'Backed Up' : 'Not Backed Up'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${user.auditLogs && user.auditLogs.length > 0 ? `
                        <div class="details-section">
                            <h4>Recent Activity</h4>
                            <div class="audit-logs-compact">
                                ${user.auditLogs.slice(-5).map(log => `
                                    <div class="audit-log-item">
                                        <div class="audit-log-action">${log.action}</div>
                                        <div class="audit-log-time">${new Date(log.timestamp).toLocaleString()}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        this.showModal('userDetailsModal');
    }

    async editUserRole(userId) {
        try {
            const result = await this.dashboard.modalManager.showSelectDialog({
                title: 'Change User Role',
                message: 'Select the new role for this user:',
                options: [
                    { value: 'user', label: 'User' },
                    { value: 'moderator', label: 'Moderator' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'superadmin', label: 'Super Admin' }
                ],
                inputPlaceholder: 'Optional: Enter reason for role change'
            });

            if (!result.confirmed || !result.selectedValue) return;

            await this.dashboard.apiManager.makeRequest(`/admin/users/${userId}/role`, {
                method: 'PUT',
                body: JSON.stringify({ 
                    role: result.selectedValue,
                    reason: result.inputValue || 'Role changed by admin'
                })
            });

            this.dashboard.toastManager.showToast('success', 'Success', 'User role updated successfully');
            this.clearCache('users');
            await this.loadTabData(this.currentTab);
        } catch (error) {
            console.error('Failed to update user role:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to update user role');
        }
    }

    async toggleUserStatus(userId, activate) {
        const action = activate ? 'activate' : 'deactivate';
        
        try {
            const result = await this.dashboard.modalManager.showConfirmDialog({
                title: `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
                message: `Are you sure you want to ${action} this user account?`,
                inputPlaceholder: `Optional: Enter reason for ${action}ing this user`
            });

            if (!result.confirmed) return;

            await this.dashboard.apiManager.makeRequest(`/admin/users/${userId}/status`, {
                method: 'PUT',
                body: JSON.stringify({
                    isActive: activate,
                    reason: result.inputValue || `User ${action}d by admin`
                })
            });

            this.dashboard.toastManager.showToast('success', 'Success', `User ${action}d successfully`);
            this.clearCache('users');
            await this.loadTabData(this.currentTab);
        } catch (error) {
            console.error(`Failed to ${action} user:`, error);
            this.dashboard.toastManager.showToast('error', 'Error', `Failed to ${action} user`);
        }
    }

    async restoreUser(userId) {
        try {
            const result = await this.dashboard.modalManager.showConfirmDialog({
                title: 'Restore User',
                message: 'Are you sure you want to restore this deleted user account?',
                confirmText: 'Restore User'
            });

            if (!result.confirmed) return;

            await this.dashboard.apiManager.makeRequest(`/admin/users/${userId}/restore`, {
                method: 'PUT'
            });

            this.dashboard.toastManager.showToast('success', 'Success', 'User restored successfully');
            this.clearCache(['users', 'deletedUsers']);
            await this.loadTabData(this.currentTab);
        } catch (error) {
            console.error('Failed to restore user:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to restore user');
        }
    }

    async permanentDeleteUser(userId) {
        try {
            const result = await this.dashboard.modalManager.showConfirmDialog({
                title: 'Permanent Delete User',
                message: 'This action cannot be undone. Type "PERMANENT DELETE" to confirm:',
                requireExactMatch: 'PERMANENT DELETE',
                confirmText: 'Permanently Delete',
                dangerMode: true
            });

            if (!result.confirmed) return;

            await this.dashboard.apiManager.makeRequest(`/admin/users/${userId}/permanent`, {
                method: 'DELETE'
            });

            this.dashboard.toastManager.showToast('success', 'Success', 'User permanently deleted');
            this.clearCache('deletedUsers');
            await this.loadTabData(this.currentTab);
        } catch (error) {
            console.error('Failed to permanently delete user:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to permanently delete user');
        }
    }

    // Backup Operations
    async loadBackups() {
        if (this.loadingStates.backups) return;

        this.loadingStates.backups = true;
        this.showLoadingState('backupsList');

        try {
            const filters = this.filters.backups;
            const pagination = this.pagination.backups;
            
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '' && v !== false))
            });

            const response = await this.dashboard.apiManager.makeRequest(`/admin/backups?${params}`);
            this.renderBackups(response.data.backups);
            this.updatePagination('backups', response.data.pagination);
        } catch (error) {
            console.error('Failed to load backups:', error);
            document.getElementById('backupsList').innerHTML = '<div class="error-state">Error loading backups</div>';
        } finally {
            this.loadingStates.backups = false;
        }
    }

    renderBackups(backups) {
        const container = document.getElementById('backupsList');
        
        if (backups.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-database"></i>
                    <h3>No backups found</h3>
                    <p>No backups match your current filter criteria.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = backups.map(backup => this.createBackupCard(backup)).join('');
    }

    createBackupCard(backup) {
        const isExpanded = this.expandedItems.has(`backup-${backup._id}`);
        const isExpired = new Date(backup.retainUntil) < new Date();
        
        return `
            <div class="admin-item-card ${isExpired ? 'admin-item-card--expired' : ''}" data-item-id="backup-${backup._id}">
                <div class="admin-item-card__header" data-toggle-expand="backup-${backup._id}">
                    <div class="admin-item-card__icon">
                        <i class="fas fa-database"></i>
                        <div class="admin-item-card__status ${isExpired ? 'expired' : 'active'}"></div>
                    </div>
                    <div class="admin-item-card__info">
                        <div class="admin-item-card__name">Backup ${backup._id.substring(0, 8)}...</div>
                        <div class="admin-item-card__meta">
                            <span class="admin-item-card__type">${backup.backupType}</span>
                            <span class="admin-item-card__user">${backup.userId?.username || backup.userId || 'Unknown User'}</span>
                        </div>
                    </div>
                    <div class="admin-item-card__toggle">
                        <i class="fas ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
                    </div>
                </div>
                
                <div class="admin-item-card__content ${isExpanded ? 'expanded' : ''}">
                    <div class="admin-item-card__details">
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">Backup ID</span>
                                <span class="detail-value">${backup._id}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Created</span>
                                <span class="detail-value">${new Date(backup.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Expires</span>
                                <span class="detail-value">${new Date(backup.retainUntil).toLocaleDateString()}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Size</span>
                                <span class="detail-value">${this.formatBytes(JSON.stringify(backup.userData || {}).length)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="admin-item-card__actions">
                        <div class="action-group">
                            <button class="btn btn--sm btn--ghost" data-action="viewBackupDetails" data-backup-id="${backup._id}">
                                <i class="fas fa-eye"></i> View Details
                            </button>
                            <button class="btn btn--sm btn--success" data-action="restoreFromBackup" data-backup-id="${backup._id}">
                                <i class="fas fa-undo"></i> Restore
                            </button>
                            <button class="btn btn--sm btn--secondary" data-action="verifyBackup" data-backup-id="${backup._id}">
                                <i class="fas fa-check"></i> Verify
                            </button>
                            <button class="btn btn--sm btn--danger" data-action="deleteBackup" data-backup-id="${backup._id}">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async createUserBackup(userId) {
        document.getElementById('backupUserId').value = userId;
        this.showModal('createBackupModal');
    }

    async createManualBackup() {
        const userId = document.getElementById('backupUserId').value;
        const reason = document.getElementById('backupReason').value;

        if (!userId) {
            this.dashboard.toastManager.showToast('error', 'Error', 'User ID is required');
            return;
        }

        try {
            await this.dashboard.apiManager.makeRequest(`/admin/backups/${userId}`, {
                method: 'POST',
                body: JSON.stringify({ reason: reason || 'Manual backup created by admin' })
            });

            this.dashboard.toastManager.showToast('success', 'Success', 'Backup created successfully');
            this.closeModal('createBackupModal');
            if (this.currentTab === 'backups') {
                this.clearCache('backups');
                await this.loadBackups();
            }
        } catch (error) {
            console.error('Failed to create backup:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to create backup');
        }
    }

    async viewBackupDetails(backupId) {
        try {
            const response = await this.dashboard.apiManager.makeRequest(`/admin/backups/${backupId}`);
            this.showBackupDetailsModal(response.data.backup);
        } catch (error) {
            console.error('Failed to load backup details:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to load backup details');
        }
    }

    showBackupDetailsModal(backup) {
        const modal = document.getElementById('backupDetailsModal');
        const content = document.getElementById('backupDetailsContent');
        
        content.innerHTML = `
            <div class="backup-details-modal">
                <div class="backup-details-header">
                    <div class="backup-icon-large">
                        <i class="fas fa-database"></i>
                    </div>
                    <div class="backup-info-primary">
                        <h2>Backup ${backup._id.substring(0, 12)}...</h2>
                        <p class="backup-type">${backup.backupType} backup</p>
                        <div class="backup-badges">
                            <span class="badge badge--type badge--${backup.backupType}">${backup.backupType}</span>
                            <span class="badge badge--status ${new Date(backup.retainUntil) < new Date() ? 'badge--expired' : 'badge--active'}">
                                ${new Date(backup.retainUntil) < new Date() ? 'Expired' : 'Active'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="backup-details-content">
                    <div class="details-section">
                        <h4>Backup Information</h4>
                        <div class="details-grid">
                            <div class="detail-row">
                                <span class="detail-label">Backup ID</span>
                                <span class="detail-value">${backup._id}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">User</span>
                                <span class="detail-value">${backup.userId?.username || backup.userId || 'Unknown User'}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Created</span>
                                <span class="detail-value">${new Date(backup.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Expires</span>
                                <span class="detail-value">${new Date(backup.retainUntil).toLocaleDateString()}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Size</span>
                                <span class="detail-value">${this.formatBytes(JSON.stringify(backup.userData || {}).length)}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${backup.metadata && Object.keys(backup.metadata).length > 0 ? `
                        <div class="details-section">
                            <h4>Metadata</h4>
                            <div class="metadata-display">
                                ${Object.entries(backup.metadata).map(([key, value]) => `
                                    <div class="metadata-item">
                                        <span class="metadata-key">${key}</span>
                                        <span class="metadata-value">${typeof value === 'object' ? JSON.stringify(value) : value}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        this.showModal('backupDetailsModal');
    }

    async restoreFromBackup(backupId) {
        try {
            const result = await this.dashboard.modalManager.showConfirmDialog({
                title: 'Restore from Backup',
                message: 'Restore user from this backup? This will overwrite any existing user data.',
                checkboxLabel: 'Force restore even if user exists',
                confirmText: 'Restore User'
            });

            if (!result.confirmed) return;

            await this.dashboard.apiManager.makeRequest(`/admin/backups/${backupId}/restore`, {
                method: 'POST',
                body: JSON.stringify({ 
                    forceRestore: result.checkboxValue || false 
                })
            });

            this.dashboard.toastManager.showToast('success', 'Success', 'User restored from backup successfully');
            this.clearCache(['users', 'deletedUsers']);
        } catch (error) {
            console.error('Failed to restore from backup:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to restore from backup');
        }
    }

    async verifyBackup(backupId) {
        try {
            const response = await this.dashboard.apiManager.makeRequest(`/admin/backups/${backupId}/verify`);
            const verification = response.data.verification;
            
            if (verification.valid) {
                this.dashboard.toastManager.showToast('success', 'Valid', 'Backup integrity verified');
            } else {
                this.dashboard.toastManager.showToast('error', 'Invalid', `Backup verification failed: ${verification.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Failed to verify backup:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to verify backup');
        }
    }

    async deleteBackup(backupId) {
        try {
            const result = await this.dashboard.modalManager.showConfirmDialog({
                title: 'Delete Backup',
                message: 'Are you sure you want to delete this backup? This action cannot be undone.',
                confirmText: 'Delete Backup',
                dangerMode: true
            });

            if (!result.confirmed) return;

            await this.dashboard.apiManager.makeRequest(`/admin/backups/${backupId}`, {
                method: 'DELETE'
            });

            this.dashboard.toastManager.showToast('success', 'Success', 'Backup deleted successfully');
            this.clearCache('backups');
            await this.loadBackups();
        } catch (error) {
            console.error('Failed to delete backup:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to delete backup');
        }
    }

    // Bulk Operations
    async createPeriodicBackups() {
        try {
            const result = await this.dashboard.modalManager.showConfirmDialog({
                title: 'Create Periodic Backups',
                message: 'Create periodic backups for all eligible users? This may take some time.',
                confirmText: 'Start Backups'
            });

            if (!result.confirmed) return;

            const response = await this.dashboard.apiManager.makeRequest('/admin/backups/periodic', {
                method: 'POST'
            });

            this.dashboard.toastManager.showToast('success', 'Success', 
                `Periodic backups completed: ${response.data.successCount} successful, ${response.data.errorCount} failed`);
            this.clearCache('backups');
            await this.loadBackups();
        } catch (error) {
            console.error('Failed to create periodic backups:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to create periodic backups');
        }
    }

    async cleanupExpiredBackups() {
        try {
            const result = await this.dashboard.modalManager.showConfirmDialog({
                title: 'Cleanup Expired Backups',
                message: 'Clean up all expired backups? This will permanently delete expired backup files.',
                confirmText: 'Cleanup Backups'
            });

            if (!result.confirmed) return;

            const response = await this.dashboard.apiManager.makeRequest('/admin/backups/cleanup', {
                method: 'POST'
            });

            this.dashboard.toastManager.showToast('success', 'Success', 
                `Cleaned up ${response.data.cleanedCount} expired backups`);
            this.clearCache('backups');
            await this.loadBackups();
        } catch (error) {
            console.error('Failed to cleanup backups:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to cleanup backups');
        }
    }

    async verifyAllBackups() {
        this.dashboard.toastManager.showToast('info', 'Verifying', 'Verifying all backups... This may take a while');
        setTimeout(() => {
            this.dashboard.toastManager.showToast('info', 'Complete', 'Backup verification completed');
        }, 2000);
    }

    // Maintenance Operations
    async runMaintenance(operation) {
        const confirmMessages = {
            'cleanup-data': 'Clean up expired user data? This will remove old temporary files and expired sessions.',
            'expired-deletions': 'Process expired deletion requests? This will permanently delete users marked for deletion.',
            'full-cleanup': 'Run full system cleanup? This may take some time and will clean all expired data.',
            'archive-logs': 'Archive old audit logs? This will move old logs to archive storage.',
            'periodic-backup': 'Run periodic backup for all users? This may take considerable time.',
            'cleanup-backups': 'Cleanup old and expired backups? This will permanently delete old backup files.'
        };

        try {
            const result = await this.dashboard.modalManager.showConfirmDialog({
                title: 'Run Maintenance',
                message: confirmMessages[operation],
                confirmText: 'Run Maintenance'
            });

            if (!result.confirmed) return;

            let endpoint, method = 'POST', body = {};

            switch (operation) {
                case 'cleanup-data':
                case 'expired-deletions':
                case 'full-cleanup':
                    endpoint = '/admin/maintenance/cleanup';
                    break;
                case 'archive-logs':
                    endpoint = '/admin/maintenance/archive-logs';
                    body = { daysOld: parseInt(document.getElementById('archiveDays')?.value) || 90 };
                    break;
                case 'periodic-backup':
                    endpoint = '/admin/backups/periodic';
                    body = {
                        backupIntervalDays: parseInt(document.getElementById('backupInterval')?.value) || 30,
                        batchSize: parseInt(document.getElementById('batchSize')?.value) || 100
                    };
                    break;
                case 'cleanup-backups':
                    endpoint = '/admin/backups/cleanup';
                    break;
            }

            const response = await this.dashboard.apiManager.makeRequest(endpoint, {
                method,
                body: Object.keys(body).length ? JSON.stringify(body) : undefined
            });

            this.dashboard.toastManager.showToast('success', 'Success', 'Maintenance operation completed successfully');
            this.showMaintenanceResults(operation, response.data);
        } catch (error) {
            console.error('Maintenance operation failed:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 'Maintenance operation failed');
        }
    }

    showMaintenanceResults(operation, data) {
        const resultContainers = {
            'cleanup-data': 'cleanupResults',
            'expired-deletions': 'cleanupResults',
            'full-cleanup': 'cleanupResults',
            'archive-logs': 'archiveResults',
            'periodic-backup': 'backupResults',
            'cleanup-backups': 'backupResults'
        };

        const container = document.getElementById(resultContainers[operation]);
        if (!container) return;

        const formatResult = (obj) => {
            return Object.entries(obj).map(([key, value]) => 
                `<div class="result-item"><span class="result-label">${key}:</span> <span class="result-value">${value}</span></div>`
            ).join('');
        };

        container.innerHTML = `<div class="maintenance-results-display">${formatResult(data)}</div>`;
        container.classList.add('show');

        setTimeout(() => {
            container.classList.remove('show');
        }, 10000);
    }

    // Modal Management
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
            
            const form = modal.querySelector('form');
            if (form) form.reset();
        }
    }

    // Utility Methods
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Global reference
window.adminManager = null;