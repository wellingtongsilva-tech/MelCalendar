/**
 * API module for handling interactions with the backend (Google Apps Script)
 */

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxMGwQ2ofyI0_O4k7Uk41IZOEPNhFPrHUB82Hzvj1nQ1u1rjBVUP3iQY3qPo_xo7eJQ/exec"; // Placeholder

// Global controller to abort pending requests
let currentAbortController = null;

/**
 * Fetch events from the backend with timeout and abort support
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Array>} - Array of events
 */
async function fetchEvents(timeoutMs = 15000) {
    // If there's already a request, abort it
    if (currentAbortController) {
        currentAbortController.abort();
    }

    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    // Create a timeout promise
    const timeoutId = setTimeout(() => currentAbortController.abort(), timeoutMs);

    try {
        // In a real scenario with the GAS URL:

        const response = await fetch(WEB_APP_URL, {
            method: 'GET',
            signal: signal
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Retorna o objeto completo se vier do novo backend, ou um fallback vazio
        if (data && data.events !== undefined) {
            return data;
        }
        
        // Fallback temporário caso o backend antigo ainda responda
        return { events: [], config: { fixedRules: [] } };
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Fetch request was aborted or timed out.');
        } else {
            console.error('Failed to fetch events:', error);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Sends the current full state (events + rules) to the GAS backend
 * @param {Object} stateData 
 */
async function syncData(stateData) {
    try {
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors', // Avoids CORS errors from GAS 302 redirects
            body: JSON.stringify(stateData),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            }
        });
        
        // With no-cors, the response is opaque. We assume success if the network request doesn't throw.
        return { success: true };
    } catch (error) {
        console.error('Failed to sync data:', error);
        throw error;
    }
}

// Export for usage in other scripts
window.api = {
    fetchEvents,
    syncData,
    WEB_APP_URL
};
