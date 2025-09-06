// File: managers/LoadingManager.js
class LoadingManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    showLoading(show) {
        const body = document.body;
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('show');
            body.classList.add('loading');
        } else {
            overlay.classList.remove('show');
            body.classList.remove('loading');
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