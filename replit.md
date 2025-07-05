# M3U8 Video Downloader

## Overview

This is a Flask-based web application that allows users to download M3U8 video streams and convert them to MP4 files. The application provides both single and batch download capabilities with real-time progress tracking. Users can input individual M3U8 playlist URLs or process multiple URLs simultaneously, with all videos delivered as a convenient ZIP file for batch downloads.

### Key Features
- **Direct M3U8 Downloads**: Input direct .m3u8 playlist URLs for immediate processing
- **Automatic Video Extraction**: Input any webpage URL to automatically detect and extract M3U8 video streams
- **Three Input Modes**: Direct link mode, extraction-only mode, and auto-detect with download mode
- **Batch Processing**: Download multiple videos simultaneously with progress tracking
- **Real-time Progress**: Live updates for individual and batch download progress
- **ZIP File Generation**: Automatic packaging of batch downloads for easy retrieval
- **Progressive Web App**: Full PWA implementation with home screen installation, offline capabilities, and native app-like experience
- **Mobile Optimized**: Touch-friendly interface with responsive design optimized for mobile devices
- **Cross-Platform**: Works on iOS, Android, desktop, and tablet devices as an installable web app

## System Architecture

The application follows a simple three-tier architecture:

1. **Frontend**: HTML/CSS/JavaScript interface using Bootstrap for styling and custom JavaScript for user interactions
2. **Backend**: Flask web server handling HTTP requests and coordinating video downloads
3. **Processing Layer**: Custom M3U8Downloader utility class that handles the core video processing logic

## Key Components

### Web Application (app.py)
- **Flask Server**: Main application server handling HTTP routes
- **Routes**:
  - `/` - Serves the main interface with mode toggle
  - `/extract` - Handles POST requests for video stream extraction from webpages
  - `/download` - Handles POST requests for single video downloads (supports direct, extract, auto modes)
  - `/batch-download` - Handles POST requests for batch video downloads
  - `/batch-status/<batch_id>` - Provides real-time batch progress updates
  - `/batch-download/<batch_id>` - Downloads completed batch as ZIP file
- **Input Validation**: Validates URLs for proper format and protocol, supports both M3U8 and webpage URLs
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Concurrency**: Batch processing with configurable concurrent download limits
- **Video Stream Detection**: Automatic detection and extraction of M3U8 streams from webpage content

### M3U8 Downloader (utils/downloader.py)
- **Core Processing Engine**: Handles the complete download and merge workflow
- **Playlist Parsing**: Fetches and parses M3U8 playlist files
- **Segment Download**: Downloads individual video segments
- **Video Merging**: Uses FFmpeg to merge segments into MP4 files
- **Progress Tracking**: Real-time progress updates for user feedback
- **Temporary File Management**: Creates and manages temporary directories for processing
- **Batch Processing**: BatchDownloader class for concurrent multi-URL processing
- **ZIP Generation**: Automatic ZIP file creation for batch downloads
- **Thread Safety**: Thread-safe progress tracking and status updates
- **Video Stream Extraction**: VideoStreamExtractor class for detecting M3U8 streams in webpages
- **Multi-Strategy Detection**: Uses regex patterns, iframe analysis, and JavaScript parsing to find video streams
- **Link Validation**: Validates extracted M3U8 links for accessibility before presenting to user

### Frontend Interface
- **Responsive Design**: Bootstrap-based UI that works on desktop and mobile
- **Mode Toggle**: Switch between single and batch download modes
- **Input Mode Selection**: Choose between direct M3U8 links, extraction-only, or auto-detect modes
- **Real-time Feedback**: Progress bars and status updates during processing
- **Batch Progress**: Individual progress tracking for each URL in batch
- **Input Validation**: Client-side URL validation with visual feedback for different input modes
- **Modern Styling**: Custom CSS with modern design patterns and animations
- **Live Updates**: Real-time status polling for batch download progress
- **Extraction Results Display**: Interactive display of found video streams with selection and download options
- **Link Management**: Copy, select, and download individual or multiple extracted video streams

### Progressive Web App (PWA) Components
- **Web App Manifest**: Complete PWA manifest with app metadata, icons, and configuration
- **Service Worker**: Advanced caching strategies, offline support, and background sync capabilities
- **App Icons**: Generated app icons in multiple sizes (16x16 to 512x512) for various platforms
- **Installation Support**: Cross-platform installation prompts and handling for Android, iOS, and desktop
- **Offline Functionality**: Cached resources and offline fallback pages for network-independent operation
- **Mobile Optimization**: Touch-friendly interfaces, safe area support, and standalone mode enhancements
- **PWA Manager**: JavaScript class handling service worker registration, installation prompts, and PWA lifecycle
- **Platform-Specific Features**: iOS Safari integration, Android home screen support, and Windows PWA compatibility

## Data Flow

1. **User Input**: User enters M3U8 URL in the web interface
2. **Client Validation**: JavaScript validates URL format before submission
3. **Server Processing**: Flask receives request and validates URL server-side
4. **Playlist Fetch**: Downloader fetches the M3U8 playlist file
5. **Segment Parsing**: Extracts individual video segment URLs from playlist
6. **Segment Download**: Downloads all video segments to temporary storage
7. **Video Merging**: Uses FFmpeg to merge segments into single MP4 file
8. **File Delivery**: Serves the merged MP4 file for download
9. **Cleanup**: Removes temporary files after processing

## External Dependencies

### Python Libraries
- **Flask**: Web framework for HTTP handling
- **Requests**: HTTP client for downloading playlists and segments
- **Werkzeug**: WSGI utilities and middleware

### System Dependencies
- **FFmpeg**: Required for video segment merging (must be installed on system)

### Frontend Libraries (CDN)
- **Bootstrap 5.3.0**: CSS framework for responsive design
- **Font Awesome 6.4.0**: Icon library
- **Google Fonts (Inter)**: Typography

## Deployment Strategy

### Environment Configuration
- Uses environment variables for configuration (SESSION_SECRET)
- Proxy-aware setup with ProxyFix middleware for deployment behind reverse proxies
- Configurable logging levels

### File Management
- Temporary directory creation for processing files
- Automatic cleanup of temporary files after processing
- Secure file serving with proper MIME types

### Security Considerations
- Input validation on both client and server side
- URL protocol restrictions (only HTTP/HTTPS)
- File extension validation for M3U8 files
- Session security with configurable secret keys

## Changelog
- July 05, 2025. Initial setup
- July 05, 2025. Added batch processing functionality with real-time progress tracking  
- July 05, 2025. Enhanced with automatic video stream extraction from webpage URLs
- July 05, 2025. Implemented Progressive Web App (PWA) functionality with installation support, offline capabilities, and mobile-optimized interface

## User Preferences

Preferred communication style: Simple, everyday language.