const cheerio = require("cheerio");
const configVars = require("../EnvLoader");
const { prefix } = configVars.env;
const Epub = require("epub-gen");
const _ = require("underscore");
const path = require("path");
const fs = require("fs");
const cloudscraper = require("cloudscraper");
const {
  uploadFileToDrive,
  driveTmpFolder,
  getDriveEmbed,
} = require("../helper");
const { default: fetch } = require("node-fetch");

module.exports = {
  name: "chup",
  siteNovelPrefix: "https://www.chapterupdates.com/novel/",
  description:
    "Scrape chapters from the given link for the specified N number of chapters!",
  usage: `${prefix}chup <link> *N`,
  example: `${prefix}chup https://www.chapterupdates.com/novel/a-will-eternal/chapter-1 60`,
  args: false,
  guildOnly: false,
  async extractChapters(chapters, bookId, novelHomePageLink) {
    let link = `https://srv.chapterupdates.com/bookinfo/chapter?nType=2&szBookID=${bookId}&nOffset=0&nLimit=${chapters}&nSort=2&nIsSubscribe=1&szAppData=`;
    let data = await fetch(link).then((res) => res.json());
    data.anyData.aryChapter.map((v) => {
      v.link = `${novelHomePageLink}chapter-${v.szChapterID}`;
      v.name = v.szChapterName;
      return v;
    });
    return data.anyData.aryChapter;
  },
  async getMetaData(novelHomePageLink) {
    let metadata = {};
    var options = cloudscraper.defaultParams;
    options = {
      ...options,
      method: "GET",
      uri: novelHomePageLink,
      // Cloudscraper automatically parses out timeout required by Cloudflare.
      // Override cloudflareTimeout to adjust it.
      cloudflareTimeout: 5000,
      // Reduce Cloudflare's timeout to cloudflareMaxTimeout if it is excessive
      cloudflareMaxTimeout: 30000,
      // followAllRedirects - follow non-GET HTTP 3xx responses as redirects
      followAllRedirects: true,
    };
    let page = await cloudscraper(options);
    const $ = cheerio.load(page);
    console.time("metadata");
    metadata.title = $("div.detail-header div.inner h1.book-title")
      .text()
      .trim();
    $(
      "div.detail-main div.main div.detail-desc-module div.module-container div.tips"
    ).remove();
    metadata.description = $(
      "div.detail-main div.main div.detail-desc-module div.module-container"
    )
      .text()
      .trim();
    metadata.publisher = "www.chapterupdates.com";
    $(
      "div.detail-header div.inner div.book-infomation p.book-text:nth-child(3) span"
    ).remove();
    metadata.author = $(
      "div.detail-header div.inner div.book-infomation p.book-text:nth-child(3)"
    )
      .text()
      .trim();
    let count = 0;
    do {
      metadata.cover = $("div.detail-header div.inner div.book-cover img")
        .first()
        .attr("src")
        .split("?")[0];
      count++;
    } while (!metadata.cover && count < 3);
    if (metadata.cover.startsWith("//")) {
      metadata.cover = `https:${metadata.cover}`;
    }
    metadata.publisher = "www.chapterupdates.com";
    $(
      "div.detail-header div.inner div.book-infomation p.book-text:nth-child(4) span"
    ).remove();
    metadata.status = $(
      "div.detail-header div.inner div.book-infomation p.book-text:nth-child(4)"
    )
      .text()
      .trim();
    metadata.totalChapters = +$(
      "div.detail-header div.inner div.book-infomation div.detail-data-box div.item:nth-child(1) p:nth-child(1)"
    )
      .text()
      .trim();
    metadata.bookID = $(
      "div.detail-main aside div.detail-recommond-module div.module-item"
    ).attr("currentbookid");
    metadata.chapters = await this.extractChapters(
      metadata.totalChapters,
      metadata.bookID,
      novelHomePageLink
    );
    console.timeEnd("metadata");
    return metadata;
  },
  async execute(message, args) {
    let isProvidedLinkHome = false;
    let novelSlug = "";
    let providedLink = args[0];
    // let startingChapterLink = providedLink;
    let startingChapterLink =
      _.last(providedLink) === "/" ? providedLink : `${providedLink}/`;
    let startingChapterIndex = 0;
    let currentChapterIndex = 0;
    let novelHomePageLink = "";
    let novelMetaData = {};
    let chapterCount = 0;
    let chapterLimit = _.isNaN(args[1]) ? null : args[1];
    let bookContent = [];
    if (!startingChapterLink.includes("www.chapterupdates.com")) {
      return message.reply(
        `\`chup\` command only supports www.chapterupdates.com novels. Try the \`scrape\` command.`
      );
    }
    novelSlug = startingChapterLink
      .replace(this.siteNovelPrefix, "")
      .split("/")[0];
    if (
      `${this.siteNovelPrefix}${novelSlug}/` === startingChapterLink ||
      `${this.siteNovelPrefix}${novelSlug}` === startingChapterLink
    ) {
      isProvidedLinkHome = true;
    }
    novelHomePageLink = `${this.siteNovelPrefix}${novelSlug}/`;
    console.log({
      novelHomePageLink,
      providedLink,
      novelSlug,
      startingChapterLink,
    });
    novelMetaData = await this.getMetaData(novelHomePageLink);
    console.log({ novelMetaDataCover: novelMetaData.cover });
    // return;
    startingChapterIndex = isProvidedLinkHome
      ? novelMetaData.chapters.length - 1
      : novelMetaData.chapters.findIndex((v) => {
          if (
            v.link.includes(startingChapterLink) ||
            startingChapterLink.includes(v.link)
          ) {
            return true;
          }
        });
    startingChapterLink = novelMetaData.chapters[startingChapterIndex].link;
    currentChapterIndex = startingChapterIndex;
    let currentChapterLink = startingChapterLink;
    let processingMessage;
    let bookTitle = novelMetaData.title;
    let bookAuthor = novelMetaData.author;
    let bookCoverArt = novelMetaData.cover;
    let customCss =
      "h1,h2,h3,h4,h5,h6,b,strong{color:#cc5635;font-style:italic;padding:0;margin:0}p,li{text-align:justify;text-indent:3%}br{text-align:justify;text-indent:3%}div{text-align:justify;text-indent:3%}";
    let cancelProcess = false;
    let numTries = 1;
    var options = cloudscraper.defaultParams;
    while (currentChapterIndex >= 0) {
      try {
        console.log("processing: " + currentChapterLink);
        if (numTries >= 10) break;
        options = {
          ...options,
          method: "GET",
          uri: currentChapterLink,
          // Cloudscraper automatically parses out timeout required by Cloudflare.
          // Override cloudflareTimeout to adjust it.
          cloudflareTimeout: 5000,
          // Reduce Cloudflare's timeout to cloudflareMaxTimeout if it is excessive
          cloudflareMaxTimeout: 30000,
          // followAllRedirects - follow non-GET HTTP 3xx responses as redirects
          followAllRedirects: true,
        };
        let page = await cloudscraper(options);
        console.time("cheerio load");
        const $ = cheerio.load(page);
        console.timeEnd("cheerio load");
        let chapterContent;
        let chapterName = novelMetaData.chapters[currentChapterIndex].name;
        chapterContent =
          "<hr/>" +
          $("div.book div.book-container div.book__chapter-content")
            .first()
            .html();
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
        console.log("Next chpater exists: " + currentChapterLink);
        // let instructionText = `React with \:pause_button: to make epub with currently processed chapters.\nReact with \:stop_button: to cancel the process.`;
        if (processingMessage) {
          chapterCount % 5 == 0
            ? processingMessage.edit(`chapters processed: ${chapterCount}`)
            : null;
        } else {
          processingMessage = await message.channel.send(
            `chapters processed: ${chapterCount}`
          );
          // const filter = (reaction, user) => {
          //   return true;
          // };
        }
        numTries = 1;
        if (chapterCount >= chapterLimit) {
          break;
        }
        currentChapterIndex--;
        currentChapterLink =
          novelMetaData.chapters[currentChapterIndex].link || null;
        numTries = 1;
      } catch (error) {
        console.log(error.message);
        console.log(`trying to load ${currentChapterLink} again`);
        numTries++;
      }
    }

    try {
      processingMessage.edit(`making epub!`);
    } catch (error) {
      console.error(error);
    }
    try {
      const option = {
        title: bookTitle, // *Required, title of the book.
        author: bookAuthor, // *Required, name of the author.
        publisher: novelMetaData.publisher, // optional
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
    } catch (error) {
      console.log(error);
    }
  },
};
