import express, { Application } from "express";
import { createServer, Server as HTTPServer } from "http";
import { deploySettings } from "./interfaces/deploySettings";
const crypto = require('crypto');
const { exec } = require("child_process");
const bodyParser = require("body-parser");
const path = require('path');
const fs = require('fs');



export class webhookServer {

    // The express server that this server uses.
    private app: Application;
    // The HTTP Server to use with Express
    private httpServer: HTTPServer;
    // A collection of loaded deploySettings.
    // The key follows this pattern: repositoryName_repositoryBranch
    private deploySettingCollection: Map<string, deploySettings>;

    // The port to run the webserver on
    private port: number;
    // The path to search for existing deploy settings in
    private deploySettingPath: string = "./deploySettings/";

    







    //
    //  Construction, Initialization, and Loading
    //

    // Constructor!
    //
    // port: the port for this HTTP server to listen on
    constructor(port: number) {
        this.initialize();

        this.port = port;
    }

    // Create and configure any objects for this class
    private initialize(): void {
        // Create objects
        this.app = express();
        this.httpServer = createServer(this.app);
        this.deploySettingCollection = new Map<string, deploySettings>(); 

        // Configure objects
        this.loadDeploySettings().catch((err) => console.log(err));
        this.configureApp();
    }

    // Looks for deploy settings in deploySettingPath and adds them
    // to this class's collection of deploy settings
    private async loadDeploySettings(): Promise<void> {

        // Async load paths in the deploy settings directory
        const files = await fs.promises.readdir(this.deploySettingPath);
        var settings: Map<string, deploySettings> = new Map<string, deploySettings>();

        // If there's actually any files in there...
        if (files) {

            // Go through each one and...
            for (var i = 0; i < files.length; i++) {

                // Async read the file and parse it...
                const data = await fs.promises.readFile(path.join(this.deploySettingPath, files[i]));
                const json = JSON.parse(data);

                // Then cram the anonymous JSON objects properties into an interface...
                const newSettings: deploySettings = {
                    repo: json.repo,
                    branch: json.branch,
                    deployCommand: json.deployCommand
                }

                // Generate a key using the repository name and branch...
                const newKey = this.createDeploySettingsKey(newSettings.repo, newSettings.branch);
                // Then store it in the collection!
                settings.set(newKey, newSettings);
            }
        }

        // If we've hit this point, then there's no major errors...
        // So let's put our new settings collection into this class's settings collection!
        this.deploySettingCollection = settings;
        console.log(`Loaded ${settings.size} deploy scripts.`);
    }

    // Specifically configure the Express server
    private configureApp(): void {
        this.app.use(bodyParser.urlencoded({ extended: false }));
        this.app.use(bodyParser.json());



        this.app.post('/github', (req, res) => {
            this.postGithub(req, res);
        });
    }








    //
    //  POST requests
    //

    private postGithub(req, res): void {

        // Get hook ref from the post request
        const ref = req.body.ref;

        // If ref exists, this is more likely to be a valid request so...
        if (ref) {
            // Is this a valid webhook sent from GitHub?
            const isValidHook = this.verifyPostData(req, res);

            // If it IS a valid hook...
            if (isValidHook) {

                // Use it to pull and deploy code!
                this.deployFromGitHubHook(req.body);
                res.send('Thanks!');
                return;
            }
        }

        // Otherwise...
        // If we hit this point, either the post data we got wasn't valid,
        // or it was from another source, or something else undesirable.
        res.send('');
    }













    //
    //  Deploy Methods
    //

    // Parses a GitHub webhook post request's body and
    // uses it to search for and use deploy settings.
    private deployFromGitHubHook(body): void {
        // Parse the branch and repository name from this hook
        const branch: string = body.ref.replace('refs/heads/', '');
        const repositoryName: string = body.repository.name;

        // Tell us about it :D!
        console.log(`Recieved push to ${repositoryName} on branch ${branch}!`);

        // Generate the key...
        const key = this.createDeploySettingsKey(repositoryName, branch);
        // And use it to try and get deploy settings
        const settings = this.deploySettingCollection.get(key);

        // If we correctly obtained deploy settings...
        if (settings) {
            // DEPLOY! DEPLOY! DEPLOY!
            this.runDeploySettings(settings);
        }
        else {
            // Otherwise.. Tell us about it :(
            console.log(`Failed to find deploySettings for ${repositoryName} on branch ${branch} (${key})`);
        }
    }

    // Deploys code using a deploySettings object.
    private runDeploySettings(settings: deploySettings): void {
        console.log(`Running deploy command for ${settings.repo} on branch ${settings.branch}...`);

        // Execute the deployCommand as a shell command!
        exec(settings.deployCommand, (error, stdout, stderr) => {
            // Once we're done...

            // If there's an error, print it!
            if (error) {
                console.log(`Shell execution error: ${error.message}`);
                return;
            }

            // If there's an stderr, print it!
            if (stderr) {
                console.log(`Shell stderr: ${stderr}`);
                return;
            }

            // Otherwise we're golden, so..
            // Tell us about it :D !
            console.log(`Shell execution result: ${stdout}`);
        });
    }






    //
    //  Utility Methods
    //

    // Generates a key to be used by the deploySettingsCollection
    // Specifically - this is used to index to the correct deploySettings when
    // a hook from GitHub is recieved.
    private createDeploySettingsKey(repositoryName: string, repositoryBranch: string): string {
        return `${repositoryName}_${repositoryBranch}`;
    }

    // Verifies that the post data passed in is actually from our GitHub configuration.
    // This is a necessary layer of security to prevent anonymous users from being able
    // to restart & redeploy our servers at will.
    //
    // Returns true if the post data in req and res is valid
    // Returns false if the post data in req and res is invalid
    //
    // inspired by https://gist.github.com/stigok/57d075c1cf2a609cb758898c0b202428
    private verifyPostData(req, res): boolean {

        // GitHub sig
        const headerSignatureName = "X-Hub-Signature";
        // Our secret token. This should be a defined enviroment
        // variable on the server - and also in the GitHub WebHook.
        // NEVER HARDCODE THIS :)
        const secret = process.env.SECRET_TOKEN;

        const payload = JSON.stringify(req.body);

        // If there's no payload - bounce!
        if (!payload) {
            return false;
        }

        // If for some reason the secret token doesn't exist, throw a fit.
        if (!secret) {
            console.log("Enviroment Variable 'SECRET_TOKEN' is not set. THIS IS REQUIRED FOR GITHUB HOOKS TO FUNCTION!");
            return false;
        }

        
        const sig = req.get(headerSignatureName) || '';
        const hmac = crypto.createHmac('sha1', secret);
        const digest = Buffer.from('sha1=' + hmac.update(payload).digest('hex'), 'utf8');
        const checksum = Buffer.from(sig, 'utf8');

        // Check to see if something is wrong with the checksum...
        if (checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum)) {
            // If there is, then this isn't a valid webhook request, so bounce!
            return false;
        }

        // If we've hit this point, then it's a match!
        return true;
    }












    //
    //  Server Execution
    //

    // Start the server and begin listening on the port provided
    // via the constructor.
    //
    // Executes callback when the server has begun listening
    public listen(callback: (port: number) => void): void {

        // Start listening on the httpServer...
        this.httpServer.listen(this.port, () => {

            // Now that we're listening, execute callback
            callback(this.port);
        });
    }
}