const puppeteer = require('puppeteer');
const { PusherMock } = require('pusher-js-mock');

describe('Bookmark Website Integration Tests', () => {
    let browser;
    let page;
    const BASE_URL = 'https://your-netlify-site.netlify.app'; // Replace with your actual URL

    beforeAll(async () => {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox']
        });
        page = await browser.newPage();

        // Mock Pusher
        await page.evaluateOnNewDocument(() => {
            window.Pusher = PusherMock;
        });
    });

    afterAll(async () => {
        await browser.close();
    });

    beforeEach(async () => {
        await page.goto(BASE_URL);
        // Clear localStorage before each test
        await page.evaluate(() => localStorage.clear());
    });

    test('Add URL functionality', async () => {
        const testUrl = 'https://example.com';
        const testCategory = 'Test Category';
        const testHashtags = 'test,automation';

        await page.type('#url-input', testUrl);
        await page.type('#category-input', testCategory);
        await page.type('#hashtags-input', testHashtags);
        await page.click('button[onclick="addURL()"]');

        // Verify notification
        const notification = await page.waitForSelector('.notification.success');
        const notificationText = await notification.evaluate(el => el.textContent);
        expect(notificationText).toContain('URL added successfully');

        // Verify URL appears in list
        const urlElement = await page.waitForSelector(`a[href="${testUrl}"]`);
        expect(urlElement).toBeTruthy();
    });

    test('Search functionality', async () => {
        // Add a test URL first
        const testUrl = 'https://searchtest.com';
        await page.type('#url-input', testUrl);
        await page.click('button[onclick="addURL()"]');

        // Test search
        await page.type('#search-input', 'searchtest');
        await page.click('button[onclick="searchLinks()"]');

        // Verify search results
        const searchResults = await page.waitForSelector(`a[href="${testUrl}"]`);
        expect(searchResults).toBeTruthy();
    });

    test('Pin/Unpin functionality', async () => {
        // Add a test URL
        const testUrl = 'https://pintest.com';
        await page.type('#url-input', testUrl);
        await page.click('button[onclick="addURL()"]');

        // Pin the URL
        await page.click('.pin-button');

        // Verify URL appears in pinned section
        const pinnedLink = await page.waitForSelector('#pinned-links a');
        const pinnedHref = await pinnedLink.evaluate(el => el.href);
        expect(pinnedHref).toBe(testUrl);
    });

    test('Token sync functionality', async () => {
        const testToken = 'test_token_' + Date.now();
        
        // Generate new token
        await page.click('button[onclick="generateToken()"]');
        
        // Verify token input is populated
        const tokenValue = await page.evaluate(() => document.getElementById('token-input').value);
        expect(tokenValue).toBeTruthy();
        
        // Test sync
        await page.click('button[onclick="syncWithToken()"]');
        
        // Verify sync notification
        const notification = await page.waitForSelector('.notification');
        const notificationText = await notification.evaluate(el => el.textContent);
        expect(notificationText).toContain('sync');
    });

    test('Delete URL functionality', async () => {
        // Add a test URL
        const testUrl = 'https://deletetest.com';
        await page.type('#url-input', testUrl);
        await page.click('button[onclick="addURL()"]');

        // Delete the URL
        await page.click('.delete-button');

        // Verify deletion
        const notification = await page.waitForSelector('.notification');
        const notificationText = await notification.evaluate(el => el.textContent);
        expect(notificationText).toContain('deleted successfully');

        // Verify URL is removed
        const urlElements = await page.$$(`a[href="${testUrl}"]`);
        expect(urlElements.length).toBe(0);
    });

    test('Error handling', async () => {
        // Test adding invalid URL
        await page.click('button[onclick="addURL()"]');
        
        // Verify error notification
        const notification = await page.waitForSelector('.notification.error');
        const notificationText = await notification.evaluate(el => el.textContent);
        expect(notificationText).toContain('Please enter a URL');
    });
}); 