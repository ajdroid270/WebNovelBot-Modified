const configVars = {};
// try {
//   const aws = require("aws-sdk");
//   let s3 = new aws.S3({
//     env: process.env,
//   });
//   configVars.isHeroku = true;
//   configVars.env = s3.env;
// } catch (error) {
//   const dotenv = require("dotenv");
//   dotenv.config();
//   console.log("Platform is not Heroku!");
//   configVars.isHeroku = false;
//   configVars.env = process.env;
// }

try {
  const dotenv = require("dotenv");
  dotenv.config();
  console.log("Platform is not Heroku!");
  configVars.isHeroku = false;
  configVars.env = process.env;
} catch (e) {
  console.log(e);
}

module.exports = configVars;
