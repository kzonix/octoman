/** @format */

import moment      from 'moment'
import { logger }  from '../../logger.mjs'
import { octokit } from '../core.mjs'

// todo: refactor current class to separate resposibility of the label management and comments with bots
export class PullRequestManagementService {
    #logger

    constructor () {
        this.#logger = logger.child({ name: 'PullRequestManagement' })
    }

    async #approve (pull) {
        this.#logger.info(`Going to approve PR ${pull.number}`)
        try {
            let res = await octokit.request(
                'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
                {
                    owner: pull.base.user.login,
                    repo: pull.base.repo.name,
                    pull_number: pull.number,
                    event: 'APPROVE'
                }
            )
            return res;
        } catch (err) {
            console.info(err)
        }
    }

    async #merge (pull) {
        this.#logger.info(`Going to merge PR ${pull.number}`)
        const updatedPullRequest = await octokit.request(
            'GET /repos/{owner}/{repo}/pulls/{pull_number}',
            {
                owner: pull.base.user.login,
                repo: pull.base.repo.name,
                pull_number: pull.number
            }
        )
        if (
            updatedPullRequest.data.mergeable == null ||
            updatedPullRequest.data.mergeable === false
        ) {
            this.#logger.warn(
                `${pull.number} PR (${pull.base.repo.name}) is not mergeable`
            )
        } else {
            this.#logger.info(`Merging PR ${pull.number}...`)
            await octokit.request(
                'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge',
                {
                    owner: pull.base.user.login,
                    repo: pull.base.repo.name,
                    pull_number: pull.number,
                    commit_title: 'chore(octoman): automatic merge'
                }
            )
        }
    }

    async #addLabels (pull) {
        // delete all labels
        const res =
            (pull.labels || [{ name: 'none' }])[0]?.name === 'dependencies'
        if (res) {
            this.#logger.info(
                `#${pull.number} PR with ${pull.id} already has right label (dependencies).`
            )
        } else {
            this.#logger.info(
                `#${pull.number} PR with ${pull.id} has extra labels (dependencies). Deleting...`
            )
            await octokit.request(
                'DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels',
                {
                    owner: pull.base.user.login,
                    repo: pull.base.repo.name,
                    issue_number: pull.number
                }
            )
            // mark dependencies
            this.#logger.info(
                `#${pull.number} PR with ${pull.id} id - Adding the correct label (dependencies).`
            )
            await octokit.request(
                'POST /repos/{owner}/{repo}/issues/{issue_number}/labels',
                {
                    owner: pull.base.user.login,
                    repo: pull.base.repo.name,
                    issue_number: pull.number,
                    labels: ['dependencies']
                }
            )
        }
    }

    async #removeComments (pull) {
        this.#logger.info(`Deleting comments from PR #${pull.number}`)
        const comments = await octokit.request(
            'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
            {
                owner: pull.base.user.login,
                repo: pull.base.repo.name,
                issue_number: pull.number
            }
        )

        const deleteRequests = Array.of([])
        for (const comment of comments.data) {
            this.#logger.info(`Deleting comment #${comment.id} ...`)
            deleteRequests.push(
                octokit.request(
                    'DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}',
                    {
                        owner: pull.base.user.login,
                        repo: pull.base.repo.name,
                        comment_id: comment.id
                    }
                )
            )
        }
        await Promise.all(deleteRequests)

        const events = await octokit.request(
            'GET /repos/{owner}/{repo}/issues/{issue_number}/events',
            {
                owner: pull.base.user.login,
                repo: pull.base.repo.name,
                issue_number: pull.number
            }
        )

        for (const event of events.data) {
            if (event.event === 'labeled') {
                this.#logger.info(`PR#${pull.number} - event = `, event.label)
            }
        }
    }

    async #conversation (pull) {
        // Todo: 29.08.2020 - refactor this part with separate method
        // - load all comments of PR, determine the last comment of bot (problem with rebasing, asking for recreation)
        // - strategy pattern: use appropriate language for communication with bots.
        // - set comments with appropriate commands or fallback logic to deal with conflict PR.
        if (pull.user.login === 'renovate[bot]') {
            this.#logger.info(' > revonate - rebase')
            await octokit.request(
                'PATCH /repos/{owner}/{repo}/pulls/{pull_number}',
                {
                    owner: pull.base.user.login,
                    repo: pull.base.repo.name,
                    pull_number: pull.number,
                    body: pull.body.replace(
                        ' - [ ] <!-- rebase-check -->',
                        ' - [x] <!-- rebase-check -->'
                    )
                }
            )
        }
        if (pull.user.login === 'depfu[bot]') {
            this.#logger.info(' > depfu - rebase')
            await octokit.request(
                'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
                {
                    owner: pull.base.user.login,
                    repo: pull.base.repo.name,
                    issue_number: pull.number,
                    body: '@depfu rebase'
                }
            )
        }
        // TODO: Depfu bot - separate class.
        if (pull.user.login === 'dependabot-preview[bot]') {
            this.#logger.info(' > dependabot - rebase')
            await octokit.request(
                'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
                {
                    owner: pull.base.user.login,
                    repo: pull.base.repo.name,
                    issue_number: pull.number,
                    body: '@dependabot rebase'
                }
            )
        }
        if (pull.user.login === 'dependabot-preview[bot]') {
            this.#logger.info(' > dependabot - recreate')
            await octokit.request(
                'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
                {
                    owner: pull.base.user.login,
                    repo: pull.base.repo.name,
                    issue_number: pull.number,
                    body: '@dependabot recreate'
                }
            )
        }
    }

    async #processPullRequest (pull) {
        if (pull.user.login.indexOf('bot') >= 0 || pull.user.login.indexOf('kzonix')) {
            this.#logger.info(
                `#${pull.number} PR with number ${pull.id} is a bot request to update dependencies.`
            )
            if (pull.state !== 'closed') {
                this.#logger.info(
                    `PR ::: ${pull.base.user.login}/${pull.base.repo.name} #${pull.number} - processing...`
                )
                let reviews = await octokit.request(
                    'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
                    {
                        owner: pull.base.user.login,
                        repo: pull.base.repo.name,
                        pull_number: pull.number
                    }
                )
                reviews = reviews.data
                if (
                    reviews != null &&
                    Array.isArray(reviews) &&
                    reviews.length > 0
                ) {
                    let [lastReview] = reviews
                    if (reviews.length > 1) {
                        for (let i = 1; i < reviews.length; i++) {
                            const lastReviewTime = moment(
                                lastReview.submitted_at || new Date()
                            )
                            const reviewTime = moment(
                                reviews[i].submitted_at || new Date()
                            )
                            if (reviewTime.isAfter(lastReviewTime)) {
                                lastReview = reviews[i]
                            }
                        }
                    }
                    if (lastReview.state !== 'APPROVED') {
                        await this.#approve(pull)
                        await this.#merge(pull)
                    } else {
                        await this.#merge(pull)
                        this.#logger.info(
                            `#${pull.number} PR with number ${pull.id} is already approved.`
                        )
                    }
                } else {
                    await this.#approve(pull)
                    await this.#merge(pull)
                }
            } else {
                this.#logger.info(
                    `#${pull.number} PR with number ${pull.id} is already closed.`
                )
            }

            await this.#addLabels(pull)

            await this.#removeComments(pull)

            if (pull.state !== 'closed') {
                // TODO: Use separate class (e.g. BotConversationStrategy.start(pull))
                await this.#conversation(pull)
            }
        }
    }

    async #managePullRequests (owner, repoName) {
        this.#logger.info(`Processing pull requests ::: ${owner}/${repoName}`)
        const pulls = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
            owner: owner,
            repo: repoName,
            state: 'open',
            per_page: 1000,
            page: 1
        })
        this.#logger.info(
            `${pulls.data.length} pull requests is going to be processed in '${owner}/${repoName}' repo`
        )
        for (const pull of pulls.data.reverse()) {
            await this.#processPullRequest(pull)
        }
        this.#logger.info(
            `Processing pull requests has been finished ::: ${owner}/${repoName}`
        )
    }

    async start () {
        const usr = await octokit.request('GET /user')
        const orgs = await octokit.request('GET /user/orgs')
        this.#logger.info({ ...usr.data })

        for (const org of orgs.data) {
            this.#logger.info(`Starting scanning the ${org.login} org...`)
            const repos = await octokit.request('GET /orgs/{org}/repos', {
                org: org.login
            })

            for (const repo of repos.data) {
                this.#logger.info(
                    `Starting scanning the ${repo.name} repository...`
                )
                await this.#managePullRequests(org.login, repo.name)
            }
        }

        const repos = await octokit.request('GET /user/repos')
        for (const repo of repos.data) {
            this.#logger.info(
                `Starting scanning the ${repo.full_name} repository...`
            )
            if (!repo.archived) {
                await this.#managePullRequests(repo.owner.login, repo.name)
            } else {
                this.#logger.info(
                    `Repository ${repo.full_name} is archived. Skipped...`
                )
            }
        }
    }
}
