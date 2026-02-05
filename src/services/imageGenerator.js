const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Constants for layout - larger for better quality
const WIDTH = 900;
const HEIGHT = 700;

/**
 * Generate Imsakiyah image for the day
 * @param {Object} prayerTimes - Prayer times object
 * @param {string} hijriDate - Formatted Hijri date
 * @param {string} gregorianDate - Formatted Gregorian date
 * @param {string} city - City name
 * @returns {Promise<Buffer>} Image buffer
 */
async function generateImsakiyah(prayerTimes, hijriDate, gregorianDate, city) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // 1. Draw Premium Gradient Background
    const bgGradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bgGradient.addColorStop(0, '#0f0c29');    // Deep purple
    bgGradient.addColorStop(0.5, '#302b63');  // Purple
    bgGradient.addColorStop(1, '#24243e');    // Dark purple
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 2. Add decorative circles (moon-like)
    ctx.fillStyle = 'rgba(212, 175, 55, 0.1)';
    ctx.beginPath();
    ctx.arc(WIDTH - 100, 100, 150, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.arc(100, HEIGHT - 100, 200, 0, Math.PI * 2);
    ctx.fill();

    // 3. Main Content Card (Glassmorphism)
    const cardX = 40;
    const cardY = 40;
    const cardW = WIDTH - 80;
    const cardH = HEIGHT - 80;

    // Card background with blur effect simulation
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 25);
    ctx.fill();

    // Card border
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 25);
    ctx.stroke();

    // 4. Draw Header Section
    ctx.textAlign = 'center';

    // Title with glow effect
    ctx.shadowColor = '#D4AF37';
    ctx.shadowBlur = 20;
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('🌙 إمساكية رمضان 🌙', WIDTH / 2, 100);
    ctx.shadowBlur = 0;

    // Subtitle: Imsakiyah / Imsakiya
    ctx.font = '20px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('Horaires de Prière • أوقات الصلاة', WIDTH / 2, 135);

    // 5. Date Section with elegant styling
    const dateBoxY = 160;
    ctx.fillStyle = 'rgba(212, 175, 55, 0.15)';
    drawRoundRect(ctx, WIDTH / 2 - 200, dateBoxY, 400, 70, 15);
    ctx.fill();

    ctx.font = 'bold 26px Arial';
    ctx.fillStyle = '#D4AF37';
    ctx.fillText(hijriDate, WIDTH / 2, dateBoxY + 30);

    ctx.font = '18px Arial';
    ctx.fillStyle = '#CCCCCC';
    ctx.fillText(gregorianDate, WIDTH / 2, dateBoxY + 55);

    // City badge
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`📍 ${city}`, WIDTH / 2, 260);

    // 6. Prayer Times Grid - 2 rows x 3 columns
    const startY = 300;
    const boxWidth = 250;
    const boxHeight = 100;
    const colGap = 30;
    const rowGap = 25;
    const gridStartX = (WIDTH - (3 * boxWidth + 2 * colGap)) / 2;

    const prayers = [
        { name: 'الفجر', nameEn: 'Fajr', time: prayerTimes.Fajr, icon: '🌅', highlight: true },
        { name: 'الشروق', nameEn: 'Sunrise', time: prayerTimes.Sunrise, icon: '☀️', highlight: false },
        { name: 'الظهر', nameEn: 'Dhuhr', time: prayerTimes.Dhuhr, icon: '🕛', highlight: false },
        { name: 'العصر', nameEn: 'Asr', time: prayerTimes.Asr, icon: '🕒', highlight: false },
        { name: 'المغرب', nameEn: 'Maghrib', time: prayerTimes.Maghrib, icon: '🌇', highlight: true },
        { name: 'العشاء', nameEn: 'Isha', time: prayerTimes.Isha, icon: '🌌', highlight: false }
    ];

    prayers.forEach((prayer, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);

        const x = gridStartX + col * (boxWidth + colGap);
        const y = startY + row * (boxHeight + rowGap);

        // Box styling based on highlight (Fajr/Maghrib)
        if (prayer.highlight) {
            // Highlighted box - gold gradient
            const goldGrad = ctx.createLinearGradient(x, y, x + boxWidth, y + boxHeight);
            goldGrad.addColorStop(0, 'rgba(212, 175, 55, 0.3)');
            goldGrad.addColorStop(1, 'rgba(212, 175, 55, 0.15)');
            ctx.fillStyle = goldGrad;
            ctx.strokeStyle = '#D4AF37';
            ctx.lineWidth = 2;
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
        }

        // Draw box
        drawRoundRect(ctx, x, y, boxWidth, boxHeight, 15);
        ctx.fill();
        ctx.stroke();

        // Icon
        ctx.font = '24px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText(prayer.icon, x + 15, y + 40);

        // Prayer Name (Arabic)
        ctx.textAlign = 'center';
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = prayer.highlight ? '#D4AF37' : '#FFFFFF';
        ctx.fillText(prayer.name, x + boxWidth / 2 + 10, y + 35);

        // Prayer Name (French)
        ctx.font = '14px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText(prayer.nameEn, x + boxWidth / 2 + 10, y + 55);

        // Time
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'right';
        ctx.fillText(prayer.time || '--:--', x + boxWidth - 15, y + 70);
    });

    // 7. Footer
    ctx.textAlign = 'center';
    ctx.font = 'italic 16px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('تقبل الله منا ومنكم صالح الأعمال', WIDTH / 2, HEIGHT - 55);
    ctx.fillText('Que Allah accepte nos bonnes œuvres', WIDTH / 2, HEIGHT - 35);

    return canvas.toBuffer();
}

/**
 * Helper to draw rounded rectangle
 */
function drawRoundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

module.exports = {
    generateImsakiyah
};
