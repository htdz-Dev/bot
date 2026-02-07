const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, getPermissionDeniedMessage } = require('../utils/permissions');
const { getState, getChannelConfig, activateRamadan, deactivateRamadan, updateCity } = require('../utils/state');
const { createStatusEmbed, createRamadanEmbed, createCountdownEmbed } = require('../utils/messages');
const { getPrayerTimes } = require('../services/prayerTimes');
const { getFormattedHijriDate, getDaysUntilRamadan, isNightOfDoubt, getExpectedRamadanDateFormatted, getHijriDate } = require('../services/hijriDate');
const { scheduleRamadanMessages, cancelScheduledJobs } = require('../services/scheduler');

const { generateImsakiyah } = require('../services/imageGenerator');
const { playAdhan } = require('../services/voiceService');
const { AttachmentBuilder } = require('discord.js');

// Slash command definition
const data = new SlashCommandBuilder()
    .setName('ramadan')
    .setDescription('أوامر بوت رمضان المبارك')
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('عرض حالة رمضان الحالية'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('start')
            .setDescription('تفعيل رمضان (بعد ثبوت الرؤية) - للمسؤول فقط'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('stop')
            .setDescription('إنهاء رمضان - للمسؤول فقط'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('city')
            .setDescription('تغيير المدينة - للمسؤول فقط')
            .addStringOption(option =>
                option
                    .setName('name')
                    .setDescription('اسم المدينة (بالإنجليزية)')
                    .setRequired(true))
            .addStringOption(option =>
                option
                    .setName('country')
                    .setDescription('اسم الدولة (بالإنجليزية)')
                    .setRequired(false)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('countdown')
            .setDescription('عرض العد التنازلي لرمضان'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('countdown-on')
            .setDescription('تفعيل التذكير التلقائي بالعد التنازلي - للمسؤول فقط'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('countdown-off')
            .setDescription('إيقاف التذكير التلقائي بالعد التنازلي - للمسؤول فقط'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('schedule')
            .setDescription('عرض إمساكية اليوم المصورة')
            .addStringOption(option =>
                option
                    .setName('name')
                    .setDescription('اسم المدينة (بالإنجليزية)')
                    .setRequired(false))
            .addStringOption(option =>
                option
                    .setName('country')
                    .setDescription('اسم الدولة (بالإنجليزية)')
                    .setRequired(false)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('test')
            .setDescription('اختبار الرسائل - للمسؤول فقط')
            .addStringOption(option =>
                option
                    .setName('type')
                    .setDescription('نوع الرسالة للاختبار')
                    .setRequired(true)
                    .addChoices(
                        { name: '🍽️ رسالة الفطور', value: 'iftar' },
                        { name: '🌙 رسالة السحور', value: 'suhoor' },
                        { name: '🍲 سحور مبكر', value: 'earlySuhoor' },
                        { name: '🕌 تراويح', value: 'taraweeh' },
                        { name: '⏳ العد التنازلي', value: 'countdown' },
                        { name: '🔍 ليلة الشك', value: 'nightOfDoubt' }
                    ))
            .addStringOption(option =>
                option
                    .setName('name')
                    .setDescription('اسم المدينة للاختبار')
                    .setRequired(false))
            .addStringOption(option =>
                option
                    .setName('country')
                    .setDescription('اسم الدولة للاختبار')
                    .setRequired(false)));

/**
 * Execute the ramadan command
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'status':
            await handleStatus(interaction);
            break;
        case 'start':
            await handleStart(interaction);
            break;
        case 'stop':
            await handleStop(interaction);
            break;
        case 'city':
            await handleCity(interaction);
            break;
        case 'countdown':
            await handleCountdown(interaction);
            break;
        case 'countdown-on':
            await handleCountdownToggle(interaction, true);
            break;
        case 'countdown-off':
            await handleCountdownToggle(interaction, false);
            break;
        case 'schedule':
            await handleSchedule(interaction);
            break;
        case 'test':
            await handleTest(interaction);
            break;
        default:
            await interaction.reply({ content: '❌ أمر غير معروف', ephemeral: true });
    }
}

/**
 * Handle /ramadan status
 */
async function handleStatus(interaction) {
    await interaction.deferReply();

    try {
        const globalState = getState();
        const channelConfig = getChannelConfig(interaction.channelId);

        // Prepare display state
        const displayState = {
            ...globalState,
            city: channelConfig ? channelConfig.city : (globalState.defaultCity || 'Algiers'),
            country: channelConfig ? channelConfig.country : (globalState.defaultCountry || 'Algeria')
        };

        let prayerTimes = null;
        let hijriDate = null;

        try {
            prayerTimes = await getPrayerTimes(displayState.city, displayState.country);
            hijriDate = await getFormattedHijriDate();
        } catch (error) {
            console.error('Error fetching data for status:', error.message);
        }

        // Check if it's night of doubt
        const nightOfDoubt = await isNightOfDoubt();
        if (nightOfDoubt && !displayState.ramadanActive) {
            const { embed, files } = createRamadanEmbed('nightOfDoubt', {
                hijriDate: hijriDate,
                city: displayState.city
            });
            await interaction.editReply({ embeds: [embed], files: files });
            return;
        }

        const embed = createStatusEmbed(displayState, prayerTimes, hijriDate);

        // Add footer note about location
        embed.setFooter({ text: `📍 التوقيت لمدينة: ${displayState.city} | استخدم /ramadan city لتغيير المدينة` });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in status command:', error);
        await interaction.editReply({ content: '❌ حدث خطأ أثناء جلب الحالة' });
    }
}

/**
 * Handle /ramadan start
 */
async function handleStart(interaction) {
    // Check permissions
    if (!isAdmin(interaction.member)) {
        await interaction.reply({
            content: getPermissionDeniedMessage(),
            ephemeral: true
        });
        return;
    }

    await interaction.deferReply();

    try {
        const state = getState();

        if (state.ramadanActive) {
            await interaction.editReply({ content: '⚠️ رمضان مفعّل بالفعل!' });
            return;
        }

        // Activate Ramadan with current channel
        activateRamadan(interaction.channelId);

        // Schedule messages
        await scheduleRamadanMessages();

        const hijriDate = await getFormattedHijriDate();
        const { embed, files } = createRamadanEmbed('ramadanStarted', {
            city: state.city,
            hijriDate: hijriDate
        });

        await interaction.editReply({ embeds: [embed], files: files });

        console.log(`[Command] Ramadan activated by ${interaction.user.tag} in channel ${interaction.channelId}`);
    } catch (error) {
        console.error('Error in start command:', error);
        await interaction.editReply({ content: '❌ حدث خطأ أثناء تفعيل رمضان' });
    }
}

/**
 * Handle /ramadan stop
 */
async function handleStop(interaction) {
    // Check permissions
    if (!isAdmin(interaction.member)) {
        await interaction.reply({
            content: getPermissionDeniedMessage(),
            ephemeral: true
        });
        return;
    }

    await interaction.deferReply();

    try {
        const state = getState();

        if (!state.ramadanActive) {
            await interaction.editReply({ content: '⚠️ رمضان غير مفعّل حالياً!' });
            return;
        }

        // Deactivate Ramadan
        deactivateRamadan();

        // Cancel scheduled jobs
        cancelScheduledJobs();

        const hijriDate = await getFormattedHijriDate();
        const { embed, files } = createRamadanEmbed('ramadanEnded', {
            hijriDate: hijriDate
        });

        await interaction.editReply({ embeds: [embed], files: files });

        console.log(`[Command] Ramadan deactivated by ${interaction.user.tag}`);
    } catch (error) {
        console.error('Error in stop command:', error);
        await interaction.editReply({ content: '❌ حدث خطأ أثناء إيقاف رمضان' });
    }
}

/**
 * Handle /ramadan countdown-on and countdown-off
 * @param {CommandInteraction} interaction 
 * @param {boolean} enabled - true to enable, false to disable
 */
async function handleCountdownToggle(interaction, enabled) {
    // Check permissions
    if (!isAdmin(interaction.member)) {
        await interaction.reply({
            content: getPermissionDeniedMessage(),
            ephemeral: true
        });
        return;
    }

    try {
        const state = getState();
        state.countdownEnabled = enabled;

        // Import updateState function
        const { updateState } = require('../utils/state');
        updateState({ countdownEnabled: enabled });

        const statusEmoji = enabled ? '✅' : '🔕';
        const statusText = enabled ? 'مفعّل' : 'متوقف';

        await interaction.reply({
            content: `${statusEmoji} **التذكير التلقائي بالعد التنازلي: ${statusText}**\n**Rappel automatique du compte à rebours: ${enabled ? 'Activé' : 'Désactivé'}**\n\nسيتم إرسال رسالة العد التنازلي يومياً الساعة 18:00\nLe message sera envoyé chaque jour à 18h00 ${enabled ? '✨' : ''}`,
            ephemeral: false
        });

        console.log(`[Command] Countdown ${enabled ? 'enabled' : 'disabled'} by ${interaction.user.tag}`);
    } catch (error) {
        console.error('Error toggling countdown:', error);
        await interaction.reply({
            content: '❌ حدث خطأ أثناء تغيير إعدادات العد التنازلي',
            ephemeral: true
        });
    }
}

/**
 * Handle /ramadan city
 */
async function handleCity(interaction) {
    // Check permissions
    if (!isAdmin(interaction.member)) {
        await interaction.reply({
            content: getPermissionDeniedMessage(),
            ephemeral: true
        });
        return;
    }

    const cityName = interaction.options.getString('name');
    const countryName = interaction.options.getString('country') || 'Algeria';

    await interaction.deferReply();

    try {
        // Update city for THIS channel
        updateCity(cityName, countryName, interaction.channelId);

        // Verify the city works with the API
        const times = await getPrayerTimes(cityName, countryName);

        if (!times) {
            await interaction.editReply({ content: `⚠️ لم يتم العثور على أوقات الصلاة لمدينة **${cityName}, ${countryName}**. يرجى التأكد من الاسم.` });
            return;
        }

        // Refresh schedule for this channel (and others)
        if (getState().ramadanActive) {
            await scheduleRamadanMessages();
        }

        await interaction.editReply({ content: `✅ **تم تحديث المدينة لهذه القناة بنجاح!**\n📍 المدينة: **${cityName}**\n🗺️ الدولة: **${countryName}**\n⏱️ ستصل التنبيهات حسب توقيت هذه المدينة.` });

        console.log(`[Command] City updated to ${cityName} for channel ${interaction.channelId}`);
    } catch (error) {
        console.error('Error updating city:', error);
        await interaction.editReply({ content: '❌ حدث خطأ أثناء تحديث المدينة' });
    }
}

/**
 * Handle /ramadan countdown
 */
async function handleCountdown(interaction) {
    await interaction.deferReply();

    try {
        const state = getState();

        if (state.ramadanActive) {
            await interaction.editReply({ content: '🌙 رمضان مفعّل حالياً! رمضان مبارك!' });
            return;
        }

        const countdown = await getDaysUntilRamadan();
        const hijriDate = await getFormattedHijriDate();
        const expectedDate = getExpectedRamadanDateFormatted();

        if (countdown.days < 0) {
            await interaction.editReply({
                content: '📅 لا يمكن حساب العد التنازلي حالياً. قد يكون رمضان قد انتهى أو لم يتم التعرف على التاريخ.'
            });
            return;
        }

        // Check if it's night of doubt
        if (countdown.nightOfDoubt) {
            const { embed, files } = createRamadanEmbed('nightOfDoubt', {
                hijriDate: hijriDate,
                city: state.city
            });
            await interaction.editReply({ embeds: [embed], files: files });
            return;
        }

        const { embed, files } = createCountdownEmbed(countdown.days, hijriDate, expectedDate);
        await interaction.editReply({ embeds: [embed], files: files });
    } catch (error) {
        console.error('Error in countdown command:', error);
        await interaction.editReply({ content: '❌ حدث خطأ أثناء حساب العد التنازلي' });
    }
}

/**
 * Handle /ramadan test
 */
async function handleTest(interaction) {
    // Check permissions
    if (!isAdmin(interaction.member)) {
        await interaction.reply({
            content: getPermissionDeniedMessage(),
            ephemeral: true
        });
        return;
    }

    const testType = interaction.options.getString('type');
    const cityName = interaction.options.getString('name');
    const countryName = interaction.options.getString('country');

    await interaction.deferReply();

    try {
        const state = getState();
        // Use provided city or fallback to current channel's city or default
        const channelConfig = getChannelConfig(interaction.channelId);
        const city = cityName || (channelConfig ? channelConfig.city : (state.city || 'Algiers'));
        const country = countryName || (channelConfig ? channelConfig.country : (state.country || 'Algeria'));

        const hijriDate = await getFormattedHijriDate();
        let files = [];

        // Fetch prayer times for the specific test city
        const prayerTimes = await getPrayerTimes(city, country);

        switch (testType) {
            case 'iftar':
                const resultIftar = createRamadanEmbed('iftar', {
                    prayerTime: prayerTimes.Maghrib,
                    city: city,
                    hijriDate: hijriDate
                });
                embed = resultIftar.embed;
                files = resultIftar.files;

                // Trigger Adhan for verification
                if (interaction.guild) {
                    playAdhan(interaction.guild).catch(console.error);
                }
                break;

            case 'suhoor':
                const resultSuhoor = createRamadanEmbed('suhoor', {
                    prayerTime: prayerTimes.Fajr,
                    city: city,
                    hijriDate: hijriDate
                });
                embed = resultSuhoor.embed;
                files = resultSuhoor.files;
                break;

            case 'earlySuhoor':
                const resultEarly = createRamadanEmbed('earlySuhoor', {
                    prayerTime: prayerTimes.Fajr, // Or calculate -1h if needed specifically shown
                    city: city,
                    hijriDate: hijriDate
                });
                embed = resultEarly.embed;
                files = resultEarly.files;
                break;

            case 'taraweeh':
                const resultTaraweeh = createRamadanEmbed('taraweeh', {
                    prayerTime: prayerTimes.Isha,
                    city: city,
                    hijriDate: hijriDate
                });
                embed = resultTaraweeh.embed;
                files = resultTaraweeh.files;
                break;

            case 'countdown':
                const daysRemaining = await getDaysUntilRamadan();
                const resultCountdown = createCountdownEmbed(daysRemaining.days > 0 ? daysRemaining.days : 10, hijriDate);
                embed = resultCountdown.embed;
                files = resultCountdown.files;
                break;

            case 'nightOfDoubt':
                const resultNoD = createRamadanEmbed('nightOfDoubt', {
                    hijriDate: hijriDate,
                    city: city
                });
                embed = resultNoD.embed;
                files = resultNoD.files;
                break;

            default:
                await interaction.editReply({ content: '❌ نوع اختبار غير معروف' });
                return;
        }

        await interaction.editReply({
            content: '🧪 **هذه رسالة اختبار:**',
            embeds: [embed],
            files: files
        });

        console.log(`[Command] Test message (${testType}) sent by ${interaction.user.tag}`);
    } catch (error) {
        console.error('Error in test command:', error);
        await interaction.editReply({ content: '❌ حدث خطأ أثناء الاختبار' });
    }
}

/**
 * Handle /ramadan schedule
 */
async function handleSchedule(interaction) {
    const cityName = interaction.options.getString('name');
    const countryName = interaction.options.getString('country');

    await interaction.deferReply();

    try {
        const globalState = getState();
        let city, country;

        if (cityName) {
            // User provided specific city override
            city = cityName;
            country = countryName || 'Algeria';
        } else {
            // Use current channel config or default
            const channelConfig = getChannelConfig(interaction.channelId);
            city = channelConfig ? channelConfig.city : (globalState.defaultCity || 'Algiers');
            country = channelConfig ? channelConfig.country : (globalState.defaultCountry || 'Algeria');
        }

        const prayerTimes = await getPrayerTimes(city, country);
        if (!prayerTimes) {
            await interaction.editReply({ content: `⚠️ لم يتم العثور على أوقات الصلاة لمدينة **${city}, ${country}**. يرجى التأكد من الاسم.` });
            return;
        }

        const hijriDate = await getFormattedHijriDate();

        // Greogrian Date formatted in French/Arabic
        const now = new Date();
        const gregorianDate = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        const imageBuffer = await generateImsakiyah(prayerTimes, hijriDate, gregorianDate, city);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'imsakiyah.png' });

        await interaction.editReply({
            content: `📅 **إمساكية اليوم - ${city}**`,
            files: [attachment]
        });

    } catch (error) {
        console.error('Error handling schedule:', error);
        await interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء الإمساكية.' });
    }
}

module.exports = {
    data,
    execute
};
