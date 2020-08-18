// `prettier.config.js` or `.prettierrc.js`
const prettierConfigStandard = require("prettier-config-standard")
const merge = require("deepmerge")

const modifiedConfig = merge.all(
    [
        {},
        prettierConfigStandard,
        {
            trailingComma: "all",
            tabWidth: 4,
            semi: false,
            singleQuote: true
        }
    ]
)
module.exports = modifiedConfig
