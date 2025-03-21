#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createDirectoryIfNotExists, readJSON, writeDataToFile } from "./utils/helper";
import { generateDocs } from "./utils/makeRequest";
import http from "http"
import express from "express"
import bodyParser from "body-parser";
import axios from "axios"
import {configTemplate, swaggerTemplate} from "./templates.json"
const mairaPort = 8081;
const app = express()
app.use(bodyParser.urlencoded({ extended: false }))

app.use(bodyParser.json())
app.use((req, res, next) => {
  console.log('Request Method:', req.method);
  console.log('Request Path:', req.path);
  console.log('Request Body:', req.body);
  console.log('Request Query:', req.query);
  console.log('Request Params:', req.params);
  next();
});

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
    }).command("http", "proxy requests", (yargs) => {
      yargs.option("port", {
        describe: "The port to forward request to",
        type: "number",
        alias: "p",
        demandOption: true
      }).option("project", {
        describe: "The project name eg admin-endponts-documentation",
        type: "string",
        alias: "project",
        demandOption: true
      })
      .option("baseurl", {
        describe: "The base url eg http://localhost:3000",
        type: "string",
        alias: "url",
        demandOption: false
      })
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
   
  if (argv._[0] == "http") {
    const { port, project, baseurl } = argv;
    const newProjectPath = "./maira_docs"
    await createDirectoryIfNotExists(newProjectPath as string)
    await createDirectoryIfNotExists(newProjectPath+"/"+project)
    configTemplate["title"] = project + " documentation"
    await writeDataToFile(newProjectPath+"/"+project+"/config.json", JSON.stringify(configTemplate, null, "\t"))
    await writeDataToFile(newProjectPath+"/"+project+"/paths.json", JSON.stringify({endpoints: []}, null, "\t"))
    
    let targetUrl = `http://localhost:${port}`;
    if (baseurl){
      targetUrl = baseurl as string
    }

    app.all("*", async (req, res) => {
      //read the config and paths file
      //find the paths that is being called
      //if found update
      //if not found create a new on in the paths file
      //generate tags from routes list in config file
      const localMairaConfigs = await readJSON(newProjectPath+"/"+project+"/config.json")
      swaggerTemplate["info"]["title"] = localMairaConfigs.title
      swaggerTemplate["info"]["version"] = localMairaConfigs.version
      swaggerTemplate["tags"] = localMairaConfigs.routes.map((route: string) => ({name: route.split("/")[1], description: "" }))
      swaggerTemplate["servers"] = localMairaConfigs.serverUrls.map((server: string) => ({url: server}))
      const secSchemeRes = {} as any

      for (const k in localMairaConfigs.security) {
        const secRes = {} as any
        const secs = localMairaConfigs.security[k]
        for (const sec of secs) {
          secRes[sec] = []
          secSchemeRes[sec] = {
            type: k,
            ...(k === "apiKey" && {in: "header", name: sec}),
            ...(k === "http" && {bearerFormat: "JWT", scheme: "bearer"})
          }
        }
        (swaggerTemplate["security"] as any[]).push(secRes)
      }

      
      (swaggerTemplate["components"]["securitySchemes"] as any[]) = secSchemeRes
      await writeDataToFile(newProjectPath+"/"+project+"/swagger_template.json", JSON.stringify(swaggerTemplate, null, "\t"))

      try {
        const response = await axios({
          method: req.method,
          url: `${targetUrl}${req.path}`,
          data: req.body,
          headers: { ...req.headers },
          params: req.query,
        });
        
        res.status(response.status).send(response.data);
      } catch (error: any) {
        console.error("Axios Proxy Error:", error.message);
        res.status(error.response?.status || 500).send(error.response?.data || "Proxy Error");
      }
    });

    const server = http.createServer(app);
    server.listen(mairaPort, () => {
      console.log(`Proxy server running on port ${mairaPort}, forwarding requests to ${targetUrl}`);
    });
  }
    
})();


