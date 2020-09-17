import express, { Application } from "express";
import { createServer, Server as HTTPServer } from "http";
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

            console.log(ref);
            res.send('Thanks!');
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