const Discord = require("discord.js");
const fetch = require("node-fetch");
const FormData = require("form-data");
const _ = require("underscore");
const fs = require("fs");
const cheerio = require("cheerio");
const keepAlive = require('./server');
const dotenv = require("dotenv");
dotenv.config();
const myConfig = process.env;
const { prefix, token, experimental, logChannel } = myConfig;
const myTestGuild = myConfig.guild;
const validChannelsList = myConfig.channelName.split(",");
console.log({ validChannelsList: validChannelsList });

const client = new Discord.Client();
client.commands = new Discord.Collection();
const commandFiles = fs
  .readdirSync("./commands")
  .filter((file) => file.endsWith(".js"));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
}
const cooldowns = new Discord.Collection();

function sendList(message, list, options) {
  message.reply(`Here are the search results`);
  list.forEach((item, i) => {
    message.channel.send(`${i + 1}: ${item}`);
  });
}
function getReply(message, options) {
  message.channel
    .awaitMessages((response) => message.content, {
      max: 1,
      time: 10000,
      errors: ["time"],
    })
    .then((collected) => {
      console.log(collected.first().content);
      const msgStr1 = collected.first().content;
      const args1 = msgStr1.split(/ +/);
      message.channel.send(`Your choice is: ${args1[0]}`);
    })
    .catch(function(e) {
      console.log(e);
      message.channel.send("You didnt select an option");
    });
}

client.once("ready", () => {
  client.guilds.cache.forEach((guild, guildId, guildCache) => {
    guild.channels.cache.forEach((channel, channelId, channelCache) => {
      // console.log(channel.name);
      if (
        validChannelsList.includes(channel.name) &&
        guild.name == myTestGuild
      ) {
        channel.send(`I am online! at ${Date.now()}`);
      }
    });
  });
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", (message) => {
  if (validChannelsList.includes(message.channel.name)) {
    const msgStr = message.content.slice(prefix.length).trim();
    const args = msgStr.split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const command =
      client.commands.get(commandName) ||
      client.commands.find(
        (cmd) => cmd.aliases && cmd.aliases.includes(commandName)
      );
    if (!command) return;

    if (command.args && !args.length) {
      let reply = ` You didn't provide any arguments!`;
      if (command.usage) {
        reply += `\nThe proper usage would be: \`${command.usage}\`\nEg: \`${command.example}\``;
      }
      return message.reply(reply);
    }

    if (!experimental && command.experimental) {
      console.log("experimental feature illegally accessed.");
      return message.reply(
        `This is an experimental feature.\nEnable experimental features to use this command.`
      );
    }
    if (!cooldowns.has(command.name)) {
      cooldowns.set(command.name, new Discord.Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || 0) * 1000;

    if (timestamps.has(message.author.id)) {
      const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        return message.reply(
          `please wait ${timeLeft.toFixed(
            1
          )} more second(s) before reusing the \`${command.name}\` command.`
        );
      }
    } else {
      timestamps.set(message.author.id, now);
      setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
    }

    try {
      command.execute(message, args, client);
    } catch (error) {
      console.error(error);
      message.reply("there was an error trying to execute that command!");
    }
  }
});

keepAlive(client, validChannelsList, myTestGuild, logChannel);
client.login(token);