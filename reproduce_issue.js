require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
});

const CHANNEL_ID = process.env.CHANNEL_ID;
const FAKE_ID = 'channel-2';

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    // Test 1: Fetch and send to Real Channel
    try {
        console.log(`Attempting to fetch channel ${CHANNEL_ID}...`);
        const channel = await client.channels.fetch(CHANNEL_ID);
        console.log(`Channel fetched: ${channel.name} (${channel.type})`);
        
        console.log('Attempting to send message...');
        await channel.send('Debug: Testing permissions for Scheduler.');
        console.log('Message sent successfully!');
    } catch (error) {
        console.error('Error with Real Channel:', error.code, error.message);
    }

    // Test 2: Fetch Fake ID
    try {
        console.log(`Attempting to fetch fake channel ${FAKE_ID}...`);
        const channel = await client.channels.fetch(FAKE_ID);
        console.log('Fake channel fetched?', channel);
    } catch (error) {
        console.error('Error with Fake Channel:', error.code, error.message);
    }

    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
