const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Constants for layout
const WIDTH = 800;
const HEIGHT = 600;

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

    // 1. Draw Background
    try {
        const bannerPath = path.resolve('./assets/ramadan_banner.png');
        if (fs.existsSync(bannerPath)) {
            const background = await loadImage(bannerPath);
            // Draw background covering the whole canvas, maintaining aspect ratio or stretching
            // For a schedule, we might want a darker overlay
            ctx.drawImage(background, 0, 0, WIDTH, HEIGHT);
        } else {
            // Fallback gradient
            const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
            gradient.addColorStop(0, '#1a237e'); // Deep Blue
            gradient.addColorStop(1, '#000000'); // Black
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
        }
    } catch (error) {
        console.error('Error loading background:', error);
        ctx.fillStyle = '#1a237e';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // 2. Add Dark Overlay for readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(20, 20, WIDTH - 40, HEIGHT - 40);

    // Add decorative border
    ctx.strokeStyle = '#D4AF37'; // Gold
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, WIDTH - 60, HEIGHT - 60);

    // 3. Draw Header
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';

    // Title
    ctx.font = 'bold 40px "Arial"'; // Use system font or load custom if available
    ctx.fillText('🌙 إمساكية رمضان 🌙', WIDTH / 2, 80);

    // Date Info
    ctx.font = '24px "Arial"';
    ctx.fillStyle = '#D4AF37'; // Gold
    ctx.fillText(hijriDate, WIDTH / 2, 120);
    ctx.fillStyle = '#EEEEEE';
    ctx.fillText(gregorianDate, WIDTH / 2, 150);

    // City
    ctx.font = 'italic 20px "Arial"';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText(`📍 ${city}`, WIDTH / 2, 180);

    // 4. Draw Prayer Times Table
    const startY = 240;
    const padding = 50;

    const prayers = [
        { name: 'الفجر', time: prayerTimes.Fajr, icon: '🌅' },
        { name: 'الشروق', time: prayerTimes.Sunrise, icon: '☀️' },
        { name: 'الظهر', time: prayerTimes.Dhuhr, icon: '🕛' },
        { name: 'العصر', time: prayerTimes.Asr, icon: '🕒' },
        { name: 'المغرب', time: prayerTimes.Maghrib, icon: '🌇' },
        { name: 'العشاء', time: prayerTimes.Isha, icon: '🌌' }
    ];

    // Table Layout
    const boxWidth = (WIDTH - 100) / 3 - 20; // 3 columns
    const boxHeight = 80;
    const colGap = 20;
    const rowGap = 20;

    ctx.textAlign = 'center';

    prayers.forEach((prayer, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);

        const x = 50 + col * (boxWidth + colGap);
        const y = startY + row * (boxHeight + rowGap);

        // Box background
        // Highlight Maghrib and Fajr
        if (prayer.name === 'المغرب' || prayer.name === 'الفجر') {
            ctx.fillStyle = 'rgba(212, 175, 55, 0.2)'; // Gold tint
            ctx.strokeStyle = '#D4AF37';
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        }

        // Draw box
        // ctx.roundRect is not reliable in node-canvas without newer versions or global patching
        // Using helper function instead
        drawRoundRect(ctx, x, y, boxWidth, boxHeight, 10);
        ctx.fill();
        ctx.stroke();

        // Prayer Name & Icon
        ctx.font = 'bold 22px "Arial"';
        ctx.fillStyle = '#D4AF37'; // Gold text for name
        ctx.fillText(prayer.name, x + boxWidth / 2, y + 30);

        // Prayer Time
        ctx.font = 'bold 28px "Arial"';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(prayer.time, x + boxWidth / 2, y + 65);
    });

    // 5. Footer
    ctx.font = 'italic 18px "Arial"';
    ctx.fillStyle = '#CCCCCC';
    ctx.fillText('تقبل الله منا ومنكم صالح الأعمال', WIDTH / 2, HEIGHT - 50);
    ctx.fillText('Discord Ramadan Bot', WIDTH / 2, HEIGHT - 25);

    return canvas.toBuffer();
}

/**
 * Helper to draw rounded rectangle
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} x 
 * @param {number} y 
 * @param {number} w 
 * @param {number} h 
 * @param {number} r 
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
