import pkg from '@octokit/core';

const {Octokit} = pkg;

export const octokit = new Octokit({auth: process.env.GITHUB_TOKEN});

