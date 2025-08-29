/**
 * Streamlined Auth ThemeManager
 * 
 * A lightweight theme management system for authentication pages that leverages
 * the Dashboard ThemeManager's core functionality while maintaining minimal code
 * and auth-specific optimizations.
 * 
 * Features:
 * - Shared cache with Dashboard ThemeManager
 * - Simplified API calls with fallbacks
 * - Auth-specific UI updates
 * - Minimal permission handling
 * - Fast initialization for auth pages
 * 
 * @class AuthThemeManager
 * @version 2.0.0
 */
class AuthThemeManager {
  // Constants (shared with Dashboard ThemeManager)
  static CACHE_TTL_MINUTES = 10;
  static WEATHER_CACHE_TTL_MINUTES = 5;
  static API_ENDPOINTS = {
    WEATHER: 'https://api-auth.transitflow.qzz.io/api/weather',
    THEME: 'https://api-auth.transitflow.qzz.io/api/theme',
    LOCATION: 'https://api-auth.transitflow.qzz.io/api/location'
  };

  // Theme icons for auth pages
  static THEME_ICONS = {
    'independence': 'bx bx-flag',
    'pakistan-day': 'bx bx-flag', 
    'defence-day': 'bx bx-shield',
    'ramadan': 'bx bx-moon',
    'kashmir-day': 'bx bx-heart',
    'quaid-birthday': 'bx bx-star',
    'sunny': 'bx bx-sun',
    'rainy': 'bx bx-cloud-rain',
    'stormy': 'bx bx-cloud-lightning',
    'cloudy': 'bx bx-cloud',
    'spring': 'bx bx-leaf',
    'summer': 'bx bx-sun',
    'autumn': 'bx bx-leaf',
    'winter': 'bx bx-snow',
    'light': 'bx bx-sun',
    'dark': 'bx bx-moon',
    'auto': 'bx bx-palette'
  };

  /**
   * Initialize AuthThemeManager
   * @param {Object} config - Configuration object
   */
  constructor(config = {}) {
    this.config = { themeKey: 'authTheme', ...config };
    this.currentTheme = 'dark';
    this.currentDynamicTheme = null;
    this.isInitialized = false;
  }

  /**
   * Initialize theme system
   * @public
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      await this.loadAndApplyTheme();
      this.initializeSystemThemeWatcher();
      this.isInitialized = true;
      console.log('AuthThemeManager initialized successfully');
    } catch (error) {
      console.error('AuthThemeManager initialization failed:', error);
      this.applyFallbackTheme();
    }
  }

  /**
   * Load and apply theme with smart fallbacks
   * @private
   */
  async loadAndApplyTheme() {
    const savedTheme = localStorage.getItem('theme') || 
                      localStorage.getItem(this.config.themeKey) || 
                      this.getSystemTheme() || 
                      'dark';

    if (savedTheme === 'auto') {
      await this.handleAutoTheme();
    } else {
      this.applyManualTheme(savedTheme);
    }
  }

  /**
   * Handle automatic theme with shared cache
   * @private
   */
  async handleAutoTheme() {
    // Store auto preference
    this.saveThemePreference('auto');

    try {
      // Check shared cache first
      const cachedTheme = this.getCachedThemeInfo();
      if (cachedTheme && this.isCacheValid(cachedTheme)) {
        this.applyDynamicTheme(cachedTheme.theme);
        return;
      }

      // Fetch new theme with fallbacks
      const weather = await this.getCurrentWeatherWithFallbacks();
      const dynamicTheme = await this.fetchDynamicTheme(weather);
      
      if (dynamicTheme && this.validateThemeData(dynamicTheme)) {
        this.applyDynamicTheme(dynamicTheme);
        this.cacheThemeInfo(dynamicTheme, weather);
      } else {
        this.applyFallbackTheme();
      }
    } catch (error) {
      console.warn('Auto theme failed, using fallback:', error);
      this.applyFallbackTheme();
    }
  }

  /**
   * Apply manual theme
   * @private
   * @param {string} theme - Theme name
   */
  applyManualTheme(theme) {
    this.clearDynamicThemeColors();
    document.documentElement.setAttribute('data-theme', theme);
    this.currentTheme = theme;
    this.currentDynamicTheme = null;
    this.saveThemePreference(theme);
    this.updateThemeIcon(theme);
  }

  /**
   * Apply dynamic theme
   * @private
   * @param {Object} dynamicTheme - Theme data
   */
  applyDynamicTheme(dynamicTheme) {
    if (dynamicTheme.colors) {
      this.applyDynamicThemeColors(dynamicTheme.colors);
    }
    
    const baseTheme = dynamicTheme.theme || this.getSystemTheme() || 'dark';
    document.documentElement.setAttribute('data-theme', baseTheme);
    
    this.currentTheme = 'auto';
    this.currentDynamicTheme = dynamicTheme;
    this.updateThemeIcon('auto', dynamicTheme);
  }

  /**
   * Apply fallback theme when all else fails
   * @private
   */
  applyFallbackTheme() {
    const systemTheme = this.getSystemTheme();
    this.applyManualTheme(systemTheme);
  }

  /**
   * Get current weather with comprehensive fallbacks
   * @private
   * @returns {Promise<string|null>} Weather condition
   */
  async getCurrentWeatherWithFallbacks() {
    // Check shared weather cache
    const cachedWeather = this.getCachedWeather();
    if (cachedWeather) return cachedWeather.condition;

    try {
      // Try GPS location if permission granted
      const permissionState = this.getLocationPermissionState();
      if (permissionState.status === 'granted') {
        const position = await this.getCurrentPosition();
        const weather = await this.fetchWeatherByLocation(
          position.coords.latitude, 
          position.coords.longitude
        );
        if (weather) {
          this.cacheWeather(weather);
          return weather;
        }
      }
    } catch (error) {
      console.log('GPS weather failed:', error.message);
    }

    // Fallback to IP-based location
    try {
      const ipLocation = await this.fetchWithTimeout(
        AuthThemeManager.API_ENDPOINTS.LOCATION, 
        3000
      );
      
      if (ipLocation?.latitude && ipLocation?.longitude) {
        const weather = await this.fetchWeatherByLocation(
          ipLocation.latitude, 
          ipLocation.longitude
        );
        if (weather) {
          this.cacheWeather(weather);
          return weather;
        }
      }
    } catch (error) {
      console.log('IP weather failed:', error.message);
    }

    return null;
  }

  /**
   * Fetch weather by location
   * @private
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Promise<string|null>} Weather condition
   */
  async fetchWeatherByLocation(lat, lon) {
    try {
      const response = await this.fetchWithTimeout(
        `${AuthThemeManager.API_ENDPOINTS.WEATHER}?lat=${lat}&lon=${lon}`,
        3000
      );
      return response?.condition || null;
    } catch (error) {
      console.warn('Weather API failed:', error.message);
      return null;
    }
  }

  /**
   * Fetch dynamic theme
   * @private
   * @param {string|null} weather - Weather condition
   * @returns {Promise<Object|null>} Theme data
   */
  async fetchDynamicTheme(weather = null) {
    try {
      const params = new URLSearchParams();
      if (weather) params.append('weather', weather);
      params.append('location', 'lahore'); // Default location
      
      const response = await this.fetchWithTimeout(
        `${AuthThemeManager.API_ENDPOINTS.THEME}?${params.toString()}`,
        5000
      );
      
      return this.validateThemeData(response) ? response : null;
    } catch (error) {
      console.error('Theme API failed:', error);
      return null;
    }
  }

  /**
   * Generic fetch with timeout
   * @private
   * @param {string} url - URL to fetch
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<any>} Response data
   */
  async fetchWithTimeout(url, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Get current position with timeout
   * @private
   * @returns {Promise<GeolocationPosition>} Position
   */
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 3000,
        enableHighAccuracy: false,
        maximumAge: 300000
      });
    });
  }

  /**
   * Apply dynamic theme colors
   * @private
   * @param {Object} colors - Color mappings
   */
  applyDynamicThemeColors(colors) {
    if (!colors) return;
    
    Object.entries(colors).forEach(([property, value]) => {
      if (typeof property === 'string' && typeof value === 'string') {
        document.documentElement.style.setProperty(property, value);
      }
    });
  }

  /**
   * Clear dynamic theme colors
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
    
    cssProperties.forEach(property => 
      document.documentElement.style.removeProperty(property)
    );
  }

  /**
   * Update theme icon for auth pages
   * @private
   * @param {string} theme - Theme name
   * @param {Object|null} dynamicTheme - Dynamic theme data
   */
  updateThemeIcon(theme, dynamicTheme = null) {
    const themeIcon = document.getElementById('theme-icon');
    if (!themeIcon) return;

    let iconClass = AuthThemeManager.THEME_ICONS[theme] || 'bx bx-palette';
    
    if (theme === 'auto' && dynamicTheme) {
      iconClass = AuthThemeManager.THEME_ICONS[dynamicTheme.theme] || 'bx bx-palette';
    }
    
    themeIcon.className = iconClass;
  }

  /**
   * Get system theme preference
   * @private
   * @returns {string} System theme
   */
  getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /**
   * Initialize system theme watcher
   * @private
   */
  initializeSystemThemeWatcher() {
    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e) => {
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme) {
        const newTheme = e.matches ? 'dark' : 'light';
        this.applyManualTheme(newTheme);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else {
      mediaQuery.addListener(handleSystemThemeChange);
    }
  }

  /**
   * Save theme preference
   * @private
   * @param {string} theme - Theme name
   */
  saveThemePreference(theme) {
    try {
      localStorage.setItem('theme', theme);
      localStorage.setItem(this.config.themeKey, theme);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  }

  /**
   * Get cached theme info (shared with Dashboard)
   * @private
   * @returns {Object|null} Cached theme info
   */
  getCachedThemeInfo() {
    try {
      const cached = localStorage.getItem('dynamicThemeInfo');
      const parsed = cached ? JSON.parse(cached) : null;
      return parsed && this.validateThemeData(parsed.theme) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if cache is valid
   * @private
   * @param {Object} cachedInfo - Cached theme info
   * @returns {boolean} Whether cache is valid
   */
  isCacheValid(cachedInfo) {
    if (!cachedInfo?.lastUpdated) return false;
    
    const lastUpdated = new Date(cachedInfo.lastUpdated);
    const cacheExpiry = new Date(Date.now() - AuthThemeManager.CACHE_TTL_MINUTES * 60 * 1000);
    
    return lastUpdated > cacheExpiry;
  }

  /**
   * Cache theme info (shared with Dashboard)
   * @private
   * @param {Object} dynamicTheme - Theme data
   * @param {string|null} weather - Weather condition
   */
  cacheThemeInfo(dynamicTheme, weather) {
    try {
      localStorage.setItem('dynamicThemeInfo', JSON.stringify({
        theme: dynamicTheme,
        weather: weather,
        lastUpdated: new Date().toISOString()
      }));
    } catch (error) {
      console.warn('Failed to cache theme info:', error);
    }
  }

  /**
   * Get cached weather (shared with Dashboard)
   * @private
   * @returns {Object|null} Cached weather data
   */
  getCachedWeather() {
    try {
      const cached = localStorage.getItem('cachedWeather');
      if (!cached) return null;
      
      const weatherData = JSON.parse(cached);
      const cacheExpiry = new Date(
        Date.now() - AuthThemeManager.WEATHER_CACHE_TTL_MINUTES * 60 * 1000
      );
      
      if (new Date(weatherData.timestamp) > cacheExpiry) {
        return weatherData;
      }
      
      localStorage.removeItem('cachedWeather');
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Cache weather data (shared with Dashboard)
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
      console.warn('Failed to cache weather:', error);
    }
  }

  /**
   * Get location permission state (shared with Dashboard)
   * @private
   * @returns {Object} Permission state
   */
  getLocationPermissionState() {
    try {
      const stored = localStorage.getItem('locationPermissionState');
      return stored ? JSON.parse(stored) : {
        status: 'unknown',
        lastRequested: null,
        rejectedCount: 0,
        nextRequestTime: null
      };
    } catch (error) {
      return { status: 'unknown', lastRequested: null, rejectedCount: 0, nextRequestTime: null };
    }
  }

  /**
   * Validate theme data structure
   * @private
   * @param {Object} themeData - Theme data to validate
   * @returns {boolean} Whether theme data is valid
   */
  validateThemeData(themeData) {
    if (!themeData || typeof themeData !== 'object') return false;
    if (!themeData.colors || typeof themeData.colors !== 'object') return false;
    
    const requiredColors = [
      '--bg-primary', '--bg-secondary', '--text-primary', '--text-secondary'
    ];
    
    return requiredColors.every(color => 
      themeData.colors.hasOwnProperty(color) && 
      typeof themeData.colors[color] === 'string'
    );
  }

  // Public API methods for auth pages

  /**
   * Get current theme
   * @public
   * @returns {string} Current theme
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Set theme
   * @public
   * @param {string} theme - Theme name
   */
  async setTheme(theme) {
    if (!['light', 'dark', 'auto'].includes(theme)) {
      console.warn('Invalid theme. Use "light", "dark", or "auto"');
      return;
    }

    if (theme === 'auto') {
      await this.handleAutoTheme();
    } else {
      this.applyManualTheme(theme);
    }
  }

  /**
   * Toggle theme
   * @public
   * @returns {string} New theme
   */
  async toggle() {
    const themes = ['light', 'dark', 'auto'];
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const newTheme = themes[nextIndex];
    
    await this.setTheme(newTheme);
    return newTheme;
  }

  /**
   * Simple light/dark toggle
   * @public
   * @returns {string} New theme
   */
  toggleSimple() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
    return newTheme;
  }

  /**
   * Refresh auto theme
   * @public
   */
  async refreshAutoTheme() {
    if (this.currentTheme === 'auto') {
      await this.handleAutoTheme();
    }
  }

  /**
   * Get theme analytics
   * @public
   * @returns {Object} Analytics data
   */
  getAnalytics() {
    const cachedTheme = this.getCachedThemeInfo();
    const cachedWeather = this.getCachedWeather();
    
    return {
      currentTheme: this.currentTheme,
      dynamicTheme: this.currentDynamicTheme?.theme || null,
      weatherCondition: cachedWeather?.condition || null,
      cacheAge: cachedTheme ? 
        Math.floor((Date.now() - new Date(cachedTheme.lastUpdated).getTime()) / 1000) : 
        null,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Cleanup resources
   * @public
   */
  cleanup() {
    this.isInitialized = false;
  }
}

// Export for use in auth pages
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthThemeManager;
}

// Make AuthThemeManager available globally for browser environments
if (typeof window !== 'undefined') {
  window.AuthThemeManager = AuthThemeManager;
}