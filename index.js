const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');
const dotenv = require('dotenv');
const os = require('os');

// Load environment variables
dotenv.config();

const TOKEN = process.env.TOKEN;
const API_KEY = process.env.API_KEY;
const METAR_API = 'https://avwx.rest/api/metar/';
const VATSIM_API = 'https://data.vatsim.net/v3/vatsim-data.json';
const IVAO_API = 'https://api.ivao.aero/v2/data/whazzup';

// Create a new Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Log resource usage periodically
setInterval(() => {
    const memoryUsage = process.memoryUsage().rss / 1024 / 1024; // RSS: Resident Set Size (actual memory usage)
    const cpuUsage = os.loadavg()[0]; // 1-minute load average
    console.log(`Memory Usage: ${memoryUsage.toFixed(2)} MB, CPU Load Average: ${cpuUsage.toFixed(2)}`);}, 10000); // Log every 10 seconds

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

// Function to fetch ATIS
async function fetchATIS(icaoCode) {
    try {
        // Step 1: Check VATSIM for ATIS
        const vatsimResponse = await axios.get(VATSIM_API);
        const vatsimData = vatsimResponse.data;

        const vatsimATIS = vatsimData.controllers.find(
            (controller) => controller.callsign.startsWith(icaoCode) && controller.facility_type === 4 // Facility Type 4: ATIS
        );

        if (vatsimATIS) {
            return `VATSIM ATIS:\n${vatsimATIS.text}`;
        }

        // Step 2: Check IVAO for ATIS
        const ivaoResponse = await axios.get(IVAO_API);
        const ivaoData = ivaoResponse.data;

        const ivaoATIS = ivaoData.clients.controllers.find(
            (controller) => controller.callsign.startsWith(icaoCode) && controller.rating === 'ATIS'
        );

        if (ivaoATIS) {
            return `IVAO ATIS:\n${ivaoATIS.atis}`;
        }

        // Step 3: Fallback
        return 'ATIS Unavailable';
    } catch (error) {
        console.error('Error fetching ATIS:', error);
        return 'ATIS Unavailable';
    }
}

// Main Command Handling
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'metar') {
        const icaoCode = options.getString('icao_code').toUpperCase();
        await interaction.deferReply(); // Acknowledge the command

        try {
            const metarResponse = await axios.get(`${METAR_API}${icaoCode}`, {
                headers: { Authorization: `Bearer ${API_KEY}` },
            });

            const data = metarResponse.data;

            console.log('METAR API Response:', JSON.stringify(data, null, 2)); // Debug log

            if (!data || !data.raw) {
                await interaction.followUp('No METAR data found for the specified ICAO code.');
                return;
            }

            // Fetch ATIS data
            const atis = await fetchATIS(icaoCode);

            // Construct the readable report
            const readableReport = `
**Raw METAR:** \`${data.raw}\`

**Readable Report**
**Station:** ${data.station} (${data.info?.name || 'Unknown'}, ${data.info?.city || ''})
**Observed at:** ${data.time?.repr || 'Unknown'}
**Wind:** ${data.wind_direction?.value || 'Variable'}° at ${data.wind_speed?.value || '0'}kt
**Visibility:** ${data.visibility?.repr || 'N/A'}
**Temperature:** ${data.temperature?.value ?? 'N/A'}°C (${data.temperature ? ((data.temperature.value * 9) / 5 + 32).toFixed(0) : 'N/A'}°F)
**Dew Point:** ${data.dewpoint?.value ?? 'N/A'}°C (${data.dewpoint ? ((data.dewpoint.value * 9) / 5 + 32).toFixed(0) : 'N/A'}°F)
**Altimeter:** ${data.altimeter?.value || 'N/A'} hPa
**Clouds:** ${
                data.clouds?.length
                    ? data.clouds
                          .map(
                              (c) =>
                                  `${c.repr || 'Unknown'} at ${
                                      c.base_ft_agl ? `${c.base_ft_agl}ft` : 'unknown altitude'
                                  }`
                          )
                          .join(', ')
                    : 'Clear skies'
            }
**Flight Rules:** ${data.flight_rules || 'N/A'}

**ATIS:** ${atis}
            `;

            await interaction.followUp(readableReport);
            console.log(`Command: metar, Argument: ${icaoCode}, Status: Success`);
        } catch (error) {
            console.error(`Error fetching METAR for ${icaoCode}:`, error);
            await interaction.followUp('Error fetching METAR data. Please try again later.');
        }
    }
});


// Log bot ready event
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Login to Discord
client.login(TOKEN);