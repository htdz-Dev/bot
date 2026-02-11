const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { getState } = require('../utils/state');

const data = new SlashCommandBuilder()
    .setName('setcity')
    .setDescription('اختر مدينتك لتصلك تنبيهات السحور والإفطار حسب توقيتها');

async function execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const state = getState();
        const channelConfigs = state.channels.filter(c => c.channelId === interaction.channelId);

        if (!channelConfigs || channelConfigs.length === 0) {
            await interaction.editReply({ content: '❌ لم يتم إعداد أي مدن لهذا السيرفر بعد. يرجى الطلب من المسؤول استخدام `/ramadan setup`.' });
            return;
        }

        // Filter out configs without roles (optional, but good for cleanliness)
        // Actually, we should show all cities, even if they don't have a role (maybe they just want to set preference? but role is key here)
        // User requirement: "Assign role". So we need roles.
        // Let's list all configured cities.

        const options = channelConfigs.map(config => {
            return {
                label: `${config.city}, ${config.country}`,
                description: `توقيت: ${config.timezone || 'تلقائي'}`,
                value: `${config.city}::${config.country}`, // Separator
                emoji: config.country.toLowerCase().includes('algeria') ? '🇩🇿' : '🌍' // Simple emoji logic
            };
        });

        // Add "Algeria (Default)" explicitly if it exists and is not duplicate? 
        // User requested: "Make first option: Algeria (Default)"

        // Let's sort options to put Algeria first
        options.sort((a, b) => {
            if (a.label.includes('Algeria') || a.label.includes('Algiers')) return -1;
            if (b.label.includes('Algeria') || b.label.includes('Algiers')) return 1;
            return 0;
        });

        // Add "Default/Remove" option?
        // User said: "Default = Algeria". So selecting Algeria IS selecting default.

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('city_select')
            .setPlaceholder('اختر مدينتك / Select your city')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.editReply({
            content: '📍 **اختر مدينتك من القائمة أدناه:**\nسيتم منحك رتبة المدينة المختارة لتصلك التنبيهات في وقتها الصحيح.',
            components: [row]
        });

    } catch (error) {
        console.error('Error in setcity command:', error);
        await interaction.editReply({ content: '❌ حدث خطأ أثناء تحضير القائمة.' });
    }
}

/**
 * Handle interaction for city selection (Menu)
 * NOTE: This needs to be called from index.js interactionCreate event
 */
async function handleCitySelection(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'city_select') return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const selectedValue = interaction.values[0];
        const [city, country] = selectedValue.split('::');

        const state = getState();
        // Find the specific config for this city in this channel
        const targetConfig = state.channels.find(c =>
            c.channelId === interaction.channelId &&
            c.city === city &&
            c.country === country
        );

        if (!targetConfig) {
            await interaction.editReply({ content: '❌ لم يعد هذا الإعداد متاحاً.' });
            return;
        }

        const member = interaction.member;
        const guild = interaction.guild;

        // 1. Remove ALL other city roles for this channel/guild
        // We need to know which roles are "city roles".
        // We can iterate over all channel configs for this channel and remove their roles from the user.
        const allChannelConfigs = state.channels.filter(c => c.channelId === interaction.channelId);

        for (const config of allChannelConfigs) {
            if (config.roleId && member.roles.cache.has(config.roleId)) {
                await member.roles.remove(config.roleId).catch(console.error);
            }
        }

        // 2. Add the selected role
        if (targetConfig.roleId) {
            const role = await guild.roles.fetch(targetConfig.roleId);
            if (role) {
                await member.roles.add(role);
                await interaction.editReply({ content: `✅ **تم!** تم اختيار **${city}** وتفعيل التنبيهات الخاصة بها. 🌙` });
            } else {
                await interaction.editReply({ content: `⚠️ تم اختيار المدينة **${city}**، لكن الرتبة الخاصة بها لم تعد موجودة في السيرفر.` });
            }
        } else {
            await interaction.editReply({ content: `✅ **تم!** تم اختيار **${city}**. (لا توجد رتبة خاصة بهذه المدينة، ستصلك التنبيهات العامة).` });
        }

    } catch (error) {
        console.error('Error handling city selection:', error);
        await interaction.editReply({ content: '❌ حدث خطأ أثناء تحديث مدينتك.' });
    }
}

module.exports = {
    data,
    execute,
    handleCitySelection
};
