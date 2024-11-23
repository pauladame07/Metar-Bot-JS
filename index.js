import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// API URLs
const METAR_API = 'https://avwx.rest/api/metar/';
const API_KEY = process.env.API_KEY;

// Initialize the Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Slash command registration
const commands = [
  new SlashCommandBuilder()
    .setName('metar')
    .setDescription('Get METAR information for an airport.')
    .addStringOption(option =>
      option
        .setName('icao_code')
        .setDescription('The ICAO code of the airport (e.g., VHHH).')
        .setRequired(true)
    ),
].map(command => command.toJSON());

(async () => {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

// Function to parse and format METAR data
function formatMetarData(data) {
  if (!data) return 'No readable METAR data found.';

  const station = `${data.station} (${data.info.name}, ${data.info.country})`;
  const observedAt = `${data.time.dt}Z`;
  const wind = data.wind
    ? `${data.wind.direction || 'Calm'} at ${data.wind.speed}kt`
    : 'Calm';
  const visibility = `${data.visibility.value || 'N/A'} ${data.visibility.units}`;
  const temperature = `${data.temperature.value}°C (${((data.temperature.value * 9) / 5 + 32).toFixed(1)}°F)`;
  const dewPoint = `${data.dewpoint.value}°C (${((data.dewpoint.value * 9) / 5 + 32).toFixed(1)}°F)`;
  const altimeter = `${data.altimeter.value} hPa (${(data.altimeter.value / 33.8639).toFixed(2)} inHg)`;
  const clouds = data.clouds?.map(c => `${c.text} at ${c.base_ft_agl}ft`).join(', ') || 'Clear skies';
  const flightRules = data.flight_category || 'N/A';

  return `
Readable Report
Station: ${station}
Observed at: ${observedAt}
Wind: ${wind}
Visibility: ${visibility}
Temperature: ${temperature}
Dew Point: ${dewPoint}
Altimeter: ${altimeter}
Clouds: ${clouds}
Flight Rules: ${flightRules}
`;
}

// Fetch METAR data
async function fetchMetar(icaoCode) {
  try {
    const response = await fetch(`${METAR_API}${icaoCode}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch METAR: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching METAR for ${icaoCode}:`, error.message);
    throw error;
  }
}

// Command handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand() || interaction.commandName !== 'metar') return;

  const icaoCode = interaction.options.getString('icao_code');
  await interaction.deferReply();

  try {
    const metarData = await fetchMetar(icaoCode);

    if (!metarData || metarData.error) {
      await interaction.editReply(`No METAR available for **${icaoCode}**.`);
      return;
    }

    const rawMetar = metarData.raw || 'No raw METAR data found.';
    const readableMetar = formatMetarData(metarData);

    await interaction.editReply(
      `METAR for **${icaoCode}**:\n\`\`\`${rawMetar}\`\`\`\n${readableMetar}`
    );
  } catch (error) {
    await interaction.editReply(`An error occurred: ${error.message}`);
  }
});

// Log in to Discord
client.login(TOKEN)
  .then(() => {
    console.log('Bot logged in successfully!');
  })
  .catch((error) => {
    console.error('Error logging in:', error);
  });
