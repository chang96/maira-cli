#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createDirectoryIfNotExists, readJSON, writeDataToFile } from "./utils/helper";
import { generateDocs } from "./utils/makeRequest";
import http from "http"
import express from "express"
import bodyParser from "body-parser";
import axios from "axios"
import {configTemplate, swaggerTemplate as oldSwaggerTemplate, pathsTemplates} from "./templates.json"
import deepEqual from "deep-equal"
const swaggerTemplate = JSON.parse(JSON.stringify(oldSwaggerTemplate))
const mairaPort = 8081;
const app = express()
app.use(bodyParser.urlencoded({ extended: false }))

app.use(bodyParser.json())
app.use((_req, _res, next) => {
  // console.log('Request Method:', req.method);
  // console.log('Request Path:', req.path);
  // console.log('Request Body:', req.body);
  // console.log('Request Query:', req.query);
  // console.log('Request Params:', req.params);
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
      const localMairaPaths = await readJSON(newProjectPath+"/"+project+"/paths.json")
      const {endpoints} = localMairaPaths
      let matchedRoute = req.path;
      const normalRoutes = localMairaConfigs.routes.filter((r:string) => !r.includes(":"));
      const paramRoutes = localMairaConfigs.routes.filter((r:string)=> r.includes(":"));
      
      // const definedSecuritiesArray = [] as string[];
      const securities = Object.keys(localMairaConfigs.security)
      // for (const sec of securities) {
      //   const s = localMairaConfigs.security[sec].map((x: string) => x.toLowerCase())
      //   definedSecuritiesArray.push(...s)
      // }

      let pathParams = {};
  
      if (!normalRoutes.includes(req.path)) {
        for (const route of paramRoutes) {
          const paramNames = route.match(/:(\w+)/g) || [];
          const regex = new RegExp(`^${route.replace(/:(\w+)/g, "(\\w+)")}$`);
          const match = req.path.match(regex);
          
          if (match) {
            matchedRoute = route;
            pathParams = Object.fromEntries(paramNames.map((name: string, index: number) => [name.substring(1), match[index + 1]]));
            break;
          }
        }
      }

      const usePathParams = Object.entries(pathParams).map(([k, v]) => {
        return `${k}.${v}`
      })

      const endpointId = `${req.method} ${matchedRoute}`.toLowerCase();
      const existingIndex = endpoints.findIndex((ep: typeof pathsTemplates) => ep.path.toLowerCase() === matchedRoute.toLowerCase() && ep.method.toLowerCase() === req.method.toLowerCase());

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
      await writeDataToFile(newProjectPath+"/"+project+"/swagger_template.json", JSON.stringify(swaggerTemplate, null, "\t"), true)
      let response 
      try {
        response = await axios({
          method: req.method,
          url: `${targetUrl}${req.path}`,
          data: req.body,
          headers: { ...req.headers },
          params: req.query,
        });
        
        res.status(response.status).send(response.data);
      } catch (error: any) {
        response = error.response
        console.error("Axios Proxy Error:", error.message);
        res.status(error.response?.status || 500).send(error.response?.data || "Proxy Error");
      }


      const endpointData = {
        name: req.path.toLowerCase(),
        path: matchedRoute.toLowerCase(),
        method: req.method.toLowerCase(),
        summary: `Auto-generated doc for ${req.method} ${req.path}`,
        operationId: endpointId.toLowerCase(),
        tags: [matchedRoute.split("/")[1].toLowerCase() || "default"],
        description: `Endpoint documentation for ${req.method} ${req.path}`,
        requestParams: usePathParams,
        requestQueries: [],
        requestBody: null,
        requestBodyDetails: [],
        authd: {},
        responses: [
          {
            code: response.status.toString(),
            description: "Response with status code "+response.status.toString(),
            res: response.data,
          },
        ],
      };

      const localSwaggerTemplates = await readJSON(newProjectPath+"/"+project+"/swagger_template.json")

      
      if (securities.length > 0) {
        // const definedSecurities = 
        const headers = req.headers
        for (const secType in localMairaConfigs.security){
          const availabeSecurities = {} as Record<string, any>
          const sec = localMairaConfigs.security[secType].map((x: string) => x.toLowerCase())
          const headerKeys = Object.keys(headers).filter(x => (sec).includes(x.toLowerCase()))
          if (headerKeys.length > 0) {
            headerKeys.forEach(k => {availabeSecurities[k] = []})
            const secInSwagger = localSwaggerTemplates.security
            const findSecInSwagger = (secInSwagger as any[]).findIndex((x: any) => {
              return deepEqual(x, availabeSecurities)
            });
            (endpointData.authd as {use: boolean, position: number, positions: number[]}).use = findSecInSwagger<0 ? false: true;
  
            (endpointData.authd as {use: boolean, position: number, positions: number[]}).position = findSecInSwagger+1;
            if ((endpointData.authd as {use: boolean, position: number, positions: number[]}).positions == undefined) (endpointData.authd as {use: boolean, position: number, positions: number[]}).positions = [] as any[];
            !(endpointData.authd as {use: boolean, position: number, positions: number[]}).positions.includes(findSecInSwagger+1) ? (endpointData.authd as {use: boolean, position: number, positions: number[]}).positions.push(findSecInSwagger+1) : null
          }

        }          
      }

      
      if (existingIndex != -1) {
        const existingResponses = endpoints[existingIndex].responses
        const existingAuth = endpoints[existingIndex].authd as {use: boolean, position: number, positions: number[]}
        existingAuth.use = (endpointData.authd as {use: boolean, position: number, positions: number[]}).use
        existingAuth.position = (endpointData.authd as {use: boolean, position: number, positions: number[]}).position;
        (endpointData.authd as {use: boolean, position: number, positions: number[]}).positions.forEach(x => {
          if (!existingAuth.positions){
            existingAuth.positions = []
          }
          if (!existingAuth.positions.includes(x)) {
            existingAuth.positions.push(x)
          }
        })
        const currenctCode = response.status.toString()
        const isCode = existingResponses.find((x: any) => x.code === currenctCode )
        if (!isCode) existingResponses.push({
          code: currenctCode,
          description: "Response with status code "+currenctCode,
          res: response.data,
        })
      } else {
        const method = req.method.toLowerCase()
        if (method === "post" || method === "put" || method === "patch") {
          if (req.body){
            endpointData.requestBody = req.body
            const keys = Object.keys(req.body).map(x => {
              return {
                name: x,
                value: req.body[x],
                required: true,
                description: x,
                "_comment": "if value is an enum, add a field like so staticFields: [option1, option2]"
              }
            })
            endpointData.requestBodyDetails = keys as any
          }
        }

        if (method === "get" || method === "delete"){
          if (req.query){
            const keys = Object.keys(req.query).map(x => {
              return {
                name: x,
                value: req.query[x],
                required: true,
                description: x,
                "_comment": "if value is an enum, add a field like so staticFields: [option1, option2]"
              }
            })
            endpointData.requestQueries = keys as any
          }
        }

        endpoints.push(endpointData);
      }
      await writeDataToFile(newProjectPath+"/"+project+"/paths.json", JSON.stringify({endpoints}, null, "\t"), true)

    });

    const server = http.createServer(app);
    server.listen(mairaPort, () => {
      console.log(`Proxy server running on port ${mairaPort}, forwarding requests to ${targetUrl}`);
    });
  }
    
})();


