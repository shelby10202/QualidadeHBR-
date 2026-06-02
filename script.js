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

// A planilha gerada fica em window para poder ser carregada antes deste modulo.
const QUARANTINE_SOURCE = window.QUARANTINE_SOURCE || {
  itemsByPrefix: {},
  metaByPrefix: {},
  summaryByLine: {},
  totalItens: 0,
  totalSaidas: 0
};

// Cada linha da planilha aponta para a imagem solicitada para o dashboard e cards.
const DASHBOARD_LINE_CONFIG = {
  AIRBUS: { label: "Airbus", image: "assets/H145.png", color: "#38bdf8" },
  LEONARDO: { label: "Leonardo", image: "assets/AW109.png", color: "#f97316" },
  ROBINSON: { label: "Robinson", image: "assets/R66.png", color: "#22c55e" },
  BELL: { label: "Bell", image: "assets/BELL.png", color: "#a78bfa" },
  "SEGURANCA/DEFESA": { label: "EB / FAB / Seguranca e Defesa", image: "assets/brasao-brasil.png", color: "#eab308" },
  OUTROS: { label: "Outros", image: "assets/hbr-logo.png", color: "#94a3b8" }
};

const RAB_ENTRY_URL = "https://aeronaves.anac.gov.br/aeronaves/cons_rab.asp";
const RAB_SEARCH_URL = "https://aeronaves.anac.gov.br/aeronaves/cons_rab_resposta2.asp";

prepareStaticShells();

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
  editProtocolo: document.getElementById("editProtocolo"),
  editEngenharia: document.getElementById("editEngenharia"),
  editStatus: document.getElementById("editStatus"),
  editMessage: document.getElementById("editMessage"),
  itemsModal: document.getElementById("itemsModal"),
  itemsCloseBtn: document.getElementById("itemsCloseBtn"),
  itemsAircraftTitle: document.getElementById("itemsAircraftTitle"),
  itemsAircraftMeta: document.getElementById("itemsAircraftMeta"),
  itemsTotal: document.getElementById("itemsTotal"),
  itemsSaidas: document.getElementById("itemsSaidas"),
  itemsFilterPn: document.getElementById("itemsFilterPn"),
  itemsFilterNomenclatura: document.getElementById("itemsFilterNomenclatura"),
  itemsList: document.getElementById("itemsList"),
  rabInfoModal: document.getElementById("rabInfoModal"),
  rabInfoCloseBtn: document.getElementById("rabInfoCloseBtn"),
  rabInfoTitle: document.getElementById("rabInfoTitle"),
  rabInfoSubtitle: document.getElementById("rabInfoSubtitle"),
  rabInfoStatus: document.getElementById("rabInfoStatus"),
  rabInfoContent: document.getElementById("rabInfoContent"),
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
  metricTotalSaidas: document.getElementById("metric_total_saidas"),
  metricTotalItens: document.getElementById("metric_total_itens"),
  metricSaidasCard: document.getElementById("metric_saidas_card"),
  metricPrefixos: document.getElementById("metric_prefixos"),
  metricSemSaida: document.getElementById("metric_sem_saida"),
  dashboardSourceName: document.getElementById("dashboard_source_name"),
  dashboardLineCount: document.getElementById("dashboard_line_count"),
  fleetVisual: document.getElementById("fleet_visual"),
  dashboardPrefixos: document.getElementById("dashboard_prefixos"),
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
let activeModalItems = [];

function prepareStaticShells() {
  // O dashboard antigo e parcialmente estatico e substituido por uma estrutura unica.
  const dashboard = document.getElementById("dashboard");
  if (dashboard) {
    dashboard.innerHTML = `
      <div class="dashboard-page">
        <div class="dashboard-topbar">
          <div>
            <p class="eyebrow">Dashboard</p>
            <h1>Quarentena e saidas</h1>
          </div>
          <div class="dashboard-total">
            <span id="metric_total_saidas">0</span>
            <small>pecas sairam</small>
          </div>
        </div>

        <div class="dashboard-kpis">
          <article class="metric-card metric-total">
            <div class="metric-icon">Q</div>
            <div>
              <span>Total em controle</span>
              <strong id="metric_total_itens">0</strong>
            </div>
          </article>
          <article class="metric-card metric-saidas">
            <div class="metric-icon">S</div>
            <div>
              <span>Saidas registradas</span>
              <strong id="metric_saidas_card">0</strong>
            </div>
          </article>
          <article class="metric-card metric-prefixos">
            <div class="metric-icon">P</div>
            <div>
              <span>Prefixos na planilha</span>
              <strong id="metric_prefixos">0</strong>
            </div>
          </article>
          <article class="metric-card metric-pendentes">
            <div class="metric-icon">A</div>
            <div>
              <span>Ainda sem saida</span>
              <strong id="metric_sem_saida">0</strong>
            </div>
          </article>
        </div>

        <div class="dashboard-grid">
          <section class="dashboard-panel chart-panel">
            <div class="panel-heading">
              <h3>Saidas por linha</h3>
              <span id="dashboard_source_name">FQ-067</span>
            </div>
            <div class="chart-frame">
              <canvas id="grafico"></canvas>
            </div>
          </section>
          <section class="dashboard-panel fleet-panel">
            <div class="panel-heading">
              <h3>Linhas da planilha</h3>
              <span id="dashboard_line_count">0 linhas</span>
            </div>
            <div id="fleet_visual" class="fleet-visual"></div>
          </section>
        </div>

        <div class="dashboard-grid dashboard-grid-secondary">
          <section class="dashboard-panel donut-panel">
            <div class="panel-heading">
              <h3>Situacao dos itens</h3>
              <span>saida x aguardando</span>
            </div>
            <div class="donut-frame">
              <canvas id="graficoPizza"></canvas>
            </div>
          </section>
          <section class="dashboard-panel prefix-panel">
            <div class="panel-heading">
              <h3>Maiores volumes</h3>
              <span>por prefixo</span>
            </div>
            <div id="dashboard_prefixos" class="prefix-ranking"></div>
          </section>
        </div>
      </div>
    `;
  }

  if (!document.getElementById("itemsModal")) {
    const modal = document.createElement("div");
    modal.id = "itemsModal";
    modal.className = "items-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="notification items-notification">
        <div class="notiglow"></div>
        <div class="notiborderglow"></div>
        <button type="button" id="itemsCloseBtn" class="modal-close" aria-label="Fechar itens">x</button>
        <div class="notititle">Itens da aeronave</div>
        <div class="notibody items-summary">
          <strong id="itemsAircraftTitle">RAB</strong>
          <span id="itemsAircraftMeta">Nomenclatura, P/N e saida</span>
        </div>
        <div class="items-stats">
          <div>
            <span>Total</span>
            <strong id="itemsTotal">0</strong>
          </div>
          <div>
            <span>Com saida</span>
            <strong id="itemsSaidas">0</strong>
          </div>
        </div>
        <div class="items-filters">
          <input id="itemsFilterPn" class="input-custom" type="search" placeholder="Filtrar P/N">
          <input id="itemsFilterNomenclatura" class="input-custom" type="search" placeholder="Filtrar nomenclatura">
        </div>
        <div id="itemsList" class="items-list"></div>
      </section>
    `;
    document.body.appendChild(modal);
  }

  if (!document.getElementById("rabInfoModal")) {
    const modal = document.createElement("div");
    modal.id = "rabInfoModal";
    modal.className = "items-modal rab-info-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="notification items-notification rab-info-notification">
        <div class="notiglow"></div>
        <div class="notiborderglow"></div>
        <button type="button" id="rabInfoCloseBtn" class="modal-close" aria-label="Fechar informacoes">x</button>
        <div id="rabInfoTitle" class="notititle">Prefixo</div>
        <div class="notibody items-summary">
          <strong>Informacoes da aeronave</strong>
          <span id="rabInfoSubtitle">Consulta no Registro Aeronautico Brasileiro</span>
        </div>
        <div id="rabInfoStatus" class="rab-info-status">Aguardando consulta...</div>
        <div id="rabInfoContent" class="rab-info-grid"></div>
      </section>
    `;
    document.body.appendChild(modal);
  }
}

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
el.itemsCloseBtn?.addEventListener("click", fecharItensAeronave);
el.itemsFilterPn?.addEventListener("input", renderFilteredItems);
el.itemsFilterNomenclatura?.addEventListener("input", renderFilteredItems);
el.rabInfoCloseBtn?.addEventListener("click", fecharInformacoesRab);
el.editModal?.addEventListener("click", (event) => {
  if (event.target === el.editModal) fecharCardEdicao();
});
el.itemsModal?.addEventListener("click", (event) => {
  if (event.target === el.itemsModal) fecharItensAeronave();
});
el.rabInfoModal?.addEventListener("click", (event) => {
  if (event.target === el.rabInfoModal) fecharInformacoesRab();
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
  const sourceMeta = getQuarantineMeta(prefixo);
  // Quando o prefixo existe na planilha, a linha tambem fica salva junto do cadastro.
  const payload = {
    prefixo,
    protocolo,
    setor: el.newSetor.value,
    engenharia: el.newEngenharia.value,
    status: el.newStatus.value,
    linhaPlanilha: sourceMeta?.linha || "",
    data: new Date().toLocaleDateString("pt-BR")
  };

  if (el.newModelo?.value) payload.modelo = el.newModelo.value;
  if (!payload.modelo && sourceMeta?.linha) payload.modelo = lineToModelLabel(sourceMeta.linha);

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
  const novoProtocolo = el.editProtocolo?.value.trim().toUpperCase() || "";
  const novaEngenharia = el.editEngenharia?.value || item.engenharia || "";
  setEditMessage("Salvando...", "info");
  setEditLoading(true);

  try {
    // O mesmo card de edicao agora atualiza os tres parametros operacionais.
    await updateDoc(doc(db, "pecas", item.id), {
      status: novoStatus,
      protocolo: novoProtocolo,
      engenharia: novaEngenharia
    });
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
  if (el.editProtocolo) el.editProtocolo.value = item.protocolo || "";
  if (el.editEngenharia) el.editEngenharia.value = item.engenharia || "Aprovado";
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

function abrirItensAeronave(item) {
  // O filtro principal e sempre o prefixo da aeronave, igual a coluna Prefixo da planilha.
  const prefixo = normalizePrefix(item.prefixo);
  const items = getQuarantineItems(prefixo);
  const aircraft = resolveAircraft(item, data.indexOf(item));
  const saidas = items.filter((part) => part.saida).length;

  if (el.itemsAircraftTitle) el.itemsAircraftTitle.textContent = prefixo || "RAB nao informado";
  if (el.itemsAircraftMeta) {
    el.itemsAircraftMeta.textContent = `${getModelText(item, aircraft)} | ${items.length} itens | ${saidas} saidas`;
  }
  if (el.itemsTotal) el.itemsTotal.textContent = items.length;
  if (el.itemsSaidas) el.itemsSaidas.textContent = saidas;
  if (el.itemsFilterPn) el.itemsFilterPn.value = "";
  if (el.itemsFilterNomenclatura) el.itemsFilterNomenclatura.value = "";

  activeModalItems = items;
  renderFilteredItems();

  if (el.itemsModal) el.itemsModal.hidden = false;
}

function fecharItensAeronave() {
  if (el.itemsModal) el.itemsModal.hidden = true;
}

async function abrirInformacoesRab(item) {
  const prefixo = normalizePrefix(item.prefixo);
  const rabUrl = buildRabUrl(prefixo);

  if (el.rabInfoTitle) el.rabInfoTitle.textContent = prefixo || "Prefixo nao informado";
  if (el.rabInfoSubtitle) el.rabInfoSubtitle.textContent = "Registro Aeronautico Brasileiro";
  if (el.rabInfoStatus) {
    el.rabInfoStatus.textContent = "Consultando dados na ANAC...";
    el.rabInfoStatus.className = "rab-info-status loading";
  }
  if (el.rabInfoContent) el.rabInfoContent.textContent = "";
  if (el.rabInfoModal) el.rabInfoModal.hidden = false;

  try {
    const html = await fetchRabHtml(rabUrl);
    const info = parseRabInfo(html, prefixo);
    renderRabInfo(info);
  } catch {
    renderRabError(prefixo);
  }
}

function fecharInformacoesRab() {
  if (el.rabInfoModal) el.rabInfoModal.hidden = true;
}

function buildRabUrl(prefixo) {
  // A pagina oficial do RAB usa este endpoint para retornar a consulta por prefixo.
  const params = new URLSearchParams({
    selectFabricante: "",
    selectHabilitacao: "",
    selectIcao: "",
    selectModelo: "",
    textMarca: normalizePrefix(prefixo),
    textNumeroSerie: "",
    tipo_pesquisa: "marcas"
  });
  return `${RAB_SEARCH_URL}?${params.toString()}`;
}

async function fetchRabHtml(rabUrl) {
  // O navegador tenta a ANAC direto; se houver bloqueio de CORS, usa proxy apenas como fallback.
  try {
    const response = await fetch(rabUrl, { cache: "no-store" });
    if (response.ok) return responseToText(response);
  } catch {
    // Segue para o fallback abaixo.
  }

  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rabUrl)}`;
  const proxyResponse = await fetch(proxyUrl, { cache: "no-store" });
  if (!proxyResponse.ok) throw new Error("Consulta RAB indisponivel");
  return responseToText(proxyResponse);
}

async function responseToText(response) {
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "";
  const charset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim() || "iso-8859-1";
  return new TextDecoder(charset).decode(buffer);
}

function parseRabInfo(html, prefixo) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const v2Info = parseRabInfoV2(doc);
  const tableInfo = parseRabInfoTable(doc);
  const combinedModel = v2Info.fabricanteModelo || tableInfo.fabricanteModelo || "";
  const splitModel = splitManufacturerModel(combinedModel);

  const fabricante = firstValue(v2Info.fabricante, tableInfo.fabricante, splitModel.fabricante);
  const modelo = firstValue(v2Info.modelo, tableInfo.modelo, splitModel.modelo);
  const proprietario = firstValue(v2Info.proprietario, tableInfo.proprietario);
  const operador = firstValue(v2Info.operador, tableInfo.operador);
  const situacao = firstValue(v2Info.situacao, tableInfo.situacao);
  const cva = firstValue(v2Info.cva, tableInfo.cva);
  const voo = firstValue(v2Info.voo, tableInfo.voo);
  const motivos = firstValue(v2Info.motivos, tableInfo.motivos);
  const ano = firstValue(v2Info.ano, tableInfo.ano);

  return {
    prefixo,
    fabricante: fabricante || "-",
    modelo: modelo || "-",
    proprietario: cleanOwnerOperator(proprietario) || "-",
    operador: cleanOwnerOperator(operador) || "-",
    situacao: situacao || "-",
    cva: cva || "-",
    voo: voo || "-",
    motivos: motivos || "-",
    ano: ano || "-",
    sourceUrl: RAB_ENTRY_URL
  };
}

function parseRabInfoV2(doc) {
  const infoRows = collectRabInfoRows(doc.querySelector("#status") || doc);
  const proprietarios = collectTableColumnValues(doc.querySelector("#proprietario"), "Proprietario");
  const operadores = collectOperatorNames(doc.querySelector("#operador"));

  return {
    fabricante: getExactInfoValue(infoRows, "Fabricante"),
    fabricanteModelo: getExactInfoValue(infoRows, "Fabricante / Modelo"),
    modelo: getExactInfoValue(infoRows, "Modelo"),
    proprietario: joinUniqueValues(proprietarios),
    operador: joinUniqueValues(operadores),
    situacao: firstValue(
      getExactInfoValue(infoRows, "Situacao da Aeronave"),
      getExactInfoValue(infoRows, "Situacao de Aeronavegabilidade")
    ),
    cva: getExactInfoValue(infoRows, "Data de Validade do CVA"),
    voo: getExactInfoValue(infoRows, "Tipo de Voo Autorizado"),
    motivos: firstValue(
      getExactInfoValue(infoRows, "Motivo(s)"),
      getExactInfoValue(infoRows, "Motivo do Cancelamento"),
      getExactInfoValue(infoRows, "Motivo de Suspensao")
    ),
    ano: getExactInfoValue(infoRows, "Ano de Fabricacao")
  };
}

function parseRabInfoTable(doc) {
  const rows = Array.from(doc.querySelectorAll(".retorno-pesquisa table tr, table.table-hover tr"));
  const map = new Map();

  rows.forEach((row) => {
    const label = cleanRabLabel(row.querySelector("th")?.textContent || "");
    const value = cleanTextLine(row.querySelector("td")?.textContent || "");
    if (label && value && !map.has(label)) map.set(label, value);
  });

  return {
    fabricante: map.get(cleanRabLabel("Fabricante")) || "",
    fabricanteModelo: map.get(cleanRabLabel("Fabricante / Modelo")) || "",
    modelo: map.get(cleanRabLabel("Modelo")) || "",
    proprietario: map.get(cleanRabLabel("Proprietario")) || "",
    operador: map.get(cleanRabLabel("Operador")) || "",
    situacao: firstValue(map.get(cleanRabLabel("Situacao da Aeronave")), map.get(cleanRabLabel("Situacao de Aeronavegabilidade"))),
    cva: map.get(cleanRabLabel("Data de Validade do CVA")) || "",
    voo: map.get(cleanRabLabel("Tipo de voo autorizado")) || "",
    motivos: firstValue(map.get(cleanRabLabel("Motivo(s)")), map.get(cleanRabLabel("Motivo do Cancelamento")), map.get(cleanRabLabel("Motivo de Suspensao"))),
    ano: map.get(cleanRabLabel("Ano de Fabricacao")) || ""
  };
}

function collectRabInfoRows(root) {
  return Array.from(root.querySelectorAll(".info-row")).map((row) => ({
    label: cleanRabLabel(row.querySelector(".info-label")?.childNodes[0]?.textContent || row.querySelector(".info-label")?.textContent || ""),
    value: cleanTextLine(row.querySelector(".info-value")?.textContent || "")
  })).filter((row) => row.label);
}

function collectTableColumnValues(root, columnName) {
  if (!root) return [];

  const table = root.querySelector("table");
  if (!table) return [];

  const headers = Array.from(table.querySelectorAll("thead th")).map((header) => cleanRabLabel(header.textContent || ""));
  const columnIndex = headers.indexOf(cleanRabLabel(columnName));
  if (columnIndex < 0) return [];

  return Array.from(table.querySelectorAll("tbody tr"))
    .map((row) => cleanTextLine(row.children[columnIndex]?.textContent || ""))
    .filter(Boolean);
}

function collectOperatorNames(root) {
  if (!root) return [];

  return Array.from(root.querySelectorAll(".text-primary"))
    .filter((label) => cleanRabLabel(label.textContent || "") === cleanRabLabel("Operador"))
    .map((label) => cleanTextLine(label.nextElementSibling?.textContent || ""))
    .filter(Boolean);
}

function getExactInfoValue(rows, label) {
  const expected = cleanRabLabel(label);
  const row = rows.find((item) => item.label === expected);
  return row?.value || "";
}

function splitManufacturerModel(value) {
  const text = cleanTextLine(value);
  const parts = text.split(" ").filter(Boolean);
  if (parts.length < 2) return { fabricante: "", modelo: text };

  return {
    fabricante: parts.slice(0, -1).join(" "),
    modelo: parts[parts.length - 1]
  };
}

function joinUniqueValues(values) {
  return [...new Set(values.map(cleanTextLine).filter(Boolean))].join(" / ");
}

function firstValue(...values) {
  return values.map(cleanTextLine).find(Boolean) || "";
}

function cleanRabLabel(value) {
  return normalizeText(cleanTextLine(value).replace(/:$/, ""));
}

function cleanOwnerOperator(value) {
  return cleanTextLine(value)
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b.*/, "")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b.*/, "")
    .replace(/\b\d{2}\/\d{2}\/\d{4}\b.*/, "")
    .trim();
}

function cleanTextLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function renderRabInfo(info) {
  if (el.rabInfoStatus) {
    el.rabInfoStatus.textContent = "Dados carregados da consulta RAB.";
    el.rabInfoStatus.className = "rab-info-status success";
  }
  if (el.rabInfoContent) {
    el.rabInfoContent.textContent = "";
    [
      ["Fabricante", info.fabricante],
      ["Modelo", info.modelo],
      ["Proprietario", info.proprietario],
      ["Operador", info.operador],
      ["Ano de fabricacao", info.ano],
      ["Situacao aeronavegabilidade", info.situacao],
      ["Validade do CVA", info.cva],
      ["Tipo de voo autorizado", info.voo],
      ["Motivos de restricao", info.motivos]
    ].forEach(([label, value]) => el.rabInfoContent.appendChild(createRabInfoCard(label, value)));
  }
}

function renderRabError(prefixo) {
  if (el.rabInfoStatus) {
    el.rabInfoStatus.textContent = "Nao foi possivel carregar os dados automaticamente. Tente novamente em alguns instantes.";
    el.rabInfoStatus.className = "rab-info-status error";
  }
  if (el.rabInfoContent) {
    el.rabInfoContent.textContent = "";
    [
      ["Prefixo", prefixo || "-"],
      ["Consulta", "Sem retorno automatico"],
      ["Origem", "Registro Aeronautico Brasileiro"]
    ].forEach(([label, value]) => el.rabInfoContent.appendChild(createRabInfoCard(label, value)));
  }
}

function createRabInfoCard(label, value) {
  const card = document.createElement("article");
  card.className = "rab-info-card";

  const labelEl = document.createElement("span");
  labelEl.textContent = label;

  const valueEl = document.createElement("strong");
  valueEl.textContent = value || "-";

  card.append(labelEl, valueEl);
  return card;
}

function renderFilteredItems() {
  if (!el.itemsList) return;

  const pnFilter = normalizeText(el.itemsFilterPn?.value || "");
  const nomenclatureFilter = normalizeText(el.itemsFilterNomenclatura?.value || "");
  const filtered = activeModalItems.filter((part) => {
    const matchesPn = !pnFilter || normalizeText(part.pn).includes(pnFilter);
    const matchesNomenclature = !nomenclatureFilter || normalizeText(part.nomenclatura).includes(nomenclatureFilter);
    return matchesPn && matchesNomenclature;
  });

  el.itemsList.textContent = "";

  if (!activeModalItems.length) {
    const empty = document.createElement("div");
    empty.className = "items-empty";
    empty.textContent = "Nenhum item encontrado na planilha para este prefixo.";
    el.itemsList.appendChild(empty);
    return;
  }

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "items-empty";
    empty.textContent = "Nenhum item encontrado com esses filtros.";
    el.itemsList.appendChild(empty);
    return;
  }

  filtered.forEach((part, index) => el.itemsList.appendChild(createPartRow(part, index)));
}

function createPartRow(part, index) {
  const row = document.createElement("article");
  row.className = "part-row";

  const counter = document.createElement("span");
  counter.className = "part-counter";
  counter.textContent = String(index + 1).padStart(2, "0");

  const nomenclature = document.createElement("strong");
  nomenclature.textContent = part.nomenclatura || "-";

  const pn = document.createElement("span");
  pn.textContent = `P/N ${part.pn || "-"}`;

  const exit = document.createElement("span");
  exit.className = part.saida ? "part-exit done" : "part-exit";
  exit.textContent = part.saida ? `Saida ${part.saida}` : "Sem saida";

  row.append(counter, nomenclature, pn, exit);
  return row;
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
    const sourceItems = getQuarantineItems(item.prefixo).map((part) => `${part.nomenclatura} ${part.pn} ${part.saida}`).join(" ");
    const matchesSearch = !search || normalizeText(`${Object.values(item).join(" ")} ${sourceItems}`).includes(search);
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
  const sourceItems = getQuarantineItems(rab);
  const sourceSaidas = sourceItems.filter((part) => part.saida).length;

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
    createDetail("Data", item.data || "-"),
    createDetail("Itens planilha", sourceItems.length || "-"),
    createDetail("Saidas", sourceSaidas || "-")
  );

  const actions = document.createElement("div");
  actions.className = "aircraft-actions";

  const infoButton = document.createElement("button");
  infoButton.type = "button";
  infoButton.className = "card-action info";
  infoButton.textContent = "Informacoes";
  infoButton.addEventListener("click", () => abrirInformacoesRab(item));

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "card-action";
  editButton.textContent = "Editar";
  editButton.addEventListener("click", () => window.editarItem(item.id));

  const itemsButton = document.createElement("button");
  itemsButton.type = "button";
  itemsButton.className = "card-action primary";
  itemsButton.textContent = "Ver itens";
  itemsButton.addEventListener("click", () => abrirItensAeronave(item));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "card-action danger";
  deleteButton.textContent = "Excluir";
  deleteButton.addEventListener("click", () => window.deleteItem(item.id));

  actions.append(infoButton, itemsButton, editButton, deleteButton);
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

function getDashboardTotals() {
  const itemsByPrefix = QUARANTINE_SOURCE.itemsByPrefix || {};
  const prefixes = Object.keys(itemsByPrefix).filter((prefixo) => prefixo !== "?");
  // Totais principais do dashboard usam a coluna Saida da planilha como fonte.
  const total = prefixes.reduce((sum, prefixo) => sum + itemsByPrefix[prefixo].length, 0);
  const saidas = prefixes.reduce((sum, prefixo) => sum + itemsByPrefix[prefixo].filter((part) => part.saida).length, 0);

  return {
    total,
    saidas,
    prefixos: prefixes.length
  };
}

function buildLineSummaries() {
  // O resumo vem pronto do arquivo gerado a partir da planilha, separado pela coluna Linha.
  return Object.entries(QUARANTINE_SOURCE.summaryByLine || {})
    .filter(([line]) => line !== "?")
    .map(([line, summary]) => {
      const config = getLineConfig(line);
      return {
        line,
        label: config.label,
        image: config.image,
        color: config.color,
        total: summary.total || 0,
        saidas: summary.saidas || 0,
        prefixos: summary.prefixos || []
      };
    })
    .sort((a, b) => b.total - a.total);
}

function buildPrefixRanking() {
  return Object.entries(QUARANTINE_SOURCE.itemsByPrefix || {})
    .filter(([prefixo]) => prefixo !== "?")
    .map(([prefixo, items]) => ({
      prefixo,
      total: items.length,
      saidas: items.filter((part) => part.saida).length
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

function renderDashboardPanels() {
  const lineSummaries = buildLineSummaries();

  if (el.dashboardLineCount) el.dashboardLineCount.textContent = `${lineSummaries.length} linhas`;
  if (el.fleetVisual) {
    el.fleetVisual.textContent = "";
    lineSummaries.forEach((line) => el.fleetVisual.appendChild(createFleetTile(line)));
  }

  if (el.dashboardPrefixos) {
    el.dashboardPrefixos.textContent = "";
    buildPrefixRanking().forEach((item) => el.dashboardPrefixos.appendChild(createRankingRow(item)));
  }
}

function createFleetTile(line) {
  const tile = document.createElement("article");
  tile.className = "fleet-tile";
  if (line.line === "SEGURANCA/DEFESA") tile.classList.add("fleet-tile-defense");

  const imageWrap = document.createElement("div");
  imageWrap.className = "fleet-image";

  const image = document.createElement("img");
  image.src = line.image;
  image.alt = line.label;
  image.loading = "lazy";

  const content = document.createElement("div");
  content.className = "fleet-content";

  const title = document.createElement("strong");
  title.textContent = line.label;

  const meta = document.createElement("span");
  meta.textContent = `${line.saidas} saidas de ${line.total} itens`;

  const bar = document.createElement("div");
  bar.className = "fleet-bar";
  bar.style.setProperty("--fleet-color", line.color);
  bar.style.setProperty("--fleet-progress", `${line.total ? Math.round((line.saidas / line.total) * 100) : 0}%`);

  imageWrap.appendChild(image);
  content.append(title, meta, bar);
  tile.append(imageWrap, content);
  return tile;
}

function createRankingRow(item) {
  const row = document.createElement("article");
  row.className = "ranking-row";

  const title = document.createElement("strong");
  title.textContent = item.prefixo;

  const meta = document.createElement("span");
  meta.textContent = `${item.total} itens | ${item.saidas} saidas`;

  row.append(title, meta);
  return row;
}

function updateDashboard() {
  const totals = getDashboardTotals();

  if (el.countEspera) el.countEspera.textContent = data.filter((d) => d.engenharia === "espera").length;
  if (el.countScrap) el.countScrap.textContent = data.filter((d) => formatStatus(d.status) === "Scrap").length;
  if (el.countEntregue) el.countEntregue.textContent = data.filter((d) => d.status === "entregue").length;
  if (el.countOutros) el.countOutros.textContent = data.length;
  if (el.metricTotalSaidas) el.metricTotalSaidas.textContent = totals.saidas;
  if (el.metricTotalItens) el.metricTotalItens.textContent = totals.total;
  if (el.metricSaidasCard) el.metricSaidasCard.textContent = totals.saidas;
  if (el.metricPrefixos) el.metricPrefixos.textContent = totals.prefixos;
  if (el.metricSemSaida) el.metricSemSaida.textContent = totals.total - totals.saidas;
  if (el.dashboardSourceName) el.dashboardSourceName.textContent = "FQ-067 REV.02";

  renderDashboardPanels();
}

function gerarGrafico() {
  if (typeof Chart === "undefined") return;
  if (chart) chart.destroy();
  if (chartPizza) chartPizza.destroy();

  // Os graficos sao recriados ao abrir o dashboard para refletir a planilha atual.
  const lineSummaries = buildLineSummaries();
  const labels = lineSummaries.map((line) => line.label);
  const colors = lineSummaries.map((line) => line.color);
  const saidas = lineSummaries.map((line) => line.saidas);
  const total = lineSummaries.map((line) => line.total);
  const chartCanvas = document.getElementById("grafico");
  const donutCanvas = document.getElementById("graficoPizza");

  if (chartCanvas) {
    chart = new Chart(chartCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Saidas", data: saidas, backgroundColor: colors, borderRadius: 4 },
          { label: "Total", data: total, backgroundColor: "rgba(148, 163, 184, 0.24)", borderRadius: 4 }
        ]
      },
      options: {
        maintainAspectRatio: false,
        resizeDelay: 120,
        plugins: { legend: { labels: { color: "#e5e7eb" } } },
        scales: {
          x: { ticks: { color: "#a1a1aa" }, grid: { color: "rgba(255, 255, 255, 0.06)" } },
          y: { beginAtZero: true, ticks: { color: "#a1a1aa" }, grid: { color: "rgba(255, 255, 255, 0.06)" } }
        }
      }
    });
  }

  if (donutCanvas) {
    const totals = getDashboardTotals();
    chartPizza = new Chart(donutCanvas, {
      type: "doughnut",
      data: {
        labels: ["Com saida", "Sem saida"],
        datasets: [{ data: [totals.saidas, totals.total - totals.saidas], backgroundColor: ["#22c55e", "#334155"], borderWidth: 0 }]
      },
      options: {
        cutout: "68%",
        maintainAspectRatio: false,
        resizeDelay: 120,
        plugins: { legend: { position: "bottom", labels: { color: "#e5e7eb" } } }
      }
    });
  }
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

function normalizePrefix(prefixo) {
  return String(prefixo || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function getQuarantineItems(prefixo) {
  // A planilha foi agrupada por prefixo para a busca ficar simples e rapida no navegador.
  return QUARANTINE_SOURCE.itemsByPrefix?.[normalizePrefix(prefixo)] || [];
}

function getQuarantineMeta(prefixo) {
  return QUARANTINE_SOURCE.metaByPrefix?.[normalizePrefix(prefixo)] || null;
}

function getLineConfig(line) {
  return DASHBOARD_LINE_CONFIG[line] || DASHBOARD_LINE_CONFIG.OUTROS;
}

function lineToModelLabel(line) {
  return getLineConfig(line).label;
}

function resolveLineKey(item = {}) {
  const prefixo = normalizePrefix(item.prefixo);
  const sourceLine = item.linhaPlanilha || getQuarantineMeta(prefixo)?.linha || "";
  const haystack = normalizeText(`${prefixo} ${sourceLine} ${item.setor || ""} ${item.modelo || ""}`);

  if (prefixo.startsWith("EB-") || prefixo.startsWith("FAB-") || haystack.includes("SEGURANCA") || haystack.includes("DEFESA")) {
    return "SEGURANCA/DEFESA";
  }
  if (haystack.includes("AIRBUS")) return "AIRBUS";
  if (haystack.includes("LEONARDO")) return "LEONARDO";
  if (haystack.includes("ROBINSON")) return "ROBINSON";
  if (haystack.includes("BELL")) return "BELL";
  return sourceLine || "";
}

function resolveAircraft(item, index) {
  const line = resolveLineKey(item);
  const explicitModel = pickValue(item, ["modelo", "aeronave", "helicoptero", "helicÃ³ptero", "tipo"]);
  const explicitAircraft = explicitModel
    ? AIRCRAFT_LIBRARY.find((aircraft) => aircraft.aliases.some((alias) => normalizeText(explicitModel).includes(alias)))
    : null;

  // Prefixos EB/FAB e Seguranca e Defesa sempre usam o brasao enviado.
  if (line === "SEGURANCA/DEFESA") {
    const config = getLineConfig(line);
    return {
      name: config.label,
      image: config.image,
      detected: true,
      line
    };
  }

  if (explicitAircraft) {
    return { ...explicitAircraft, detected: true };
  }

  const lineConfig = line ? getLineConfig(line) : null;
  if (lineConfig && line !== "OUTROS") {
    return { name: lineConfig.label, image: lineConfig.image, detected: true, line };
  }

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
