// File: managers/NotificationManager.js
class NotificationManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    async loadNotifications() {
        try {
            this.dashboard.loadingManager.showLoading(true);
            const response = await this.dashboard.apiManager.makeRequest('/notifications');
            const container = document.getElementById('notificationsList');

            if (!container.dataset.listenerAttached) {
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

                // Mark listener so it doesn't get attached again
                container.dataset.listenerAttached = "true";
            }

            if (response.data.notifications.length === 0) {
                container.innerHTML = '<p class="text-center">No notifications</p>';
                this.updateNotificationBadge(0);
                return;
            }

            // Build notifications list HTML
            const notificationsHtml = response.data.notifications.map(notification => `
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

            // Add "Clear All" button at the top
            container.innerHTML = `
            <div class="notification-header">
            </div>
            ${notificationsHtml}
        `;

            const unreadCount = response.data.notifications.filter(n => !n.read).length;
            this.updateNotificationBadge(unreadCount);

        } catch (error) {
            document.getElementById('notificationsList').innerHTML =
                '<p class="text-center">Error loading notifications</p>';
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to load notifications');
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    async deleteNotification(notificationId) {
        try {
            const button = document.querySelector(`.notification-delete-btn[data-notification-id="${notificationId}"]`);
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }

            await this.dashboard.apiManager.makeRequest(`/notifications/${notificationId}`, { method: 'DELETE' });

            const notificationItem = document.querySelector(`.notification-item[data-notification-id="${notificationId}"]`);
            if (notificationItem) {
                notificationItem.remove();
            }

            this.updateNotificationBadge();
        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', error.message.includes('404') ? 'Notification not found' : 'Failed to delete notification');

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

            await this.dashboard.apiManager.makeRequest(`/notifications/${notificationId}/read`, { method: 'PUT' });

            const notificationItem = document.querySelector(`.notification-item[data-notification-id="${notificationId}"]`);
            if (notificationItem) {
                notificationItem.classList.remove('unread');
                const markReadBtn = notificationItem.querySelector('.notification-mark-read-btn');
                if (markReadBtn) markReadBtn.remove();
            }

            this.updateNotificationBadge();
        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', error.message.includes('404') ? 'Notification not found' : 'Failed to mark notification as read');

            const button = document.querySelector(`.notification-mark-read-btn[data-notification-id="${notificationId}"]`);
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-check"></i>';
            }
        }
    }


    updateNotificationBadge() {
        const unreadItems = document.querySelectorAll('.notification-item.unread').length;
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = unreadItems;
            badge.style.display = unreadItems > 0 ? 'block' : 'none';
        }
    }

    async markAllNotificationsAsRead() {
        try {
            await this.dashboard.apiManager.makeRequest('/notifications/mark-all-read', {
                method: 'PUT'
            });

            // Update all notification items in DOM
            const unreadItems = document.querySelectorAll('.notification-item.unread');
            unreadItems.forEach(item => {
                item.classList.remove('unread');
                const markReadBtn = item.querySelector('.notification-mark-read-btn');
                if (markReadBtn) {
                    markReadBtn.remove();
                }
            });

            // Update notification badge
            this.updateNotificationBadge();


        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to mark all notifications as read');
        }
    }

    async clearAllNotifications() {
        if (!await this.dashboard.modalManager.showConfirm('Are you sure you want to delete all notifications? This action cannot be undone.')) {
            return;
        }

        try {
            await this.dashboard.apiManager.makeRequest('/notifications/clear-all', {
                method: 'DELETE'
            });

            // Clear notifications from DOM
            const container = document.getElementById('notificationsList');
            if (container) {
                container.innerHTML = '<p class="text-center">No notifications</p>';
            }

            // Update notification badge
            this.updateNotificationBadge();

        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to clear all notifications');
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
}