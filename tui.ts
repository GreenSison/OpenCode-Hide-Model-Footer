import { Plugin } from "@opencode/plugin/tui"
import { Yoga } from "@opentui/core"
import { appendFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const DEFAULT_INTERVAL = 250
const MIN_INTERVAL = 100
const MAX_INTERVAL = 10_000
const MAX_DEPTH = 500

type Options = {
  /** Set to false to disable the plugin without removing it. */
  enabled?: boolean
  /** How often to look for a new prompt, in milliseconds. */
  interval?: number
  /** Write discovery details to a log file. */
  debug?: boolean
}

function paddingTop(node: any): number | undefined {
  try {
    const value = node?.getPadding?.(Yoga.Edge.Top)
    if (typeof value === "number") return value
    if (value && typeof value === "object" && "value" in value) {
      const parsed = Number((value as { value: unknown }).value)
      if (Number.isFinite(parsed)) return parsed
    }
  } catch {}
  return undefined
}

function flexShrink(node: any): number | undefined {
  try {
    const value = node?.getFlexShrink?.()
    if (typeof value === "number") return value
  } catch {}
  return undefined
}

function childrenOf(node: any): any[] {
  try {
    const children = node?.getChildren?.()
    return Array.isArray(children) ? children : []
  } catch {
    return []
  }
}

function isTextarea(node: any): boolean {
  return Boolean(
    node &&
      typeof node === "object" &&
      "extmarks" in node &&
      "plainText" in node &&
      typeof node.getChildren === "function",
  )
}

function nextSibling(node: any): any | undefined {
  const parent = node?.parent
  if (!parent) return undefined
  const siblings = childrenOf(parent)
  const index = siblings.indexOf(node)
  if (index < 0) return undefined
  return siblings[index + 1]
}

/**
 * The composer metadata row is the box rendered immediately after the prompt
 * textarea. In current OpenCode versions it has one cell of top padding and
 * does not shrink.
 *
 * Older or newer layouts may drop the shrink flag, so also accept a padded
 * single-child wrapper whose child has the agent and model group inside it.
 */
function looksLikeMetadataRow(node: any): boolean {
  if (!node || paddingTop(node) !== 1) return false
  if (flexShrink(node) === 0) return true
  const children = childrenOf(node)
  if (children.length !== 1) return false
  return childrenOf(children[0]).length >= 2
}

function plainText(node: any): string {
  try {
    const chunks = node?.content?.chunks
    if (Array.isArray(chunks)) return chunks.map((chunk: any) => chunk?.text ?? "").join("")
  } catch {}
  return ""
}

function describe(node: any): string {
  return [
    `id=${JSON.stringify(String(node?.id ?? ""))}`,
    `children=${childrenOf(node).length}`,
    `padTop=${paddingTop(node)}`,
    `shrink=${flexShrink(node)}`,
    plainText(node) ? `text=${JSON.stringify(plainText(node).slice(0, 60))}` : "",
  ]
    .filter(Boolean)
    .join(" ")
}

export default Plugin.define({
  id: "opencode-hide-model-footer",
  setup(context) {
    const options = context.options as Options
    if (options?.enabled === false) return

    const rawInterval = Number(options?.interval)
    const interval = Number.isFinite(rawInterval)
      ? Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, rawInterval))
      : DEFAULT_INTERVAL
    const debug = options?.debug === true
    const logPath = join(tmpdir(), "opencode-hide-model-footer.log")

    if (debug) {
      try {
        writeFileSync(logPath, "")
      } catch {}
    }

    const log = (line: string) => {
      if (!debug) return
      try {
        appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`)
      } catch {}
    }

    const hidden = new Set<any>()
    let current: any
    let stopped = false
    let scans = 0
    let found = 0

    const attached = (node: any): boolean => {
      const root = context.renderer?.root
      if (!root) return false
      let cursor: any = node
      while (cursor) {
        if (cursor === root) return true
        cursor = cursor.parent
      }
      return false
    }

    const scan = () => {
      if (stopped) return
      if (current && !current.isDestroyed && current.visible === false && attached(current)) return

      scans += 1
      let match: any
      let textareas = 0

      const visit = (node: any, depth: number) => {
        if (!node || match || depth > MAX_DEPTH) return
        if (isTextarea(node)) {
          textareas += 1
          const candidate = nextSibling(node)
          if (candidate && looksLikeMetadataRow(candidate)) {
            match = candidate
            return
          }
          if (scans <= 5) log(`textarea ${describe(node)} -> ${candidate ? describe(candidate) : "no next sibling"}`)
        }
        for (const child of childrenOf(node)) visit(child, depth + 1)
      }

      try {
        visit(context.renderer?.root, 0)
      } catch (error) {
        log(`scan error: ${String(error)}`)
      }

      if (match) {
        if (match.visible !== false) {
          match.visible = false
          hidden.add(match)
          current = match
          found += 1
          log(`hidden ${describe(match)}`)
        }
        return
      }

      if (scans <= 5) log(`scan ${scans}: ${textareas} textarea(s), no model row`)
    }

    scan()
    const timer = setInterval(scan, interval)

    return () => {
      stopped = true
      clearInterval(timer)
      for (const row of hidden) {
        try {
          row.visible = true
        } catch {}
      }
      log(`stopped (scans=${scans}, hidden=${found})`)
    }
  },
})
