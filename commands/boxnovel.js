const cheerio = require("cheerio");
const fetch = require("node-fetch");
const configVars = require("../EnvLoader");
const { prefix } = configVars.env;
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
  name: "box",
  description:
    "Scrape chapters from the given link for the specified N number of chapters!",
  usage: `${prefix}box <link> *N`,
  example: `${prefix}box https://boxnovel.com/novel/lord-of-the-mysteries-webnovel/chapter-1 60`,
  args: false,
  guildOnly: false,
  async execute(message, args) {
    let chapterCount = 0;
    let bookContent = [];
    let link = args[0];
    let linkMetadata = {};
    if (!link.includes("boxnovel")) {
      return message.reply(
        `\`boxnovel\` command only supports boxnovel novels.`
      );
    }
    let novelName = link
      .replace("https://boxnovel.com/novel/", "")
      .split("/")[0]
      .split("-")
      .join(" ")
      .replace("webnovel", "")
      .trim();
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
        console.log("processing :" + link);
        if (numTries >= 10) break;
        console.time("chapter loop");
        console.time("chapter Fetch");
        let page = await fetch(link)
          .then((res) => res.text())
          .catch((err) => console.log(err.message));
        console.timeEnd("chapter Fetch");
        // console.log(page);
        console.time("cheerio load");
        const $ = cheerio.load(page);
        console.timeEnd("cheerio load");
        let chapterContent;
        let chapterName = $("div.cha-tit > h3").text();
        if (chapterName) {
          chapterContent =
            "<hr/>" + $("div.chap-content > div.cha-words").html();
          if ((chapterContent = "<hr/>null"))
            chapterContent = "<hr/>" + $("div.cha-words").html();
        } else if (
          $("div.reading-content > div.text-left > p:nth-child(1)").text()
        ) {
          chapterName = $(
            "div.reading-content > div.text-left > p:nth-child(1)"
          ).text();
          $("div.reading-content > div.text-left > p:nth-child(1)").remove();
          chapterContent =
            "<hr/>" + $("div.reading-content > div.text-left").html();
        } else if (
          $("div.reading-content > div.text-left > h3:nth-child(1)").text()
        ) {
          chapterName = $(
            "div.reading-content > div.text-left > h3:nth-child(1)"
          ).text();
          $("div.reading-content > div.text-left > h3:nth-child(1)").remove();
          chapterContent =
            "<hr/>" + $("div.reading-content > div.text-left").html();
        } else if (
          $("div.reading-content > div.text-left > h4:nth-child(1)").text()
        ) {
          chapterName = $(
            "div.reading-content > div.text-left > h4:nth-child(1)"
          ).text();
          $("div.reading-content > div.text-left > h4:nth-child(1)").remove();
          chapterContent =
            "<hr/>" + $("div.reading-content > div.text-left").html();
        } else if (
          $("div.reading-content > div.text-left > h1:nth-child(1)").text()
        ) {
          chapterName = $(
            "div.reading-content > div.text-left > h1:nth-child(1)"
          ).text();
          $("div.reading-content > div.text-left > h1:nth-child(1)").remove();
          chapterContent =
            "<hr/>" + $("div.reading-content > div.text-left").html();
        } else if (
          $(
            "div.reading-content > div.text-left > div.text-left > h3:nth-child(1)"
          ).text()
        ) {
          chapterName = $(
            "div.reading-content > div.text-left > div.text-left > h3:nth-child(1)"
          ).text();
          $(
            "div.reading-content > div.text-left > div.text-left > h3:nth-child(1)"
          ).remove();
          chapterContent =
            "<hr/>" +
            $("div.reading-content > div.text-left > div.text-left").html();
        }

        if (!chapterName) {
          chapterName = _s
            .capitalize(
              link
                .replace("https://boxnovel.com/novel/", "")
                .split("/")
                .pop()
                .split("-")
                .join(" ")
            )
            .trimRight();
        }

        if (chapterContent == "<hr/>null") {
          chapterContent =
            "<hr/>" + $("div.reading-content > div.text-left").html();
        }

        console.log(chapterName);
        // console.log(chapterContent);
        // return;
        const nextChapterLink = $(
          "div.nav-links > div.nav-next > a.btn.next_page"
        )
          .first()
          .attr("href");
        link = nextChapterLink;
        nextChapterLink
          ? (nextChapterExists = true)
          : (nextChapterExists = false);
        console.log("Next chpater exists: " + nextChapterExists);
        if (chapterName && chapterContent) {
          bookContent.push({
            title: chapterName,
            data: chapterContent,
          });
        } else {
          console.log("skipping current chapter");
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

    try {
      processingMessage.edit(`making epub!`);
    } catch (error) {
      console.log(error);
    }

    const option = {
      title: bookTitle, // *Required, title of the book.
      author: bookAuthor, // *Required, name of the author.
      publisher: "BoxNovel", // optional
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
