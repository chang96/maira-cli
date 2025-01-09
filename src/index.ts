#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createDirectoryIfNotExists, readJSON, writeDataToFile } from "./utils/helper";
import { generateDocs } from "./utils/makeRequest";

(async function () {
  const argv = await yargs(hideBin(process.argv)).scriptName("maira-cli").usage("$0 <cmd> [args]").command(
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
          describe: "Optional ID. Should be supplied to update documentation",
          type: "string",
          demandOption: false
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
    }).help().argv;

    if (argv._[0] == "generate" ){
        const {config, paths, id, output, name} = argv
        console.log(config, paths, id, output, name)
        const configData = await readJSON(config as string);
        const pathsData = await readJSON(paths as string);
        await createDirectoryIfNotExists(output as string)
        const res = await generateDocs(pathsData, configData)
        const {data, id: jsonId} = res
        const writePath = (output as string) +"/"+ (name as string)
        await writeDataToFile(writePath, JSON.stringify(data, null, "\t"))
        console.log(`Documentation generated and saved to ${writePath}. Preview: https://maira-virid.vercel.app/?id=${jsonId}`)
    }
})();
