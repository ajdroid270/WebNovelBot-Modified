const configVars = require("../EnvLoader");
const { prefix } = configVars.env;
module.exports = {
  name: "kick",
  description: `This doesn't do anything yet. Just a shell`,
  args: true,
  usage: `${prefix}kick <user>`,
  example: `${prefix}kick @ZoroJuro`,
  guildOnly: true,
  execute(message, args) {
    if (!message.member.hasPermission("KICK_MEMBERS")) {
      return message.reply(
        `You don't have permission to execute this command!`
      );
    } else {
      if (!message.mentions.users.size) {
        return message.reply("you need to tag a user in order to kick them!");
      }

      const taggedUser = message.mentions.users.first();
      message.channel.send(`You wanted to kick: ${taggedUser.username}`);
    }
  },
};
