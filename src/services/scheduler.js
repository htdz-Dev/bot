const cron = require('node-cron');
const { getSuhoorTime, getIftarTime, getPrayerTimes } = require('./prayerTimes');
const { getFormattedHijriDate, getDaysUntilRamadan, isNightOfDoubt } = require('./hijriDate');
const { isRamadanActive, wasMessageSentToday, markMessageSent, getState, updateState } = require('../utils/state');
const { createRamadanEmbed, createCountdownEmbed } = require('../utils/messages');
const { generateImsakiyah } = require('./imageGenerator');
const { AttachmentBuilder } = require('discord.js');


let dailySchedulerJob = null;
let countdownJob = null;
let eveningCountdownJob = null; // 18:00 reminder
let imsakiyahJob = null;
let client = null;
let channelJobs = [];

/**
 * Initialize scheduler with Discord client
 * @param {Client} discordClient - Discord.js client
*/
function initScheduler(discordClient) {
    client = discordClient;

    // Schedule daily job to recalculate prayer times at midnight
    dailySchedulerJob = cron.schedule('0 0 * * *', async () => {
        console.log('[Scheduler] Midnight - rescheduling daily tasks');
        await scheduleRamadanMessages();
    });

    // Schedule countdown reminder at 18:00 daily (before Ramadan only)
    // Algiers timezone
    eveningCountdownJob = cron.schedule('46 17 * * *', async () => {
        console.log('[Scheduler] ⏰ Countdown reminder triggered at 18:00');
        await sendCountdownOrNightOfDoubt();
    }, {
        timezone: 'Africa/Algiers'
    });

    // Schedule Imsakiyah image at 4:00 AM daily (During Ramadan)
    imsakiyahJob = cron.schedule('0 4 * * *', async () => {
        console.log('[Scheduler] Daily Imsakiyah check');
        await sendDailyImsakiyah();
    }, {
        timezone: 'Africa/Algiers'
    });

    console.log('[Scheduler] ✅ Initialized - Countdown at 18:00, Imsakiyah at 4:00');
}

/**
 * Send countdown message or night of doubt alert
 */
async function sendCountdownOrNightOfDoubt() {
    console.log('[Scheduler] 📢 sendCountdownOrNightOfDoubt() called');

    // Skip if Ramadan is active
    if (isRamadanActive()) {
        console.log('[Scheduler] Ramadan active, skipping countdown');
        return;
    }

    const state = getState();
    console.log('[Scheduler] countdownEnabled:', state.countdownEnabled);

    // Skip if countdown is disabled
    if (state.countdownEnabled === false) {
        console.log('[Scheduler] Countdown disabled, skipping');
        return;
    }

    // SPECIAL RULE: Countdown is for Algeria only.
    // Find a channel configured for Algeria/Algiers.
    // If no specific channel found, fallback to default if that is Algeria.
    let targetChannelConfig = state.channels.find(c =>
        (c.city && c.city.toLowerCase().includes('algiers')) ||
        (c.country && c.country.toLowerCase().includes('algeria'))
    );

    // If no explicit Algeria channel found, try the fallback global channel ID if default country is Algeria
    let channelId = targetChannelConfig ? targetChannelConfig.channelId : null;

    if (!channelId) {
        // Fallback checks
        if ((state.defaultCountry && state.defaultCountry.toLowerCase().includes('algeria')) ||
            (state.defaultCity && state.defaultCity.toLowerCase().includes('algiers'))) {
            channelId = state.channelId || process.env.CHANNEL_ID;
        }
    }

    if (!channelId) {
        console.log('[Scheduler] No channel ID found for Algeria countdown');
        return;
    }

    try {
        console.log('[Scheduler] Fetching channel:', channelId);
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            console.error('[Scheduler] Channel not found for countdown');
            return;
        }

        // Check if it's night of doubt (29th Sha'ban)
        const nightOfDoubt = await isNightOfDoubt();
        if (nightOfDoubt) {
            console.log('[Scheduler] Night of doubt detected');
            await sendNightOfDoubtAlert(channel);
            return;
        }

        // Get days until Ramadan
        const ramadanInfo = await getDaysUntilRamadan();
        const daysRemaining = ramadanInfo.days;
        console.log('[Scheduler] Days remaining until Ramadan:', daysRemaining);

        // If countdown reached 0, auto-activate Ramadan!
        if (daysRemaining === 0) {
            console.log('[Scheduler] 🎉 Countdown reached 0! Auto-activating Ramadan...');
            await autoActivateRamadan(channel);
            return;
        }

        // Send countdown if days remaining > 0
        if (daysRemaining > 0) {
            console.log('[Scheduler] ✅ Sending countdown message...');
            await sendCountdownMessage(channel, daysRemaining);
            console.log('[Scheduler] ✅ Countdown message sent!');
        } else {
            console.log('[Scheduler] daysRemaining <= 0, not sending countdown');
        }
    } catch (error) {
        console.error('[Scheduler] ❌ Error in countdown:', error.message);
    }
}

/**
 * Auto-activate Ramadan when countdown ends
 * @param {TextChannel} channel
 */
async function autoActivateRamadan(channel) {
    const { activateRamadan } = require('../utils/state');

    try {
        // Activate Ramadan
        activateRamadan(channel.id);

        // Get Hijri date
        const hijriDate = await getFormattedHijriDate();
        const state = getState();

        // Send Ramadan Started message
        const { embed, files } = createRamadanEmbed('ramadanStarted', {
            hijriDate: hijriDate,
            city: state.city
        });

        await channel.send({
            content: '🎉 **رمضان كريم!** 🌙',
            embeds: [embed],
            files: files
        });

        // Schedule Iftar/Suhoor messages
        await scheduleRamadanMessages();

        console.log('[Scheduler] ✅ Ramadan auto-activated successfully!');
    } catch (error) {
        console.error('[Scheduler] Error auto-activating Ramadan:', error.message);
    }
}

/**
 * Send night of doubt alert
 * @param {TextChannel} channel 
 */
async function sendNightOfDoubtAlert(channel) {
    const today = new Date().toISOString().split('T')[0];
    const state = getState();

    // Check if already sent today
    if (state.lastNightOfDoubtSent === today) {
        console.log('[Scheduler] Night of doubt alert already sent today');
        return;
    }

    try {
        const hijriDate = await getFormattedHijriDate();
        const { embed, files } = createRamadanEmbed('nightOfDoubt', {
            hijriDate: hijriDate,
            city: state.city
        });

        await channel.send({
            content: '🔔 **تنبيه مهم للجميع!**',
            embeds: [embed],
            files: files
        });

        updateState({ lastNightOfDoubtSent: today });
        console.log('[Scheduler] Night of doubt alert sent');
    } catch (error) {
        console.error('[Scheduler] Error sending night of doubt alert:', error.message);
    }
}

/**
 * Send countdown message
 * @param {TextChannel} channel 
 * @param {number} daysRemaining 
 */
async function sendCountdownMessage(channel, daysRemaining) {
    const today = new Date().toISOString().split('T')[0];
    const state = getState();

    // Check if already sent today
    if (state.lastCountdownSent === today) {
        console.log('[Scheduler] Countdown already sent today');
        return;
    }

    try {
        const hijriDate = await getFormattedHijriDate();
        const { embed, files } = createCountdownEmbed(daysRemaining, hijriDate);

        await channel.send({ embeds: [embed], files: files });

        updateState({ lastCountdownSent: today });
        console.log(`[Scheduler] Countdown sent: ${daysRemaining} days remaining`);
    } catch (error) {
        console.error('[Scheduler] Error sending countdown:', error.message);
    }
}

/**
 * Schedule Iftar and Suhoor messages for today for ALL channels
 */
async function scheduleRamadanMessages() {
    // Cancel existing jobs to prevent duplicates
    cancelScheduledJobs();

    if (!isRamadanActive()) {
        console.log('[Scheduler] Ramadan not active, skipping message scheduling');
        return;
    }

    const state = getState();
    // Default to handling at least the global default city for legacy or default purposes if no channels
    // But ideally we iterate state.channels
    const channels = state.channels || [];

    // Fallback if no channels registered but ramadanActive is true (shouldn't happen with new logic, but safety)
    if (channels.length === 0 && (state.city || config.defaultCity)) {
        channels.push({
            channelId: state.channelId || process.env.CHANNEL_ID,
            city: state.city || config.defaultCity,
            country: state.country || config.defaultCountry
        });
    }

    console.log(`[Scheduler] Scheduling messages for ${channels.length} channels...`);

    for (const channelConfig of channels) {
        if (!channelConfig.channelId) continue;

        try {
            const city = channelConfig.city;
            const country = channelConfig.country;

            // Get prayer times for this city
            const prayerTimes = await getPrayerTimes(city, country);

            // Iftar (Maghrib)
            if (prayerTimes.Maghrib) {
                const [iftarHour, iftarMinute] = prayerTimes.Maghrib.split(':').map(Number);
                scheduleChannelJob('iftar', iftarHour, iftarMinute, channelConfig);
            }

            // Suhoor (Fajr - 30 mins)
            if (prayerTimes.Fajr) {
                const [fajrHour, fajrMinute] = prayerTimes.Fajr.split(':').map(Number);
                const fajrDate = new Date();
                fajrDate.setHours(fajrHour, fajrMinute, 0);
                fajrDate.setMinutes(fajrDate.getMinutes() - 30); // 30 mins before Fajr

                scheduleChannelJob('suhoor', fajrDate.getHours(), fajrDate.getMinutes(), channelConfig);
            }

            // Early Suhoor Reminder (1 hour before Fajr)
            if (prayerTimes.Fajr) {
                const [fajrHour, fajrMinute] = prayerTimes.Fajr.split(':').map(Number);
                const earlySuhoorDate = new Date();
                earlySuhoorDate.setHours(fajrHour, fajrMinute, 0);
                earlySuhoorDate.setMinutes(earlySuhoorDate.getMinutes() - 60); // 1 hour before Fajr

                scheduleChannelJob('earlySuhoor', earlySuhoorDate.getHours(), earlySuhoorDate.getMinutes(), channelConfig);
            }

            // Taraweeh Reminder (15 mins before Isha)
            if (prayerTimes.Isha) {
                const [ishaHour, ishaMinute] = prayerTimes.Isha.split(':').map(Number);
                const taraweehDate = new Date();
                taraweehDate.setHours(ishaHour, ishaMinute, 0);
                taraweehDate.setMinutes(taraweehDate.getMinutes() - 15); // 15 mins before Isha

                scheduleChannelJob('taraweeh', taraweehDate.getHours(), taraweehDate.getMinutes(), channelConfig);
            }

        } catch (error) {
            console.error(`[Scheduler] Error scheduling for channel ${channelConfig.channelId} (${channelConfig.city}):`, error.message);
        }
    }
}

/**
 * Helper to schedule a specific job for a channel
 */
function scheduleChannelJob(type, hour, minute, channelConfig) {
    const cronExpression = `${minute} ${hour} * * *`;

    const job = cron.schedule(cronExpression, async () => {
        try {
            const channel = await client.channels.fetch(channelConfig.channelId);
            if (!channel) return;

            if (type === 'iftar') {
                await sendIftarMessage(channel, channelConfig);
            } else if (type === 'suhoor') {
                await sendSuhoorMessage(channel, channelConfig);
            } else if (type === 'earlySuhoor') {
                await sendEarlySuhoorMessage(channel, channelConfig);
            } else if (type === 'taraweeh') {
                await sendTaraweehMessage(channel, channelConfig);
            }
        } catch (err) {
            console.error(`[Scheduler] Error executing ${type} job for ${channelConfig.city}:`, err);
        }
    }, {
        timezone: 'Africa/Algiers' // default, but let's keep it consistent
    });

    channelJobs.push(job);
    console.log(`[Scheduler] Scheduled ${type} for ${channelConfig.city} at ${hour}:${String(minute).padStart(2, '0')}`);
}

/**
 * Send daily Imsakiyah image to all channels
 */
async function sendDailyImsakiyah() {
    if (!isRamadanActive()) return;

    const state = getState();
    const channels = state.channels || [];

    for (const channelConfig of channels) {
        try {
            const channel = await client.channels.fetch(channelConfig.channelId);
            if (!channel) continue;

            console.log(`[Scheduler] Generating Imsakiyah for ${channelConfig.city}...`);
            const prayerTimes = await getPrayerTimes(channelConfig.city, channelConfig.country);
            const hijriDate = await getFormattedHijriDate();

            const now = new Date();
            const gregorianDate = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            const imageBuffer = await generateImsakiyah(prayerTimes, hijriDate, gregorianDate, channelConfig.city);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'imsakiyah.png' });

            await channel.send({
                content: `📅 **إمساكية اليوم - ${channelConfig.city}**`,
                files: [attachment]
            });
        } catch (error) {
            console.error(`[Scheduler] Error sending Imsakiyah to ${channelConfig.city}:`, error.message);
        }
    }
}



// ...

/**
 * Send Iftar message to channel
 */
async function sendIftarMessage(channel, channelConfig) {
    if (!isRamadanActive()) return;

    if (wasMessageSentToday('iftar', channel.id)) {
        console.log(`[Scheduler] Iftar already sent today for ${channelConfig.city}`);
        return;
    }

    try {
        const prayerTimes = await getPrayerTimes(channelConfig.city, channelConfig.country);
        const hijriDate = await getFormattedHijriDate();

        const { embed, files } = createRamadanEmbed('iftar', {
            prayerTime: prayerTimes.Maghrib,
            city: channelConfig.city,
            hijriDate: hijriDate
        });

        await channel.send({ content: '@everyone', embeds: [embed], files: files });
        markMessageSent('iftar', channel.id);
        console.log(`[Scheduler] Iftar sent to ${channelConfig.city}`);
    } catch (error) {
        console.error(`[Scheduler] Error sending Iftar to ${channelConfig.city}:`, error.message);
    }
}

/**
 * Send Suhoor message to channel
 */
async function sendSuhoorMessage(channel, channelConfig) {
    if (!isRamadanActive()) return;

    if (wasMessageSentToday('suhoor', channel.id)) {
        console.log(`[Scheduler] Suhoor already sent today for ${channelConfig.city}`);
        return;
    }

    try {
        const prayerTimes = await getPrayerTimes(channelConfig.city, channelConfig.country);
        const hijriDate = await getFormattedHijriDate();

        const { embed, files } = createRamadanEmbed('suhoor', {
            prayerTime: prayerTimes.Fajr,
            city: channelConfig.city,
            hijriDate: hijriDate
        });

        await channel.send({ content: '@everyone', embeds: [embed], files: files });
        markMessageSent('suhoor', channel.id);
        console.log(`[Scheduler] Suhoor sent to ${channelConfig.city}`);
    } catch (error) {
        console.error(`[Scheduler] Error sending Suhoor to ${channelConfig.city}:`, error.message);
    }
}

/**
 * Send Early Suhoor reminder (1 hour before Fajr)
 */
async function sendEarlySuhoorMessage(channel, channelConfig) {
    if (!isRamadanActive()) return;

    if (wasMessageSentToday('earlySuhoor', channel.id)) {
        console.log(`[Scheduler] Early Suhoor already sent today for ${channelConfig.city}`);
        return;
    }

    try {
        const prayerTimes = await getPrayerTimes(channelConfig.city, channelConfig.country);
        const hijriDate = await getFormattedHijriDate();

        const { embed, files } = createRamadanEmbed('earlySuhoor', {
            prayerTime: prayerTimes.Fajr,
            city: channelConfig.city,
            hijriDate: hijriDate
        });

        await channel.send({ embeds: [embed], files: files });
        markMessageSent('earlySuhoor', channel.id);
        console.log(`[Scheduler] Early Suhoor sent to ${channelConfig.city}`);
    } catch (error) {
        console.error(`[Scheduler] Error sending Early Suhoor to ${channelConfig.city}:`, error.message);
    }
}

/**
 * Send Taraweeh reminder (before Isha)
 */
async function sendTaraweehMessage(channel, channelConfig) {
    if (!isRamadanActive()) return;

    if (wasMessageSentToday('taraweeh', channel.id)) {
        console.log(`[Scheduler] Taraweeh already sent today for ${channelConfig.city}`);
        return;
    }

    try {
        const prayerTimes = await getPrayerTimes(channelConfig.city, channelConfig.country);
        const hijriDate = await getFormattedHijriDate();

        const { embed, files } = createRamadanEmbed('taraweeh', {
            prayerTime: prayerTimes.Isha,
            city: channelConfig.city,
            hijriDate: hijriDate
        });

        await channel.send({ embeds: [embed], files: files });
        markMessageSent('taraweeh', channel.id);
        console.log(`[Scheduler] Taraweeh sent to ${channelConfig.city}`);
    } catch (error) {
        console.error(`[Scheduler] Error sending Taraweeh to ${channelConfig.city}:`, error.message);
    }
}

/**
 * Cancel scheduled jobs (Iftar/Suhoor only)
 */
function cancelScheduledJobs() {
    channelJobs.forEach(job => job.stop());
    channelJobs = [];
    console.log('[Scheduler] Cleared all channel jobs');
}

/**
 * Stop all schedulers
 */
function stopScheduler() {
    cancelScheduledJobs();
    if (dailySchedulerJob) {
        dailySchedulerJob.stop();
        dailySchedulerJob = null;
    }
    if (countdownJob) {
        countdownJob.stop();
        countdownJob = null;
    }
    if (eveningCountdownJob) {
        eveningCountdownJob.stop();
        eveningCountdownJob = null;
    }
    if (imsakiyahJob) {
        imsakiyahJob.stop();
        imsakiyahJob = null;
    }
    console.log('[Scheduler] Stopped');
}

/**
 * Manually trigger countdown check (for testing)
 */
async function triggerCountdownCheck() {
    await sendCountdownOrNightOfDoubt();
}

module.exports = {
    initScheduler,
    scheduleRamadanMessages,
    cancelScheduledJobs,
    stopScheduler,
    triggerCountdownCheck
};
