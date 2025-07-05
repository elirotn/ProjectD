import os
import re
import requests
import subprocess
import tempfile
import logging
import threading
import time
import uuid
import zipfile
import trafilatura
from urllib.parse import urljoin, urlparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

class M3U8Downloader:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.progress_data = {}
        self.temp_dir = tempfile.mkdtemp(prefix='m3u8_downloader_')
        logging.info(f"Temporary directory created: {self.temp_dir}")
    
    def download_and_merge(self, m3u8_url):
        """Download M3U8 playlist and merge segments into MP4"""
        try:
            task_id = str(int(time.time() * 1000))
            self.progress_data[task_id] = {'percent': 0, 'status': 'Starting download...'}
            
            logging.info(f"Starting download for URL: {m3u8_url}")
            
            # Step 1: Download and parse M3U8 playlist
            self.update_progress(task_id, 10, 'Fetching M3U8 playlist...')
            playlist_content = self.fetch_playlist(m3u8_url)
            
            # Step 2: Parse segment URLs
            self.update_progress(task_id, 20, 'Parsing video segments...')
            segment_urls = self.parse_segments(playlist_content, m3u8_url)
            
            if not segment_urls:
                raise Exception("No video segments found in playlist")
            
            logging.info(f"Found {len(segment_urls)} segments to download")
            
            # Step 3: Download segments
            self.update_progress(task_id, 30, f'Downloading {len(segment_urls)} segments...')
            segment_files = self.download_segments(segment_urls, task_id)
            
            # Step 4: Merge segments using ffmpeg
            self.update_progress(task_id, 80, 'Merging segments with ffmpeg...')
            output_file = self.merge_segments(segment_files, task_id)
            
            self.update_progress(task_id, 100, 'Download complete!')
            logging.info(f"Video successfully processed: {output_file}")
            
            return output_file
            
        except Exception as e:
            logging.error(f"Download failed: {str(e)}")
            raise
    
    def fetch_playlist(self, url):
        """Fetch M3U8 playlist content"""
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            return response.text
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to fetch playlist: {str(e)}")
    
    def parse_segments(self, playlist_content, base_url):
        """Parse segment URLs from M3U8 playlist"""
        segment_urls = []
        base_path = '/'.join(base_url.split('/')[:-1]) + '/'
        
        for line in playlist_content.strip().split('\n'):
            line = line.strip()
            if line and not line.startswith('#'):
                # Handle relative URLs
                if line.startswith('http'):
                    segment_urls.append(line)
                else:
                    segment_urls.append(urljoin(base_path, line))
        
        return segment_urls
    
    def download_segments(self, segment_urls, task_id):
        """Download all video segments"""
        segment_files = []
        total_segments = len(segment_urls)
        
        for i, url in enumerate(segment_urls):
            try:
                # Update progress
                progress = 30 + int((i / total_segments) * 45)  # 30% to 75%
                self.update_progress(task_id, progress, f'Downloading segment {i+1}/{total_segments}...')
                
                # Download segment
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                
                # Save segment to temp file
                segment_file = os.path.join(self.temp_dir, f'segment_{i:06d}.ts')
                with open(segment_file, 'wb') as f:
                    f.write(response.content)
                
                segment_files.append(segment_file)
                logging.debug(f"Downloaded segment {i+1}/{total_segments}: {url}")
                
            except Exception as e:
                logging.error(f"Failed to download segment {url}: {str(e)}")
                # Continue with other segments
                continue
        
        if not segment_files:
            raise Exception("Failed to download any video segments")
        
        logging.info(f"Successfully downloaded {len(segment_files)} segments")
        return segment_files
    
    def merge_segments(self, segment_files, task_id):
        """Merge video segments using ffmpeg"""
        try:
            self.update_progress(task_id, 85, 'Creating segment list for ffmpeg...')
            
            # Create file list for ffmpeg
            filelist_path = os.path.join(self.temp_dir, 'filelist.txt')
            with open(filelist_path, 'w') as f:
                for segment_file in segment_files:
                    f.write(f"file '{segment_file}'\n")
            
            # Output file
            output_file = os.path.join(self.temp_dir, 'output.mp4')
            
            self.update_progress(task_id, 90, 'Running ffmpeg to merge segments...')
            
            # FFmpeg command to concatenate segments
            cmd = [
                'ffmpeg',
                '-f', 'concat',
                '-safe', '0',
                '-i', filelist_path,
                '-c', 'copy',
                '-y',  # Overwrite output file
                output_file
            ]
            
            logging.info(f"Running ffmpeg command: {' '.join(cmd)}")
            
            # Run ffmpeg
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode != 0:
                logging.error(f"FFmpeg error: {result.stderr}")
                raise Exception(f"FFmpeg failed: {result.stderr}")
            
            if not os.path.exists(output_file):
                raise Exception("Output file was not created by ffmpeg")
            
            # Verify output file has content
            if os.path.getsize(output_file) == 0:
                raise Exception("Output file is empty")
            
            logging.info(f"FFmpeg completed successfully. Output: {output_file}")
            return output_file
            
        except subprocess.TimeoutExpired:
            raise Exception("Video processing timed out. File may be too large.")
        except Exception as e:
            logging.error(f"Failed to merge segments: {str(e)}")
            raise Exception(f"Failed to merge video segments: {str(e)}")
    
    def update_progress(self, task_id, percent, status):
        """Update progress for a specific task"""
        self.progress_data[task_id] = {
            'percent': percent,
            'status': status
        }
        logging.info(f"Progress {percent}%: {status}")
    
    def get_progress(self, task_id):
        """Get progress for a specific task"""
        return self.progress_data.get(task_id, {'percent': 0, 'status': 'Unknown task'})
    
    def cleanup(self):
        """Clean up temporary files"""
        try:
            import shutil
            shutil.rmtree(self.temp_dir, ignore_errors=True)
            logging.info(f"Cleaned up temporary directory: {self.temp_dir}")
        except Exception as e:
            logging.error(f"Failed to cleanup temp directory: {str(e)}")
    
    def __del__(self):
        """Cleanup when object is destroyed"""
        self.cleanup()


class BatchDownloader:
    def __init__(self, max_concurrent=3):
        self.max_concurrent = max_concurrent
        self.batch_data = {}
        self.active_downloads = {}
        
    def start_batch_download(self, urls):
        """Start batch download for multiple M3U8 URLs"""
        batch_id = str(uuid.uuid4())
        
        # Initialize batch data
        self.batch_data[batch_id] = {
            'urls': urls,
            'total_count': len(urls),
            'completed_count': 0,
            'failed_count': 0,
            'downloads': {},
            'status': 'processing',
            'created_at': time.time(),
            'output_files': []
        }
        
        # Initialize individual download tracking
        for i, url in enumerate(urls):
            download_id = f"{batch_id}_{i}"
            self.batch_data[batch_id]['downloads'][download_id] = {
                'url': url,
                'status': 'pending',
                'progress': 0,
                'message': 'Waiting to start...',
                'output_file': None,
                'error': None
            }
        
        # Start downloads in background thread
        thread = threading.Thread(target=self._process_batch, args=(batch_id,))
        thread.daemon = True
        thread.start()
        
        return batch_id
    
    def _process_batch(self, batch_id):
        """Process batch downloads with concurrency control"""
        try:
            batch = self.batch_data[batch_id]
            downloads = list(batch['downloads'].items())
            
            with ThreadPoolExecutor(max_workers=self.max_concurrent) as executor:
                # Submit all download tasks
                future_to_download = {}
                for download_id, download_info in downloads:
                    future = executor.submit(self._download_single, batch_id, download_id, download_info['url'])
                    future_to_download[future] = download_id
                
                # Process completed downloads
                for future in as_completed(future_to_download):
                    download_id = future_to_download[future]
                    try:
                        result = future.result()
                        if result:
                            batch['downloads'][download_id]['status'] = 'completed'
                            batch['downloads'][download_id]['output_file'] = result
                            batch['downloads'][download_id]['progress'] = 100
                            batch['downloads'][download_id]['message'] = 'Download completed'
                            batch['output_files'].append(result)
                            batch['completed_count'] += 1
                        else:
                            batch['downloads'][download_id]['status'] = 'failed'
                            batch['downloads'][download_id]['message'] = 'Download failed'
                            batch['failed_count'] += 1
                    except Exception as e:
                        logging.error(f"Download {download_id} failed: {str(e)}")
                        batch['downloads'][download_id]['status'] = 'failed'
                        batch['downloads'][download_id]['error'] = str(e)
                        batch['downloads'][download_id]['message'] = f'Error: {str(e)}'
                        batch['failed_count'] += 1
            
            # Update batch status
            if batch['completed_count'] > 0:
                if batch['failed_count'] == 0:
                    batch['status'] = 'completed'
                else:
                    batch['status'] = 'completed_with_errors'
            else:
                batch['status'] = 'failed'
                
            logging.info(f"Batch {batch_id} completed: {batch['completed_count']}/{batch['total_count']} successful")
            
        except Exception as e:
            logging.error(f"Batch processing failed: {str(e)}")
            self.batch_data[batch_id]['status'] = 'failed'
    
    def _download_single(self, batch_id, download_id, url):
        """Download a single M3U8 file with progress tracking"""
        try:
            # Update status
            self.batch_data[batch_id]['downloads'][download_id]['status'] = 'downloading'
            self.batch_data[batch_id]['downloads'][download_id]['message'] = 'Starting download...'
            
            # Create a custom downloader for this specific download
            downloader = M3U8DownloaderWithCallback(
                progress_callback=lambda percent, status: self._update_download_progress(
                    batch_id, download_id, percent, status
                )
            )
            
            # Download the video
            output_file = downloader.download_and_merge(url)
            
            return output_file
            
        except Exception as e:
            logging.error(f"Single download failed for {url}: {str(e)}")
            self._update_download_progress(batch_id, download_id, 0, f"Error: {str(e)}")
            return None
    
    def _update_download_progress(self, batch_id, download_id, percent, status):
        """Update progress for individual download"""
        if batch_id in self.batch_data and download_id in self.batch_data[batch_id]['downloads']:
            self.batch_data[batch_id]['downloads'][download_id]['progress'] = percent
            self.batch_data[batch_id]['downloads'][download_id]['message'] = status
    
    def get_batch_status(self, batch_id):
        """Get complete batch status"""
        return self.batch_data.get(batch_id, None)
    
    def create_batch_zip(self, batch_id):
        """Create a ZIP file containing all downloaded videos"""
        batch = self.batch_data.get(batch_id)
        if not batch or not batch['output_files']:
            return None
        
        try:
            zip_filename = f"batch_download_{batch_id[:8]}.zip"
            zip_path = os.path.join(tempfile.gettempdir(), zip_filename)
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for i, output_file in enumerate(batch['output_files']):
                    if os.path.exists(output_file):
                        # Use a clean filename for the ZIP entry
                        zip_entry_name = f"video_{i+1:03d}.mp4"
                        zipf.write(output_file, zip_entry_name)
            
            return zip_path
            
        except Exception as e:
            logging.error(f"Failed to create batch ZIP: {str(e)}")
            return None


class M3U8DownloaderWithCallback(M3U8Downloader):
    def __init__(self, progress_callback=None):
        super().__init__()
        self.progress_callback = progress_callback
    
    def update_progress(self, task_id, percent, status):
        """Update progress with callback support"""
        super().update_progress(task_id, percent, status)
        if self.progress_callback:
            self.progress_callback(percent, status)


class VideoStreamExtractor:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def extract_m3u8_from_webpage(self, url):
        """Extract M3U8 links from a webpage"""
        try:
            logging.info(f"Extracting M3U8 links from webpage: {url}")
            
            # Fetch the webpage content
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            html_content = response.text
            
            # Multiple strategies to find M3U8 links
            m3u8_links = []
            
            # Strategy 1: Direct regex search for .m3u8 URLs
            m3u8_patterns = [
                r'https?://[^"\s<>]+\.m3u8[^"\s<>]*',
                r'"(https?://[^"]+\.m3u8[^"]*)"',
                r"'(https?://[^']+\.m3u8[^']*)'",
                r'src\s*=\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
                r'data-src\s*=\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
            ]
            
            for pattern in m3u8_patterns:
                matches = re.findall(pattern, html_content, re.IGNORECASE)
                for match in matches:
                    # Handle tuple results from group captures
                    link = match if isinstance(match, str) else match[0] if match else None
                    if link and link not in m3u8_links:
                        # Convert relative URLs to absolute
                        if link.startswith('//'):
                            link = urlparse(url).scheme + ':' + link
                        elif link.startswith('/'):
                            link = urljoin(url, link)
                        elif not link.startswith('http'):
                            link = urljoin(url, link)
                        m3u8_links.append(link)
            
            # Strategy 2: Look for common video streaming patterns
            streaming_patterns = [
                r'manifest["\']?\s*:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
                r'playlist["\']?\s*:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
                r'source["\']?\s*:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
                r'hls["\']?\s*:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
            ]
            
            for pattern in streaming_patterns:
                matches = re.findall(pattern, html_content, re.IGNORECASE)
                for match in matches:
                    link = match if isinstance(match, str) else match[0] if match else None
                    if link and link not in m3u8_links:
                        if link.startswith('//'):
                            link = urlparse(url).scheme + ':' + link
                        elif link.startswith('/'):
                            link = urljoin(url, link)
                        elif not link.startswith('http'):
                            link = urljoin(url, link)
                        m3u8_links.append(link)
            
            # Strategy 3: Look in JavaScript variables and JSON data
            js_patterns = [
                r'["\']url["\']?\s*:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
                r'["\']source["\']?\s*:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
                r'["\']file["\']?\s*:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
            ]
            
            for pattern in js_patterns:
                matches = re.findall(pattern, html_content, re.IGNORECASE)
                for match in matches:
                    link = match if isinstance(match, str) else match[0] if match else None
                    if link and link not in m3u8_links:
                        if link.startswith('//'):
                            link = urlparse(url).scheme + ':' + link
                        elif link.startswith('/'):
                            link = urljoin(url, link)
                        elif not link.startswith('http'):
                            link = urljoin(url, link)
                        m3u8_links.append(link)
            
            # Strategy 4: Check for iframe sources that might contain video
            iframe_pattern = r'<iframe[^>]+src=["\']([^"\']+)["\'][^>]*>'
            iframe_matches = re.findall(iframe_pattern, html_content, re.IGNORECASE)
            
            for iframe_url in iframe_matches[:3]:  # Limit to first 3 iframes
                try:
                    if iframe_url.startswith('//'):
                        iframe_url = urlparse(url).scheme + ':' + iframe_url
                    elif iframe_url.startswith('/'):
                        iframe_url = urljoin(url, iframe_url)
                    elif not iframe_url.startswith('http'):
                        iframe_url = urljoin(url, iframe_url)
                    
                    # Recursively check iframe content
                    iframe_links = self.extract_m3u8_from_webpage(iframe_url)
                    m3u8_links.extend(iframe_links)
                except Exception as e:
                    logging.warning(f"Failed to check iframe {iframe_url}: {str(e)}")
                    continue
            
            # Remove duplicates and validate links
            unique_links = []
            for link in m3u8_links:
                if link not in unique_links and self.validate_m3u8_link(link):
                    unique_links.append(link)
            
            logging.info(f"Found {len(unique_links)} valid M3U8 links")
            return unique_links
            
        except requests.exceptions.RequestException as e:
            logging.error(f"Failed to fetch webpage {url}: {str(e)}")
            raise Exception(f"Failed to fetch webpage: {str(e)}")
        except Exception as e:
            logging.error(f"Error extracting M3U8 links: {str(e)}")
            raise Exception(f"Error extracting video links: {str(e)}")
    
    def validate_m3u8_link(self, url):
        """Validate if an M3U8 link is accessible"""
        try:
            # Quick HEAD request to check if the link is accessible
            response = self.session.head(url, timeout=10, allow_redirects=True)
            return response.status_code == 200
        except:
            # If HEAD fails, try a quick GET with small range
            try:
                response = self.session.get(url, timeout=10, headers={'Range': 'bytes=0-1023'})
                return response.status_code in [200, 206, 416]  # 416 = Range Not Satisfiable (but file exists)
            except:
                return False
    
    def get_webpage_info(self, url):
        """Get basic information about a webpage"""
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # Use trafilatura to extract clean text and title
            downloaded = trafilatura.fetch_url(url)
            title = None
            
            if downloaded:
                # Try to extract title from HTML
                title_match = re.search(r'<title[^>]*>([^<]+)</title>', response.text, re.IGNORECASE)
                if title_match:
                    title = title_match.group(1).strip()
            
            return {
                'title': title or 'Unknown',
                'url': url,
                'status': 'accessible'
            }
            
        except Exception as e:
            return {
                'title': 'Error',
                'url': url,
                'status': f'error: {str(e)}'
            }
