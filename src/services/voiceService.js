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
const { spawn } = require('child_process');

// Set FFmpeg path BEFORE any audio operations
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

// Force prism-media to use our ffmpeg
const prism = require('prism-media');

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

        // If still no channel with members, just pick the first joinable one
        if (!targetChannel) {
            targetChannel = guild.channels.cache.find(
                ch => ch.type === ChannelType.GuildVoice && ch.joinable
            );
        }

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
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Create new connection
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
        await entersState(connection, VoiceConnectionStatus.Ready, 15000);
        console.log('[Voice] Connection is ready!');

        // Small delay to ensure connection is stable
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Create audio player
        const player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play
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
        console.log(`[Voice] Audio file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        // Create audio resource using FFmpeg transcoder for better compatibility
        console.log('[Voice] Creating audio resource with FFmpeg transcoder...');

        const ffmpegProcess = spawn(ffmpegPath, [
            '-i', resourcePath,
            '-analyzeduration', '0',
            '-loglevel', '0',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            'pipe:1'
        ], { stdio: ['pipe', 'pipe', 'pipe'] });

        ffmpegProcess.on('error', (err) => {
            console.error('[Voice] FFmpeg process error:', err);
        });

        ffmpegProcess.stderr.on('data', (data) => {
            console.error('[Voice] FFmpeg stderr:', data.toString());
        });

        // Create Opus encoder
        const encoder = new prism.opus.Encoder({
            rate: 48000,
            channels: 2,
            frameSize: 960
        });

        const opusStream = ffmpegProcess.stdout.pipe(encoder);

        const resource = createAudioResource(opusStream, {
            inputType: require('@discordjs/voice').StreamType.Opus,
            inlineVolume: true
        });

        // Set volume
        if (resource.volume) {
            resource.volume.setVolume(1.0);
            console.log('[Voice] Volume set to 100%');
        }

        console.log('[Voice] Audio resource created');

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

            if (newState.status === AudioPlayerStatus.AutoPaused) {
                console.log('[Voice] ⚠️ AutoPaused - trying to unpause...');
                player.unpause();
            }
        });

        // Handle player errors
        player.on('error', error => {
            console.error('[Voice] Player error:', error.message);
            console.error('[Voice] Error details:', error);
            ffmpegProcess.kill();
            connection.destroy();
        });

        // Leave when finished
        player.on(AudioPlayerStatus.Idle, () => {
            console.log('[Voice] Adhan finished, leaving channel');
            ffmpegProcess.kill();
            connection.destroy();
        });

        // Start playing
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
