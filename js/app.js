/**
 * CHBS · app.js
 * -----------------------------------------------------------------------
 * UI orchestration. No password generation logic lives here — this file
 * only reads/writes settings, calls CHBSGenerator.generate(), and renders
 * the result.
 * -----------------------------------------------------------------------
 */

(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    settings: CHBSStorage.loadPrefs(),
    lastResult: null,
    customWordlist: CHBSStorage.loadCustomWordlist()
  };

  const els = {};

  function cacheEls() {
    [
      'structurePreview', 'passwordText', 'copyBtn', 'generateBtn',
      'statLength', 'statEntropy', 'statSpace', 'statRatingLabel', 'strengthMeterFill',
      'suitableFor', 'entropyBreakdownToggle', 'entropyBreakdownList',
      'modeEverything', 'modeMax', 'modeMemorable',
      'advancedToggle', 'advancedPanel',
      'wordCountRandom', 'wordCountRange', 'wordCountValue',
      'wordLenMin', 'wordLenMax', 'wordLenMinVal', 'wordLenMaxVal',
      'maxLengthInput', 'templateSelect', 'quantityInput',
      'numRandom', 'numSequential', 'numNone',
      'separatorsToggle', 'symbolsToggle', 'shuffleToggle',
      'randomizeEverythingToggle', 'saveHistoryToggle',
      'customWordlistFile', 'customWordlistTextarea', 'useCustomWordlistToggle',
      'clearCustomWordlistBtn', 'customWordlistStatus',
      'multiResults', 'historyList', 'clearHistoryBtn', 'historyEmpty',
      'qrModal', 'qrCanvas', 'qrClose', 'qrBtn', 'qrPasswordLabel',
      'toast', 'themeToggle', 'settingsWarning', 'resetSettingsBtn'
    ].forEach(id => { els[id] = document.getElementById(id); });
  }

  // ---------------------------------------------------------------------
  // Settings <-> UI sync
  // ---------------------------------------------------------------------

  function populateTemplateSelect() {
    const sel = els.templateSelect;
    sel.innerHTML = '';
    const randomOpt = document.createElement('option');
    randomOpt.value = 'random';
    randomOpt.textContent = 'Random template (recommended)';
    sel.appendChild(randomOpt);
    CHBS_TEMPLATES.all.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      opt.title = t.description;
      sel.appendChild(opt);
    });
  }

  function syncUIFromSettings() {
    const s = state.settings;
    els.wordCountRandom.checked = !!s.randomWordCount;
    els.wordCountRange.value = s.wordCount;
    els.wordCountRange.disabled = !!s.randomWordCount;
    els.wordCountValue.textContent = s.randomWordCount ? 'Random (3–7)' : s.wordCount;

    els.wordLenMin.value = s.wordLengthMin;
    els.wordLenMax.value = s.wordLengthMax;
    els.wordLenMinVal.textContent = s.wordLengthMin;
    els.wordLenMaxVal.textContent = s.wordLengthMax;

    els.maxLengthInput.value = s.maxLength;
    els.templateSelect.value = s.templateId;
    els.quantityInput.value = s.quantity;

    $$('input[name="capitalization"]').forEach(r => { r.checked = r.value === s.capitalization; });

    els.numRandom.checked = s.numbersMode === 'random';
    els.numSequential.checked = s.numbersMode === 'sequential';
    els.numNone.checked = s.numbersMode === 'none';

    els.separatorsToggle.checked = !!s.separatorsEnabled;
    els.symbolsToggle.checked = !!s.symbolsEnabled;
    els.shuffleToggle.checked = !!s.shuffleWordOrder;
    els.randomizeEverythingToggle.checked = s.mode === 'everything';
    els.saveHistoryToggle.checked = !!s.saveHistory;
    els.useCustomWordlistToggle.checked = !!s.useCustomWordlist;

    updateCustomWordlistStatus();
    toggleAdvancedDisabledState();
    updateModeChipActiveState();
  }

  function updateModeChipActiveState() {
    const s = state.settings;
    const active = s.presetLocked ? s.defaultMode : null;
    const map = { everything: els.modeEverything, max: els.modeMax, memorable: els.modeMemorable };
    Object.entries(map).forEach(([key, btn]) => {
      const isActive = key === active;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  function toggleAdvancedDisabledState() {
    const everything = state.settings.mode === 'everything';
    const panel = els.advancedPanel;
    $$('fieldset[data-lockable]', panel).forEach(fs => {
      fs.classList.toggle('is-locked', everything);
      $$('input, select', fs).forEach(inp => { inp.disabled = everything; });
    });
    els.settingsWarning.hidden = !everything;
  }

  function readSettingsFromUI() {
    const s = state.settings;
    s.randomWordCount = els.wordCountRandom.checked;
    s.wordCount = parseInt(els.wordCountRange.value, 10);
    s.wordLengthMin = parseInt(els.wordLenMin.value, 10);
    s.wordLengthMax = parseInt(els.wordLenMax.value, 10);
    if (s.wordLengthMin > s.wordLengthMax) [s.wordLengthMin, s.wordLengthMax] = [s.wordLengthMax, s.wordLengthMin];
    s.maxLength = Math.max(16, parseInt(els.maxLengthInput.value, 10) || 64);
    s.templateId = els.templateSelect.value;
    s.quantity = Math.min(20, Math.max(1, parseInt(els.quantityInput.value, 10) || 1));

    const capChecked = $$('input[name="capitalization"]').find(r => r.checked);
    s.capitalization = capChecked ? capChecked.value : 'random-style';

    s.numbersMode = els.numRandom.checked ? 'random' : (els.numSequential.checked ? 'sequential' : 'none');
    s.separatorsEnabled = els.separatorsToggle.checked;
    s.symbolsEnabled = els.symbolsToggle.checked;
    s.shuffleWordOrder = els.shuffleToggle.checked;
    s.mode = els.randomizeEverythingToggle.checked ? 'everything' : 'custom';
    s.saveHistory = els.saveHistoryToggle.checked;
    s.useCustomWordlist = els.useCustomWordlistToggle.checked;

    CHBSStorage.savePrefs(s);
    return s;
  }

  // ---------------------------------------------------------------------
  // Generation + rendering
  // ---------------------------------------------------------------------

  function buildGenerationSettings(s) {
    return {
      randomizeEverything: s.mode === 'everything',
      randomWordCount: s.randomWordCount,
      wordCount: s.wordCount,
      wordLengthMin: s.wordLengthMin,
      wordLengthMax: s.wordLengthMax,
      maxLength: s.maxLength,
      templateId: s.templateId,
      capitalization: s.capitalization,
      numbersMode: s.numbersMode,
      separatorsEnabled: s.separatorsEnabled,
      symbolsEnabled: s.symbolsEnabled,
      shuffleWordOrder: s.shuffleWordOrder,
      customWordlist: (s.useCustomWordlist && state.customWordlist && state.customWordlist.length >= 20)
        ? state.customWordlist : null
    };
  }

  const TOKEN_LABELS = { W: 'word', N: '#', S: 'sep', Y: 'sym' };

  function renderStructurePreview(trace) {
    const el = els.structurePreview;
    el.innerHTML = '';
    trace.forEach((t, i) => {
      const chip = document.createElement('span');
      chip.className = `chip chip-${t.type}`;
      chip.style.setProperty('--delay', `${i * 35}ms`);
      chip.textContent = TOKEN_LABELS[t.type] === 'word' ? 'W' : t.value;
      chip.title = t.type === 'W' ? 'word' : t.type === 'N' ? 'number' : t.type === 'S' ? 'separator' : 'symbol';
      el.appendChild(chip);
    });
  }

  function renderResult(result) {
    state.lastResult = result;
    els.passwordText.textContent = result.password;
    els.passwordText.classList.remove('pop');
    void els.passwordText.offsetWidth;
    els.passwordText.classList.add('pop');

    renderStructurePreview(result.trace);

    els.statLength.textContent = `${result.length} characters`;
    els.statEntropy.textContent = `${Math.round(result.entropyBits * 10) / 10} bits`;
    els.statSpace.textContent = CHBSEntropy.formatSpace(result.entropyBits);
    els.statRatingLabel.textContent = result.rating.label;
    els.statRatingLabel.parentElement.dataset.rating = result.rating.key;

    const pct = Math.min(100, (result.entropyBits / 130) * 100);
    els.strengthMeterFill.style.width = `${pct}%`;
    els.strengthMeterFill.dataset.rating = result.rating.key;

    els.suitableFor.innerHTML = '';
    result.rating.suitableFor.forEach(use => {
      const li = document.createElement('li');
      li.textContent = use;
      els.suitableFor.appendChild(li);
    });

    els.entropyBreakdownList.innerHTML = '';
    result.entropyItems.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="eb-label">${escapeHTML(item.label)}</span><span class="eb-bits">+${Math.round(item.bits * 100) / 100} bits</span>` +
        (item.detail ? `<span class="eb-detail">${escapeHTML(item.detail)}</span>` : '');
      els.entropyBreakdownList.appendChild(li);
    });

    els.copyBtn.disabled = false;
    els.qrBtn.disabled = false;

    if (result.truncated) {
      showToast('Password was trimmed to fit your max length setting.');
    }

    if (state.settings.saveHistory) {
      CHBSStorage.addToHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        password: result.password,
        entropyBits: Math.round(result.entropyBits * 10) / 10,
        rating: result.rating.key,
        createdAt: Date.now()
      });
      renderHistory();
    }
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function handleGenerate() {
    const s = readSettingsFromUI();
    syncUIFromSettings();
    const genSettings = buildGenerationSettings(s);

    if (s.quantity > 1) {
      const results = [];
      for (let i = 0; i < s.quantity; i++) results.push(CHBSGenerator.generate(genSettings));
      renderResult(results[0]);
      renderMultiResults(results);
      if (s.saveHistory) {
        results.slice(1).forEach(r => CHBSStorage.addToHistory({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          password: r.password,
          entropyBits: Math.round(r.entropyBits * 10) / 10,
          rating: r.rating.key,
          createdAt: Date.now()
        }));
        renderHistory();
      }
    } else {
      const result = CHBSGenerator.generate(genSettings);
      renderResult(result);
      els.multiResults.innerHTML = '';
      els.multiResults.hidden = true;
    }
  }

  function renderMultiResults(results) {
    const el = els.multiResults;
    el.innerHTML = '';
    el.hidden = false;
    const heading = document.createElement('div');
    heading.className = 'multi-heading';
    heading.textContent = `${results.length} passwords generated`;
    el.appendChild(heading);
    results.forEach(r => {
      const row = document.createElement('div');
      row.className = 'multi-row';
      row.innerHTML = `<code>${escapeHTML(r.password)}</code><span class="multi-entropy" data-rating="${r.rating.key}">${Math.round(r.entropyBits)} bits · ${r.rating.label}</span>`;
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn-tiny';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => copyText(r.password));
      row.appendChild(copyBtn);
      el.appendChild(row);
    });
  }

  // ---------------------------------------------------------------------
  // Presets
  // ---------------------------------------------------------------------

  function applyPreset(kind) {
    const s = state.settings;
    s.defaultMode = kind;
    s.presetLocked = true;
    if (kind === 'everything') {
      s.mode = 'everything';
    } else if (kind === 'max') {
      s.mode = 'custom';
      s.randomWordCount = false;
      s.wordCount = 7;
      s.wordLengthMin = 4;
      s.wordLengthMax = 8;
      s.templateId = 'random';
      s.capitalization = 'random';
      s.numbersMode = 'random';
      s.separatorsEnabled = true;
      s.symbolsEnabled = true;
      s.shuffleWordOrder = true;
      s.maxLength = 96;
    } else if (kind === 'memorable') {
      s.mode = 'custom';
      s.randomWordCount = false;
      s.wordCount = 4;
      s.wordLengthMin = 4;
      s.wordLengthMax = 6;
      s.templateId = 'dash-chain';
      s.capitalization = 'first-upper';
      s.numbersMode = 'sequential';
      s.separatorsEnabled = true;
      s.symbolsEnabled = false;
      s.shuffleWordOrder = false;
      s.maxLength = 48;
    }
    syncUIFromSettings();
    handleGenerate();
  }

  // ---------------------------------------------------------------------
  // Copy / clipboard / toast
  // ---------------------------------------------------------------------

  function copyText(text) {
    if (!text) return;
    const done = () => showToast('Copied to clipboard.');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch { showToast('Copy failed — select and copy manually.'); }
    document.body.removeChild(ta);
  }

  let toastTimer = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('visible'), 2600);
  }

  // ---------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------

  function renderHistory() {
    const history = CHBSStorage.loadHistory();
    els.historyList.innerHTML = '';
    els.historyEmpty.hidden = history.length > 0;
    history.forEach(h => {
      const row = document.createElement('div');
      row.className = 'history-row';
      const date = new Date(h.createdAt);
      row.innerHTML = `
        <code>${escapeHTML(h.password)}</code>
        <span class="history-meta" data-rating="${h.rating}">${h.entropyBits} bits</span>
        <span class="history-date">${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      `;
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn-tiny';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => copyText(h.password));
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-tiny btn-tiny-ghost';
      delBtn.textContent = '✕';
      delBtn.title = 'Remove from history';
      delBtn.addEventListener('click', () => { CHBSStorage.removeHistoryEntry(h.id); renderHistory(); });
      row.appendChild(copyBtn);
      row.appendChild(delBtn);
      els.historyList.appendChild(row);
    });
  }

  // ---------------------------------------------------------------------
  // QR export
  // ---------------------------------------------------------------------

  function openQR() {
    if (!state.lastResult) return;
    const pw = state.lastResult.password;
    els.qrPasswordLabel.textContent = pw;
    const qr = qrcode(0, 'M');
    qr.addData(pw);
    qr.make();
    const canvas = els.qrCanvas;
    const size = 260;
    const count = qr.getModuleCount();
    const tile = size / count;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0B0E14';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#E7EAF0';
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(Math.round(col * tile), Math.round(row * tile), Math.ceil(tile), Math.ceil(tile));
        }
      }
    }
    els.qrModal.showModal();
  }

  // ---------------------------------------------------------------------
  // Custom word list
  // ---------------------------------------------------------------------

  function parseWordlistText(text) {
    return Array.from(new Set(
      text.split(/[\s,;]+/)
        .map(w => w.trim().toLowerCase())
        .filter(w => /^[a-z]{2,20}$/.test(w))
    ));
  }

  function updateCustomWordlistStatus() {
    const n = state.customWordlist ? state.customWordlist.length : 0;
    if (n === 0) {
      els.customWordlistStatus.textContent = 'No custom word list loaded — using the built-in CHBS dictionary.';
    } else {
      els.customWordlistStatus.textContent = `Custom word list loaded: ${n} words${n < 20 ? ' (need at least 20 to use)' : ''}.`;
    }
  }

  function handleCustomWordlistText() {
    const words = parseWordlistText(els.customWordlistTextarea.value);
    if (words.length < 20) {
      showToast('Add at least 20 valid words to build a custom list.');
      return;
    }
    state.customWordlist = words;
    CHBSStorage.saveCustomWordlist(words);
    updateCustomWordlistStatus();
    showToast(`Custom word list saved: ${words.length} words.`);
  }

  function handleCustomWordlistFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      els.customWordlistTextarea.value = String(reader.result);
      handleCustomWordlistText();
    };
    reader.readAsText(file);
  }

  // ---------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    CHBSStorage.saveTheme(theme);
    els.themeToggle.textContent = theme === 'dark' ? '☾' : '☀';
    els.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  // ---------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------

  function wireEvents() {
    els.generateBtn.addEventListener('click', handleGenerate);
    els.copyBtn.addEventListener('click', () => copyText(state.lastResult && state.lastResult.password));
    els.qrBtn.addEventListener('click', openQR);
    els.qrClose.addEventListener('click', () => els.qrModal.close());
    els.qrModal.addEventListener('click', (e) => { if (e.target === els.qrModal) els.qrModal.close(); });

    els.modeEverything.addEventListener('click', () => applyPreset('everything'));
    els.modeMax.addEventListener('click', () => applyPreset('max'));
    els.modeMemorable.addEventListener('click', () => applyPreset('memorable'));

    els.advancedToggle.addEventListener('click', () => {
      const isOpen = !els.advancedPanel.hidden;
      els.advancedPanel.hidden = isOpen;
      els.advancedToggle.setAttribute('aria-expanded', String(!isOpen));
      els.advancedToggle.classList.toggle('is-open', !isOpen);
    });

    els.entropyBreakdownToggle.addEventListener('click', () => {
      const isOpen = !els.entropyBreakdownList.hidden;
      els.entropyBreakdownList.hidden = isOpen;
      els.entropyBreakdownToggle.classList.toggle('is-open', !isOpen);
    });

    els.wordCountRandom.addEventListener('change', () => {
      els.wordCountRange.disabled = els.wordCountRandom.checked;
      els.wordCountValue.textContent = els.wordCountRandom.checked ? 'Random (3–7)' : els.wordCountRange.value;
    });
    els.wordCountRange.addEventListener('input', () => {
      els.wordCountValue.textContent = els.wordCountRange.value;
    });
    els.wordLenMin.addEventListener('input', () => { els.wordLenMinVal.textContent = els.wordLenMin.value; });
    els.wordLenMax.addEventListener('input', () => { els.wordLenMaxVal.textContent = els.wordLenMax.value; });

    els.randomizeEverythingToggle.addEventListener('change', () => {
      const on = els.randomizeEverythingToggle.checked;
      state.settings.mode = on ? 'everything' : 'custom';
      if (on) {
        state.settings.defaultMode = 'everything';
        state.settings.presetLocked = true;
      } else {
        state.settings.presetLocked = false;
      }
      toggleAdvancedDisabledState();
      updateModeChipActiveState();
    });

    // Hand-editing any lockable fieldset (Word/Formatting/Capitalization/Numbers)
    // means the current settings no longer match a named preset exactly, so
    // no Password Type chip should claim to be "active" until one is clicked again.
    els.advancedPanel.addEventListener('input', (e) => {
      if (e.target.closest('fieldset[data-lockable]')) {
        state.settings.presetLocked = false;
        updateModeChipActiveState();
      }
    });
    els.advancedPanel.addEventListener('change', (e) => {
      if (e.target.closest('fieldset[data-lockable]')) {
        state.settings.presetLocked = false;
        updateModeChipActiveState();
      }
    });

    els.useCustomWordlistToggle.addEventListener('change', () => {
      if (els.useCustomWordlistToggle.checked && (!state.customWordlist || state.customWordlist.length < 20)) {
        showToast('Load a custom word list first (at least 20 words).');
        els.useCustomWordlistToggle.checked = false;
      }
    });
    els.customWordlistFile.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleCustomWordlistFile(e.target.files[0]);
    });
    $('#customWordlistSaveBtn').addEventListener('click', handleCustomWordlistText);
    els.clearCustomWordlistBtn.addEventListener('click', () => {
      state.customWordlist = null;
      CHBSStorage.clearCustomWordlist();
      els.customWordlistTextarea.value = '';
      els.useCustomWordlistToggle.checked = false;
      updateCustomWordlistStatus();
      showToast('Custom word list cleared.');
    });

    els.clearHistoryBtn.addEventListener('click', () => {
      CHBSStorage.clearHistory();
      renderHistory();
      showToast('History cleared.');
    });

    els.resetSettingsBtn.addEventListener('click', () => {
      state.settings = Object.assign({}, CHBSStorage.DEFAULT_PREFS);
      CHBSStorage.savePrefs(state.settings);
      syncUIFromSettings();
      showToast('Settings reset to defaults.');
    });

    els.themeToggle.addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.qrModal.open) els.qrModal.close();
      if ((e.key === 'g' || e.key === 'G') && !isTypingTarget(e.target)) handleGenerate();
    });
  }

  function isTypingTarget(el) {
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------

  function init() {
    cacheEls();
    populateTemplateSelect();
    applyTheme(CHBSStorage.loadTheme());
    syncUIFromSettings();
    renderHistory();
    els.qrBtn.disabled = true;
    els.copyBtn.disabled = true;
    wireEvents();
    if (state.settings.presetLocked && ['everything', 'max', 'memorable'].includes(state.settings.defaultMode)) {
      applyPreset(state.settings.defaultMode);
    } else {
      handleGenerate();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
