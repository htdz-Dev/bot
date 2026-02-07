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

// Set FFmpeg path BEFORE any audio operations
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

/**
 * Play Adhan in the voice channel with the most members
 * @param {Guild} guild - The Discord guild to play in
 */
async function playAdhan(guild) {
    if (!guild) {
        console.error('[Voice] No guild provided');
        return;
    }

    let targetChannel = null;

    // Use specific voice channel if configured
    if (process.env.VOICE_CHANNEL_ID) {
        targetChannel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID);
        if (targetChannel) {
            console.log(`[Voice] Using configured voice channel: ${targetChannel.name}`);
        } else {
            console.log('[Voice] Configured VOICE_CHANNEL_ID not found, searching for active channel...');
        }
    }

    // If no configured channel, find voice channel with most members
    if (!targetChannel) {
        let maxMembers = 0;
        guild.channels.cache.forEach(channel => {
            if (channel.type === ChannelType.GuildVoice && channel.joinable) {
                const memberCount = channel.members.filter(m => !m.user.bot).size;
                if (memberCount > maxMembers) {
                    maxMembers = memberCount;
                    targetChannel = channel;
                }
            }
        });

        if (!targetChannel) {
            console.log(`[Voice] No voice channel found in ${guild.name}`);
            return;
        }
    }

    console.log(`[Voice] Joining "${targetChannel.name}" in "${guild.name}" to play Adhan`);

    try {
        // Destroy existing connection if any
        const existingConnection = getVoiceConnection(guild.id);
        if (existingConnection) {
            console.log('[Voice] Destroying existing connection');
            existingConnection.destroy();
        }

        // Create new connection with selfDeaf: false so bot can transmit audio
        const connection = joinVoiceChannel({
            channelId: targetChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false
        });

        // Debug connection state changes
        connection.on('stateChange', (oldState, newState) => {
            console.log(`[Voice] Connection: ${oldState.status} -> ${newState.status}`);
        });

        connection.on('error', error => {
            console.error('[Voice] Connection error:', error);
        });

        // Wait for connection to be ready
        console.log('[Voice] Waiting for connection to be ready...');
        await entersState(connection, VoiceConnectionStatus.Ready, 10000);
        console.log('[Voice] Connection is ready!');

        // Create audio player with proper configuration
        const player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play // Keep playing even without subscribers temporarily
            }
        });

        // Check audio file
        const resourcePath = path.join(__dirname, '../../assets/adhan.mp3');
        console.log(`[Voice] Audio file path: ${resourcePath}`);

        if (!fs.existsSync(resourcePath)) {
            console.error(`[Voice] Audio file not found: ${resourcePath}`);
            connection.destroy();
            return;
        }

        const stats = fs.statSync(resourcePath);
        console.log(`[Voice] Audio file size: ${stats.size} bytes`);

        // Create audio resource from file path directly (more reliable than stream)
        const resource = createAudioResource(resourcePath, {
            inlineVolume: true
        });

        // Set volume to 100%
        if (resource.volume) {
            resource.volume.setVolume(1);
        }

        console.log('[Voice] Audio resource created successfully');

        // Subscribe connection to player BEFORE playing
        const subscription = connection.subscribe(player);

        if (!subscription) {
            console.error('[Voice] Failed to subscribe player to connection');
            connection.destroy();
            return;
        }

        console.log('[Voice] Player subscribed to connection');

        // Debug player state changes
        player.on('stateChange', (oldState, newState) => {
            console.log(`[Voice] Player: ${oldState.status} -> ${newState.status}`);

            if (newState.status === AudioPlayerStatus.Playing) {
                console.log('[Voice] ✅ Audio is now PLAYING!');
            }
        });

        // Handle player errors
        player.on('error', error => {
            console.error('[Voice] Player error:', error.message);
            console.error('[Voice] Error resource:', error.resource);
            connection.destroy();
        });

        // Leave when finished
        player.on(AudioPlayerStatus.Idle, () => {
            console.log('[Voice] Adhan finished, leaving channel');
            connection.destroy();
        });

        // Start playing immediately
        player.play(resource);
        console.log('[Voice] ▶️ Started playing audio');

    } catch (error) {
        console.error(`[Voice] Error: ${error.message}`);
        console.error(error.stack);

        // Clean up on error
        const conn = getVoiceConnection(guild.id);
        if (conn) conn.destroy();
    }
}

module.exports = { playAdhan };
