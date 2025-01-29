// Constants - using var for global scope
var TOKEN_STORAGE_PREFIX = 'bookmarks_token_';
var STORAGE_KEY = 'urls';
var TOKEN_KEY = 'sync_token';
var SYNC_INTERVAL = 30000; // 30 seconds
const STORAGE_VALIDATION_INTERVAL = 300000; // 5 minutes

// Add this at the beginning of the file, after the constants
const isPuppeteerTest = navigator.userAgent.includes('HeadlessChrome');

// Add this at the top of script.js after the constants
let pusherInitialized = false;
let initializationPromise = null;

// Add this after the constants section
const PERFORMANCE_METRICS = {
    syncStart: 0,
    uploadSpeed: 0,
    downloadSpeed: 0,
    deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    errors: []
};

// Add this after the constants section
const SYNC_STATES = {
    IDLE: 'idle',
    STARTING: 'starting',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    ERROR: 'error',
    RETRYING: 'retrying'
};

// Initialize storage when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Check if guide should be hidden
    const hideGuideStatus = localStorage.getItem('hideGuide');
    const guide = document.querySelector('.quick-start-guide');
    if (hideGuideStatus === 'true' && guide) {
        guide.style.display = 'none';
    }
    
    if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
    
    // Check for existing token and initialize
    const existingToken = localStorage.getItem(TOKEN_KEY);
    if (existingToken) {
        const tokenInput = document.getElementById('token-input');
        if (tokenInput) {
            tokenInput.value = existingToken;
            syncWithToken();
        }
    }
    
    loadURLs();
    document.getElementById('search-input')?.addEventListener('input', searchLinks);

    const cookieConsent = localStorage.getItem('cookieConsent');
    if (!cookieConsent) {
        showCookieConsent();
    }

    // Add refresh button next to token input
    const tokenContainer = document.querySelector('.token-container');
    if (tokenContainer) {
        const refreshButton = document.createElement('button');
        refreshButton.className = 'button refresh-token-btn';
        refreshButton.innerHTML = '🔄 Refresh';
        refreshButton.onclick = refreshCurrentToken;
        tokenContainer.appendChild(refreshButton);
    }

    // Replace window.addEventListener('storage', handleStorageChange) with:
    window.addEventListener('pagehide', function(event) {
        const currentToken = localStorage.getItem(TOKEN_KEY);
        if (currentToken) {
            syncChanges(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
        }
    });

    document.getElementById('token-input')?.addEventListener('change', async function() {
        const token = this.value;
        if (token) {
            await syncWithToken();
        }
    });
});

// Modify initializePusher function
async function initializePusher() {
    if (isPuppeteerTest) {
        window.pusher = {
            subscribe: () => ({
                bind: () => {}
            })
        };
        pusherInitialized = true;
        return;
    }

    // If already initializing, wait for that promise
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = new Promise(async (resolve, reject) => {
        try {
            const response = await fetch('/.netlify/functions/get-pusher-config');
            const config = await response.json();
            
            if (!config.key || !config.cluster) {
                throw new Error('Invalid Pusher configuration');
            }
            
            window.pusher = new Pusher(config.key, {
                cluster: config.cluster,
                encrypted: true
            });
            
            pusherInitialized = true;
            showNotification('Sync service initialized', 'success');
            resolve();
        } catch (error) {
            console.error('Pusher initialization failed:', error);
            showNotification('Failed to initialize sync service', 'error');
            reject(error);
        }
    });

    return initializationPromise;
}

async function setupSyncForToken(token) {
    try {
        if (!pusherInitialized) {
            await initializePusher();
        }
        
        // Unsubscribe from existing channel if any
        if (window.currentChannel) {
            window.pusher.unsubscribe(window.currentChannel);
        }
        
        const channelName = `sync-channel-${token}`;
        window.currentChannel = channelName;
        
        const channel = window.pusher.subscribe(channelName);
        
        channel.bind('sync-update', function(data) {
            if (data.source !== getDeviceId()) {
                handleSyncUpdate(data);
            }
        });

        // Perform initial data fetch
        const existingData = localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${token}`);
        if (existingData) {
            localStorage.setItem(STORAGE_KEY, existingData);
            loadURLs();
        }
        
        showNotification('Sync connection established', 'success');
    } catch (error) {
        console.error('Setup sync error:', error);
        showNotification('Failed to setup sync', 'error');
        throw error;
    }
}

// Generate unique device ID
function getDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        deviceId = 'device_' + Date.now();
        localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
}

// Add safe JSON parsing helper
function safeJSONParse(data, defaultValue = []) {
    if (!data) return defaultValue;
    try {
        return JSON.parse(data);
    } catch (error) {
        console.error('JSON Parse error:', error);
        return defaultValue;
    }
}

// Add the missing updateBookmarksList function
function updateBookmarksList(bookmarks) {
    const bookmarksList = document.getElementById('bookmarks-list');
    if (!bookmarksList) return;
    
    bookmarksList.innerHTML = '';
    
    if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
        bookmarksList.innerHTML = '<p>No bookmarks yet</p>';
        return;
    }

    bookmarks.forEach(bookmark => {
        if (!bookmark || !bookmark.url) return;
        
        const bookmarkElement = document.createElement('div');
        bookmarkElement.className = 'bookmark-item';
        
        const favicon = `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}`;
        
        bookmarkElement.innerHTML = `
            <img src="${favicon}" alt="favicon" class="favicon">
            <a href="${bookmark.url}" target="_blank">${bookmark.url}</a>
            <span class="category">${bookmark.category || 'Uncategorized'}</span>
            <span class="hashtags">${bookmark.hashtags ? bookmark.hashtags.join(', ') : ''}</span>
            <button onclick="togglePin('${bookmark.url}')" class="pin-button">
                ${bookmark.pinned ? '📌' : '📍'}
            </button>
            <button onclick="deleteURL('${bookmark.url}')" class="delete-button">🗑️</button>
        `;
        
        bookmarksList.appendChild(bookmarkElement);
    });
}

// Modify addURL function
function addURL() {
    const urlInput = document.getElementById('url-input');
    const categoryInput = document.getElementById('category-input');
    const hashtagsInput = document.getElementById('hashtags-input');
    
    if (!urlInput || !urlInput.value) {
        showNotification('Please enter a URL', 'error');
        return;
    }

    try {
        // Validate URL
        new URL(urlInput.value);
        
        // Get existing URLs and ensure it's an array
        let urls = [];
        try {
            const storedUrls = localStorage.getItem(STORAGE_KEY);
            urls = storedUrls ? JSON.parse(storedUrls) : [];
            if (!Array.isArray(urls)) urls = [];
        } catch (e) {
            urls = [];
        }
        
        const newUrl = {
            url: urlInput.value,
            category: categoryInput.value || 'Uncategorized',
            hashtags: hashtagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag),
            pinned: false,
            dateAdded: new Date().toISOString()
        };
        
        urls.push(newUrl);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
        
        // Clear inputs
        urlInput.value = '';
        categoryInput.value = '';
        hashtagsInput.value = '';
        
        // Update display
        displayURLs(urls);
        updatePinnedLinks(urls);
        
        showNotification('URL added successfully', 'success');
        
        // Sync if enabled
        syncChanges(urls);
    } catch (error) {
        console.error('Add URL error:', error);
        showNotification('Error: Invalid URL format', 'error');
    }
}

// Sync changes to other devices
async function syncChanges(token, bookmarks) {
    updateSyncProgress(0, 'Starting sync...', SYNC_STATES.STARTING);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        updateSyncProgress(20, 'Preparing data...');
        
        // Get device identifier
        const deviceId = getDeviceId();
        
        const response = await fetch('/.netlify/functions/sync-bookmarks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                token: token,
                bookmarks: bookmarks,
                source: deviceId,
                timestamp: Date.now(),
                broadcast: true  // Add this flag to ensure all devices receive the update
            }),
            signal: controller.signal
        });

        updateSyncProgress(50, 'Sending data...');
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        updateSyncProgress(80, 'Verifying sync...');
        
        if (!data || data.error) {
            throw new Error(data?.error || 'Invalid response from server');
        }

        // Update local storage
        localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${token}`, JSON.stringify(bookmarks));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
        
        // Update UI
        loadURLs();
        updatePinnedLinks(bookmarks);
        
        updateSyncProgress(100, 'Sync successful!', SYNC_STATES.COMPLETED);
        
        return data;
    } catch (error) {
        handleSyncError(error, token, bookmarks);
        throw error;
    }
}

// Add this helper function for error handling
function handleSyncError(error, token, bookmarks) {
    if (error.name === 'AbortError') {
        updateSyncProgress(100, 'Sync timeout', SYNC_STATES.ERROR);
    } else if (!navigator.onLine) {
        updateSyncProgress(100, 'No internet connection', SYNC_STATES.ERROR);
        window.addEventListener('online', () => {
            updateSyncProgress(0, 'Retrying sync...', SYNC_STATES.RETRYING);
            syncChanges(token, bookmarks);
        }, { once: true });
    } else {
        updateSyncProgress(100, 'Sync failed', SYNC_STATES.ERROR);
    }
}

// Modify the handleSyncUpdate function
function handleSyncUpdate(data) {
    try {
        if (!data || !data.bookmarks) return;
        
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return;

        // Merge existing and new bookmarks to prevent duplicates
        const existingBookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const newBookmarks = data.bookmarks;
        
        // Create a map of URLs to detect duplicates
        const urlMap = new Map();
        
        // Add existing bookmarks to map (keeping the most recent version)
        existingBookmarks.forEach(bookmark => {
            if (bookmark && bookmark.url) {
                urlMap.set(bookmark.url, bookmark);
            }
        });
        
        // Update or add new bookmarks
        newBookmarks.forEach(bookmark => {
            if (bookmark && bookmark.url) {
                const existing = urlMap.get(bookmark.url);
                if (!existing || new Date(bookmark.dateAdded) > new Date(existing.dateAdded)) {
                    urlMap.set(bookmark.url, bookmark);
                }
            }
        });
        
        // Convert map back to array
        const mergedBookmarks = Array.from(urlMap.values());
        
        // Sort by date added (newest first)
        mergedBookmarks.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
        
        // Update both storages
        const bookmarksString = JSON.stringify(mergedBookmarks);
        localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${token}`, bookmarksString);
        localStorage.setItem(STORAGE_KEY, bookmarksString);
        
        // Update UI
        displayURLs(mergedBookmarks);
        updatePinnedLinks(mergedBookmarks);
        
        showNotification('Synced with other devices', 'success');
        updateSyncProgress(100, 'Sync completed', SYNC_STATES.COMPLETED);
    } catch (error) {
        console.error('Sync update error:', error);
        showNotification('Failed to sync with other devices', 'error');
        updateSyncProgress(100, 'Sync failed', SYNC_STATES.ERROR);
    }
}

// Modified togglePin function to include sync
function togglePin(url) {
    const urls = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const urlIndex = urls.findIndex(item => item.url === url);
    
    if (urlIndex !== -1) {
        urls[urlIndex].pinned = !urls[urlIndex].pinned;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
        
        // Sync changes
        syncChanges(urls);
        
        // Update UI
        loadURLs();
        updatePinnedLinks(urls);
    }
}

// Load bookmarks with sync check
function loadBookmarks() {
    const bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return bookmarks;
}

// Update UI elements
function updateUI() {
    const bookmarks = loadBookmarks();
    updatePinnedLinks(bookmarks);
    updateBookmarksList(bookmarks);
}

// Modify loadURLs function for immediate loading
function loadURLs() {
    try {
        // Get data from storage with default empty array
        const urls = localStorage.getItem(STORAGE_KEY) || '[]';
        const parsedUrls = JSON.parse(urls);
        
        // Ensure we have an array
        if (!Array.isArray(parsedUrls)) {
            localStorage.setItem(STORAGE_KEY, '[]');
            displayURLs([]);
            updatePinnedLinks([]);
            return;
        }
        
        // Update both displays
        displayURLs(parsedUrls);
        updatePinnedLinks(parsedUrls);
        
    } catch (error) {
        console.error('Load URLs error:', error);
        // Set default empty array on error
        localStorage.setItem(STORAGE_KEY, '[]');
        displayURLs([]); 
        updatePinnedLinks([]);
    }
}

function displayURLs(urls) {
    const urlsContainer = document.getElementById('urls-container');
    if (!urlsContainer) return;
    
    // Clear existing content
    urlsContainer.innerHTML = '';
    
    // Ensure urls is an array and filter out any invalid entries
    const urlsArray = Array.isArray(urls) ? urls.filter(url => url && url.url) : [];
    
    if (urlsArray.length === 0) {
        urlsContainer.innerHTML = '<div class="empty-state">No URLs found</div>';
        return;
    }

    // Sort URLs by date added (newest first)
    urlsArray.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));

    // Remove duplicates based on URL
    const uniqueUrls = urlsArray.reduce((acc, current) => {
        const exists = acc.find(item => item.url === current.url);
        if (!exists) {
            acc.push(current);
        }
        return acc;
    }, []);

    uniqueUrls.forEach(url => {
        const card = createURLElement(url);
        if (card) urlsContainer.appendChild(card);
    });
}

function createURLElement(urlData) {
    const div = document.createElement('div');
    div.className = 'url-card';
    
    try {
        const url = new URL(urlData.url);
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}`;
        
        const hashtags = Array.isArray(urlData.hashtags) 
            ? urlData.hashtags 
            : urlData.hashtags.split(',').map(tag => tag.trim());
        
        const hashtagsHtml = hashtags
            .filter(tag => tag)
            .map(tag => `<span class="hashtag">#${tag}</span>`)
            .join('');
        
        div.innerHTML = `
            <div class="url-title">
                <img src="${faviconUrl}" class="favicon" alt="favicon">
                <a href="${urlData.url}" target="_blank">${url.hostname}</a>
                <div class="url-actions">
                    <button class="pin-button" onclick="togglePin('${urlData.url}')">
                        ${urlData.pinned ? '📌' : '📍'}
                    </button>
                    <button class="delete-button" onclick="deleteURL('${urlData.url}')">
                        🗑️
                    </button>
                </div>
            </div>
            ${urlData.category ? `<div class="category">${urlData.category}</div>` : ''}
            <div class="hashtags">
                ${hashtagsHtml}
            </div>
        `;
    } catch (e) {
        console.error('Error creating URL element:', e);
    }
    
    return div;
}

function updatePinnedLinks(urls) {
    const pinnedContainer = document.getElementById('pinned-links');
    if (!pinnedContainer) {
        console.error('Pinned links container not found!');
        return;
    }
    
    pinnedContainer.innerHTML = '';
    
    // Ensure urls is an array
    const urlsArray = Array.isArray(urls) ? urls : [];
    const pinnedUrls = urlsArray.filter(url => url && url.pinned);
    
    if (pinnedUrls.length === 0) {
        pinnedContainer.innerHTML = '<div class="no-pins">No pinned links yet</div>';
        return;
    }

    pinnedUrls.forEach(url => {
        try {
            const link = document.createElement('div');
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url.url).hostname}`;
            
            link.innerHTML = `
                <a href="${url.url}" target="_blank">
                    <img src="${faviconUrl}" class="favicon" alt="favicon">
                    ${new URL(url.url).hostname}
                </a>
            `;
            link.className = 'pinned-link';
            pinnedContainer.appendChild(link);
        } catch (error) {
            console.error('Error creating pinned link:', error);
        }
    });
}

function searchLinks() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    
    if (!searchTerm) {
        // If search is empty, show all bookmarks
        displayURLs(bookmarks);
        return;
    }
    
    const filtered = bookmarks.filter(bookmark => 
        bookmark.url.toLowerCase().includes(searchTerm) ||
        (bookmark.hashtags && bookmark.hashtags.some(tag => tag.toLowerCase().includes(searchTerm))) ||
        (bookmark.category && bookmark.category.toLowerCase().includes(searchTerm))
    );
    
    displayURLs(filtered);
}

// Add export/import functionality
function exportToExcel() {
    const bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const blob = new Blob([JSON.stringify(bookmarks)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookmarks.json';
    a.click();
}

function importFromExcel(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const bookmarks = JSON.parse(e.target.result);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
            loadURLs();
        } catch (error) {
            alert('Invalid file format');
        }
    };
    
    reader.readAsText(file);
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Handle both string messages and URL data objects
    if (typeof message === 'string') {
        notification.textContent = message;
    } else {
        try {
            const urlObj = new URL(message.url);
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}`;
            
            notification.innerHTML = `
                <img src="${faviconUrl}" class="favicon" alt="favicon">
                You bookmarked <strong>${urlObj.hostname}</strong>
                ${message.category ? `in ${message.category}` : ''}
            `;
        } catch (e) {
            // Fallback for invalid URLs or error messages
            notification.textContent = message.category || message.url;
        }
    }
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Helper function to get/generate user ID
function getCurrentUserId() {
    return localStorage.getItem('userId') || 
           Math.random().toString(36).substring(2, 15);
}

function getCurrentUserName() {
    return localStorage.getItem('userName') || 'Anonymous';
}

// Modify deleteURL function
function deleteURL(url) {
    try {
        const urls = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        const updatedUrls = urls.filter(item => item.url !== url);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUrls));
        
        loadURLs();
        updatePinnedLinks(updatedUrls);
        showNotification('URL has been deleted successfully', 'success');
        
        // Move sync after notification
        syncChanges(updatedUrls);
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Error: Failed to delete URL', 'error');
    }
}

// Modified sync function to use local storage only (removing Excel sync)
async function syncWithExcel() {
    try {
        const bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        
        // Instead of syncing with Excel, we'll just ensure local storage is up to date
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
        
        // Update UI
        loadURLs();
        updatePinnedLinks(bookmarks);
        
        // Show success notification
        showNotification('Bookmarks synchronized successfully', 'success');
        
    } catch (error) {
        console.error('Sync error:', error);
        showNotification('Failed to sync bookmarks', 'error');
    }
}

// Start sync interval
setInterval(syncWithExcel, SYNC_INTERVAL);

// Sync immediately when page loads
document.addEventListener('DOMContentLoaded', syncWithExcel);

// Add this new function
function copyToken() {
    const tokenInput = document.getElementById('token-input');
    tokenInput.select();
    document.execCommand('copy');
    
    // Show notification
    showNotification('Token copied to clipboard!', 'success');
}

// Add this function to handle token switching
async function switchToToken(token) {
    try {
        // Save current token's data if exists
        const currentToken = localStorage.getItem(TOKEN_KEY);
        if (currentToken) {
            const currentData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${currentToken}`, JSON.stringify(currentData));
        }

        // Load new token's data
        const tokenData = localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${token}`);
        if (tokenData) {
            localStorage.setItem(STORAGE_KEY, tokenData);
        } else {
            // Initialize new token storage if no data exists
            localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${token}`, JSON.stringify([]));
            localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        }

        // Update current token
        localStorage.setItem(TOKEN_KEY, token);
        
        // Setup sync and update UI
        await setupSyncForToken(token);
        loadURLs();
        
        showNotification('Switched to token: ' + token, 'success');
    } catch (error) {
        console.error('Token switch error:', error);
        showNotification('Failed to switch token', 'error');
    }
}

// Modify generateToken function
function generateToken() {
    const newToken = 'token_' + Date.now();
    const tokenInput = document.getElementById('token-input');
    if (tokenInput) {
        tokenInput.value = newToken;
    }
    
    switchToToken(newToken);
    showNotification('New sync token generated!', 'success');
}

// Modify saveAndSetupToken function
async function saveAndSetupToken(token) {
    await switchToToken(token);
}

// Add this helper function to check if Pusher is properly initialized
function isPusherInitialized() {
    return window.pusher && typeof window.pusher.subscribe === 'function';
}

// Update syncTokenStorage function
function syncTokenStorage(token) {
    try {
        // Get existing token data from both storages
        const browserTokenData = localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${token}`);
        const cookieTokenData = getCookie(`${TOKEN_STORAGE_PREFIX}${token}`);
        
        // Safely parse data with defaults
        const browserBookmarks = safeJSONParse(browserTokenData, []);
        const cookieBookmarks = safeJSONParse(cookieTokenData, []);
        
        // Ensure both are arrays before merging
        const mergedBookmarks = Array.isArray(browserBookmarks) && Array.isArray(cookieBookmarks) 
            ? mergeBookmarks(browserBookmarks, cookieBookmarks)
            : [];
        
        // Save merged data to both storages
        const tokenData = JSON.stringify(mergedBookmarks);
        localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${token}`, tokenData);
        setCookie(`${TOKEN_STORAGE_PREFIX}${token}`, tokenData);
        
        return mergedBookmarks;
    } catch (error) {
        console.error('Sync token storage error:', error);
        return [];
    }
}

// Update mergeBookmarks function
function mergeBookmarks(bookmarks1, bookmarks2) {
    try {
        // Ensure inputs are arrays
        const array1 = Array.isArray(bookmarks1) ? bookmarks1 : [];
        const array2 = Array.isArray(bookmarks2) ? bookmarks2 : [];
        
        // Create a map of existing URLs
        const urlMap = new Map();
        
        array1.forEach(bookmark => {
            if (bookmark && bookmark.url) {
                urlMap.set(bookmark.url, bookmark);
            }
        });
        
        array2.forEach(bookmark => {
            if (bookmark && bookmark.url) {
                urlMap.set(bookmark.url, bookmark);
            }
        });
        
        return Array.from(urlMap.values());
    } catch (error) {
        console.error('Merge bookmarks error:', error);
        return [];
    }
}

// Replace the existing syncWithToken function
async function syncWithToken() {
    const inputToken = document.getElementById('token-input').value;
    if (!inputToken) {
        showNotification('Please enter a sync token', 'error');
        return;
    }

    try {
        // Save token
        localStorage.setItem(TOKEN_KEY, inputToken);
        
        // Setup sync for the token
        await setupSyncForToken(inputToken);
        
        // Get existing data
        const currentData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        
        // Perform initial sync
        await syncChanges(inputToken, currentData);
        
        showNotification('Sync setup successful', 'success');
    } catch (error) {
        console.error('Sync setup error:', error);
        showNotification('Failed to setup sync', 'error');
    }
}

async function fetchAndMergeData(token) {
    const sources = [];
    
    // Get data from localStorage
    const localData = localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${token}`);
    if (localData) sources.push(JSON.parse(localData));
    
    // Get data from cookies
    const cookieData = getCookie(`${TOKEN_STORAGE_PREFIX}${token}`);
    if (cookieData) sources.push(JSON.parse(decodeURIComponent(cookieData)));
    
    // Get data from current storage
    const currentData = localStorage.getItem(STORAGE_KEY);
    if (currentData) sources.push(JSON.parse(currentData));
    
    // Merge all sources
    let mergedData = [];
    const urlMap = new Map();
    
    sources.forEach(source => {
        if (Array.isArray(source)) {
            source.forEach(bookmark => {
                if (bookmark && bookmark.url) {
                    // Keep the most recent version of each URL
                    const existing = urlMap.get(bookmark.url);
                    if (!existing || new Date(bookmark.dateAdded) > new Date(existing.dateAdded)) {
                        urlMap.set(bookmark.url, bookmark);
                    }
                }
            });
        }
    });
    
    mergedData = Array.from(urlMap.values());
    
    // Trigger sync to other devices
    try {
        await fetch('/.netlify/functions/sync-bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: getDeviceId(),
                token: token,
                bookmarks: mergedData
            })
        });
    } catch (error) {
        console.error('Sync to server failed:', error);
    }
    
    return mergedData;
}

// Add this function to hide the guide
function hideGuide() {
    const guide = document.querySelector('.quick-start-guide');
    if (guide) {
        guide.style.display = 'none';
        localStorage.setItem('hideGuide', 'true');
    }
}

// Add cookie consent functions
function showCookieConsent() {
    const consentDiv = document.createElement('div');
    consentDiv.className = 'cookie-consent';
    consentDiv.innerHTML = `
        <div class="cookie-content">
            <p>We use cookies to enhance your experience and enable sync features.</p>
            <div class="cookie-buttons">
                <button class="accept-button" onclick="acceptCookies()">Accept</button>
                <button class="decline-button" onclick="declineCookies()">Decline</button>
            </div>
        </div>
    `;
    document.body.appendChild(consentDiv);
}

function acceptCookies() {
    localStorage.setItem('cookieConsent', 'accepted');
    document.querySelector('.cookie-consent').remove();
}

function declineCookies() {
    localStorage.setItem('cookieConsent', 'declined');
    document.querySelector('.cookie-consent').remove();
}

// Add these helper functions for cookie management
function setCookie(name, value) {
    if (localStorage.getItem('cookieConsent') === 'accepted') {
        const date = new Date();
        date.setTime(date.getTime() + (365 * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
    }
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop().split(';').shift();
    }
    return null;
}

// Add this helper function for unified storage handling
function unifiedStorageHandler(token, data) {
    const tokenKey = `${TOKEN_STORAGE_PREFIX}${token}`;
    const dataString = JSON.stringify(data);
    
    // Browser Storage
    try {
        localStorage.setItem(STORAGE_KEY, dataString);
        localStorage.setItem(tokenKey, dataString);
    } catch (e) {
        console.error('LocalStorage error:', e);
    }
    
    // Cookie Storage
    try {
        document.cookie = `${STORAGE_KEY}=${encodeURIComponent(dataString)};path=/;max-age=31536000`;
        document.cookie = `${tokenKey}=${encodeURIComponent(dataString)};path=/;max-age=31536000`;
    } catch (e) {
        console.error('Cookie storage error:', e);
    }
}

// Add this function to handle sync conflicts
function resolveStorageConflicts(token) {
    const localData = localStorage.getItem(STORAGE_KEY);
    const cookieData = getCookie(STORAGE_KEY);
    const tokenLocalData = localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${token}`);
    const tokenCookieData = getCookie(`${TOKEN_STORAGE_PREFIX}${token}`);
    
    // Parse all data sources with timestamps
    const dataSources = [
        { source: 'local', data: safeJSONParse(localData), timestamp: localStorage.getItem('last_sync_local') },
        { source: 'cookie', data: safeJSONParse(cookieData), timestamp: getCookie('last_sync_cookie') },
        { source: 'tokenLocal', data: safeJSONParse(tokenLocalData), timestamp: localStorage.getItem(`last_sync_${token}`) },
        { source: 'tokenCookie', data: safeJSONParse(tokenCookieData), timestamp: getCookie(`last_sync_${token}`) }
    ].filter(source => source.data && source.timestamp);
    
    // Get most recent data
    const mostRecent = dataSources.reduce((prev, current) => {
        return (current.timestamp > prev.timestamp) ? current : prev;
    });
    
    return mostRecent.data;
}

// Add version control to sync data
function versionedSync(token, data) {
    const version = parseInt(localStorage.getItem(`${token}_version`) || '0') + 1;
    const syncData = {
        version: version,
        timestamp: Date.now(),
        data: data,
        deviceId: getDeviceId()
    };
    
    localStorage.setItem(`${token}_version`, version.toString());
    return unifiedStorageHandler(token, syncData);
}

function validateStorage(token) {
    const healthCheck = {
        localStorage: {
            available: false,
            size: 0,
            quota: 0
        },
        cookieStorage: {
            available: false,
            enabled: false
        }
    };
    
    try {
        // Test localStorage
        const testKey = `test_${Date.now()}`;
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        healthCheck.localStorage.available = true;
        
        // Estimate storage usage
        healthCheck.localStorage.size = new Blob(
            Object.keys(localStorage).map(key => localStorage[key])
        ).size;
        
        // Check cookies
        healthCheck.cookieStorage.enabled = navigator.cookieEnabled;
        healthCheck.cookieStorage.available = document.cookie !== '';
        
        return healthCheck;
    } catch (error) {
        console.error('Storage health check failed:', error);
        return healthCheck;
    }
}

const syncQueue = {
    queue: [],
    processing: false,
    
    add: function(syncOperation) {
        this.queue.push(syncOperation);
        if (!this.processing) {
            this.process();
        }
    },
    
    process: async function() {
        if (this.queue.length === 0) {
            this.processing = false;
            return;
        }
        
        this.processing = true;
        const operation = this.queue.shift();
        
        try {
            await operation();
        } catch (error) {
            console.error('Sync operation failed:', error);
            // Retry failed operations
            if (operation.retries < 3) {
                operation.retries = (operation.retries || 0) + 1;
                this.queue.unshift(operation);
            }
        }
        
        this.process();
    }
};

function validateStorageHealth() {
    const currentToken = localStorage.getItem(TOKEN_KEY) || getCookie(TOKEN_KEY);
    const health = validateStorage(currentToken);
    
    if (!health.localStorage.available) {
        showNotification('Local storage is not available', 'error');
    }
}

// Set up the interval
setInterval(validateStorageHealth, STORAGE_VALIDATION_INTERVAL);

function handleStorageChange(event) {
    if (!event.key || !event.newValue) return;
    
    const currentToken = localStorage.getItem(TOKEN_KEY) || getCookie(TOKEN_KEY);
    if (!currentToken) return;
    
    if (event.key === STORAGE_KEY || event.key === `${TOKEN_STORAGE_PREFIX}${currentToken}`) {
        try {
            const newData = JSON.parse(event.newValue);
            unifiedStorageHandler(currentToken, newData);
            loadURLs();
            updatePinnedLinks(newData);
        } catch (error) {
            console.error('Storage sync error:', error);
        }
    }
}

async function trackSyncPerformance(token, operation) {
    const metrics = {
        timestamp: Date.now(),
        device: PERFORMANCE_METRICS.deviceType,
        operation: operation,
        duration: 0,
        dataSize: 0,
        success: false
    };

    try {
        const startTime = performance.now();
        const bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const dataSize = new Blob([JSON.stringify(bookmarks)]).size;
        
        // Perform sync operation
        await syncChanges(token, bookmarks);
        
        const endTime = performance.now();
        metrics.duration = endTime - startTime;
        metrics.dataSize = dataSize;
        metrics.success = true;
        
        // Calculate speed in KB/s
        metrics.speed = (dataSize / 1024) / (metrics.duration / 1000);
        
        console.log(`Sync Performance (${operation}):`, {
            device: metrics.device,
            duration: `${metrics.duration.toFixed(2)}ms`,
            speed: `${metrics.speed.toFixed(2)} KB/s`,
            dataSize: `${(dataSize / 1024).toFixed(2)} KB`
        });

        showNotification(`Sync completed in ${metrics.duration.toFixed(0)}ms`, 'success');
        return metrics;

    } catch (error) {
        metrics.error = error.message;
        console.error('Sync Performance Error:', error);
        showNotification(`Sync failed: ${error.message}`, 'error');
        throw error;
    }
}

async function addURLAndSync() {
    try {
        const urlInput = document.getElementById('url-input');
        const categoryInput = document.getElementById('category-input');
        const hashtagsInput = document.getElementById('hashtags-input');
        
        if (!urlInput || !urlInput.value) {
            showNotification('Please enter a URL', 'error');
            return;
        }

        // Validate URL
        new URL(urlInput.value);
        
        const newUrl = {
            url: urlInput.value,
            category: categoryInput.value || 'Uncategorized',
            hashtags: hashtagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag),
            pinned: false,
            dateAdded: new Date().toISOString()
        };
        
        // Get existing URLs with default empty array
        const storedUrls = localStorage.getItem(STORAGE_KEY) || '[]';
        let urls = JSON.parse(storedUrls);
        if (!Array.isArray(urls)) urls = [];
        
        urls.push(newUrl);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
        
        // Clear inputs
        urlInput.value = '';
        categoryInput.value = '';
        hashtagsInput.value = '';
        
        // Update displays
        displayURLs(urls);
        updatePinnedLinks(urls);
        
        // Perform sync
        const currentToken = localStorage.getItem(TOKEN_KEY);
        if (currentToken) {
            await syncChanges(currentToken, urls);
            showNotification('URL added and synced successfully!', 'success');
        } else {
            showNotification('URL added successfully! (No sync token set)', 'info');
        }
        
    } catch (error) {
        console.error('Add and sync error:', error);
        showNotification('Error: Failed to add or sync URL', 'error');
    }
}

function updateSyncProgress(progress, status, state = SYNC_STATES.IN_PROGRESS) {
    const progressBar = document.getElementById('sync-progress-bar');
    const statusElement = document.getElementById('sync-status');
    
    if (progressBar && statusElement) {
        progressBar.style.width = `${progress}%`;
        progressBar.className = 'sync-progress-bar' + (state === SYNC_STATES.ERROR ? ' error' : '');
        
        let statusText = status;
        if (state === SYNC_STATES.RETRYING) {
            statusText += ' (Retrying...)';
        }
        
        statusElement.textContent = statusText;
        
        // Reset progress bar after completion or error
        if (state === SYNC_STATES.COMPLETED || state === SYNC_STATES.ERROR) {
            setTimeout(() => {
                progressBar.style.width = '0%';
                if (state === SYNC_STATES.COMPLETED) {
                    statusElement.textContent = 'Sync completed';
                }
            }, 3000);
        }
    }
}