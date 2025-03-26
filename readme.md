# Maira-CLI

Maira-CLI is a developer tool designed to automatically generate swagger documentation for endpoints by intercepting requests and responses while testing the API endpoints.

## Installation

```sh
npm install -g maira-cli
```

## Usage

### Start Proxy Server Inside The Backend Project to Be Documented
```sh
maira-cli http --port=3000 --project=userDoc --baseurl=http://localhost:3000
```

### Config.json and Paths.json
After starting the proxy server, a folder `/maira_docs/userDoc` is automatically created. There are config.json and paths.json files inside the `/maira_docs/userDoc`. Details about the project, routes to be documented and authentication headers should be set in the config.json file. After adding details to the config.json file, make request like you would normally do to your backend through the port exposed by the proxy server `8081`.


```sh
{
	"title": "user documentation",
	"version": "1.0.0",
	"serverUrls": ["http://localhost:3000"],
	"routes": [
        "/ping/pong",
		"/ping",
		"/ping/:id"
    ],
	"security": {
        "apiKey": [
			"x-api-key",
			"x-api-user"
		],
		"http": [
			"authorization"
		],
    }
}
```
### swagger_template.json
This file is generated when the first request is made based on the details in config.json

### Generate Documentation
```sh
maira-cli generate -c=./maira_docs/userDoc/swagger_template.json -p=./maira_docs/userDoc/paths.json -o=./maira_docs/userDoc/docs -n=user-docs.json
```

## Viewing Documentation
A link to the documentation preview is sent after a successful generation eg https://maira-virid.vercel.app/?id=uuid




