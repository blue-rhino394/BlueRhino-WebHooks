import express, { Application } from "express";
import { createServer, Server as HTTPServer } from "http";
import { CONNREFUSED } from "dns";
import { randomBytes } from "crypto";
const { exec } = require("child_process");
const bodyParser = require("body-parser");
const path = require('path');



export class webhookServer {

    // The express server that this server uses.
    private app: Application;
    // The HTTP Server to use with Express
    private httpServer: HTTPServer;

    // The port to run the webserver on
    private port: number;









    //
    //  Construction an initialization
    //

    // Constructor!
    constructor(port: number) {
        this.initialize();

        this.port = port;
    }

    // Create and configure any objects for this class
    private initialize(): void {
        this.app = express();
        this.httpServer = createServer(this.app);

        this.configureApp();
    }

    // Specifically configure the Express server
    private configureApp(): void {
        this.app.use(bodyParser.urlencoded({ extended: false }));
        this.app.use(bodyParser.json());



        this.app.post('/github', (req, res) => {

            
            const ref = req.body.ref;

            // If there's no ref in the post data...
            if (!ref) {

                // Bounce!
                res.send('..Are you github..?');
                return;
            }

            const branch = ref.replace("refs/heads/", "");
            var cdLocation = "";
            var pm2Name = "";


            switch (branch) {

                case "master":
                    cdLocation = "cd ~/production/BlueRhino-SoftwareProject/";
                    pm2Name = "app_production";
                    break;

                case "test":
                    cdLocation = "cd ~/test/BlueRhino-SoftwareProject/";
                    pm2Name = "app_test";
                    break;

                default:
                    console.log(`Recieved unknown branch '${branch}'.`);
                    return;
                    break;
            }


            this.executeShellCommand(`${cdLocation} && git pull && pm2 restart ${pm2Name}`);
            res.send('Thanks!');
        });
    }





    // Execute a shell command and then print the result
    private executeShellCommand(command: string): void {

        console.log(`Executing shell command '${command}'.`);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.log(`Shell execution error: ${error.message}`);
                return;
            }

            if (stderr) {
                console.log(`Shell stderr: ${stderr}`);
                return;
            }

            console.log(`Shell execution result: ${stdout}`);
        });
    }









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