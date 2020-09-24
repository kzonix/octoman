/** @format */

import mkdirp from 'mkdirp'
import moment from 'moment'
import path   from 'path'
import P      from 'pino'

const baseLoggerOptions = {
    safe: true,
    messageKey: 'message',
    timestamp: P.stdTimeFunctions.isoTime,
    mixin: () => ({
        appName: 'Octoman/Kzonix'
    })
}
const logLevel = process.env.LOG_LEVEL
const levels = {
    fatal: 'fatal',
    error: 'error',
    warn: 'warn',
    info: 'info',
    debug: 'debug',
    trace: 'trace',
    silent: 'silent'
}

class OctomanLogger {
    #logger
    #name
    #level
    #destination
    #props

    constructor (name, level, { ...props }) {
        this.#name = name
        this.#level = levels[level] || 'info'
        // todo: refactor this part to some file utility class
        const destination = `./logs/${this.#level}/${this.#name.toLowerCase()}`
        mkdirp.sync(destination)
        const dest = {
            dest: path.join(
                destination,
                `${moment().utc().toDate().toISOString()}.${this.#level}.log`
            ),
            minLength: 4096 * 4,
            sync: false
        }
        this.#destination =
            process.env.NODE_ENV === 'prod'
                ? P.destination(dest)
                : P.destination({ sync: false })
        this.#props = props
        this.#init()
    }

    #init () {
        this.#logger = P(
            {
                ...baseLoggerOptions,
                ...this.#props,
                name: this.#name,
                level: this.#level
            },
            this.#destination
        )
        this.#info(`The logger with '${this.#name}' has been initialized.`)
    }

    #info (msg) {
        const fn = this.#logger[levels[this.#level]]
        fn.call(this.#logger, msg)
    }

    get logger () {
        return this.#logger
    }
}

const { logger } = new OctomanLogger('OctomanHttp', logLevel, {})
export { logger }
