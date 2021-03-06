/** @format */

import pkg from '@octokit/core'
import env from 'dotenv'

env.config({ debug: true })
const { Octokit } = pkg
export const octokit = new Octokit({ auth: process.env.INPUT_TOKEN })
