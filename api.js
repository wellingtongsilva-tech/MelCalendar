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
        return data;

        // Mock data for demonstration purposes since we don't have a real URL
        //return mockFetchData();
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
 * Generates mock events for demonstration
 */
async function mockFetchData() {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Generate some random events in 2026
    return [
        { id: 1, date: '2026-05-15', title: 'Reunião de Pais', description: 'Reunião na escola às 19h' },
        { id: 2, date: '2026-05-09', title: 'Festa de Aniversário', description: 'Aniversário do João' },
        { id: 3, date: '2026-05-10', title: 'Almoço em Família', description: 'Almoço na casa da vó' },
        { id: 4, date: '2026-06-12', title: 'Dentista Mel', description: 'Consulta de rotina' },
        { id: 5, date: '2026-01-01', title: 'Ano Novo', description: 'Feriado' },
        { id: 6, date: '2026-12-25', title: 'Natal', description: 'Feriado em família' }
    ];
}

// Export for usage in other scripts
window.api = {
    fetchEvents,
    WEB_APP_URL
};
