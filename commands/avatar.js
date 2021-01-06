const configVars = require("../EnvLoader");
const { prefix } = configVars.env;
module.exports = {
  name: "avatar",
  description:
    "Gives avatars of users you tag. Gives your avatar if you don't tag anyone.",
  aliases: ["dp", "pp"],
  args: false,
  usage: `${prefix}avatar *<user>`,
  example: `${prefix}avatar @ZoroJuro`,
  guildOnly: true,
  execute(message, args) {
    if (!message.mentions.users.size) {
      return message.channel.send(
        `Your avatar: <${message.author.displayAvatarURL({
          format: "png",
          dynamic: true,
        })}>`
      );
    }

    const avatarList = message.mentions.users.map((user) => {
      return `${user.username}'s avatar: <${user.displayAvatarURL({
        format: "png",
        dynamic: true,
      })}>`;
    });

    // send the entire array of strings as a message
    // by default, discord.js will `.join()` the array with `\n`
    message.channel.send(avatarList);
  },
};
