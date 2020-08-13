import env from "dotenv";

export class Startup {

    async main() {
        env.config({debug: true});
    }
}