import P from 'pino';
import moment from 'moment';
import mkdirp from 'mkdirp'
import path from 'path';

const baseLoggerOptions = {
    safe: true,
    messageKey: "message",
    timestamp: P.stdTimeFunctions.isoTime,
    prettyPrint: true,
    mixin: function () {
        return {
            appName: `Octoman/${moment.utc().toISOString()}`,
            ...process.ENV
        }
    }
}

const levels = {
    fatal: 'fatal',
    error: 'error',
    warn: 'warn',
    info: 'info',
    debug: 'debug',
    trace: 'trace',
    silent: 'silent'
}

export class OctomanLogger {
    #logger;
    #name;
    #level;
    #destination;
    #props;

    constructor(name, level, {destination, ...props}) {
        this.#name = name;
        this.#level = levels[level] || 'info';
        if (destination != null && typeof destination === 'string') {
            mkdirp.sync(destination)
        } else {
            mkdirp.sync(`./logs/${this.#level}/${this.#name.toLowerCase()}`)
        }
        this.#destination = path.join(destination, `${this.#level}-${this.#name.toLowerCase()}.log`);
        this.#props = props;
        this.#init();
    }

    #init() {
        this.#logger = P({
            ...baseLoggerOptions,
            ...this.#props,
            name: this.#name,
            level: this.#level,
        }, P.destination(this.#destination));
        this.#info(`The logger with '${this.#name}' has been initialized.`);
    }

    #info(msg) {
        const fn = this.#logger[levels[this.#level]]
        fn.call(this.#logger, msg);
    }

    get logger() {
        return this.#logger;
    }
}