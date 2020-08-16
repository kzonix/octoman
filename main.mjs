import {PullRequestManagement} from "./octo/pulls/core.mjs"
import {OctomanLogger} from "./logger.mjs"

export class Startup {

    async main() {
        let logger = new OctomanLogger("Main", 'info', {destination: './info'}).logger;
        logger.info("Starting...")

        this.prManager = new PullRequestManagement();
        await this.prManager.start();
    }
}

new Startup().main();