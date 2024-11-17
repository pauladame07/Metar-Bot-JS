import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv'; // To load environment variables like bot token
import fetch from 'node-fetch';

// Load environment variables from .env
dotenv.config();

// Example nearby airports API for fallback
const NEARBY_AIRPORTS_API = 'https://avwx.rest/api/station/nearby/';
const METAR_API = 'https://avwx.rest/api/metar/';
const API_KEY = process.env.API_KEY;  // Use the API_KEY from the .env file

// Initialize the Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.Interactions,
  ],
});

// Function to fetch METAR
async function fetchMetar(icaoCode) {
  try {
    const response = await fetch(`${METAR_API}${icaoCode}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (response.status === 404) {
      return null; // No METAR available
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    return data.raw || null; // Return raw METAR string
  } catch (error) {
    console.error(`Error fetching METAR for ${icaoCode}: ${error.message}`);
    throw error;
  }
}

// Function to fetch closest airport's METAR
async function fetchClosestMetar(lat, lon) {
  try {
    const response = await fetch(`${NEARBY_AIRPORTS_API}${lat},${lon}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    const data = await response.json();
    if (!data || data.length === 0) return null; // No nearby airports found

    // Iterate through nearby airports to find one with METAR data
    for (const airport of data) {
      const metar = await fetchMetar(airport.icao);
      if (metar) return { icao: airport.icao, metar };
    }

    return null; // No METAR found in nearby airports
  } catch (error) {
    console.error(`Error fetching nearby airports: ${error.message}`);
    throw error;
  }
}

// /metar command handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand() || interaction.commandName !== 'metar') return;

  const icaoCode = interaction.options.getString('icao_code');
  await interaction.deferReply(); // Acknowledge the command

  try {
    let metar = await fetchMetar(icaoCode);

    if (!metar) {
      // Fallback: Find the closest METAR
      const fallbackResponse = await fetch(
        `https://avwx.rest/api/station/${icaoCode}`,
        {
          headers: { Authorization: `Bearer ${API_KEY}` },
        }
      );

      const stationData = await fallbackResponse.json();
      if (!stationData.latitude || !stationData.longitude) {
        await interaction.editReply(
          `No METAR available for **${icaoCode}**, and location data is unavailable for finding the closest airport.`
        );
        return;
      }

      const closestMetar = await fetchClosestMetar(
        stationData.latitude,
        stationData.longitude
      );

      if (closestMetar) {
        await interaction.editReply(
          `No METAR available for **${icaoCode}**. Closest METAR is at **${closestMetar.icao}**:\n\`\`\`${closestMetar.metar}\`\`\``
        );
      } else {
        await interaction.editReply(
          `No METAR data available for **${icaoCode}** or nearby airports.`
        );
      }
    } else {
      await interaction.editReply(
        `METAR for **${icaoCode}**:\n\`\`\`${metar}\`\`\``
      );
    }
  } catch (error) {
    await interaction.editReply(
      `An error occurred while fetching METAR data: ${error.message}`
    );
  }
});

// Log in to Discord with the bot token from the environment
client.login(process.env.TOKEN)
  .then(() => {
    console.log('Bot logged in successfully!');
  })
  .catch((error) => {
    console.error('Error logging in:', error);
  });
