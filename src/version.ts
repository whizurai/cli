/**
 * The CLI's version, read from package.json at runtime so `--version` and the
 * User-Agent cannot drift from what was published (they said 0.2.0 and 0.3.0).
 * A runtime require keeps package.json outside tsc's rootDir; from both
 * src/ and dist/ the file is one directory up.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const CLI_VERSION: string = require('../package.json').version;
