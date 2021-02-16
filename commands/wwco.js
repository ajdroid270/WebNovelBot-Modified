const cheerio = require("cheerio");
const fetch = require("node-fetch");
const configVars = require("../EnvLoader");
const { prefix } = configVars.env;
const Epub = require("epub-gen");
const _ = require("underscore");
const path = require("path");
const fs = require("fs");
const {
  nuSearchShort,
  nuScrapeMetadata,
  uploadFileToDrive,
  driveTmpFolder,
  getDriveEmbed,
  wwcoScrapeMetadata,
} = require("../helper");

module.exports = {
  name: "wwco",
  description: `Scrape chapters from the given link for the specified N number of chapters!`,
  usage: `${prefix}wwco link *N`,
  example: `${prefix}wwco https://m.wuxiaworld.co/The-Second-Coming-of-Gluttony/5013560.html 60`,
  args: true,
  guildOnly: true,
  experimental: false,
  async execute(message, args) {
    let chapterCount = 0;
    let bookContent = [];
    let link = args[0];
    let linkMetadata = {};
    if (!link.includes("wuxiaworld.co/")) {
      return message.reply(`\`ww\` command only supports wuxiaworld novels.`);
    }
    let novelName = link
      .replace("https://www.wuxiaworld.co/", "")
      .split("/")[0]
      .split("-")
      .join(" ");
    try {
      searchResults = await nuSearchShort(
        novelName.trim().substring(0, 10),
        false,
        false
      );
      if (searchResults.length == 0) {
        console.log("nu long search");
        searchResults = await nuSearchLong(
          novelName.trim().split(" "),
          false,
          false
        );
      }
      console.log(searchResults);
    } catch (error) {
      console.log(error.message);
    }
    let nuLink = searchResults[0];
    try {
      linkMetadata = await nuScrapeMetadata(nuLink);
    } catch (error) {
      console.log(error.message);
      linkMetadata = await wwcoScrapeMetadata(link);
    }
    let maxChapters = _.isNaN(args[1]) ? null : args[1];
    let nextChapterExists = true;
    let processingMessage;
    let bookTitle = linkMetadata.title;
    let bookAuthor = linkMetadata.authors;
    let bookCoverArt = linkMetadata.image;
    let customCss =
      "h1,h2,h3,h4,h5,h6,b,strong{color:#cc5635;font-style:italic;padding:0;margin:0}p,li{text-align:justify;text-indent:3%}br{text-align:justify;text-indent:3%}div{text-align:justify;text-indent:3%}";
    let cancelProcess = false;
    let numTries = 1;
    while (nextChapterExists) {
      try {
        if (numTries >= 10) break;
        let page = await fetch(link)
          .then((res) => res.text())
          .catch((err) => console.log(err.message));
        const $ = cheerio.load(page);
        !bookTitle
          ? (bookTitle = $(
              "div.read-container > div.book-wrapper > div.book-name"
            )
              .text()
              .trim())
          : null;
        !bookAuthor
          ? (bookAuthor = $(
              "div.read-container > div.book-wrapper > div.author > span.author-name"
            ).text())
          : null;
        const chapterName = $(
          "div#section-list-wp > section.section > h1.chapter-title"
        )
          .text()
          .trim();
        const nextChapterLink = `https://www.wuxiaworld.co${$(
          "div.read-container > div.reader-page > a.next"
        ).attr("href")}`;
        link = nextChapterLink;
        nextChapterLink
          ? (nextChapterExists = true)
          : (nextChapterExists = false);
        $(
          "#section-list-wp > section.section > div.chapter-entity > script"
        ).remove();
        $(
          "#section-list-wp > section.section > div.chapter-entity > ins"
        ).remove();
        $(
          "#section-list-wp > section.section > div.chapter-entity > br"
        ).insertAfter("<br>");
        const chapterContent =
          "<hr/><p>" +
          $("#section-list-wp > section.section > div.chapter-entity").html() +
          "</p>";
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
        numTries = 1;
      } catch (error) {
        console.log(error.message);
        console.log(`trying to load ${link} again`);
        numTries++;
      }
    }

    try {
      processingMessage.edit(`making epub!`);
    } catch (error) {
      console.log(error);
    }

    const option = {
      title: bookTitle, // *Required, title of the book.
      author: bookAuthor, // *Required, name of the author.
      publisher: "WuxiaWorld", // optional
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
