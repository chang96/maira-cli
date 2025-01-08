import yargs from "yargs";
import { hideBin } from "yargs/helpers";

(async function () {
  const argv = await yargs(hideBin(process.argv)).command(
    "generate",
    "generate api endpoint json documentation",
    (yargs) => {
      yargs
        .option("config", {
          describe: "Path to the config JSON file",
          type: "string",
          alias: "c",
          demandOption: true,
        })
        .option("paths", {
          describe: "Path to the paths JSON file",
          type: "string",
          alias: "p",
          demandOption: true,
        })
        .option("id", {
          describe: "Optional ID for the request",
          type: "string",
          default: "",
        })
        .option("output", {
          describe: "Directory to save the output file",
          type: "string",
          alias: "o",
          demandOption: true,
        })
        .option("name", {
          describe: "The name of the output file",
          type: "string",
          alias: "n",
          demandOption: true,
        });
    }).help().argv;;

  console.log(`Your input was: ${argv._.join(", ")}`);
})();
