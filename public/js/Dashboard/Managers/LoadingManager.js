// File: managers/LoadingManager.js
class LoadingManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }

    showPictureLoading(show) {
        const overlay = document.getElementById('loaderpic');
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }
}