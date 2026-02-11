const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { playAdhan } = require('../services/voiceService');
const { isAdmin, getPermissionDeniedMessage } = require('../utils/permissions');

const data = new SlashCommandBuilder()
    .setName('testadhan')
    .setDescription('🔊 Test audio playback in voice channel');

async function execute(interaction) {
    // Check permissions
    if (!isAdmin(interaction.member)) {
        await interaction.reply({
            content: getPermissionDeniedMessage(),
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (!interaction.guild) {
        await interaction.reply({
            content: '❌ This command must be used in a server',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.reply({
        content: '🔊 Testing Adhan audio... Check console for debug logs!',
        flags: MessageFlags.Ephemeral
    });

    console.log('\n========================================');
    console.log('[TestAdhan] Starting audio test...');
    console.log('========================================\n');

    try {
        await playAdhan(interaction.guild);
        console.log('[TestAdhan] playAdhan function completed');
    } catch (error) {
        console.error('[TestAdhan] Error:', error);
    }
}

module.exports = { data, execute };
