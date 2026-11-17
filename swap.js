// Loaded by the bookmarklet. Replaces every picked/dropped/pasted/uploaded image with dog.jpg
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
  // Duck-typed so it also recognises files coming from iframes (different Blob class)
  const isImg = (v) => !!v && typeof v === 'object' && !v.__swapped &&
    typeof v.type === 'string' && /^image\//.test(v.type) && typeof v.arrayBuffer === 'function';
  const hasImg = (files) => !!files && [...files].some(isImg);
  const swapList = (files) => {
    const dt = new DataTransfer();
    [...files].forEach((f) => dt.items.add(isImg(f) ? dog(f) : f));
    return dt;
  };

  // Install every hook into a window (the page itself, and same-origin iframes)
  const install = (w) => {
    try { if (!w || w.__dogHooked) return; w.__dogHooked = true; } catch (_) { return; } // cross-origin frame

    // 1) File picker / phone camera: swap BEFORE the site's own handler runs (capture phase)
    w.addEventListener('change', (e) => {
      const inp = e.target;
      if (!inp || inp.tagName !== 'INPUT' || inp.type !== 'file' || !hasImg(inp.files)) return;
      try { inp.files = swapList(inp.files).files; } catch (_) { /* hooks below still catch the upload */ }
    }, true);

    // 2) Drag & drop: block the real drop and re-fire one carrying the dog
    w.addEventListener('drop', (e) => {
      if (e.__swapped || !e.dataTransfer || !hasImg(e.dataTransfer.files)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const fake = new w.DragEvent('drop', {
        bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY,
        dataTransfer: swapList(e.dataTransfer.files),
      });
      fake.__swapped = true;
      e.target.dispatchEvent(fake);
    }, true);

    // 3) Paste an image (Ctrl/Cmd+V): same trick
    w.addEventListener('paste', (e) => {
      if (e.__swapped || !e.clipboardData || !hasImg(e.clipboardData.files)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const fake = new w.ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: swapList(e.clipboardData.files) });
      fake.__swapped = true;
      e.target.dispatchEvent(fake);
    }, true);

    // 4) Upload sent as a form
    const wrapFD = (orig) => function (k, v, ...rest) { return orig.call(this, k, isImg(v) ? dog(v) : v, ...rest); };
    w.FormData.prototype.append = wrapFD(w.FormData.prototype.append);
    w.FormData.prototype.set = wrapFD(w.FormData.prototype.set);

    // 5) Upload sent as the raw file (XHR or fetch with the image as the whole body)
    const xSend = w.XMLHttpRequest.prototype.send;
    w.XMLHttpRequest.prototype.send = function (body) { return xSend.call(this, isImg(body) ? dog(body) : body); };
    const oFetch = w.fetch;
    w.fetch = function (input, init) {
      if (init && isImg(init.body)) init = Object.assign({}, init, { body: dog(init.body) });
      return oFetch.call(this, input, init);
    };

    // 6) Newer file picker used by some web apps (showOpenFilePicker)
    if (w.showOpenFilePicker) {
      const oPick = w.showOpenFilePicker.bind(w);
      w.showOpenFilePicker = async (...a) => (await oPick(...a)).map((h) => {
        const getFile = h.getFile.bind(h);
        return new Proxy(h, { get: (t, p) => p === 'getFile'
          ? async () => { const f = await getFile(); return isImg(f) ? dog(f) : f; }
          : (typeof t[p] === 'function' ? t[p].bind(t) : t[p]) });
      });
    }
  };

  // Hook this page + any same-origin iframes, now and when new ones appear
  const hookFrames = (root) => root.querySelectorAll('iframe').forEach((f) => {
    try { install(f.contentWindow); } catch (_) {}
    f.addEventListener('load', () => { try { install(f.contentWindow); } catch (_) {} });
  });
  install(window);
  hookFrames(document);
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => {
    if (n.nodeType !== 1) return;
    if (n.tagName === 'IFRAME') hookFrames(n.parentNode || document); else hookFrames(n);
  }))).observe(document.documentElement, { childList: true, subtree: true });

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
