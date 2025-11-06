// Global state
let currentLocation = null;
let currentImage = null;
let reports = [];
let userLocation = null; // Store user's current location for routing

// Get configuration (ensure it's loaded)
const config = window.GTrackerConfig || {
    storage: { 
        reportsKey: 'gtracker-reports',
        maxStorageSize: 4 * 1024 * 1024,
        storageThreshold: 0.9
    },
    image: { 
        maxFileSize: 10 * 1024 * 1024,
        maxWidth: 800,
        maxHeight: 800,
        compressionQuality: 0.7
    },
    location: { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
    },
    map: { 
        mapZoom: 18,
        openstreetmapBaseUrl: 'https://www.openstreetmap.org',
        googleMapsBaseUrl: 'https://www.google.com/maps',
        graphhopperUrl: 'https://graphhopper.com/maps'
    },
    status: { 
        default: 'reported', 
        options: ['reported', 'in-progress', 'resolved'], 
        labels: {
            'reported': 'Reported',
            'in-progress': 'In Progress',
            'resolved': 'Resolved'
        }, 
        icons: {
            'reported': '⚠️',
            'in-progress': '🔄',
            'resolved': '✅'
        }
    },
    ui: { 
        statsUpdateInterval: 2000, 
        animationDuration: 500 
    },
    messages: {},
    dateFormat: {
        locale: 'en-US',
        options: {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }
    }
};

// Load reports from localStorage
try {
    const stored = localStorage.getItem(config.storage.reportsKey);
    if (stored) {
        reports = JSON.parse(stored);
        console.log('Loaded reports from localStorage:', reports.length);
    }
} catch (error) {
    console.error('Error loading reports from localStorage:', error);
    reports = [];
}

// DOM Elements
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const uploadLabel = document.querySelector('.upload-label');
const getLocationBtn = document.getElementById('getLocationBtn');
const locationStatus = document.getElementById('locationStatus');
const locationInfo = document.getElementById('locationInfo');
const latitude = document.getElementById('latitude');
const longitude = document.getElementById('longitude');
const mapLinkContainer = document.getElementById('mapLinkContainer');
const description = document.getElementById('description');
const submitBtn = document.getElementById('submitBtn');
const reportForm = document.getElementById('reportForm');
const reportsList = document.getElementById('reportsList');
const filterButtons = document.querySelectorAll('.filter-btn');
const successModal = document.getElementById('successModal');
const closeModal = document.getElementById('closeModal');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');
const totalReportsEl = document.getElementById('totalReports');
const inProgressReportsEl = document.getElementById('inProgressReports');
const resolvedReportsEl = document.getElementById('resolvedReports');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    renderReports();
    updateStats();
    
    // Update stats at configured interval to ensure real-time updates
    setInterval(() => {
        updateStats();
    }, config.ui.statsUpdateInterval || 2000);
});

// Update Hero Stats with smooth animation
function updateStats() {
    // Reload reports from localStorage to ensure we have latest data
    try {
        const stored = localStorage.getItem(config.storage.reportsKey);
        if (stored) {
            reports = JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading reports for stats:', error);
    }
    
    const total = reports.length;
    const inProgress = reports.filter(r => r.status === 'in-progress').length;
    const resolved = reports.filter(r => r.status === 'resolved').length;
    
    // Get elements fresh in case they weren't loaded when script ran
    const totalEl = document.getElementById('totalReports');
    const inProgressEl = document.getElementById('inProgressReports');
    const resolvedEl = document.getElementById('resolvedReports');
    
    // Animate counting effect
    const animDuration = config.ui.animationDuration || 500;
    animateValue(totalEl, 0, total, animDuration);
    animateValue(inProgressEl, 0, inProgress, animDuration);
    animateValue(resolvedEl, 0, resolved, animDuration);
    
    // Also update the stored references
    if (totalReportsEl) animateValue(totalReportsEl, 0, total, animDuration);
    if (inProgressReportsEl) animateValue(inProgressReportsEl, 0, inProgress, animDuration);
    if (resolvedReportsEl) animateValue(resolvedReportsEl, 0, resolved, animDuration);
    
    console.log('Stats updated:', { total, inProgress, resolved });
}

// Animate counting numbers
let animationTimers = {}; // Store timers to prevent overlapping animations

function animateValue(element, start, end, duration) {
    if (!element) return;
    
    // Clear any existing animation for this element
    if (animationTimers[element.id]) {
        clearInterval(animationTimers[element.id]);
    }
    
    const startVal = parseInt(element.textContent) || start;
    
    // If already at target, skip animation
    if (startVal === end) return;
    
    const range = end - startVal;
    const increment = range > 0 ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / Math.abs(range)));
    
    if (stepTime < 1 || Math.abs(range) === 0) {
        element.textContent = end;
        return;
    }
    
    let current = startVal;
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
            delete animationTimers[element.id];
        }
        element.textContent = current;
    }, stepTime);
    
    animationTimers[element.id] = timer;
}

// Event Listeners
function initializeEventListeners() {
    // Image upload
    imageInput.addEventListener('change', handleImageSelect);
    uploadLabel.addEventListener('dragover', handleDragOver);
    uploadLabel.addEventListener('dragleave', handleDragLeave);
    uploadLabel.addEventListener('drop', handleDrop);
    
    // Location
    getLocationBtn.addEventListener('click', () => getCurrentLocation(null));
    
    // Form submission
    reportForm.addEventListener('submit', handleFormSubmit);
    
    // Filters
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => handleFilterClick(btn));
    });
    
    // Modal
    closeModal.addEventListener('click', () => {
        successModal.classList.add('hidden');
    });
    
    successModal.addEventListener('click', (e) => {
        if (e.target === successModal) {
            successModal.classList.add('hidden');
        }
    });
    
    // View History Button
    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener('click', () => {
            document.getElementById('reports')?.scrollIntoView({ behavior: 'smooth' });
        });
    }
}

// Image Upload Functions
function handleImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processImageFile(file);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    uploadLabel.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadLabel.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadLabel.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        imageInput.files = e.dataTransfer.files;
        processImageFile(file);
    }
}

// Compress image to reduce localStorage size
function compressImage(file, maxWidth = config.image.maxWidth, maxHeight = config.image.maxHeight, quality = config.image.compressionQuality) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const compressed = canvas.toDataURL('image/jpeg', quality);
                resolve(compressed);
            };
            img.onerror = () => resolve(e.target.result); // Fallback to original
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function processImageFile(file) {
    // Validate file size using config
    if (file.size > config.image.maxFileSize) {
        alert(`File size must be less than ${(config.image.maxFileSize / 1024 / 1024).toFixed(0)}MB`);
        return;
    }
    
    // Show loading message
    if (locationStatus) {
        locationStatus.textContent = config.messages.processingImage || 'Processing image...';
        locationStatus.className = 'location-status loading';
        locationStatus.classList.remove('hidden');
    }
    
    // Compress and process image
    compressImage(file).then((compressedImage) => {
        currentImage = compressedImage;
        displayImagePreview(compressedImage);
        
        // Try to extract GPS from EXIF data
        if (typeof EXIF !== 'undefined') {
            EXIF.getData(file, function() {
                const latArr = EXIF.getTag(this, "GPSLatitude");
                const lonArr = EXIF.getTag(this, "GPSLongitude");
                const latRef = EXIF.getTag(this, "GPSLatitudeRef");
                const lonRef = EXIF.getTag(this, "GPSLongitudeRef");
                
                if (latArr && lonArr && latRef && lonRef) {
                    // Convert DMS to decimal degrees
                    const lat = convertDMSToDD(latArr[0], latArr[1], latArr[2], latRef);
                    const lon = convertDMSToDD(lonArr[0], lonArr[1], lonArr[2], lonRef);
                    
                    currentLocation = {
                        latitude: lat,
                        longitude: lon,
                        accuracy: 0,
                        source: 'gps'
                    };
                    
                    displayLocationInfo(currentLocation);
                    if (locationStatus) {
                        locationStatus.textContent = config.messages.locationExtracted || 'Location extracted from image GPS data!';
                        locationStatus.className = 'location-status success';
                        locationStatus.classList.remove('hidden');
                    }
                    checkFormValidity();
                } else {
                    // No GPS in image, show option to get device location
                    if (locationStatus) {
                        locationStatus.textContent = config.messages.noGPSInImage || 'No GPS data in image. Click "Get My Location" to use device location.';
                        locationStatus.className = 'location-status';
                        locationStatus.classList.remove('hidden');
                    }
                    checkFormValidity();
                }
            });
        } else {
            // EXIF library not loaded, prompt for manual location
            if (locationStatus) {
                locationStatus.textContent = config.messages.clickToDetect || 'Click "Get My Location" to detect your location.';
                locationStatus.className = 'location-status';
                locationStatus.classList.remove('hidden');
            }
            checkFormValidity();
        }
    });
}

// Helper function to convert DMS to Decimal Degrees
function convertDMSToDD(degrees, minutes, seconds, direction) {
    let dd = degrees + minutes / 60 + seconds / (60 * 60);
    if (direction === "S" || direction === "W") dd = dd * -1;
    return dd;
}

function displayImagePreview(imageSrc) {
    imagePreview.innerHTML = `
        <div style="position: relative;">
            <img src="${imageSrc}" alt="Preview">
            <button type="button" class="remove-image" onclick="removeImage()">×</button>
        </div>
    `;
    imagePreview.classList.remove('hidden');
    uploadLabel.style.display = 'none';
}

function removeImage() {
    currentImage = null;
    imageInput.value = '';
    imagePreview.classList.add('hidden');
    uploadLabel.style.display = 'flex';
    checkFormValidity();
}

// Location Functions
function getCurrentLocation(callback) {
    if (!navigator.geolocation) {
        showLocationError('Geolocation is not supported by your browser');
        if (callback) callback(false);
        return;
    }
    
    if (getLocationBtn) getLocationBtn.disabled = true;
    if (locationStatus) {
        locationStatus.textContent = 'Detecting your location...';
        locationStatus.className = 'location-status loading';
        locationStatus.classList.remove('hidden');
    }
    
    const geoOptions = {
        enableHighAccuracy: config.location.enableHighAccuracy,
        timeout: config.location.timeout,
        maximumAge: config.location.maximumAge
    };
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                source: 'device'
            };
            
            currentLocation = location;
            userLocation = { lat: location.latitude, lon: location.longitude };
            
            if (displayLocationInfo) displayLocationInfo(currentLocation);
            if (showLocationSuccess) showLocationSuccess(config.messages.locationDetected || 'Location detected successfully!');
            if (checkFormValidity) checkFormValidity();
            if (getLocationBtn) getLocationBtn.disabled = false;
            if (callback) callback(true);
        },
        (error) => {
            let errorMessage = 'Unable to retrieve your location';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location access denied. Please enable location permissions.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location information unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timed out.';
                    break;
            }
            if (showLocationError) showLocationError(errorMessage);
            if (getLocationBtn) getLocationBtn.disabled = false;
            if (callback) callback(false);
        },
        geoOptions
    );
}

function displayLocationInfo(location) {
    if (latitude) latitude.textContent = location.latitude.toFixed(6);
    if (longitude) longitude.textContent = location.longitude.toFixed(6);
    if (locationInfo) locationInfo.classList.remove('hidden');
    
    // Store user location for routing
    userLocation = { lat: location.latitude, lon: location.longitude };
    
    // Create map link with routing
    const zoom = config.map.mapZoom || 18;
    const mapUrl = `${config.map.openstreetmapBaseUrl}/?mlat=${location.latitude}&mlon=${location.longitude}&zoom=${zoom}`;
    if (mapLinkContainer) {
        const sourceText = location.source === 'gps' ? 'from image GPS' : 'from device';
        mapLinkContainer.innerHTML = `
            <a href="${mapUrl}" target="_blank" class="map-link">
                <span>🗺️</span>
                <span>View on Map</span>
                <span>↗</span>
            </a>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                Location obtained ${sourceText}
            </div>
        `;
        mapLinkContainer.classList.remove('hidden');
    }
}

function showLocationSuccess(message) {
    if (locationStatus) {
        locationStatus.textContent = message;
        locationStatus.className = 'location-status success';
        locationStatus.classList.remove('hidden');
    }
}

function showLocationError(message) {
    if (locationStatus) {
        locationStatus.textContent = message;
        locationStatus.className = 'location-status error';
        locationStatus.classList.remove('hidden');
    }
    if (locationInfo) locationInfo.classList.add('hidden');
    currentLocation = null;
    checkFormValidity();
}

// Form Validation
function checkFormValidity() {
    const submitButton = document.getElementById('submitBtn');
    if (!submitButton) return;
    
    if (currentImage && currentLocation) {
        submitButton.disabled = false;
        submitButton.style.opacity = '1';
        submitButton.style.cursor = 'pointer';
    } else {
        submitButton.disabled = true;
        submitButton.style.opacity = '0.5';
        submitButton.style.cursor = 'not-allowed';
    }
}

// Form Submission
function handleFormSubmit(e) {
    e.preventDefault();
    
    console.log('Form submitted', { currentImage: !!currentImage, currentLocation: !!currentLocation });
    
    if (!currentImage || !currentLocation) {
        alert(config.messages.locationRequired || 'Please upload an image and detect your location');
        return;
    }
    
    const report = {
        id: Date.now().toString(),
        image: currentImage,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        description: description?.value?.trim() || 'No description provided',
        status: config.status.default || 'reported',
        date: new Date().toISOString(),
        timestamp: Date.now()
    };
    
    // Add to reports array
    reports.unshift(report);
    
    // Save to localStorage with size checking
    try {
        const dataString = JSON.stringify(reports);
        const dataSize = new Blob([dataString]).size;
        const maxSize = config.storage.maxStorageSize;
        const threshold = maxSize * (config.storage.storageThreshold || 0.9);
        
        if (dataSize > threshold) {
            // Remove oldest reports if storage is getting full
            while (reports.length > 0 && dataSize > threshold) {
                reports.pop(); // Remove oldest report
            }
            localStorage.setItem(config.storage.reportsKey, JSON.stringify(reports));
            alert(config.messages.storageFullRemoveOld || 'Storage was getting full. Some older reports were removed to save space.');
        }
        
        localStorage.setItem(config.storage.reportsKey, JSON.stringify(reports));
        console.log('Report saved successfully', report);
        console.log('Storage size:', (dataSize / 1024 / 1024).toFixed(2), 'MB');
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        
        // Check if it's a quota exceeded error
        if (error.name === 'QuotaExceededError' || error.code === 22) {
            // Try to remove oldest reports and save again
            if (reports.length > 1) {
                reports.pop(); // Remove oldest report
                try {
                    localStorage.setItem(config.storage.reportsKey, JSON.stringify(reports));
                    alert('Storage is full. Removed an old report. Please try submitting again.');
                    return;
                } catch (e) {
                    alert('Storage is full. Please delete some old reports manually or clear your browser storage.');
                    return;
                }
            } else {
                alert(config.messages.storageFull || 'Storage is full. Please clear your browser storage or use a different browser.');
                return;
            }
        } else {
            alert('Error saving report: ' + error.message + '. Please try again.');
            return;
        }
    }
    
    // Reset form
    resetForm();
    
    // Show success modal with config messages
    if (successModal) {
        const modalTitle = successModal.querySelector('h3');
        const modalText = successModal.querySelector('p');
        if (modalTitle && config.messages.reportSubmitted) {
            modalTitle.textContent = config.messages.reportSubmitted;
        }
        if (modalText && config.messages.reportSubmittedDesc) {
            modalText.textContent = config.messages.reportSubmittedDesc;
        }
        successModal.classList.remove('hidden');
    }
    
    // Render updated reports
    renderReports();
    
    // Update stats
    updateStats();
    
    console.log('Total reports after submission:', reports.length);
}

function resetForm() {
    currentImage = null;
    currentLocation = null;
    // Note: We keep userLocation so it can be used for routing to other reports
    imageInput.value = '';
    description.value = '';
    imagePreview.classList.add('hidden');
    uploadLabel.style.display = 'flex';
    locationInfo.classList.add('hidden');
    locationStatus.classList.add('hidden');
    mapLinkContainer.classList.add('hidden');
    submitBtn.disabled = true;
}

// Reports Rendering
function renderReports(filter = 'all') {
    const filteredReports = filter === 'all' 
        ? reports 
        : reports.filter(report => report.status === filter);
    
    if (filteredReports.length === 0) {
        const emptyMessage = filter === 'all' 
            ? (config.messages.noReports || 'No reports yet. Be the first to help keep our planet clean!')
            : (config.messages.noReportsFiltered || 'No reports found. Try selecting a different filter.');
        reportsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🌿</div>
                <p>${emptyMessage}</p>
            </div>
        `;
        return;
    }
    
    reportsList.innerHTML = filteredReports.map(report => createReportCard(report)).join('');
    
    // Add status update buttons for demo purposes
    addStatusUpdateButtons();
}

function createReportCard(report) {
    const statusLabels = config.status.labels || {
        'reported': 'Reported',
        'in-progress': 'In Progress',
        'resolved': 'Resolved'
    };
    
    const statusIcons = config.status.icons || {
        'reported': '⚠️',
        'in-progress': '🔄',
        'resolved': '✅'
    };
    
    const date = new Date(report.date);
    const dateFormat = config.dateFormat || { locale: 'en-US', options: {} };
    const formattedDate = date.toLocaleDateString(dateFormat.locale, dateFormat.options);
    
    const zoom = config.map.mapZoom || 18;
    const mapUrl = `${config.map.openstreetmapBaseUrl}/?mlat=${report.latitude}&mlon=${report.longitude}&zoom=${zoom}`;
    
    return `
        <div class="report-card status-${report.status}" data-id="${report.id}">
            <img src="${report.image}" alt="Garbage location" class="report-image">
            <div class="report-details">
                <div class="report-status ${report.status}">
                    <span>${statusIcons[report.status]}</span>
                    <span>${statusLabels[report.status]}</span>
                </div>
                <p class="report-description">${escapeHtml(report.description)}</p>
                <div class="report-location">
                    <span>📍</span>
                    <span>${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}</span>
                </div>
                <div class="map-actions">
                    <a href="${mapUrl}" target="_blank" class="map-link">
                        <span>🗺️</span>
                        <span>View on Map</span>
                        <span>↗</span>
                    </a>
                    <button onclick="getRouteToLocation(${report.latitude}, ${report.longitude})" class="btn btn-primary" style="font-size: 0.9rem; padding: 0.5rem 1rem;">
                        <span>🧭</span>
                        Get Route
                    </button>
                </div>
                <div class="report-date">Reported on ${formattedDate}</div>
                <div class="status-controls" style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${report.status !== 'reported' ? `<button class="btn btn-primary" onclick="updateStatus('${report.id}', 'reported')" style="font-size: 0.8rem; padding: 0.5rem 1rem;">Set to Reported</button>` : ''}
                    ${report.status !== 'in-progress' ? `<button class="btn btn-primary" onclick="updateStatus('${report.id}', 'in-progress')" style="font-size: 0.8rem; padding: 0.5rem 1rem;">Set to In Progress</button>` : ''}
                    ${report.status !== 'resolved' ? `<button class="btn btn-primary" onclick="updateStatus('${report.id}', 'resolved')" style="font-size: 0.8rem; padding: 0.5rem 1rem;">Set to Resolved</button>` : ''}
                    <button class="btn" onclick="deleteReport('${report.id}')" style="font-size: 0.8rem; padding: 0.5rem 1rem; background: var(--danger-color); color: white; border: none;">
                        <span>🗑️</span>
                        Delete
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Status Update
function updateStatus(reportId, newStatus) {
    const report = reports.find(r => r.id === reportId);
    if (report) {
        report.status = newStatus;
        localStorage.setItem(config.storage.reportsKey, JSON.stringify(reports));
        
        // Get current filter
        const activeFilter = document.querySelector('.filter-btn.active').dataset.status;
        renderReports(activeFilter);
        updateStats();
    }
}

// Delete Report
function deleteReport(reportId) {
    if (confirm(config.messages.confirmDelete || 'Are you sure you want to delete this report? This action cannot be undone.')) {
        reports = reports.filter(r => r.id !== reportId);
        localStorage.setItem(config.storage.reportsKey, JSON.stringify(reports));
        
        // Get current filter
        const activeFilter = document.querySelector('.filter-btn.active').dataset.status;
        renderReports(activeFilter);
        updateStats();
    }
}

// Filter Functions
function handleFilterClick(btn) {
    filterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.status;
    renderReports(filter);
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Routing Functions
function getRouteToLocation(destLat, destLon) {
    if (!userLocation) {
        // If user location not available, prompt to get it first
        if (confirm(config.messages.locationNeeded || 'Your location is needed for routing. Get your location now?')) {
            getCurrentLocation(() => {
                // After getting location, open route
                openRoute(destLat, destLon);
            });
        }
        return;
    }
    openRoute(destLat, destLon);
}

function openRoute(destLat, destLon) {
    if (!userLocation) {
        alert(config.messages.getLocationFirst || 'Please get your location first to view routes.');
        return;
    }
    
    // Use Google Maps for routing (most reliable and widely used)
    // Format: https://www.google.com/maps/dir/START_LAT,START_LON/END_LAT,END_LON
    const googleMapsUrl = `${config.map.googleMapsBaseUrl}/dir/${userLocation.lat},${userLocation.lon}/${destLat},${destLon}`;
    
    // Alternative: GraphHopper (open source routing)
    const graphhopperUrl = `${config.map.graphhopperUrl}/?point=${userLocation.lat},${userLocation.lon}&point=${destLat},${destLon}`;
    
    // Open Google Maps route (most users are familiar with it)
    window.open(googleMapsUrl, '_blank');
}

// Make functions globally available for inline handlers
window.removeImage = removeImage;
window.updateStatus = updateStatus;
window.getRouteToLocation = getRouteToLocation;
window.deleteReport = deleteReport;

