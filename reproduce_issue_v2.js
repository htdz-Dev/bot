require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const CHANNEL_ID = process.env.CHANNEL_ID;

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    if (!CHANNEL_ID) {
        console.error('CHANNEL_ID is not set in .env');
        client.destroy();
        return;
    }

    // Test: Fetch and send to Real Channel
    try {
        console.log(`Attempting to fetch channel ${CHANNEL_ID}...`);
        const channel = await client.channels.fetch(CHANNEL_ID);

        if (!channel) {
            console.error('Channel not found (fetch returned null/undefined)');
        } else {
            console.log(`Channel fetched: ${channel.name} (${channel.id}, Type: ${channel.type})`);
            console.log(`Permissions for me:`, channel.permissionsFor(client.user).toArray());

            if (!channel.permissionsFor(client.user).has('SendMessages')) {
                console.error('MISSING PERMISSION: SendMessages');
            }
            if (!channel.permissionsFor(client.user).has('ViewChannel')) {
                console.error('MISSING PERMISSION: ViewChannel');
            }

            console.log('Attempting to send message...');
            // Try sending a message
            await channel.send('Debug: Testing permissions for Scheduler [Ignore this].');
            console.log('Message sent successfully!');
        }
    } catch (error) {
        console.error('Error during test:', error);
        if (error.code === 50001) {
            console.error('CONFIRMED: Missing Access (Error 50001)');
        }
    }

    console.log('Test completed. Exiting...');
    client.destroy();
});

client.on('error', (err) => {
    console.error('Client Error:', err);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('Failed to login:', err);
});
