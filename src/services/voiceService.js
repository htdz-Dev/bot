const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    NoSubscriberBehavior,
    getVoiceConnection
} = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');
const { ChannelType } = require('discord.js');

// Set FFmpeg path
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

/**
 * Play Adhan in the specified voice channel
 */
async function playAdhan(guild) {
    if (!guild) {
        console.error('[Voice] No guild provided');
        return;
    }

    // Get the first available voice channel
    let targetChannel = null;

    if (process.env.VOICE_CHANNEL_ID) {
        targetChannel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID);
    }

    if (!targetChannel) {
        targetChannel = guild.channels.cache.find(
            ch => ch.type === ChannelType.GuildVoice && ch.joinable
        );
    }

    if (!targetChannel) {
        console.log('[Voice] No voice channel found');
        return;
    }

    console.log(`[Voice] Target channel: ${targetChannel.name}`);

    try {
        // Clean up any existing connection
        const existing = getVoiceConnection(guild.id);
        if (existing) {
            existing.destroy();
            await new Promise(r => setTimeout(r, 500));
        }

        // Join voice channel
        const connection = joinVoiceChannel({
            channelId: targetChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false
        });

        console.log('[Voice] Waiting for connection...');
        await entersState(connection, VoiceConnectionStatus.Ready, 20000);
        console.log('[Voice] Connected!');

        // Wait a bit for stability
        await new Promise(r => setTimeout(r, 500));

        // Create player
        const player = createAudioPlayer({
            behaviors: { noSubscriber: NoSubscriberBehavior.Play }
        });

        // Audio file path
        const audioPath = path.join(__dirname, '../../assets/adhan.mp3');
        console.log(`[Voice] Audio: ${audioPath}`);
        console.log(`[Voice] File exists: ${fs.existsSync(audioPath)}`);

        // Create resource - let @discordjs/voice handle the transcoding
        const resource = createAudioResource(audioPath);
        console.log('[Voice] Resource created');

        // Subscribe and play
        connection.subscribe(player);
        console.log('[Voice] Subscribed');

        player.on('stateChange', (old, cur) => {
            console.log(`[Voice] Player: ${old.status} -> ${cur.status}`);
        });

        player.on('error', err => {
            console.error('[Voice] Player error:', err);
            connection.destroy();
        });

        player.on(AudioPlayerStatus.Idle, () => {
            console.log('[Voice] Finished');
            connection.destroy();
        });

        player.play(resource);
        console.log('[Voice] Playing...');

    } catch (error) {
        console.error('[Voice] Error:', error);
        const conn = getVoiceConnection(guild.id);
        if (conn) conn.destroy();
    }
}

module.exports = { playAdhan };
