const cheerio = require("cheerio");
const fetch = require("node-fetch");
const { prefix } = process.env;
const Epub = require("epub-gen");
const _ = require("underscore");
const _s = require("underscore.string");
const path = require("path");
const fs = require("fs");
const {
  nuSearchShort,
  nuScrapeMetadata,
  uploadFileToDrive,
  driveTmpFolder,
  getDriveEmbed,
} = require("../helper");

module.exports = {
  name: "rln",
  description:
    "Scrape chapters from the given link for the specified N number of chapters!",
  usage: `${prefix}rln <link> *N`,
  example: `${prefix}rln https://www.readlightnovel.org/warlock-of-the-magus-world/chapter-1 60`,
  args: true,
  guildOnly: false,
  async execute(message, args) {
    let chapterCount = 0;
    let bookContent = [];
    let link = args[0];
    let linkMetadata = {};
    if (!link.includes("readlightnovel")) {
      return message.reply(
        `\`rln\` command only supports readlightnovel novels.`
      );
    }
    let novelName = link
      .replace("https://www.readlightnovel.org/", "")
      .split("/")[0]
      .split("-")
      .join(" ");
    let searchResults = await nuSearchShort(novelName, false, false);
    let nuLink = searchResults[0];
    linkMetadata = await nuScrapeMetadata(nuLink);
    let maxChapters = _.isNaN(args[1]) ? null : args[1];
    let nextChapterExists = true;
    let processingMessage;
    let bookTitle = linkMetadata.title;
    let bookAuthor = linkMetadata.authors;
    let bookCoverArt = linkMetadata.image;
    let customCss =
      "h1,h2,h3,h4,h5,h6,b,strong{color:#cc5635;font-style:italic;padding:0;margin:0}p,li{text-align:justify;text-indent:3%}br{text-align:justify;text-indent:3%}div{text-align:justify;text-indent:3%}";
    let cancelProcess = false;
    // return;
    while (nextChapterExists) {
      let numTries = 1;
      try {
        if (numTries >= 10) break;
        console.time("chapter loop");
        console.time("chapter Fetch");
        let page = await fetch(link)
          .then((res) => res.text())
          .catch((err) => console.log(err.message));
        console.timeEnd("chapter Fetch");
        page.replace("Previous Chapter", "");
        // console.log(page);
        const $ = cheerio.load(page);
        console.time("remove");
        $("div.trinity-player-iframe-wrapper").remove();
        $("div.chapter-content3 > div.desc > script").remove();
        $("center > div > script").remove();
        $("div.chapter-content3 > div.desc > hr").remove();
        $("div.chapter-content3 > div.desc > small.ads-title").remove();
        $("div#growfoodsmart.hidden").remove();
        console.timeEnd("remove");
        console.time("chapter name");
        const chapterName = _s.capitalize(
          link
            .replace("https://www.readlightnovel.org/", "")
            .split("/")
            .pop()
            .split("-")
            .join(" ")
        );
        console.timeEnd("chapter name");
        if (chapterName.includes("(Teaser")) {
          nextChapterExists = false;
          break;
        }
        console.time("chapter next link");
        const nextChapterLink = $("ul.chapter-actions > li:nth-child(3) > a")
          .first()
          .attr("href");
        link = nextChapterLink;
        nextChapterLink
          ? (nextChapterExists = true)
          : (nextChapterExists = false);
        console.timeEnd("chapter next link");
        const chapterContent =
          "<hr/>" + $("div.chapter-content3 > div.desc").html();
        if (chapterName && chapterContent) {
          bookContent.push({
            title: chapterName,
            data: chapterContent,
          });
        }
        chapterCount++;
        console.log(`chapters processed: ${chapterCount}`);
        let instructionText = `React with \:pause_button: to make epub with currently processed chapters.\nReact with \:stop_button: to cancel the process.`;
        if (processingMessage) {
          chapterCount % 5 == 0
            ? processingMessage.edit(`chapters processed: ${chapterCount}`)
            : null;
        } else {
          processingMessage = await message.channel.send(
            `chapters processed: ${chapterCount}`
          );
          const filter = (reaction, user) => {
            return true;
          };
        }
        if (chapterCount >= maxChapters) {
          break;
        }
        console.timeEnd("chapter loop");
      } catch (error) {
        console.log(error.message);
        console.log(`trying to load ${link} again`);
        numTries++;
      }
    }

    processingMessage.edit(`making epub!`);

    const option = {
      title: bookTitle, // *Required, title of the book.
      author: bookAuthor, // *Required, name of the author.
      publisher: "ReadLightNovel", // optional
      cover: bookCoverArt,
      content: bookContent,
      version: 2,
      css: customCss,
    };

    if (!cancelProcess) {
      new Epub(
        option,
        path.resolve(process.cwd(), `./epubs/${bookTitle}.epub`)
      ).promise
        .then(async () => {
          let fileStat = fs.lstatSync(
            path.resolve(process.cwd(), `./epubs/${bookTitle}.epub`)
          );
          if (fileStat.size > 8000000) {
            let file = await uploadFileToDrive(
              path.resolve(process.cwd(), `./epubs/${bookTitle}.epub`),
              driveTmpFolder,
              `${bookTitle}_${Date.now()}.epub`
            );
            let embed = await getDriveEmbed(file);
            message.reply(embed);
          } else {
            await message
              .reply({
                files: [
                  path.resolve(process.cwd(), `./epubs/${bookTitle}.epub`),
                ],
              })
              .catch((error) => console.log(error.message));
          }
          fs.unlink(
            path.resolve(process.cwd(), `./epubs/${bookTitle}.epub`),
            () => {}
          );
          processingMessage.delete();
        })
        .catch((err) => console.error(err.message));
    } else {
      processingMessage.delete();
      message.channel.send("Process stopped.");
    }
  },
};
