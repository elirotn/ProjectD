class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.init();
    }

    init() {
        this.registerServiceWorker();
        this.setupInstallPrompt();
        this.checkInstallStatus();
        this.setupPWAEventListeners();
    }

    // Register service worker
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('PWA: Service Worker registered successfully', registration);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    console.log('PWA: Service Worker update found');
                    const newWorker = registration.installing;
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateAvailable();
                        }
                    });
                });
                
            } catch (error) {
                console.error('PWA: Service Worker registration failed', error);
            }
        } else {
            console.log('PWA: Service Worker not supported');
        }
    }

    // Setup install prompt handling
    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('PWA: Install prompt available');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        window.addEventListener('appinstalled', () => {
            console.log('PWA: App installed successfully');
            this.isInstalled = true;
            this.hideInstallButton();
            this.showInstalledMessage();
        });
    }

    // Check if app is already installed
    checkInstallStatus() {
        // Check if running in standalone mode (installed PWA)
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            this.isInstalled = true;
            console.log('PWA: App is running in standalone mode');
            return;
        }

        // iOS Safari detection
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isStandalone = window.navigator.standalone;
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
        
        // Show iOS instructions immediately for iOS Safari users
        if (isIOS && isSafari && !isStandalone) {
            console.log('PWA: iOS Safari detected, showing install instructions');
            setTimeout(() => {
                this.showIOSInstallInstructions();
            }, 2000); // Show after 2 seconds to let page load
        }
        
        // For other browsers, show install button if available
        if (!isIOS && !this.deferredPrompt) {
            // Check if we should show a generic install message
            setTimeout(() => {
                this.showGenericInstallInstructions();
            }, 3000);
        }
    }

    // Setup PWA-specific event listeners
    setupPWAEventListeners() {
        // Handle offline/online status
        window.addEventListener('online', () => {
            console.log('PWA: Back online');
            this.hideOfflineMessage();
        });

        window.addEventListener('offline', () => {
            console.log('PWA: Gone offline');
            this.showOfflineMessage();
        });

        // Handle visibility changes (app switching)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('PWA: App became visible');
                // Sync data or refresh content if needed
            }
        });
    }

    // Show install button
    showInstallButton() {
        const installButton = this.createInstallButton();
        const header = document.querySelector('.header-section');
        if (header && !document.getElementById('pwa-install-btn')) {
            header.appendChild(installButton);
        }
    }

    // Create install button
    createInstallButton() {
        const button = document.createElement('button');
        button.id = 'pwa-install-btn';
        button.className = 'btn btn-outline-primary btn-sm mt-2';
        button.innerHTML = '<i class="fas fa-download me-1"></i>Install App';
        
        button.addEventListener('click', () => {
            this.promptInstall();
        });
        
        return button;
    }

    // Prompt user to install the app
    async promptInstall() {
        if (!this.deferredPrompt) {
            console.log('PWA: No install prompt available');
            return;
        }

        try {
            this.deferredPrompt.prompt();
            const result = await this.deferredPrompt.userChoice;
            
            if (result.outcome === 'accepted') {
                console.log('PWA: User accepted install prompt');
            } else {
                console.log('PWA: User dismissed install prompt');
            }
            
            this.deferredPrompt = null;
            this.hideInstallButton();
            
        } catch (error) {
            console.error('PWA: Install prompt failed', error);
        }
    }

    // Hide install button
    hideInstallButton() {
        const button = document.getElementById('pwa-install-btn');
        if (button) {
            button.remove();
        }
    }

    // Show iOS install instructions
    showIOSInstallInstructions() {
        if (document.getElementById('ios-install-banner')) return;
        
        const banner = document.createElement('div');
        banner.id = 'ios-install-banner';
        banner.className = 'alert alert-primary alert-dismissible fade show mt-3';
        banner.style.border = '2px solid var(--primary-blue)';
        banner.innerHTML = `
            <div class="d-flex align-items-start">
                <div class="me-3" style="font-size: 1.5rem; color: var(--primary-blue);">
                    <i class="fas fa-mobile-alt"></i>
                </div>
                <div class="flex-grow-1">
                    <h6 class="alert-heading mb-2">
                        <i class="fas fa-download me-1"></i>
                        Install M3U8 Downloader App
                    </h6>
                    <p class="mb-2">Get the app on your iPhone for easy access:</p>
                    <ol class="mb-2" style="font-size: 0.9rem; padding-left: 1.2rem;">
                        <li>Tap the <strong>Share</strong> button <i class="fas fa-share" style="color: #007AFF;"></i> in Safari</li>
                        <li>Scroll down and tap <strong>"Add to Home Screen"</strong> <i class="fas fa-plus-square" style="color: #007AFF;"></i></li>
                        <li>Tap <strong>"Add"</strong> to install the app</li>
                    </ol>
                    <small class="text-muted">
                        <i class="fas fa-info-circle me-1"></i>
                        The app will work offline and feel like a native iPhone app!
                    </small>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        const headerSection = document.querySelector('.header-section');
        if (headerSection) {
            headerSection.appendChild(banner);
        }
    }

    // Show generic install instructions for other browsers
    showGenericInstallInstructions() {
        if (document.getElementById('generic-install-banner') || this.deferredPrompt) return;
        
        const banner = document.createElement('div');
        banner.id = 'generic-install-banner';
        banner.className = 'alert alert-info alert-dismissible fade show mt-3';
        banner.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-info-circle me-2"></i>
                <div class="flex-grow-1">
                    <strong>Install this app:</strong><br>
                    <small>Look for an "Install" or "Add to Home Screen" option in your browser menu</small>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        const headerSection = document.querySelector('.header-section');
        if (headerSection) {
            headerSection.appendChild(banner);
        }
    }

    // Show installed message
    showInstalledMessage() {
        const toast = this.createToast('App installed successfully!', 'success');
        this.showToast(toast);
    }

    // Show update available message
    showUpdateAvailable() {
        const toast = this.createToast('App update available. Refresh to update.', 'info');
        this.showToast(toast);
    }

    // Show offline message
    showOfflineMessage() {
        if (document.getElementById('offline-banner')) return;
        
        const banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.className = 'alert alert-warning position-fixed top-0 start-50 translate-middle-x mt-3';
        banner.style.zIndex = '9999';
        banner.innerHTML = `
            <i class="fas fa-wifi me-2"></i>
            You're offline. Some features may not work.
        `;
        
        document.body.appendChild(banner);
    }

    // Hide offline message
    hideOfflineMessage() {
        const banner = document.getElementById('offline-banner');
        if (banner) {
            banner.remove();
        }
    }

    // Create toast notification
    createToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-info-circle me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        return toast;
    }

    // Show toast notification
    showToast(toast) {
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        toastContainer.appendChild(toast);
        
        // Initialize Bootstrap toast if available
        if (window.bootstrap && bootstrap.Toast) {
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        } else {
            // Fallback: show for 3 seconds
            toast.classList.add('show');
            setTimeout(() => {
                toast.remove();
            }, 3000);
        }
    }

    // Get installation status
    getInstallStatus() {
        return {
            isInstalled: this.isInstalled,
            canInstall: !!this.deferredPrompt,
            isOnline: navigator.onLine
        };
    }
}

// Initialize PWA manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.pwaManager = new PWAManager();
    console.log('PWA: Manager initialized');
});

// Add PWA-specific styles
const pwaStyles = `
    #pwa-install-btn {
        animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
    
    .toast-container {
        z-index: 9999 !important;
    }
    
    /* PWA status bar styles for iOS */
    @media (display-mode: standalone) {
        body {
            padding-top: env(safe-area-inset-top);
            padding-bottom: env(safe-area-inset-bottom);
        }
    }
`;

// Inject PWA styles
const styleSheet = document.createElement('style');
styleSheet.textContent = pwaStyles;
document.head.appendChild(styleSheet);