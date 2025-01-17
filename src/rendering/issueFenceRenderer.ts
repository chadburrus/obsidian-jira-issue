import { MarkdownPostProcessorContext } from "obsidian"
import { IJiraIssue } from "../client/jiraInterfaces"
import { JiraClient } from "../client/jiraClient"
import { ObjectsCache } from "../objectsCache"
import { RenderingCommon as RC } from "./renderingCommon"
import { COMMENT_REGEX } from "src/settings"

const ISSUE_REGEX = /^\s*([A-Z0-9]+-[0-9]+)\s*$/i
const ISSUE_LINK_REGEX = /\/([A-Z0-9]+-[0-9]+)\s*$/i

function getIssueKey(line: string): string | null {
    if (COMMENT_REGEX.test(line)) {
        return null
    }
    const matches = line.match(ISSUE_REGEX)
    if (matches) {
        return matches[1]
    }
    const matchesLink = line.match(ISSUE_LINK_REGEX)
    if (matchesLink) {
        return matchesLink[1]
    }
    return null
}

function updateRenderedIssues(el: HTMLElement, renderedItems: Record<string, HTMLElement>): void {
    if (!Object.isEmpty(renderedItems)) {
        el.replaceChildren(RC.renderContainer(Object.values(renderedItems)))
    } else {
        el.replaceChildren(RC.renderContainer([renderNoItems()]))
    }
}

function renderNoItems(): HTMLElement {
    const tagsRow = createDiv('ji-tags has-addons')
    createSpan({ cls: 'ji-tag is-danger is-light', text: 'JiraIssue', parent: tagsRow })
    createSpan({ cls: 'ji-tag is-danger', text: 'No valid issues found', parent: tagsRow })
    return tagsRow
}

export const IssueFenceRenderer = async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> => {
    const renderedItems: Record<string, HTMLElement> = {}
    for (const line of source.split('\n')) {
        const issueKey = getIssueKey(line)
        if (issueKey) {
            // console.log(`Issue found: ${issueKey}`)
            const cachedIssue = ObjectsCache.get(issueKey)
            if (cachedIssue) {
                if (cachedIssue.isError) {
                    renderedItems[issueKey] = RC.renderIssueError(issueKey, cachedIssue.data as string)
                } else {
                    renderedItems[issueKey] = RC.renderIssue(cachedIssue.data as IJiraIssue)
                }
            } else {
                // console.log(`Issue not available in the cache`)
                renderedItems[issueKey] = RC.renderLoadingItem(issueKey)
                JiraClient.getIssue(issueKey).then(newIssue => {
                    const issue = ObjectsCache.add(issueKey, newIssue).data as IJiraIssue
                    renderedItems[issueKey] = RC.renderIssue(issue)
                    updateRenderedIssues(el, renderedItems)
                }).catch(err => {
                    ObjectsCache.add(issueKey, err, true)
                    renderedItems[issueKey] = RC.renderIssueError(issueKey, err)
                    updateRenderedIssues(el, renderedItems)
                })
            }
        }
    }
    updateRenderedIssues(el, renderedItems)
}
