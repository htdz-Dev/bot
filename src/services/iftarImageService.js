const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');
const config = require('../config');
const { wasMessageSentToday, markMessageSent } = require('../utils/state');

/**
 * Get a random image from the iftar images directory
 * @returns {string|null} Path to formatted image or null if no images found
 */
function getRandomIftarImage() {
    try {
        const imagesDir = path.resolve(config.iftarImage.imagesFolder);

        if (!fs.existsSync(imagesDir)) {
            console.error(`[IftarImage] Directory not found: ${imagesDir}`);
            // Create it properly if it doesn't exist
            fs.mkdirSync(imagesDir, { recursive: true });
            return null;
        }

        const files = fs.readdirSync(imagesDir);
        const imageFiles = files.filter(file =>
            ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(path.extname(file).toLowerCase())
        );

        if (imageFiles.length === 0) {
            console.warn('[IftarImage] No images found in directory');
            return null;
        }

        // Get logic for non-repetition could go here (store used images in state)
        // For now, just simple random
        const randomFile = imageFiles[Math.floor(Math.random() * imageFiles.length)];
        return path.join(imagesDir, randomFile);

    } catch (error) {
        console.error('[IftarImage] Error getting random image:', error.message);
        return null;
    }
}

/**
 * Send the "Belly Stuffing" image to a channel
 * @param {TextChannel} channel - Discord channel
 * @param {Object} channelConfig - Channel configuration
 */
async function sendIftarImage(channel, channelConfig) {
    if (!config.iftarImage.enabled) return;

    if (wasMessageSentToday('iftarImage', channel.id)) {
        console.log(`[IftarImage] Image already sent today for ${channelConfig.city}`);
        return;
    }

    const imagePath = getRandomIftarImage();
    if (!imagePath) return;

    try {
        const attachment = new AttachmentBuilder(imagePath, { name: 'full-belly.png' });

        // Pick a random caption
        const captions = config.iftarImage.captions || ['🫃'];
        const randomCaption = captions[Math.floor(Math.random() * captions.length)];

        await channel.send({
            content: randomCaption,
            files: [attachment]
        });

        markMessageSent('iftarImage', channel.id);
        console.log(`[IftarImage] Sent image to ${channelConfig.city}: ${path.basename(imagePath)}`);

    } catch (error) {
        console.error(`[IftarImage] Error sending image to ${channelConfig.city}:`, error.message);
    }
}

module.exports = {
    sendIftarImage
};
