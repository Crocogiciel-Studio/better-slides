// Real-browser checks of the review UI. They skip when Chromium is not installed.
// Set BETTER_SLIDE_CHROMIUM to a Chromium/Chrome binary and BETTER_SLIDE_SCREENSHOTS to a folder to keep the screenshots.
import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Browser, BrowserContext, Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const demo = join(root, 'examples/demo-deck')
const PORT = 3131
const PLAIN_PORT = 3132
const shots = process.env.BETTER_SLIDE_SCREENSHOTS ?? join(tmpdir(), 'better-slide-screenshots')
/** The stand-in CLI answers `auth status` with this file's content when it exists (logged in otherwise). */
const authFile = join(tmpdir(), `better-slide-e2e-auth-${process.pid}.json`)
/** A browser Playwright installed, else a system one. BETTER_SLIDE_CHROMIUM wins when set. */
function findChromium(): string | undefined {
  let installed: string | undefined
  try {
    installed = createRequire(import.meta.url)('playwright-core').chromium.executablePath()
  } catch {
    // playwright-core missing or no browser path known: fall back to system browsers.
  }
  return [process.env.BETTER_SLIDE_CHROMIUM, installed, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(
    (p) => p && existsSync(p),
  )
}
const chromium = findChromium()
if (!chromium) console.warn('review-ui e2e skipped: no Chromium found. Set BETTER_SLIDE_CHROMIUM to a Chromium or Chrome binary.')

const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 640 },
]
const THEMES = ['light', 'dark'] as const
const API = `http://localhost:${PORT}/__better-slide`
const LONG = 'Make this much shorter and plainer, explain the benefit for the reader first, then the detail, and avoid the jargon that the audience does not know. '

const servers: ChildProcess[] = []
function serve(port: number, args: string[], env: Record<string, string> = {}) {
  const child = spawn('pnpm', ['--filter', 'demo-deck', 'exec', 'slidev', ...args, '--port', String(port)], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, ...env },
  })
  servers.push(child)
}
async function waitFor(url: string) {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`${url} did not come up`)
}

let browser: Browser

// A real browser against a dev server that may still be compiling: the 5 s default is too short.
describe.skipIf(!chromium)('review UI in Chromium', { timeout: 60_000 }, () => {
  beforeAll(async () => {
    mkdirSync(shots, { recursive: true })
    writeFileSync(join(demo, 'plain.e2e.md'), '---\ntheme: default\n---\n\n# One\n\n---\n\n# Two\n')
    serve(PORT, ['slides.md'], {
      BETTER_SLIDE_TEST: '1',
      BETTER_SLIDE_FAKE_AGENT: join(root, 'packages/agents/test/fixtures/fake-claude.mjs'),
      FAKE_CLAUDE_STEP_MS: '600', // slow enough to see a comment in progress
      FAKE_CLAUDE_AUTH_FILE: authFile,
    })
    serve(PLAIN_PORT, ['plain.e2e.md'])
    await Promise.all([waitFor(`http://localhost:${PORT}/2`), waitFor(`http://localhost:${PLAIN_PORT}/1`)])
    const { chromium: pw } = await import('playwright-core')
    browser = await pw.launch({ executablePath: chromium, args: ['--no-sandbox', '--disable-gpu'] })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    for (const s of servers) if (s.pid) try { process.kill(-s.pid, 'SIGTERM') } catch {}
    rmSync(join(demo, 'plain.e2e.md'), { force: true })
    rmSync(authFile, { force: true })
  })

  async function open(opts: { width?: number; height?: number; theme?: 'light' | 'dark'; slide?: number; port?: number } = {}) {
    const context: BrowserContext = await browser.newContext({
      viewport: { width: opts.width ?? 1280, height: opts.height ?? 720 },
      colorScheme: opts.theme ?? 'light',
    })
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await page.goto(`http://localhost:${opts.port ?? PORT}/${opts.slide ?? 2}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('#slide-container')
    return { page, context, errors }
  }

  const json = { 'content-type': 'application/json' }
  async function reset() {
    await fetch(`${API}/cancel`, { method: 'POST', headers: json })
    for (let i = 0; i < 20; i++) {
      const { locked } = (await (await fetch(`${API}/comments`)).json()) as { locked: boolean }
      if (!locked) break
      await new Promise((r) => setTimeout(r, 100))
    }
    await fetch(`${API}/comments`, { method: 'DELETE', headers: json })
  }
  const seed = async (n: number, note = LONG) => {
    for (let i = 0; i < n; i++)
      await fetch(`${API}/comments`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ slide: (i % 4) + 1, text: `Element number ${i + 1} of the deck`, selector: 'h1', note: `${i + 1}. ${note}` }),
      })
  }
  const slideNo = (page: Page) => Number(new URL(page.url()).pathname.split('/').pop())
  const rect = (page: Page, selector: string) =>
    page.evaluate((s) => {
      const r = document.querySelector(s)?.getBoundingClientRect()
      return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } : null
    }, selector)

  async function assertNoOverlap(page: Page) {
    const slide = await rect(page, '#slide-container')
    const side = await rect(page, '[data-testid=sidebar]')
    expect(slide && side).toBeTruthy()
    expect(slide!.right).toBeLessThanOrEqual(side!.left + 0.5)
    expect(side!.width).toBeLessThanOrEqual((page.viewportSize()!.width * 0.4) | 0)
    return { slide: slide!, side: side! }
  }

  /** ArrowRight must change the slide, then ArrowLeft brings it back. Focus must be on the page, not a button. */
  async function assertKeyboardWorks(page: Page, step: string) {
    const active = await page.evaluate(() => document.activeElement?.tagName)
    expect(active, `focus after ${step}`).toBe('BODY')
    const before = slideNo(page)
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => slideNo(page), { message: `ArrowRight after ${step}` }).toBe(before + 1)
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => slideNo(page), { message: `ArrowLeft after ${step}` }).toBe(before)
  }

  /** Selecting puts the cursor in the note: the arrow keys stay in the field and the slide does not change. */
  async function assertNoteFocused(page: Page, step: string) {
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), `focus after ${step}`).toBe('note')
    const before = slideNo(page)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(300)
    expect(slideNo(page), `ArrowRight in the note after ${step}`).toBe(before)
  }

  for (const theme of THEMES)
    it(`comments on the whole slide by its background or the control, without changing slide, in ${theme} mode`, async () => {
      await reset()
      const { page, context, errors } = await open({ theme })
      await page.keyboard.press('r')
      await page.waitForSelector('[data-testid=sidebar]')
      const before = await rect(page, '[data-testid=sidebar]')
      const content = (await rect(page, '#slide-content'))!

      await page.mouse.click(content.left + content.width * 0.75, content.top + content.height * 0.85)
      await expect.poll(() => page.locator('[data-testid=composer-target]').textContent()).toBe('Whole slide')
      expect(slideNo(page), 'a click on the slide background must not change slide').toBe(2)
      expect(await page.locator('[data-slidev-no="2"][data-better-slide-selected=slide]').count()).toBe(1)
      expect(await rect(page, '[data-testid=sidebar]')).toEqual(before) // autofocus moved nothing
      expect(await page.locator('[data-testid=stack]').evaluate((n) => n.scrollTop)).toBe(0)
      await assertNoteFocused(page, 'a background click')
      await assertNoOverlap(page)
      await page.screenshot({ path: join(shots, `13-whole-slide-selected-1280x720-${theme}.png`) })

      await page.locator('[data-testid=note]').fill('Lighter background')
      await page.locator('[data-testid=add]').click()
      await expect.poll(() => page.locator('[data-testid=target]').allTextContents()).toEqual(['Slide 2 · whole slide'])
      expect(await page.locator('[data-better-slide-selected]').count()).toBe(0)
      await assertKeyboardWorks(page, 'adding a whole-slide comment')

      await page.locator('#slide-content h1:visible').first().click()
      await assertNoteFocused(page, 'select an element')
      await page.screenshot({ path: join(shots, `14-composer-autofocus-1280x720-${theme}.png`) })
      await page.locator('[data-testid=composer-whole-slide]').click()
      await expect.poll(() => page.locator('[data-testid=composer-target]').textContent()).toBe('Whole slide')
      await page.locator('[data-testid=dismiss]').click()

      await page.locator('[data-testid=whole-slide]').click()
      await assertNoteFocused(page, 'the Whole slide control')
      await page.keyboard.type('Add a closing line')
      await page.keyboard.press('Enter')
      await expect.poll(() => page.locator('[data-testid=target]').allTextContents()).toEqual(['Slide 2 · whole slide', 'Slide 2 · whole slide'])
      expect(slideNo(page)).toBe(2)
      await assertKeyboardWorks(page, 'adding with the Whole slide control')
      expect(errors).toEqual([])
      await context.close()
      await reset()
    })

  it('puts the toggle inside the Slidev bar and shows no floating card', async () => {
    await reset()
    const { page, context, errors } = await open()
    expect(await page.locator('[data-testid=panel]').count()).toBe(0)
    expect(await page.locator('[data-testid=sidebar]').count()).toBe(0)
    expect(await page.locator('nav [data-testid=toggle]').count()).toBe(1)
    // The bar is hidden until hover, like Slidev's own buttons.
    expect(await page.locator('nav').evaluate((n) => getComputedStyle(n.parentElement!).opacity)).toBe('0')
    await page.mouse.move(60, 700)
    await expect.poll(() => page.locator('nav').evaluate((n) => getComputedStyle(n.parentElement!).opacity)).toBe('1')
    expect(await page.locator('nav [data-testid=toggle]').isVisible()).toBe(true)
    await page.screenshot({ path: join(shots, 'bar-revealed-1280x720-light.png') })
    expect(errors).toEqual([])
    await context.close()
  })

  it('shows the pending count on the toggle', async () => {
    await reset()
    await seed(3, 'short')
    const { page, context } = await open()
    await expect.poll(() => page.locator('[data-testid=count]').textContent()).toContain('3')
    await context.close()
    await reset()
  })

  for (const theme of THEMES)
    for (const size of SIZES)
      it(`keeps the sidebar and the slide apart at ${size.width}x${size.height} in ${theme} mode`, async () => {
        await reset()
        const tag = `${size.width}x${size.height}-${theme}`
        const { page, context } = await open({ ...size, theme })
        expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(theme === 'dark')
        const full = await rect(page, '#slide-container')
        await page.screenshot({ path: join(shots, `1-initial-${tag}.png`) })

        await page.mouse.move(60, size.height - 20)
        await page.locator('[data-testid=toggle]').click()
        await page.waitForSelector('[data-testid=sidebar]')
        const open1 = await assertNoOverlap(page)
        expect(open1.slide.width).toBeLessThan(full!.width)
        expect(await page.locator('[data-testid=sidebar]').evaluate((n) => getComputedStyle(n).backgroundColor)).toBe(theme === 'dark' ? 'rgb(18, 18, 18)' : 'rgb(255, 255, 255)')
        await page.screenshot({ path: join(shots, `2-review-on-${tag}.png`) })

        await page.locator('#slide-content h1:visible').first().click()
        await page.locator('[data-testid=note]').fill('Make this title shorter and add the key figure')
        await assertNoOverlap(page)
        await page.screenshot({ path: join(shots, `3-selected-typing-${tag}.png`) })
        await page.locator('[data-testid=dismiss]').click()

        await seed(3, 'Reword this part.')
        await page.reload({ waitUntil: 'networkidle' })
        await page.keyboard.press('r')
        await page.waitForSelector('[data-testid=item]')
        await assertNoOverlap(page)
        await page.screenshot({ path: join(shots, `4-three-comments-${tag}.png`) })

        await seed(17)
        await page.reload({ waitUntil: 'networkidle' })
        await page.keyboard.press('r')
        await expect.poll(() => page.locator('[data-testid=item]').count()).toBe(20)
        const { slide, side } = await assertNoOverlap(page)
        expect(slide.width).toBe(open1.slide.width)
        const stack = await page.locator('[data-testid=stack]').evaluate((n) => ({ scroll: n.scrollHeight, client: n.clientHeight }))
        expect(stack.scroll).toBeGreaterThan(stack.client) // it scrolls inside itself
        expect(side.bottom).toBeLessThanOrEqual(size.height)
        const clipped = await page.locator('[data-testid=item]').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length)
        expect(clipped).toBe(0)
        await page.screenshot({ path: join(shots, `5-twenty-comments-${tag}.png`) })

        await reset()
        await seed(2, 'HANG waiting for the agent')
        await page.reload({ waitUntil: 'networkidle' })
        await page.keyboard.press('r')
        await page.locator('[data-testid=send]').click()
        await page.waitForSelector('[data-testid=cancel]')
        expect(await page.locator('[data-testid=remove]').count()).toBe(0) // locked
        await assertNoOverlap(page)
        await page.screenshot({ path: join(shots, `6-agent-running-${tag}.png`) })
        await page.locator('[data-testid=cancel]').click()

        await reset()
        await seed(2, 'FAIL this one')
        await page.reload({ waitUntil: 'networkidle' })
        await page.keyboard.press('r')
        await page.locator('[data-testid=send]').click()
        // The server keeps the previous status ("failed: cancelled"); wait for this run's own failure.
        await expect.poll(() => page.locator('[data-testid=status]').textContent()).toMatch(/failed: (?!cancelled)/)
        await assertNoOverlap(page)
        await page.screenshot({ path: join(shots, `7-agent-failed-${tag}.png`) })

        // Leaving review mode gives the canvas its full width back.
        await page.locator('[data-testid=close]').click()
        expect(await page.locator('[data-testid=sidebar]').count()).toBe(0)
        expect((await rect(page, '#slide-container'))!.width).toBe(full!.width)
        await context.close()
        await reset()
      }, 90_000)

  it('keeps the arrow keys working after every review interaction', async () => {
    await reset()
    const { page, context } = await open()
    await page.mouse.move(60, 700)
    await page.locator('[data-testid=toggle]').click()
    await assertKeyboardWorks(page, 'toggle')

    const slide = slideNo(page)
    await page.locator('#slide-content h1:visible').first().click()
    expect(slideNo(page), 'a click on the selected element must not advance').toBe(slide)
    await page.waitForSelector('[data-testid=composer]')
    await assertNoteFocused(page, 'select')

    // Another target keeps the typed note and the focus.
    await page.keyboard.type('keep me')
    await page.locator('#slide-content p:visible').first().click()
    await expect.poll(() => page.locator('[data-testid=composer-target]').textContent()).toContain('Comments let you point')
    expect(await page.locator('[data-testid=note]').inputValue()).toBe('keep me')
    await assertNoteFocused(page, 'a second selection')
    await page.locator('[data-testid=dismiss]').click()
    await assertKeyboardWorks(page, 'Cancel')

    await page.locator('#slide-content h1:visible').first().click()
    await page.waitForSelector('[data-testid=composer]')

    // Arrow keys edit text while the note field has the focus; Escape gives the deck back.
    await page.locator('[data-testid=note]').click()
    await page.keyboard.type('abc')
    await page.keyboard.press('ArrowLeft')
    expect(slideNo(page)).toBe(slide)
    expect(await page.locator('[data-testid=note]').evaluate((n: HTMLTextAreaElement) => n.selectionStart)).toBe(2)
    await page.keyboard.press('ArrowRight')
    expect(slideNo(page)).toBe(slide)
    await page.keyboard.press('Escape')
    await assertKeyboardWorks(page, 'Escape in the note field')

    await page.locator('[data-testid=note]').fill('Shorter')
    await page.locator('[data-testid=add]').click()
    await page.waitForSelector('[data-testid=item]')
    await assertKeyboardWorks(page, 'add')

    await page.locator('[data-testid=remove]').click()
    await expect.poll(() => page.locator('[data-testid=item]').count()).toBe(0)
    await assertKeyboardWorks(page, 'remove')

    await page.locator('#slide-content h1:visible').first().click()
    await assertNoteFocused(page, 'select after remove')
    await page.locator('[data-testid=note]').fill('HANG forever')
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-testid=item]')
    await assertKeyboardWorks(page, 'add with Enter')

    await page.locator('[data-testid=send]').click()
    await page.waitForSelector('[data-testid=cancel]')
    await assertKeyboardWorks(page, 'send')

    await page.locator('[data-testid=cancel]').click()
    await expect.poll(() => page.locator('[data-testid=status]').getAttribute('data-state')).toBe('failed')
    await assertKeyboardWorks(page, 'cancel')

    await page.locator('[data-testid=close]').click()
    await assertKeyboardWorks(page, 'closing review mode')
    await context.close()
    await reset()
  }, 90_000)

  const states = (page: Page) => page.locator('[data-testid=item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
  const runState = (page: Page) => page.locator('[data-testid=status]').getAttribute('data-state')
  const seedNotes = async (notes: [number, string][]) => {
    for (const [slide, note] of notes)
      await fetch(`${API}/comments`, { method: 'POST', headers: json, body: JSON.stringify({ slide, text: `Element on slide ${slide}`, selector: 'h1', note }) })
  }
  async function openReview() {
    const o = await open()
    await o.page.keyboard.press('r')
    await o.page.waitForSelector('[data-testid=item]')
    return o
  }

  it('shows each comment in progress then done or not done with a reply, and Clear finished keeps the rest', async () => {
    await reset()
    await seedNotes([[2, 'Shorter title'], [2, 'Add a figure SKIP'], [4, 'Rename to Summary']])
    const { page, context, errors } = await openReview()
    expect(await states(page)).toEqual(['waiting', 'waiting', 'waiting'])

    await page.locator('[data-testid=send]').click()
    await page.waitForSelector('[data-testid=item][data-state=in-progress]')
    await expect.poll(() => page.locator('[data-testid=status]').textContent()).toMatch(/(Reading|Editing) slides\.md/)
    await expect.poll(() => page.locator('[data-testid=progress]').textContent()).toMatch(/Comment [1-3] of 3/)
    expect(await page.locator('[data-testid=item][data-state=in-progress]').count()).toBe(1)
    await assertNoOverlap(page)
    await page.screenshot({ path: join(shots, '8-run-in-progress-1280x720-light.png') })
    await assertKeyboardWorks(page, 'send, during the run')

    await expect.poll(() => runState(page), { timeout: 20_000 }).toBe('finished')
    expect(await states(page)).toEqual(['done', 'not-done', 'done'])
    const replies = await page.locator('[data-testid=reply]').allTextContents()
    expect(replies).toHaveLength(3)
    expect(replies[0]).toContain('Shorter title')
    expect(replies[1]).toContain('Not done')
    expect(await page.locator('[data-testid=status]').textContent()).toContain('2 done, 1 not done')
    await assertNoOverlap(page)
    await page.screenshot({ path: join(shots, '9-run-finished-1280x720-light.png') })
    await assertKeyboardWorks(page, 'the end of a run')

    await page.locator('[data-testid=clear-finished]').click()
    await expect.poll(() => states(page)).toEqual(['not-done'])
    expect(await page.locator('[data-testid=reply]').textContent()).toContain('Not done')
    expect(await page.locator('[data-testid=send]').textContent()).toContain('(1)')
    await assertKeyboardWorks(page, 'Clear finished')
    expect(errors).toEqual([])
    await context.close()
    await reset()
  })

  it('closes every comment with the agent final text when it prints no marker', async () => {
    await reset()
    await seedNotes([[2, 'NOREPORT Shorter title'], [4, 'Rename to Summary']])
    const { page, context } = await openReview()
    await page.locator('[data-testid=send]').click()
    // The server still shows the previous run's status until this run starts: wait on the comments.
    await expect.poll(() => states(page), { timeout: 20_000 }).toEqual(['unreported', 'unreported'])
    expect(await runState(page)).toBe('finished')
    expect(await page.locator('[data-testid=reply]').first().textContent()).toContain('I applied the review comments')
    await page.screenshot({ path: join(shots, '10-run-no-marker-1280x720-light.png') })
    await context.close()
    await reset()
  })

  it('leaves nothing in progress when the agent fails mid-run', async () => {
    await reset()
    await seedNotes([[2, 'Shorter title'], [2, 'CRASH here'], [4, 'Rename to Summary']])
    const { page, context } = await openReview()
    await page.locator('[data-testid=send]').click()
    await expect.poll(() => states(page), { timeout: 20_000 }).toEqual(['done', 'failed', 'waiting'])
    expect(await runState(page)).toBe('failed')
    expect(await page.locator('[data-testid=send]').textContent()).toContain('(2)')
    await assertKeyboardWorks(page, 'a failed run')
    await context.close()
    await reset()
  })

  it('disables Send and shows the login hint while the agent is logged out, until Check again', async () => {
    await reset()
    writeFileSync(authFile, JSON.stringify({ loggedIn: false, authMethod: 'none' }))
    await fetch(`${API}/agent?refresh=1`)
    await seedNotes([[2, 'Shorter title']])
    const { page, context } = await openReview()
    await expect.poll(() => page.locator('[data-testid=readiness]').textContent()).toContain('Not logged in: run claude then /login')
    expect(await page.locator('[data-testid=readiness]').getAttribute('data-tone')).toBe('error')
    expect(await page.locator('[data-testid=send]').isDisabled()).toBe(true)
    await assertNoOverlap(page)
    await page.screenshot({ path: join(shots, '11-not-logged-in-1280x720-light.png') })

    rmSync(authFile)
    await page.locator('[data-testid=recheck]').click()
    await expect.poll(() => page.locator('[data-testid=readiness]').textContent()).toContain(': ready')
    expect(await page.locator('[data-testid=send]').isDisabled()).toBe(false)
    await assertKeyboardWorks(page, 'Check again')
    await context.close()
    await reset()
  })

  it('puts the comments back to waiting and says to log in when a run fails on login', async () => {
    await reset()
    await seedNotes([[2, 'AUTH_FAIL Shorter title'], [4, 'Rename to Summary']])
    const { page, context } = await openReview()
    await page.locator('[data-testid=send]').click()
    await expect.poll(() => page.locator('[data-testid=status]').textContent(), { timeout: 20_000 }).toContain('login missing or expired')
    expect(await states(page)).toEqual(['waiting', 'waiting'])
    await page.screenshot({ path: join(shots, '12-auth-failure-1280x720-light.png') })
    await context.close()
    await reset()
  })

  it('leaves the presenter view and the overview working', async () => {
    const presenter = await open({ slide: 2 }).then(async (o) => (await o.page.goto(`http://localhost:${PORT}/presenter/2`, { waitUntil: 'networkidle' }), o))
    await presenter.page.waitForSelector('nav')
    expect(await presenter.page.locator('[data-testid=toggle]').count()).toBe(0)
    expect(await presenter.page.locator('[data-testid=sidebar]').count()).toBe(0)
    await presenter.page.keyboard.press('r')
    expect(await presenter.page.locator('[data-testid=sidebar]').count()).toBe(0)
    await presenter.page.screenshot({ path: join(shots, 'presenter-1280x720-light.png') })
    expect(presenter.errors).toEqual([])
    await presenter.context.close()

    const overview = await open({ slide: 2 })
    await overview.page.keyboard.press('o')
    await overview.page.waitForSelector('.slidev-slide-container >> nth=3')
    await overview.page.waitForTimeout(800) // let the overview finish its fade-in
    await overview.page.screenshot({ path: join(shots, 'overview-1280x720-light.png') })
    expect(overview.errors).toEqual([])
    await overview.context.close()
  })

  it('does not break plain Slidev without the addon', async () => {
    const { page, context, errors } = await open({ slide: 1, port: PLAIN_PORT })
    expect(await page.locator('[data-testid=toggle]').count()).toBe(0)
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => slideNo(page)).toBe(2)
    expect(errors).toEqual([])
    await context.close()
  })
})
