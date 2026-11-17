// Loaded by the bookmarklet. Replaces every picked/dropped/uploaded image with dog.jpg
// (from the same folder as this script). Works on desktop and mobile. Reload the page to undo.
(async () => {
  if (window.__dogSwap) { console.log('🐶 Dog mode already ON'); return; } // clicking twice doesn't double up
  window.__dogSwap = true;

  const here = (document.currentScript && document.currentScript.src) || window.__dogSwapSrc;
  const DOG_URL = new URL('dog.jpg', here).href + '?t=' + Date.now();

  let dogBytes;
  try {
    const res = await fetch(DOG_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    dogBytes = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    window.__dogSwap = false;
    console.error('❌ Could not load', DOG_URL, err);
    return;
  }

  const dog = (orig) => {
    const base = orig && orig.name ? orig.name.replace(/\.[^.]+$/, '') : 'photo';
    const f = new File([dogBytes], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
    f.__swapped = true;
    return f;
  };
  const isImg = (v) => v instanceof Blob && !v.__swapped && /^image\//.test(v.type);
  const swapList = (files) => {
    const dt = new DataTransfer();
    [...files].forEach((f) => dt.items.add(isImg(f) ? dog(f) : f));
    return dt;
  };

  // 1) File picker / phone camera: swap BEFORE the site's own handler runs (capture phase)
  window.addEventListener('change', (e) => {
    const inp = e.target;
    if (!(inp instanceof HTMLInputElement) || inp.type !== 'file' || !inp.files.length) return;
    if (![...inp.files].some(isImg)) return;
    try { inp.files = swapList(inp.files).files; } catch (_) { /* old browser: safety net below still works */ }
  }, true);

  // 2) Drag & drop (desktop): block the real drop and re-fire one carrying the dog
  window.addEventListener('drop', (e) => {
    if (e.__swapped || !e.dataTransfer || ![...e.dataTransfer.files].some(isImg)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const fake = new DragEvent('drop', {
      bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY,
      dataTransfer: swapList(e.dataTransfer.files),
    });
    fake.__swapped = true;
    e.target.dispatchEvent(fake);
  }, true);

  // 3) Paste an image (Ctrl/Cmd+V): same trick
  window.addEventListener('paste', (e) => {
    if (e.__swapped || !e.clipboardData || ![...e.clipboardData.files].some(isImg)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const fake = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: swapList(e.clipboardData.files) });
    fake.__swapped = true;
    e.target.dispatchEvent(fake);
  }, true);

  // 4) Safety net: swap any image right when it's put into the upload request
  const wrap = (orig) => function (k, v, ...rest) { return orig.call(this, k, isImg(v) ? dog(v) : v, ...rest); };
  FormData.prototype.append = wrap(FormData.prototype.append);
  FormData.prototype.set = wrap(FormData.prototype.set);

  // Small "Dog mode ON" badge in the top-right corner (tap it to hide it)
  const badge = document.createElement('div');
  badge.textContent = '🐶 Dog mode ON';
  badge.title = 'Tap to hide (reload the page to turn dog mode off)';
  badge.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;padding:8px 14px;' +
    'border-radius:999px;background:#22c55e;color:#fff;font:bold 15px/1.2 system-ui,sans-serif;' +
    'box-shadow:0 2px 10px rgba(0,0,0,.3);cursor:pointer;user-select:none;';
  badge.onclick = () => badge.remove();
  document.documentElement.appendChild(badge);

  console.log('%c🐶 Dog mode ON — now pick a photo', 'font-size:16px;color:#c0f');
})();
