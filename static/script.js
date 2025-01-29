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
    const channel = pusher.subscribe(`sync-channel-${token}`);
    channel.bind('sync-update', function(data) {
        if (data.source !== getDeviceId()) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.bookmarks));
            loadURLs();
            updatePinnedLinks(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);
            showNotification('Synced with other devices', 'success');
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

// Modified addURL function to include sync
function addURL() {
    const urlInput = document.getElementById('url-input');
    const categoryInput = document.getElementById('category-input');
    const hashtagsInput = document.getElementById('hashtags-input');
    
    if (!urlInput.value) {
        showNotification('Please enter a URL', 'error');
        return;
    }

    const bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const newBookmark = {
        url: urlInput.value,
        category: categoryInput.value || 'Uncategorized',
        hashtags: hashtagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag),
        pinned: false,
        dateAdded: new Date().toISOString()
    };

    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (currentToken) {
        const tokenSpace = JSON.parse(localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${currentToken}`) || '{"bookmarks":[]}');
        tokenSpace.bookmarks.push(newBookmark);
        localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${currentToken}`, JSON.stringify(tokenSpace));
        
        if (getCookie('cookie_consent') === 'accepted') {
            setCookie(`${TOKEN_STORAGE_PREFIX}${currentToken}`, JSON.stringify(tokenSpace));
        }
    }

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

    // Update both storages
    localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${userToken}`, JSON.stringify(bookmarks));
    setCookie(`${TOKEN_STORAGE_PREFIX}${userToken}`, JSON.stringify(bookmarks));

    fetch('/.netlify/functions/sync-bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source: getDeviceId(),
            token: userToken,
            bookmarks: bookmarks
        })
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

// Add safe JSON parsing helper
function safeJSONParse(data, defaultValue = []) {
    try {
        return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
        console.error('JSON Parse error:', error);
        return defaultValue;
    }
}

// Modify loadURLs function to handle undefined data
function loadURLs() {
    try {
        const storedData = localStorage.getItem(STORAGE_KEY);
        const bookmarks = safeJSONParse(storedData, []);
        updateBookmarksList(bookmarks);
    } catch (error) {
        console.error('Load URLs error:', error);
        updateBookmarksList([]);
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
    const bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY));
    
    const filtered = bookmarks.filter(bookmark => 
        bookmark.url.toLowerCase().includes(searchTerm) ||
        bookmark.hashtags.toLowerCase().includes(searchTerm)
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
    if (!isPusherInitialized()) {
        showNotification('Sync service not initialized. Please refresh the page.', 'error');
        return;
    }

    const inputToken = document.getElementById('token-input').value;
    if (!inputToken) {
        showNotification('Please enter a sync token', 'error');
        return;
    }

    try {
        const channel = pusher.subscribe(`sync-channel-${inputToken}`);
        localStorage.setItem(TOKEN_KEY, inputToken);
        
        // Initialize empty storage for new tokens
        if (!localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${inputToken}`)) {
            localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${inputToken}`, JSON.stringify([]));
        }
        
        const mergedBookmarks = syncTokenStorage(inputToken);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedBookmarks));
        loadURLs();
        updatePinnedLinks(mergedBookmarks);
        
        // Rest of the existing syncWithToken code...
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

// Add this function after the showNotification function
function hideGuide() {
    const guide = document.querySelector('.quick-start-guide');
    if (guide) {
        guide.style.display = 'none';
        localStorage.setItem('hideGuide', 'true');
    }
}

// Add this cookie management system
function setCookie(name, value) {
    // Set a very far future date (effectively never expires)
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 100); // 100 years from now
    const expires = "expires=" + farFuture.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999;';
}

// Add cookie consent check
function checkCookieConsent() {
    const consent = getCookie('cookie_consent');
    if (!consent) {
        const notification = document.createElement('div');
        notification.className = 'cookie-consent';
        notification.innerHTML = `
            <p>This site uses cookies to improve your experience. 
               Do you accept cookies for better storage?</p>
            <button onclick="acceptCookies()">Accept</button>
            <button onclick="declineCookies()">Decline</button>
        `;
        document.body.appendChild(notification);
    }
    return consent === 'accepted';
}

function acceptCookies() {
    setCookie('cookie_consent', 'accepted');
    document.querySelector('.cookie-consent')?.remove();
    // Transfer current localStorage to cookies
    syncToCookies();
}

function declineCookies() {
    setCookie('cookie_consent', 'declined');
    document.querySelector('.cookie-consent')?.remove();
}

function syncToCookies() {
    if (getCookie('cookie_consent') === 'accepted') {
        const bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        setCookie(STORAGE_KEY, JSON.stringify(bookmarks));
        
        // Sync other important data
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) setCookie(TOKEN_KEY, token);
        
        const deviceId = localStorage.getItem('device_id');
        if (deviceId) setCookie('device_id', deviceId);
    }
}

// Modify existing storage functions to use both localStorage and cookies
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    if (getCookie('cookie_consent') === 'accepted') {
        setCookie(key, value);
    }
};

const originalGetItem = localStorage.getItem;
localStorage.getItem = function(key) {
    const localValue = originalGetItem.apply(this, arguments);
    if (getCookie('cookie_consent') === 'accepted') {
        const cookieValue = getCookie(key);
        return localValue || cookieValue;
    }
    return localValue;
};

// Add cookie consent functions
function showCookieConsent() {
    const consentContainer = document.createElement('div');
    consentContainer.className = 'cookie-consent';
    consentContainer.innerHTML = `
        <div class="cookie-content">
            <p>🍪 This site uses cookies to improve your experience and sync preferences.</p>
            <div class="cookie-buttons">
                <button onclick="acceptCookies()" class="accept-button">Accept Cookies</button>
                <button onclick="declineCookies()" class="decline-button">Decline</button>
            </div>
        </div>
    `;
    document.body.appendChild(consentContainer);
}

function acceptCookies() {
    localStorage.setItem('cookieConsent', 'accepted');
    document.querySelector('.cookie-consent')?.remove();
}

function declineCookies() {
    localStorage.setItem('cookieConsent', 'declined');
    document.querySelector('.cookie-consent')?.remove();
} 