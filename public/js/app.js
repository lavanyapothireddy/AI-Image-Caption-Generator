// ── State ──────────────────────────────────────────────────────
let selectedFile = null;
let selectedModel = 'meta-llama/llama-4-scout-17b-16e-instruct';

// ── DOM References ──────────────────────────────────────────────
const uploadZone    = document.getElementById('uploadZone');
const fileInput     = document.getElementById('fileInput');
const previewWrap   = document.getElementById('previewWrap');
const previewImg    = document.getElementById('previewImg');
const removeBtn     = document.getElementById('removeImg');
const fileBadge     = document.getElementById('fileBadge');
const generateBtn   = document.getElementById('generateBtn');
const btnContent    = document.getElementById('btnContent');
const resultsSection= document.getElementById('resultsSection');
const errorBox      = document.getElementById('errorBox');
const captionsCont  = document.getElementById('captionsContainer');

// ── Model Chip Selection ────────────────────────────────────────
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedModel = chip.dataset.model;
  });
});

// ── Drag & Drop ─────────────────────────────────────────────────
uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('drag-over');
});
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// ── File Input Change ───────────────────────────────────────────
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

// ── Handle File ─────────────────────────────────────────────────
function handleFile(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    showError('Please upload a valid image file (JPG, PNG, WEBP, GIF).');
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    showError('File too large. Maximum size is 4MB.');
    return;
  }
  clearError();
  selectedFile = file;

  const reader = new FileReader();
  reader.onload = ev => {
    previewImg.src = ev.target.result;
    previewWrap.style.display = 'block';
    uploadZone.style.display = 'none';
    fileBadge.style.display = 'inline-flex';
    fileBadge.textContent = `✓ ${file.name}  ·  ${(file.size / 1024).toFixed(1)} KB`;
    updateBtn();
  };
  reader.readAsDataURL(file);
}

// ── Remove Image ────────────────────────────────────────────────
removeBtn.addEventListener('click', () => {
  selectedFile = null;
  previewImg.src = '';
  previewWrap.style.display = 'none';
  fileBadge.style.display = 'none';
  uploadZone.style.display = 'block';
  fileInput.value = '';
  resultsSection.style.display = 'none';
  clearError();
  updateBtn();
});

// ── Update Button State ─────────────────────────────────────────
function updateBtn() {
  if (selectedFile) {
    generateBtn.disabled = false;
    btnContent.innerHTML = '⚡ Generate Captions';
  } else {
    generateBtn.disabled = true;
    btnContent.innerHTML = 'Upload an image to begin';
  }
}

// ── Generate ────────────────────────────────────────────────────
generateBtn.addEventListener('click', generate);

async function generate() {
  if (!selectedFile) return;
  clearError();

  generateBtn.disabled = true;
  btnContent.innerHTML = '<div class="spinner"></div> Analyzing image...';

  try {
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('style',  document.getElementById('styleOpt').value);
    formData.append('length', document.getElementById('lengthOpt').value);
    formData.append('tone',   document.getElementById('toneOpt').value);
    formData.append('count',  document.getElementById('countOpt').value);
    formData.append('custom', document.getElementById('customInstr').value.trim());
    formData.append('model',  selectedModel);

    const res = await fetch('/api/caption', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Server error ${res.status}`);
    }

    renderResults(data);

  } catch (err) {
    showError('Error: ' + (err.message || 'Something went wrong. Please try again.'));
  } finally {
    generateBtn.disabled = false;
    updateBtn();
  }
}

// ── Render Results ──────────────────────────────────────────────
function renderResults(data) {
  captionsCont.innerHTML = '';

  (data.captions || []).forEach((cap, i) => {
    const div = document.createElement('div');
    div.className = 'caption-item';
    div.innerHTML = `
      <div class="result-label">Caption ${i + 1}</div>
      <div class="result-box">
        <button class="copy-btn" data-i="${i}">Copy</button>
        <p>${escapeHtml(cap)}</p>
      </div>`;
    captionsCont.appendChild(div);
  });

  captionsCont.querySelectorAll('.copy-btn').forEach((btn, i) => {
    btn.addEventListener('click', () => copyText((data.captions || [])[i] || '', btn));
  });

  document.getElementById('altTextOut').textContent  = data.alt_text    || '';
  document.getElementById('descOut').textContent     = data.description || '';

  const desc = data.description || '';
  document.getElementById('descCount').textContent =
    `${desc.length} chars · ${desc.split(/\s+/).filter(Boolean).length} words`;

  const copyAlt  = document.getElementById('copyAlt');
  const copyDesc = document.getElementById('copyDesc');
  copyAlt.onclick  = () => copyText(data.alt_text    || '', copyAlt);
  copyDesc.onclick = () => copyText(data.description || '', copyDesc);

  resultsSection.style.display = 'block';
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Helpers ─────────────────────────────────────────────────────
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 1800);
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showError(msg) {
  errorBox.style.display = 'block';
  errorBox.innerHTML = `<div class="error-msg">${msg}</div>`;
}

function clearError() {
  errorBox.style.display = 'none';
  errorBox.innerHTML = '';
}
