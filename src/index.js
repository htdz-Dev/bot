require('dotenv').config();

const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const { initScheduler, scheduleRamadanMessages } = require('./services/scheduler');
const { isRamadanActive, getState } = require('./utils/state');
const ramadanCommand = require('./commands/ramadan');

// Validate environment variables
if (!process.env.DISCORD_TOKEN) {
    console.error('❌ Error: DISCORD_TOKEN is not set in .env file');
    process.exit(1);
}

if (!process.env.GUILD_ID) {
    console.error('❌ Error: GUILD_ID is not set in .env file');
    process.exit(1);
}

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// Commands collection
client.commands = new Collection();
client.commands.set(ramadanCommand.data.name, ramadanCommand);

// Register slash commands
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('🔄 Registering slash commands...');

        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
            { body: [ramadanCommand.data.toJSON()] }
        );

        console.log('✅ Slash commands registered successfully');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
}

// Handle ready event
client.once('ready', async () => {
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
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
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
