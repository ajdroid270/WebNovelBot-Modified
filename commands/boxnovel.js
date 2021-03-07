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
  generateEpub,
} = require("../helper");

module.exports = {
  name: "box",
  siteNovelPrefix: "https://boxnovel.com/novel/",
  description:
    "Scrape chapters from the given link for the specified N number of chapters!",
  usage: `${prefix}box <link> *N`,
  example: `${prefix}box https://boxnovel.com/novel/lord-of-the-mysteries-webnovel/chapter-1 60`,
  args: false,
  guildOnly: false,
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
    $("span.manga-title-badges").remove();
    metadata.title = $("div.site-content div.post-title").text().trim();
    metadata.description = $(
      "div.description-summary div.summary__content div#editdescription"
    )
      .text()
      .trim();
    metadata.publisher = "https://boxnovel.com";
    metadata.author = $(
      "div.summary_content div.post-content div.post-content_item:nth-of-type(6) div.summary-content div.author-content"
    )
      .text()
      .trim();
    let count = 0;
    do {
      metadata.cover = $("div.tab-summary div.summary_image img.img-responsive")
        .first()
        .attr("src");
      count++;
    } while (!metadata.cover && count < 3);
    metadata.release = $(
      "div.post-status div.post-content_item:nth-child(1) div.summary-content"
    )
      .text()
      .trim();
    metadata.status = $(
      "div.post-status div.post-content_item:nth-child(2) div.summary-content"
    )
      .text()
      .trim();
    metadata.chapters = $(
      "div.page-content-listing.single-page li.wp-manga-chapter a"
    )
      .map(function (i, el) {
        let e = $(el);
        return { link: e.attr("href").toString() + "/", name: e.text().trim() };
      })
      .toArray();
    console.timeEnd("metadata");
    return metadata;
  },
  async execute(message, args) {
    let isProvidedLinkHome = false;
    let novelSlug = "";
    let providedLink = args[0];
    let startingChapterLink =
      _.last(providedLink) === "/" ? providedLink : `${providedLink}/`;
    let startingChapterIndex = 0;
    let currentChapterIndex = 0;
    let novelHomePageLink = "";
    let novelMetaData = {};
    let chapterCount = 0;
    let chapterLimit = _.isNaN(args[1]) ? null : args[1];
    let bookContent = [];
    if (!startingChapterLink.includes("boxnovel.com")) {
      return message.reply(
        `\`boxnovel\` command only supports boxnovel novels.`
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
    novelMetaData = await this.getMetaData(novelHomePageLink);
    // console.log(novelMetaData);
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
    console.log({ currentChapterIndex });
    while (currentChapterIndex >= 0) {
      try {
        console.log("processing :" + currentChapterLink);
        if (numTries >= 10) {
          break;
        }
        console.time("chapter loop");
        console.time("chapter Fetch");
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
        console.timeEnd("chapter Fetch");
        // console.log(page);
        console.time("cheerio load");
        const $ = cheerio.load(page);
        console.timeEnd("cheerio load");
        $("i.icon").remove();
        $("span.manga-title-badges").remove();
        let chapterContent;
        let chapterName = $(
          "div.reading-content > div.text-left div.cha-tit h3"
        )
          .text()
          .trim();
        if (
          chapterName.length >
          novelMetaData.chapters[currentChapterIndex].name.length
        ) {
          $("div.reading-content > div.text-left div.cha-tit").remove();
          novelMetaData.chapters[currentChapterIndex].name = chapterName;
        } else {
          chapterName = novelMetaData.chapters[currentChapterIndex].name;
        }
        chapterContent =
          "<hr/>" + $("div.reading-content > div.text-left").html();
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
        // let instructionText = `React with :pause_button: to make epub with currently processed chapters.\nReact with :stop_button: to cancel the process.`;
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
        if (chapterCount >= chapterLimit) {
          break;
        }
        console.timeEnd("chapter loop");
        currentChapterIndex--;
        currentChapterLink = novelMetaData.chapters[currentChapterIndex].link;
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
      console.log(error);
    }

    try {
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
        generateEpub(
          option,
          bookTitle,
          driveTmpFolder,
          message,
          processingMessage
        );
      } else {
        processingMessage.delete();
        message.channel.send("Process stopped.");
      }
    } catch (error) {
      console.log(error);
    }
  },
};
