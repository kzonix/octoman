import env from "dotenv";
import {OctomanLogger} from "./logger.mjs"

export class Startup {

    async main() {
        let logger = new OctomanLogger("Main", 'info', {destination: './info'}).logger;
        logger.info("Starting...")
        env.config({debug: true});
    }
}

new Startup().main();