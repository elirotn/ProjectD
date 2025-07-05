import os
import logging
import tempfile
import shutil
import uuid
import zipfile
from flask import Flask, render_template, request, jsonify, send_file, flash, redirect, url_for
from werkzeug.middleware.proxy_fix import ProxyFix
from utils.downloader import M3U8Downloader, BatchDownloader, VideoStreamExtractor

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Initialize downloaders and extractor
downloader = M3U8Downloader()
batch_downloader = BatchDownloader()
stream_extractor = VideoStreamExtractor()

@app.route('/')
def index():
    """Main page with the download interface"""
    return render_template('index.html')

@app.route('/extract', methods=['POST'])
def extract_video_links():
    """Extract M3U8 links from a webpage"""
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        
        if not url:
            return jsonify({'error': 'Please provide a valid URL'}), 400
        
        # Validate URL format
        if not url.startswith(('http://', 'https://')):
            return jsonify({'error': 'URL must start with http:// or https://'}), 400
        
        logging.info(f"Extracting video links from: {url}")
        
        # Get webpage info
        webpage_info = stream_extractor.get_webpage_info(url)
        
        # Extract M3U8 links
        m3u8_links = stream_extractor.extract_m3u8_from_webpage(url)
        
        return jsonify({
            'webpage_info': webpage_info,
            'video_links': m3u8_links,
            'found_count': len(m3u8_links)
        })
        
    except Exception as e:
        logging.error(f"Extraction error: {str(e)}")
        return jsonify({'error': f'Extraction failed: {str(e)}'}), 500

@app.route('/download', methods=['POST'])
def download_video():
    """Handle M3U8 download request"""
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        mode = data.get('mode', 'direct').strip()  # 'direct', 'extract', 'auto'
        
        if not url:
            return jsonify({'error': 'Please provide a valid URL'}), 400
        
        # Validate URL format
        if not url.startswith(('http://', 'https://')):
            return jsonify({'error': 'URL must start with http:// or https://'}), 400
        
        m3u8_url = url
        
        # If not a direct M3U8 link, try to extract
        if not url.endswith('.m3u8'):
            if mode == 'direct':
                return jsonify({'error': 'URL must be a valid M3U8 playlist file'}), 400
            
            logging.info(f"Extracting M3U8 from webpage: {url}")
            try:
                m3u8_links = stream_extractor.extract_m3u8_from_webpage(url)
                
                if not m3u8_links:
                    return jsonify({
                        'error': 'No video streams found on this webpage. Please check the URL or try a direct M3U8 link.'
                    }), 404
                
                # Use the first valid M3U8 link found
                m3u8_url = m3u8_links[0]
                logging.info(f"Using extracted M3U8 URL: {m3u8_url}")
                
            except Exception as e:
                return jsonify({
                    'error': f'Failed to extract video from webpage: {str(e)}'
                }), 500
        
        # Download and process the video
        logging.info(f"Starting download for URL: {m3u8_url}")
        output_file = downloader.download_and_merge(m3u8_url)
        
        if output_file and os.path.exists(output_file):
            # Generate a clean filename
            filename = f"video_{int(os.path.getmtime(output_file))}.mp4"
            
            # Return the file for download
            return send_file(
                output_file,
                as_attachment=True,
                download_name=filename,
                mimetype='video/mp4'
            )
        else:
            return jsonify({'error': 'Failed to process video. Please check the URL and try again.'}), 500
            
    except Exception as e:
        logging.error(f"Download error: {str(e)}")
        return jsonify({'error': f'Download failed: {str(e)}'}), 500

@app.route('/progress/<task_id>')
def get_progress(task_id):
    """Get download progress for a specific task"""
    progress = downloader.get_progress(task_id)
    return jsonify(progress)

@app.route('/batch-download', methods=['POST'])
def batch_download():
    """Handle batch M3U8 download request"""
    try:
        data = request.get_json()
        urls = data.get('urls', [])
        
        if not urls:
            return jsonify({'error': 'Please provide at least one M3U8 URL'}), 400
        
        # Validate URLs
        valid_urls = []
        for url in urls:
            url = url.strip()
            if not url:
                continue
            if not url.startswith(('http://', 'https://')):
                return jsonify({'error': f'URL must start with http:// or https://: {url}'}), 400
            if not url.endswith('.m3u8'):
                return jsonify({'error': f'URL must be a valid M3U8 playlist file: {url}'}), 400
            valid_urls.append(url)
        
        if not valid_urls:
            return jsonify({'error': 'No valid M3U8 URLs provided'}), 400
        
        if len(valid_urls) > 10:  # Limit batch size
            return jsonify({'error': 'Maximum 10 URLs allowed per batch'}), 400
        
        # Start batch download
        logging.info(f"Starting batch download for {len(valid_urls)} URLs")
        batch_id = batch_downloader.start_batch_download(valid_urls)
        
        return jsonify({'batch_id': batch_id, 'status': 'started', 'total_count': len(valid_urls)})
        
    except Exception as e:
        logging.error(f"Batch download error: {str(e)}")
        return jsonify({'error': f'Batch download failed: {str(e)}'}), 500

@app.route('/batch-status/<batch_id>')
def get_batch_status(batch_id):
    """Get batch download status and progress"""
    try:
        batch_status = batch_downloader.get_batch_status(batch_id)
        if not batch_status:
            return jsonify({'error': 'Batch not found'}), 404
        
        return jsonify(batch_status)
        
    except Exception as e:
        logging.error(f"Batch status error: {str(e)}")
        return jsonify({'error': f'Failed to get batch status: {str(e)}'}), 500

@app.route('/batch-download/<batch_id>')
def download_batch_zip(batch_id):
    """Download all videos in a batch as a ZIP file"""
    try:
        batch_status = batch_downloader.get_batch_status(batch_id)
        if not batch_status:
            return jsonify({'error': 'Batch not found'}), 404
        
        if batch_status['status'] not in ['completed', 'completed_with_errors']:
            return jsonify({'error': 'Batch is not ready for download'}), 400
        
        if batch_status['completed_count'] == 0:
            return jsonify({'error': 'No videos were successfully downloaded'}), 400
        
        # Create ZIP file
        zip_path = batch_downloader.create_batch_zip(batch_id)
        if not zip_path or not os.path.exists(zip_path):
            return jsonify({'error': 'Failed to create batch ZIP file'}), 500
        
        # Generate filename
        filename = f"m3u8_batch_{batch_id[:8]}_{batch_status['completed_count']}_videos.zip"
        
        return send_file(
            zip_path,
            as_attachment=True,
            download_name=filename,
            mimetype='application/zip'
        )
        
    except Exception as e:
        logging.error(f"Batch download error: {str(e)}")
        return jsonify({'error': f'Batch download failed: {str(e)}'}), 500

# PWA Routes
@app.route('/manifest.json')
def serve_manifest():
    """Serve the web app manifest for PWA functionality"""
    return send_file('static/manifest.json', mimetype='application/manifest+json')

@app.route('/sw.js')
def serve_service_worker():
    """Serve the service worker file"""
    return send_file('static/sw.js', mimetype='application/javascript')

@app.route('/offline')
def offline():
    """Offline fallback page"""
    return render_template('index.html')

@app.errorhandler(404)
def not_found(error):
    return redirect(url_for('index'))

@app.errorhandler(500)
def internal_error(error):
    logging.error(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error occurred'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
