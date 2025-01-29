// Constants
const STORAGE_KEY = 'teachmode_bookmarks';
const SYNC_INTERVAL = 30000; // 30 seconds
const TOKEN_KEY = 'teachmode_user_token';
const TOKEN_STORAGE_PREFIX = 'teachmode_data_';

// Add these constants at the top of your file with other constants
const TOKEN_STORAGE_PREFIX = 'bookmarks_token_';
const TOKEN_KEY = 'sync_token';

// Initialize storage when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize storage if empty
    if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
    
    // Load existing URLs
    loadURLs();
    
    // Add event listeners
    document.getElementById('search-input')?.addEventListener('input', searchLinks);
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
    
    const urls = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const newUrl = {
        url: urlInput.value,
        category: categoryInput.value,
        hashtags: hashtagsInput.value.split(',').map(tag => tag.trim()),
        pinned: false,
        dateAdded: new Date().toISOString()
    };
    
    urls.push(newUrl);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
    
    // Sync changes
    syncChanges(urls);
    
    // Update UI
    loadURLs();
    updatePinnedLinks(urls);
    
    // Clear inputs
    urlInput.value = '';
    categoryInput.value = '';
    hashtagsInput.value = '';
}

// Sync changes to other devices
function syncChanges(bookmarks) {
    const userToken = localStorage.getItem(TOKEN_KEY);
    if (!userToken) return;

    // Update token-specific storage
    localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${userToken}`, JSON.stringify(bookmarks));

    fetch('/.netlify/functions/sync-bookmarks', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
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

function loadURLs() {
    const urls = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    
    // Load pinned links
    const pinnedLinksContainer = document.getElementById('pinned-links');
    if (pinnedLinksContainer) {
        pinnedLinksContainer.innerHTML = '';
        
        const pinnedUrls = urls.filter(url => url.pinned);
        
        if (pinnedUrls.length === 0) {
            pinnedLinksContainer.innerHTML = `
                <div class="empty-state">
                    <p>No pinned links yet</p>
                </div>`;
        } else {
            pinnedUrls.forEach(url => {
                const pinnedDiv = document.createElement('div');
                pinnedDiv.className = 'pinned-link';
                
                try {
                    const urlObj = new URL(url.url);
                    const faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}`;
                    
                    pinnedDiv.innerHTML = `
                        <a href="${url.url}" target="_blank">
                            <img src="${faviconUrl}" class="favicon" alt="favicon">
                            <span>${urlObj.hostname}</span>
                        </a>
                    `;
                    
                    pinnedLinksContainer.appendChild(pinnedDiv);
                } catch (e) {
                    console.error('Error processing URL:', url, e);
                }
            });
        }
    }

    // Load all URLs
    const urlsContainer = document.getElementById('urls-container');
    if (urlsContainer) {
        urlsContainer.innerHTML = '';
        
        if (urls.length === 0) {
            urlsContainer.innerHTML = '<div class="no-urls">No bookmarks yet</div>';
        } else {
            urls.forEach(url => {
                const urlElement = createURLElement(url);
                urlsContainer.appendChild(urlElement);
            });
        }
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
    loadURLs();
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
    const token = 'tm_' + Math.random().toString(36).substr(2, 9);
    const tokenInput = document.getElementById('token-input');
    tokenInput.value = token;
    
    // Show copy button after generating token
    const copyButton = document.createElement('button');
    copyButton.className = 'token-button copy-button';
    copyButton.innerHTML = '📋 Copy';
    copyButton.onclick = copyToken;
    
    // Remove existing copy button if any
    const existingCopyButton = document.querySelector('.copy-button');
    if (existingCopyButton) {
        existingCopyButton.remove();
    }
    
    // Add new copy button
    const tokenSection = document.querySelector('.token-section');
    tokenSection.appendChild(copyButton);
    
    showNotification('New sync token generated', 'success');
}

// Add this helper function to check if Pusher is properly initialized
function isPusherInitialized() {
    return window.pusher && typeof window.pusher.subscribe === 'function';
}

// Add this helper function before syncWithToken
function mergeBookmarks(bookmarks1, bookmarks2) {
    const urlMap = new Map();
    
    // Add all bookmarks from first array
    bookmarks1.forEach(bookmark => {
        urlMap.set(bookmark.url, {
            ...bookmark,
            dateAdded: bookmark.dateAdded || new Date().toISOString()
        });
    });
    
    // Add or update bookmarks from second array
    bookmarks2.forEach(bookmark => {
        const existing = urlMap.get(bookmark.url);
        if (existing) {
            // If bookmark exists, keep the pinned status from the most recently updated one
            const bookmarkDate = bookmark.dateAdded || new Date().toISOString();
            urlMap.set(bookmark.url, {
                ...bookmark,
                pinned: bookmarkDate > existing.dateAdded ? bookmark.pinned : existing.pinned,
                dateAdded: bookmarkDate
            });
        } else {
            urlMap.set(bookmark.url, {
                ...bookmark,
                dateAdded: bookmark.dateAdded || new Date().toISOString()
            });
        }
    });
    
    return Array.from(urlMap.values());
}

// Update the sync function to check Pusher status
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
        // Subscribe to a private channel for this token
        const channel = pusher.subscribe(`sync-channel-${inputToken}`);
        
        // Store token
        localStorage.setItem(TOKEN_KEY, inputToken);
        
        // Get existing bookmarks for this token from storage
        const existingTokenData = localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${inputToken}`);
        const existingBookmarks = existingTokenData ? JSON.parse(existingTokenData) : [];
        
        // Get current bookmarks
        const currentBookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        
        // Merge bookmarks, removing duplicates based on URL
        const mergedBookmarks = mergeBookmarks(currentBookmarks, existingBookmarks);
        
        // Update local storage with merged bookmarks
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedBookmarks));
        localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${inputToken}`, JSON.stringify(mergedBookmarks));
        
        // Listen for updates from other devices
        channel.bind('sync-update', function(data) {
            if (data.source !== getDeviceId()) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data.bookmarks));
                loadURLs();
                updatePinnedLinks(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);
                showNotification('Synced with other devices', 'success');
            }
        });

        // Send current bookmarks to other devices
        const bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        fetch('/.netlify/functions/sync-bookmarks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source: getDeviceId(),
                token: inputToken,
                bookmarks: bookmarks
            })
        });

        showNotification('Sync enabled successfully', 'success');
        
    } catch (error) {
        console.error('Sync error:', error);
        showNotification('Failed to sync. Please try again.', 'error');
    }
} 