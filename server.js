const express = require("express");
const log = require("./pinglog.txt");
const moment = require("moment");
const server = express();

const DiscordClient = {};
server.all("/", (req, res) => {
  res.send("Your bot is alive!");
});

server.all("/uptimerobot", (req, res) => {
  console.log("pinged at ", new Date());
  if (DiscordClient.client) {
    DiscordClient.client.guilds.cache.forEach((guild, guildId, guildCache) => {
      guild.channels.cache.forEach((channel, channelId, channelCache) => {
        // console.log(channel.name);
        if (
          channel.name == DiscordClient.logChannel &&
          guild.name == DiscordClient.myTestGuild
        ) {
          channel.send(
            `Got Pinged by ${
              req.query.client ? req.query.client : "me"
            } @ ${moment()}`
          );
        }
      });
    });
  }
  res.send("Your bot is alive!");
});

function keepAlive(client, validChannelsList, myTestGuild, logChannel) {
  server.listen(3003, () => {
    console.log("Server is Ready!");
    setTimeout(() => {
      DiscordClient.client = client;
      DiscordClient.validChannelsList = validChannelsList;
      DiscordClient.myTestGuild = myTestGuild;
      DiscordClient.logChannel = logChannel;
    }, 5000);
  });
}
module.exports = keepAlive;
