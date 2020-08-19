/** @format */

const prettierConfigStandard = require('prettier-config-standard')
const merge = require('deepmerge')

const modifiedConfig = merge.all([
    {},
    prettierConfigStandard,
    {
        trailingComma: 'none',
        tabWidth: 4,
        semi: false,
        singleQuote: true,
        insertPragma: true,
        proseWrap: 'always',
        quoteProps: 'consistent',
        endOfLine: 'lf'
    }
])
module.exports = modifiedConfig
