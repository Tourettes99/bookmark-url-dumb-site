// Constants - using var for global scope
var TOKEN_STORAGE_PREFIX = 'bookmarks_token_';
var STORAGE_KEY = 'urls';
var TOKEN_KEY = 'sync_token';
var SYNC_INTERVAL = 30000; // 30 seconds

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

// Add this near the top of the file, after the constants
async function initializePusher() {
    try {
        const response = await fetch('/.netlify/functions/get-pusher-config');
        
        // Debug response
        const textResponse = await response.text();
        try {
            const config = JSON.parse(textResponse);
            
            if (!config.key || !config.cluster) {
                throw new Error('Invalid Pusher configuration');
            }
            
            // Initialize Pusher with fetched credentials
            window.pusher = new Pusher(config.key, {
                cluster: config.cluster,
                encrypted: true
            });
            
            const existingToken = localStorage.getItem(TOKEN_KEY);
            if (existingToken) {
                setupSyncForToken(existingToken);
            }
            
            showNotification('Sync service initialized', 'success');
        } catch (parseError) {
            console.error('Response was:', textResponse);
            throw new Error(`Failed to parse response: ${parseError.message}`);
        }
    } catch (error) {
        console.error('Pusher initialization failed:', error);
        showNotification('Failed to initialize sync service. Check console for details.', 'error');
        // Make pusher available even if initialization fails
        window.pusher = {
            subscribe: () => ({
                bind: () => {} // No-op function
            })
        };
    }
}

function setupSyncForToken(token) {
    // Unsubscribe from any existing channel
    if (window.currentChannel) {
        pusher.unsubscribe(window.currentChannel);
    }
    
    const channelName = `sync-channel-${token}`;
    window.currentChannel = channelName;
    
    const channel = pusher.subscribe(channelName);
    
    channel.bind('sync-update', function(data) {
        if (data.source !== getDeviceId()) {
            try {
                // Update both token-specific and current storage
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data.bookmarks));
                localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${token}`, JSON.stringify(data.bookmarks));
                
                // Update UI
                loadURLs();
                updatePinnedLinks(data.bookmarks);
                showNotification('Received update from another device', 'success');
            } catch (error) {
                console.error('Error handling sync update:', error);
                showNotification('Failed to process sync update', 'error');
            }
        }
    });
}

// Call this when the page loads
document.addEventListener('DOMContentLoaded', initializePusher);

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
    
    if (!urlInput.value) {
        showNotification('Please enter a URL', 'error');
        return;
    }
    
    const bookmarks = safeJSONParse(localStorage.getItem(STORAGE_KEY), []);
    
    const newBookmark = {
        url: urlInput.value,
        category: categoryInput.value || 'Uncategorized',
        hashtags: hashtagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag),
        pinned: false,
        dateAdded: new Date().toISOString()
    };
    
    bookmarks.push(newBookmark);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    
    // Clear inputs
    urlInput.value = '';
    categoryInput.value = '';
    hashtagsInput.value = '';
    
    // Update UI
    loadURLs();
    updatePinnedLinks(bookmarks);
    
    // Sync changes if enabled
    syncChanges(bookmarks);
    
    showNotification('URL added successfully', 'success');
}

// Sync changes to other devices
function syncChanges(bookmarks) {
    const userToken = localStorage.getItem(TOKEN_KEY);
    if (!userToken) return;

    try {
        // Update both storages with stringified data
        const bookmarksString = JSON.stringify(bookmarks);
        localStorage.setItem(STORAGE_KEY, bookmarksString);
        localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${userToken}`, bookmarksString);

        // Force reload URLs after sync
        loadURLs();

        // Send update to other devices
        fetch('/.netlify/functions/sync-bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: getDeviceId(),
                token: userToken,
                bookmarks: bookmarks
            })
        }).catch(error => {
            console.error('Failed to broadcast changes:', error);
            showNotification('Failed to sync with other devices', 'error');
        });
    } catch (error) {
        console.error('Error in syncChanges:', error);
        showNotification('Failed to save changes', 'error');
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

// Add event listener for storage changes
window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
        updateUI();
    }
});

// Modify loadURLs function
function loadURLs() {
    try {
        const bookmarks = safeJSONParse(localStorage.getItem(STORAGE_KEY), []);
        updateBookmarksList(bookmarks);
        updatePinnedLinks(bookmarks);
        displayURLs(bookmarks); // Always display URLs regardless of search
    } catch (error) {
        console.error('Load URLs error:', error);
        updateBookmarksList([]);
        updatePinnedLinks([]);
        displayURLs([]); // Display empty state
    }
}

function displayURLs(urls) {
    const container = document.getElementById('urls-container');
    container.innerHTML = '';

    urls.forEach(url => {
        const card = createURLElement(url);
        container.appendChild(card);
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
    
    const pinnedUrls = urls.filter(url => url.pinned);
    
    if (pinnedUrls.length === 0) {
        pinnedContainer.innerHTML = '<div class="no-pins">No pinned links yet</div>';
        return;
    }

    pinnedUrls.forEach(url => {
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

// Add this new function to handle deletion
function deleteURL(url) {
    const urls = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const updatedUrls = urls.filter(item => item.url !== url);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUrls));
    
    // Sync the deletion
    syncChanges(updatedUrls);
    
    loadURLs();
    updatePinnedLinks(updatedUrls);
    showNotification('URL deleted successfully!');
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
        
        // Set up Pusher channel subscription
        setupSyncForToken(inputToken);
        
        // Get existing data for this token
        const tokenData = localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${inputToken}`);
        if (tokenData) {
            // Update local storage with token data
            localStorage.setItem(STORAGE_KEY, tokenData);
            
            // Update UI
            const bookmarks = JSON.parse(tokenData);
            loadURLs();
            updatePinnedLinks(bookmarks);
            
            showNotification('Successfully synced with existing data', 'success');
        } else {
            // If no existing data, initialize empty storage
            localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${inputToken}`, JSON.stringify([]));
            localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
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