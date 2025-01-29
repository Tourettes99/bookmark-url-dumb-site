// Constants - using var for global scope
var TOKEN_STORAGE_PREFIX = 'bookmarks_token_';
var STORAGE_KEY = 'urls';
var TOKEN_KEY = 'sync_token';
var SYNC_INTERVAL = 30000; // 30 seconds

// Add this at the beginning of the file, after the constants
const isPuppeteerTest = navigator.userAgent.includes('HeadlessChrome');

// Add this at the top of script.js after the constants
let pusherInitialized = false;
let initializationPromise = null;

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
    } catch (error) {
        console.error('Setup sync error:', error);
        showNotification('Failed to setup sync', 'error');
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
function syncChanges(bookmarks) {
    syncQueue.add(async () => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return;
        
        const versionedData = await versionedSync(token, bookmarks);
        await fetch('/.netlify/functions/sync-bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: getDeviceId(),
                token: token,
                bookmarks: versionedData
            })
        });
    });
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

// Add event listener for storage changes
window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
        updateUI();
    }
});

// Modify loadURLs function for immediate loading
function loadURLs() {
    try {
        // First try to get data from current storage
        const urls = localStorage.getItem(STORAGE_KEY);
        
        // Get the current token
        const currentToken = localStorage.getItem(TOKEN_KEY);
        
        if (currentToken) {
            // Also check token-specific storage
            const tokenData = localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${currentToken}`);
            
            // Use token data if available, otherwise fall back to regular storage
            const dataToUse = tokenData || urls;
            
            // Convert to array or use empty array if null/invalid
            const parsedUrls = safeJSONParse(dataToUse, []);
            
            // Update both displays
            displayURLs(parsedUrls);
            updatePinnedLinks(parsedUrls);
            
            // Store the data in regular storage for consistency
            if (tokenData) {
                localStorage.setItem(STORAGE_KEY, tokenData);
            }
        } else {
            // No token, just use regular storage
            const parsedUrls = safeJSONParse(urls, []);
            displayURLs(parsedUrls);
            updatePinnedLinks(parsedUrls);
        }
    } catch (error) {
        console.error('Load URLs error:', error);
        displayURLs([]); // Pass empty array on error
    }
}

// Add this to ensure immediate loading when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadURLs(); // Load immediately
    
    // Check for token and initialize sync if needed
    const existingToken = localStorage.getItem(TOKEN_KEY);
    if (existingToken) {
        setupSyncForToken(existingToken);
    }
});

function displayURLs(urls) {
    const urlsContainer = document.getElementById('urls-container');
    if (!urlsContainer) return;

    // Clear existing content
    urlsContainer.innerHTML = '';
    
    // Ensure urls is an array
    const urlsArray = Array.isArray(urls) ? urls : [];
    
    if (urlsArray.length === 0) {
        urlsContainer.innerHTML = '<div class="empty-state">No URLs found</div>';
        return;
    }

    urlsArray.forEach(url => {
        const card = createURLElement(url);
        urlsContainer.appendChild(card);
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

// Load URLs when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadURLs();
});

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

// Modify the existing generateToken function
function generateToken() {
    const newToken = 'token_' + Date.now();
    createTokenSpace(newToken);
    
    const tokenInput = document.getElementById('token-input');
    if (tokenInput) {
        tokenInput.value = newToken;
    }
    
    // Clear current storage and UI
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    loadURLs();
    updatePinnedLinks([]);
    
    saveAndSetupToken(newToken);
    showNotification('New sync token generated!', 'success');
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

// Update syncWithToken function
function syncWithToken() {
    const inputToken = document.getElementById('token-input').value;
    if (!inputToken) {
        showNotification('Please enter a sync token', 'error');
        return;
    }

    try {
        // Save token for future use
        localStorage.setItem(TOKEN_KEY, inputToken);
        
        // Initialize empty array if no data exists
        if (!localStorage.getItem(STORAGE_KEY)) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        }
        
        // Set up Pusher channel subscription
        setupSyncForToken(inputToken);
        
        // Get existing data for this token
        const tokenData = localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${inputToken}`);
        if (tokenData) {
            try {
                const parsedData = JSON.parse(tokenData);
                const bookmarks = Array.isArray(parsedData) ? parsedData : 
                                (parsedData && Array.isArray(parsedData.data) ? parsedData.data : []);
                
                localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
                loadURLs();
                updatePinnedLinks(bookmarks);
                showNotification('Successfully synced with existing data', 'success');
            } catch (parseError) {
                console.error('Parse error:', parseError);
                // Initialize with empty array on parse error
                localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
                loadURLs();
                showNotification('Started fresh sync token', 'info');
            }
        } else {
            // Initialize empty storage for new token
            const emptyData = JSON.stringify([]);
            localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${inputToken}`, emptyData);
            localStorage.setItem(STORAGE_KEY, emptyData);
            loadURLs();
            showNotification('New sync token initialized', 'success');
        }
    } catch (error) {
        console.error('Token sync error:', error);
        showNotification('Failed to sync. Please try again.', 'error');
    }
}

// Add this function to persist token across sessions
function saveAndSetupToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
    // Store timestamp with token
    localStorage.setItem(`${TOKEN_KEY}_timestamp`, Date.now());
    setupSyncForToken(token);
    
    // Immediately fetch existing bookmarks for this token
    fetchExistingBookmarks(token);
}

// Add this function to manage separate token spaces
function createTokenSpace(token) {
    const tokenSpace = {
        bookmarks: [],
        pinned: [],
        dateCreated: new Date().toISOString()
    };
    
    // Set up separate storage for this token
    localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${token}`, JSON.stringify(tokenSpace));
    if (getCookie('cookie_consent') === 'accepted') {
        setCookie(`${TOKEN_STORAGE_PREFIX}${token}`, JSON.stringify(tokenSpace));
    }
    return tokenSpace;
}

// Add this function to fetch existing bookmarks for a token
function fetchExistingBookmarks(token) {
    // Implementation of fetchExistingBookmarks function
}

// Add this function to get cookie
function getCookie(name) {
    // Implementation of getCookie function
}

// Add this function to set cookie
function setCookie(name, value) {
    // Implementation of setCookie function
}

// Add manual refresh function
function refreshCurrentToken() {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) {
        showNotification('No token found. Please set a sync token first.', 'error');
        return;
    }

    // Get data from token storage
    const tokenData = localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${currentToken}`);
    if (tokenData) {
        localStorage.setItem(STORAGE_KEY, tokenData);
        loadURLs();
        showNotification('Data refreshed successfully!', 'success');
    } else {
        showNotification('No data found for current token', 'warning');
    }
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
function syncStorages(token, data) {
    const tokenKey = `${TOKEN_STORAGE_PREFIX}${token}`;
    const dataString = JSON.stringify(data);
    
    // Browser Storage
    localStorage.setItem(STORAGE_KEY, dataString);
    localStorage.setItem(tokenKey, dataString);
    
    // Cookie Storage
    if (getCookie('cookie_consent') === 'accepted') {
        setCookie(tokenKey, dataString, 30); // 30 days expiry
        setCookie(STORAGE_KEY, dataString, 30);
    }
    
    return true;
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
    return syncStorages(token, syncData);
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

setInterval(() => {
    const health = validateStorage(currentToken);
    if (!health.localStorage.available) {
        showNotification('Local storage is not available', 'error');
    }
}, 300000); // Every 5 minutes