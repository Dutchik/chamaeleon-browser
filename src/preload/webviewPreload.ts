// webview内ページ用 preload（パッチ適用エンジン＋操作レコーダー）。
// CSP の影響を受けない isolated world で動くため、CSS/JS/DOMルールを確実に適用できる（仕様§20.1）。
import { ipcRenderer } from 'electron';
import type { CssPatch, DomRule, JsPatch, RecordedEvent } from '../shared/types';

// ---------------- パッチ適用（ホスト=rendererから受信して実行） ----------------

type ApplyPayload = {
  profileId: string;
  css: CssPatch[];
  js: JsPatch[];
  dom: DomRule[];
};

function report(type: 'css' | 'js' | 'dom', id: string, status: 'success' | 'error', message?: string) {
  ipcRenderer.sendToHost('chm:log', { type, id, status, message, url: location.href });
}

function injectCss(patch: CssPatch) {
  try {
    const el = document.createElement('style');
    el.dataset.chamaeleon = patch.id;
    el.textContent = patch.code;
    (document.head || document.documentElement).appendChild(el);
    report('css', patch.id, 'success');
  } catch (e) {
    report('css', patch.id, 'error', String(e));
  }
}

function runJs(patch: JsPatch) {
  try {
    // isolated world 内で実行（ページのCSPに縛られない）
    // eslint-disable-next-line no-new-func
    new Function(patch.code)();
    report('js', patch.id, 'success');
  } catch (e) {
    report('js', patch.id, 'error', String(e));
  }
}

function applyDomRule(rule: DomRule) {
  const run = () => {
    const els = Array.from(document.querySelectorAll(rule.selector));
    if (els.length === 0) return false;
    for (const el of els) {
      const h = el as HTMLElement;
      switch (rule.action) {
        case 'hide': h.style.setProperty('display', 'none', 'important'); break;
        case 'remove': h.remove(); break;
        case 'highlight':
          h.style.setProperty('outline', '3px solid #ff5a4e', 'important');
          h.style.setProperty('background', 'rgba(255,90,78,0.12)', 'important');
          break;
        case 'replaceText': h.textContent = rule.value ?? ''; break;
        case 'addClass': if (rule.value) h.classList.add(...rule.value.split(/\s+/)); break;
        case 'setStyle': if (rule.value) h.setAttribute('style', (h.getAttribute('style') ?? '') + ';' + rule.value); break;
        case 'move': {
          if (rule.value) document.querySelector(rule.value)?.appendChild(h);
          break;
        }
        case 'click': h.click(); break;
        case 'input': {
          const input = h as HTMLInputElement;
          input.value = rule.value ?? '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
      }
    }
    report('dom', rule.id, 'success');
    return true;
  };

  if (run()) return;
  if (!rule.waitForSelector) { report('dom', rule.id, 'error', 'selector not found: ' + rule.selector); return; }
  // 要素出現を待つ（SPA対応・仕様§8.3 waitForSelector）
  const timeout = setTimeout(() => { observer.disconnect(); report('dom', rule.id, 'error', 'timeout: ' + rule.selector); }, rule.timeoutMs || 10000);
  const observer = new MutationObserver(() => {
    if (run()) { clearTimeout(timeout); observer.disconnect(); }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

const pendingIdle: Array<() => void> = [];

ipcRenderer.on('chm:apply', (_e, payload: ApplyPayload) => {
  const byRunAt = <T extends { runAt: string; priority?: number }>(items: T[], runAt: string) =>
    items.filter((i) => i.runAt === runAt).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  const stages: Array<{ at: 'document_start' | 'document_end' | 'idle' }> = [
    { at: 'document_start' }, { at: 'document_end' }, { at: 'idle' },
  ];
  for (const { at } of stages) {
    const work = () => {
      byRunAt(payload.css, at).forEach(injectCss);
      payload.dom.filter((r) => r.enabled && r.runAt === at).forEach(applyDomRule);
      byRunAt(payload.js.filter((j) => j.enabled), at).forEach(runJs);
    };
    if (at === 'document_start') work();
    else if (at === 'document_end') {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', work, { once: true });
      else work();
    } else {
      if (document.readyState === 'complete') setTimeout(work, 300);
      else window.addEventListener('load', () => setTimeout(work, 300), { once: true });
      pendingIdle.push(work);
    }
  }
});

// 手動実行（Site Panel の ▶ ボタン）
ipcRenderer.on('chm:runJs', (_e, patch: JsPatch) => runJs(patch));

// ---------------- SPA URL変化検知（仕様§10.2） ----------------

let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    ipcRenderer.sendToHost('chm:urlChanged', { url: lastUrl });
  }
}, 400);

// ---------------- 操作レコーダー（仕様§9） ----------------

let recording = false;

function cssPath(el: Element): string {
  // セレクタ生成方針（仕様§9.6）: id > data-testid > name > aria-label > class > 階層
  if (el.id) return `#${CSS.escape(el.id)}`;
  const testid = el.getAttribute('data-testid');
  if (testid) return `[data-testid="${CSS.escape(testid)}"]`;
  const name = el.getAttribute('name');
  if (name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  const aria = el.getAttribute('aria-label');
  if (aria) return `${el.tagName.toLowerCase()}[aria-label="${CSS.escape(aria)}"]`;

  // 階層パス（3階層まで + nth-of-type）
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body && parts.length < 4) {
    let part = cur.tagName.toLowerCase();
    const stableClass = Array.from(cur.classList).find((c) => /^[a-zA-Z][\w-]{2,30}$/.test(c) && !/\d{3,}/.test(c));
    if (stableClass) part += '.' + CSS.escape(stableClass);
    const parentEl: Element | null = cur.parentElement;
    if (parentEl) {
      const same = Array.from(parentEl.children).filter((c) => c.tagName === cur!.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
    }
    parts.unshift(part);
    cur = parentEl;
  }
  return parts.join(' > ');
}

function fallbacks(el: Element): string[] {
  const out: string[] = [];
  const text = (el.textContent ?? '').trim().slice(0, 30);
  if (el.id) out.push(`#${CSS.escape(el.id)}`);
  const cls = Array.from(el.classList).slice(0, 2).map((c) => '.' + CSS.escape(c)).join('');
  if (cls) out.push(el.tagName.toLowerCase() + cls);
  if (text) out.push(`text=${text}`);
  return out;
}

function send(event: RecordedEvent) {
  ipcRenderer.sendToHost('chm:recorded', event);
}

document.addEventListener('click', (e) => {
  if (!recording) return;
  const el = e.target as Element;
  send({ type: 'click', selector: cssPath(el), fallbackSelectors: fallbacks(el),
         textHint: (el.textContent ?? '').trim().slice(0, 40), timestamp: Date.now() });
}, true);

document.addEventListener('change', (e) => {
  if (!recording) return;
  const el = e.target as HTMLInputElement;
  if (!('value' in el)) return;
  // パスワード欄は値を記録しない（仕様§14.2）
  const isPassword = el.type === 'password';
  send({ type: 'input', selector: cssPath(el), fallbackSelectors: fallbacks(el),
         value: isPassword ? '' : el.value, textHint: isPassword ? '[password]' : undefined,
         timestamp: Date.now() });
}, true);

let scrollTimer: ReturnType<typeof setTimeout> | undefined;
document.addEventListener('scroll', () => {
  if (!recording) return;
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    send({ type: 'scroll', scrollX: window.scrollX, scrollY: window.scrollY, timestamp: Date.now() });
  }, 250);
}, true);

ipcRenderer.on('chm:record', (_e, on: boolean) => { recording = on; });

// ---------------- マクロ再生（仕様§9 手動再生） ----------------

async function waitFor(selector: string, timeoutMs: number): Promise<Element> {
  const found = document.querySelector(selector);
  if (found) return found;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { obs.disconnect(); reject(new Error('timeout: ' + selector)); }, timeoutMs);
    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { clearTimeout(timeout); obs.disconnect(); resolve(el); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });
}

ipcRenderer.on('chm:playSteps', async (_e, steps: Array<Record<string, unknown>>) => {
  for (const step of steps) {
    const type = step.type as string;
    const selector = step.selector as string | undefined;
    const value = step.value as string | undefined;
    const timeoutMs = (step.timeoutMs as number) || 10000;
    try {
      if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs as number));
      switch (type) {
        case 'click': {
          const el = await waitFor(selector!, timeoutMs) as HTMLElement;
          el.click();
          break;
        }
        case 'input': {
          const el = await waitFor(selector!, timeoutMs) as HTMLInputElement;
          el.focus(); el.value = value ?? '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
        case 'scroll':
          window.scrollTo({ left: (step.scrollX as number) || 0, top: (step.scrollY as number) || Number(value) || 0, behavior: 'smooth' });
          break;
        case 'wait':
          await new Promise((r) => setTimeout(r, Number(value) || 1000));
          break;
        case 'waitForSelector':
          await waitFor(selector!, timeoutMs);
          break;
        case 'submit': {
          const el = await waitFor(selector!, timeoutMs) as HTMLFormElement;
          el.requestSubmit ? el.requestSubmit() : el.submit();
          break;
        }
        case 'runJavaScript':
          // eslint-disable-next-line no-new-func
          new Function(value ?? '')();
          break;
        case 'navigate':
          location.href = (step.url as string) ?? value ?? location.href;
          return; // 遷移したら以降はホスト側が次ページで継続判断
      }
      ipcRenderer.sendToHost('chm:stepDone', { id: step.id, status: 'success' });
    } catch (err) {
      ipcRenderer.sendToHost('chm:stepDone', { id: step.id, status: 'error', message: String(err) });
      break; // 初期版: 失敗時は停止（仕様§15.3の既定）
    }
  }
  ipcRenderer.sendToHost('chm:playFinished', {});
});
