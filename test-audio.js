// Test script to verify audio dependencies
require('dotenv').config();

console.log('🔍 Checking audio dependencies...\n');

// Check FFmpeg
try {
    const ffmpegPath = require('ffmpeg-static');
    const fs = require('fs');
    console.log('✅ ffmpeg-static installed');
    console.log(`   Path: ${ffmpegPath}`);
    console.log(`   Exists: ${fs.existsSync(ffmpegPath)}`);
} catch (e) {
    console.log('❌ ffmpeg-static: NOT INSTALLED');
}

// Check prism-media
try {
    const prism = require('prism-media');
    console.log('✅ prism-media installed');
    console.log(`   Available: ${Object.keys(prism).join(', ')}`);
} catch (e) {
    console.log('❌ prism-media: NOT INSTALLED');
}

// Check opusscript
try {
    const OpusScript = require('opusscript');
    console.log('✅ opusscript installed');
} catch (e) {
    console.log('❌ opusscript: NOT INSTALLED');
}

// Check libsodium
try {
    const sodium = require('libsodium-wrappers');
    console.log('✅ libsodium-wrappers installed');
} catch (e) {
    console.log('❌ libsodium-wrappers: NOT INSTALLED');
}

// Check audio file
const path = require('path');
const fs = require('fs');
const audioPath = path.join(__dirname, 'assets/adhan.mp3');
console.log(`\n🔍 Checking audio file...`);
console.log(`   Path: ${audioPath}`);
if (fs.existsSync(audioPath)) {
    const stats = fs.statSync(audioPath);
    console.log(`✅ File exists (${(stats.size / 1024).toFixed(2)} KB)`);
} else {
    console.log('❌ Audio file NOT FOUND');
}

// Check @discordjs/voice
console.log('\n🔍 Checking @discordjs/voice...');
try {
    const { generateDependencyReport } = require('@discordjs/voice');
    console.log(generateDependencyReport());
} catch (e) {
    console.log('❌ Could not generate dependency report:', e.message);
}

console.log('\n✅ Diagnostic complete!');
