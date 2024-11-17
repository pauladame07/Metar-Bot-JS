const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');
const dotenv = require('dotenv');
const os = require('os');

// load environment variables

const TOKEN = proccess.env.TOKEN;
const API_KEY = proccess.env.API_KEY;
const METAR_API_KEY = 'https://avwx.rest/api/metar/';

// create a new discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Log resources usage periodically
setInterval(() => {
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    const cpuUsage = os.loadavg()[0];
    console.log(`Memory Usage: ${memoryUsage.toFixed(2)} MB, CPU Load Average: ${cpuUsage.toFixed(2)}`);}, 10000); // Log every 10 seconds

// Command Registeration
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