// File: managers/AuditLogManager.js
class AuditLogManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.allAuditLogs = [];
        this.currentFilters = {
            search: '',
            fromDate: '',
            toDate: ''
        };
        this.debounceTimer = null;
        this.maxPages = 5;
        this.logsPerPage = 50;
        
        // Set default date range to last 3 days
        this.setDefaultDateRange();
        this.setupEventListeners();
    }

    setDefaultDateRange() {
        const today = new Date();
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(today.getDate() - 3);

        // Format dates for input fields (YYYY-MM-DD)
        const formatDate = (date) => {
            return date.getFullYear() + '-' + 
                   String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(date.getDate()).padStart(2, '0');
        };

        this.currentFilters.fromDate = formatDate(threeDaysAgo);
        this.currentFilters.toDate = formatDate(today);

        // Set the input field values
        setTimeout(() => {
            const fromDateInput = document.getElementById('auditFromDate');
            const toDateInput = document.getElementById('auditToDate');
            
            if (fromDateInput) fromDateInput.value = this.currentFilters.fromDate;
            if (toDateInput) toDateInput.value = this.currentFilters.toDate;
        }, 100);
    }

    setupEventListeners() {
        // Search input with debounce
        const searchInput = document.getElementById('auditSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.currentFilters.search = e.target.value;
                    this.applyFiltersAndRender();
                }, 300);
            });
        }

        // Date filters
        const fromDateInput = document.getElementById('auditFromDate');
        const toDateInput = document.getElementById('auditToDate');
        
        if (fromDateInput) {
            fromDateInput.addEventListener('change', (e) => {
                this.currentFilters.fromDate = e.target.value;
                this.applyFiltersAndRender();
            });
        }

        if (toDateInput) {
            toDateInput.addEventListener('change', (e) => {
                this.currentFilters.toDate = e.target.value;
                this.applyFiltersAndRender();
            });
        }
    }

    async loadAuditLogs(loadAllPages = true) {
        try {
            this.dashboard.loadingManager.showLoading(true);
            this.allAuditLogs = [];

            if (loadAllPages) {
                // Load all pages sequentially
                for (let page = 1; page <= this.maxPages; page++) {
                    const queryParams = new URLSearchParams({
                        page: page.toString(),
                        limit: this.logsPerPage.toString()
                    });

                    // Updated API endpoint path to match your backend route
                    const response = await this.dashboard.apiManager.makeRequest(`/audit-logs?${queryParams}`);
                    
                    if (response && response.data && response.data.auditLogs && response.data.auditLogs.length > 0) {
                        this.allAuditLogs = [...this.allAuditLogs, ...response.data.auditLogs];
                        
                        // If we got fewer logs than requested, we've reached the end
                        if (response.data.auditLogs.length < this.logsPerPage) {
                            break;
                        }
                    } else {
                        // No more logs available
                        break;
                    }
                }
            } else {
                // Load single page (fallback)
                const queryParams = new URLSearchParams({
                    page: '1',
                    limit: this.logsPerPage.toString()
                });

                const response = await this.dashboard.apiManager.makeRequest(`/audit-logs?${queryParams}`);
                if (response && response.data && response.data.auditLogs) {
                    this.allAuditLogs = response.data.auditLogs;
                }
            }

            console.log('Loaded audit logs:', this.allAuditLogs.length); // Debug log
            this.applyFiltersAndRender();

            return {
                total: this.allAuditLogs.length,
                loaded: this.allAuditLogs.length
            };

        } catch (error) {
            console.error('Error loading audit logs:', error);
            document.getElementById('auditLogsList').innerHTML =
                '<p class="text-center">Error loading audit logs. Please check your connection and try again.</p>';
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to load audit logs');
            return null;
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    applyFiltersAndRender() {
        let filteredLogs = [...this.allAuditLogs];

        // Apply search filter (fuzzy search)
        if (this.currentFilters.search) {
            filteredLogs = this.fuzzySearch(filteredLogs, this.currentFilters.search);
        }

        // Apply date filters
        if (this.currentFilters.fromDate || this.currentFilters.toDate) {
            filteredLogs = this.filterByDateRange(filteredLogs, this.currentFilters.fromDate, this.currentFilters.toDate);
        }

        console.log('Filtered logs:', filteredLogs.length); // Debug log
        this.renderAuditLogs(filteredLogs);
    }

    fuzzySearch(logs, searchTerm) {
        if (!searchTerm) return logs;

        const normalizedSearch = searchTerm.toLowerCase().trim();
        
        return logs.filter(log => {
            // Search in action name
            const actionText = this.formatActionName(log.action).toLowerCase();
            if (this.fuzzyMatch(actionText, normalizedSearch)) return true;

            // Search in formatted details
            const detailsText = this.extractSearchableText(log.details).toLowerCase();
            if (this.fuzzyMatch(detailsText, normalizedSearch)) return true;

            // Search in timestamp
            const timeText = new Date(log.timestamp).toLocaleString().toLowerCase();
            if (this.fuzzyMatch(timeText, normalizedSearch)) return true;

            return false;
        }).sort((a, b) => {
            // Sort by relevance (exact matches first, then partial matches)
            const aRelevance = this.calculateRelevance(a, normalizedSearch);
            const bRelevance = this.calculateRelevance(b, normalizedSearch);
            return bRelevance - aRelevance;
        });
    }

    fuzzyMatch(text, search) {
        // Simple fuzzy matching algorithm
        const words = search.split(' ').filter(w => w.length > 0);
        
        return words.every(word => {
            // Check for exact substring match
            if (text.includes(word)) return true;
            
            // Check for character proximity (allows for typos)
            return this.levenshteinDistance(text, word) <= Math.max(1, word.length * 0.3);
        });
    }

    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));
        
        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,     // insertion
                    matrix[j - 1][i] + 1,     // deletion
                    matrix[j - 1][i - 1] + cost // substitution
                );
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    calculateRelevance(log, searchTerm) {
        let relevance = 0;
        const actionText = this.formatActionName(log.action).toLowerCase();
        const detailsText = this.extractSearchableText(log.details).toLowerCase();
        
        // Exact matches get highest relevance
        if (actionText.includes(searchTerm)) relevance += 100;
        if (detailsText.includes(searchTerm)) relevance += 80;
        
        // Partial matches get lower relevance
        const words = searchTerm.split(' ');
        words.forEach(word => {
            if (actionText.includes(word)) relevance += 50;
            if (detailsText.includes(word)) relevance += 30;
        });
        
        return relevance;
    }

    extractSearchableText(details) {
        if (typeof details === 'string') return details;
        if (typeof details === 'object' && details !== null) {
            const { userType, deviceInfo } = details;
            let text = [];
            
            if (userType) text.push(userType);
            if (deviceInfo?.deviceName) text.push(deviceInfo.deviceName);
            if (deviceInfo?.location?.city) text.push(deviceInfo.location.city);
            if (deviceInfo?.location?.country) text.push(deviceInfo.location.country);
            if (deviceInfo?.ipAddress) text.push(deviceInfo.ipAddress);
            
            return text.join(' ');
        }
        return '';
    }

    filterByDateRange(logs, fromDate, toDate) {
        if (!fromDate && !toDate) return logs;

        return logs.filter(log => {
            const logDate = new Date(log.timestamp);
            
            if (fromDate) {
                const from = new Date(fromDate);
                from.setHours(0, 0, 0, 0);
                if (logDate < from) return false;
            }
            
            if (toDate) {
                const to = new Date(toDate);
                to.setHours(23, 59, 59, 999);
                if (logDate > to) return false;
            }
            
            return true;
        });
    }

    renderAuditLogs(logs) {
        const container = document.getElementById('auditLogsList');

        if (logs.length === 0) {
            const hasActiveFilters = this.currentFilters.search || this.currentFilters.fromDate || this.currentFilters.toDate;
            const message = hasActiveFilters
                ? 'No audit logs match your current filters. Try adjusting your search criteria or date range.'
                : 'No audit logs available for the selected time period.';
            container.innerHTML = `
                <div class="text-center" style="padding: 20px;">
                    <p>${message}</p>
                    ${hasActiveFilters ? '<button onclick="auditLogManager.clearFilters()" class="btn btn-secondary">Clear Filters</button>' : ''}
                </div>
            `;
            return;
        }

        const logsHtml = logs.map(log => {
            let formattedDetails = 'No details available';

            if (typeof log.details === 'object' && log.details !== null) {
                const { userType, deviceInfo } = log.details;
                const lines = [];

                if (userType) lines.push(`<p>User Type: ${userType}</p>`);
                if (deviceInfo?.deviceName) lines.push(`<p>Device: ${deviceInfo.deviceName}</p>`);
                if (deviceInfo?.location && deviceInfo.location !== 'Unknown Location') {
                    const locationText = deviceInfo.location.city 
                        ? `${deviceInfo.location.city}, ${deviceInfo.location.country || 'Unknown Country'}`
                        : 'Unknown Location';
                    lines.push(`<p>Location: ${locationText}</p>`);
                }
                if (deviceInfo?.ipAddress && deviceInfo.ipAddress !== '::1') {
                    lines.push(`<p>IP: ${deviceInfo.ipAddress}</p>`);
                }

                formattedDetails = lines.join('');
            } else if (typeof log.details === 'string') {
                formattedDetails = `<p>${log.details}</p>`;
            }

            // Highlight search terms
            const highlightedAction = this.highlightSearchTerm(
                this.formatActionName(log.action), 
                this.currentFilters.search
            );
            const highlightedDetails = this.highlightSearchTerm(
                formattedDetails, 
                this.currentFilters.search
            );

            return `
                <div class="audit-log-item">
                    <div class="audit-action">${highlightedAction}</div>
                    <div class="audit-details">${highlightedDetails}</div>
                    <div class="audit-time">${new Date(log.timestamp).toLocaleString()}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = logsHtml;
    }

    highlightSearchTerm(text, searchTerm) {
        if (!searchTerm) return text;
        
        const words = searchTerm.split(' ').filter(w => w.length > 0);
        let highlightedText = text;
        
        words.forEach(word => {
            const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
        });
        
        return highlightedText;
    }

    formatActionName(action) {
        if (!action) return 'Unknown Action';
        return action.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    clearFilters() {
        // Clear input values
        const searchInput = document.getElementById('auditSearch');
        const fromDateInput = document.getElementById('auditFromDate');
        const toDateInput = document.getElementById('auditToDate');
        
        if (searchInput) searchInput.value = '';
        if (fromDateInput) fromDateInput.value = '';
        if (toDateInput) toDateInput.value = '';
        
        // Reset filters
        this.currentFilters = {
            search: '',
            fromDate: '',
            toDate: ''
        };
        
        // Re-render with all logs
        this.renderAuditLogs(this.allAuditLogs);
    }

    // Method to refresh logs
    async refreshLogs() {
        this.allAuditLogs = [];
        await this.loadAuditLogs();
    }

    // Initialize method to be called when the audit logs section is shown
    async initialize() {
        await this.loadAuditLogs();
    }
}