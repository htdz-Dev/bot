const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const path = require('path');
const { ChannelType } = require('discord.js');

/**
 * Play Adhan in the voice channel with the most members
 * @param {Guild} guild - The Discord guild to play in
 */
async function playAdhan(guild) {
    if (!guild) return;

    // Find voice channel with most members (excluding bots)
    let targetChannel = null;
    let maxMembers = 0;

    guild.channels.cache.forEach(channel => {
        if (channel.type === ChannelType.GuildVoice && channel.joinable) {
            // Count non-bot members
            const memberCount = channel.members.filter(m => !m.user.bot).size;

            if (memberCount > maxMembers) {
                maxMembers = memberCount;
                targetChannel = channel;
            }
        }
    });

    if (!targetChannel || maxMembers === 0) {
        console.log(`[Voice] No active voice channel found in ${guild.name} to play Adhan`);
        return;
    }

    console.log(`[Voice] Joining ${targetChannel.name} in ${guild.name} to play Adhan`);

    try {
        const connection = joinVoiceChannel({
            channelId: targetChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
        });

        // Handle connection ready
        await entersState(connection, VoiceConnectionStatus.Ready, 5000);

        const player = createAudioPlayer();
        const resourcePath = path.join(__dirname, '../../assets/adhan.mp3');
        const resource = createAudioResource(resourcePath);

        player.play(resource);
        connection.subscribe(player);

        console.log(`[Voice] Playing Adhan in ${targetChannel.name}`);

        // Leave when finished
        player.on(AudioPlayerStatus.Idle, () => {
            console.log('[Voice] Adhan finished, leaving channel');
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
            }
        });

        player.on('error', error => {
            console.error(`[Voice] Error playing Adhan: ${error.message}`);
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
            }
        });

    } catch (error) {
        console.error(`[Voice] Connection error: ${error.message}`);
    }
}

module.exports = { playAdhan };
