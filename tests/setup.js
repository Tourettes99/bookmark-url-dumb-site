// Increase timeout for all tests
jest.setTimeout(30000);

// Add custom matchers if needed
expect.extend({
    toBeValidUrl(received) {
        try {
            new URL(received);
            return {
                message: () => `expected ${received} to be a valid URL`,
                pass: true
            };
        } catch (error) {
            return {
                message: () => `expected ${received} to be a valid URL`,
                pass: false
            };
        }
    }
}); 