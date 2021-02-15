const cheerio = require("cheerio");
const fetch = require("node-fetch");
const configVars = require("../EnvLoader");
const { prefix } = configVars.env;
const Epub = require("epub-gen");
const _ = require("underscore");
const path = require("path");
const fs = require("fs");
const cloudscraper = require("cloudscraper");
const {
  nuSearchShort,
  nuScrapeMetadata,
  uploadFileToDrive,
  driveTmpFolder,
  getDriveEmbed,
  nuSearchLong,
} = require("../helper");
const e = require("express");

module.exports = {
  name: "wwsite",
  siteNovelPrefix: "https://wuxiaworld.site/novel/",
  description:
    "Scrape chapters from the given link for the specified N number of chapters!",
  usage: `${prefix}wwsite <link> *N`,
  example: `${prefix}wwsite https://wuxiaworld.site/novel/dimensional-codex/chapter-1 60`,
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
    metadata.title = $("div.site-content div.post-title h1").text().trim();
    metadata.description = $("div.description-summary > div.summary__content")
      .text()
      .trim();
    metadata.publisher = "WuxiaWorld.Site";
    metadata.author = $(
      "div.post-content_item > div.summary-content > div.author-content"
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
        return { link: e.attr("href").toString(), name: e.text().trim() };
      })
      .toArray();
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
    if (!startingChapterLink.includes("wuxiaworld.site")) {
      return message.reply(
        `\`wwsite\` command only supports wuxiaworld.site novels. Try the \`scrape\` command.`
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
    console.log(novelMetaData.cover);
    startingChapterIndex = isProvidedLinkHome
      ? novelMetaData.chapters.length - 1
      : novelMetaData.chapters.findIndex((v, i) => {
          if (
            v.link.includes(startingChapterLink) ||
            startingChapterLink.includes(v.link)
          ) {
            return true;
          }
        });
    startingChapterLink = novelMetaData.chapters[startingChapterIndex].link;
    // return;
    // let searchResults;
    // try {
    //   searchResults = await nuSearchShort(
    //     novelMetaData.title.trim().substring(0, 10),
    //     false,
    //     false
    //   );
    //   if (searchResults.length == 0) {
    //     console.log("nu long search");
    //     searchResults = await nuSearchLong(
    //       novelMetaData.title.trim().split(" "),
    //       false,
    //       false
    //     );
    //   }
    //   console.log(searchResults);
    // } catch (error) {
    //   console.log(error.message);
    // }
    // let nuLink = searchResults[0];
    // try {
    //   novelMetaData = await nuScrapeMetadata(nuLink);
    // } catch (error) {
    //   console.log(error.message);
    // }
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
        $("div.reading-content > div.text-left script").remove();
        $("div.reading-content > div.text-left style").remove();
        $("div.reading-content > div.text-left br").remove();
        $("a[href='https://wuxiaworld.site']").remove();
        let chapterContent;
        let chapterName = novelMetaData.chapters[currentChapterIndex].name;
        if (chapterName) {
          chapterContent =
            "<hr/>" + $("div.reading-content > div.text-left").first().html();
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
              currentChapterLink
                .replace("https://wuxiaworld.site/novel/", "")
                .split("/")
                .pop()
                .split("-")
                .join(" ")
            )
            .trimRight();
        }

        if (!chapterContent) {
          chapterContent =
            "<hr/>" + $("div.reading-content > div.text-left").html();
        }

        console.log(chapterName);
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
        currentChapterIndex--;
        currentChapterLink =
          novelMetaData.chapters[currentChapterIndex].link || null;
        console.log("Next chpater exists: " + currentChapterLink);
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
        numTries = 1;
        if (chapterCount >= chapterLimit) {
          break;
        }
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
        publisher: "wuxiaworld.site", // optional
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
