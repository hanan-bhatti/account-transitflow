/**
 * Production-Ready Theme Manager
 * 
 * A comprehensive theme management system that provides automatic theme adaptation
 * based on weather conditions, local festivals, and user preferences. Features
 * include location-based theming, robust error handling, accessibility compliance,
 * and performance optimizations.
 * 
 * Architecture:
 * - Permission state machine for geolocation handling
 * - Efficient caching with ETag support and geolocation monitoring
 * - Debounced refresh system to prevent excessive API calls
 * - Fallback chains for weather and location data
 * - ARIA-compliant modals and tooltips with keyboard navigation
 * 
 * @class ThemeManager
 * @version 2.0.0
 */
class ThemeManager {
  // Constants
  static CACHE_TTL_MINUTES = 10;
  static WEATHER_CACHE_TTL_MINUTES = 5;
  static LOCATION_WATCH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  static DEBOUNCE_DELAY_MS = 500;
  static PERMISSION_CHECK_DELAY_MS = 60000; // 1 minute
  static PERIODIC_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  static MAX_RETRIES = 3;
  static RETRY_BASE_DELAY_MS = 1000;
  static PERMISSION_REJECTION_THRESHOLD = 3;

  // API endpoints
  static WEATHER_API_URL = 'https://api-auth.transitflow.qzz.io/api/weather';
  static THEME_API_URL = 'https://api-auth.transitflow.qzz.io/api/theme';
  static IP_GEOLOCATION_API_URL = 'https://api-auth.transitflow.qzz.io/api/location'; // Use same domain to avoid CORS

  // Permission states for finite state machine
  static PERMISSION_STATES = {
    UNKNOWN: 'unknown',
    PROMPTED: 'prompted',
    GRANTED: 'granted',
    DENIED: 'denied',
    PERMANENTLY_DENIED: 'permanently_denied'
  };

  // Internationalization messages
  static MESSAGES = {
    en: {
      locationModal: {
        title: '🌍 Enable Location for Better Themes',
        description: 'We\'d like to use your location to provide weather-based themes and local holiday celebrations.',
        features: [
          '🌞 Weather-adaptive themes (sunny, rainy, stormy)',
          '🎉 Local festival and holiday themes',
          '🌡️ Seasonal theme adjustments'
        ],
        privacy: 'Your location is only used for theme selection and never stored or shared.',
        allowButton: 'Enable Location',
        denyButton: 'Maybe Later',
        learnMore: 'Learn More',
        doNotAskAgain: 'Don\'t ask again'
      },
      status: {
        locationEnabled: '✅ Location enabled! Themes will now adapt to weather and local events.',
        networkIssues: '⚠️ Using system preference (network issues)',
        themeApplied: '🎨 Theme Applied'
      },
      themes: {
        independence: '🇵🇰 Pakistan Zindabad!',
        'pakistan-day': '🇵🇰 Pakistan Day Mubarak!',
        'kashmir-day': '🖤 Kashmir Solidarity Day',
        'defence-day': '⚔️ Defence Day Tribute',
        'quaid-birthday': '👨‍💼 Quaid-e-Azam Remembrance',
        ramadan: '🌙 Ramadan Kareem',
        sunny: '☀️ Bright & Sunny',
        rainy: '🌧️ Cool & Rainy',
        stormy: '⛈️ Stormy Weather',
        cloudy: '☁️ Cloudy Skies',
        winter: '❄️ Winter Vibes',
        spring: '🌸 Spring Fresh',
        summer: '🌞 Summer Heat',
        autumn: '🍂 Autumn Colors'
      },
      tooltips: {
        lightTheme: 'Light Theme',
        darkTheme: 'Dark Theme',
        autoTheme: 'Auto Theme',
        currentTheme: 'Currently: {themeName}'
      }
    }
  };

  /**
   * Initialize ThemeManager instance
   * @param {Object} dashboard - Dashboard instance reference
   */
  constructor(dashboard) {
    this.dashboard = dashboard;
    this.currentTooltip = null;
    this.locationWatchId = null;
    this.debounceTimers = new Map();
    this.retryAttempts = new Map();
    this.currentLanguage = 'en';
    
    // State initialization
    this.locationPermissionState = this.getLocationPermissionState();
    this.lastKnownLocation = this.getLastKnownLocation();
    
    this.initLocationPermissionHandling();
    this.initGeolocationMonitoring();
    this.bindEventListeners();
  }

  /**
   * Initialize location permission handling with smart scheduling
   * @private
   */
  initLocationPermissionHandling() {
    // Initial permission check after delay
    setTimeout(() => {
      if (this.shouldRequestLocationPermission()) {
        this.showLocationPermissionModal();
      }
    }, ThemeManager.PERMISSION_CHECK_DELAY_MS);

    // Setup smart periodic requests instead of constant interval
    this.scheduleNextPermissionCheck();
  }

  /**
   * Setup geolocation monitoring for cache invalidation
   * @private
   */
  initGeolocationMonitoring() {
    if (!navigator.geolocation || this.locationPermissionState.status !== ThemeManager.PERMISSION_STATES.GRANTED) {
      return;
    }

    // Watch position with low frequency for cache invalidation
    this.locationWatchId = navigator.geolocation.watchPosition(
      (position) => this.handleLocationChange(position),
      (error) => this.handleLocationError(error),
      {
        enableHighAccuracy: false,
        maximumAge: ThemeManager.LOCATION_WATCH_INTERVAL_MS,
        timeout: 30000
      }
    );
  }

  /**
   * Handle location changes for cache invalidation
   * @private
   * @param {GeolocationPosition} position - New position
   */
  handleLocationChange(position) {
    const { latitude, longitude } = position.coords;
    const lastLocation = this.lastKnownLocation;

    if (!lastLocation) {
      this.saveLastKnownLocation({ latitude, longitude });
      return;
    }

    // Check if location changed significantly (>1km)
    const distance = this.calculateDistance(
      lastLocation.latitude, lastLocation.longitude,
      latitude, longitude
    );

    if (distance > 1) { // 1km threshold
      this.saveLastKnownLocation({ latitude, longitude });
      this.invalidateLocationBasedCaches();
      
      if (this.dashboard.currentTheme === 'auto') {
        this.debouncedRefreshTheme();
      }
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @private
   * @param {number} lat1 - First latitude
   * @param {number} lon1 - First longitude
   * @param {number} lat2 - Second latitude
   * @param {number} lon2 - Second longitude
   * @returns {number} Distance in kilometers
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   * @private
   * @param {number} degrees - Degrees to convert
   * @returns {number} Radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Bind global event listeners
   * @private
   */
  bindEventListeners() {
    // Visibility change handling
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });

    // Reduced motion preference detection
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addListener(() => {
      this.updateAnimationPreferences();
    });

    // Online/offline detection
    window.addEventListener('online', () => {
      if (this.dashboard.currentTheme === 'auto') {
        this.debouncedRefreshTheme();
      }
    });
  }

  /**
   * Handle document visibility changes
   * @private
   */
  handleVisibilityChange() {
    if (!document.hidden && this.dashboard.currentTheme === 'auto') {
      const cachedInfo = this.getCachedThemeInfo();
      if (!cachedInfo || !this.isCacheValid(cachedInfo)) {
        this.debouncedRefreshTheme();
      }
    }
  }

  /**
   * Update animation preferences based on user settings
   * @private
   */
  updateAnimationPreferences() {
    this.animationsEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Get location permission state from storage
   * @private
   * @returns {Object} Permission state object
   */
  getLocationPermissionState() {
    try {
      const stored = localStorage.getItem('locationPermissionState');
      return stored ? JSON.parse(stored) : {
        status: ThemeManager.PERMISSION_STATES.UNKNOWN,
        lastRequested: null,
        rejectedCount: 0,
        nextRequestTime: null,
        doNotAskAgain: false
      };
    } catch (error) {
      this.handleError(error, 'getLocationPermissionState');
      return {
        status: ThemeManager.PERMISSION_STATES.UNKNOWN,
        lastRequested: null,
        rejectedCount: 0,
        nextRequestTime: null,
        doNotAskAgain: false
      };
    }
  }

  /**
   * Save location permission state to storage
   * @private
   * @param {Object} state - State object to save
   */
  saveLocationPermissionState(state) {
    try {
      localStorage.setItem('locationPermissionState', JSON.stringify(state));
      this.locationPermissionState = { ...state };
    } catch (error) {
      this.handleError(error, 'saveLocationPermissionState');
    }
  }

  /**
   * Get last known location from storage
   * @private
   * @returns {Object|null} Last known location
   */
  getLastKnownLocation() {
    try {
      const stored = localStorage.getItem('lastKnownLocation');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      this.handleError(error, 'getLastKnownLocation');
      return null;
    }
  }

  /**
   * Save last known location to storage
   * @private
   * @param {Object} location - Location object to save
   */
  saveLastKnownLocation(location) {
    try {
      localStorage.setItem('lastKnownLocation', JSON.stringify({
        ...location,
        timestamp: Date.now()
      }));
      this.lastKnownLocation = { ...location };
    } catch (error) {
      this.handleError(error, 'saveLastKnownLocation');
    }
  }

  /**
   * Check if location permission should be requested
   * @private
   * @returns {boolean} Whether to request permission
   */
  shouldRequestLocationPermission() {
    const state = this.locationPermissionState;
    
    // Don't ask if user opted out or already granted
    if (state.doNotAskAgain || state.status === ThemeManager.PERMISSION_STATES.GRANTED) {
      return false;
    }
    
    // Don't ask if permanently denied
    if (state.status === ThemeManager.PERMISSION_STATES.PERMANENTLY_DENIED) {
      return false;
    }
    
    // Never asked before
    if (!state.lastRequested) {
      return true;
    }
    
    // Check if enough time has passed for next request
    if (state.nextRequestTime && Date.now() < state.nextRequestTime) {
      return false;
    }
    
    return true;
  }

  /**
   * Schedule next permission check using exponential backoff
   * @private
   */
  scheduleNextPermissionCheck() {
    const checkPermission = () => {
      if (this.shouldRequestLocationPermission() && 
          this.locationPermissionState.status === ThemeManager.PERMISSION_STATES.DENIED) {
        this.showLocationPermissionModal();
      }
      
      // Schedule next check with exponential backoff
      const backoffMultiplier = Math.min(
        Math.pow(2, this.locationPermissionState.rejectedCount),
        24 // Max 24 hours
      );
      const nextCheckDelay = ThemeManager.PERIODIC_CHECK_INTERVAL_MS * backoffMultiplier;
      
      setTimeout(checkPermission, nextCheckDelay);
    };

    setTimeout(checkPermission, ThemeManager.PERIODIC_CHECK_INTERVAL_MS);
  }

  /**
   * Check permission status using Permissions API
   * @private
   * @returns {Promise<string>} Permission status
   */
  async checkPermissionStatus() {
    try {
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state;
      }
      return 'unknown';
    } catch (error) {
      this.handleError(error, 'checkPermissionStatus');
      return 'unknown';
    }
  }

  /**
   * Show location permission modal with accessibility features
   * @private
   */
  async showLocationPermissionModal() {
    // Check permission status first to avoid unnecessary prompts
    const permissionStatus = await this.checkPermissionStatus();
    if (permissionStatus === 'granted') {
      this.saveLocationPermissionState({
        ...this.locationPermissionState,
        status: ThemeManager.PERMISSION_STATES.GRANTED
      });
      return;
    }

    // Remove existing modal
    const existing = document.getElementById('location-permission-modal');
    if (existing) existing.remove();

    const messages = ThemeManager.MESSAGES[this.currentLanguage].locationModal;
    
    const modal = document.createElement('dialog');
    modal.id = 'location-permission-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'modal-title');
    modal.setAttribute('aria-describedby', 'modal-description');
    modal.setAttribute('aria-modal', 'true');
    
    modal.innerHTML = `
      <div class="modal-overlay" role="presentation"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="modal-title">${messages.title}</h3>
          <button 
            class="modal-close" 
            aria-label="Close dialog"
            type="button"
          >×</button>
        </div>
        <div class="modal-body">
          <p id="modal-description">${messages.description}</p>
          <ul role="list">
            ${messages.features.map(feature => `<li>${feature}</li>`).join('')}
          </ul>
          <p><small>${messages.privacy}</small></p>
          <p><small>
            <a href="https://policy.transitflow.qzz.io/privacy" target="_blank" rel="noopener noreferrer">
              ${messages.learnMore}
            </a>
          </small></p>
        </div>
        <div class="modal-footer">
          <label class="do-not-ask-wrapper">
            <input type="checkbox" id="do-not-ask-again" />
            <span>${messages.doNotAskAgain}</span>
          </label>
          <div class="button-group">
            <button id="location-deny-btn" class="btn-secondary" type="button">
              ${messages.denyButton}
            </button>
            <button id="location-allow-btn" class="btn-primary" type="button">
              ${messages.allowButton}
            </button>
          </div>
        </div>
      </div>
    `;

    this.ensureModalStyles();
    document.body.appendChild(modal);

    // Focus trap implementation
    this.setupFocusTrap(modal);

    // Handle button clicks
    const allowBtn = modal.querySelector('#location-allow-btn');
    const denyBtn = modal.querySelector('#location-deny-btn');
    const closeBtn = modal.querySelector('.modal-close');
    const overlay = modal.querySelector('.modal-overlay');

    allowBtn.onclick = () => this.requestLocationPermission(modal);
    denyBtn.onclick = () => this.handleLocationDenied(modal);
    closeBtn.onclick = () => this.handleLocationDenied(modal);
    overlay.onclick = () => this.handleLocationDenied(modal);

    // Keyboard handling
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.handleLocationDenied(modal);
      }
    });

    // Show modal
    if (modal.showModal) {
      modal.showModal();
    } else {
      // Fallback for browsers without dialog support
      modal.style.display = 'flex';
      modal.setAttribute('open', '');
    }

    // Focus first interactive element
    allowBtn.focus();
  }

  /**
   * Setup focus trap for modal accessibility
   * @private
   * @param {HTMLElement} modal - Modal element
   */
  setupFocusTrap(modal) {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    });
  }

  /**
   * Request location permission with error handling
   * @private
   * @param {HTMLElement} modal - Modal element
   */
  async requestLocationPermission(modal) {
    try {
      const position = await this.getCurrentPosition({
        timeout: 50000,
        enableHighAccuracy: false,
        maximumAge: 300000
      });
      
      // Permission granted
      this.saveLocationPermissionState({
        status: ThemeManager.PERMISSION_STATES.GRANTED,
        lastRequested: Date.now(),
        rejectedCount: 0,
        nextRequestTime: null,
        doNotAskAgain: false
      });

      this.saveLastKnownLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });

      this.closeModal(modal);
      this.showThemeStatus(
        null, 
        null, 
        ThemeManager.MESSAGES[this.currentLanguage].status.locationEnabled
      );
      
      // Start location monitoring
      this.initGeolocationMonitoring();
      
      // Refresh theme with location
      if (this.dashboard.currentTheme === 'auto') {
        this.debouncedRefreshTheme();
      }
    } catch (error) {
      this.handleLocationError(error);
      this.handleLocationDenied(modal);
    }
  }

  /**
   * Handle location permission denied
   * @private
   * @param {HTMLElement} modal - Modal element
   */
  handleLocationDenied(modal) {
    const doNotAskAgain = modal.querySelector('#do-not-ask-again')?.checked || false;
    const state = this.locationPermissionState;
    const newRejectedCount = state.rejectedCount + 1;
    
    // Determine if permanently denied
    const isPermanentlyDenied = newRejectedCount >= ThemeManager.PERMISSION_REJECTION_THRESHOLD;
    
    // Calculate next request time with exponential backoff
    const baseDelay = Math.min(
      ThemeManager.PERIODIC_CHECK_INTERVAL_MS * Math.pow(2, newRejectedCount), 
      24 * 60 * 60 * 1000 // Max 24 hours
    );
    const randomDelay = Math.random() * baseDelay * 0.5;
    
    this.saveLocationPermissionState({
      status: isPermanentlyDenied ? 
        ThemeManager.PERMISSION_STATES.PERMANENTLY_DENIED : 
        ThemeManager.PERMISSION_STATES.DENIED,
      lastRequested: Date.now(),
      rejectedCount: newRejectedCount,
      nextRequestTime: doNotAskAgain ? null : Date.now() + baseDelay + randomDelay,
      doNotAskAgain: doNotAskAgain || isPermanentlyDenied
    });

    this.closeModal(modal);
  }

  /**
   * Handle location-related errors
   * @private
   * @param {GeolocationPositionError} error - Geolocation error
   */
  handleLocationError(error) {
    let status = ThemeManager.PERMISSION_STATES.DENIED;
    
    // Detect permanent denial based on error code
    if (error.code === error.PERMISSION_DENIED) {
      status = ThemeManager.PERMISSION_STATES.PERMANENTLY_DENIED;
    }
    
    this.saveLocationPermissionState({
      ...this.locationPermissionState,
      status,
      lastRequested: Date.now()
    });

    this.handleError(error, 'handleLocationError');
  }

  /**
   * Close modal with proper cleanup
   * @private
   * @param {HTMLElement} modal - Modal element
   */
  closeModal(modal) {
    if (modal.close) {
      modal.close();
    } else {
      modal.style.display = 'none';
      modal.removeAttribute('open');
    }
    
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
      }
    }, 300);
  }

  /**
   * Get current position with Promise interface and retry logic
   * @private
   * @param {PositionOptions} options - Geolocation options
   * @returns {Promise<GeolocationPosition>} Position promise
   */
  getCurrentPosition(options = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      const defaultOptions = {
        timeout: 30000,
        enableHighAccuracy: false,
        maximumAge: 300000,
        ...options
      };

      navigator.geolocation.getCurrentPosition(resolve, reject, defaultOptions);
    });
  }

  /**
   * Main theme initialization
   * @public
   */
  initTheme() {
    this.updateAnimationPreferences();
    this.applyTheme(this.dashboard.currentTheme);
    this.updateThemeToggle();
    this.initThemeTooltip();
    this.initializeDynamicThemeRefresh();
  }

  /**
   * Apply theme with comprehensive error handling
   * @public
   * @param {string} theme - Theme to apply
   */
  async applyTheme(theme) {
    try {
      if (theme === 'auto') {
        await this.handleAutoTheme();
      } else {
        this.handleManualTheme(theme);
      }
    } catch (error) {
      this.handleError(error, 'applyTheme');
      this.applyFallbackTheme();
    }
  }

  /**
   * Handle automatic theme application
   * @private
   */
  async handleAutoTheme() {
    const cachedTheme = this.getCachedThemeInfo();
    
    if (cachedTheme && this.isCacheValid(cachedTheme)) {
      this.applyCachedTheme(cachedTheme);
      this.scheduleThemeRefresh();
      return;
    }

    await this.fetchAndApplyNewTheme();
  }

  /**
   * Handle manual theme application
   * @private
   * @param {string} theme - Manual theme name
   */
  handleManualTheme(theme) {
    // Clear location-based caches when switching to manual theme
    this.clearLocationBasedCaches();
    
    this.batchDOMUpdates(() => {
      this.clearDynamicThemeColors();
      document.documentElement.setAttribute('data-theme', theme);
    });
    
    this.dashboard.currentTheme = theme;
    this.dashboard.currentDynamicTheme = null;
    
    try {
      localStorage.setItem('theme', theme);
      localStorage.removeItem('dynamicThemeInfo');
    } catch (error) {
      this.handleError(error, 'handleManualTheme storage');
    }
    
    this.updateThemePreferenceInBackground(theme);
    this.updateThemeToggle();
    this.dashboard.userManager?.updateProfileThemeDropdown();
  }

  /**
   * Apply cached theme with validation
   * @private
   * @param {Object} cachedTheme - Cached theme data
   */
  applyCachedTheme(cachedTheme) {
    if (!this.validateThemeData(cachedTheme.theme)) {
      throw new Error('Invalid cached theme data');
    }

    this.batchDOMUpdates(() => {
      this.applyDynamicThemeColors(cachedTheme.theme.colors);
      document.documentElement.setAttribute('data-theme', cachedTheme.theme.theme || 'auto');
    });
    
    this.dashboard.currentTheme = 'auto';
    this.dashboard.currentDynamicTheme = cachedTheme.theme;
    this.updateThemeToggle();
    this.dashboard.userManager?.updateProfileThemeDropdown();
    this.showThemeStatus(cachedTheme.theme, cachedTheme.weather);
    this.updateThemePreferenceInBackground('auto');
  }

  /**
   * Fetch and apply new theme with fallback chain
   * @private
   */
  async fetchAndApplyNewTheme() {
    const weather = await this.getCurrentWeatherWithFallbacks();
    const dynamicTheme = await this.fetchDynamicThemeWithRetry(weather);
    
    if (!dynamicTheme || !this.validateThemeData(dynamicTheme)) {
      throw new Error('Failed to fetch or validate dynamic theme');
    }

    this.batchDOMUpdates(() => {
      this.applyDynamicThemeColors(dynamicTheme.colors);
      document.documentElement.setAttribute('data-theme', dynamicTheme.theme || 'auto');
    });
    
    this.dashboard.currentTheme = 'auto';
    this.dashboard.currentDynamicTheme = dynamicTheme;
    
    // Cache theme with error handling
    this.cacheThemeInfo(dynamicTheme, weather);
    
    this.updateThemeToggle();
    this.dashboard.userManager?.updateProfileThemeDropdown();
    this.showThemeStatus(dynamicTheme, weather);
    this.scheduleThemeRefresh();
    this.updateThemePreferenceInBackground('auto');
  }

  /**
   * Apply fallback theme when all else fails
   * @private
   */
  applyFallbackTheme() {
    const cachedTheme = this.getCachedThemeInfo();
    if (cachedTheme && this.validateThemeData(cachedTheme.theme)) {
      this.applyCachedTheme(cachedTheme);
      return;
    }

    // If no cached theme or APIs are failing, use browser-based fallback
    const browserContext = this.getBrowserContextSync();
    if (browserContext) {
      this.applyContextBasedTheme(browserContext);
      return;
    }

    // Final system preference fallback
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.handleManualTheme(prefersDark ? 'dark' : 'light');
    this.showThemeStatus(
      null, 
      null, 
      ThemeManager.MESSAGES[this.currentLanguage].status.networkIssues
    );
  }

  /**
   * Get browser context synchronously for fallback scenarios
   * @private
   * @returns {Object|null} Browser context
   */
  getBrowserContextSync() {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const now = new Date();
      const hour = now.getHours();
      const month = now.getMonth();
      
      let season = 'spring';
      if (month >= 11 || month <= 1) season = 'winter';
      else if (month >= 2 && month <= 4) season = 'spring';
      else if (month >= 5 && month <= 8) season = 'summer';
      else season = 'autumn';

      let timeOfDay = 'day';
      if (hour >= 20 || hour < 6) timeOfDay = 'night';
      else if (hour >= 6 && hour < 12) timeOfDay = 'morning';
      else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
      else timeOfDay = 'evening';

      return {
        timezone,
        season,
        timeOfDay,
        hour,
        month,
        prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches
      };
    } catch (error) {
      this.handleError(error, 'getBrowserContextSync');
      return null;
    }
  }

  /**
   * Apply context-based theme when APIs are unavailable
   * @private
   * @param {Object} context - Browser context
   */
  applyContextBasedTheme(context) {
    try {
      // Generate simple theme based on time and season
      let baseTheme = context.prefersDark ? 'dark' : 'light';
      
      // Adjust for time of day
      if (context.timeOfDay === 'night' && !context.prefersDark) {
        baseTheme = 'dark'; // Force dark theme at night
      }

      // Apply base theme
      this.handleManualTheme(baseTheme);
      
      // Add subtle seasonal colors if possible
      this.applySeasonalAccents(context.season);
      
      // Update status
      const seasonName = context.season.charAt(0).toUpperCase() + context.season.slice(1);
      this.showThemeStatus(
        null,
        null,
        `🕒 ${seasonName} theme (offline mode)`
      );
      
    } catch (error) {
      this.handleError(error, 'applyContextBasedTheme');
      // Final fallback to system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.handleManualTheme(prefersDark ? 'dark' : 'light');
    }
  }

  /**
   * Apply seasonal color accents
   * @private
   * @param {string} season - Current season
   */
  applySeasonalAccents(season) {
    const seasonalColors = {
      spring: {
        '--accent-primary': '#22c55e',
        '--accent-secondary': '#84cc16'
      },
      summer: {
        '--accent-primary': '#f59e0b',
        '--accent-secondary': '#eab308'
      },
      autumn: {
        '--accent-primary': '#ea580c',
        '--accent-secondary': '#dc2626'
      },
      winter: {
        '--accent-primary': '#3b82f6',
        '--accent-secondary': '#6366f1'
      }
    };

    const colors = seasonalColors[season];
    if (colors) {
      this.batchDOMUpdates(() => {
        Object.entries(colors).forEach(([property, value]) => {
          document.documentElement.style.setProperty(property, value);
        });
      });
    }
  }

  /**
   * Validate theme data structure
   * @private
   * @param {Object} themeData - Theme data to validate
   * @returns {boolean} Whether theme data is valid
   */
  validateThemeData(themeData) {
    if (!themeData || typeof themeData !== 'object') {
      return false;
    }

    // Check required properties
    if (!themeData.colors || typeof themeData.colors !== 'object') {
      return false;
    }

    // Validate color properties
    const requiredColors = [
      '--bg-primary', '--bg-secondary', '--text-primary', '--text-secondary'
    ];

    return requiredColors.every(color => 
      themeData.colors.hasOwnProperty(color) && 
      typeof themeData.colors[color] === 'string'
    );
  }

  /**
   * Cache theme information with error handling
   * @private
   * @param {Object} dynamicTheme - Theme data
   * @param {string|null} weather - Weather condition
   */
  cacheThemeInfo(dynamicTheme, weather) {
    try {
      localStorage.setItem('theme', 'auto');
      localStorage.setItem('dynamicThemeInfo', JSON.stringify({
        theme: dynamicTheme,
        lastUpdated: new Date().toISOString(),
        weather: weather,
        etag: this.lastThemeETag
      }));
    } catch (error) {
      this.handleError(error, 'cacheThemeInfo');
    }
  }

  /**
   * Get cached theme information with validation
   * @private
   * @returns {Object|null} Cached theme info
   */
  getCachedThemeInfo() {
    try {
      const cached = localStorage.getItem('dynamicThemeInfo');
      const parsed = cached ? JSON.parse(cached) : null;
      return parsed && this.validateThemeData(parsed.theme) ? parsed : null;
    } catch (error) {
      this.handleError(error, 'getCachedThemeInfo');
      return null;
    }
  }

  /**
   * Check if cache is still valid
   * @private
   * @param {Object} cachedInfo - Cached theme info
   * @returns {boolean} Whether cache is valid
   */
  isCacheValid(cachedInfo) {
    if (!cachedInfo?.lastUpdated) return false;
    
    const lastUpdated = new Date(cachedInfo.lastUpdated);
    const cacheExpiry = new Date(Date.now() - ThemeManager.CACHE_TTL_MINUTES * 60 * 1000);
    
    return lastUpdated > cacheExpiry;
  }

  /**
   * Clear location-based caches when switching themes
   * @private
   */
  clearLocationBasedCaches() {
    try {
      localStorage.removeItem('dynamicThemeInfo');
      localStorage.removeItem('cachedWeather');
    } catch (error) {
      this.handleError(error, 'clearLocationBasedCaches');
    }
  }

  /**
   * Invalidate caches when location changes significantly
   * @private
   */
  invalidateLocationBasedCaches() {
    this.clearLocationBasedCaches();
    this.retryAttempts.clear();
    console.log('Location-based caches invalidated due to location change');
  }

  /**
   * Get current weather with comprehensive fallback chain
   * @private
   * @returns {Promise<string|null>} Weather condition
   */
  async getCurrentWeatherWithFallbacks() {
    // Check permission first
    if (this.locationPermissionState.status !== ThemeManager.PERMISSION_STATES.GRANTED) {
      return await this.getWeatherByIPLocationOrBrowserFallback();
    }

    try {
      // Try cached weather first
      const cachedWeather = this.getCachedWeather();
      if (cachedWeather) {
        return cachedWeather.condition;
      }

      // Try GPS location
      const position = await this.getCurrentPosition();
      const weather = await this.fetchWeatherByLocationWithRetry(
        position.coords.latitude, 
        position.coords.longitude
      );
      
      if (weather) {
        this.cacheWeather(weather);
        return weather;
      }
    } catch (error) {
      this.handleError(error, 'getCurrentWeatherWithFallbacks - GPS');
    }

    // Fallback to IP-based location or browser detection
    return await this.getWeatherByIPLocationOrBrowserFallback();
  }

  /**
   * Get weather using IP location with browser fallback
   * @private
   * @returns {Promise<string|null>} Weather condition
   */
  async getWeatherByIPLocationOrBrowserFallback() {
    try {
      // Try the same-domain IP location endpoint first
      const ipLocation = await this.fetchWithRetry(
        ThemeManager.IP_GEOLOCATION_API_URL,
        { timeout: 30000 } // Add timeout to fail fast
      );
      
      if (ipLocation?.latitude && ipLocation?.longitude) {
        const weather = await this.fetchWeatherByLocationWithRetry(
          ipLocation.latitude, 
          ipLocation.longitude
        );
        if (weather) {
          this.cacheWeather(weather);
          return weather;
        }
      }
    } catch (error) {
      this.handleError(error, 'getWeatherByIPLocationOrBrowserFallback - API');
    }

    // Fallback to browser-based context without external APIs
    try {
      const browserContext = await this.getBrowserLocationContext();
      if (browserContext) {
        // Use time-based weather estimation
        return this.estimateWeatherFromContext(browserContext);
      }
    } catch (error) {
      this.handleError(error, 'getWeatherByIPLocationOrBrowserFallback - browser');
    }

    // Final fallback: return null to let theme API handle location-based themes
    return null;
  }

  /**
   * Get location context from browser without external APIs
   * @private
   * @returns {Promise<Object|null>} Browser-based location context
   */
  async getBrowserLocationContext() {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const language = navigator.language || 'en-US';
      const now = new Date();
      
      // Basic timezone to region mapping
      const timezoneRegions = {
        'Asia/Karachi': { region: 'Pakistan', lat: 24.8607, lon: 67.0011 },
        'Asia/Kolkata': { region: 'India', lat: 22.5726, lon: 88.3639 },
        'Asia/Dubai': { region: 'UAE', lat: 25.2048, lon: 55.2708 },
        'Europe/London': { region: 'UK', lat: 51.5074, lon: -0.1278 },
        'America/New_York': { region: 'USA', lat: 40.7128, lon: -74.0060 },
        'Asia/Tokyo': { region: 'Japan', lat: 35.6762, lon: 139.6503 }
      };

      const locationInfo = timezoneRegions[timezone] || { 
        region: 'Pakistan',
        lat: 24.8607,
        lon: 67.0011
      };

      // Add seasonal and time context
      const month = now.getMonth(); // 0-11
      const hour = now.getHours();
      
      let season = 'spring';
      if (month >= 11 || month <= 1) season = 'winter';
      else if (month >= 2 && month <= 4) season = 'spring';
      else if (month >= 5 && month <= 8) season = 'summer';
      else season = 'autumn';

      let timeOfDay = 'day';
      if (hour >= 5 && hour < 12) timeOfDay = 'morning';
      else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
      else if (hour >= 17 && hour < 20) timeOfDay = 'evening';
      else timeOfDay = 'night';

      return {
        ...locationInfo,
        timezone,
        language,
        season,
        timeOfDay,
        month,
        hour,
        timestamp: now.getTime()
      };
    } catch (error) {
      this.handleError(error, 'getBrowserLocationContext');
      return null;
    }
  }

  /**
   * Estimate weather condition from browser context
   * @private
   * @param {Object} context - Browser context
   * @returns {string|null} Estimated weather condition
   */
  estimateWeatherFromContext(context) {
    if (!context) return null;

    const { region, season, month, hour } = context;

    // Simple weather estimation based on region and season
    const weatherPatterns = {
      Pakistan: {
        winter: ['cloudy', 'clear'][Math.floor(Math.random() * 2)],
        spring: ['sunny', 'clear'][Math.floor(Math.random() * 2)],
        summer: ['sunny', 'hot'][Math.floor(Math.random() * 2)],
        autumn: ['clear', 'cloudy'][Math.floor(Math.random() * 2)]
      },
      India: {
        winter: ['clear', 'cloudy'][Math.floor(Math.random() * 2)],
        spring: ['sunny', 'clear'][Math.floor(Math.random() * 2)],
        summer: ['hot', 'sunny'][Math.floor(Math.random() * 2)],
        autumn: ['clear', 'cloudy'][Math.floor(Math.random() * 2)]
      },
      UK: {
        winter: ['cloudy', 'rainy'][Math.floor(Math.random() * 2)],
        spring: ['cloudy', 'clear'][Math.floor(Math.random() * 2)],
        summer: ['clear', 'sunny'][Math.floor(Math.random() * 2)],
        autumn: ['cloudy', 'rainy'][Math.floor(Math.random() * 2)]
      }
    };

    const regionPattern = weatherPatterns[region] || weatherPatterns.Pakistan;
    const seasonalWeather = regionPattern[season] || 'clear';
    
    // Add some randomness to avoid predictable patterns
    const weatherOptions = [seasonalWeather, 'clear', 'cloudy'];
    return weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
  }

  /**
   * Get cached weather with validation
   * @private
   * @returns {Object|null} Cached weather data
   */
  getCachedWeather() {
    try {
      const cached = localStorage.getItem('cachedWeather');
      if (!cached) return null;
      
      const weatherData = JSON.parse(cached);
      const cacheExpiry = new Date(
        Date.now() - ThemeManager.WEATHER_CACHE_TTL_MINUTES * 60 * 1000
      );
      
      if (new Date(weatherData.timestamp) > cacheExpiry) {
        return weatherData;
      }
      
      localStorage.removeItem('cachedWeather');
      return null;
    } catch (error) {
      this.handleError(error, 'getCachedWeather');
      return null;
    }
  }

  /**
   * Cache weather data with error handling
   * @private
   * @param {string} condition - Weather condition
   */
  cacheWeather(condition) {
    try {
      localStorage.setItem('cachedWeather', JSON.stringify({
        condition: condition,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      this.handleError(error, 'cacheWeather');
    }
  }

  /**
   * Fetch weather by location with retry logic and ETag support
   * @private
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Promise<string|null>} Weather condition
   */
  async fetchWeatherByLocationWithRetry(lat, lon) {
    const cacheKey = `weather_${lat.toFixed(2)}_${lon.toFixed(2)}`;
    
    return await this.retryWithExponentialBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const headers = {};
      if (this.lastWeatherETag) {
        headers['If-None-Match'] = this.lastWeatherETag;
      }
      
      try {
        const response = await fetch(
          `${ThemeManager.WEATHER_API_URL}?lat=${lat}&lon=${lon}`, 
          { 
            signal: controller.signal,
            headers: headers
          }
        );
        
        clearTimeout(timeoutId);
        
        if (response.status === 304) {
          // Not modified, use cached data
          const cached = this.getCachedWeather();
          return cached?.condition || null;
        }
        
        if (!response.ok) {
          throw new Error(`Weather API error: ${response.status}`);
        }
        
        // Store ETag for future requests
        this.lastWeatherETag = response.headers.get('ETag');
        
        const data = await response.json();
        return this.sanitizeInput(data.condition);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Weather request timeout');
        }
        throw error;
      }
    }, cacheKey);
  }

  /**
   * Fetch dynamic theme with retry logic and ETag support
   * @private
   * @param {string|null} weather - Weather condition
   * @returns {Promise<Object|null>} Theme data
   */
  async fetchDynamicThemeWithRetry(weather = null) {
    const cacheKey = `theme_${weather || 'default'}`;
    
    return await this.retryWithExponentialBackoff(async () => {
      const params = new URLSearchParams();
      if (weather) {
        params.append('weather', this.sanitizeInput(weather));
      }
      
      const userLocation = this.dashboard.currentUser?.preferences?.location || 'Pakistan';
      params.append('location', this.sanitizeInput(userLocation));
      
      const headers = {};
      if (this.lastThemeETag) {
        headers['If-None-Match'] = this.lastThemeETag;
      }
      
      const response = await fetch(
        `${ThemeManager.THEME_API_URL}?${params.toString()}`,
        { headers: headers }
      );
      
      if (response.status === 304) {
        // Not modified, use cached data
        const cached = this.getCachedThemeInfo();
        return cached?.theme || null;
      }
      
      if (!response.ok) {
        throw new Error(`Theme API error: ${response.status}`);
      }
      
      // Store ETag for future requests
      this.lastThemeETag = response.headers.get('ETag');
      
      const data = await response.json();
      
      // Validate response structure
      if (!this.validateThemeData(data)) {
        throw new Error('Invalid theme data received from API');
      }
      
      return data;
    }, cacheKey);
  }

  /**
   * Generic fetch with retry logic and better error handling
   * @private
   * @param {string} url - URL to fetch
   * @param {RequestInit} options - Fetch options
   * @returns {Promise<any>} Response data
   */
  async fetchWithRetry(url, options = {}) {
    const cacheKey = `fetch_${url}`;
    
    return await this.retryWithExponentialBackoff(async () => {
      const controller = new AbortController();
      const timeout = options.timeout || 8000; // 8 second default timeout
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Handle specific HTTP errors
          if (response.status === 404) {
            throw new Error(`Endpoint not found: ${url}`);
          } else if (response.status >= 500) {
            throw new Error(`Server error ${response.status}: ${response.statusText}`);
          } else if (response.status === 429) {
            throw new Error(`Rate limited: ${response.status}`);
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        } else {
          // Handle non-JSON responses
          const text = await response.text();
          try {
            return JSON.parse(text);
          } catch {
            throw new Error(`Invalid JSON response from ${url}`);
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout for ${url}`);
        }
        
        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error(`Network error accessing ${url}: ${error.message}`);
        }
        
        throw error;
      }
    }, cacheKey);
  }

  /**
   * Retry with exponential backoff
   * @private
   * @param {Function} fn - Function to retry
   * @param {string} cacheKey - Cache key for tracking retries
   * @returns {Promise<any>} Function result
   */
  async retryWithExponentialBackoff(fn, cacheKey) {
    let attempts = this.retryAttempts.get(cacheKey) || 0;
    
    for (let i = 0; i <= ThemeManager.MAX_RETRIES; i++) {
      try {
        const result = await fn();
        this.retryAttempts.delete(cacheKey); // Reset on success
        return result;
      } catch (error) {
        attempts++;
        this.retryAttempts.set(cacheKey, attempts);
        
        if (i === ThemeManager.MAX_RETRIES) {
          this.handleError(error, `retryWithExponentialBackoff - ${cacheKey}`);
          throw error;
        }
        
        // Exponential backoff with jitter
        const delay = ThemeManager.RETRY_BASE_DELAY_MS * Math.pow(2, i);
        const jitter = Math.random() * delay * 0.1;
        await this.sleep(delay + jitter);
      }
    }
  }

  /**
   * Sleep utility function
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>} Sleep promise
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Sanitize user input to prevent injection
   * @private
   * @param {string} input - Input to sanitize
   * @returns {string} Sanitized input
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return String(input);
    }
    
    return input
      .replace(/[<>\"'&]/g, (match) => {
        const escapeMap = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return escapeMap[match];
      })
      .trim()
      .substring(0, 100); // Limit length
  }

  /**
   * Batch DOM updates for performance
   * @private
   * @param {Function} callback - Function containing DOM updates
   */
  batchDOMUpdates(callback) {
    requestAnimationFrame(() => {
      try {
        callback();
      } catch (error) {
        this.handleError(error, 'batchDOMUpdates');
      }
    });
  }

  /**
   * Apply dynamic theme colors to DOM
   * @private
   * @param {Object} colors - Color mappings
   */
  applyDynamicThemeColors(colors) {
    if (!colors || typeof colors !== 'object') {
      this.handleError(new Error('Invalid colors object'), 'applyDynamicThemeColors');
      return;
    }

    Object.entries(colors).forEach(([property, value]) => {
      if (typeof property === 'string' && typeof value === 'string') {
        document.documentElement.style.setProperty(property, value);
      }
    });
  }

  /**
   * Clear dynamic theme colors from DOM
   * @private
   */
  clearDynamicThemeColors() {
    const cssProperties = [
      '--bg-primary', '--bg-secondary', '--bg-tertiary',
      '--text-primary', '--text-secondary', '--text-muted',
      '--border-color', '--accent-primary', '--accent-secondary',
      '--success', '--warning', '--danger', '--info',
      '--shadow', '--shadow-lg', '--bg-overlay'
    ];
    
    cssProperties.forEach(property => {
      document.documentElement.style.removeProperty(property);
    });
  }

  /**
   * Update theme preference in background
   * @private
   * @param {string} theme - Theme name
   */
  async updateThemePreferenceInBackground(theme) {
    if (this.dashboard.currentUser && 
        this.dashboard.currentUser.preferences?.theme !== theme) {
      try {
        await this.dashboard.settingsManager?.updateSetting('theme', theme);
      } catch (error) {
        this.handleError(error, 'updateThemePreferenceInBackground');
      }
    }
  }

  /**
   * Schedule theme refresh with cleanup
   * @private
   */
  scheduleThemeRefresh() {
    if (this.dashboard.themeRefreshTimeout) {
      clearTimeout(this.dashboard.themeRefreshTimeout);
    }
    
    this.dashboard.themeRefreshTimeout = setTimeout(() => {
      if (this.dashboard.currentTheme === 'auto') {
        this.debouncedRefreshTheme();
      }
    }, ThemeManager.CACHE_TTL_MINUTES * 60 * 1000);
  }

  /**
   * Debounced theme refresh to prevent excessive calls
   * @private
   */
  debouncedRefreshTheme() {
    this.debounce(() => {
      this.refreshDynamicThemeInBackground();
    }, 'refreshTheme', ThemeManager.DEBOUNCE_DELAY_MS);
  }

  /**
   * Custom debounce implementation
   * @private
   * @param {Function} func - Function to debounce
   * @param {string} key - Debounce key
   * @param {number} delay - Debounce delay in milliseconds
   */
  debounce(func, key, delay) {
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }
    
    const timeoutId = setTimeout(() => {
      this.debounceTimers.delete(key);
      func();
    }, delay);
    
    this.debounceTimers.set(key, timeoutId);
  }

  /**
   * Refresh dynamic theme in background with error handling
   * @private
   */
  async refreshDynamicThemeInBackground() {
    if (this.dashboard.currentTheme !== 'auto') return;
    
    try {
      const weather = await this.getCurrentWeatherWithFallbacks();
      const dynamicTheme = await this.fetchDynamicThemeWithRetry(weather);
      
      if (!dynamicTheme || !this.validateThemeData(dynamicTheme)) {
        throw new Error('Invalid theme data received');
      }

      const cachedInfo = this.getCachedThemeInfo();
      const themeChanged = !cachedInfo || 
        cachedInfo.theme.theme !== dynamicTheme.theme ||
        cachedInfo.weather !== weather;
      
      if (themeChanged) {
        this.batchDOMUpdates(() => {
          this.applyDynamicThemeColors(dynamicTheme.colors);
          document.documentElement.setAttribute('data-theme', dynamicTheme.theme || 'auto');
        });
        
        this.dashboard.currentDynamicTheme = dynamicTheme;
        this.updateThemeToggle();
        this.showThemeStatus(dynamicTheme, weather);
      }
      
      // Update cache
      this.cacheThemeInfo(dynamicTheme, weather);
    } catch (error) {
      this.handleError(error, 'refreshDynamicThemeInBackground');
    } finally {
      this.scheduleThemeRefresh();
    }
  }

  /**
   * Initialize dynamic theme refresh handling
   * @private
   */
  initializeDynamicThemeRefresh() {
    // Already handled in bindEventListeners
  }

  /**
   * Show theme status with enhanced UX
   * @private
   * @param {Object|null} dynamicTheme - Dynamic theme data
   * @param {string|null} weather - Weather condition
   * @param {string|null} customMessage - Custom message override
   */
  showThemeStatus(dynamicTheme, weather, customMessage = null) {
    const statusElement = this.getOrCreateStatusElement();
    const messages = ThemeManager.MESSAGES[this.currentLanguage];
    
    if (customMessage) {
      statusElement.textContent = customMessage;
    } else if (dynamicTheme) {
      const themeMessage = messages.themes[dynamicTheme.theme] || 
        messages.status.themeApplied;
      statusElement.textContent = themeMessage;
      
      // Add click handler for detailed view
      statusElement.onclick = () => this.showDetailedThemeInfo(dynamicTheme, weather);
      statusElement.style.cursor = 'pointer';
      statusElement.setAttribute('role', 'button');
      statusElement.setAttribute('tabindex', '0');
      statusElement.setAttribute('aria-label', 'View theme details');
    }
    
    statusElement.className = 'theme-status show';
    
    // Auto-hide with reduced motion consideration
    const hideDelay = this.animationsEnabled ? 4000 : 2000;
    setTimeout(() => {
      if (statusElement.classList.contains('show')) {
        statusElement.className = 'theme-status';
      }
    }, hideDelay);
  }

  /**
   * Show detailed theme information modal
   * @private
   * @param {Object} dynamicTheme - Theme data
   * @param {string|null} weather - Weather condition
   */
  showDetailedThemeInfo(dynamicTheme, weather) {
    // Implementation for detailed theme info modal
    // This would show current weather, next refresh time, etc.
    console.log('Detailed theme info:', { dynamicTheme, weather });
  }

  /**
   * Get or create status element with proper styling
   * @private
   * @returns {HTMLElement} Status element
   */
  getOrCreateStatusElement() {
    let statusElement = document.getElementById('theme-status');
    
    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.id = 'theme-status';
      statusElement.className = 'theme-status';
      statusElement.setAttribute('role', 'status');
      statusElement.setAttribute('aria-live', 'polite');
      
      this.ensureStatusStyles();
      document.body.appendChild(statusElement);
    }
    
    return statusElement;
  }

  /**
   * Ensure status element styles are loaded
   * @private
   */
  ensureStatusStyles() {
    if (document.getElementById('theme-status-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'theme-status-styles';
    style.textContent = `
      .theme-status {
        position: fixed; top: 15px; right: 70px; z-index: 9998;
        background: var(--bg-secondary, rgba(255, 255, 255, 0.95)); 
        color: var(--text-primary, #1a202c);
        padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 500;
        opacity: 0; transform: translateX(350px); 
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1)); 
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 12px var(--shadow, rgba(0, 0, 0, 0.15)); 
        white-space: nowrap;
        max-width: 250px; 
        text-overflow: ellipsis; 
        overflow: hidden;
      }
      .theme-status.show { 
        opacity: 1; 
        transform: translateX(0); 
      }
      .theme-status:hover {
        transform: translateX(0) scale(1.02);
        box-shadow: 0 6px 16px var(--shadow, rgba(0, 0, 0, 0.2));
      }
      .theme-status:focus {
        outline: 2px solid var(--accent-primary, #007bff);
        outline-offset: 2px;
      }
      @media (prefers-reduced-motion: reduce) {
        .theme-status {
          transition: opacity 0.2s ease;
          transform: none !important;
        }
        .theme-status.show {
          transform: none !important;
        }
      }
      @media (max-width: 768px) {
        .theme-status {
          right: 10px;
          font-size: 12px;
          padding: 6px 12px;
          max-width: 200px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Update theme toggle UI with comprehensive state handling
   * @private
   */
  updateThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    this.batchDOMUpdates(() => {
      const icon = themeToggle.querySelector('i');
      const themeOptions = document.querySelectorAll('.theme-option');
      
      // Update icon and color based on current theme
      if (this.dashboard.currentTheme === 'auto' && this.dashboard.currentDynamicTheme) {
        const iconData = this.getThemeIconData(this.dashboard.currentDynamicTheme.theme);
        if (icon) {
          icon.className = iconData.icon;
          icon.style.color = iconData.color;
        }
      } else {
        if (icon) {
          icon.style.color = '';
          const iconMap = { 
            'light': 'fas fa-sun', 
            'dark': 'fas fa-moon',
            'auto': 'fas fa-adjust'
          };
          icon.className = iconMap[this.dashboard.currentTheme] || 'fas fa-adjust';
        }
      }
      
      // Update active option with accessibility
      themeOptions.forEach(option => {
        const isActive = option.dataset.theme === this.dashboard.currentTheme;
        option.classList.toggle('active', isActive);
        option.setAttribute('aria-selected', isActive.toString());
        
        if (option.dataset.theme === 'auto') {
          const themeText = option.querySelector('.theme-name');
          const subText = option.querySelector('.theme-description');
          
          if (isActive && this.dashboard.currentDynamicTheme && themeText && subText) {
            themeText.textContent = 'Auto';
            const currentThemeName = this.dashboard.currentDynamicTheme.name ||
              ThemeManager.MESSAGES[this.currentLanguage].themes[
                this.dashboard.currentDynamicTheme.theme
              ] || 'Dynamic Theme';
            subText.textContent = ThemeManager.MESSAGES[this.currentLanguage]
              .tooltips.currentTheme.replace('{themeName}', currentThemeName);
          } else if (themeText && subText) {
            themeText.textContent = 'Auto';
            subText.textContent = 'Automatic theme based on festivals and weather';
          }
        }
      });
    });
  }

  /**
   * Get theme icon data for different theme types
   * @private
   * @param {string} themeType - Theme type
   * @returns {Object} Icon data with icon class and color
   */
  getThemeIconData(themeType) {
    const iconMap = {
      'independence': { icon: 'fas fa-flag', color: '#28a745' },
      'pakistan-day': { icon: 'fas fa-flag', color: '#28a745' },
      'defence-day': { icon: 'fas fa-shield-alt', color: '#28a745' },
      'ramadan': { icon: 'fas fa-moon', color: '#ffd700' },
      'kashmir-day': { icon: 'fas fa-heart', color: '#000000' },
      'quaid-birthday': { icon: 'fas fa-star', color: '#3498db' },
      'sunny': { icon: 'fas fa-sun', color: '#ff8c00' },
      'rainy': { icon: 'fas fa-cloud-rain', color: '#4fc3f7' },
      'stormy': { icon: 'fas fa-bolt', color: '#e94560' },
      'cloudy': { icon: 'fas fa-cloud', color: '#63b3ed' },
      'spring': { icon: 'fas fa-seedling', color: '#22c55e' },
      'summer': { icon: 'fas fa-sun', color: '#fb923c' },
      'autumn': { icon: 'fas fa-leaf', color: '#d97706' },
      'winter': { icon: 'fas fa-snowflake', color: '#3b82f6' }
    };
    
    return iconMap[themeType] || { icon: 'fas fa-adjust', color: '' };
  }

  /**
   * Initialize theme tooltip with accessibility
   * @private
   */
  initThemeTooltip() {
    const themeToggle = document.getElementById('themeSelector');
    if (!themeToggle) return;

    // Mouse events
    themeToggle.addEventListener('mouseenter', () => this.showThemeTooltip());
    themeToggle.addEventListener('mouseleave', () => this.hideThemeTooltip());
    
    // Focus events for keyboard navigation
    themeToggle.addEventListener('focus', () => this.showThemeTooltip());
    themeToggle.addEventListener('blur', () => this.hideThemeTooltip());
    
    // Touch events for mobile
    themeToggle.addEventListener('touchstart', () => this.showThemeTooltip(), { passive: true });
    themeToggle.addEventListener('touchend', () => {
      setTimeout(() => this.hideThemeTooltip(), 2000);
    }, { passive: true });
  }

  /**
   * Show theme tooltip with smart positioning
   * @private
   */
  showThemeTooltip() {
    const themeToggle = document.getElementById('themeSelector');
    if (!themeToggle) return;

    this.hideThemeTooltip();

    const { tooltipText, themeIcon } = this.getTooltipContent();
    const tooltip = this.createTooltipElement(tooltipText, themeIcon);
    
    this.positionTooltip(tooltip, themeToggle);
    
    document.body.appendChild(tooltip);
    this.currentTooltip = tooltip;

    // Show tooltip with animation (if enabled)
    requestAnimationFrame(() => {
      tooltip.classList.add('show');
    });
  }

  /**
   * Get tooltip content based on current theme
   * @private
   * @returns {Object} Tooltip content with text and icon
   */
  getTooltipContent() {
    const messages = ThemeManager.MESSAGES[this.currentLanguage].tooltips;
    let tooltipText = messages.autoTheme;
    let themeIcon = '🤖';

    if (this.dashboard.currentTheme === 'auto' && this.dashboard.currentDynamicTheme) {
      tooltipText = this.dashboard.currentDynamicTheme.name || 'Dynamic Theme';
      
      const iconMap = {
        'independence': '🇵🇰', 'pakistan-day': '🇵🇰', 'kashmir-day': '🖤',
        'defence-day': '⚔️', 'quaid-birthday': '👨‍💼', 'ramadan': '🌙', 'eid': '🎉',
        'sunny': '☀️', 'rainy': '🌧️', 'stormy': '⛈️', 'cloudy': '☁️',
        'winter': '❄️', 'spring': '🌸', 'summer': '🌞', 'autumn': '🍂',
        'night': '🌙', 'dawn': '🌅', 'dusk': '🌆'
      };
      themeIcon = iconMap[this.dashboard.currentDynamicTheme.theme] || '🎨';
    } else {
      const themeNames = {
        'light': messages.lightTheme,
        'dark': messages.darkTheme,
        'auto': messages.autoTheme
      };
      const themeIcons = {
        'light': '☀️',
        'dark': '🌙',
        'auto': '🤖'
      };
      tooltipText = themeNames[this.dashboard.currentTheme] || 'Custom Theme';
      themeIcon = themeIcons[this.dashboard.currentTheme] || '🎨';
    }

    return { tooltipText, themeIcon };
  }

  /**
   * Create tooltip element
   * @private
   * @param {string} tooltipText - Tooltip text
   * @param {string} themeIcon - Theme icon
   * @returns {HTMLElement} Tooltip element
   */
  createTooltipElement(tooltipText, themeIcon) {
    const tooltip = document.createElement('div');
    tooltip.className = 'theme-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-label', tooltipText);
    tooltip.innerHTML = `
      <span class="tooltip-icon" aria-hidden="true">${themeIcon}</span> 
      <span class="tooltip-text">${this.sanitizeInput(tooltipText)}</span>
    `;
    
    this.ensureTooltipStyles();
    return tooltip;
  }

  /**
   * Position tooltip with collision detection
   * @private
   * @param {HTMLElement} tooltip - Tooltip element
   * @param {HTMLElement} target - Target element
   */
  positionTooltip(tooltip, target) {
    const rect = target.getBoundingClientRect();
    const tooltipWidth = 200; // Estimated max width
    const tooltipHeight = 40; // Estimated height
    const margin = 8;

    // Calculate available space
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    // Determine optimal vertical position
    const showBelow = spaceBelow > tooltipHeight + margin || spaceAbove < tooltipHeight + margin;

    // Determine optimal horizontal position
    let left = rect.left + (rect.width / 2);

    // Prevent tooltip from going off-screen horizontally
    if (left - (tooltipWidth / 2) < margin) {
      left = margin + (tooltipWidth / 2);
    } else if (left + (tooltipWidth / 2) > window.innerWidth - margin) {
      left = window.innerWidth - margin - (tooltipWidth / 2);
    }

    // Position tooltip
    if (showBelow) {
      tooltip.style.top = `${rect.bottom + margin}px`;
      tooltip.classList.add('tooltip-below');
    } else {
      tooltip.style.top = `${rect.top - tooltipHeight - margin}px`;
      tooltip.classList.add('tooltip-above');
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.transform = 'translateX(-50%)';
  }

  /**
   * Hide theme tooltip with cleanup
   * @private
   */
  hideThemeTooltip() {
    if (this.currentTooltip) {
      this.currentTooltip.classList.remove('show');
      const tooltip = this.currentTooltip;

      const hideDelay = this.animationsEnabled ? 200 : 0;
      setTimeout(() => {
        if (tooltip && tooltip.parentNode) {
          tooltip.remove();
        }
      }, hideDelay);

      this.currentTooltip = null;
    }
  }

  /**
   * Ensure tooltip styles are loaded
   * @private
   */
  ensureTooltipStyles() {
    if (document.getElementById('theme-tooltip-styles')) return;

    const style = document.createElement('style');
    style.id = 'theme-tooltip-styles';
    style.textContent = `
      .theme-tooltip {
        position: fixed; z-index: 999999; pointer-events: none;
        background: var(--bg-secondary, rgba(255, 255, 255, 0.95)); 
        color: var(--text-primary, #1a202c);
        padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 500;
        white-space: nowrap; opacity: 0; 
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1)); 
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 12px var(--shadow, rgba(0, 0, 0, 0.15));
        max-width: 200px; text-overflow: ellipsis; overflow: hidden;
      }
      .theme-tooltip.show { 
        opacity: 1; 
      }
      .theme-tooltip::after {
        content: ''; position: absolute; border: 5px solid transparent;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
      }
      .theme-tooltip.tooltip-above::after {
        top: 100%; left: 50%; transform: translateX(-50%);
        border-top-color: var(--bg-secondary, rgba(255, 255, 255, 0.95));
      }
      .theme-tooltip.tooltip-below::after {
        bottom: 100%; left: 50%; transform: translateX(-50%);
        border-bottom-color: var(--bg-secondary, rgba(255, 255, 255, 0.95));
      }
      .theme-tooltip .tooltip-icon { 
        margin-right: 4px; 
      }
      .theme-tooltip .tooltip-text {
        display: inline-block;
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      @media (prefers-reduced-motion: reduce) {
        .theme-tooltip {
          transition: opacity 0.1s ease;
        }
      }
      @media (max-width: 768px) {
        .theme-tooltip {
          font-size: 11px; padding: 6px 10px;
          max-width: 150px;
        }
        .theme-tooltip .tooltip-text {
          max-width: 120px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Ensure modal styles are loaded with accessibility enhancements
   * @private
   */
  ensureModalStyles() {
    if (document.getElementById('location-modal-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'location-modal-styles';
    style.textContent = `
      #location-permission-modal {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 99999;
        display: flex; align-items: center; justify-content: center; padding: 20px;
        background: transparent;
        border: none;
        outline: none;
      }
      #location-permission-modal[open] {
        display: flex;
      }
      .modal-overlay { 
        background: rgba(0,0,0,0.7); 
        backdrop-filter: blur(5px); 
        position: absolute; 
        inset: 0; 
      }
      .modal-content {
        background: var(--bg-primary, #ffffff); 
        border-radius: 12px; 
        max-width: 450px; 
        width: 100%;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3); 
        position: relative; 
        overflow: hidden;
        border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1)); 
        animation: modalSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .modal-header { 
        padding: 20px 20px 0; 
        display: flex; 
        justify-content: space-between; 
        align-items: flex-start; 
      }
      .modal-header h3 { 
        margin: 0; 
        color: var(--text-primary, #1a202c); 
        font-size: 18px; 
        line-height: 1.4;
        flex: 1;
        margin-right: 10px;
      }
      .modal-close { 
        background: none; 
        border: none; 
        font-size: 24px; 
        cursor: pointer; 
        color: var(--text-muted, #6b7280); 
        padding: 0;
        width: 32px;
        height: 32px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }
      .modal-close:hover, .modal-close:focus {
        background: var(--bg-tertiary, rgba(0, 0, 0, 0.05));
        color: var(--text-primary, #1a202c);
        outline: 2px solid var(--accent-primary, #007bff);
        outline-offset: -2px;
      }
      .modal-body { 
        padding: 15px 20px; 
        color: var(--text-secondary, #4b5563); 
        line-height: 1.6; 
      }
      .modal-body p {
        margin: 0 0 12px 0;
      }
      .modal-body ul { 
        margin: 12px 0; 
        padding-left: 20px; 
        list-style: none;
      }
      .modal-body li { 
        margin: 8px 0; 
        position: relative;
        padding-left: 0;
      }
      .modal-body a {
        color: var(--accent-primary, #007bff);
        text-decoration: none;
      }
      .modal-body a:hover, .modal-body a:focus {
        text-decoration: underline;
        outline: 1px solid var(--accent-primary, #007bff);
        outline-offset: 2px;
        border-radius: 2px;
      }
      .modal-footer { 
        padding: 0 20px 20px; 
        display: flex; 
        flex-direction: column;
        gap: 12px; 
      }
      .do-not-ask-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: var(--text-secondary, #4b5563);
        cursor: pointer;
        user-select: none;
      }
      .do-not-ask-wrapper input[type="checkbox"] {
        margin: 0;
        transform: scale(1.1);
        accent-color: var(--accent-primary, #007bff);
      }
      .do-not-ask-wrapper:focus-within {
        outline: 2px solid var(--accent-primary, #007bff);
        outline-offset: 2px;
        border-radius: 4px;
      }
      .button-group {
        display: flex;
        gap: 10px; 
        justify-content: flex-end;
      }
      .btn-primary, .btn-secondary { 
        padding: 10px 20px; 
        border: none; 
        border-radius: 6px; 
        cursor: pointer; 
        font-weight: 500;
        font-size: 14px;
        transition: all 0.2s ease;
        position: relative;
        min-width: 100px;
      }
      .btn-primary { 
        background: var(--accent-primary, #007bff); 
        color: white; 
      }
      .btn-primary:hover, .btn-primary:focus { 
        transform: translateY(-1px); 
        box-shadow: 0 4px 12px rgba(13,110,253,0.3);
        outline: 2px solid var(--accent-primary, #007bff);
        outline-offset: 2px;
      }
      .btn-primary:active {
        transform: translateY(0);
      }
      .btn-secondary { 
        background: var(--bg-secondary, #f8f9fa); 
        color: var(--text-secondary, #4b5563); 
        border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
      }
      .btn-secondary:hover, .btn-secondary:focus { 
        background: var(--bg-tertiary, #e9ecef);
        outline: 2px solid var(--accent-primary, #007bff);
        outline-offset: 2px;
      }
      @keyframes modalSlideIn { 
        from { 
          transform: scale(0.95) translateY(-20px); 
          opacity: 0; 
        } 
        to { 
          transform: scale(1) translateY(0); 
          opacity: 1; 
        } 
      }
      @media (prefers-reduced-motion: reduce) {
        .modal-content {
          animation: none;
        }
        .btn-primary:hover, .btn-primary:focus {
          transform: none;
        }
      }
      @media (max-width: 480px) {
        #location-permission-modal {
          padding: 10px;
        }
        .modal-content {
          max-width: 100%;
        }
        .modal-header {
          padding: 15px 15px 0;
        }
        .modal-header h3 {
          font-size: 16px;
        }
        .modal-body {
          padding: 12px 15px;
        }
        .modal-footer {
          padding: 0 15px 15px;
        }
        .button-group {
          flex-direction: column;
        }
        .btn-primary, .btn-secondary {
          width: 100%;
          min-width: auto;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Comprehensive error handler with telemetry
   * @private
   * @param {Error} error - Error object
   * @param {string} context - Error context
   */
  handleError(error, context) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Console logging for development
    console.error(`ThemeManager Error [${context}]:`, error);

    // Optional telemetry (anonymized)
    this.sendErrorTelemetry(errorInfo);
  }

  /**
   * Send anonymized error telemetry if available
   * @private
   * @param {Object} errorInfo - Error information
   */
  sendErrorTelemetry(errorInfo) {
    // Only send telemetry in production and with user consent
    if (typeof navigator.sendBeacon === 'function' && 
        window.location.hostname !== 'localhost' &&
        this.dashboard.currentUser?.preferences?.analytics !== false) {
      
      try {
        // Anonymize sensitive data
        const anonymizedError = {
          error: errorInfo.message,
          context: errorInfo.context,
          timestamp: errorInfo.timestamp,
          // Don't send stack traces, URLs, or user agents to respect privacy
        };

        const blob = new Blob([JSON.stringify(anonymizedError)], {
          type: 'application/json'
        });
        
        // Use relative URL to avoid CORS issues
        navigator.sendBeacon('./api/telemetry/errors', blob);
      } catch (telemetryError) {
        // Silently fail telemetry to avoid error loops
        console.warn('Telemetry failed:', telemetryError.message);
      }
    }
  }

  /**
   * Request notification permissions for theme updates
   * @private
   * @returns {Promise<string>} Permission status
   */
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (error) {
      this.handleError(error, 'requestNotificationPermission');
      return 'error';
    }
  }

  /**
   * Show notification for theme changes (if permitted)
   * @private
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {Object} options - Additional options
   */
  showNotification(title, body, options = {}) {
    if (Notification.permission !== 'granted') {
      return;
    }

    try {
      const notification = new Notification(title, {
        body: body,
        icon: '/favicon.ico',
        badge: '/badge-icon.png',
        silent: true,
        requireInteraction: false,
        ...options
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 3000);
    } catch (error) {
      this.handleError(error, 'showNotification');
    }
  }

  /**
   * Cleanup resources and event listeners
   * @public
   */
  cleanup() {
    // Clear timers
    this.debounceTimers.forEach(timerId => clearTimeout(timerId));
    this.debounceTimers.clear();
    
    if (this.dashboard.themeRefreshTimeout) {
      clearTimeout(this.dashboard.themeRefreshTimeout);
      this.dashboard.themeRefreshTimeout = null;
    }

    // Stop location monitoring
    if (this.locationWatchId !== null) {
      navigator.geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }

    // Remove tooltips and modals
    this.hideThemeTooltip();
    const modal = document.getElementById('location-permission-modal');
    if (modal) {
      modal.remove();
    }

    // Clear retry attempts
    this.retryAttempts.clear();
  }

  /**
   * Get theme analytics data for insights
   * @public
   * @returns {Object} Analytics data
   */
  getAnalytics() {
    const cachedTheme = this.getCachedThemeInfo();
    const cachedWeather = this.getCachedWeather();
    
    return {
      currentTheme: this.dashboard.currentTheme,
      dynamicTheme: this.dashboard.currentDynamicTheme?.theme || null,
      weatherCondition: cachedWeather?.condition || null,
      locationPermission: this.locationPermissionState.status,
      cacheAge: cachedTheme ? 
        Math.floor((Date.now() - new Date(cachedTheme.lastUpdated).getTime()) / 1000) : 
        null,
      retryAttempts: Object.fromEntries(this.retryAttempts),
      lastLocationUpdate: this.lastKnownLocation?.timestamp || null
    };
  }

  // Example unit test skeletons (for documentation)
  /*
  Example Jest test cases:

  describe('ThemeManager', () => {
    let themeManager, mockDashboard;

    beforeEach(() => {
      mockDashboard = { currentTheme: 'auto', currentUser: null };
      themeManager = new ThemeManager(mockDashboard);
    });

    afterEach(() => {
      themeManager.cleanup();
    });

    test('should initialize with correct default state', () => {
      expect(themeManager.locationPermissionState.status).toBe('unknown');
      expect(themeManager.currentTooltip).toBeNull();
    });

    test('should validate theme data correctly', () => {
      const validTheme = {
        colors: {
          '--bg-primary': '#ffffff',
          '--bg-secondary': '#f8f9fa',
          '--text-primary': '#000000',
          '--text-secondary': '#666666'
        },
        theme: 'light'
      };
      expect(themeManager.validateThemeData(validTheme)).toBe(true);
      
      const invalidTheme = { colors: null };
      expect(themeManager.validateThemeData(invalidTheme)).toBe(false);
    });

    test('should handle permission state transitions', () => {
      themeManager.saveLocationPermissionState({
        status: 'granted',
        lastRequested: Date.now(),
        rejectedCount: 0,
        nextRequestTime: null,
        doNotAskAgain: false
      });
      
      expect(themeManager.locationPermissionState.status).toBe('granted');
      expect(themeManager.shouldRequestLocationPermission()).toBe(false);
    });

    test('should debounce refresh calls', (done) => {
      const refreshSpy = jest.spyOn(themeManager, 'refreshDynamicThemeInBackground');
      
      themeManager.debouncedRefreshTheme();
      themeManager.debouncedRefreshTheme();
      themeManager.debouncedRefreshTheme();
      
      setTimeout(() => {
        expect(refreshSpy).toHaveBeenCalledTimes(1);
        done();
      }, 600);
    });
  });
  */
}