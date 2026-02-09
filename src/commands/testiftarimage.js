const { SlashCommandBuilder } = require('discord.js');
const { sendIftarImage } = require('../services/iftarImageService');
const { getState } = require('../utils/state');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testiftarimage')
        .setDescription('Test the belly stuffing image feature immediately 🫃'),

    async execute(interaction) {
        // Defer reply since image processing might take a moment
        await interaction.deferReply();

        try {
            // Get channel config or create minimal mock
            const state = getState();
            let channelConfig = state.channels.find(c => c.channelId === interaction.channelId);

            if (!channelConfig) {
                channelConfig = {
                    city: state.defaultCity || 'Unknown City',
                    channelId: interaction.channelId
                };
            }

            // Manually trigger the image send
            await sendIftarImage(interaction.channel, channelConfig);

            await interaction.editReply({
                content: '✅ تم إرسال صورة "تعبئة الكرش" للاختبار!'
            });

        } catch (error) {
            console.error('Error in testiftarimage command:', error);
            await interaction.editReply({
                content: '❌ حدث خطأ أثناء اختبار الصورة.'
            });
        }
    },
};
