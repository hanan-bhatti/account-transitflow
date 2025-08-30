// File: managers/UserManager.js
class UserManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    async loadCurrentUser() {
        try {
            const response = await this.dashboard.apiManager.makeRequest('/profile');
            this.dashboard.currentUser = response.data.user;

            // Apply theme from user preferences if available
            if (this.dashboard.currentUser.preferences?.theme) {
                const dbTheme = this.dashboard.currentUser.preferences.theme;
                if (dbTheme !== this.dashboard.currentTheme) {
                    this.dashboard.currentTheme = dbTheme;
                    localStorage.setItem('theme', dbTheme);
                    this.dashboard.themeManager.applyTheme(dbTheme);
                }
            }

            this.updateUserDisplay();
            this.populateProfileForm();
            this.populateLocationForm(); // Add this line
            this.checkAdminAccess();
        } catch (error) {
            // Redirect to login if unauthorized
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                window.location.href = '/login';
            }
        }
    }

    async syncThemeWithDatabase() {
        if (!this.dashboard.currentUser?.preferences) {
            return;
        }

        const dbTheme = this.dashboard.currentUser.preferences.theme;
        const localTheme = localStorage.getItem('theme') || 'auto';

        // If themes don't match, use database theme as source of truth
        if (dbTheme && dbTheme !== localTheme) {
            this.dashboard.currentTheme = dbTheme;
            localStorage.setItem('theme', dbTheme);
            this.dashboard.themeManager.applyTheme(dbTheme);
        }
    }

    updateUserDisplay() {
        if (!this.dashboard.currentUser) return;

        // Update user info in header
        document.getElementById('userName').textContent =
            this.dashboard.currentUser.fullName || this.dashboard.currentUser.username;

        // Update user avatar
        const userAvatar = document.getElementById('userAvatar');
        userAvatar.src = this.dashboard.currentUser.avatar;
        userAvatar.alt = this.dashboard.currentUser.username;

        // Update favicon - Fixed version
        const faviconElement = document.querySelector('link[rel="icon"]');
        if (!faviconElement) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Favicon element not found');
            return;
        }

        // Set the favicon href to the user's profile picture or default
        faviconElement.href = this.dashboard.currentUser.avatar;

        this.updateTitle();
    }

    populateProfileForm() {
        if (!this.dashboard.currentUser) return;

        // Populate basic profile fields
        const fields = ['firstName', 'lastName', 'email', 'username', 'phone', 'bio', 'website'];

        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element && this.dashboard.currentUser[field]) {
                element.value = this.dashboard.currentUser[field];
            }
        });

        // Handle date of birth
        if (this.dashboard.currentUser.dateOfBirth) {
            const dobElement = document.getElementById('dateOfBirth');
            if (dobElement) {
                const date = new Date(this.dashboard.currentUser.dateOfBirth);
                dobElement.value = date.toISOString().split('T')[0];
            }
        }

        // Handle gender selection
        const genderElement = document.getElementById('gender');
        if (genderElement && this.dashboard.currentUser.gender) {
            genderElement.value = this.dashboard.currentUser.gender;
        }

        // FIXED: Handle theme selection in profile form
        const themeElement = document.getElementById('theme');
        if (themeElement) {
            themeElement.value = this.dashboard.currentTheme;

            // Add event listener for theme changes in profile form
            themeElement.addEventListener('change', async (e) => {
                const newTheme = e.target.value;
                await this.dashboard.themeManager.applyTheme(newTheme);
            });
        }

        // Handle profile picture
        const profilePictureElement = document.getElementById('profilePicture');
        if (profilePictureElement) {
            profilePictureElement.src = this.dashboard.currentUser.avatar;
        }
    }

    // NEW METHOD: Populate location form with saved location data
    populateLocationForm() {
        if (!this.dashboard.currentUser || !this.dashboard.currentUser.homeLocation) return;

        const location = this.dashboard.currentUser.homeLocation;

        // Populate address field
        const addressElement = document.getElementById('address');
        if (addressElement && location.address) {
            addressElement.value = location.address;
        }

        // Populate landmark field
        const landmarkElement = document.getElementById('landmark');
        if (landmarkElement && location.landmark) {
            landmarkElement.value = location.landmark;
        }

        // Populate coordinates if available
        if (location.coordinates && Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
            const [longitude, latitude] = location.coordinates;
            
            const latElement = document.getElementById('latitude');
            const lonElement = document.getElementById('longitude');
            
            if (latElement) {
                latElement.value = latitude;
            }
            if (lonElement) {
                lonElement.value = longitude;
            }
        }
    }

    async updateProfile(formData) {
        try {
            // Create update payload
            const updateData = {};

            // Handle basic fields
            const fields = ['firstName', 'lastName', 'phone', 'bio', 'website', 'dateOfBirth', 'gender'];

            fields.forEach(field => {
                const value = formData.get(field);
                if (value !== null && value !== undefined) {
                    if (field === 'dateOfBirth' && value) {
                        updateData[field] = value;
                    } else if (field === 'gender') {
                        // Handle gender - allow empty string to clear gender
                        updateData[field] = value || null;
                    } else {
                        updateData[field] = value.toString().trim();
                    }
                }
            });

            // FIXED: Handle theme update from profile form
            const themeValue = formData.get('theme');
            if (themeValue && themeValue !== this.dashboard.currentTheme) {
                await this.dashboard.themeManager.applyTheme(themeValue);
            }

            // Make API request
            const response = await this.dashboard.apiManager.makeRequest('/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData)
            });

            // Update current user data
            this.dashboard.currentUser = { ...this.dashboard.currentUser, ...response.data.user };

            // Update display
            this.updateUserDisplay();

            return response;
        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', error.message || 'Failed to update profile');
            throw error;
        }
    }

    checkAdminAccess() {
        const adminNav = document.querySelector('.admin-only');
        if (this.dashboard.currentUser?.role === 'admin' || this.dashboard.currentUser?.role === 'superadmin') {
            adminNav.style.display = 'block';
        } else {
            adminNav.style.display = 'none';
        }
    }

    updateProfileThemeDropdown() {
        const profileThemeSelect = document.getElementById('theme');
        if (profileThemeSelect && profileThemeSelect.value !== this.dashboard.currentTheme) {
            profileThemeSelect.value = this.dashboard.currentTheme;
        }
    }

    updateTitle() {
        const userName = this.dashboard.currentUser?.fullName || this.dashboard.currentUser?.username || 'User';
        const currentSectionName = this.dashboard.navigationManager.getCurrentSectionName();

        if (currentSectionName && currentSectionName !== 'Dashboard') {
            document.title = `${userName} - ${currentSectionName}`;
        } else {
            document.title = `${userName} - Dashboard`;
        }
    }

    async updateProfileDetails(formData) {
        try {
            this.dashboard.loadingManager.showLoading(true);

            const updateData = {};
            for (let [key, value] of formData.entries()) {
                if (value.trim()) {
                    if (value.trim().length < 2) {
                        this.dashboard.toastManager.showToast('error', 'Error', `${key} must be at least 2 characters long`);
                        return;
                    }
                    updateData[key] = value;
                }
            }

            const response = await this.dashboard.apiManager.makeRequest('/profile', {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });

            this.dashboard.currentUser = response.data.user;
            this.updateUserDisplay();

        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to update profile');
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    async uploadAvatar(file) {
        try {
            this.dashboard.loadingManager.showPictureLoading(true);

            const formData = new FormData();
            formData.append('avatar', file);

            const response = await this.dashboard.apiManager.makeRequest('/profile/avatar', {
                method: 'POST',
                body: formData,
                headers: {} // Remove Content-Type header for FormData
            });

            // Update profile pictures
            document.getElementById('profilePicture').src = response.data.avatar;
            document.getElementById('userAvatar').src = response.data.avatar;

            // Update current user data
            this.dashboard.currentUser.avatar = response.data.avatar;

            // Update favicon with new profile picture
            this.updateUserDisplay();

        } catch (error) {
            console.error('Error in uploadAvatar:', error);
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to upload profile picture');
        } finally {
            this.dashboard.loadingManager.showPictureLoading(false);
        }
    }

    async changePassword(formData) {
        try {
            const currentPassword = formData.get('currentPassword');
            const newPassword = formData.get('newPassword');
            const confirmPassword = formData.get('confirmPassword');

            if (newPassword !== confirmPassword) {
                this.dashboard.toastManager.showToast('error', 'Error', 'Passwords do not match');
                return;
            }

            this.dashboard.loadingManager.showLoading(true);

            await this.dashboard.apiManager.makeRequest('/change-password', {
                method: 'PUT',
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                    confirmPassword
                })
            });

            document.getElementById('passwordForm').reset();
            this.dashboard.toastManager.showToast('success', 'Success', 'Password changed successfully');

        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to change password');
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    // Method called by NavigationManager when loading profile section
    async loadProfileData() {
        try {
            // This loads the current user data for the profile section
            await this.loadCurrentUser();
            return this.dashboard.currentUser;
        } catch (error) {
            console.error('Error loading profile data:', error);
            throw error;
        }
    }

    async updateLocation(formData) {
        try {
            const latitude = parseFloat(formData.get('latitude'));
            const longitude = parseFloat(formData.get('longitude'));
            const address = formData.get('address');
            const landmark = formData.get('landmark');

            if (!latitude || !longitude || !address) {
                this.dashboard.toastManager.showToast('error', 'Error', 'Please provide latitude, longitude, and address');
                return;
            }

            this.dashboard.loadingManager.showLoading(true);

            const response = await this.dashboard.apiManager.makeRequest('/location', {
                method: 'PUT',
                body: JSON.stringify({
                    latitude,
                    longitude,
                    address,
                    landmark
                })
            });

            // Update current user with new location data
            this.dashboard.currentUser.homeLocation = response.data.location;

            this.dashboard.toastManager.showToast('success', 'Success', 'Location updated successfully');

        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to update location');
        } finally {
            this.dashboard.loadingManager.showLoading(false);
        }
    }

    getCurrentLocation() {
        const btn = document.getElementById('getCurrentLocation');
        const icon = btn.querySelector('i');

        if (!navigator.geolocation) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Geolocation is not supported by this browser');
            return;
        }

        // Update button state
        icon.className = 'fas fa-spinner fa-spin';
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting Location...';

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;

                    // Update coordinate fields
                    document.getElementById('latitude').value = latitude;
                    document.getElementById('longitude').value = longitude;

                    // Get address using reverse geocoding
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`
                    );

                    if (response.ok) {
                        const data = await response.json();

                        if (data && data.display_name) {
                            // Update address field
                            document.getElementById('address').value = data.display_name;
                            this.dashboard.toastManager.showToast('success', 'Success', 'Current location and address retrieved');
                        } else {
                            // Coordinates retrieved but no address found
                            this.dashboard.toastManager.showToast('warning', 'Partial Success', 'Location coordinates retrieved, but address could not be determined');
                        }
                    } else {
                        // Coordinates retrieved but geocoding failed
                        this.dashboard.toastManager.showToast('warning', 'Partial Success', 'Location coordinates retrieved, but address lookup failed');
                    }

                } catch (error) {
                    this.dashboard.toastManager.showToast('warning', 'Partial Success', 'Location coordinates retrieved, but address lookup failed');
                } finally {
                    // Reset button state
                    icon.className = 'fas fa-location-arrow';
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-location-arrow"></i> Use Current Location';
                }
            },
            (error) => {
                // Reset button state
                icon.className = 'fas fa-location-arrow';
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-location-arrow"></i> Use Current Location';

                let errorMessage = 'Unable to retrieve location';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access denied by user';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information unavailable';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out';
                        break;
                }

                this.dashboard.toastManager.showToast('error', 'Error', errorMessage);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    }

    async removeLocation() {
        try {
            await this.dashboard.apiManager.makeRequest('/location', { method: 'DELETE' });
            
            // Clear the current user's location data
            this.dashboard.currentUser.homeLocation = undefined;
            
            // Clear the form
            document.getElementById('locationForm').reset();
            
            this.dashboard.toastManager.showToast('success', 'Success', 'Location removed successfully');
        } catch (error) {
            this.dashboard.toastManager.showToast('error', 'Error', 'Failed to remove location');
        }
    }

async exportData() {
    try {
        this.dashboard.loadingManager.showLoading(true);
        this.dashboard.toastManager.showToast('info', 'Exporting', 'Preparing your data for export...');
        
        let exportData;
        
        try {
            // Try to fetch comprehensive data from API
            const response = await this.dashboard.apiManager.makeRequest('/export');
            
            // Check if response has the expected structure
            if (!response || (!response.success && !response.data && !response.userData)) {
                throw new Error('Invalid response structure from server');
            }
            
            // Handle different possible response structures
            const userData = response.data || response.userData || response;
            
            exportData = {
                exportDate: new Date().toISOString(),
                exportVersion: '1.0',
                exportedBy: this.dashboard.currentUser?.username || 'Unknown User',
                userData: userData
            };
            
        } catch (apiError) {
            console.warn('API export failed, using fallback method:', apiError);
            
            exportData = {
                exportDate: new Date().toISOString(),
                exportVersion: '1.0-fallback',
                exportedBy: this.dashboard.currentUser?.username || 'Unknown User',
                note: 'Fallback export - API unavailable',
                userData: {
                    profile: this.dashboard.currentUser,
                    preferences: this.dashboard.currentUser?.preferences || {},
                    location: this.dashboard.currentUser?.homeLocation || null,
                    exportMethod: 'client-side-fallback'
                }
            };
            
            this.dashboard.toastManager.showToast('warning', 'Using Fallback', 'Using available data for export...');
        }
        
        // Create and download the file
        const fileName = `user-data-export-${this.dashboard.currentUser?.username || 'user'}-${new Date().toISOString().split('T')[0]}.json`;
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
        
        this.dashboard.toastManager.showToast('success', 'Export Complete', 'Your data has been exported successfully');
        
        return true;
        
    } catch (error) {
        console.error('Error exporting user data:', error);
        
        // More specific error messages
        let errorMessage = 'Failed to export user data';
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'Network error - please check your connection';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorMessage = 'Session expired - please log in again';
        } else if (error.message.includes('403')) {
            errorMessage = 'Permission denied - insufficient access rights';
        } else if (error.message.includes('404')) {
            errorMessage = 'Export endpoint not found on server';
        } else if (error.message.includes('500')) {
            errorMessage = 'Server error - please try again later';
        }
        
        this.dashboard.toastManager.showToast('error', 'Export Failed', errorMessage);
        
        // Log detailed error for debugging
        console.error('Export error details:', {
            message: error.message,
            stack: error.stack,
            user: this.dashboard.currentUser?.username,
            timestamp: new Date().toISOString()
        });
        
        return false;
        
    } finally {
        this.dashboard.loadingManager.showLoading(false);
    }
}
}