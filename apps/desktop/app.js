const API = "http://127.0.0.1:8787";

const AVATAR = {
  factual: "factual",
  creative: "creative",
  coder: "coder",
  grok: "grok",
};

const els = {
  health: document.getElementById("health"),
  bots: document.getElementById("bots"),
  threads: document.getElementById("threads"),
  newThread: document.getElementById("new-thread"),
  persona: document.getElementById("persona"),
  personaDesc: document.getElementById("persona-desc"),
  botName: document.getElementById("bot-name"),
  messages: document.getElementById("messages"),
  composer: document.getElementById("composer"),
  input: document.getElementById("input"),
  routines: document.getElementById("routines"),
  routineForm: document.getElementById("routine-form"),
  vmState: document.getElementById("vm-state"),
  vmCreate: document.getElementById("vm-create"),
  vmStart: document.getElementById("vm-start"),
  vmStop: document.getElementById("vm-stop"),
  vmDestroy: document.getElementById("vm-destroy"),
  computerFrame: document.getElementById("computer-frame"),
  sandboxForm: document.getElementById("sandbox-form"),
  sandboxCmd: document.getElementById("sandbox-cmd"),
  sandboxOut: document.getElementById("sandbox-out"),
  computer: document.querySelector(".computer"),
};

let personas = [];
let threads = [];
let vmByPersona = {};
let currentId = null;
let sending = false;

function selectedPersonaId() {
  return els.persona.value || personas[0]?.id || "factual";
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name || "?").slice(0, 2).toUpperCase();
}

function lastSnippet(thread) {
  const msgs = (thread?.messages || []).filter((m) => m.role === "user" || m.role === "assistant");
  const last = msgs.at(-1);
  if (!last) return "New chat";
  return last.content.replace(/\s+/g, " ").trim().slice(0, 48) || "New chat";
}

function latestForPersona(personaId) {
  return threads
    .filter((t) => t.personaId === personaId)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0];
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

function describePersona() {
  const p = personas.find((x) => x.id === selectedPersonaId());
  if (els.botName) els.botName.textContent = p ? p.name : "grok";
  if (els.personaDesc) els.personaDesc.textContent = p ? p.description : "";
}

function renderBots() {
  if (!els.bots) return;
  if (!personas.length) {
    els.bots.innerHTML = `<p class="muted-empty">No bots yet.</p>`;
    return;
  }
  const current = selectedPersonaId();
  els.bots.innerHTML = personas
    .map((p) => {
      const latest = latestForPersona(p.id);
      const snippet = latest ? lastSnippet(latest) : "No chats yet";
      const state = vmByPersona[p.id]?.state || "missing";
      const tone = AVATAR[p.id] || "";
      const active = p.id === current ? "active" : "";
      return `<button type="button" class="bot ${active}" data-persona="${escapeHtml(p.id)}">
        <span class="avatar ${tone}">${escapeHtml(initials(p.name))}</span>
        <span class="bot-meta">
          <strong>${escapeHtml(p.name)}</strong>
          <span>${escapeHtml(snippet)}</span>
        </span>
        <span class="dot ${escapeHtml(state)}" title="VM ${escapeHtml(state)}"></span>
      </button>`;
    })
    .join("");
}

function renderThreads() {
  const mine = threads.filter((t) => t.personaId === selectedPersonaId());
  if (!mine.length) {
    els.threads.innerHTML = `<p class="muted-empty">No chats yet.</p>`;
    return;
  }
  els.threads.innerHTML = mine
    .map((t) => {
      const active = t.id === currentId ? "active" : "";
      return `<button type="button" data-id="${escapeHtml(t.id)}" class="${active}">${escapeHtml(lastSnippet(t))}</button>`;
    })
    .join("");
}

function renderMessages(thread) {
  if (!thread || !(thread.messages || []).some((m) => m.role === "user" || m.role === "assistant")) {
    els.messages.innerHTML = `<p class="empty">What do you want to know?</p>`;
    return;
  }
  const bubbles = (thread.messages || [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `<div class="bubble ${m.role}">${escapeHtml(m.content)}</div>`)
    .join("");
  els.messages.innerHTML = bubbles;
  els.messages.scrollTop = els.messages.scrollHeight;
}

function paintComputer(state) {
  const st = state || "missing";
  if (els.vmState) els.vmState.textContent = `VM: ${st}`;
  if (els.computer) els.computer.classList.toggle("live", st === "running");
  if (els.computerFrame) {
    els.computerFrame.className = `monitor ${st}`;
    els.computerFrame.dataset.state = st;
    const inner = els.computerFrame.querySelector(".screen-inner");
    if (inner) {
      if (st === "running") {
        const id = selectedPersonaId();
        inner.innerHTML = `<div class="desktop-bar"><span>grokbot-vm-${escapeHtml(id)}</span><span>online</span></div>
          <div class="desktop-term"><div class="cwd">/work</div><div>$ <span class="blink"></span></div></div>`;
      } else if (st === "stopped" || st === "created") {
        inner.innerHTML = `<p class="screen-status">desktop ${escapeHtml(st)}</p>`;
      } else {
        inner.innerHTML = `<p class="screen-status">desktop offline</p>`;
      }
    }
  }
  const missing = st === "missing";
  const running = st === "running";
  if (els.vmCreate) els.vmCreate.disabled = !missing;
  if (els.vmStart) els.vmStart.disabled = missing || running;
  if (els.vmStop) els.vmStop.disabled = !running;
  if (els.vmDestroy) els.vmDestroy.disabled = missing;
}

async function loadPersonas() {
  personas = await api("/personas");
  els.persona.innerHTML = personas
    .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
    .join("");
  if (!els.persona.value && personas[0]) els.persona.value = personas[0].id;
  describePersona();
  renderBots();
}

async function loadThreads() {
  threads = await api("/threads");
  renderBots();
  renderThreads();
}

async function selectBot(personaId) {
  if (!personaId) return;
  els.persona.value = personaId;
  describePersona();
  renderBots();
  renderThreads();
  const latest = latestForPersona(personaId);
  if (latest) await selectThread(latest.id);
  else {
    currentId = null;
    renderMessages(null);
  }
  await refreshVm();
}

async function selectThread(id) {
  const thread = await api(`/threads/${id}`);
  currentId = thread.id;
  if (thread.personaId && thread.personaId !== els.persona.value) {
    els.persona.value = thread.personaId;
    describePersona();
    await refreshVm();
  }
  renderBots();
  renderThreads();
  renderMessages(thread);
}

async function newThread() {
  const personaId = selectedPersonaId();
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
  const sendBtn = els.composer.querySelector("button");
  if (sendBtn) sendBtn.disabled = true;
  try {
    const thread = await api(`/threads/${currentId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    const idx = threads.findIndex((t) => t.id === thread.id);
    if (idx >= 0) threads[idx] = thread;
    else threads.unshift(thread);
    renderBots();
    renderThreads();
    renderMessages(thread);
  } finally {
    sending = false;
    if (sendBtn) sendBtn.disabled = false;
    els.input.focus();
  }
}

async function changePersona() {
  describePersona();
  renderBots();
  renderThreads();
  if (currentId) {
    const thread = await api(`/threads/${currentId}/persona`, {
      method: "POST",
      body: JSON.stringify({ personaId: selectedPersonaId() }),
    });
    const idx = threads.findIndex((t) => t.id === thread.id);
    if (idx >= 0) threads[idx] = thread;
    renderBots();
    renderThreads();
    renderMessages(thread);
  }
  await refreshVm();
}

async function loadRoutines() {
  const list = await api("/routines");
  els.routines.innerHTML = list.length
    ? list.map((r) => `<li>${escapeHtml(r.name)} · ${escapeHtml(r.schedule || r.trigger || "off")}</li>`).join("")
    : `<li>None</li>`;
}

async function refreshVm() {
  const id = selectedPersonaId();
  if (!id || !els.vmState) return;
  try {
    const st = await api(`/personas/${id}/vm`);
    vmByPersona[id] = st;
    paintComputer(st.state);
    renderBots();
  } catch {
    vmByPersona[id] = { state: "missing" };
    paintComputer("missing");
    renderBots();
  }
}

async function refreshAllVmDots() {
  await Promise.all(
    personas.map(async (p) => {
      try {
        vmByPersona[p.id] = await api(`/personas/${p.id}/vm`);
      } catch {
        vmByPersona[p.id] = { state: "missing" };
      }
    }),
  );
  renderBots();
  const cur = vmByPersona[selectedPersonaId()];
  if (cur) paintComputer(cur.state);
}

async function vmAction(action) {
  const id = selectedPersonaId();
  if (!id) return;
  if (els.vmState) els.vmState.textContent = `VM: ${action}…`;
  await api(`/personas/${id}/vm`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
  await refreshVm();
}

async function runSandbox(command) {
  if (!currentId) await newThread();
  els.sandboxOut.textContent = "running…";
  const result = await api(`/threads/${currentId}/sandbox`, {
    method: "POST",
    body: JSON.stringify({ command }),
  });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const code = result.exitCode ?? "?";
  const parts = [];
  if (stdout) parts.push(stdout.replace(/\n$/, ""));
  if (stderr) parts.push(stderr.replace(/\n$/, ""));
  parts.push(`exit ${code}`);
  els.sandboxOut.textContent = parts.join("\n");
}

function showError(err) {
  const msg = err?.message || String(err);
  if (els.messages.querySelector(".empty")) els.messages.innerHTML = "";
  els.messages.insertAdjacentHTML(
    "beforeend",
    `<div class="bubble system">${escapeHtml(msg)}</div>`,
  );
}

els.newThread.addEventListener("click", () => newThread().catch(showError));
els.persona.addEventListener("change", () => changePersona().catch(showError));

if (els.bots) {
  els.bots.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-persona]");
    if (btn) selectBot(btn.dataset.persona).catch(showError);
  });
}

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

if (els.vmCreate) els.vmCreate.addEventListener("click", () => vmAction("create").catch(showError));
if (els.vmStart) els.vmStart.addEventListener("click", () => vmAction("start").catch(showError));
if (els.vmStop) els.vmStop.addEventListener("click", () => vmAction("stop").catch(showError));
if (els.vmDestroy) els.vmDestroy.addEventListener("click", () => vmAction("destroy").catch(showError));

if (els.sandboxForm) {
  els.sandboxForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const command = (els.sandboxCmd.value || "").trim();
    if (!command) return;
    runSandbox(command).catch((err) => {
      els.sandboxOut.textContent = err.message || String(err);
    });
  });
}

(async function boot() {
  await ping();
  try {
    await loadPersonas();
    await loadThreads();
    await loadRoutines();
    await refreshAllVmDots();
    const first = selectedPersonaId();
    const latest = latestForPersona(first);
    if (latest) await selectThread(latest.id);
    else renderMessages(null);
  } catch (err) {
    showError(err);
  }
  setInterval(ping, 8000);
  setInterval(() => {
    void refreshVm();
    void refreshAllVmDots();
  }, 10000);
})();
