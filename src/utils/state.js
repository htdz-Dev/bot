const fs = require('fs');
const path = require('path');
const config = require('../config');

// Default state
const defaultState = {
    // Global settings
    ramadanActive: false,
    countdownEnabled: true,

    // Legacy fields (kept for migration, will be moved to channels array)
    // city: config.defaultCity,
    // country: config.defaultCountry,
    // channelId: null,

    // Multi-city support: Array of { channelId, city, country, roleId? }
    channels: [],

    // Tracking last sent dates (global for now, but logical per channel)
    // We can keep these global or move them. 
    // For simplicity, if we have multiple cities, we need per-channel tracking to avoid duplicate sends?
    // Actually, "lastIftarSent" works per day. But different cities have different times.
    // So we need to track "lastIftarSent" PER CHANNEL.

    // Global Fallback (if no channel config found)
    defaultCity: config.defaultCity,
    defaultCountry: config.defaultCountry
};

// Ensure data directory exists
const dataDir = path.dirname(config.stateFilePath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('[State] Created data directory:', dataDir);
}

/**
 * Load state from file
 * @returns {Object} Current state
 */
function loadState() {
    try {
        if (fs.existsSync(config.stateFilePath)) {
            const data = fs.readFileSync(config.stateFilePath, 'utf8');
            const loaded = JSON.parse(data);

            // MIGRATION: If old format (has channelId/city at root), move to channels array
            if (loaded.channelId && !loaded.channels) {
                console.log('[State] Migrating legacy state to multi-city format...');
                loaded.channels = [{
                    channelId: loaded.channelId,
                    city: loaded.city || config.defaultCity,
                    country: loaded.country || config.defaultCountry,
                    lastIftarSent: loaded.lastIftarSent,
                    lastSuhoorSent: loaded.lastSuhoorSent,
                    country: loaded.country
                }];
                // Clean up root fields if you want, or keep them as fallback?
                // Let's keep the object clean
                delete loaded.channelId;
                delete loaded.city;
                delete loaded.country;
                delete loaded.lastIftarSent;
                delete loaded.lastSuhoorSent;
            }

            // Ensure channels array exists
            if (!loaded.channels) loaded.channels = [];

            return { ...defaultState, ...loaded };
        }
    } catch (error) {
        console.error('Error loading state:', error.message);
    }
    return { ...defaultState };
}

/**
 * Save state to file
 * @param {Object} state - State to save
 */
function saveState(state) {
    try {
        fs.writeFileSync(config.stateFilePath, JSON.stringify(state, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving state:', error.message);
    }
}

/**
 * Update specific state properties
 * @param {Object} updates - Properties to update
 * @returns {Object} Updated state
 */
function updateState(updates) {
    const currentState = loadState();
    const newState = { ...currentState, ...updates };
    saveState(newState);
    return newState;
}

/**
 * Get current state
 * @returns {Object} Current state
 */
function getState() {
    return loadState();
}

/**
 * Get config for a specific channel
 * @param {string} channelId 
 */
function getChannelConfig(channelId) {
    const state = loadState();
    return state.channels.find(c => c.channelId === channelId);
}

/**
 * Check if Ramadan is active
 * @returns {boolean}
 */
function isRamadanActive() {
    return loadState().ramadanActive;
}

/**
 * Activate Ramadan for a channel
 * @param {string} channelId - Channel ID
 * @returns {Object} Updated state
 */
function activateRamadan(channelId) {
    const state = loadState();

    // Ensure channel exists in state
    let channelConfig = state.channels.find(c => c.channelId === channelId);
    if (!channelConfig) {
        channelConfig = {
            channelId,
            city: state.defaultCity || config.defaultCity,
            country: state.defaultCountry || config.defaultCountry,
            lastIftarSent: null,
            lastSuhoorSent: null
        };
        state.channels.push(channelConfig);
    }

    state.ramadanActive = true; // Global toggle
    saveState(state);
    return state;
}

/**
 * Deactivate Ramadan (Global)
 * @returns {Object} Updated state
 */
function deactivateRamadan() {
    const state = loadState();
    state.ramadanActive = false;
    saveState(state);
    return state;
}

/**
 * Remove a channel from the active list
 * @param {string} channelId 
 * @returns {Object} Updated state
 */
function removeChannel(channelId) {
    const state = loadState();
    state.channels = state.channels.filter(c => c.channelId !== channelId);

    // If no channels left, maybe deactivate global? 
    // For now keep global active so new channels can join easily.

    saveState(state);
    return state;
}

/**
 * Update city for a specific channel
 * @param {string} city - City name
 * @param {string} country - Country name
 * @param {string} channelId - Channel ID context
 * @returns {Object} Updated state
 */
function updateCity(city, country = 'Algeria', channelId = null) {
    const state = loadState();

    if (channelId) {
        // Update specific channel
        let channelConfig = state.channels.find(c => c.channelId === channelId);
        if (channelConfig) {
            channelConfig.city = city;
            channelConfig.country = country;
            channelConfig.cachedPrayerTimes = null; // Clear cache
        } else {
            // Create new config if not exists
            state.channels.push({
                channelId,
                city,
                country,
                lastIftarSent: null,
                lastSuhoorSent: null
            });
        }
    } else {
        // Update global/default (fallback)
        state.defaultCity = city;
        state.defaultCountry = country;
    }

    saveState(state);
    return state;
}

/**
 * Mark message as sent today for a channel
 * @param {string} type - 'iftar' or 'suhoor'
 * @param {string} channelId - Channel ID
 */
function markMessageSent(type, channelId) {
    const today = new Date().toISOString().split('T')[0];
    const state = loadState();

    const channelConfig = state.channels.find(c => c.channelId === channelId);
    if (channelConfig) {
        if (type === 'iftar') {
            channelConfig.lastIftarSent = today;
        } else if (type === 'suhoor') {
            channelConfig.lastSuhoorSent = today;
        } else if (type === 'taraweeh') {
            channelConfig.lastTaraweehSent = today;
        } else if (type === 'earlySuhoor') {
            channelConfig.lastEarlySuhoorSent = today;
        } else if (type === 'iftarImage') {
            channelConfig.lastIftarImageSent = today;
        }
        saveState(state);
    }
}

/**
 * Check if message was sent today for a channel
 * @param {string} type 
 * @param {string} channelId
 * @returns {boolean}
 */
function wasMessageSentToday(type, channelId) {
    const today = new Date().toISOString().split('T')[0];
    const state = loadState();
    const channelConfig = state.channels.find(c => c.channelId === channelId);

    if (!channelConfig) return false;

    if (type === 'iftar') return channelConfig.lastIftarSent === today;
    if (type === 'suhoor') return channelConfig.lastSuhoorSent === today;
    if (type === 'taraweeh') return channelConfig.lastTaraweehSent === today;
    if (type === 'earlySuhoor') return channelConfig.lastEarlySuhoorSent === today;
    if (type === 'iftarImage') return channelConfig.lastIftarImageSent === today;

    return false;
}

module.exports = {
    getState,
    getChannelConfig,
    updateState: (updates) => {
        const state = loadState();
        const newState = { ...state, ...updates };
        saveState(newState);
        return newState;
    },
    isRamadanActive,
    activateRamadan,
    deactivateRamadan,
    removeChannel,
    updateCity,
    wasMessageSentToday,
    markMessageSent
};
