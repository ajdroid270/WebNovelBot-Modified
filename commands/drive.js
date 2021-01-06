const configVars = require("../EnvLoader");
const { prefix } = configVars.env;
let driveFiles = require("../drive-files.json");
const {
  updateDriveFiles,
  getDriveEmbed,
  getDrives,
  matchWords,
  searchDriveFiles,
  paginateData,
} = require("../helper");
const _ = require("underscore");

module.exports = {
  name: "drive",
  description: "Download novel epub!",
  aliases: ["epub", "download"],
  usage: `${prefix}drive name`,
  example: `${prefix}drive martial god asura or mga`,
  args: true,
  guildOnly: false,
  async execute(message, args) {
    const { commands } = message.client;
    const search = commands.get("search");

    console.log(args[0]);

    if (!driveFiles.length) {
      await updateDriveFiles();
    }

    if (args[0] == "refresh") {
      await updateDriveFiles();
      driveFiles = require("../drive-files.json");
      return message.reply("Drive refreshed successfully!");
    }

    if (args[0] == "drives") {
      await getDrives();
      return;
    }

    if (args[0] == "pagination") {
      await paginateData([], message);
      return;
    }

    m_args = args
      .join(".")
      .toLowerCase()
      .split(`'`)
      .join(``)
      .split(".")
      .join(" ");
    console.log({ m_args });

    // let regex;
    // if (m_args.length == 1) {
    //   regex = RegExp(m_args[0].split("").join("[^>]*?", "gi"));
    // } else {
    //   regex = RegExp(`${m_args.join("[^>]*?")}`, "gi");
    // }
    // console.log({ regex });

    // let files = driveFiles.filter((file, ind, arr) => {
    //   let isEpub = file.name.includes(".epub");
    //   let isMatch = regex.test(
    //     file.name.replace(".epub", "").toLocaleLowerCase()
    //   );
    //   return isEpub && isMatch && file.mimeType == "application/epub+zip";
    // });
    let files = searchDriveFiles(m_args);
    console.log(files.length);
    if (!files.length) {
      let infoMessage = await message.reply(
        `No novels that match \`${args.join(
          " "
        )}\`\nSearching for \`${args.join(" ")}\`...`
      );
      let editInterval = setInterval(() => {
        infoMessage.edit((infoMessage.content += "."));
      }, 500);
      setTimeout(() => {
        clearInterval(editInterval);
        infoMessage.delete();
      }, 5000);
      return search.execute(message, args);
    }

    const patron = !!message.member.roles.cache.find(
      (r) =>
        r.name.toLocaleLowerCase() === "patron" ||
        r.name.toLocaleLowerCase() === "heroes"
    );
    console.log("Patron: ", patron);

    let selectedFile;
    let selectedFilesMessage;
    if (files.length > 1) {
      // let fileNames = [];
      // files.forEach((file, i, arr) => {
      //   if(i<20){
      //     fileNames.push(`${i + 1}. ${file.obj.name.replace(".epub", "")}`);
      //   }
      // });
      const length = files.length;
      console.log({ length });
      let optionsMessage = await paginateData(files, message, {
        searchString: m_args,
        pageLength: 10,
      });
      try {
        console.log("inside try catch");
        let choiceHelp = await message.reply(
          "Enter comma separated indices of novels to choose the novels you want to download!"
        );
        const filter = (m) => {
          return m.author.id == message.author.id;
        };
        const collector = message.channel.createMessageCollector(filter, {
          max: 1,
          time: 60000,
        });

        collector.on("collect", async (m) => {
          console.log(`Collected ${m.content}`);
          selectedFilesMessage = m;
          selectedOptions = m.content.split(",");
          for (v of selectedOptions) {
            let num = +v.trim();
            if (_.isNumber(num) && v > 0 && v <= length) {
              selectedFile = files[num - 1].obj;
              message.channel.send(await getDriveEmbed(selectedFile, false));
            } else {
              console.log("option is number: " + _.isNumber(num));
            }
          }
        });

        collector.on("end", async (collected) => {
          let timeOutMessage;
          collected.size
            ? null
            : (timeOutMessage = await message.reply(
                "Selection Timeout! Use `!drive <name>` to get the epub."
              ));
          optionsMessage.delete();
          collected.size ? selectedFilesMessage.delete() : null;
          choiceHelp.delete();
          message.delete();
          collected.size
            ? null
            : setTimeout(() => {
                timeOutMessage.delete();
              }, 60000);
          console.log(`Collected ${collected.size} items`);
        });
      } catch (error) {
        await message.reply("Too many results! Please refine the search.");
        setTimeout(() => {
          message.delete();
        }, 60000);
        return 0;
      }
    } else {
      selectedFile = files[0];
      message.channel.send(await getDriveEmbed(selectedFile.obj, false));
    }
  },
};
