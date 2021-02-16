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
  nuSearchLong,
  mtlnScrapeMetadata,
} = require("../helper");

module.exports = {
  name: "mtln",
  description: `Scrape chapters from the given link for the specified N number of chapters!`,
  usage: `${prefix}mtln link *N`,
  example: `${prefix}mtln https://www.mtlnovel.com/douluo-dalu-4-final-douluo/chapter-1-what-is-that-repair 60`,
  args: true,
  guildOnly: true,
  experimental: false,
  async execute(message, args) {
    let chapterCount = 0;
    let bookContent = [];
    let link = args[0];
    let linkMetadata = {};
    let curChapIndex = -1;
    if (!link.includes("www.mtlnovel.com")) {
      return message.reply(
        `\`mtln\` command only supports www.mtlnovel.com novels.`
      );
    }
    linkMetadata = await mtlnScrapeMetadata(link);
    console.log("linkMetadata.title: " + linkMetadata.title);
    linkMetadata.chaptersList.find((chap, i) => {
      if (chap.chapLink.includes(link)) {
        curChapIndex = i;
      }
    });
    console.log("cur chapter index: " + curChapIndex);
    let maxChapters = _.isNaN(args[1]) ? null : args[1];
    let nextChapterExists = true;
    let processingMessage;
    let bookTitle = linkMetadata.title;
    console.log("bookTitle: " + bookTitle);
    let bookAuthor = linkMetadata.authors;
    let bookCoverArt = linkMetadata.image;
    let customCss =
      "h1,h2,h3,h4,h5,h6,b,strong{color:#cc5635;font-style:italic;padding:0;margin:0}p,li{text-align:justify;text-indent:3%}br{text-align:justify;text-indent:3%}div{text-align:justify;text-indent:3%}";
    let cancelProcess = false;
    let numTries = 1;
    for (
      let i = curChapIndex;
      i < (curChapIndex + maxChapters || linkMetadata.chaptersList.length);
      i++
    ) {
      chapLink = linkMetadata.chaptersList[i].chapLink;
      console.log("Current Chapter Link: " + chapLink);
      try {
        if (numTries >= 10) break;
        let page = await fetch(chapLink)
          .then((res) => res.text())
          .catch((err) => console.log(err.message));
        // console.log(page);
        page.replace("Previous Chapter", "");
        const $ = cheerio.load(page);
        !bookTitle
          ? (bookTitle = $("div.crumbs > span:nth-child(2)")
              .first()
              .text()
              .trim())
          : null;
        let chapterName = linkMetadata.chaptersList[i].chapTitle;
        chapterName
          ? null
          : (chapterName = $(
              "div.m-card.single-page > div.crumbs > span.current-crumb"
            )
              .first()
              .text()
              .trim());
        $("div.ads").remove();
        $("amp-iframe").remove();
        const chapterContent = "<hr/>" + $("div.post-content > div.par").html();
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
        i--;
        console.log(error.message);
        console.log(`trying to load ${chapLink} again`);
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
      publisher: "MTLNovel", // optional
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
