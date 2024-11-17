const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');
const dotenv = require('dotenv');
const os = require('os');

// Load environment variables
dotenv.config();

const TOKEN = process.env.TOKEN;
const API_KEY = process.env.API_KEY;
const METAR_API = 'https://avwx.rest/api/metar/';

// Create a new Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Log resource usage periodically
setInterval(() => {
    const memoryUsage = process.memoryUsage().rss / 1024 / 1024; // RSS: Resident Set Size (actual memory usage)
    const cpuUsage = os.loadavg()[0]; // 1-minute load average
    console.log(`Memory Usage: ${memoryUsage.toFixed(2)} MB, CPU Load Average: ${cpuUsage.toFixed(2)}`);
}, 10000); // Log every 10 seconds

// Command registration
const commands = [
    new SlashCommandBuilder()
        .setName('metar')
        .setDescription('Get METAR information for an airport.')
        .addStringOption(option =>
            option.setName('icao_code')
                .setDescription('The ICAO code of the airport (e.g., RPLL)')
                .setRequired(true)),
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('Slash commands registered.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
})();

// Command handling
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'metar') {
        const icaoCode = options.getString('icao_code');
        await interaction.deferReply(); // Acknowledge the command

        try {
            const response = await axios.get(`${METAR_API}${icaoCode}`, {
                headers: { Authorization: `Bearer ${API_KEY}` }
            });

            const data = response.data;
            const metarInfo = data.raw || 'No METAR data found.';

            await interaction.followUp(`METAR for **${icaoCode}**:\n\`\`\`${metarInfo}\`\`\``);
            console.log(`Command: metar, Argument: ${icaoCode}, Status: Success`);
        } catch (error) {
            console.error(`Error fetching METAR for ${icaoCode}:`, error);
            await interaction.followUp('Error fetching METAR data. Please try again later.');
            console.log(`Command: metar, Argument: ${icaoCode}, Status: Failed`);
        }
    }
});

// Log bot ready event
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Login to Discord
client.login(TOKEN);