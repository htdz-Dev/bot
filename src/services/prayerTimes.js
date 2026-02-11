const axios = require('axios');
const config = require('../config');
const { getState, updateState } = require('../utils/state');

/**
 * Get prayer times for a specific city and date
 * @param {string} city - City name
 * @param {string} country - Country name
 * @param {Date} date - Date to get prayer times for
 * @returns {Promise<Object>} Prayer times object
 */
/**
 * Get prayer times for a specific city and date
 * @param {string} city - City name
 * @param {string} country - Country name
 * @param {Date} date - Date to get prayer times for
 * @returns {Promise<Object>} Object containing timings and timezone
 */
async function getPrayerTimes(city = null, country = null, date = new Date()) {
    const state = getState();
    city = city || state.city || config.defaultCity;
    country = country || state.country || config.defaultCountry;

    const dateStr = date.toISOString().split('T')[0];

    try {
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();

        const url = `${config.aladhanApiUrl}/timingsByCity/${day}-${month}-${year}`;

        // Dynamic method selection
        let method = 3; // Default: Muslim World League (good for Europe)
        if (country.toLowerCase().includes('algeria')) method = 19; // Egypt (for North Africa)
        if (country.toLowerCase().includes('canada') || country.toLowerCase().includes('usa')) method = 2; // ISNA

        const response = await axios.get(url, {
            params: {
                city: city,
                country: country,
                method: method
            }
        });

        if (response.data && response.data.code === 200) {
            return {
                timings: response.data.data.timings,
                timezone: response.data.data.meta.timezone
            };
        }

        throw new Error('Invalid API response');
    } catch (error) {
        console.error('Error fetching prayer times:', error.message);
        throw error;
    }
}

/**
 * Get Fajr time for today
 * @returns {Promise<string>} Fajr time (HH:MM format)
 */
async function getFajrTime() {
    const data = await getPrayerTimes();
    return data && data.timings && data.timings.Fajr ? data.timings.Fajr.split(' ')[0] : null;
}

/**
 * Get Maghrib time for today
 * @returns {Promise<string>} Maghrib time (HH:MM format)
 */
async function getMaghribTime() {
    const data = await getPrayerTimes();
    return data && data.timings && data.timings.Maghrib ? data.timings.Maghrib.split(' ')[0] : null;
}

/**
 * Calculate time before Fajr for Suhoor reminder
 * @param {number} minutesBefore - Minutes before Fajr
 * @returns {Promise<Object>} { hour, minute }
 */
async function getSuhoorTime(minutesBefore = config.suhoorMinutesBeforeFajr) {
    const fajrTime = await getFajrTime();
    if (!fajrTime) return null;

    const [hours, minutes] = fajrTime.split(':').map(Number);
    let totalMinutes = hours * 60 + minutes - minutesBefore;

    if (totalMinutes < 0) {
        totalMinutes += 24 * 60; // Handle midnight crossing
    }

    return {
        hour: Math.floor(totalMinutes / 60),
        minute: totalMinutes % 60
    };
}

/**
 * Get formatted Maghrib time as { hour, minute }
 * @returns {Promise<Object>} { hour, minute }
 */
async function getIftarTime() {
    const maghribTime = await getMaghribTime();
    if (!maghribTime) return null;

    const [hours, minutes] = maghribTime.split(':').map(Number);
    return { hour: hours, minute: minutes };
}

module.exports = {
    getPrayerTimes,
    getFajrTime,
    getMaghribTime,
    getSuhoorTime,
    getIftarTime
};
