const axios = require('axios');
const config = require('../config');

/**
 * Get current Hijri date from API
 * @returns {Promise<Object>} Hijri date info
 */
async function getHijriDate() {
    try {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();

        // Use gToH endpoint (Gregorian to Hijri)
        const url = `${config.aladhanApiUrl}/gToH/${day}-${month}-${year}`;
        console.log('[HijriDate] Fetching from:', url);

        const response = await axios.get(url);

        if (response.data && response.data.code === 200) {
            const hijri = response.data.data.hijri;
            return {
                day: parseInt(hijri.day),
                month: parseInt(hijri.month.number),
                monthName: hijri.month.ar,
                year: parseInt(hijri.year),
                formatted: `${hijri.day} ${hijri.month.ar} ${hijri.year} هـ`
            };
        }

        throw new Error('Invalid API response');
    } catch (error) {
        console.error('Error fetching Hijri date:', error.message);
        throw error;
    }
}

/**
 * Get formatted Hijri date string
 * @returns {Promise<string>}
 */
async function getFormattedHijriDate() {
    try {
        const hijri = await getHijriDate();
        return hijri.formatted;
    } catch (error) {
        return 'غير متوفر';
    }
}

/**
 * Get expected Ramadan start date for a given year
 * @param {number} year - Gregorian year
 * @returns {Date|null}
 */
function getExpectedRamadanDate(year = new Date().getFullYear()) {
    const dates = config.expectedRamadanDates;
    if (dates[year]) {
        return new Date(year, dates[year].month - 1, dates[year].day);
    }
    // If year not configured, try next year
    if (dates[year + 1]) {
        return new Date(year + 1, dates[year + 1].month - 1, dates[year + 1].day);
    }
    return null;
}

/**
 * Calculate days until Ramadan using fixed dates
 * @returns {Object} { days, nightOfDoubt, expectedDate, isEstimate }
 */
function getFixedCountdown() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let expectedDate = getExpectedRamadanDate(today.getFullYear());

    // If this year's Ramadan has passed, get next year's
    if (expectedDate && expectedDate < today) {
        expectedDate = getExpectedRamadanDate(today.getFullYear() + 1);
    }

    if (!expectedDate) {
        return { days: -1, nightOfDoubt: false, expectedDate: null, isEstimate: true };
    }

    const diffTime = expectedDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Night of doubt is typically 1 day before expected Ramadan
    const nightOfDoubtDays = config.countdownSettings.nightOfDoubtDaysBefore;
    const isNightOfDoubt = diffDays === nightOfDoubtDays;

    return {
        days: diffDays,
        nightOfDoubt: isNightOfDoubt,
        expectedDate: expectedDate,
        isEstimate: true // Always an estimate until confirmed
    };
}

/**
 * Check if we're in the night of doubt for Ramadan
 * Uses fixed countdown logic
 * @returns {Promise<boolean>}
 */
async function isNightOfDoubt() {
    try {
        const countdown = getFixedCountdown();

        if (countdown.nightOfDoubt) {
            return true;
        }

        // Also check from Hijri calendar (29th of Sha'ban)
        const hijri = await getHijriDate();
        return hijri.month === 8 && hijri.day === 29;
    } catch (error) {
        // Fall back to fixed countdown
        const countdown = getFixedCountdown();
        return countdown.nightOfDoubt;
    }
}

/**
 * Check if current month is Ramadan (month 9)
 * @returns {Promise<boolean>}
 */
async function isRamadanMonth() {
    try {
        const hijri = await getHijriDate();
        return hijri.month === 9;
    } catch (error) {
        console.error('Error checking Ramadan month:', error.message);
        return false;
    }
}

/**
 * Calculate days until Ramadan
 * Uses fixed dates with Hijri API as verification
 * @returns {Promise<Object>} { days, nightOfDoubt, source }
 */
async function getDaysUntilRamadan() {
    // Get fixed countdown
    const fixedCountdown = getFixedCountdown();

    try {
        // Try to get Hijri-based countdown for verification
        const hijri = await getHijriDate();

        // If already in Ramadan
        if (hijri.month === 9) {
            return { days: 0, nightOfDoubt: false, source: 'hijri', inRamadan: true };
        }

        // If past Ramadan this Hijri year
        if (hijri.month > 9) {
            // Use fixed countdown for next year
            return {
                days: fixedCountdown.days,
                nightOfDoubt: fixedCountdown.nightOfDoubt,
                source: 'fixed',
                inRamadan: false
            };
        }

        // Calculate from Hijri calendar
        const daysInCurrentMonth = 30;
        const daysRemainingInCurrentMonth = daysInCurrentMonth - hijri.day;
        const monthsUntilRamadan = 9 - hijri.month - 1;
        const daysInRemainingMonths = monthsUntilRamadan * 29.5;
        const hijriDays = Math.round(daysRemainingInCurrentMonth + daysInRemainingMonths);

        // Compare with fixed countdown - use the one that seems more accurate
        // If difference is more than 5 days, prefer fixed countdown
        const diff = Math.abs(hijriDays - fixedCountdown.days);

        if (diff <= 5) {
            // Use Hijri calculation
            return {
                days: hijriDays,
                nightOfDoubt: hijri.month === 8 && hijri.day === 29,
                source: 'hijri',
                inRamadan: false
            };
        } else {
            // Use fixed countdown (Hijri might have calculation issues)
            return {
                days: fixedCountdown.days,
                nightOfDoubt: fixedCountdown.nightOfDoubt,
                source: 'fixed',
                inRamadan: false
            };
        }
    } catch (error) {
        console.error('Error in getDaysUntilRamadan:', error.message);
        // Fall back to fixed countdown
        return {
            days: fixedCountdown.days,
            nightOfDoubt: fixedCountdown.nightOfDoubt,
            source: 'fixed',
            inRamadan: false
        };
    }
}

/**
 * Get formatted expected Ramadan date
 * @returns {string}
 */
function getExpectedRamadanDateFormatted() {
    const expectedDate = getExpectedRamadanDate();
    if (!expectedDate) return 'غير محدد';

    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return expectedDate.toLocaleDateString('ar-DZ', options);
}

module.exports = {
    getHijriDate,
    getFormattedHijriDate,
    isNightOfDoubt,
    isRamadanMonth,
    getDaysUntilRamadan,
    getFixedCountdown,
    getExpectedRamadanDate,
    getExpectedRamadanDateFormatted
};
