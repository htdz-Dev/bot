const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Decorative elements
const DECORATIONS = {
    starLine: '✨ ━━━━━━━━━━━━━━━━ ✨',
    moonLine: '🌙 ━━━━━━━━━━━━━━━━ 🌙',
    lanternLine: '🏮 ━━━━━━━━━━━━━━━━ 🏮',
    divider: '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
    progressFilled: '█',
    progressEmpty: '░'
};

// Thumbnail URLs (Ramadan themed)
const THUMBNAILS = {
    iftar: 'https://cdn-icons-png.flaticon.com/512/4253/4253264.png',    // Sunset/Iftar
    suhoor: 'https://cdn-icons-png.flaticon.com/512/3094/3094155.png',   // Moon/Suhoor
    ramadan: 'https://cdn-icons-png.flaticon.com/512/3655/3655573.png',  // Lantern
    countdown: 'https://cdn-icons-png.flaticon.com/512/3214/3214697.png' // Calendar
};

// Image configuration
const IMAGES = {
    banner: {
        path: './assets/ramadan_banner.png',
        // High quality Ramadan banner (Wikimedia Commons - Reliable)
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Fanoos_Ramadan.jpg/800px-Fanoos_Ramadan.jpg'
    }
};

/**
 * Get image attachment if local file exists, otherwise returns null
 * @returns {AttachmentBuilder|null}
 */
function getBannerAttachment() {
    if (fs.existsSync(IMAGES.banner.path)) {
        return new AttachmentBuilder(IMAGES.banner.path, { name: 'ramadan-banner.png' });
    }
    return null;
}

/**
 * Create a Ramadan message embed with enhanced UI and images
 * @param {string} type - Message type
 * @param {Object} extraFields - Additional fields
 * @returns {Object} { embed, files }
 */
function createRamadanEmbed(type, extraFields = {}) {
    const msg = config.messages[type];
    if (!msg) {
        throw new Error(`Unknown message type: ${type}`);
    }

    // Premium color palette
    const colors = {
        iftar: 0xD4AF37,      // Gold (sunset/breaking fast)
        suhoor: 0x1A237E,     // Deep Indigo (night sky)
        nightOfDoubt: 0x7B1FA2, // Purple (mystery)
        ramadanStarted: 0x00C853, // Green (celebration)
        ramadanEnded: 0xFFD700,    // Bright Gold (Eid)
        taraweeh: 0x4A148C,   // Deep Purple (night prayer)
        earlySuhoor: 0x0D47A1 // Dark Blue (pre-dawn)
    };

    const embed = new EmbedBuilder()
        .setColor(colors[type] || 0x1A237E)
        .setTimestamp();

    // Files array for custom images (user will add per-message images in assets folder)
    // Naming convention: assets/{type}_banner.png (e.g., iftar_banner.png, suhoor_banner.png)
    let files = [];
    const bannerPath = path.resolve(`./assets/${type}_banner.png`);

    if (fs.existsSync(bannerPath)) {
        const attachment = new AttachmentBuilder(bannerPath, { name: `${type}-banner.png` });
        files = [attachment];
        embed.setImage(`attachment://${type}-banner.png`);
    }

    // Premium styling for all message types
    // Title: emoji + title + emoji (symmetrical)
    const titleEmojis = {
        iftar: '✨',
        suhoor: '🌙',
        nightOfDoubt: '🔍',
        ramadanStarted: '🎉',
        ramadanEnded: '🌟',
        status: '📊',
        taraweeh: '🕌',
        earlySuhoor: '🍲'
    };
    const titleEmoji = titleEmojis[type] || msg.emoji;
    embed.setTitle(`${titleEmoji} ${msg.title} ${titleEmoji}`);

    // Description: body + dua/quote
    const duas = {
        iftar: '> *اللهم لك صمت وعلى رزقك أفطرت*',
        suhoor: '> *وبالأسحار هم يستغفرون*',
        nightOfDoubt: '> ⚠️ **يرجى انتظار إعلان ثبوت الرؤية الرسمي**',
        ramadanStarted: '> 📖 *شَهْرُ رَمَضَانَ الَّذِي أُنزِلَ فِيهِ الْقُرْآنُ هُدًى لِّلنَّاسِ وَبَيِّنَاتٍ مِّنَ الْهُدَىٰ وَالْفُرْقَانِ ۚ فَمَن شَهِدَ مِنكُمُ الشَّهْرَ فَلْيَصُمْهُ...*\n> — **سورة البقرة (185)**',
        ramadanEnded: '> *تقبل الله منا ومنكم*',
        taraweeh: '> 📿 *مَنْ قَامَ رَمَضَانَ إِيمَانًا وَاحْتِسَابًا غُفِرَ لَهُ مَا تَقَدَّمَ مِنْ ذَنْبِهِ*',
        earlySuhoor: '> 🤲 *اللهم إني أسألك خير هذه الساعة وخير ما فيها*'
    };

    let description = `**${msg.body}**`;
    if (duas[type]) {
        description += `\n\n${duas[type]}`;
    }
    embed.setDescription(description);

    // Thumbnail GIF (optional, only for iftar now - can be extended)
    if (type === 'iftar') {
        embed.setThumbnail('https://media1.tenor.com/m/0KpPBbtKJHkAAAAC/ramadan.gif');
    }

    // Build structured fields
    const fields = [];

    // Row 1: City, Time, Date (inline for compact look)
    if (extraFields.city) {
        fields.push({
            name: '🕌 المدينة',
            value: `\`${extraFields.city}\``,
            inline: true
        });
    }

    if (extraFields.prayerTime) {
        const timeLabel = type === 'iftar' ? '🌅 الإفطار' : (type === 'suhoor' ? '🌃 السحور' : '⏰ الوقت');
        fields.push({
            name: timeLabel,
            value: `**\`${extraFields.prayerTime}\`**`,
            inline: true
        });
    }

    if (extraFields.hijriDate) {
        fields.push({
            name: '📅 التاريخ',
            value: extraFields.hijriDate,
            inline: true
        });
    }

    // Row 2: Hadith or Dua (full width for emphasis)
    if (type === 'iftar' || type === 'suhoor') {
        fields.push({
            name: '📿 حديث اليوم',
            value: type === 'iftar'
                ? '*"ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الأَجْرُ إِنْ شَاءَ اللهُ"*'
                : '*"السحور بركة فلا تدعوه ولو أن يجرع أحدكم جرعة ماء"*',
            inline: false
        });
    }

    if (fields.length > 0) {
        embed.addFields(fields);
    }

    // Premium Footer
    embed.setFooter({
        text: '🌙 Ramadan Bot • رمضان كريم',
        iconURL: 'https://media1.tenor.com/m/0KpPBbtKJHkAAAAC/ramadan.gif' // Premium moon icon
    });

    return { embed, files };
}

/**
 * Get color based on message type
 * @param {string} type
 * @returns {number}
 */
function getColorForType(type) {
    const colors = {
        iftar: 0xFF8C00,      // Dark Orange (sunset)
        suhoor: 0x1A237E,     // Dark Indigo (night sky)
        ramadanStarted: 0x00C853, // Green
        ramadanEnded: 0xF1C40F,   // Gold
        nightOfDoubt: 0x7B1FA2,   // Purple
        status: 0x2196F3,         // Blue
        countdown: 0xE91E63       // Pink
    };
    return colors[type] || 0x3498DB;
}

/**
 * Create status embed with enhanced UI
 * @param {Object} state - Current state
 * @param {Object} prayerTimes - Today's prayer times
 * @param {string} hijriDate - Current Hijri date
 * @returns {EmbedBuilder}
 */
function createStatusEmbed(state, prayerTimes = null, hijriDate = null) {
    const statusEmoji = state.ramadanActive ? '✅' : '⏸️';
    const statusText = state.ramadanActive ? 'مفعّل' : 'غير مفعّل';
    const statusColor = state.ramadanActive ? 0x00C853 : 0x607D8B;

    const embed = new EmbedBuilder()
        .setTitle(`🌙 حالة بوت رمضان`)
        .setColor(statusColor)
        .setTimestamp();

    // Build description with status box
    let description = '```\n';
    description += '╔══════════════════════════╗\n';
    description += `║   الحالة: ${statusText.padEnd(14)} ║\n`;
    description += '╚══════════════════════════╝\n';
    description += '```';

    embed.setDescription(description);

    const fields = [
        { name: '📊 الحالة', value: `${statusEmoji} ${statusText}`, inline: true },
        { name: '📍 المدينة', value: state.city || 'غير محدد', inline: true }
    ];

    if (hijriDate) {
        fields.push({ name: '📅 التاريخ الهجري', value: hijriDate, inline: true });
    }

    if (prayerTimes && state.ramadanActive) {
        fields.push(
            { name: '🌅 الفجر', value: `\`${prayerTimes.Fajr || 'غير متوفر'}\``, inline: true },
            { name: '🌇 المغرب', value: `\`${prayerTimes.Maghrib || 'غير متوفر'}\``, inline: true }
        );
    }

    embed.addFields(fields);

    if (state.ramadanActive) {
        embed.setFooter({ text: '🌙 رمضان مبارك! البوت يرسل رسائل الفطور والسحور تلقائياً' });
    } else {
        embed.setFooter({ text: '💡 استخدم /ramadan start لتفعيل رسائل رمضان' });
    }

    return embed;
}

/**
 * Create countdown embed with enhanced UI and images
 * @param {number} daysRemaining - Days until Ramadan
 * @param {string} hijriDate - Current Hijri date
 * @param {string} expectedDate - Expected Ramadan date
 * @returns {Object} { embed, files }
 */
function createCountdownEmbed(daysRemaining, hijriDate, expectedDate = null) {
    const embed = new EmbedBuilder()
        .setTitle('🌙 العد التنازلي لرمضان المبارك')
        .setColor(daysRemaining <= 7 ? 0x00C853 : 0xE91E63)
        // High quality animated lantern GIF for modern look
        .setThumbnail('https://media.giphy.com/media/l4FGBpV9kI5z8HuwU/giphy.gif')
        .setTimestamp();

    // Check for custom countdown banner
    const countdownBannerPath = path.resolve('./assets/countdown_banner.png');
    let files = [];

    // Default GIF for thumbnail if no custom banner
    let thumbnail = 'https://media.giphy.com/media/l4FGBpV9kI5z8HuwU/giphy.gif';

    if (fs.existsSync(countdownBannerPath)) {
        const attachment = new AttachmentBuilder(countdownBannerPath, { name: 'countdown-banner.png' });
        files = [attachment];
        embed.setImage('attachment://countdown-banner.png');
        // If we have a big banner, maybe we remove the thumbnail or keep it?
        // User requested "Image", usually means main image. 
        // We'll keep the GIF as thumbnail for variety unless user dislikes.
    } else {
        // Fallback to default ramadan banner if no specific countdown banner
        const attachment = getBannerAttachment();
        if (attachment) {
            files = [attachment];
            embed.setImage('attachment://ramadan-banner.png');
        } else if (IMAGES.banner.url) {
            embed.setImage(IMAGES.banner.url);
        }
    }

    embed.setThumbnail(thumbnail);

    // Create visual countdown display
    let description = '';

    if (daysRemaining === 0) {
        description = `### 🎉 **اليوم أول أيام رمضان!**\n`;
        description += `>>> *رمضان كريم، تقبل الله منا ومنكم الصيام والقيام* 🌙✨`;
    } else if (daysRemaining === 1) {
        description = `### 🔍 **ليلة الشك**\n`;
        description += `>>> *نترقب الهلال بشوق ودعاء...* 🤲`;
    } else {
        description = `**⏳ الأيام المتبقية**\n\n`;
        description += `**[ ${daysRemaining} ] يـوم**\n\n`;
        description += `>>> *اللهم بلغنا رمضان لا فاقدين ولا مفقودين* 📿`;
    }

    embed.setDescription(description);

    const fields = [];

    if (hijriDate) {
        fields.push({
            name: '📅 التاريخ الهجري',
            value: hijriDate,
            inline: true
        });
    }

    if (expectedDate) {
        fields.push({
            name: '📆 الموعد المتوقع',
            value: expectedDate,
            inline: true
        });
    }

    fields.push({
        name: '⏰ الأيام المتبقية',
        value: `**${daysRemaining}** يوم`,
        inline: true
    });

    embed.addFields(fields);

    // Add motivational footer
    const footers = [
        '💫 اللهم بلغنا رمضان',
        '🤲 اللهم أهلّه علينا بالأمن والإيمان',
        '✨ استعدوا لشهر الخير والبركة',
        '📿 اللهم سلمنا لرمضان وسلم رمضان لنا'
    ];
    const randomFooter = footers[Math.floor(Math.random() * footers.length)];

    embed.setFooter({ text: `${randomFooter} | ⚠️ التاريخ تقريبي` });

    return { embed, files };
}

module.exports = {
    createRamadanEmbed,
    createStatusEmbed,
    createCountdownEmbed
};
