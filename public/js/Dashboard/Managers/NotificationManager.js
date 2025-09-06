// File: managers/NotificationManager.js
class NotificationManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.allNotifications = [];
        this.currentFilter = '';
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Filter dropdown
        const filterSelect = document.getElementById('notificationFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.currentFilter = e.target.value;
                this.applyFilterAndRender();
            });
        }

        // Mark All Read button
        const markAllReadBtn = document.getElementById('markAllRead');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => {
                this.markAllNotificationsAsRead();
            });
        }

        // Notification actions (using event delegation)
        const container = document.getElementById('notificationsList');
        if (container && !container.dataset.listenerAttached) {
            container.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.notification-delete-btn');
                const markReadBtn = e.target.closest('.notification-mark-read-btn');
                const clearAllBtn = e.target.closest('#clearAllNotificationsBtn');

                if (deleteBtn) {
                    const notificationId = deleteBtn.dataset.notificationId;
                    this.deleteNotification(notificationId);
                } else if (markReadBtn) {
                    const notificationId = markReadBtn.dataset.notificationId;
                    this.markNotificationAsRead(notificationId);
                } else if (clearAllBtn) {
                    this.clearAllNotifications();
                }
            });

            container.dataset.listenerAttached = "true";
        }
    }

    async loadNotifications() {
        try {
            this.dashboard.loadingManager.showLoading(true);
            
            // Load all notifications without filters first
            const response = await this.dashboard.apiManager.makeRequest('/notifications?limit=50');
            this.allNotifications = response.data.notifications || [];
            
            this.applyFilterAndRender();

        } catch (error) {
            console.error('Error loading notifications:', error);
            document.getElementById('notificationsList').innerHTML =
                '<p class="text-center">Error loading notifications</p>';
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to load notifications');
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    applyFilterAndRender() {
        let filteredNotifications = [...this.allNotifications];

        // Apply type filter
        if (this.currentFilter) {
            filteredNotifications = filteredNotifications.filter(n => n.type === this.currentFilter);
        }

        this.renderNotifications(filteredNotifications);
    }

    renderNotifications(notifications) {
        const container = document.getElementById('notificationsList');

        if (notifications.length === 0) {
            const message = this.currentFilter 
                ? `No ${this.currentFilter} notifications found`
                : 'No notifications';
            container.innerHTML = `<p class="text-center">${message}</p>`;
            this.updateNotificationBadge(0);
            return;
        }

        // Build notifications list HTML
        const notificationsHtml = notifications.map(notification => `
            <div class="notification-item ${!notification.read ? 'unread' : ''}" data-notification-id="${notification.id}">
                <div class="notification-icon ${notification.type}">
                    <i class="${this.getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <h4>${notification.title}</h4>
                    <p>${notification.message}</p>
                    <div class="notification-time">${new Date(notification.createdAt).toLocaleString()}</div>
                </div>
                <div class="notification-actions">
                    ${!notification.read ? `
                        <button class="notification-mark-read-btn" data-notification-id="${notification.id}" title="Mark as read">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="notification-delete-btn" data-notification-id="${notification.id}" title="Delete">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Add Clear All button if there are notifications
        const clearAllButton = notifications.length > 0 ? `
            <div class="notification-bulk-actions">
                <button id="clearAllNotificationsBtn" class="btn btn-sm btn-danger">
                    <i class="fas fa-trash-alt"></i> Clear All Notifications
                </button>
            </div>
        ` : '';

        container.innerHTML = clearAllButton + notificationsHtml;

        // Update badge with total unread count (not filtered)
        const totalUnreadCount = this.allNotifications.filter(n => !n.read).length;
        this.updateNotificationBadge(totalUnreadCount);
    }

    async deleteNotification(notificationId) {
        try {
            const button = document.querySelector(`.notification-delete-btn[data-notification-id="${notificationId}"]`);
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }

            await this.dashboard.apiManager.makeRequest(`/notifications/${notificationId}`, { 
                method: 'DELETE' 
            });

            // Remove from local array
            this.allNotifications = this.allNotifications.filter(n => n.id !== notificationId);

            // Remove from DOM
            const notificationItem = document.querySelector(`.notification-item[data-notification-id="${notificationId}"]`);
            if (notificationItem) {
                notificationItem.remove();
            }

            // Re-render to update counts and empty states
            this.applyFilterAndRender();

            this.dashboard.toastManager.showToast('success', 'Success', 'Notification deleted');

        } catch (error) {
            console.error('Error deleting notification:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 
                error.message.includes('404') ? 'Notification not found' : 'Failed to delete notification'
            );

            // Restore button state
            const button = document.querySelector(`.notification-delete-btn[data-notification-id="${notificationId}"]`);
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-times"></i>';
            }
        }
    }

    async markNotificationAsRead(notificationId) {
        try {
            const button = document.querySelector(`.notification-mark-read-btn[data-notification-id="${notificationId}"]`);
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }

            await this.dashboard.apiManager.makeRequest(`/notifications/${notificationId}/read`, { 
                method: 'PUT' 
            });

            // Update local array
            const notification = this.allNotifications.find(n => n.id === notificationId);
            if (notification) {
                notification.read = true;
            }

            // Update DOM
            const notificationItem = document.querySelector(`.notification-item[data-notification-id="${notificationId}"]`);
            if (notificationItem) {
                notificationItem.classList.remove('unread');
                const markReadBtn = notificationItem.querySelector('.notification-mark-read-btn');
                if (markReadBtn) markReadBtn.remove();
            }

            this.updateNotificationBadge();

        } catch (error) {
            console.error('Error marking notification as read:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 
                error.message.includes('404') ? 'Notification not found' : 'Failed to mark notification as read'
            );

            // Restore button state
            const button = document.querySelector(`.notification-mark-read-btn[data-notification-id="${notificationId}"]`);
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-check"></i>';
            }
        }
    }

    async markAllNotificationsAsRead() {
        try {
            const markAllBtn = document.getElementById('markAllRead');
            if (markAllBtn) {
                markAllBtn.disabled = true;
                markAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Marking...';
            }

            await this.dashboard.apiManager.makeRequest('/notifications/read-all', {
                method: 'PUT'
            });

            // Update all notifications in local array
            this.allNotifications.forEach(notification => {
                notification.read = true;
            });

            // Update DOM - remove unread class and mark-read buttons
            const unreadItems = document.querySelectorAll('.notification-item.unread');
            unreadItems.forEach(item => {
                item.classList.remove('unread');
                const markReadBtn = item.querySelector('.notification-mark-read-btn');
                if (markReadBtn) {
                    markReadBtn.remove();
                }
            });

            this.updateNotificationBadge();
            this.dashboard.toastManager.showToast('success', 'Success', 'All notifications marked as read');

        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to mark all notifications as read');
        } finally {
            const markAllBtn = document.getElementById('markAllRead');
            if (markAllBtn) {
                markAllBtn.disabled = false;
                markAllBtn.innerHTML = 'Mark All Read';
            }
        }
    }

    async clearAllNotifications() {
        const confirmMessage = this.currentFilter 
            ? `Are you sure you want to delete all ${this.currentFilter} notifications? This action cannot be undone.`
            : 'Are you sure you want to delete all notifications? This action cannot be undone.';

        if (!await this.dashboard.modalManager.showConfirm(confirmMessage)) {
            return;
        }

        try {
            const clearAllBtn = document.getElementById('clearAllNotificationsBtn');
            if (clearAllBtn) {
                clearAllBtn.disabled = true;
                clearAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clearing...';
            }

            if (this.currentFilter) {
                // Clear only filtered notifications
                const filteredNotifications = this.allNotifications.filter(n => n.type === this.currentFilter);
                
                // Delete each notification individually
                for (const notification of filteredNotifications) {
                    await this.dashboard.apiManager.makeRequest(`/notifications/${notification.id}`, {
                        method: 'DELETE'
                    });
                }

                // Remove from local array
                this.allNotifications = this.allNotifications.filter(n => n.type !== this.currentFilter);
                
                this.dashboard.toastManager.showToast('success', 'Success', `All ${this.currentFilter} notifications cleared`);
            } else {
                // Clear all notifications
                await this.dashboard.apiManager.makeRequest('/notifications/clear-all', {
                    method: 'DELETE'
                });

                this.allNotifications = [];
                this.dashboard.toastManager.showToast('success', 'Success', 'All notifications cleared');
            }

            // Re-render the list
            this.applyFilterAndRender();

        } catch (error) {
            console.error('Error clearing notifications:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to clear notifications');
        } finally {
            const clearAllBtn = document.getElementById('clearAllNotificationsBtn');
            if (clearAllBtn) {
                clearAllBtn.disabled = false;
                clearAllBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Clear All Notifications';
            }
        }
    }

    updateNotificationBadge() {
        const unreadCount = this.allNotifications.filter(n => !n.read).length;
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'block' : 'none';
        }

        // Update mark all read button state
        const markAllBtn = document.getElementById('markAllRead');
        if (markAllBtn) {
            markAllBtn.disabled = unreadCount === 0;
            markAllBtn.title = unreadCount === 0 ? 'No unread notifications' : `Mark ${unreadCount} notifications as read`;
        }
    }

    getNotificationIcon(type) {
        const icons = {
            'security': 'fas fa-shield-alt',
            'account': 'fas fa-user',
            'system': 'fas fa-cog',
            'marketing': 'fas fa-bullhorn',
            'feature': 'fas fa-star'
        };
        return icons[type] || 'fas fa-bell';
    }

    // Utility method to get current filter for external use
    getCurrentFilter() {
        return this.currentFilter;
    }

    // Method to programmatically set filter
    setFilter(filterType) {
        this.currentFilter = filterType;
        const filterSelect = document.getElementById('notificationFilter');
        if (filterSelect) {
            filterSelect.value = filterType;
        }
        this.applyFilterAndRender();
    }

    // Method to refresh notifications
    async refreshNotifications() {
        await this.loadNotifications();
    }

    // Get notification counts by type
    getNotificationCounts() {
        const counts = {
            total: this.allNotifications.length,
            unread: this.allNotifications.filter(n => !n.read).length,
            byType: {}
        };

        const types = ['security', 'account', 'system', 'marketing', 'feature'];
        types.forEach(type => {
            const typeNotifications = this.allNotifications.filter(n => n.type === type);
            counts.byType[type] = {
                total: typeNotifications.length,
                unread: typeNotifications.filter(n => !n.read).length
            };
        });

        return counts;
    }
}