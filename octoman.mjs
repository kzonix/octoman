
const {Octokit} = require("@octokit/core");
const moment = require("moment")

const octokit = new Octokit({auth: process.env.GITHUB_TOKEN});

async function approve(pull) {
    console.log(`Going to approve PR ${pull.number}`)
    await octokit.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
        owner: pull.base.user.login,
        repo: pull.base.repo.name,
        pull_number: pull.number,
        event: 'APPROVE'
    })
}

async function addLabels(pull) {
    // delete all labels
    let res = (pull.labels || [{name: "none"}])[0]?.name === 'dependencies'
    if (res) {
        console.log(`#${pull.number} PR with ${pull.id} already has right label (dependencies).`)
    } else {
        console.log(`#${pull.number} PR with ${pull.id} has extra labels (dependencies). Deleting...`)
        await octokit.request('DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels', {
            owner: pull.base.user.login,
            repo: pull.base.repo.name,
            issue_number: pull.number,
        })
        // mark dependencies
        console.log(`#${pull.number} PR with ${pull.id} id - Adding the correct label (dependencies).`)
        await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
            owner: pull.base.user.login,
            repo: pull.base.repo.name,
            issue_number: pull.number,
            labels: ['dependencies']
        })
    }


}

async function removeComments(pull) {
    console.debug(`Deleting comments from PR #${pull.number}`)
    let comments = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner: pull.base.user.login,
        repo: pull.base.repo.name,
        issue_number: pull.number
    })

    for (const comment of comments.data) {
        console.debug(`Deleting comment #${comment.id} ...`)
        await octokit.request('DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}', {
            owner: pull.base.user.login,
            repo: pull.base.repo.name,
            comment_id: comment.id
        })
    }

    let events = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/events', {
        owner: pull.base.user.login,
        repo: pull.base.repo.name,
        issue_number: pull.number
    })

    for (const event of events.data) {
        if (event.event === 'labeled')
            console.debug(`PR#${pull.number} - event = `, event.label)
    }
}

async function conversation(pull) {
    //Todo: 29.08.2020 - refactor this part with separate method
    // - load all comments of PR, determine the last comment of bot (problem with rebasing, asking for recreation)
    // - strategy pattern: use appropriate language for communication with bots.
    // - set comments with appropriate commands or fallback logic to deal with conflict PR.
    if (pull.user.login === 'renovate[bot]') {
        console.log(" > revonate - rebase");
        await octokit.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
            owner: pull.base.user.login,
            repo: pull.base.repo.name,
            pull_number: pull.number,
            body: pull.body.replace(" - [ ] <!-- rebase-check -->",
                " - [x] <!-- rebase-check -->")
        })
    }
    if (pull.user.login === 'depfu[bot]') {
        console.log(" > depfu - rebase");
        await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
            owner: pull.base.user.login,
            repo: pull.base.repo.name,
            issue_number: pull.number,
            body: '@depfu rebase'
        })
    }
    // TODO: Depfu bot - separate class.
    if (pull.user.login === 'dependabot-preview[bot]') {
        console.log(" > dependabot - rebase");
        await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
            owner: pull.base.user.login,
            repo: pull.base.repo.name,
            issue_number: pull.number,
            body: '@dependabot rebase'
        })
    }
    if (pull.user.login === 'dependabot-preview[bot]') {
        console.log(" > dependabot - recreate");
        await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
            owner: pull.base.user.login,
            repo: pull.base.repo.name,
            issue_number: pull.number,
            body: '@dependabot recreate'
        })
    }
}

async function processPullRequest(pull) {
    if (pull.user.login.indexOf('[bot]') >= 0) {
        console.log(`#${pull.number} PR with number ${pull.id} is a bot request to update dependencies.`)
        if (pull.state !== 'closed') {
            console.debug(`PR ::: ${pull.base.user.login}/${pull.base.repo.name} #${pull.number} - processing...`)
            let reviews = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
                owner: pull.base.user.login,
                repo: pull.base.repo.name,
                pull_number: pull.number
            })
            reviews = reviews.data;
            if (reviews != null && Array.isArray(reviews) && reviews.length > 0) {
                let lastReview = reviews[0];
                if (reviews.length > 1)
                    for (let i = 1; i < reviews.length; i++) {
                        const lastReviewTime = moment(lastReview.submitted_at || new Date())
                        const reviewTime = moment(reviews[i].submitted_at || new Date())
                        if (reviewTime.isAfter(lastReviewTime)) {
                            lastReview = reviews[i]
                        }
                    }
                if (lastReview.state !== 'APPROVED') {
                    await approve(pull)
                } else {
                    console.log(`#${pull.number} PR with number ${pull.id} is already approved.`)
                }
            } else {
                await approve(pull);
            }
        } else {
            console.log(`#${pull.number} PR with number ${pull.id} is already closed.`)
        }

        await addLabels(pull)

        await removeComments(pull);

        if (pull.state !== 'closed') {
            // TODO: Use separate class (e.g. BotConversationStrategy.start(pull))
            await conversation(pull);
        }
    }
}

async function managePullRequests(owner, repoName) {
    console.log(`Processing pull requests ::: ${owner}/${repoName}`)
    let pulls = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
        owner: owner,
        repo: repoName,
        state: 'open',
        per_page: 1000,
        page: 1
    })
    console.log(`${pulls.data.length} pull requests is going to be processed in '${owner}/${repoName}' repo`)
    for (const pull of pulls.data.reverse()) {
        await processPullRequest(pull);
    }
    console.log(`Processing pull requests has been finished ::: ${owner}/${repoName}`)

}

async function main() {
    let usr = await octokit.request('GET /user')
    let orgs = await octokit.request('GET /user/orgs')
    console.debug(`\n# User = ${usr.data.login}\n# Name = ${usr.data.name}\n# Email = ${usr.data.email}\n`
    )
    for (const org of orgs.data) {
        console.debug(`Starting scanning the ${org.login} org...`)
        let repos = await octokit.request('GET /orgs/{org}/repos', {
            org: org.login
        })

        for (const repo of repos.data) {
            console.debug(`Starting scanning the ${repo.name} repository...`)
            await managePullRequests(org.login, repo.name);
        }
    }

    let repos = await octokit.request('GET /user/repos')
    for (const repo of repos.data) {
        console.debug(`Starting scanning the ${repo.full_name} repository...`)
        if (!repo.archived)
            await managePullRequests(repo.owner.login, repo.name);
        else {
            console.debug(`Repository ${repo.full_name} is archived. Skipped...`)
        }
    }


}

main()
    .catch(e => console.error(e));
