import { webhookServer } from './webhookServer';
const commandLineArgs = require('command-line-args');





//
//  Options
//

// Define what command line arguments we want, and what type we expect
// them to be.
const optionDefinitions = [
    { name: 'port', type: Number }
];

// Store 'em in a generic object, then explicitly retrieve them
const options = commandLineArgs(optionDefinitions);
const port = options.port || 30330;





//
//  App Execution
//

const server = new webhookServer(port);

server.listen(portUsed => {
    console.log(`Server is listening on port ${portUsed}!`);
});