const { prefix } = process.env;
module.exports = {
  name: "help",
  description: "Lists all of my commands or info about a specific command.",
  aliases: ["commands", "command", "list"],
  usage: `${prefix}help *<command name>`,
  cooldown: 5,
  execute(message, args) {
    const data = [];
    const { commands } = message.client;
    const search = commands.get("search");
    const scrape = commands.get("scrape");
    const driveCommand = commands.get("drive");
    if (!args.length) {
      data.push({
        name: "Commands:",
        value: `${commands
          .map((command) => `*${command.name}*: \`${command.usage}\``)
          .join("\n")}`,
      });
      data.push({
        name: "NOTE:",
        value: `\nThe \`<link>\` mentioned above is that of the ***CHAPTER*** link! NOT the novel details link`,
      });
      data.push({
        name: "Detailed Info:",
        value: `\nYou can send \`${prefix}help [command name]\` to get detailed info on a specific command!`,
      });
      data.push({
        name: "ADVISORY:",
        value: `Always try \`!drive\` command first!\nIf the results are not satisfactory, then use \`!scrape\` command\n`,
      });
      data.push({
        name: "Issues:",
        value: `\`LNMTL is facing login issues.\``,
      });

      // return message.reply(data, { split: true });
      message.channel.send({
        content: "",
        embed: {
          title: "WebnovelBot Helper",
          description: "Here's a list of all available commands.",
          color: 5019476,
          timestamp: Date.now(),
          footer: {
            text: "WebnovelBot",
          },
          fields: data,
        },
      });
    } else {
      const name = args[0].toLowerCase();
      const command =
        commands.get(name) ||
        commands.find((c) => c.aliases && c.aliases.includes(name));

      if (!command) {
        return message.reply("that's not a valid command!");
      }

      data.push({
        name: "Name:",
        value: `${command.name}`,
      });

      if (command.aliases)
        data.push({
          name: "Aliases:",
          value: `\`${command.aliases.join(", ")}\``,
        });
      if (command.description)
        data.push({
          name: "Description:",
          value: `${command.description}`,
        });
      if (command.usage)
        data.push({
          name: "Usage:",
          value: `${command.usage}`,
        });
      if (command.example)
        data.push({
          name: "Example:",
          value: `${command.example}`,
        });
      if (command.experimental)
        data.push({
          name: "Experimental:",
          value: `${command.experimental}\nThis is an experimental command. To enable experimental commands, use \`\`\`!experimental allow\`\`\``,
        });
      data.push({
        name: "Cooldown:",
        value: `${command.cooldown ? command.cooldown + " second(s)" : "None"}`,
      });

      // message.reply(data, { split: true });
      message.channel.send({
        content: "",
        embed: {
          title: "WebnovelBot Helper",
          description: "",
          color: 5019476,
          timestamp: Date.now(),
          footer: {
            text: "WebnovelBot",
          },
          fields: data,
        },
      });
    }
  },
};
