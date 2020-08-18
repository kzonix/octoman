import env from 'dotenv'
import pkg from '@octokit/core'


env.config({ debug: true })
const { Octokit } = pkg

export const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
