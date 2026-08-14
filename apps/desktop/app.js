const API = "http://127.0.0.1:8787";

const els = {
  health: document.getElementById("health"),
  threads: document.getElementById("threads"),
  newThread: document.getElementById("new-thread"),
  persona: document.getElementById("persona"),
  personaDesc: document.getElementById("persona-desc"),
  messages: document.getElementById("messages"),
  composer: document.getElementById("composer"),
  input: document.getElementById("input"),
  routines: document.getElementById("routines"),
  routineForm: document.getElementById("routine-form"),
};

let personas = [];
let threads = [];
let currentId = null;
let sending = false;

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function ping() {
  try {
    const h = await api("/health");
    els.health.textContent = h.inference?.reachable ? "Ollama" : "API";
    els.health.classList.toggle("on", Boolean(h.ok));
    els.health.classList.toggle("off", !h.ok);
  } catch {
    els.health.textContent = "offline";
    els.health.classList.remove("on");
    els.health.classList.add("off");
  }
}

async function loadPersonas() {
  personas = await api("/personas");
  els.persona.innerHTML = personas
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join("");
  describePersona();
}

function describePersona() {
  const p = personas.find((x) => x.id === els.persona.value);
  els.personaDesc.textContent = p ? p.description : "";
}

async function loadThreads() {
  threads = await api("/threads");
  renderThreads();
}

function renderThreads() {
  if (!threads.length) {
    els.threads.innerHTML = `<p class="muted">No threads yet.</p>`;
    return;
  }
  els.threads.innerHTML = threads
    .map((t) => {
      const label = (t.messages?.at(-1)?.content || t.personaId || "thread").slice(0, 42);
      const active = t.id === currentId ? "active" : "";
      return `<button type="button" data-id="${t.id}" class="${active}">${escapeHtml(label)}</button>`;
    })
    .join("");
}

function renderMessages(thread) {
  if (!thread) {
    els.messages.innerHTML = `<p class="empty">Start a thread, pick a persona, then talk.</p>`;
    return;
  }
  const bubbles = (thread.messages || [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `<div class="bubble ${m.role}">${escapeHtml(m.content)}</div>`)
    .join("");
  els.messages.innerHTML = bubbles || `<p class="empty">No messages yet.</p>`;
  els.messages.scrollTop = els.messages.scrollHeight;
}

async function selectThread(id) {
  const thread = await api(`/threads/${id}`);
  currentId = thread.id;
  els.persona.value = thread.personaId;
  describePersona();
  renderThreads();
  renderMessages(thread);
}

async function newThread() {
  const personaId = els.persona.value || "factual";
  const thread = await api("/threads", {
    method: "POST",
    body: JSON.stringify({ personaId }),
  });
  threads = [thread, ...threads.filter((t) => t.id !== thread.id)];
  await selectThread(thread.id);
}

async function sendMessage(content) {
  if (!currentId) await newThread();
  sending = true;
  els.composer.querySelector("button").disabled = true;
  try {
    const thread = await api(`/threads/${currentId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    const idx = threads.findIndex((t) => t.id === thread.id);
    if (idx >= 0) threads[idx] = thread;
    else threads.unshift(thread);
    renderThreads();
    renderMessages(thread);
  } finally {
    sending = false;
    els.composer.querySelector("button").disabled = false;
    els.input.focus();
  }
}

async function changePersona() {
  describePersona();
  if (!currentId) return;
  const thread = await api(`/threads/${currentId}/persona`, {
    method: "POST",
    body: JSON.stringify({ personaId: els.persona.value }),
  });
  const idx = threads.findIndex((t) => t.id === thread.id);
  if (idx >= 0) threads[idx] = thread;
  renderThreads();
  renderMessages(thread);
}

async function loadRoutines() {
  const list = await api("/routines");
  els.routines.innerHTML = list.length
    ? list.map((r) => `<li>${escapeHtml(r.name)} · ${escapeHtml(r.schedule || r.trigger || "off")}</li>`).join("")
    : `<li>None</li>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

els.newThread.addEventListener("click", () => newThread().catch(showError));
els.persona.addEventListener("change", () => changePersona().catch(showError));
els.threads.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-id]");
  if (btn) selectThread(btn.dataset.id).catch(showError);
});
els.composer.addEventListener("submit", (e) => {
  e.preventDefault();
  const content = els.input.value.trim();
  if (!content || sending) return;
  els.input.value = "";
  sendMessage(content).catch(showError);
});
els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    els.composer.requestSubmit();
  }
});
els.routineForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(els.routineForm);
  try {
    await api("/routines", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        schedule: fd.get("schedule") || undefined,
        prompt: fd.get("prompt"),
        enabled: true,
      }),
    });
    els.routineForm.reset();
    await loadRoutines();
  } catch (err) {
    showError(err);
  }
});

function showError(err) {
  els.messages.insertAdjacentHTML(
    "beforeend",
    `<div class="bubble system">${escapeHtml(err.message || String(err))}</div>`,
  );
}

(async function boot() {
  await ping();
  try {
    await loadPersonas();
    await loadThreads();
    await loadRoutines();
    if (threads[0]) await selectThread(threads[0].id);
    else renderMessages(null);
  } catch (err) {
    showError(err);
  }
  setInterval(ping, 8000);
})();
