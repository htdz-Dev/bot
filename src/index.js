require('dotenv').config();

const { Client, GatewayIntentBits, Collection, REST, Routes, MessageFlags, Events } = require('discord.js');
// ... 

// Handle ready event
client.once(Events.ClientReady, async () => {
    console.log(`\n🌙 ═══════════════════════════════════════`);
    console.log(`   بوت رمضان المبارك`);
    console.log(`   Logged in as: ${client.user.tag}`);
    console.log(`═══════════════════════════════════════ 🌙\n`);

    // Register commands
    await registerCommands();

    // Initialize scheduler
    initScheduler(client);

    // If Ramadan was active before restart, reschedule messages
    if (isRamadanActive()) {
        const state = getState();
        console.log(`📍 Ramadan is active. City: ${state.city}`);
        console.log(`📢 Channel ID: ${state.channelId}`);
        await scheduleRamadanMessages();
    } else {
        console.log('⏸️ Ramadan is not active. Use /ramadan start to activate.');
    }
});

// Handle interactions
client.on('interactionCreate', async (interaction) => {
    // Handle String Select Menu (City Selection)
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'city_select') {
            await setCityCommand.handleCitySelection(interaction);
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`Command not found: ${interaction.commandName}`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);

        const errorMessage = '❌ حدث خطأ أثناء تنفيذ الأمر';

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
        }
    }
});

// Handle guild join (Bot joins a guild)
client.on('guildCreate', async (guild) => {
    console.log(`🎉 Joined new guild: ${guild.name} (${guild.id})`);

    // 1. Register commands
    await registerCommands(guild.id);

    // 2. Find a channel to send welcome message and set as default
    // Try system channel first, then first viewable/sendable text channel
    let targetChannel = guild.systemChannel;

    if (!targetChannel || !targetChannel.viewable || !targetChannel.permissionsFor(guild.members.me).has('SendMessages')) {
        targetChannel = guild.channels.cache.find(c =>
            c.type === 0 && // Text Channel
            c.viewable &&
            c.permissionsFor(guild.members.me).has('SendMessages')
        );
    }

    if (targetChannel) {
        console.log(`   - Found target channel: ${targetChannel.name} (${targetChannel.id})`);

        // 3. Initialize State: Set Algiers, Algeria as default for this channel
        try {
            const { updateCity } = require('./utils/state');
            // updateCity(city, country, channelId, timezone, roleId)
            updateCity('Algiers', 'Algeria', targetChannel.id, 'Africa/Algiers', null);
            console.log(`   - Auto-configured Algiers for ${guild.name}`);

            // 4. Send Welcome Message
            const welcomeMessage = `🌙 **شكراً لإضافة Ramadan Bot إلى سيرفركم!**\n\n` +
                `📍 **الإعداد الافتراضي:**\n` +
                `تم ضبط المدينة تلقائياً على: **🇩🇿 الجزائر (Algiers)**\n` +
                `التوقيت: **Africa/Algiers**\n\n` +
                `⚙️ **كيفية التعديل:**\n` +
                `• لتغيير المدينة لهذا الروم: \`/ramadan setup city:Name country:Country\`\n` +
                `• لإضافة مدن أخرى: كرر الأمر السابق.\n` +
                `• للأعضاء: استخدموا \`/setcity\` لاختيار مدينتكم المفضلة.\n\n` +
                `رمضان مبارك! ✨`;

            await targetChannel.send(welcomeMessage);
        } catch (error) {
            console.error(`   ❌ Error auto-configuring guild: ${error.message}`);
        }
    } else {
        console.warn(`   ⚠️ Could not find a suitable channel to send welcome message in ${guild.name}`);
    }
});

// Handle new member join (Auto-assign Default/Algeria Role)
client.on('guildMemberAdd', async (member) => {
    console.log(`New member joined: ${member.user.tag}`);
    try {
        const state = getState();

        // Find if there is a default city configured for this guild (via any channel)
        // We prioritize "Algeria" or "Algiers" config.
        const guildChannels = member.guild.channels.cache.map(c => c.id);
        const guildConfigs = state.channels.filter(c => guildChannels.includes(c.channelId));

        if (guildConfigs.length > 0) {
            // Find config for "Algeria" or "Algiers"
            const defaultConfig = guildConfigs.find(c =>
                (c.country && c.country.toLowerCase().includes('algeria')) ||
                (c.city && c.city.toLowerCase().includes('algiers'))
            );

            if (defaultConfig && defaultConfig.roleId) {
                const role = await member.guild.roles.fetch(defaultConfig.roleId);
                if (role) {
                    await member.roles.add(role);
                    console.log(`Assigning default role to ${member.user.tag}: ${role.name}`);

                    // Create DM channel
                    const dmChannel = await member.createDM();
                    if (dmChannel) {
                        try {
                            await dmChannel.send(`مرحباً بك في سيرفر **${member.guild.name}**! 🌙\nتم تعيين مدينتك افتراضياً إلى **${defaultConfig.city}** (${defaultConfig.country}).\nإذا كنت من مدينة أخرى، يمكنك تغييرها باستخدام الأمر \`/setcity\` في السيرفر.`);
                        } catch (err) {
                            console.log(`Could not send DM to ${member.user.tag}`);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error assigning default role:', error);
    }
});

// Handle errors
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    client.destroy();
    process.exit(0);
});

// Login
client.login(process.env.DISCORD_TOKEN);
