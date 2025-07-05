class M3U8Downloader {
    constructor() {
        this.form = document.getElementById('downloadForm');
        this.urlInput = document.getElementById('urlInput');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.progressSection = document.getElementById('progressSection');
        this.errorSection = document.getElementById('errorSection');
        this.successSection = document.getElementById('successSection');
        this.progressBar = document.querySelector('.progress-bar');
        this.progressPercent = document.querySelector('.progress-percent');
        this.progressStatus = document.getElementById('progressStatus');
        this.errorMessage = document.getElementById('errorMessage');
        
        // Batch elements
        this.batchForm = document.getElementById('batchDownloadForm');
        this.batchUrlInput = document.getElementById('batchUrlInput');
        this.batchDownloadBtn = document.getElementById('batchDownloadBtn');
        this.batchProgressSection = document.getElementById('batchProgressSection');
        this.batchErrorSection = document.getElementById('batchErrorSection');
        this.batchErrorMessage = document.getElementById('batchErrorMessage');
        this.batchItemsList = document.getElementById('batchItemsList');
        this.batchCompleteSection = document.getElementById('batchCompleteSection');
        this.downloadBatchZipBtn = document.getElementById('downloadBatchZip');
        
        // Extraction elements
        this.extractionResults = document.getElementById('extractionResults');
        this.webpageTitle = document.getElementById('webpageTitle');
        this.foundCount = document.getElementById('foundCount');
        this.videoLinksContainer = document.getElementById('videoLinksContainer');
        this.downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
        this.downloadAllBtn = document.getElementById('downloadAllBtn');
        this.modeDescription = document.getElementById('modeDescription');
        
        this.currentBatchId = null;
        this.batchStatusInterval = null;
        this.selectedVideoLinks = [];
        this.extractedLinks = [];
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        // Single download listeners
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.urlInput.addEventListener('input', () => this.validateInput());
        this.urlInput.addEventListener('paste', () => {
            setTimeout(() => this.validateInput(), 100);
        });
        
        // Batch download listeners
        this.batchForm.addEventListener('submit', (e) => this.handleBatchSubmit(e));
        this.batchUrlInput.addEventListener('input', () => this.validateBatchInput());
        this.downloadBatchZipBtn.addEventListener('click', () => this.downloadBatchZip());
        
        // Mode toggle listeners
        document.querySelectorAll('input[name="downloadMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.switchMode(e.target.id));
        });
        
        // Input mode listeners
        document.querySelectorAll('input[name="inputMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.updateInputMode(e.target.value));
        });
        
        // Extraction action listeners
        this.downloadSelectedBtn.addEventListener('click', () => this.downloadSelectedVideos());
        this.downloadAllBtn.addEventListener('click', () => this.downloadAllVideos());
    }
    
    validateInput() {
        const url = this.urlInput.value.trim();
        const isValid = this.isValidM3U8Url(url);
        
        if (url && !isValid) {
            this.urlInput.classList.add('is-invalid');
        } else {
            this.urlInput.classList.remove('is-invalid');
        }
        
        return isValid;
    }
    
    isValidM3U8Url(url) {
        try {
            const urlObj = new URL(url);
            return (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && 
                   url.toLowerCase().endsWith('.m3u8');
        } catch {
            return false;
        }
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        const url = this.urlInput.value.trim();
        const inputMode = document.querySelector('input[name="inputMode"]:checked').value;
        
        if (!url) {
            this.showError('Please enter a URL');
            return;
        }
        
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            this.showError('URL must start with http:// or https://');
            return;
        }
        
        // Handle different input modes
        if (inputMode === 'extract') {
            await this.extractVideoLinks(url);
        } else if (inputMode === 'direct') {
            if (!this.isValidM3U8Url(url)) {
                this.showError('Please enter a valid M3U8 URL (must end with .m3u8)');
                return;
            }
            await this.downloadVideo(url, 'direct');
        } else if (inputMode === 'auto') {
            await this.downloadVideo(url, 'auto');
        }
    }
    
    async downloadVideo(url, mode = 'direct') {
        try {
            this.hideAllSections();
            this.hideExtractionResults();
            this.setLoadingState(true);
            this.showProgress(0, 'Initializing download...');
            
            const response = await fetch('/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url, mode: mode })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Simulate progress updates during download
            this.simulateProgress();
            
            // Handle file download
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = this.generateFilename();
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            
            this.showSuccess();
            
        } catch (error) {
            console.error('Download error:', error);
            this.showError(error.message || 'Download failed. Please check the URL and try again.');
        } finally {
            this.setLoadingState(false);
        }
    }
    
    async extractVideoLinks(url) {
        try {
            this.hideAllSections();
            this.setLoadingState(true);
            this.showProgress(50, 'Extracting video links from webpage...');
            
            const response = await fetch('/extract', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            this.displayExtractionResults(result);
            
        } catch (error) {
            console.error('Extraction error:', error);
            this.showError(error.message || 'Failed to extract video links. Please check the URL and try again.');
        } finally {
            this.setLoadingState(false);
        }
    }
    
    displayExtractionResults(data) {
        this.hideAllSections();
        
        // Update webpage info
        this.webpageTitle.textContent = data.webpage_info.title || 'Unknown Page';
        this.foundCount.textContent = data.found_count;
        
        // Clear and populate video links
        this.videoLinksContainer.innerHTML = '';
        this.extractedLinks = data.video_links;
        this.selectedVideoLinks = [];
        
        if (data.video_links.length === 0) {
            this.videoLinksContainer.innerHTML = `
                <div class="no-videos-found">
                    <i class="fas fa-exclamation-circle"></i>
                    <div>No video streams found on this webpage.</div>
                    <div class="mt-2">
                        <small>Try checking the source or using a direct M3U8 link.</small>
                    </div>
                </div>
            `;
        } else {
            data.video_links.forEach((link, index) => {
                const linkElement = this.createVideoLinkElement(link, index);
                this.videoLinksContainer.appendChild(linkElement);
            });
            
            // Show action buttons
            this.downloadSelectedBtn.style.display = 'inline-block';
            this.downloadAllBtn.style.display = 'inline-block';
        }
        
        this.extractionResults.style.display = 'block';
    }
    
    createVideoLinkElement(link, index) {
        const element = document.createElement('div');
        element.className = 'video-link-item';
        element.dataset.index = index;
        element.dataset.url = link;
        
        element.innerHTML = `
            <div class="video-link-header">
                <div class="video-link-url">${link}</div>
                <span class="video-link-status">Valid</span>
            </div>
            <div class="video-link-actions">
                <button class="btn btn-sm btn-outline-primary btn-link-action download-single" data-url="${link}">
                    <i class="fas fa-download me-1"></i>Download
                </button>
                <button class="btn btn-sm btn-outline-secondary btn-link-action copy-link" data-url="${link}">
                    <i class="fas fa-copy me-1"></i>Copy
                </button>
            </div>
        `;
        
        // Add click handler for selection
        element.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-link-action')) {
                this.toggleVideoLinkSelection(element);
            }
        });
        
        // Add individual action handlers
        const downloadBtn = element.querySelector('.download-single');
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.downloadVideo(link, 'direct');
        });
        
        const copyBtn = element.querySelector('.copy-link');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyToClipboard(link);
        });
        
        return element;
    }
    
    toggleVideoLinkSelection(element) {
        const index = parseInt(element.dataset.index);
        const url = element.dataset.url;
        
        if (element.classList.contains('selected')) {
            element.classList.remove('selected');
            this.selectedVideoLinks = this.selectedVideoLinks.filter(item => item.index !== index);
        } else {
            element.classList.add('selected');
            this.selectedVideoLinks.push({ index, url });
        }
        
        // Update button visibility
        this.downloadSelectedBtn.style.display = this.selectedVideoLinks.length > 0 ? 'inline-block' : 'none';
    }
    
    async downloadSelectedVideos() {
        if (this.selectedVideoLinks.length === 0) {
            this.showError('Please select at least one video to download');
            return;
        }
        
        if (this.selectedVideoLinks.length === 1) {
            await this.downloadVideo(this.selectedVideoLinks[0].url, 'direct');
        } else {
            // Use batch download for multiple selections
            const urls = this.selectedVideoLinks.map(item => item.url);
            await this.startBatchDownload(urls);
        }
    }
    
    async downloadAllVideos() {
        if (this.extractedLinks.length === 0) {
            this.showError('No video links available to download');
            return;
        }
        
        if (this.extractedLinks.length === 1) {
            await this.downloadVideo(this.extractedLinks[0], 'direct');
        } else {
            await this.startBatchDownload(this.extractedLinks);
        }
    }
    
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            // Show brief success feedback
            const originalText = event.target.innerHTML;
            event.target.innerHTML = '<i class="fas fa-check me-1"></i>Copied';
            event.target.classList.add('btn-success');
            event.target.classList.remove('btn-outline-secondary');
            
            setTimeout(() => {
                event.target.innerHTML = originalText;
                event.target.classList.remove('btn-success');
                event.target.classList.add('btn-outline-secondary');
            }, 1500);
        }).catch(() => {
            this.showError('Failed to copy to clipboard');
        });
    }
    
    updateInputMode(mode) {
        const descriptions = {
            'direct': 'Enter a direct M3U8 playlist URL',
            'extract': 'Enter any webpage URL to extract video streams (extraction only)',
            'auto': 'Enter any URL - will auto-detect and download if M3U8 streams are found'
        };
        
        this.modeDescription.textContent = descriptions[mode];
        
        // Update placeholder
        const placeholders = {
            'direct': 'https://example.com/playlist.m3u8',
            'extract': 'https://example.com/video-page',
            'auto': 'https://example.com/video-page or direct M3U8 link'
        };
        
        this.urlInput.placeholder = placeholders[mode];
        
        // Update button text
        const buttonTexts = {
            'direct': 'Download Video',
            'extract': 'Extract Video Links',
            'auto': 'Auto-detect & Download'
        };
        
        this.downloadBtn.querySelector('.btn-text').textContent = buttonTexts[mode];
        
        // Hide extraction results when switching modes
        this.hideExtractionResults();
    }
    
    hideExtractionResults() {
        this.extractionResults.style.display = 'none';
        this.selectedVideoLinks = [];
        this.extractedLinks = [];
    }
    
    simulateProgress() {
        const steps = [
            { percent: 10, status: 'Fetching M3U8 playlist...' },
            { percent: 25, status: 'Parsing video segments...' },
            { percent: 40, status: 'Downloading video segments...' },
            { percent: 70, status: 'Merging segments with ffmpeg...' },
            { percent: 90, status: 'Finalizing video file...' },
            { percent: 100, status: 'Download complete!' }
        ];
        
        let currentStep = 0;
        const interval = setInterval(() => {
            if (currentStep < steps.length) {
                const step = steps[currentStep];
                this.updateProgress(step.percent, step.status);
                currentStep++;
            } else {
                clearInterval(interval);
            }
        }, 800);
    }
    
    generateFilename() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `video_${timestamp}.mp4`;
    }
    
    setLoadingState(loading) {
        this.downloadBtn.disabled = loading;
        const btnText = this.downloadBtn.querySelector('.btn-text');
        const icon = this.downloadBtn.querySelector('i');
        
        if (loading) {
            this.downloadBtn.classList.add('loading');
            icon.className = 'loading-spinner me-2';
            btnText.textContent = 'Processing...';
        } else {
            this.downloadBtn.classList.remove('loading');
            icon.className = 'fas fa-download me-2';
            btnText.textContent = 'Download Video';
        }
    }
    
    showProgress(percent, status) {
        this.hideAllSections();
        this.progressSection.style.display = 'block';
        this.updateProgress(percent, status);
    }
    
    updateProgress(percent, status) {
        this.progressBar.style.width = `${percent}%`;
        this.progressPercent.textContent = `${percent}%`;
        this.progressStatus.textContent = status;
    }
    
    showError(message) {
        this.hideAllSections();
        this.errorSection.style.display = 'block';
        this.errorMessage.textContent = message;
        
        // Auto-hide error after 10 seconds
        setTimeout(() => {
            this.errorSection.style.display = 'none';
        }, 10000);
    }
    
    showSuccess() {
        this.hideAllSections();
        this.successSection.style.display = 'block';
        
        // Auto-hide success message and reset form after 5 seconds
        setTimeout(() => {
            this.successSection.style.display = 'none';
            this.resetForm();
        }, 5000);
    }
    
    hideAllSections() {
        this.progressSection.style.display = 'none';
        this.errorSection.style.display = 'none';
        this.successSection.style.display = 'none';
    }
    
    resetForm() {
        this.urlInput.value = '';
        this.urlInput.classList.remove('is-invalid');
        this.hideAllSections();
    }
    
    // Batch processing methods
    switchMode(mode) {
        const singleCard = document.getElementById('singleDownloadCard');
        const batchCard = document.getElementById('batchDownloadCard');
        
        if (mode === 'singleMode') {
            singleCard.style.display = 'block';
            batchCard.style.display = 'none';
            this.stopBatchStatusTracking();
        } else {
            singleCard.style.display = 'none';
            batchCard.style.display = 'block';
        }
    }
    
    validateBatchInput() {
        const urls = this.getBatchUrls();
        const isValid = urls.length > 0 && urls.length <= 10 && urls.every(url => this.isValidM3U8Url(url));
        
        if (urls.length > 10) {
            this.batchUrlInput.classList.add('is-invalid');
        } else {
            this.batchUrlInput.classList.remove('is-invalid');
        }
        
        return isValid;
    }
    
    getBatchUrls() {
        return this.batchUrlInput.value
            .split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);
    }
    
    async handleBatchSubmit(e) {
        e.preventDefault();
        
        const urls = this.getBatchUrls();
        
        if (urls.length === 0) {
            this.showBatchError('Please enter at least one M3U8 URL');
            return;
        }
        
        if (urls.length > 10) {
            this.showBatchError('Maximum 10 URLs allowed per batch');
            return;
        }
        
        // Validate all URLs
        for (const url of urls) {
            if (!this.isValidM3U8Url(url)) {
                this.showBatchError(`Invalid M3U8 URL: ${url}`);
                return;
            }
        }
        
        await this.startBatchDownload(urls);
    }
    
    async startBatchDownload(urls) {
        try {
            this.hideBatchSections();
            this.setBatchLoadingState(true);
            
            const response = await fetch('/batch-download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ urls: urls })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            this.currentBatchId = result.batch_id;
            
            // Initialize batch progress UI
            this.initializeBatchProgress(urls);
            this.startBatchStatusTracking();
            
        } catch (error) {
            console.error('Batch download error:', error);
            this.showBatchError(error.message || 'Batch download failed. Please try again.');
            this.setBatchLoadingState(false);
        }
    }
    
    initializeBatchProgress(urls) {
        this.batchProgressSection.style.display = 'block';
        
        // Update summary
        document.getElementById('batchTotal').textContent = urls.length;
        document.getElementById('batchCompleted').textContent = '0';
        
        // Clear and populate batch items list
        this.batchItemsList.innerHTML = '';
        
        urls.forEach((url, index) => {
            const item = this.createBatchItem(url, index);
            this.batchItemsList.appendChild(item);
        });
    }
    
    createBatchItem(url, index) {
        const item = document.createElement('div');
        item.className = 'batch-item';
        item.id = `batch-item-${index}`;
        
        item.innerHTML = `
            <div class="batch-item-header">
                <div class="batch-item-url">${url}</div>
                <span class="batch-item-status status-pending">Pending</span>
            </div>
            <div class="batch-item-progress">
                <div class="progress">
                    <div class="progress-bar" style="width: 0%"></div>
                </div>
                <div class="batch-item-message">Waiting to start...</div>
            </div>
        `;
        
        return item;
    }
    
    startBatchStatusTracking() {
        if (this.batchStatusInterval) {
            clearInterval(this.batchStatusInterval);
        }
        
        this.batchStatusInterval = setInterval(async () => {
            await this.updateBatchStatus();
        }, 1000);
    }
    
    stopBatchStatusTracking() {
        if (this.batchStatusInterval) {
            clearInterval(this.batchStatusInterval);
            this.batchStatusInterval = null;
        }
    }
    
    async updateBatchStatus() {
        if (!this.currentBatchId) return;
        
        try {
            const response = await fetch(`/batch-status/${this.currentBatchId}`);
            
            if (!response.ok) {
                throw new Error('Failed to get batch status');
            }
            
            const batchData = await response.json();
            this.updateBatchUI(batchData);
            
            // Stop tracking if batch is complete
            if (['completed', 'completed_with_errors', 'failed'].includes(batchData.status)) {
                this.stopBatchStatusTracking();
                this.setBatchLoadingState(false);
                
                if (batchData.completed_count > 0) {
                    this.showBatchComplete();
                }
            }
            
        } catch (error) {
            console.error('Failed to update batch status:', error);
        }
    }
    
    updateBatchUI(batchData) {
        // Update overall progress
        const overallProgress = Math.round((batchData.completed_count + batchData.failed_count) / batchData.total_count * 100);
        document.getElementById('batchOverallProgress').style.width = `${overallProgress}%`;
        
        // Update summary
        document.getElementById('batchCompleted').textContent = batchData.completed_count;
        
        // Update individual items
        Object.entries(batchData.downloads).forEach(([downloadId, downloadData], index) => {
            const item = document.getElementById(`batch-item-${index}`);
            if (item) {
                this.updateBatchItem(item, downloadData);
            }
        });
    }
    
    updateBatchItem(item, downloadData) {
        const statusEl = item.querySelector('.batch-item-status');
        const progressBar = item.querySelector('.progress-bar');
        const messageEl = item.querySelector('.batch-item-message');
        
        // Update status
        statusEl.className = `batch-item-status status-${downloadData.status}`;
        statusEl.textContent = downloadData.status.toUpperCase();
        
        // Update progress
        progressBar.style.width = `${downloadData.progress}%`;
        
        // Update message
        messageEl.textContent = downloadData.message || '';
    }
    
    showBatchComplete() {
        this.batchCompleteSection.style.display = 'block';
    }
    
    async downloadBatchZip() {
        if (!this.currentBatchId) return;
        
        try {
            const response = await fetch(`/batch-download/${this.currentBatchId}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error);
            }
            
            // Create download link
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `m3u8_batch_${this.currentBatchId.substring(0, 8)}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error('Batch ZIP download error:', error);
            this.showBatchError(error.message || 'Failed to download batch ZIP file');
        }
    }
    
    setBatchLoadingState(loading) {
        this.batchDownloadBtn.disabled = loading;
        const btnText = this.batchDownloadBtn.querySelector('.btn-text');
        const icon = this.batchDownloadBtn.querySelector('i');
        
        if (loading) {
            this.batchDownloadBtn.classList.add('loading');
            icon.className = 'loading-spinner me-2';
            btnText.textContent = 'Processing...';
        } else {
            this.batchDownloadBtn.classList.remove('loading');
            icon.className = 'fas fa-layer-group me-2';
            btnText.textContent = 'Start Batch Download';
        }
    }
    
    showBatchError(message) {
        this.hideBatchSections();
        this.batchErrorSection.style.display = 'block';
        this.batchErrorMessage.textContent = message;
        
        setTimeout(() => {
            this.batchErrorSection.style.display = 'none';
        }, 10000);
    }
    
    hideBatchSections() {
        this.batchProgressSection.style.display = 'none';
        this.batchErrorSection.style.display = 'none';
        this.batchCompleteSection.style.display = 'none';
    }
    
    resetBatchForm() {
        this.batchUrlInput.value = '';
        this.batchUrlInput.classList.remove('is-invalid');
        this.hideBatchSections();
        this.stopBatchStatusTracking();
        this.currentBatchId = null;
    }
}

// Initialize the downloader when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new M3U8Downloader();
});

// Add some utility functions for better UX
document.addEventListener('DOMContentLoaded', () => {
    // Auto-focus on input field
    const urlInput = document.getElementById('urlInput');
    if (urlInput) {
        urlInput.focus();
    }
    
    // Handle paste events for better UX
    urlInput.addEventListener('paste', (e) => {
        setTimeout(() => {
            const pastedText = urlInput.value.trim();
            if (pastedText) {
                // Remove any surrounding quotes or whitespace
                const cleanUrl = pastedText.replace(/^["']|["']$/g, '').trim();
                urlInput.value = cleanUrl;
                
                // Trigger validation
                urlInput.dispatchEvent(new Event('input'));
            }
        }, 10);
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+Enter or Cmd+Enter to submit
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const form = document.getElementById('downloadForm');
            if (form) {
                form.dispatchEvent(new Event('submit'));
            }
        }
        
        // Escape to clear form
        if (e.key === 'Escape') {
            const urlInput = document.getElementById('urlInput');
            if (urlInput && urlInput === document.activeElement) {
                urlInput.value = '';
                urlInput.dispatchEvent(new Event('input'));
            }
        }
    });
});
