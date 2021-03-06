/** @format */

import { logger }                       from './logger.mjs'
import { PullRequestManagementService } from './octo/pulls/core.mjs'

export class Startup {
    async main () {
        const log = logger.child({ name: 'Startup' })
        log.info('Starting...')

        this.prManager = new PullRequestManagementService()
        await this.prManager.start()
    }
}

new Startup().main()
