import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAZ6gOO32DstTL9LPSgtYYa3Jptq_8QNrs",
  authDomain: "quarentena-39458.firebaseapp.com",
  projectId: "quarentena-39458",
  storageBucket: "quarentena-39458.firebasestorage.app",
  messagingSenderId: "200343768046",
  appId: "1:200343768046:web:86905492b62c2fa7049cff"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const AIRCRAFT_LIBRARY = [
  {
    name: "Robinson R66",
    image: "assets/R66.png",
    aliases: ["ROBINSON", "R66", "R44", "R22", "RAVEN"]
  },
  {
    name: "AW109",
    image: "assets/AW109.png",
    aliases: ["AW109", "A109", "AGUSTA", "LEONARDO"]
  },
  {
    name: "H145",
    image: "assets/H145.png",
    aliases: ["H145", "BK117", "EC145"]
  },
  {
    name: "H130",
    image: "assets/H130.png",
    aliases: ["H130", "EC130"]
  },
  {
    name: "H125",
    image: "assets/H125.png",
    aliases: ["H125", "AS350", "ESQUILO"]
  },
  {
    name: "Bell",
    image: "assets/BELL.png",
    aliases: ["BELL", "407", "429", "505", "206", "412", "JETRANGER", "LONGRANGER"]
  }
];

const STATUS_LABELS = {
  entregue: "Entregue",
  "Descaracterização": "Scrap",
  "DescaracterizaÃ§Ã£o": "Scrap",
  descarte: "Descarte",
  espera_cliente: "Aguardando Cliente",
  outros: "Outros"
};

const el = {
  loginEmail: document.getElementById("loginEmail"),
  loginSenha: document.getElementById("loginSenha"),
  form: document.getElementById("loginForm"),
  signupBtn: document.getElementById("signupBtn"),
  loginMessage: document.getElementById("loginMessage"),
  editModal: document.getElementById("editModal"),
  editForm: document.getElementById("editForm"),
  editCloseBtn: document.getElementById("editCloseBtn"),
  editCancelBtn: document.getElementById("editCancelBtn"),
  editSaveBtn: document.getElementById("editSaveBtn"),
  editAircraftTitle: document.getElementById("editAircraftTitle"),
  editAircraftMeta: document.getElementById("editAircraftMeta"),
  editStatus: document.getElementById("editStatus"),
  editMessage: document.getElementById("editMessage"),
  quickAdd: document.querySelector(".quick-add"),
  aircraftGrid: document.getElementById("aircraft_grid"),
  aircraftSearch: document.getElementById("aircraftSearch"),
  filterChips: document.querySelectorAll("[data-aircraft-filter]"),
  emptyState: document.getElementById("empty_state"),
  addBtn: document.getElementById("addBtn"),
  newPrefixo: document.getElementById("newPrefixo"),
  newProtocolo: document.getElementById("newProtocolo"),
  newModelo: document.getElementById("newModelo"),
  newSetor: document.getElementById("newSetor"),
  newEngenharia: document.getElementById("newEngenharia"),
  newStatus: document.getElementById("newStatus"),
  countTotal: document.getElementById("count_total"),
  countEspera: document.getElementById("count_espera"),
  countScrap: document.getElementById("count_scrap"),
  countEntregue: document.getElementById("count_entregue"),
  countOutros: document.getElementById("count_outros"),
  userEmail: document.getElementById("userEmail"),
  loginScreen: document.getElementById("login-screen"),
  loaderScreen: document.getElementById("loader-screen"),
  timeline: document.getElementById("timeline"),
  filtroPrefixo: document.getElementById("filtroPrefixo"),
  filtroUsuario: document.getElementById("filtroUsuario")
};

let data = [];
let historicoGlobal = [];
let chart;
let chartPizza;
let activeAircraftFilter = "all";
let editingItemId = null;

el.form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = el.loginEmail.value.trim();
  const senha = el.loginSenha.value;

  if (!email || !senha) {
    setLoginMessage("Preencha email e senha para entrar.", "error");
    return;
  }

  setLoginLoading(true);
  setLoginMessage("Entrando...", "info");

  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (err) {
    setLoginMessage(getAuthErrorMessage(err), "error");
  } finally {
    setLoginLoading(false);
  }
});

el.signupBtn.onclick = async () => {
  const email = el.loginEmail.value.trim();
  const senha = el.loginSenha.value;

  if (!email || !senha) {
    setLoginMessage("Preencha email e senha para criar o usuario.", "error");
    return;
  }

  setLoginLoading(true);
  setLoginMessage("Criando usuario...", "info");

  try {
    await createUserWithEmailAndPassword(auth, email, senha);
    setLoginMessage("Usuario criado. Entrando...", "success");
  } catch (err) {
    setLoginMessage(getAuthErrorMessage(err), "error");
  } finally {
    setLoginLoading(false);
  }
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    el.loginScreen.style.display = "flex";
    el.loaderScreen.style.display = "none";
    if (el.userEmail) el.userEmail.textContent = "";
    setLoginLoading(false);
    return;
  }

  setLoginMessage("", "info");
  el.loginScreen.style.display = "none";
  el.loaderScreen.style.display = "flex";
  if (el.userEmail) el.userEmail.textContent = user.email;
  await carregarDados();
  el.loaderScreen.style.display = "none";
});

async function carregarDados() {
  try {
    const snap = await getDocs(collection(db, "pecas"));
    data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    await carregarHistorico();
    renderTable();
    updateDashboard();
  } catch {
    alert("Erro ao carregar dados");
  }
}

async function carregarHistorico() {
  try {
    const snap = await getDocs(collection(db, "historico"));
    historicoGlobal = snap.docs.map((d) => d.data());
  } catch {
    historicoGlobal = [];
  }
}

function renderHistorico() {
  if (!el.timeline) return;

  const filtroPrefixo = normalizeText(el.filtroPrefixo?.value || "");
  const filtroUsuario = normalizeText(el.filtroUsuario?.value || "");

  const html = historicoGlobal
    .filter((h) => {
      const prefixo = normalizeText(h.prefixo || "");
      const usuario = normalizeText(h.usuario || "");
      return (!filtroPrefixo || prefixo.includes(filtroPrefixo)) && (!filtroUsuario || usuario.includes(filtroUsuario));
    })
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .map((h) => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-title">
            <span>${escapeHtml(h.prefixo || "-")}</span>
            <span class="timeline-arrow">&rarr;</span>
            <span class="badge">${escapeHtml(h.acao || "-")}</span>
          </div>
          <div class="timeline-meta">${escapeHtml(h.data || "-")} &bull; ${escapeHtml(h.usuario || "desconhecido")}</div>
        </div>
      </div>
    `)
    .join("");

  el.timeline.innerHTML = html;
}

el.filtroPrefixo?.addEventListener("input", renderHistorico);
el.filtroUsuario?.addEventListener("input", renderHistorico);
el.aircraftSearch?.addEventListener("input", renderTable);
el.quickAdd?.addEventListener("submit", adicionarItem);
el.editForm?.addEventListener("submit", salvarEdicao);
el.editCloseBtn?.addEventListener("click", fecharCardEdicao);
el.editCancelBtn?.addEventListener("click", fecharCardEdicao);
el.editModal?.addEventListener("click", (event) => {
  if (event.target === el.editModal) fecharCardEdicao();
});
el.filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    activeAircraftFilter = chip.dataset.aircraftFilter || "all";
    el.filterChips.forEach((item) => item.classList.toggle("active", item === chip));
    renderTable();
  });
});

async function adicionarItem(e) {
  e.preventDefault();

  if (![el.newPrefixo.value, el.newProtocolo.value, el.newSetor.value, el.newEngenharia.value, el.newStatus.value].every(Boolean)) {
    alert("Preencha tudo");
    return;
  }

  const prefixo = el.newPrefixo.value.trim().toUpperCase();
  const protocolo = el.newProtocolo.value.trim().toUpperCase();
  const payload = {
    prefixo,
    protocolo,
    setor: el.newSetor.value,
    engenharia: el.newEngenharia.value,
    status: el.newStatus.value,
    data: new Date().toLocaleDateString("pt-BR")
  };

  if (el.newModelo?.value) payload.modelo = el.newModelo.value;

  try {
    const docRef = await addDoc(collection(db, "pecas"), payload);

    await addDoc(collection(db, "historico"), {
      pecaId: docRef.id,
      prefixo,
      acao: "criado",
      usuario: auth.currentUser?.email || "desconhecido",
      data: new Date().toLocaleString("pt-BR")
    });

    limparCampos();
    validarCampos();
    await carregarDados();
  } catch {
    alert("Erro ao adicionar");
  }
}

window.editarItem = function (id) {
  const item = data.find((d) => d.id === id);
  if (!item) return;

  abrirCardEdicao(item);
};

async function salvarEdicao(event) {
  event.preventDefault();

  const item = data.find((d) => d.id === editingItemId);
  if (!item || !el.editStatus?.value) return;

  const novoStatus = el.editStatus.value;
  setEditMessage("Salvando...", "info");
  setEditLoading(true);

  try {
    await updateDoc(doc(db, "pecas", item.id), { status: novoStatus });
    await addDoc(collection(db, "historico"), {
      pecaId: item.id,
      prefixo: item.prefixo,
      acao: "editado",
      usuario: auth.currentUser?.email || "desconhecido",
      data: new Date().toLocaleString("pt-BR")
    });
    await carregarDados();
    fecharCardEdicao();
  } catch {
    setEditMessage("Erro ao editar. Tente novamente.", "error");
  } finally {
    setEditLoading(false);
  }
}

function abrirCardEdicao(item) {
  editingItemId = item.id;

  const aircraft = resolveAircraft(item, data.indexOf(item));
  const rab = item.prefixo || "RAB nao informado";
  const protocolo = item.protocolo || "Sem protocolo";
  const modelo = getModelText(item, aircraft);
  const statusAtual = formatStatus(item.status);

  if (el.editAircraftTitle) el.editAircraftTitle.textContent = rab;
  if (el.editAircraftMeta) el.editAircraftMeta.textContent = `${modelo} | ${protocolo} | ${statusAtual}`;
  if (el.editStatus) {
    garantirOpcaoStatus(item.status);
    el.editStatus.value = item.status || "outros";
  }

  setEditMessage("", "info");
  setEditLoading(false);
  if (el.editModal) el.editModal.hidden = false;
  window.setTimeout(() => el.editStatus?.focus(), 0);
}

function fecharCardEdicao() {
  editingItemId = null;
  if (el.editModal) el.editModal.hidden = true;
  setEditMessage("", "info");
}

function garantirOpcaoStatus(status) {
  if (!status || !el.editStatus) return;

  const exists = Array.from(el.editStatus.options).some((option) => option.value === status);
  if (exists) return;

  const option = document.createElement("option");
  option.value = status;
  option.textContent = formatStatus(status);
  el.editStatus.appendChild(option);
}

function setEditLoading(isLoading) {
  if (el.editSaveBtn) {
    el.editSaveBtn.disabled = isLoading;
    el.editSaveBtn.textContent = isLoading ? "Salvando..." : "Salvar";
  }
}

function setEditMessage(message, type = "info") {
  if (!el.editMessage) return;
  el.editMessage.textContent = message;
  el.editMessage.className = `edit-message ${message ? type : ""}`.trim();
}

window.deleteItem = async function (id) {
  const item = data.find((d) => d.id === id);
  try {
    await deleteDoc(doc(db, "pecas", id));
    await addDoc(collection(db, "historico"), {
      pecaId: id,
      prefixo: item?.prefixo || "",
      acao: "excluido",
      usuario: auth.currentUser?.email || "desconhecido",
      data: new Date().toLocaleString("pt-BR")
    });
    await carregarDados();
  } catch {
    alert("Erro ao excluir");
  }
};

function renderTable() {
  if (!el.aircraftGrid) return;

  const search = normalizeText(el.aircraftSearch?.value || "");
  const filtered = data.filter((item) => {
    const matchesSearch = !search || normalizeText(Object.values(item).join(" ")).includes(search);
    return matchesSearch && matchesAircraftFilter(item);
  });
  const fragment = document.createDocumentFragment();

  el.aircraftGrid.textContent = "";
  if (el.countTotal) el.countTotal.textContent = filtered.length;
  if (el.emptyState) el.emptyState.hidden = filtered.length > 0;

  filtered.forEach((item, index) => {
    fragment.appendChild(createAircraftCard(item, index));
  });

  el.aircraftGrid.appendChild(fragment);
}

function createAircraftCard(item, index) {
  const aircraft = resolveAircraft(item, index);
  const rab = item.prefixo || "RAB não informado";
  const modelText = getModelText(item, aircraft);
  const status = formatStatus(item.status);

  const card = document.createElement("article");
  card.className = "aircraft-card";

  const media = document.createElement("div");
  media.className = "aircraft-media";

  const img = document.createElement("img");
  img.src = aircraft.image;
  img.alt = `${modelText} - ${rab}`;
  img.loading = "lazy";

  const model = document.createElement("span");
  model.className = "aircraft-model";
  model.textContent = modelText;

  media.append(img, model);

  const body = document.createElement("div");
  body.className = "aircraft-body";

  const head = document.createElement("div");
  head.className = "aircraft-head";

  const rabWrap = document.createElement("div");
  rabWrap.className = "rab-wrap";

  const rabLabel = document.createElement("span");
  rabLabel.textContent = "RAB";

  const rabValue = document.createElement("h2");
  rabValue.textContent = rab;

  rabWrap.append(rabLabel, rabValue);

  const statusBadge = document.createElement("span");
  statusBadge.className = `status-badge ${statusClass(item.status)}`;
  statusBadge.textContent = status;

  head.append(rabWrap, statusBadge);

  const details = document.createElement("div");
  details.className = "aircraft-details";
  details.append(
    createDetail("Protocolo", item.protocolo || "-"),
    createDetail("Setor", item.setor || "-"),
    createDetail("Engenharia", formatEngenharia(item.engenharia)),
    createDetail("Data", item.data || "-")
  );

  const actions = document.createElement("div");
  actions.className = "aircraft-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "card-action";
  editButton.textContent = "Editar";
  editButton.addEventListener("click", () => window.editarItem(item.id));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "card-action danger";
  deleteButton.textContent = "Excluir";
  deleteButton.addEventListener("click", () => window.deleteItem(item.id));

  actions.append(editButton, deleteButton);
  body.append(head, details, actions);
  card.append(media, body);

  return card;
}

function createDetail(label, value) {
  const item = document.createElement("div");
  item.className = "detail-item";

  const labelEl = document.createElement("span");
  labelEl.textContent = label;

  const valueEl = document.createElement("strong");
  valueEl.textContent = value;

  item.append(labelEl, valueEl);
  return item;
}

function updateDashboard() {
  if (el.countEspera) el.countEspera.textContent = data.filter((d) => d.engenharia === "espera").length;
  if (el.countScrap) el.countScrap.textContent = data.filter((d) => formatStatus(d.status) === "Scrap").length;
  if (el.countEntregue) el.countEntregue.textContent = data.filter((d) => d.status === "entregue").length;
  if (el.countOutros) el.countOutros.textContent = data.length;
}

function gerarGrafico() {
  if (typeof Chart === "undefined") return;
  if (chart) chart.destroy();
  if (chartPizza) chartPizza.destroy();

  chart = new Chart(document.getElementById("grafico"), {
    type: "line",
    data: { labels: ["Jan", "Fev", "Mar"], datasets: [{ data: [2, 4, 6] }] },
    options: { maintainAspectRatio: false }
  });

  const statusCount = data.reduce((acc, cur) => {
    const status = formatStatus(cur.status);
    if (status) acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  chartPizza = new Chart(document.getElementById("graficoPizza"), {
    type: "pie",
    data: { labels: Object.keys(statusCount), datasets: [{ data: Object.values(statusCount) }] },
    options: { maintainAspectRatio: false }
  });
}

window.showTab = function (tab) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.getElementById(tab)?.classList.add("active");
  document.querySelectorAll("[data-tab-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tabTarget === tab);
  });
  if (tab === "dashboard") gerarGrafico();
  if (tab === "historico") renderHistorico();
  if (tab === "tabela") renderTable();
};

function validarCampos() {
  el.addBtn.disabled = ![el.newPrefixo.value.trim(), el.newProtocolo.value.trim(), el.newSetor.value, el.newEngenharia.value, el.newStatus.value].every(Boolean);
}

[el.newPrefixo, el.newProtocolo, el.newModelo, el.newSetor, el.newEngenharia, el.newStatus]
  .filter(Boolean)
  .forEach((input) => input.addEventListener("input", validarCampos));

function limparCampos() {
  el.newPrefixo.value = "";
  el.newProtocolo.value = "";
  if (el.newModelo) el.newModelo.value = "";
  el.newSetor.value = "";
  el.newEngenharia.value = "";
  el.newStatus.value = "";
}

function resolveAircraft(item, index) {
  const haystack = normalizeText(Object.values(item).join(" "));
  const detected = AIRCRAFT_LIBRARY.find((aircraft) => aircraft.aliases.some((alias) => haystack.includes(alias)));

  if (detected) {
    return { ...detected, detected: true };
  }

  return { ...AIRCRAFT_LIBRARY[index % AIRCRAFT_LIBRARY.length], detected: false };
}

function getModelText(item, aircraft) {
  const explicitModel = pickValue(item, ["modelo", "aeronave", "helicoptero", "helicóptero", "tipo"]);
  if (explicitModel) return explicitModel;
  return aircraft.detected ? aircraft.name : "Modelo não informado";
}

function pickValue(item, names) {
  const expected = names.map((name) => normalizeText(name));
  const key = Object.keys(item).find((current) => expected.includes(normalizeText(current)));
  return key ? item[key] : "";
}

function formatStatus(status) {
  return STATUS_LABELS[status] || status || "-";
}

function statusClass(status) {
  const formatted = normalizeText(formatStatus(status));
  if (formatted.includes("ENTREGUE")) return "status-entregue";
  if (formatted.includes("SCRAP") || formatted.includes("DESCARTE")) return "status-scrap";
  if (formatted.includes("AGUARDANDO") || formatted.includes("ESPERA")) return "status-espera";
  return "status-outros";
}

function matchesAircraftFilter(item) {
  if (activeAircraftFilter === "all") return true;

  const status = normalizeText(formatStatus(item.status));
  const engenharia = normalizeText(item.engenharia || "");

  if (activeAircraftFilter === "espera") return engenharia.includes("ESPERA") || status.includes("AGUARDANDO") || status.includes("ESPERA");
  if (activeAircraftFilter === "scrap") return status.includes("SCRAP") || status.includes("DESCARTE");
  if (activeAircraftFilter === "entregue") return status.includes("ENTREGUE");

  return true;
}

function formatEngenharia(value) {
  if (value === "espera") return "Em espera";
  return value || "-";
}

function setLoginLoading(isLoading) {
  const buttons = [el.form?.querySelector(".button1"), el.signupBtn].filter(Boolean);
  buttons.forEach((button) => {
    button.disabled = isLoading;
  });

  const loginButton = el.form?.querySelector(".button1");
  if (loginButton) loginButton.textContent = isLoading ? "Entrando..." : "Login";
}

function setLoginMessage(message, type = "info") {
  if (!el.loginMessage) return;
  el.loginMessage.textContent = message;
  el.loginMessage.className = `login-message ${message ? type : ""}`.trim();
}

function getAuthErrorMessage(err) {
  const code = err?.code || "";

  const messages = {
    "auth/invalid-email": "Email invalido.",
    "auth/missing-password": "Digite a senha.",
    "auth/invalid-credential": "Email ou senha incorretos.",
    "auth/user-not-found": "Usuario nao encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/email-already-in-use": "Esse email ja tem cadastro.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/network-request-failed": "Falha de rede. Confira a internet e tente de novo.",
    "auth/unauthorized-domain": "Dominio nao autorizado no Firebase para login."
  };

  return messages[code] || err?.message || "Nao foi possivel fazer login.";
}

function normalizeText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
