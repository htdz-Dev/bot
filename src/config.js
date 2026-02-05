module.exports = {
    // Default city for prayer times
    defaultCity: 'Algiers',
    defaultCountry: 'Algeria',

    // Aladhan API settings
    aladhanApiUrl: 'https://api.aladhan.com/v1',

    // Suhoor reminder time (minutes before Fajr)
    suhoorMinutesBeforeFajr: 15,

    // Expected Ramadan start dates (Gregorian) - Updated annually
    // These are approximate dates based on astronomical calculations
    // The actual date depends on moon sighting
    expectedRamadanDates: {
        2025: { month: 3, day: 1 },   // March 1, 2025 (approx)
        2026: { month: 2, day: 18 },  // February 18, 2026 (approx)
        2027: { month: 2, day: 8 },   // February 8, 2027 (approx)
    },

    // Countdown settings
    countdownSettings: {
        // Send countdown when X days or less remain
        maxDaysToShow: 30,
        // Hour to send daily countdown (24-hour format)
        dailyCountdownHour: 9,
        // Night of doubt is 1 day before expected Ramadan
        nightOfDoubtDaysBefore: 1
    },

    // Messages
    messages: {
        iftar: {
            emoji: '🍽️',
            title: 'صحا فطوركم',
            body: 'تقبل الله منا ومنكم صيامنا وقيامنا'
        },
        suhoor: {
            emoji: '🌙',
            title: 'صحا سحوركم',
            body: 'لا تنسوا النية والدعاء'
        },
        ramadanStarted: {
            emoji: '🌙✨',
            title: 'رمضان مبارك!',
            body: 'تم تفعيل رسائل رمضان. تقبل الله منا ومنكم'
        },
        ramadanEnded: {
            emoji: '✨🎉',
            title: 'عيد مبارك!',
            body: 'تم إيقاف رسائل رمضان. كل عام وأنتم بخير'
        },
        nightOfDoubt: {
            emoji: '🔍',
            title: 'ليلة الشك',
            body: 'ننتظر ثبوت رؤية هلال رمضان المبارك'
        },
        taraweeh: {
            emoji: '🕌',
            title: 'صلاة العشاء والتراويح',
            body: 'حان وقت الاستعداد لصلاة العشاء والتراويح. تقبل الله قيامكم'
        },
        earlySuhoor: {
            emoji: '🍲',
            title: 'تذكير بالسحور',
            body: 'ساعة قبل الإمساك - اغتنموا وقت السحر بالاستغفار والدعاء'
        }
    },

    // State file path
    stateFilePath: './data/state.json'
};
