import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
  "Descaracterizacao": "Scrap",
  descarte: "Descarte",
  espera_cliente: "Aguardando Cliente",
  outros: "Outros"
};

// A planilha gerada fica em window para poder ser carregada antes deste módulo.
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
  "SEGURANCA/DEFESA": { label: "EB / FAB / Segurança e Defesa", image: "assets/brasao-brasil.png", color: "#eab308" },
  OUTROS: { label: "Outros", image: "assets/hbr-logo.png", color: "#94a3b8" }
};

const RAB_ENTRY_URL = "https://aeronaves.anac.gov.br/aeronaves/cons_rab.asp";
const RAB_SEARCH_URL = "https://aeronaves.anac.gov.br/aeronaves/cons_rab_resposta2.asp";
const ADMIN_PASSWORD_HASH = "9f1a87e271a323040c37d07ef8a93f044a6036ff1cce15a7700d5826ce024458";
const ADMIN_UNLOCK_KEY = "hbr_admin_unlocked";
const ADMIN_AREAS_KEY = "hbr_admin_site_areas";
const ADMIN_REMINDERS_KEY = "hbr_admin_reminders";
const ADMIN_HISTORY_KEY = "hbr_admin_history";
const PUBLICATION_NETWORK_KEY = "hbr_publication_network";
const PUBLICATION_CONFIG_KEY = "hbr_publication_config";
const AD_MONITOR_KEY = "hbr_ad_monitor_state";
const AD_REPORTS_KEY = "hbr_ad_reports";
const AD_SEARCH_INTERVAL_MS = 4 * 60 * 60 * 1000;
const AD_SOURCE_URLS = {
  ANAC: "https://sistemas.anac.gov.br/certificacao/DA/DA.asp",
  FAA: "https://drs.faa.gov/browse/ADFRAWD/doctypeDetails",
  EASA: "https://ad.easa.europa.eu/search/advanced/result/"
};
const FAA_SEARCH_TERMS = [
  "Airworthiness Directives Airbus Helicopters EC155",
  "Airworthiness Directives Airbus Helicopters AS365",
  "Airworthiness Directives Airbus Helicopters AS350 EC130",
  "Airworthiness Directives Bell 407 429 505",
  "Airworthiness Directives Leonardo A109 AW109 AW139",
  "Airworthiness Directives Robinson R22 R44 R66",
  "Airworthiness Directives Lycoming O-320 O-360 O-540 IO-540",
  "Airworthiness Directives Honeywell LTS101",
  "Airworthiness Directives Pratt Whitney PW206 PW207 PW210",
  "Airworthiness Directives Safran Arriel Arrius",
  "Airworthiness Directives Pratt Whitney PT6",
  "Airworthiness Directives Rolls-Royce 250",
  "Airworthiness Directives Rolls-Royce RR300"
];
const EASA_SEARCH_TERMS = ["ec155", "as365", "as350", "ec130", "ec135", "bk117", "bell 407", "bell 429", "a109", "aw109", "aw139", "r66", "lycoming", "o-320", "o-360", "o-540", "io-540", "lts101", "pw206", "pw207", "pw210", "pt6b", "pt6c", "arriel", "arrius", "250-c18", "250-c30p", "250-c47", "rr300"];
const EASA_SCAN_URLS = [
  "https://ad.easa.europa.eu/search/advanced/result/page-1/",
  "https://ad.easa.europa.eu/search/advanced/result/page-2/",
  "https://ad.easa.europa.eu/search/advanced/result/page-3/",
  "https://ad.easa.europa.eu/search/advanced/result/page-4/",
  ...EASA_SEARCH_TERMS.map((term) => `https://ad.easa.europa.eu/search/${encodeURIComponent(term)}`)
];
const ANAC_SCAN_URLS = [
  "https://sistemas.anac.gov.br/certificacao/DA/DA_Last2.asp?St=N",
  "https://sistemas.anac.gov.br/certificacao/DA/DA_Last2.asp?St=E",
  "https://sistemas.anac.gov.br/certificacao/DA/DA_Biweekly.asp",
  "https://sistemas.anac.gov.br/certificacao/DA/DA_BiweeklyList.asp?Ano=2026&Mes=8&Q=1&Seq=15",
  "https://sistemas.anac.gov.br/certificacao/DA/DA_BiweeklyList.asp?Ano=2026&Mes=8&Q=0&Seq=14",
  "https://sistemas.anac.gov.br/certificacao/DA/DA_BiweeklyList.asp?Ano=2026&Mes=7&Q=1&Seq=13",
  "https://sistemas.anac.gov.br/certificacao/DA/DA_BiweeklyList.asp?Ano=2026&Mes=7&Q=0&Seq=12"
];
const DOCUMENT_IMPORT_EMPTY_OPTION = "__empty__";
const AREA_DATA_SOURCE_LABELS = {
  "excel-file": "Excel via arquivo",
  "excel-drive": "Excel via Drive",
  sql: "SQL"
};

const HBR_EO_SCOPE = {
  organization: "HBR AVIAÇÃO S.A.",
  certificate: "200608-01/ANAC",
  base: "Osasco - SP",
  source: "EO HBR Aviação - Osasco",
  revision: "Documento assinado em 06/01/2026",
  aircraft: [
    "Airbus Helicopters EC 155 B/B1",
    "Airbus Helicopters AS 350 BA/B2/B3",
    "Airbus Helicopters AS 355 F/F1/F2/N/NP",
    "Airbus Helicopters EC 120 B",
    "Airbus Helicopters EC 130 B4/T2",
    "Airbus Helicopters SA/AS 365 N/N1/N2/N3",
    "Airbus Helicopters Deutschland EC135/635",
    "Airbus Helicopters Deutschland MBB BK 117 C-1/C-2/D-2/D-3",
    "Bell 206A/206B/206L-3/206L-4",
    "Bell 407/429/505",
    "Helibras HB-350B",
    "Leonardo A109/A109AII/A109C/A109E/A109S/AW109SP",
    "Leonardo A119/AW119 MKII/AW139/AW169",
    "Robinson R22/R44/R66"
  ],
  engines: [
    "Honeywell LTS101-750B-1",
    "Lycoming O-320-B2C/O-360-J2A/O-540-F1B5/IO-540-AE1A5",
    "Pratt & Whitney Canada PT6B-37A/PT6C-67C/PW206B/PW206B2/PW206B3/PW206C/PW207C/PW207D1/PW207D2/PW210A",
    "Rolls-Royce/Allison 250-C18/C18B/C20/C20B/C20C/C20F/C20J/C20R/C20S/C20W/C30P/C47B/C47E/C300-A1",
    "Safran/Turbomeca Arriel 1B/1C/1C1/1C2/1D1/1E2/2B/2B1/2C/2C1/2C2/2D/2E/2S1",
    "Safran/Turbomeca Arrius 1A/1A1/2B1/2B1A/2B1A1/2B2/2B2 Plus/2F/2K1/2R"
  ],
  aircraftEngines: [
    {
      aircraft: "Airbus Helicopters EC 155 B/B1",
      engines: ["2 x Arriel 2C1 (EC155 B)", "2 x Arriel 2C2 (EC155 B1)"]
    },
    {
      aircraft: "Airbus Helicopters AS 350 BA/B2/B3",
      engines: ["Arriel 1B (BA)", "Arriel 1D1 (B2)", "Arriel 2B/2B1/2D (B3/H125)"]
    },
    {
      aircraft: "Airbus Helicopters AS 355 F/F1/F2/N/NP",
      engines: ["2 x Rolls-Royce/Allison 250-C20F (F/F1/F2)", "2 x Arrius 1A (N)", "2 x Arrius 1A1 (NP)"]
    },
    {
      aircraft: "Airbus Helicopters EC 120 B",
      engines: ["Arrius 2F"]
    },
    {
      aircraft: "Airbus Helicopters EC 130 B4/T2",
      engines: ["Arriel 2B1 (B4)", "Arriel 2D (T2/H130)"]
    },
    {
      aircraft: "Airbus Helicopters SA/AS 365 N/N1/N2/N3",
      engines: ["2 x Arriel 1C (SA365 N)", "2 x Arriel 1C1 (SA365 N1)", "2 x Arriel 1C2 (AS365 N2)", "2 x Arriel 2C (AS365 N3)"]
    },
    {
      aircraft: "Airbus Helicopters Deutschland EC135/635",
      engines: ["2 x Pratt & Whitney Canada PW206B/PW206B2/PW206B3 (P1/P2/P3)", "2 x Arrius 2B1/2B1A/2B1A1/2B2/2B2 Plus (T1/T2/T3)"]
    },
    {
      aircraft: "Airbus Helicopters Deutschland MBB BK 117 C-1/C-2/D-2/D-3",
      engines: ["2 x Honeywell LTS101-750B-1 (C-1)", "2 x Arriel 1E2 (C-2/EC145)", "2 x Arriel 2E (D-2/D-3/H145)"]
    },
    {
      aircraft: "Bell 206A/206B/206L-3/206L-4",
      engines: ["Rolls-Royce/Allison 250-C18/C18B (206A)", "Rolls-Royce/Allison 250-C20/C20B/C20J (206B)", "Rolls-Royce/Allison 250-C30P (206L-3/206L-4)"]
    },
    {
      aircraft: "Bell 407/429/505",
      engines: ["Rolls-Royce M250-C47B/C47E (407)", "2 x Pratt & Whitney Canada PW207D1/PW207D2 (429)", "Safran Arrius 2R (505)"]
    },
    {
      aircraft: "Helibras HB-350B",
      engines: ["Arriel 1B"]
    },
    {
      aircraft: "Leonardo A109/A109AII/A109C/A109E/A109S/AW109SP",
      engines: ["2 x Rolls-Royce/Allison 250-C20/C20B/C20R/1 (A109/A109AII/A109C)", "2 x Pratt & Whitney Canada PW206C ou 2 x Arrius 2K1 (A109E)", "2 x Pratt & Whitney Canada PW207C (A109S/AW109SP)"]
    },
    {
      aircraft: "Leonardo A119/AW119 MKII/AW139/AW169",
      engines: ["Pratt & Whitney Canada PT6B-37A (A119/AW119 MKII)", "2 x Pratt & Whitney Canada PT6C-67C (AW139)", "2 x Pratt & Whitney Canada PW210A (AW169)"]
    },
    {
      aircraft: "Robinson R22/R44/R66",
      engines: ["Lycoming O-320-B2C ou O-360-J2A (R22/R22 Alpha/Beta/Mariner)", "Lycoming O-540-F1B5 (R44 Raven I)", "Lycoming IO-540-AE1A5 (R44 Raven II)", "Rolls-Royce RR300 / 250-C300-A1 (R66)"]
    }
  ],
  keywords: [
    "AIRBUS HELICOPTERS",
    "EC 155",
    "AS 365",
    "AS 350",
    "EC 130",
    "MBB BK 117",
    "BELL 407",
    "BELL 429",
    "ROBINSON",
    "LEONARDO",
    "A109",
    "AW109",
    "AW139",
    "LYCOMING",
    "O-320",
    "O-360",
    "O-540",
    "IO-540",
    "HONEYWELL",
    "LTS101",
    "SAFRAN",
    "ARRIEL",
    "ARRIUS",
    "PRATT",
    "PT6B",
    "PT6C",
    "PW206",
    "PW207",
    "PW210",
    "ROLLS-ROYCE",
    "ALLISON",
    "250-C18",
    "250-C30P",
    "250-C47",
    "RR300"
  ]
};

const AD_LINE_FILTERS = [
  {
    key: "AIRBUS",
    label: "Airbus / Helibras",
    terms: ["AIRBUS", "HELIBRAS", "EC 155", "EC155", "AS 365", "AS-365", "SA 365", "SA-365", "AS 350", "AS350", "AS 355", "AS355", "EC 120", "EC120", "EC 130", "EC130", "EC135", "EC 135", "BK 117", "BK117", "H125", "H130", "H135", "H145"],
    engines: [
      { label: "Arriel 1B/1C/1C1/1C2/1D1/1E2/2B/2B1/2C/2C1/2C2/2D/2E", terms: ["ARRIEL", "ARRIEL 1B", "ARRIEL 1C", "ARRIEL 1C1", "ARRIEL 1C2", "ARRIEL 1D1", "ARRIEL 1E2", "ARRIEL 2B", "ARRIEL 2B1", "ARRIEL 2C", "ARRIEL 2C1", "ARRIEL 2C2", "ARRIEL 2D", "ARRIEL 2E"] },
      { label: "Arrius 1A/1A1/2B1/2B1A/2B1A1/2B2/2B2 Plus/2F", terms: ["ARRIUS", "ARRIUS 1A", "ARRIUS 1A1", "ARRIUS 2B1", "ARRIUS 2B1A", "ARRIUS 2B1A1", "ARRIUS 2B2", "ARRIUS 2B2 PLUS", "ARRIUS 2F"] },
      { label: "Pratt & Whitney Canada PW206B/PW206B2/PW206B3", terms: ["PW206B", "PW206B2", "PW206B3", "206B3"] },
      { label: "Honeywell LTS101-750B-1", terms: ["HONEYWELL", "LTS101", "LTS101-750B-1"] }
    ]
  },
  {
    key: "BELL",
    label: "Bell",
    terms: ["BELL", "BELL 206", "BELL 407", "BELL 429", "BELL 505", "206A", "206B", "206L", "407", "429", "505", "JETRANGER", "LONGRANGER"],
    engines: [
      { label: "Rolls-Royce/Allison 250-C18/C20/C30P/C47", terms: ["ALLISON 250", "ROLLS-ROYCE 250", "M250", "250-C18", "250-C18B", "250-C20", "250-C20B", "250-C20J", "250-C30P", "250-C47", "250-C47B", "250-C47E"] },
      { label: "Pratt & Whitney Canada PW207D1/PW207D2", terms: ["PW207D", "PW207D1", "PW207D2", "207D1", "207D2"] },
      { label: "Safran Arrius 2R", terms: ["ARRIUS 2R", "2R"] }
    ]
  },
  {
    key: "LEONARDO",
    label: "Leonardo",
    terms: ["LEONARDO", "AGUSTA", "AGUSTAWESTLAND", "A109", "AW109", "A119", "AW119", "AW139", "AW169"],
    engines: [
      { label: "Pratt & Whitney Canada PT6B-37A/PT6C-67C", terms: ["PT6", "PT6B", "PT6B-37A", "PT6C", "PT6C-67C"] },
      { label: "Pratt & Whitney Canada PW206C/PW207C/PW210A", terms: ["PW206C", "PW207C", "PW210", "PW210A"] },
      { label: "Safran/Turbomeca Arrius 2K1", terms: ["ARRIUS 2K1", "2K1"] },
      { label: "Rolls-Royce/Allison 250-C20/C20B/C20R", terms: ["ALLISON 250", "ROLLS-ROYCE 250", "250-C20", "250-C20B", "250-C20R"] }
    ]
  },
  {
    key: "ROBINSON",
    label: "Robinson",
    terms: ["ROBINSON", "R22", "R44", "R66", "RAVEN"],
    engines: [
      { label: "Lycoming O-320/O-360/O-540/IO-540", terms: ["LYCOMING", "O-320", "O-360", "O-540", "IO-540"] },
      { label: "Rolls-Royce RR300 / 250-C300-A1", terms: ["RR300", "ROLLS-ROYCE RR300", "250-C300", "250-C300-A1", "C300-A1"] }
    ]
  }
];

const DEFAULT_AD_FINDINGS = [
  {
    id: "easa-26-105",
    authority: "EASA",
    number: "26-105",
    type: "PAD",
    issueDate: "2026-09-11",
    effectiveDate: "",
    holder: "Airbus Helicopters",
    model: "SA/AS 365 / EC 155",
    subject: "Tail Rotor Drive - Tail Gear Box Control Rod Bearings - Replacement / Life Limitation",
    match: "EO contém SA/AS 365 e EC 155.",
    status: "Novo para análise",
    sourceUrl: "https://ad.easa.europa.eu/ad/26-105"
  },
  {
    id: "easa-2026-0118",
    authority: "EASA",
    number: "2026-0118",
    type: "AD",
    issueDate: "2026-06-22",
    effectiveDate: "2026-07-06",
    holder: "Airbus Helicopters",
    model: "SA/AS 365 / EC 155",
    subject: "Rotors Flight Control - Tail Rotor Actuator - Inspection",
    match: "EO contém SA/AS 365 e EC 155.",
    status: "Aplicável ao escopo",
    sourceUrl: "https://ad.easa.europa.eu/ad/2026-0118"
  },
  {
    id: "easa-2026-0111",
    authority: "EASA",
    number: "2026-0111",
    type: "AD",
    issueDate: "2026-06-10",
    effectiveDate: "2026-06-24",
    holder: "Airbus Helicopters",
    model: "AS 350 / EC 130",
    subject: "Tail Rotor Drive - Shaft Sleeves - Inspection",
    match: "EO contém AS 350 e EC 130.",
    status: "Aplicável ao escopo",
    sourceUrl: "https://ad.easa.europa.eu/ad/2026-0111"
  },
  {
    id: "easa-2026-0152",
    authority: "EASA",
    number: "2026-0152",
    type: "AD",
    issueDate: "2026-07-30",
    effectiveDate: "2026-08-06",
    holder: "Airbus Helicopters Deutschland",
    model: "MBB-BK 117",
    subject: "Air Conditioning - Vapor Cycle Air Conditioning System - Inspection",
    match: "EO contém MBB BK 117.",
    status: "Aplicável ao escopo",
    sourceUrl: "https://ad.easa.europa.eu/ad/2026-0152"
  },
  {
    id: "easa-2026-0151",
    authority: "EASA",
    number: "2026-0151",
    type: "AD",
    issueDate: "2026-07-30",
    effectiveDate: "2026-08-06",
    holder: "Airbus Helicopters Deutschland",
    model: "MBB-BK 117",
    subject: "Main Rotor Drive - Rotor Hub-Shaft - Inspection",
    match: "EO contém MBB BK 117.",
    status: "Aplicável ao escopo",
    sourceUrl: "https://ad.easa.europa.eu/ad/2026-0151"
  },
  {
    id: "faa-2026-4664",
    authority: "FAA",
    number: "FAA-2026-4664",
    type: "AD NPRM",
    issueDate: "2026-06-26",
    effectiveDate: "",
    holder: "Airbus Helicopters",
    model: "AS 365 N3, AS-365N2, EC 155 B, EC155B1, SA-365N, SA-365N1",
    subject: "Airworthiness Directives; Airbus Helicopters",
    match: "EO contém SA/AS 365 e EC 155.",
    status: "Proposta para análise",
    sourceUrl: "https://drs.faa.gov/browse/excelExternalWindow/FR-ADNPRM-2026-13368-00000000000.0001"
  },
  {
    id: "faa-2026-7220",
    authority: "FAA",
    number: "FAA-2026-7220",
    type: "AD NPRM",
    issueDate: "2026-07-10",
    effectiveDate: "",
    holder: "Bell Textron Canada Limited",
    model: "407",
    subject: "Airworthiness Directives; Bell Textron Canada Limited Helicopters",
    match: "EO contém Bell 407.",
    status: "Proposta para análise",
    sourceUrl: "https://drs.faa.gov/browse/excelExternalWindow/FR-ADNPRM-2026-14238-00000000000.0001"
  }
];

const DEFAULT_AD_SOURCE_STATUS = [
  {
    authority: "ANAC",
    url: "https://sistemas.anac.gov.br/certificacao/DA/DA_Last2.asp?St=N",
    status: "Sem novas DAs",
    tone: "empty",
    message: "A página de DAs brasileiras emitidas ou revisadas nas últimas duas semanas não retornou nova DA.",
    checkedAt: "2026-09-12"
  },
  {
    authority: "FAA",
    url: AD_SOURCE_URLS.FAA,
    status: "Resultados via DRS",
    tone: "warning",
    message: "O DRS é atualizado diariamente e exige pesquisa dinâmica; os achados iniciais foram consolidados a partir de páginas públicas do DRS.",
    checkedAt: "2026-09-12"
  },
  {
    authority: "EASA",
    url: AD_SOURCE_URLS.EASA,
    status: "Resultados encontrados",
    tone: "ok",
    message: "A Safety Publications Tool retornou ADs/PADs compatíveis com modelos da EO HBR.",
    checkedAt: "2026-09-12"
  }
];

const DOCUMENT_IMPORT_FIELDS = [
  { key: "documento", label: "Documento", aliases: ["documento", "tipo", "tipo documento", "categoria", "sigla"] },
  { key: "codigoDocumento", label: "Código do documento", aliases: ["codigo do documento", "código do documento", "codigo", "código", "cod documento", "cod", "n documento", "numero"] },
  { key: "nomeDocumento", label: "Nome do documento", aliases: ["nome do documento", "nome documento", "titulo", "título", "descricao", "descrição", "document title"] },
  { key: "setor", label: "Setor", aliases: ["setor", "area", "área", "setor responsavel", "setor responsável"] },
  { key: "setorAdjacente", label: "Setor adjacente", aliases: ["setor adjacente", "adjacente", "setor impactado", "impacto", "relacao", "relação"] },
  { key: "desenvolvidoPor", label: "Desenvolvido por", aliases: ["desenvolvido por", "desenvolvedor", "elaborado por", "autor", "responsavel", "responsável"] },
  { key: "revisoes", label: "Revisões", aliases: ["revisoes", "revisões", "revisao", "revisão", "rev", "versao", "versão"] }
];

const DEFAULT_ADMIN_REMINDERS = [
  { id: "rab-review", text: "Revisar consultas RAB", done: true },
  { id: "sheet-update", text: "Atualizar planilha FQ-067", done: false },
  { id: "new-areas", text: "Planejar novas áreas", done: false }
];

const DEFAULT_AREA_BUILDER_LINKS = [
];

const DEFAULT_PUBLICATION_NETWORK = {
  nodes: [
    { id: "fq-067", type: "FQ", code: "FQ-067", title: "Controle de artigos aeronáuticos condenados", sector: "Qualidade", x: 44, y: 58 },
    { id: "it-014", type: "IT", code: "IT-014", title: "Descaracterização e segregação", sector: "Engenharia", x: 26, y: 36 },
    { id: "prq-004", type: "PRQ", code: "PRQ-004", title: "Controle de documentos", sector: "Publicações", x: 62, y: 34 },
    { id: "fq-021", type: "FQ", code: "FQ-021", title: "Registro de recebimento técnico", sector: "Qualidade", x: 72, y: 66 },
    { id: "prq-011", type: "PRQ", code: "PRQ-011", title: "Rastreabilidade documental", sector: "Qualidade", x: 34, y: 78 }
  ],
  links: [
    { from: "fq-067", to: "it-014" },
    { from: "fq-067", to: "prq-004" },
    { from: "fq-067", to: "prq-011" },
    { from: "fq-021", to: "prq-004" }
  ]
};

const DEFAULT_PUBLICATION_CONFIG = {
  intensity: 82,
  nodeSize: 62,
  lineWidth: 3,
  showLabels: true,
  filters: { FQ: true, IT: true, PRQ: true },
  search: ""
};

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
  filtroUsuario: document.getElementById("filtroUsuario"),
  adminAccessBtn: document.getElementById("adminAccessBtn"),
  adminGateModal: document.getElementById("adminGateModal"),
  adminGateForm: document.getElementById("adminGateForm"),
  adminGateCloseBtn: document.getElementById("adminGateCloseBtn"),
  adminGateCancelBtn: document.getElementById("adminGateCancelBtn"),
  adminPassword: document.getElementById("adminPassword"),
  adminGateMessage: document.getElementById("adminGateMessage"),
  adminAreaCount: document.getElementById("adminAreaCount"),
  adminSiteTree: document.getElementById("adminSiteTree"),
  adminAreaForm: document.getElementById("adminAreaForm"),
  adminAreaName: document.getElementById("adminAreaName"),
  adminAreaDescription: document.getElementById("adminAreaDescription"),
  adminAreaMessage: document.getElementById("adminAreaMessage"),
  adminAreaBuilderTitle: document.getElementById("adminAreaBuilderTitle"),
  adminAreaBuilderSubmitBtn: document.getElementById("adminAreaBuilderSubmitBtn"),
  adminAreaBuilderOpenBtn: document.getElementById("adminAreaBuilderOpenBtn"),
  adminAreaBuilderModal: document.getElementById("adminAreaBuilderModal"),
  adminAreaBuilderCloseBtn: document.getElementById("adminAreaBuilderCloseBtn"),
  adminAreaBuilderCancelBtn: document.getElementById("adminAreaBuilderCancelBtn"),
  adminAreaDataSource: document.getElementById("adminAreaDataSource"),
  adminAreaFilePanel: document.getElementById("adminAreaFilePanel"),
  adminAreaDrivePanel: document.getElementById("adminAreaDrivePanel"),
  adminAreaSqlPanel: document.getElementById("adminAreaSqlPanel"),
  adminAreaFileInput: document.getElementById("adminAreaFileInput"),
  adminAreaDriveUrl: document.getElementById("adminAreaDriveUrl"),
  adminAreaSqlQuery: document.getElementById("adminAreaSqlQuery"),
  adminAreaAddButtons: document.querySelectorAll("[data-builder-add]"),
  adminAreaInlineAddButtons: document.querySelectorAll("[data-builder-add-inline]"),
  adminAreaNewInput: document.getElementById("adminAreaNewInput"),
  adminAreaNewOutput: document.getElementById("adminAreaNewOutput"),
  adminAreaNewChart: document.getElementById("adminAreaNewChart"),
  adminAreaLinkCanvas: document.getElementById("adminAreaLinkCanvas"),
  adminAreaCanvasStatus: document.getElementById("adminAreaCanvasStatus"),
  adminAreaClearLinksBtn: document.getElementById("adminAreaClearLinksBtn"),
  areaPreviewInputs: document.getElementById("areaPreviewInputs"),
  areaPreviewOutputs: document.getElementById("areaPreviewOutputs"),
  areaPreviewCharts: document.getElementById("areaPreviewCharts"),
  areaPreviewDataSource: document.getElementById("areaPreviewDataSource"),
  adminUsersList: document.getElementById("adminUsersList"),
  adminAreasList: document.getElementById("adminAreasList"),
  adminReminderForm: document.getElementById("adminReminderForm"),
  adminReminderText: document.getElementById("adminReminderText"),
  adminChecklist: document.getElementById("checklist"),
  adminHistoryList: document.getElementById("adminHistoryList"),
  documentImportFile: document.getElementById("documentImportFile"),
  documentImportSheet: document.getElementById("documentImportSheet"),
  documentImportHeaderRow: document.getElementById("documentImportHeaderRow"),
  documentImportStartRow: document.getElementById("documentImportStartRow"),
  documentImportEndRow: document.getElementById("documentImportEndRow"),
  documentImportMapping: document.getElementById("documentImportMapping"),
  documentImportStats: document.getElementById("documentImportStats"),
  documentImportPreview: document.getElementById("documentImportPreview"),
  documentImportMessage: document.getElementById("documentImportMessage"),
  documentImportApplyBtn: document.getElementById("documentImportApplyBtn"),
  documentImportClearBtn: document.getElementById("documentImportClearBtn"),
  adTotalFindings: document.getElementById("adTotalFindings"),
  adLastRun: document.getElementById("adLastRun"),
  adNextRun: document.getElementById("adNextRun"),
  adReportCount: document.getElementById("adReportCount"),
  adRefreshBtn: document.getElementById("adRefreshBtn"),
  adScopeSummary: document.getElementById("adScopeSummary"),
  adSourceList: document.getElementById("adSourceList"),
  adSearchFilter: document.getElementById("adSearchFilter"),
  adLineFilter: document.getElementById("adLineFilter"),
  adDateSort: document.getElementById("adDateSort"),
  adResultsList: document.getElementById("adResultsList"),
  adDailyReportBtn: document.getElementById("adDailyReportBtn"),
  adWeeklyReportBtn: document.getElementById("adWeeklyReportBtn"),
  adReportsList: document.getElementById("adReportsList"),
  adNotificationTotal: document.getElementById("adNotificationTotal"),
  adNotificationMandatory: document.getElementById("adNotificationMandatory"),
  adNotificationProposal: document.getElementById("adNotificationProposal"),
  adNotificationLineFilter: document.getElementById("adNotificationLineFilter"),
  adNotificationDateSort: document.getElementById("adNotificationDateSort"),
  adNotificationsList: document.getElementById("adNotificationsList"),
  adDetailModal: document.getElementById("adDetailModal"),
  adDetailCloseBtn: document.getElementById("adDetailCloseBtn"),
  adDetailCancelBtn: document.getElementById("adDetailCancelBtn"),
  adDetailTitle: document.getElementById("adDetailTitle"),
  adDetailDocument: document.getElementById("adDetailDocument"),
  adDetailMeta: document.getElementById("adDetailMeta"),
  adDetailContent: document.getElementById("adDetailContent"),
  adDetailSourceLink: document.getElementById("adDetailSourceLink"),
  sidebarDynamicAreas: document.getElementById("sidebarDynamicAreas"),
  publicationTotalNodes: document.getElementById("publicationTotalNodes"),
  publicationNetworkTitle: document.getElementById("publicationNetworkTitle"),
  publicationShell: document.getElementById("publicationShell"),
  publicationCanvas: document.getElementById("publicationCanvas"),
  publicationLinks: document.getElementById("publicationLinks"),
  publicationNodes: document.getElementById("publicationNodes"),
  publicationMenuBtn: document.getElementById("publicationMenuBtn"),
  publicationInfoPanel: document.getElementById("publicationInfoPanel"),
  publicationResetViewBtn: document.getElementById("publicationResetViewBtn"),
  publicationSearch: document.getElementById("publicationSearch"),
  publicationFilterFq: document.getElementById("publicationFilterFq"),
  publicationFilterIt: document.getElementById("publicationFilterIt"),
  publicationFilterPrq: document.getElementById("publicationFilterPrq"),
  publicationNodeForm: document.getElementById("publicationNodeForm"),
  publicationType: document.getElementById("publicationType"),
  publicationCode: document.getElementById("publicationCode"),
  publicationTitle: document.getElementById("publicationTitle"),
  publicationSector: document.getElementById("publicationSector"),
  publicationLinkTo: document.getElementById("publicationLinkTo"),
  publicationSource: document.getElementById("publicationSource"),
  publicationTarget: document.getElementById("publicationTarget"),
  publicationAddLinkBtn: document.getElementById("publicationAddLinkBtn"),
  publicationDeleteSelectedBtn: document.getElementById("publicationDeleteSelectedBtn"),
  publicationIntensity: document.getElementById("publicationIntensity"),
  publicationNodeSize: document.getElementById("publicationNodeSize"),
  publicationLineWidth: document.getElementById("publicationLineWidth"),
  publicationLabelsToggle: document.getElementById("publicationLabelsToggle"),
  publicationAnimateBtn: document.getElementById("publicationAnimateBtn"),
  workspace: document.querySelector(".workspace")
};

let data = [];
let historicoGlobal = [];
let chart;
let chartPizza;
let activeAircraftFilter = "all";
let editingItemId = null;
let activeModalItems = [];
let adminUnlocked = sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "true";
let dynamicSiteAreas = loadStoredAdminAreas();
let adminReminders = loadStoredReminders();
let adminHistory = loadStoredAdminHistory();
let adminUsers = [];
let publicationNetwork = loadStoredPublicationNetwork();
let publicationConfig = loadStoredPublicationConfig();
let selectedPublicationId = publicationNetwork.nodes[0]?.id || null;
let publicationAnimationFrame = null;
let publicationFloatFrame = null;
let publicationFloatLastTime = 0;
let publicationDraggedNodeId = null;
let publicationPhysicsNodes = new Map();
// Elementos <line> já anexados ao SVG, indexados por link, reaproveitados a cada
// frame de animação (evita recriar centenas/milhares de elementos 60x por segundo).
let publicationLinkElements = new Map();
let documentImportState = createEmptyDocumentImportState();
let adMonitorState = loadStoredAdMonitorState();
let adReports = loadStoredAdReports();
let adMonitorInterval = null;
let areaBuilderMode = "create";
let editingAreaId = null;
let areaBuilderLinks = [...DEFAULT_AREA_BUILDER_LINKS];
let areaBuilderSelectedNode = null;
let areaBuilderFields = [];
let areaBuilderRows = [];
let areaBuilderSourceDetails = {};
let areaBuilderNodePositions = {};
let areaBuilderComponents = {
  inputs: [],
  outputs: [],
  charts: []
};
let areaBuilderPendingPointer = null;

function prepareStaticShells() {
  // O dashboard antigo e parcialmente estatico e substituido por uma estrutura unica.
  const dashboard = document.getElementById("dashboard");
  if (dashboard) {
    dashboard.innerHTML = `
      <div class="dashboard-page">
        <div class="dashboard-topbar">
          <div>
            <p class="eyebrow">Dashboard</p>
            <h1>Quarentena e saídas</h1>
          </div>
          <div class="dashboard-total">
            <span id="metric_total_saidas">0</span>
            <small>peças saíram</small>
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
              <span>Saídas registradas</span>
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
              <span>Ainda sem saída</span>
              <strong id="metric_sem_saida">0</strong>
            </div>
          </article>
        </div>

        <div class="dashboard-grid">
          <section class="dashboard-panel chart-panel">
            <div class="panel-heading">
              <h3>Saídas por linha</h3>
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
              <h3>Situação dos itens</h3>
              <span>saída x aguardando</span>
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
          <span id="itemsAircraftMeta">Nomenclatura, P/N e saída</span>
        </div>
        <div class="items-stats">
          <div>
            <span>Total</span>
            <strong id="itemsTotal">0</strong>
          </div>
          <div>
            <span>Com saída</span>
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
        <button type="button" id="rabInfoCloseBtn" class="modal-close" aria-label="Fechar informações">x</button>
        <div id="rabInfoTitle" class="notititle">Prefixo</div>
        <div class="notibody items-summary">
          <strong>Informações da aeronave</strong>
          <span id="rabInfoSubtitle">Consulta no Registro Aeronáutico Brasileiro</span>
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
    setLoginMessage("Preencha e-mail e senha para criar o usuário.", "error");
    return;
  }

  setLoginLoading(true);
  setLoginMessage("Criando usuário...", "info");

  try {
    await createUserWithEmailAndPassword(auth, email, senha);
    setLoginMessage("Usuário criado. Entrando...", "success");
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
  await saveCurrentUserPresence(user);
  await carregarDados();
  el.loaderScreen.style.display = "none";
});

async function carregarDados() {
  try {
    const snap = await getDocs(collection(db, "pecas"));
    data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    await carregarHistorico();
    await carregarUsuariosAdmin();
    renderTable();
    updateDashboard();
    await carregarAdMonitor();
  } catch {
    alert("Erro ao carregar dados");
  }
}

async function saveCurrentUserPresence(user) {
  try {
    const now = new Date();
    await setDoc(doc(db, "usuarios", user.uid), {
      email: user.email || "sem email",
      ultimoOnline: now.toLocaleString("pt-BR"),
      ultimoOnlineISO: now.toISOString()
    }, { merge: true });
  } catch {
    // Se a regra do Firestore bloquear, o login continua funcionando normalmente.
  }
}

async function carregarUsuariosAdmin() {
  try {
    const snap = await getDocs(collection(db, "usuarios"));
    adminUsers = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch {
    adminUsers = [];
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
el.adminAccessBtn?.addEventListener("click", requestAdminAccess);
el.adminGateForm?.addEventListener("submit", handleAdminGateSubmit);
el.adminGateCloseBtn?.addEventListener("click", closeAdminGate);
el.adminGateCancelBtn?.addEventListener("click", closeAdminGate);
el.adminGateModal?.addEventListener("click", (event) => {
  if (event.target === el.adminGateModal) closeAdminGate();
});
el.adminReminderForm?.addEventListener("submit", handleCreateReminder);
el.documentImportFile?.addEventListener("change", handleDocumentImportFile);
el.documentImportSheet?.addEventListener("change", handleDocumentImportSheetChange);
[el.documentImportHeaderRow, el.documentImportStartRow, el.documentImportEndRow]
  .filter(Boolean)
  .forEach((input) => input.addEventListener("input", updateDocumentImportPreview));
el.documentImportMapping?.addEventListener("change", updateDocumentImportPreview);
el.documentImportApplyBtn?.addEventListener("click", applyDocumentImportToNetwork);
el.documentImportClearBtn?.addEventListener("click", clearDocumentImport);
el.adRefreshBtn?.addEventListener("click", () => runAdSearch({ automatic: false }));
el.adSearchFilter?.addEventListener("input", renderAdResults);
el.adLineFilter?.addEventListener("change", renderAdResults);
el.adDateSort?.addEventListener("change", renderAdResults);
el.adNotificationLineFilter?.addEventListener("change", renderAdNotifications);
el.adNotificationDateSort?.addEventListener("change", renderAdNotifications);
el.adDailyReportBtn?.addEventListener("click", () => {
  createAdReport("daily", true);
  renderAdMonitor();
});
el.adWeeklyReportBtn?.addEventListener("click", () => {
  createAdReport("weekly", true);
  renderAdMonitor();
});
el.adDetailCloseBtn?.addEventListener("click", closeAdDetail);
el.adDetailCancelBtn?.addEventListener("click", closeAdDetail);
el.adDetailModal?.addEventListener("click", (event) => {
  if (event.target === el.adDetailModal) closeAdDetail();
});
el.publicationNodeForm?.addEventListener("submit", handlePublicationNodeSubmit);
el.publicationAddLinkBtn?.addEventListener("click", handlePublicationAddLink);
el.publicationDeleteSelectedBtn?.addEventListener("click", deleteSelectedPublication);
el.publicationResetViewBtn?.addEventListener("click", resetPublicationLayout);
el.publicationMenuBtn?.addEventListener("click", togglePublicationMenu);
el.publicationAnimateBtn?.addEventListener("click", animatePublicationNetwork);
el.publicationSearch?.addEventListener("input", handlePublicationConfigChange);
[el.publicationFilterFq, el.publicationFilterIt, el.publicationFilterPrq]
  .filter(Boolean)
  .forEach((input) => input.addEventListener("change", handlePublicationConfigChange));
[el.publicationIntensity, el.publicationNodeSize, el.publicationLineWidth, el.publicationLabelsToggle]
  .filter(Boolean)
  .forEach((input) => input.addEventListener("input", handlePublicationConfigChange));
el.filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    activeAircraftFilter = chip.dataset.aircraftFilter || "all";
    el.filterChips.forEach((item) => item.classList.toggle("active", item === chip));
    renderTable();
  });
});
window.addEventListener("resize", () => {
  if (document.getElementById("publicacoes")?.classList.contains("active")) renderPublicationNetwork();
});

renderAdminShell();
initPublicationNetwork();
initAdMonitor();

function requestAdminAccess() {
  if (adminUnlocked) {
    window.showTab("admin");
    return;
  }
  openAdminGate();
}

function openAdminGate() {
  if (!el.adminGateModal) return;
  el.adminGateModal.hidden = false;
  if (el.adminPassword) el.adminPassword.value = "";
  setAdminGateMessage("", "info");
  setTimeout(() => el.adminPassword?.focus(), 0);
}

function closeAdminGate() {
  if (el.adminGateModal) el.adminGateModal.hidden = true;
}

async function handleAdminGateSubmit(event) {
  event.preventDefault();
  const password = el.adminPassword?.value || "";
  const passwordHash = await hashAdminPassword(password);

  // O código guarda somente o hash; a senha em texto não fica exposta no arquivo.
  if (passwordHash !== ADMIN_PASSWORD_HASH) {
    setAdminGateMessage("Senha administrativa incorreta.", "error");
    return;
  }

  adminUnlocked = true;
  sessionStorage.setItem(ADMIN_UNLOCK_KEY, "true");
  closeAdminGate();
  window.showTab("admin");
}

async function hashAdminPassword(value) {
  if (!window.crypto?.subtle) return "";
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function setAdminGateMessage(message, type = "info") {
  if (!el.adminGateMessage) return;
  el.adminGateMessage.textContent = message;
  el.adminGateMessage.className = `edit-message ${type}`;
}

function createEmptyDocumentImportState() {
  return {
    workbook: null,
    fileName: "",
    sheetName: "",
    rows: [],
    columns: [],
    records: [],
    mappedRecords: [],
    headerSignature: ""
  };
}

async function handleDocumentImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    if (!window.XLSX) throw new Error("Biblioteca XLSX indisponível.");

    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array", cellDates: true });
    const sheetName = workbook.SheetNames[0] || "";

    documentImportState = {
      ...createEmptyDocumentImportState(),
      workbook,
      fileName: file.name,
      sheetName
    };

    renderDocumentSheetOptions();
    syncDocumentImportDefaultRows();
    updateDocumentImportPreview();
    setDocumentImportMessage(`Arquivo ${file.name} carregado. Escolha linhas e colunas para gerar a rede.`, "info");
  } catch (error) {
    console.error(error);
    documentImportState = createEmptyDocumentImportState();
    renderDocumentSheetOptions();
    renderDocumentImportEmptyState("Não foi possível ler o Excel.");
    setDocumentImportMessage("Não foi possível ler o arquivo. Confira se é .xlsx, .xls ou .csv.", "error");
  }
}

function handleDocumentImportSheetChange() {
  documentImportState.sheetName = el.documentImportSheet?.value || documentImportState.sheetName;
  documentImportState.headerSignature = "";
  syncDocumentImportDefaultRows();
  updateDocumentImportPreview();
}

function renderDocumentSheetOptions() {
  if (!el.documentImportSheet) return;

  const names = documentImportState.workbook?.SheetNames || [];
  el.documentImportSheet.innerHTML = names.length
    ? names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")
    : "<option value=\"\">Nenhuma aba carregada</option>";

  if (documentImportState.sheetName) el.documentImportSheet.value = documentImportState.sheetName;
}

function syncDocumentImportDefaultRows() {
  const rows = getDocumentSheetRows();
  const headerIndex = findDocumentHeaderIndex(rows);
  const firstDataRow = Math.min(headerIndex + 2, Math.max(rows.length, 1));

  if (el.documentImportHeaderRow) el.documentImportHeaderRow.value = String(headerIndex + 1);
  if (el.documentImportStartRow) el.documentImportStartRow.value = String(firstDataRow);
  if (el.documentImportEndRow) el.documentImportEndRow.value = "";
}

function updateDocumentImportPreview() {
  if (!documentImportState.workbook) {
    renderDocumentImportEmptyState("Selecione um Excel para iniciar.");
    return;
  }

  const rows = getDocumentSheetRows();
  const headerIndex = clampInteger(Number(el.documentImportHeaderRow?.value || 1) - 1, 0, Math.max(rows.length - 1, 0));
  const columns = buildDocumentColumns(rows[headerIndex] || []);
  const previousMapping = getDocumentImportMapping();
  const signature = columns.map((column) => `${column.index}:${column.label}`).join("|");

  documentImportState.rows = rows;
  documentImportState.columns = columns;

  if (signature !== documentImportState.headerSignature) {
    renderDocumentMappingControls(columns, previousMapping);
    documentImportState.headerSignature = signature;
  }

  const startIndex = clampInteger(Number(el.documentImportStartRow?.value || headerIndex + 2) - 1, headerIndex + 1, Math.max(rows.length - 1, headerIndex + 1));
  const requestedEnd = Number(el.documentImportEndRow?.value || rows.length);
  const endIndex = clampInteger(requestedEnd - 1, startIndex, Math.max(rows.length - 1, startIndex));

  documentImportState.records = rows
    .map((row, index) => ({ row, rowNumber: index + 1 }))
    .slice(startIndex, endIndex + 1)
    .filter((record) => record.row.some((cell) => cleanTextLine(cell)));

  documentImportState.mappedRecords = buildDocumentMappedRecords();
  renderDocumentImportStats();
  renderDocumentImportPreview();
}

function getDocumentSheetRows() {
  const workbook = documentImportState.workbook;
  const sheetName = documentImportState.sheetName || workbook?.SheetNames?.[0] || "";
  const sheet = workbook?.Sheets?.[sheetName];
  if (!sheet || !window.XLSX) return [];
  documentImportState.sheetName = sheetName;
  return window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
}

function findDocumentHeaderIndex(rows) {
  const index = rows.findIndex((row) => row.filter((cell) => cleanTextLine(cell)).length >= 2);
  return index >= 0 ? index : 0;
}

function buildDocumentColumns(headerRow) {
  return headerRow
    .map((cell, index) => ({
      index,
      label: cleanTextLine(cell) || `Coluna ${index + 1}`
    }))
    .filter((column) => column.label || column.index >= 0);
}

function renderDocumentMappingControls(columns, currentMapping = {}) {
  if (!el.documentImportMapping) return;

  el.documentImportMapping.textContent = "";
  if (!columns.length) {
    const empty = document.createElement("div");
    empty.className = "document-import-empty";
    empty.textContent = "Nenhuma coluna encontrada na linha de cabeçalho.";
    el.documentImportMapping.appendChild(empty);
    return;
  }

  DOCUMENT_IMPORT_FIELDS.forEach((field) => {
    const label = document.createElement("label");
    label.className = "document-map-field";

    const span = document.createElement("span");
    span.textContent = field.label;

    const select = document.createElement("select");
    select.className = "input-custom";
    select.dataset.documentField = field.key;

    const empty = document.createElement("option");
    empty.value = DOCUMENT_IMPORT_EMPTY_OPTION;
    empty.textContent = "Não usar";
    select.appendChild(empty);

    columns.forEach((column) => {
      const option = document.createElement("option");
      option.value = String(column.index);
      option.textContent = column.label;
      select.appendChild(option);
    });

    const mapped = currentMapping[field.key] ?? pickDocumentColumn(columns, field.aliases, field.key === "documento");
    select.value = mapped !== "" && mapped !== undefined ? String(mapped) : DOCUMENT_IMPORT_EMPTY_OPTION;

    label.append(span, select);
    el.documentImportMapping.appendChild(label);
  });
}

function getDocumentImportMapping() {
  return Array.from(el.documentImportMapping?.querySelectorAll("[data-document-field]") || [])
    .reduce((mapping, select) => {
      mapping[select.dataset.documentField] = select.value === DOCUMENT_IMPORT_EMPTY_OPTION ? "" : select.value;
      return mapping;
    }, {});
}

function pickDocumentColumn(columns, aliases, exactOnly = false) {
  const normalizedAliases = aliases.map(normalizeSpreadsheetFieldName);
  const direct = columns.find((column) => normalizedAliases.includes(normalizeSpreadsheetFieldName(column.label)));
  if (direct) return String(direct.index);
  if (exactOnly) return "";

  const partial = columns.find((column) => {
    const normalized = normalizeSpreadsheetFieldName(column.label);
    return normalizedAliases.some((alias) => normalized.includes(alias) || alias.includes(normalized));
  });

  return partial ? String(partial.index) : "";
}

function buildDocumentMappedRecords() {
  const mapping = getDocumentImportMapping();
  return documentImportState.records
    .map((record) => ({
      rowNumber: record.rowNumber,
      values: DOCUMENT_IMPORT_FIELDS.reduce((values, field) => {
        values[field.key] = getDocumentImportCell(record.row, mapping[field.key]);
        return values;
      }, {})
    }))
    .filter((record) => Object.values(record.values).some(Boolean));
}

function getDocumentImportCell(row, columnIndex) {
  if (columnIndex === "" || columnIndex === undefined) return "";
  return cleanTextLine(row[Number(columnIndex)]);
}

function renderDocumentImportStats() {
  if (!el.documentImportStats) return;
  el.documentImportStats.textContent = "";

  const records = documentImportState.mappedRecords || [];
  const validRecords = records.filter((record) => record.values.codigoDocumento || record.values.nomeDocumento);
  const sectors = new Set(validRecords.map((record) => record.values.setor).filter(Boolean));
  const revised = validRecords.filter((record) => record.values.revisoes).length;

  [
    ["Linhas selecionadas", records.length],
    ["Documentos válidos", validRecords.length],
    ["Setores", sectors.size],
    ["Com revisão", revised]
  ].forEach(([label, value]) => {
    const item = document.createElement("span");
    item.textContent = `${label}: ${value}`;
    el.documentImportStats.appendChild(item);
  });
}

function renderDocumentImportPreview() {
  if (!el.documentImportPreview) return;
  el.documentImportPreview.textContent = "";

  const records = documentImportState.mappedRecords || [];
  if (!records.length) {
    renderDocumentImportEmptyState("Nenhuma linha mapeada para prévia.");
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  const headRow = document.createElement("tr");

  ["Linha", ...DOCUMENT_IMPORT_FIELDS.map((field) => field.label)].forEach((labelText) => {
    const th = document.createElement("th");
    th.textContent = labelText;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  records.slice(0, 12).forEach((record) => {
    const tr = document.createElement("tr");
    const rowNumber = document.createElement("td");
    rowNumber.textContent = String(record.rowNumber);
    tr.appendChild(rowNumber);

    DOCUMENT_IMPORT_FIELDS.forEach((field) => {
      const td = document.createElement("td");
      td.textContent = record.values[field.key] || "-";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  el.documentImportPreview.appendChild(table);

  if (records.length > 12) {
    const more = document.createElement("div");
    more.className = "document-preview-more";
    more.textContent = `Prévia mostrando 12 de ${records.length} linhas.`;
    el.documentImportPreview.appendChild(more);
  }
}

function renderDocumentImportEmptyState(message) {
  if (el.documentImportStats) el.documentImportStats.textContent = "";
  if (!el.documentImportPreview) return;
  el.documentImportPreview.textContent = "";
  const empty = document.createElement("div");
  empty.className = "document-import-empty";
  empty.textContent = message;
  el.documentImportPreview.appendChild(empty);
}

function applyDocumentImportToNetwork() {
  updateDocumentImportPreview();
  const records = documentImportState.mappedRecords || [];
  const documents = records
    .map((record) => ({ rowNumber: record.rowNumber, ...record.values }))
    .filter((record) => record.codigoDocumento || record.nomeDocumento);

  if (!documents.length) {
    setDocumentImportMessage("Mapeie pelo menos Código do documento ou Nome do documento antes de gerar a rede.", "error");
    return;
  }

  const before = cloneAdminState(publicationNetwork);
  const nodes = createPublicationNodesFromDocumentRows(documents);
  const links = createPublicationLinksFromDocumentRows(nodes);

  publicationNetwork = normalizePublicationNetwork({ nodes, links });
  selectedPublicationId = publicationNetwork.nodes[0]?.id || null;
  savePublicationNetwork();
  syncPublicationPhysicsState();
  renderPublicationNetwork();
  recordAdminHistory("publication:import", "Rede importada do Excel", before, publicationNetwork);
  renderAdminHistory();
  renderAdminPanel();
  setDocumentImportMessage(`${publicationNetwork.nodes.length} documentos importados para a rede técnica.`, "info");
}

function createPublicationNodesFromDocumentRows(documents) {
  const usedIds = new Set();
  const total = Math.max(1, documents.length);

  return documents.map((record, index) => {
    const code = cleanTextLine(record.codigoDocumento || `DOC-${record.rowNumber || index + 1}`);
    const title = cleanTextLine(record.nomeDocumento || code);
    const type = inferPublicationType(record.documento, code);
    const angle = (index / total) * Math.PI * 2;
    const radius = documents.length > 8 ? 35 : 29;
    const id = uniqueDocumentImportId(slugifyAreaName(`${type}-${code}`), usedIds);

    return {
      id,
      type,
      code,
      title,
      documento: cleanTextLine(record.documento || type),
      sector: cleanTextLine(record.setor || "Publicações"),
      adjacentSector: cleanTextLine(record.setorAdjacente || ""),
      developedBy: cleanTextLine(record.desenvolvidoPor || ""),
      revisions: cleanTextLine(record.revisoes || ""),
      sourceFile: documentImportState.fileName,
      sourceSheet: documentImportState.sheetName,
      sourceRow: record.rowNumber,
      x: clampNumber(50 + Math.cos(angle) * radius, 8, 92),
      y: clampNumber(52 + Math.sin(angle) * radius, 10, 90)
    };
  });
}

// Suporta redes grandes (milhares de documentos): indexa por setor em vez de
// comparar cada nó com todos os outros (O(n) em vez de O(n²)).
const PUBLICATION_LINKS_MAX_PER_NODE = 20;

function createPublicationLinksFromDocumentRows(nodes) {
  const links = [];
  const seen = new Set();

  const addLink = (from, to) => {
    if (!from || !to || from === to) return;
    const key = [from, to].sort().join(":");
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ from, to });
  };

  const bySector = new Map();
  nodes.forEach((node) => {
    const key = normalizeSpreadsheetFieldName(node.sector || "Publicações");
    if (!bySector.has(key)) bySector.set(key, []);
    bySector.get(key).push(node);
  });

  nodes.forEach((node) => {
    const adjacentSectors = splitDocumentImportList(node.adjacentSector).map(normalizeSpreadsheetFieldName);
    adjacentSectors.forEach((sectorKey) => {
      const targets = bySector.get(sectorKey);
      if (!targets) return;
      // Limita conexões por nó: um documento não precisa (nem é útil visualmente)
      // linkar com centenas de outros do mesmo setor.
      targets.slice(0, PUBLICATION_LINKS_MAX_PER_NODE).forEach((target) => addLink(node.id, target.id));
    });
  });

  if (!links.length) {
    bySector.forEach((group) => {
      group.slice(1).forEach((node) => addLink(group[0].id, node.id));
    });
  }

  return links;
}

function inferPublicationType(documento, code) {
  const text = normalizeText(`${documento || ""} ${code || ""}`);
  if (text.includes("PRQ")) return "PRQ";
  if (text.includes("IT")) return "IT";
  if (text.includes("FQ")) return "FQ";
  return "FQ";
}

function uniqueDocumentImportId(baseId, usedIds) {
  const base = baseId || `documento-${Date.now()}`;
  let id = base;
  let index = 2;
  while (usedIds.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  usedIds.add(id);
  return id;
}

function splitDocumentImportList(value) {
  return String(value || "")
    .split(/[;,|/]+/)
    .map(cleanTextLine)
    .filter(Boolean);
}

function clearDocumentImport() {
  documentImportState = createEmptyDocumentImportState();
  if (el.documentImportFile) el.documentImportFile.value = "";
  if (el.documentImportHeaderRow) el.documentImportHeaderRow.value = "1";
  if (el.documentImportStartRow) el.documentImportStartRow.value = "2";
  if (el.documentImportEndRow) el.documentImportEndRow.value = "";
  renderDocumentSheetOptions();
  if (el.documentImportMapping) el.documentImportMapping.textContent = "";
  renderDocumentImportEmptyState("Selecione um Excel para iniciar.");
  setDocumentImportMessage("", "info");
}

function setDocumentImportMessage(message, type = "info") {
  if (!el.documentImportMessage) return;
  el.documentImportMessage.textContent = message;
  el.documentImportMessage.className = `edit-message ${type}`;
}

async function carregarAdMonitor() {
  try {
    const snap = await getDocs(collection(db, "ad_monitor"));
    const current = snap.docs.find((item) => item.id === "current") || snap.docs[0];
    if (current) {
      adMonitorState = normalizeAdMonitorState(current.data());
      saveStoredAdMonitorState();
    }
  } catch {
    // Quando a coleção remota ainda não existe, a tela usa o pacote local inicial.
  }

  try {
    const reportsSnap = await getDocs(collection(db, "ad_reports"));
    const remoteReports = reportsSnap.docs
      .map((item) => normalizeAdReport({ id: item.id, ...item.data() }))
      .filter(Boolean);
    if (remoteReports.length) {
      adReports = mergeAdReports(adReports, remoteReports);
      saveStoredAdReports();
    }
  } catch {
    // Relatórios locais continuam disponíveis quando o Firestore ainda não foi populado.
  }

  ensureAdReports();
  renderAdMonitor();
}

function initAdMonitor() {
  ensureAdReports();
  renderAdMonitor();
  scheduleAdMonitor();
}

function scheduleAdMonitor() {
  if (adMonitorInterval) window.clearInterval(adMonitorInterval);

  adMonitorInterval = window.setInterval(() => {
    if (isAdSearchExpired()) runAdSearch({ automatic: true });
    ensureAdReports();
    renderAdMonitor();
  }, 60 * 1000);
}

function isAdSearchExpired() {
  const lastRun = new Date(adMonitorState.lastRunISO || 0).getTime();
  return !lastRun || Date.now() - lastRun >= AD_SEARCH_INTERVAL_MS;
}

async function runAdSearch({ automatic = false } = {}) {
  if (el.adRefreshBtn) {
    el.adRefreshBtn.disabled = true;
    el.adRefreshBtn.textContent = "Pesquisando...";
  }

  const startedAt = new Date();
  const backendMonitor = await runAdBackendSearch();

  if (backendMonitor) {
    adMonitorState = normalizeAdMonitorState(backendMonitor);
    saveStoredAdMonitorState();
    ensureAdReports();
    renderAdMonitor();

    if (el.adRefreshBtn) {
      el.adRefreshBtn.disabled = false;
      el.adRefreshBtn.textContent = "Atualizar agora";
    }
    return;
  }

  const officialSearch = await searchOfficialAdSourcesFromBrowser();

  // Se a Function ainda não estiver implantada, o navegador tenta API pública e páginas oficiais com proxy de leitura.
  adMonitorState = normalizeAdMonitorState({
    ...adMonitorState,
    lastRunISO: startedAt.toISOString(),
    nextRunISO: new Date(startedAt.getTime() + AD_SEARCH_INTERVAL_MS).toISOString(),
    mode: automatic ? "automática" : "manual",
    sources: officialSearch.sources,
    findings: mergeAdFindings(adMonitorState.findings, DEFAULT_AD_FINDINGS, officialSearch.findings)
  });

  saveStoredAdMonitorState();
  await saveAdMonitorToFirestore();
  ensureAdReports();
  renderAdMonitor();

  if (el.adRefreshBtn) {
    el.adRefreshBtn.disabled = false;
    el.adRefreshBtn.textContent = "Atualizar agora";
  }
}

async function runAdBackendSearch() {
  if (!["http:", "https:"].includes(window.location.protocol)) return null;

  try {
    const response = await fetch("/api/run-ad-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "site" })
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.monitor || payload;
  } catch {
    return null;
  }
}

async function searchOfficialAdSourcesFromBrowser() {
  const results = await Promise.all([
    searchAnacAdsFromBrowser(),
    searchFaaAdsFromBrowser(),
    searchEasaAdsFromBrowser()
  ]);

  return {
    sources: results.map((result) => result.source),
    findings: results.flatMap((result) => result.findings)
  };
}

async function searchAnacAdsFromBrowser() {
  const pages = await Promise.all(getAnacScanUrls().map(fetchAdTextAttempt));
  const findings = pages
    .filter((page) => page.ok)
    .flatMap((page) => extractAnacAdFindings(page.text, page.url));
  const checkedAt = new Date().toISOString();
  const successCount = pages.filter((page) => page.ok).length;
  const noRecentDa = pages.some((page) => normalizeText(page.text).includes("NAO EXISTE DA"));

  return {
    source: {
      authority: "ANAC",
      url: AD_SOURCE_URLS.ANAC,
      checkedAt,
      tone: findings.length ? "ok" : noRecentDa ? "empty" : successCount ? "empty" : "warning",
      status: findings.length ? `${findings.length} DAs compatíveis` : noRecentDa ? "Sem novas DAs" : successCount ? "Sem termo da EO" : "Leitura bloqueada",
      message: findings.length
        ? "Busca alternativa: páginas recentes e relatórios quinzenais da ANAC foram lidos com termos do escopo HBR."
        : noRecentDa
          ? "Busca alternativa: a ANAC indicou ausência de DAs brasileiras recentes nas páginas consultadas."
          : successCount
            ? "Busca alternativa: páginas da ANAC responderam, mas sem termos diretos da EO HBR."
            : "Busca alternativa: o navegador não conseguiu ler a ANAC nesta tentativa."
    },
    findings
  };
}

function getAnacScanUrls() {
  const urls = new Set(ANAC_SCAN_URLS);
  const today = new Date();

  for (let offset = 0; offset < 6; offset += 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const secondHalfSeq = month * 2 - 2;
    const firstHalfSeq = month * 2 - 1;

    if (secondHalfSeq > 0) {
      urls.add(`https://sistemas.anac.gov.br/certificacao/DA/DA_BiweeklyList.asp?Ano=${year}&Mes=${month}&Q=0&Seq=${secondHalfSeq}`);
    }
    urls.add(`https://sistemas.anac.gov.br/certificacao/DA/DA_BiweeklyList.asp?Ano=${year}&Mes=${month}&Q=1&Seq=${firstHalfSeq}`);
  }

  return [...urls];
}

async function searchFaaAdsFromBrowser() {
  const attempts = await Promise.all(FAA_SEARCH_TERMS.map(searchFederalRegisterFromBrowser));
  const documents = uniqueAdBy(
    attempts.filter((attempt) => attempt.ok).flatMap((attempt) => attempt.documents),
    (document) => document.document_number || document.html_url || document.title
  );
  const findings = documents.map(createFaaAdFinding).filter(Boolean);
  const checkedAt = new Date().toISOString();
  const successCount = attempts.filter((attempt) => attempt.ok).length;

  return {
    source: {
      authority: "FAA",
      url: AD_SOURCE_URLS.FAA,
      checkedAt,
      tone: findings.length ? "ok" : successCount ? "empty" : "warning",
      status: findings.length ? `${findings.length} registros FAA` : successCount ? "Sem termo da EO" : "Leitura bloqueada",
      message: findings.length
        ? "Busca alternativa: Federal Register API retornou documentos FAA estruturados, com DRS mantido como conferência."
        : successCount
          ? "Busca alternativa: Federal Register respondeu, mas sem novo registro compatível com a EO HBR."
          : "Busca alternativa: a API pública do Federal Register não respondeu nesta tentativa."
    },
    findings
  };
}

async function searchEasaAdsFromBrowser() {
  const pages = await Promise.all(EASA_SCAN_URLS.map(fetchAdTextAttempt));
  const findings = uniqueAdBy(
    pages
      .filter((page) => page.ok)
      .flatMap((page) => extractEasaAdFindings(page.text, page.url)),
    (finding) => finding.id
  );
  const checkedAt = new Date().toISOString();
  const successCount = pages.filter((page) => page.ok).length;

  return {
    source: {
      authority: "EASA",
      url: AD_SOURCE_URLS.EASA,
      checkedAt,
      tone: findings.length ? "ok" : successCount ? "empty" : "warning",
      status: findings.length ? `${findings.length} registros EASA` : successCount ? "Sem termo da EO" : "Leitura bloqueada",
      message: findings.length
        ? "Busca alternativa: páginas recentes e busca por palavras-chave do Safety Publications Tool retornaram documentos compatíveis."
        : successCount
          ? "Busca alternativa: EASA respondeu, mas não trouxe novo registro compatível com a EO HBR."
          : "Busca alternativa: o navegador não conseguiu ler a EASA nesta tentativa."
    },
    findings
  };
}

async function searchFederalRegisterFromBrowser(term) {
  const documentTypes = ["RULE", "PRORULE"];
  const attempts = await Promise.all(documentTypes.map((type) => {
    const params = new URLSearchParams();
    params.set("per_page", "20");
    params.set("order", "newest");
    params.set("conditions[term]", term);
    params.append("conditions[agencies][]", "federal-aviation-administration");
    params.append("conditions[type][]", type);
    return fetchAdJsonAttempt(`https://www.federalregister.gov/api/v1/documents.json?${params.toString()}`);
  }));

  return {
    ok: attempts.some((attempt) => attempt.ok),
    documents: attempts.filter((attempt) => attempt.ok).flatMap((attempt) => attempt.json.results || [])
  };
}

async function fetchAdTextAttempt(url) {
  try {
    return { ok: true, url, text: await fetchAdText(url) };
  } catch (error) {
    return { ok: false, url, text: "", error };
  }
}

async function fetchAdJsonAttempt(url) {
  try {
    return { ok: true, url, json: await fetchAdJson(url) };
  } catch (error) {
    return { ok: false, url, json: {}, error };
  }
}

async function fetchAdText(url) {
  try {
    return await fetchAdRawText(url);
  } catch {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    return fetchAdRawText(proxyUrl);
  }
}

async function fetchAdRawText(url) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 14000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return responseToText(response);
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchAdJson(url) {
  const text = await fetchAdText(url);
  return JSON.parse(text.trim());
}

function createFaaAdFinding(document) {
  const text = `${document.title || ""} ${document.abstract || ""} ${(document.docket_ids || []).join(" ")}`;
  if (!hasAdScopeTerm(text) || !normalizeText(text).includes("AIRWORTHINESS DIRECTIVES")) return null;
  const type = document.type === "PRORULE" ? "AD NPRM" : "AD";
  const number = cleanTextLine((document.docket_ids || [])[0] || document.document_number || document.title || "");
  if (!number) return null;

  return normalizeAdFinding({
    id: `faa-${normalizeAdKey(number)}`,
    authority: "FAA",
    number,
    type,
    issueDate: cleanTextLine(document.publication_date || ""),
    effectiveDate: "",
    holder: inferAdHolder(text),
    model: inferAdModel(text),
    subject: cleanTextLine(document.title || "Airworthiness Directives"),
    match: buildAdScopeMatch(text),
    status: type === "AD" ? "Aplicável ao escopo" : "Proposta para análise",
    sourceUrl: cleanTextLine(document.html_url || document.pdf_url || ""),
    identified: cleanTextLine(stripAdHtml(document.abstract || document.title || "")),
    treatment: type === "AD"
      ? "Validar aplicabilidade por produto e cumprir os prazos e ações estabelecidos no registro oficial FAA."
      : "Acompanhar o prazo de comentários, avaliar impacto técnico preliminar e monitorar a emissão da regra final."
  });
}

function extractEasaAdFindings(html, pageUrl) {
  return splitAdPublicationBlocks(stripAdHtml(html))
    .map((block) => createEasaAdFinding(block, pageUrl))
    .filter(Boolean);
}

function createEasaAdFinding(block) {
  if (!hasAdScopeTerm(block)) return null;
  const number = getAdDocumentNumber(block);
  if (!number) return null;
  const dates = getAdDates(block);
  const subject = extractAdSubject(block) || "Safety Publication";
  const type = normalizeText(subject).includes("PROPOSED AD") || /^\d{2}-\d{3}$/.test(number) ? "PAD" : "AD";

  return normalizeAdFinding({
    id: `easa-${normalizeAdKey(number)}`,
    authority: "EASA",
    number,
    type,
    issueDate: dates[0] || "",
    effectiveDate: dates[1] || "",
    holder: inferAdHolder(block),
    model: inferAdModel(block),
    subject: cleanTextLine(subject.replace(/^Image:\s*/i, "")),
    match: buildAdScopeMatch(block),
    status: type === "PAD" ? "Novo para análise" : "Aplicável ao escopo",
    sourceUrl: `https://ad.easa.europa.eu/ad/${encodeURIComponent(number)}`,
    identified: `Publicação EASA relacionada a ${cleanTextLine(subject)}.`,
    treatment: type === "PAD"
      ? "Acompanhar consulta da proposta e preparar avaliação de impacto para Publicações e Qualidade."
      : "Verificar efetividade, aplicabilidade por modelo e ação mandatória antes de liberar tratativa interna."
  });
}

function extractAnacAdFindings(html, pageUrl) {
  const text = stripAdHtml(html);
  if (normalizeText(text).includes("NAO EXISTE DA")) return [];
  return splitAdPublicationBlocks(text)
    .map((block) => createAnacAdFinding(block, pageUrl))
    .filter(Boolean);
}

function createAnacAdFinding(block, pageUrl) {
  if (!hasAdScopeTerm(block)) return null;
  const number = getAdDocumentNumber(block);
  if (!number) return null;
  const dates = getAdDates(block);
  const subject = extractAdSubject(block) || "Diretriz de Aeronavegabilidade";

  return normalizeAdFinding({
    id: `anac-${normalizeAdKey(number)}`,
    authority: "ANAC",
    number,
    type: "DA",
    issueDate: dates[0] || "",
    effectiveDate: dates[1] || "",
    holder: inferAdHolder(block),
    model: inferAdModel(block),
    subject: cleanTextLine(subject),
    match: buildAdScopeMatch(block),
    status: "Aplicável ao escopo",
    sourceUrl: pageUrl,
    identified: `DA brasileira com termo compatível com o escopo da EO HBR: ${cleanTextLine(subject)}.`,
    treatment: "Validar aplicabilidade e registrar cumprimento conforme texto oficial da ANAC."
  });
}

function splitAdPublicationBlocks(text) {
  const lines = text.split(/\n+/).map(cleanTextLine).filter(Boolean);
  const blocks = [];
  let current = [];

  lines.forEach((line) => {
    if (isAdDocumentNumberLine(line) && current.length) {
      blocks.push(current.join("\n"));
      current = [line];
      return;
    }
    current.push(line);
  });

  if (current.length) blocks.push(current.join("\n"));
  return blocks;
}

function isAdDocumentNumberLine(line) {
  return Boolean(line.match(/^(?:[A-Z]{1,3}-)?(?:\d{4}-\d{2}-\d{2}[A-Z0-9-]*|\d{4}-\d{4}[A-Z0-9-]*|\d{2}-\d{3})\b/i));
}

function getAdDocumentNumber(text) {
  return cleanTextLine(text.match(/\b(?:[A-Z]{1,3}-)?(?:\d{4}-\d{2}-\d{2}[A-Z0-9-]*|\d{4}-\d{4}[A-Z0-9-]*|\d{2}-\d{3})\b/i)?.[0] || "");
}

function getAdDates(text) {
  return [...text.matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g)].map((match) => match[0]);
}

function extractAdSubject(block) {
  const pipeParts = block.split("|").map(cleanTextLine).filter(Boolean);
  const dateIndex = pipeParts.findIndex((part) => /\b20\d{2}-\d{2}-\d{2}\b/.test(part));
  if (dateIndex >= 0 && pipeParts[dateIndex + 1]) return pipeParts[dateIndex + 1];

  const lines = block.split(/\n+/).map(cleanTextLine).filter(Boolean);
  const issueDateIndex = lines.findIndex((line) => /\b20\d{2}-\d{2}-\d{2}\b/.test(line));
  if (issueDateIndex >= 0 && lines[issueDateIndex + 1]) return lines[issueDateIndex + 1];

  return lines.find((line) => normalizeText(line).includes("AIRWORTHINESS") || normalizeText(line).includes("INSPECTION")) || "";
}

function hasAdScopeTerm(text) {
  const normalized = normalizeText(text);
  return HBR_EO_SCOPE.keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

function buildAdScopeMatch(text) {
  const terms = HBR_EO_SCOPE.keywords.filter((keyword) => normalizeText(text).includes(normalizeText(keyword)));
  return terms.length ? `Termos da EO encontrados: ${terms.slice(0, 4).join(", ")}.` : "Correspondência com o escopo da EO HBR.";
}

function inferAdHolder(text) {
  const normalized = normalizeText(text);
  if (normalized.includes("AIRBUS HELICOPTERS DEUTSCHLAND")) return "Airbus Helicopters Deutschland";
  if (normalized.includes("AIRBUS HELICOPTERS")) return "Airbus Helicopters";
  if (normalized.includes("BELL TEXTRON")) return "Bell Textron";
  if (normalized.includes("LEONARDO")) return "Leonardo S.p.A. Helicopters";
  if (normalized.includes("ROBINSON")) return "Robinson Helicopter Company";
  if (normalized.includes("SAFRAN")) return "Safran Helicopter Engines";
  if (normalized.includes("PRATT")) return "Pratt & Whitney";
  if (normalized.includes("ROLLS-ROYCE")) return "Rolls-Royce";
  if (normalized.includes("HELIBRAS")) return "Helibras";
  return "Fabricante relacionado ao escopo HBR";
}

function inferAdModel(text) {
  const normalized = normalizeText(text);
  const models = [
    ["EC 155", "EC 155"],
    ["EC155", "EC 155"],
    ["AS 365", "AS 365"],
    ["AS-365", "AS 365"],
    ["AS350", "AS 350"],
    ["AS 350", "AS 350"],
    ["AS355", "AS 355"],
    ["AS 355", "AS 355"],
    ["EC130", "EC 130"],
    ["EC 130", "EC 130"],
    ["EC135", "EC135"],
    ["BK 117", "MBB BK 117"],
    ["BK117", "MBB BK 117"],
    ["BELL 407", "Bell 407"],
    ["BELL 429", "Bell 429"],
    ["BELL 505", "Bell 505"],
    ["A109", "A109/AW109"],
    ["AW109", "A109/AW109"],
    ["AW139", "AW139"],
    ["AW169", "AW169"],
    ["R66", "R66"],
    ["R44", "R44"],
    ["R22", "R22"],
    ["ARRIEL", "Arriel"],
    ["ARRIUS", "Arrius"],
    ["PT6", "PT6"],
    ["250-C", "250-C series"]
  ];
  return uniqueAdBy(
    models.filter(([term]) => normalized.includes(term)).map(([, label]) => label),
    (label) => label
  ).join(", ") || "Modelo relacionado ao escopo HBR";
}

function stripAdHtml(html) {
  return decodeAdHtmlEntities(String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|th|li|h1|h2|h3|h4|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim());
}

function decodeAdHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeAdKey(value) {
  return normalizeText(value).replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function uniqueAdBy(items, getKey) {
  const map = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    if (key && !map.has(key)) map.set(key, item);
  });
  return [...map.values()];
}

async function probeAdSource(source) {
  const checkedAt = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    const response = await fetch(source.url, { cache: "no-store", signal: controller.signal });
    window.clearTimeout(timeout);
    const text = await response.text();
    const matches = countScopeMatches(text);

    if (!response.ok) {
      return {
        ...source,
        checkedAt,
        tone: "warning",
        status: `HTTP ${response.status}`,
        message: "A fonte respondeu, mas não retornou uma página válida para leitura automática."
      };
    }

    if (source.authority === "ANAC" && normalizeText(text).includes("NAO EXISTE DA BRASILEIRA")) {
      return {
        ...source,
        checkedAt,
        tone: "empty",
        status: "Sem novas DAs",
        message: "Consulta executada; não há DA brasileira emitida ou revisada nas últimas duas semanas."
      };
    }

    return {
      ...source,
      checkedAt,
      tone: matches ? "ok" : "empty",
      status: matches ? `${matches} termos da EO encontrados` : "Sem termo da EO",
      message: matches
        ? "A página retornou termos que coincidem com a EO HBR. Revise os achados consolidados."
        : "A fonte respondeu, mas não trouxe termos do escopo da EO nesta leitura."
    };
  } catch {
    return {
      ...source,
      checkedAt,
      tone: "warning",
      status: "Requer backend",
      message: "O navegador bloqueou a leitura direta ou a fonte demorou a responder. A rotina agendada do Firebase deve executar esta busca no backend."
    };
  }
}

function countScopeMatches(text) {
  const normalized = normalizeText(text);
  return HBR_EO_SCOPE.keywords.filter((keyword) => normalized.includes(normalizeText(keyword))).length;
}

async function saveAdMonitorToFirestore() {
  try {
    await setDoc(doc(db, "ad_monitor", "current"), {
      ...adMonitorState,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch {
    // Sem permissão de escrita, o cache local continua mantendo a tela atualizada para o usuário.
  }
}

function renderAdMonitor() {
  renderAdHeader();
  renderAdScopeSummary();
  renderAdSources();
  renderAdResults();
  renderAdReports();
  renderAdNotifications();
}

function renderAdHeader() {
  const findings = adMonitorState.findings || [];
  const reports = adReports || [];
  if (el.adTotalFindings) el.adTotalFindings.textContent = String(findings.length);
  if (el.adLastRun) el.adLastRun.textContent = formatAdDateTime(adMonitorState.lastRunISO);
  if (el.adNextRun) el.adNextRun.textContent = formatAdDateTime(adMonitorState.nextRunISO);
  if (el.adReportCount) el.adReportCount.textContent = `${reports.length} ${reports.length === 1 ? "gerado" : "gerados"}`;
}

function renderAdScopeSummary() {
  if (!el.adScopeSummary) return;
  el.adScopeSummary.textContent = "";

  const identity = document.createElement("article");
  identity.className = "ad-scope-card";
  identity.innerHTML = `
    <span>Organização</span>
    <strong>${escapeHtml(HBR_EO_SCOPE.organization)}</strong>
    <p>Certificado ${escapeHtml(HBR_EO_SCOPE.certificate)} | Base ${escapeHtml(HBR_EO_SCOPE.base)} | ${escapeHtml(HBR_EO_SCOPE.revision)}</p>
  `;

  const aircraft = createAdScopeCard("Aeronaves no escopo", HBR_EO_SCOPE.aircraft);
  const engines = createAdScopeCard("Motores no escopo", HBR_EO_SCOPE.engines);
  const aircraftEngines = createAdAircraftEngineCard("Motores por aeronave", HBR_EO_SCOPE.aircraftEngines);
  const keywords = createAdScopeCard("Termos de pesquisa", HBR_EO_SCOPE.keywords);

  el.adScopeSummary.append(identity, aircraft, engines, aircraftEngines, keywords);
}

function createAdScopeCard(title, values) {
  const card = document.createElement("article");
  card.className = "ad-scope-card";
  const visibleValues = values.slice(0, 10);
  card.innerHTML = `
    <span>${escapeHtml(title)}</span>
    <strong>${values.length} itens monitorados</strong>
    <div class="ad-chip-list">
      ${visibleValues.map((value) => `<b>${escapeHtml(value)}</b>`).join("")}
      ${values.length > visibleValues.length ? `<b>+${values.length - visibleValues.length}</b>` : ""}
    </div>
  `;
  return card;
}

function createAdAircraftEngineCard(title, values) {
  const card = document.createElement("article");
  card.className = "ad-scope-card ad-engine-map-card";
  card.innerHTML = `
    <span>${escapeHtml(title)}</span>
    <strong>${values.length} famílias com motores vinculados</strong>
    <div class="ad-engine-map-list">
      ${values.map((value) => `
        <div class="ad-engine-map-row">
          <b>${escapeHtml(value.aircraft)}</b>
          <p>${value.engines.map((engine) => escapeHtml(engine)).join(" | ")}</p>
        </div>
      `).join("")}
    </div>
  `;
  return card;
}

function renderAdSources() {
  if (!el.adSourceList) return;
  el.adSourceList.textContent = "";

  (adMonitorState.sources || []).forEach((source) => {
    const card = document.createElement("article");
    card.className = "ad-source-card";
    card.innerHTML = `
      <div class="ad-source-meta">
        <b class="ad-authority-pill ${escapeHtml(source.authority.toLowerCase())}">${escapeHtml(source.authority)}</b>
        <b class="ad-status-pill ${escapeHtml(source.tone || "warning")}">${escapeHtml(source.status || "Aguardando")}</b>
      </div>
      <strong>${escapeHtml(source.message || "Fonte pronta para consulta.")}</strong>
      <p>Última tentativa: ${escapeHtml(formatAdDateTime(source.checkedAt))}</p>
      <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">Abrir fonte oficial</a>
    `;
    el.adSourceList.appendChild(card);
  });
}

function renderAdResults() {
  if (!el.adResultsList) return;
  el.adResultsList.textContent = "";

  const search = normalizeText(el.adSearchFilter?.value || "");
  const line = el.adLineFilter?.value || "all";
  const sort = el.adDateSort?.value || "newest";
  const filtered = filterAndSortAdFindings({ search, line, sort });

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "ad-empty";
    empty.textContent = "Nenhuma AD encontrada para o filtro atual.";
    el.adResultsList.appendChild(empty);
    return;
  }

  filtered.forEach((finding) => {
    const lineMatches = getAdLineMatches(finding);
    const lineChips = createAdLineChipsHtml(lineMatches);
    const engineSummary = formatAdList(getAdFindingEngineScope(finding), "Motor não identificado no texto da AD.");
    const card = document.createElement("article");
    card.className = `ad-result-card${finding.status?.includes("Novo") ? " is-new" : ""}`;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Abrir relatório de ${finding.number}`);
    card.innerHTML = `
      <div class="ad-result-meta">
        <b class="ad-authority-pill ${escapeHtml(finding.authority.toLowerCase())}">${escapeHtml(finding.authority)}</b>
        <b class="ad-status-pill ${isProposedAdType(finding.type) ? "warning" : "ok"}">${escapeHtml(finding.type || "AD")}</b>
        <span>${escapeHtml(formatAdDate(finding.issueDate))}</span>
      </div>
      <div class="ad-line-chip-list">${lineChips}</div>
      <strong>${escapeHtml(finding.number)} | ${escapeHtml(finding.subject)}</strong>
      <p>${escapeHtml(finding.holder)} - ${escapeHtml(finding.model || "-")}</p>
      <p>Motores da linha: ${escapeHtml(engineSummary)}</p>
      <p>${escapeHtml(finding.match || "Correspondência com o escopo da EO HBR.")}</p>
      <div class="ad-result-actions">
        <button type="button" class="admin-mini-action" data-ad-report="${escapeHtml(finding.id)}">Ver relatório</button>
        ${finding.sourceUrl ? `<a href="${escapeHtml(finding.sourceUrl)}" target="_blank" rel="noopener">Abrir registro</a>` : ""}
      </div>
    `;
    card.addEventListener("click", () => openAdDetail(finding.id));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openAdDetail(finding.id);
    });
    card.querySelector("[data-ad-report]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      openAdDetail(finding.id);
    });
    card.querySelector("a")?.addEventListener("click", (event) => event.stopPropagation());
    el.adResultsList.appendChild(card);
  });
}

function renderAdNotifications() {
  if (!el.adNotificationsList) return;
  el.adNotificationsList.textContent = "";

  const findings = adMonitorState.findings || [];
  const mandatoryCount = findings.filter((finding) => !isProposedAdType(finding.type)).length;
  const proposalCount = findings.length - mandatoryCount;
  if (el.adNotificationTotal) el.adNotificationTotal.textContent = String(findings.length);
  if (el.adNotificationMandatory) el.adNotificationMandatory.textContent = String(mandatoryCount);
  if (el.adNotificationProposal) el.adNotificationProposal.textContent = String(proposalCount);

  const line = el.adNotificationLineFilter?.value || "all";
  const sort = el.adNotificationDateSort?.value || "newest";
  const filtered = filterAndSortAdFindings({ search: "", line, sort });

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "ad-empty";
    empty.textContent = "Nenhuma notificação de AD para o filtro atual.";
    el.adNotificationsList.appendChild(empty);
    return;
  }

  filtered.forEach((finding) => {
    const priority = getAdNotificationPriority(finding);
    const lineMatches = getAdLineMatches(finding);
    const card = document.createElement("article");
    card.className = `ad-notification-card ${priority.tone}`;
    card.innerHTML = `
      <div class="ad-notification-main">
        <div class="ad-result-meta">
          <b class="ad-notification-priority ${priority.tone}">${escapeHtml(priority.label)}</b>
          <b class="ad-authority-pill ${escapeHtml(finding.authority.toLowerCase())}">${escapeHtml(finding.authority)}</b>
          <span>${escapeHtml(formatAdDate(finding.issueDate))}</span>
        </div>
        <strong>${escapeHtml(finding.number)} | ${escapeHtml(finding.subject || "Diretriz de Aeronavegabilidade")}</strong>
        <div class="ad-line-chip-list">${createAdLineChipsHtml(lineMatches)}</div>
        <p>${escapeHtml(priority.message)}</p>
        <p>Motores da linha: ${escapeHtml(formatAdList(getAdFindingEngineScope(finding), "Motor não identificado no texto da AD."))}</p>
      </div>
      <button type="button" class="modal-action secondary" data-ad-notification-report="${escapeHtml(finding.id)}">Ver relatório</button>
    `;
    card.querySelector("[data-ad-notification-report]")?.addEventListener("click", () => openAdDetail(finding.id));
    el.adNotificationsList.appendChild(card);
  });
}

function filterAndSortAdFindings({ search = "", line = "all", sort = "newest" } = {}) {
  return [...(adMonitorState.findings || [])]
    .filter((finding) => line === "all" || getAdLineMatches(finding).some((match) => match.key === line))
    .filter((finding) => !search || getAdSearchHaystack(finding).includes(search))
    .sort((a, b) => compareAdFindingsByDate(a, b, sort));
}

function compareAdFindingsByDate(a, b, sort) {
  const descending = sort === "newest" || sort === "effective-newest";
  const useEffectiveDate = sort === "effective-newest" || sort === "effective-oldest";
  const first = getAdDateTimestamp(a, useEffectiveDate);
  const second = getAdDateTimestamp(b, useEffectiveDate);
  return descending ? second - first : first - second;
}

function getAdDateTimestamp(finding, useEffectiveDate = false) {
  const preferred = useEffectiveDate ? finding.effectiveDate : finding.issueDate;
  const fallback = useEffectiveDate ? finding.issueDate : finding.effectiveDate;
  const date = new Date(preferred || fallback || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getAdSearchHaystack(finding) {
  const lineMatches = getAdLineMatches(finding);
  const lineLabels = lineMatches.map((match) => match.label).join(" ");
  const engineLabels = getAdFindingEngineScope(finding).join(" ");
  return normalizeText(`${finding.authority} ${finding.number} ${finding.type} ${finding.holder} ${finding.model} ${finding.subject} ${finding.match} ${finding.status} ${lineLabels} ${engineLabels}`);
}

function getAdLineMatches(finding) {
  const haystack = normalizeText(`${finding.authority} ${finding.number} ${finding.type} ${finding.holder} ${finding.model} ${finding.subject} ${finding.match} ${finding.status} ${finding.applicability || ""} ${finding.identified || ""}`);
  return AD_LINE_FILTERS.map((line) => {
    const matchedTerms = line.terms.filter((term) => hasNormalizedAdTerm(haystack, term));
    const matchedEngines = line.engines
      .filter((engine) => engine.terms.some((term) => hasNormalizedAdTerm(haystack, term)))
      .map((engine) => engine.label);

    if (!matchedTerms.length && !matchedEngines.length) return null;
    return {
      key: line.key,
      label: line.label,
      matchedTerms,
      matchedEngines,
      engines: line.engines.map((engine) => engine.label)
    };
  }).filter(Boolean);
}

function hasNormalizedAdTerm(normalizedHaystack, term) {
  const normalizedTerm = normalizeText(term || "");
  return Boolean(normalizedTerm) && normalizedHaystack.includes(normalizedTerm);
}

function getAdFindingEngineScope(finding) {
  const lineMatches = getAdLineMatches(finding);
  const targetedEngines = uniqueAdBy(lineMatches.flatMap((match) => match.matchedEngines), (engine) => engine);
  if (targetedEngines.length) return targetedEngines;
  return uniqueAdBy(lineMatches.flatMap((match) => match.engines), (engine) => engine);
}

function createAdLineChipsHtml(lineMatches) {
  if (!lineMatches.length) return `<b class="ad-line-chip neutral">Escopo geral</b>`;
  return lineMatches
    .map((match) => `<b class="ad-line-chip ${escapeHtml(match.key.toLowerCase())}">${escapeHtml(match.label)}</b>`)
    .join("");
}

function formatAdList(values, fallback, limit = 3) {
  const uniqueValues = uniqueAdBy(values.filter(Boolean), (value) => value);
  if (!uniqueValues.length) return fallback;
  const visible = uniqueValues.slice(0, limit);
  const suffix = uniqueValues.length > visible.length ? ` +${uniqueValues.length - visible.length}` : "";
  return `${visible.join(" | ")}${suffix}`;
}

function getAdNotificationPriority(finding) {
  if (isProposedAdType(finding.type)) {
    return {
      tone: "warning",
      label: "Acompanhar",
      message: "Proposta ou publicação preliminar: manter no radar até a autoridade emitir, revisar ou cancelar a diretriz final."
    };
  }

  const effectiveTime = getAdDateTimestamp(finding, true);
  if (effectiveTime && effectiveTime <= Date.now()) {
    return {
      tone: "critical",
      label: "Mandatória",
      message: "AD final com data efetiva atingida ou disponível: validar aplicabilidade e registrar tratativa interna."
    };
  }

  return {
    tone: "ok",
    label: "Programar",
    message: "AD final encontrada: acompanhar data efetiva, linha afetada, motores associados e plano de cumprimento."
  };
}

function openAdDetail(findingId) {
  if (!el.adDetailModal) return;
  const finding = (adMonitorState.findings || []).find((item) => item.id === findingId);
  if (!finding) return;
  const report = buildAdFindingReport(finding);

  if (el.adDetailTitle) el.adDetailTitle.textContent = `Relatório ${finding.number}`;
  if (el.adDetailDocument) el.adDetailDocument.textContent = `${finding.authority} | ${finding.type || "AD"}`;
  if (el.adDetailMeta) {
    el.adDetailMeta.textContent = `${formatAdDate(finding.issueDate)}${finding.effectiveDate ? ` | Efetiva em ${formatAdDate(finding.effectiveDate)}` : ""}`;
  }

  if (el.adDetailContent) {
    el.adDetailContent.innerHTML = `
      <div class="ad-detail-summary">
        <b class="ad-authority-pill ${escapeHtml(finding.authority.toLowerCase())}">${escapeHtml(finding.authority)}</b>
        <b class="ad-status-pill ${report.mandatoryTone}">${escapeHtml(report.mandatoryLabel)}</b>
        <span>${escapeHtml(finding.status || "Em análise")}</span>
      </div>
      <strong>${escapeHtml(finding.subject || finding.number)}</strong>
      <div class="ad-detail-grid">
        <section>
          <span>Aplicabilidade</span>
          <p>${escapeHtml(report.applicability)}</p>
        </section>
        <section>
          <span>Linha e motores</span>
          <p>${escapeHtml(report.lineScope)}</p>
        </section>
        <section>
          <span>Mandatório ou não</span>
          <p>${escapeHtml(report.mandatory)}</p>
        </section>
        <section>
          <span>O que foi identificado</span>
          <p>${escapeHtml(report.identified)}</p>
        </section>
        <section>
          <span>Tratativas</span>
          <p>${escapeHtml(report.treatment)}</p>
        </section>
      </div>
      <p class="ad-detail-note">${escapeHtml(finding.match || "Correspondência com o escopo da EO HBR.")}</p>
    `;
  }

  if (el.adDetailSourceLink) {
    if (finding.sourceUrl) {
      el.adDetailSourceLink.href = finding.sourceUrl;
      el.adDetailSourceLink.hidden = false;
    } else {
      el.adDetailSourceLink.removeAttribute("href");
      el.adDetailSourceLink.hidden = true;
    }
  }

  el.adDetailModal.hidden = false;
}

function closeAdDetail() {
  if (el.adDetailModal) el.adDetailModal.hidden = true;
}

function buildAdFindingReport(finding) {
  const isProposed = isProposedAdType(finding.type);
  return {
    applicability: finding.applicability || buildAdApplicability(finding),
    lineScope: buildAdLineScopeSummary(finding),
    mandatory: finding.mandatory || inferAdMandatory(finding),
    mandatoryLabel: isProposed ? "Não mandatório nesta fase" : "Mandatório se aplicável",
    mandatoryTone: isProposed ? "warning" : "ok",
    identified: finding.identified || inferAdIdentified(finding),
    treatment: finding.treatment || inferAdTreatment(finding)
  };
}

function buildAdLineScopeSummary(finding) {
  const lineMatches = getAdLineMatches(finding);
  const lineSummary = lineMatches.length
    ? lineMatches.map((match) => match.label).join(", ")
    : "Linha não identificada automaticamente.";
  const engineSummary = formatAdList(getAdFindingEngineScope(finding), "motor não identificado no texto da AD.", 5);
  return `${lineSummary}. Motores da linha: ${engineSummary}`;
}

function isProposedAdType(type) {
  const normalized = normalizeText(type || "");
  return normalized.includes("PAD") || normalized.includes("NPRM") || normalized.includes("PROPOSED") || normalized.includes("PROPOSTA");
}

function buildAdApplicability(finding) {
  const holder = finding.holder || "Fabricante não informado";
  const model = finding.model || "modelo não informado";
  return `${holder} - ${model}. Comparar com o escopo da EO HBR e confirmar aplicabilidade por modelo, versão, número de série e componente instalado.`;
}

function inferAdMandatory(finding) {
  if (isProposedAdType(finding.type)) {
    return "Ainda não é cumprimento obrigatório como AD final, mas deve ser acompanhado por Publicações e Qualidade até virar AD, ser encerrada ou ser descartada.";
  }
  return "É mandatória quando aplicável ao produto aeronáutico; a execução deve seguir o prazo, método e exceções descritos pela autoridade emissora.";
}

function inferAdIdentified(finding) {
  return finding.subject
    ? `A autoridade identificou condição relacionada a: ${finding.subject}.`
    : "A autoridade identificou uma condição que precisa ser avaliada contra o escopo técnico da EO HBR.";
}

function inferAdTreatment(finding) {
  if (isProposedAdType(finding.type)) {
    return "Registrar como acompanhamento, avaliar comentários/prazo da proposta, monitorar a publicação final e preparar análise preliminar de impacto.";
  }
  return "Abrir análise interna, validar aplicabilidade com engenharia e manutenção, registrar decisão no controle de ADs e planejar cumprimento ou justificativa técnica.";
}

function renderAdReports() {
  if (!el.adReportsList) return;
  el.adReportsList.textContent = "";

  const reports = [...(adReports || [])].sort((a, b) => new Date(b.createdAtISO || 0) - new Date(a.createdAtISO || 0)).slice(0, 8);
  if (!reports.length) {
    const empty = document.createElement("div");
    empty.className = "ad-empty";
    empty.textContent = "Nenhum relatório gerado ainda.";
    el.adReportsList.appendChild(empty);
    return;
  }

  reports.forEach((report) => {
    const card = document.createElement("article");
    card.className = "ad-report-card";
    card.innerHTML = `
      <div>
        <span>${escapeHtml(report.type === "weekly" ? "Semanal" : "Diário")}</span>
        <strong>${escapeHtml(report.title)}</strong>
      </div>
      <b class="ad-status-pill ${report.findingCount ? "ok" : "empty"}">${report.findingCount} ADs</b>
      <p>${escapeHtml(report.summary)}</p>
    `;
    el.adReportsList.appendChild(card);
  });
}

function createAdReport(type, force = false) {
  const now = new Date();
  const id = type === "weekly" ? `weekly-${getAdWeekKey(now)}` : `daily-${getAdLocalDateKey(now)}`;
  const existingIndex = adReports.findIndex((report) => report.id === id);
  if (existingIndex >= 0 && !force) return adReports[existingIndex];

  const findings = adMonitorState.findings || [];
  const lineCount = countAdFindingsByLine(findings);
  const title = type === "weekly"
    ? `Relatório semanal ${getAdWeekKey(now)}`
    : `Relatório diário ${getAdLocalDateKey(now)}`;
  const summary = findings.length
    ? `Foram consolidadas ${findings.length} ADs/PADs por linha: ${formatAdLineCountSummary(lineCount)}.`
    : "Nenhuma AD compatível com a EO HBR foi encontrada no período.";
  const report = {
    id,
    type,
    title,
    summary,
    findingCount: findings.length,
    createdAtISO: now.toISOString(),
    lastRunISO: adMonitorState.lastRunISO,
    findings
  };

  if (existingIndex >= 0) {
    adReports = adReports.map((item, index) => (index === existingIndex ? report : item));
  } else {
    adReports = [report, ...adReports].slice(0, 60);
  }

  saveStoredAdReports();
  saveAdReportToFirestore(report);
  return report;
}

function countAdFindingsByLine(findings) {
  return findings.reduce((map, finding) => {
    const matches = getAdLineMatches(finding);
    if (!matches.length) {
      map["Escopo geral"] = (map["Escopo geral"] || 0) + 1;
      return map;
    }
    matches.forEach((match) => {
      map[match.label] = (map[match.label] || 0) + 1;
    });
    return map;
  }, {});
}

function formatAdLineCountSummary(lineCount) {
  const parts = Object.entries(lineCount).map(([line, total]) => `${line} ${total}`);
  return parts.length ? parts.join(", ") : "sem linha identificada";
}

async function saveAdReportToFirestore(report) {
  try {
    await setDoc(doc(db, "ad_reports", report.id), {
      ...report,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch {
    // O relatório local continua disponível quando a conta não tem permissão de escrita.
  }
}

function ensureAdReports() {
  createAdReport("daily");
  createAdReport("weekly");
}

function loadStoredAdMonitorState() {
  try {
    return normalizeAdMonitorState(JSON.parse(localStorage.getItem(AD_MONITOR_KEY) || "null"));
  } catch {
    return normalizeAdMonitorState(null);
  }
}

function saveStoredAdMonitorState() {
  localStorage.setItem(AD_MONITOR_KEY, JSON.stringify(adMonitorState));
}

function loadStoredAdReports() {
  try {
    const value = JSON.parse(localStorage.getItem(AD_REPORTS_KEY) || "[]");
    return Array.isArray(value) ? value.map(normalizeAdReport).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveStoredAdReports() {
  localStorage.setItem(AD_REPORTS_KEY, JSON.stringify(adReports));
}

function mergeAdReports(current, incoming) {
  const map = new Map();
  [...current, ...incoming].forEach((report) => {
    if (!report?.id) return;
    map.set(report.id, report);
  });
  return [...map.values()].sort((a, b) => new Date(b.createdAtISO || 0) - new Date(a.createdAtISO || 0)).slice(0, 60);
}

function normalizeAdMonitorState(value) {
  const now = new Date();
  const source = value && typeof value === "object" ? value : {};
  const lastRunISO = source.lastRunISO || "2026-09-12T12:00:00.000Z";
  const nextRunISO = source.nextRunISO || new Date(new Date(lastRunISO).getTime() + AD_SEARCH_INTERVAL_MS).toISOString();
  return {
    lastRunISO,
    nextRunISO: Number.isNaN(new Date(nextRunISO).getTime()) ? new Date(now.getTime() + AD_SEARCH_INTERVAL_MS).toISOString() : nextRunISO,
    mode: source.mode || "inicial",
    scope: HBR_EO_SCOPE,
    sources: Array.isArray(source.sources) && source.sources.length ? source.sources.map(normalizeAdSource) : DEFAULT_AD_SOURCE_STATUS,
    findings: mergeAdFindings(source.findings || [], DEFAULT_AD_FINDINGS)
  };
}

function normalizeAdSource(source) {
  return {
    authority: cleanTextLine(source.authority || "Fonte"),
    url: cleanTextLine(source.url || ""),
    status: cleanTextLine(source.status || "Aguardando"),
    tone: cleanTextLine(source.tone || "warning"),
    message: cleanTextLine(source.message || ""),
    checkedAt: cleanTextLine(source.checkedAt || "")
  };
}

function normalizeAdReport(report) {
  if (!report || typeof report !== "object") return null;
  return {
    id: cleanTextLine(report.id || ""),
    type: report.type === "weekly" ? "weekly" : "daily",
    title: cleanTextLine(report.title || "Relatório de ADs"),
    summary: cleanTextLine(report.summary || ""),
    findingCount: Number(report.findingCount || 0),
    createdAtISO: cleanTextLine(report.createdAtISO || ""),
    lastRunISO: cleanTextLine(report.lastRunISO || ""),
    findings: Array.isArray(report.findings) ? report.findings.map(normalizeAdFinding).filter(Boolean) : []
  };
}

function normalizeAdFinding(finding) {
  if (!finding || typeof finding !== "object") return null;
  const number = cleanTextLine(finding.number || "");
  const authority = cleanTextLine(finding.authority || "");
  if (!number || !authority) return null;
  const normalized = {
    id: cleanTextLine(finding.id || `${authority}-${number}`),
    authority,
    number,
    type: cleanTextLine(finding.type || "AD"),
    issueDate: cleanTextLine(finding.issueDate || ""),
    effectiveDate: cleanTextLine(finding.effectiveDate || ""),
    holder: cleanTextLine(finding.holder || ""),
    model: cleanTextLine(finding.model || ""),
    subject: cleanTextLine(finding.subject || ""),
    match: cleanTextLine(finding.match || ""),
    status: cleanTextLine(finding.status || ""),
    sourceUrl: cleanTextLine(finding.sourceUrl || "")
  };
  return {
    ...normalized,
    applicability: cleanTextLine(finding.applicability || buildAdApplicability(normalized)),
    mandatory: cleanTextLine(finding.mandatory || inferAdMandatory(normalized)),
    identified: cleanTextLine(finding.identified || inferAdIdentified(normalized)),
    treatment: cleanTextLine(finding.treatment || inferAdTreatment(normalized))
  };
}

function mergeAdFindings(...groups) {
  const map = new Map();
  groups.flat().map(normalizeAdFinding).filter(Boolean).forEach((finding) => {
    const key = normalizeText(`${finding.authority}-${finding.number}`);
    if (!map.has(key)) map.set(key, finding);
  });
  return Array.from(map.values());
}

function getAdLocalDateKey(date) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function getAdWeekKey(date) {
  const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((current - yearStart) / 86400000) + 1) / 7);
  return `${current.getUTCFullYear()}-S${String(week).padStart(2, "0")}`;
}

function formatAdDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function formatAdDateTime(value) {
  if (!value) return "Aguardando";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

function clampInteger(value, min, max) {
  const numeric = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.min(Math.max(numeric, min), max);
}

function initPublicationNetwork() {
  syncPublicationPhysicsState();
  // A rede fica em localStorage para permitir ajustes rápidos sem alterar o código.
  syncPublicationControls();
  renderPublicationNetwork();
  if (document.getElementById("publicacoes")?.classList.contains("active")) startPublicationFloat();
}

function togglePublicationMenu() {
  const isOpen = !el.publicationShell?.classList.contains("menu-open");
  el.publicationShell?.classList.toggle("menu-open", isOpen);
  el.publicationMenuBtn?.setAttribute("aria-expanded", String(isOpen));
}

function syncPublicationControls() {
  if (el.publicationSearch) el.publicationSearch.value = publicationConfig.search;
  if (el.publicationFilterFq) el.publicationFilterFq.checked = Boolean(publicationConfig.filters.FQ);
  if (el.publicationFilterIt) el.publicationFilterIt.checked = Boolean(publicationConfig.filters.IT);
  if (el.publicationFilterPrq) el.publicationFilterPrq.checked = Boolean(publicationConfig.filters.PRQ);
  if (el.publicationIntensity) el.publicationIntensity.value = String(publicationConfig.intensity);
  if (el.publicationNodeSize) el.publicationNodeSize.value = String(publicationConfig.nodeSize);
  if (el.publicationLineWidth) el.publicationLineWidth.value = String(publicationConfig.lineWidth);
  if (el.publicationLabelsToggle) el.publicationLabelsToggle.checked = Boolean(publicationConfig.showLabels);
}

function handlePublicationConfigChange() {
  publicationConfig = normalizePublicationConfig({
    intensity: Number(el.publicationIntensity?.value || DEFAULT_PUBLICATION_CONFIG.intensity),
    nodeSize: Number(el.publicationNodeSize?.value || DEFAULT_PUBLICATION_CONFIG.nodeSize),
    lineWidth: Number(el.publicationLineWidth?.value || DEFAULT_PUBLICATION_CONFIG.lineWidth),
    showLabels: Boolean(el.publicationLabelsToggle?.checked),
    search: cleanTextLine(el.publicationSearch?.value || ""),
    filters: {
      FQ: Boolean(el.publicationFilterFq?.checked),
      IT: Boolean(el.publicationFilterIt?.checked),
      PRQ: Boolean(el.publicationFilterPrq?.checked)
    }
  });
  savePublicationConfig();
  renderPublicationNetwork();
}

function renderPublicationNetwork() {
  if (!el.publicationCanvas || !el.publicationNodes || !el.publicationLinks) return;

  syncPublicationPhysicsState();
  const visibleNodes = getVisiblePublicationNodes();
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const links = publicationNetwork.links.filter((link) => visibleIds.has(link.from) && visibleIds.has(link.to));
  const rect = el.publicationCanvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);

  if (el.publicationTotalNodes) el.publicationTotalNodes.textContent = String(publicationNetwork.nodes.length);
  el.publicationCanvas.style.setProperty("--publication-node-size", `${publicationConfig.nodeSize}px`);
  el.publicationCanvas.style.setProperty("--publication-cell-intensity", `${publicationConfig.intensity / 100}`);
  el.publicationCanvas.classList.toggle("hide-labels", !publicationConfig.showLabels);

  el.publicationLinks.setAttribute("viewBox", `0 0 ${width} ${height}`);
  rebuildPublicationLinkElements(links, width, height);

  el.publicationNodes.textContent = "";
  visibleNodes.forEach((node) => el.publicationNodes.appendChild(createPublicationNodeElement(node)));

  renderPublicationSelectors();
  renderPublicationInfoPanel();
}

function getPublicationLinkKey(link) {
  return `${link.from}::${link.to}`;
}

// Reconstrói os elementos <line> do zero (usado quando a topologia, os filtros
// ou o estilo mudam). O loop de animação NÃO passa por aqui: ele reaproveita os
// elementos já criados via updatePublicationLinkPosition, o que evita recriar
// milhares de nós SVG a cada um dos 60 frames por segundo.
function rebuildPublicationLinkElements(links, width, height) {
  el.publicationLinks.textContent = "";
  publicationLinkElements = new Map();

  links.forEach((link) => {
    const source = getPublicationNode(link.from);
    const target = getPublicationNode(link.to);
    if (!source || !target) return;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke-width", String(publicationConfig.lineWidth));
    line.setAttribute("class", getPublicationLinkClass(source, target));
    updatePublicationLinkPosition(line, source, target, width, height);

    publicationLinkElements.set(getPublicationLinkKey(link), line);
    el.publicationLinks.appendChild(line);
  });
}

function updatePublicationLinkPosition(line, source, target, width, height) {
  const sourcePosition = getPublicationDisplayPosition(source);
  const targetPosition = getPublicationDisplayPosition(target);
  line.setAttribute("x1", String((sourcePosition.x / 100) * width));
  line.setAttribute("y1", String((sourcePosition.y / 100) * height));
  line.setAttribute("x2", String((targetPosition.x / 100) * width));
  line.setAttribute("y2", String((targetPosition.y / 100) * height));
}

function createPublicationNodeElement(node) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `publication-node type-${node.type.toLowerCase()}`;
  button.classList.toggle("selected", node.id === selectedPublicationId);
  button.classList.toggle("label-left", node.x > 66);
  const displayPosition = getPublicationDisplayPosition(node);
  button.style.left = `${displayPosition.x}%`;
  button.style.top = `${displayPosition.y}%`;
  button.dataset.publicationId = node.id;
  button.title = `${node.code} | ${node.title}`;

  const shape = document.createElement("span");
  shape.className = "publication-node-shape";

  const label = document.createElement("span");
  label.className = "publication-node-label";
  label.textContent = node.code;

  button.append(shape, label);
  button.addEventListener("click", () => selectPublicationNode(node.id));
  attachPublicationNodeDrag(button, node.id);
  return button;
}

function attachPublicationNodeDrag(button, nodeId) {
  let dragging = false;

  const move = (event) => {
    if (!dragging || !el.publicationCanvas) return;
    const rect = el.publicationCanvas.getBoundingClientRect();
    updatePublicationNodePosition(
      nodeId,
      ((event.clientX - rect.left) / rect.width) * 100,
      ((event.clientY - rect.top) / rect.height) * 100
    );
  };

  const stop = () => {
    if (!dragging) return;
    dragging = false;
    publicationDraggedNodeId = null;
    button.classList.remove("is-dragging");
    savePublicationNetwork();
  };

  button.addEventListener("pointerdown", (event) => {
    dragging = true;
    publicationDraggedNodeId = nodeId;
    button.classList.add("is-dragging");
    button.setPointerCapture?.(event.pointerId);
    selectedPublicationId = nodeId;
    Array.from(el.publicationNodes?.children || []).forEach((item) => {
      item.classList.toggle("selected", item.dataset.publicationId === nodeId);
    });
    renderPublicationLinksOnly();
    renderPublicationInfoPanel();
  });
  button.addEventListener("pointermove", move);
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointercancel", stop);
}

function updatePublicationNodePosition(nodeId, x, y) {
  const nextX = clampNumber(x, 5, 95);
  const nextY = clampNumber(y, 8, 92);
  const physicsNode = publicationPhysicsNodes.get(nodeId);
  if (physicsNode) {
    physicsNode.x = nextX;
    physicsNode.y = nextY;
    physicsNode.targetX = nextX;
    physicsNode.targetY = nextY;
    physicsNode.vx = 0;
    physicsNode.vy = 0;
  }
  publicationNetwork = {
    ...publicationNetwork,
    nodes: publicationNetwork.nodes.map((node) => (
      node.id === nodeId
        ? { ...node, x: nextX, y: nextY }
        : node
    ))
  };
  const nodeElement = Array.from(el.publicationNodes?.children || [])
    .find((item) => item.dataset.publicationId === nodeId);
  if (nodeElement) {
    applyPublicationNodeDomPositions();
  }
  renderPublicationLinksOnly();
}

function selectPublicationNode(nodeId) {
  selectedPublicationId = nodeId;
  renderPublicationNetwork();
}

function handlePublicationNodeSubmit(event) {
  event.preventDefault();
  const type = normalizePublicationType(el.publicationType?.value || "FQ");
  const code = cleanTextLine(el.publicationCode?.value || "");
  const title = cleanTextLine(el.publicationTitle?.value || "");
  const sector = cleanTextLine(el.publicationSector?.value || "");
  const linkedTo = el.publicationLinkTo?.value || "";

  if (!code || !title) return;

  const idBase = `${type}-${code}`;
  const id = uniquePublicationId(slugifyAreaName(idBase));
  const angle = (publicationNetwork.nodes.length / Math.max(1, publicationNetwork.nodes.length + 1)) * Math.PI * 2;
  const node = {
    id,
    type,
    code,
    title,
    sector: sector || "Publicações",
    x: clampNumber(50 + Math.cos(angle) * 28, 8, 92),
    y: clampNumber(52 + Math.sin(angle) * 28, 10, 90)
  };

  const nextNodes = [...publicationNetwork.nodes, node];
  const nextLinks = linkedTo ? [...publicationNetwork.links, { from: id, to: linkedTo }] : publicationNetwork.links;
  publicationNetwork = {
    nodes: nextNodes,
    links: normalizePublicationLinks(nextLinks, nextNodes)
  };
  selectedPublicationId = id;
  savePublicationNetwork();
  syncPublicationPhysicsState();
  clearPublicationForm();
  renderPublicationNetwork();
}

function handlePublicationAddLink() {
  const from = el.publicationSource?.value || "";
  const to = el.publicationTarget?.value || "";
  if (!from || !to || from === to) return;

  const exists = publicationNetwork.links.some((link) => (
    (link.from === from && link.to === to) || (link.from === to && link.to === from)
  ));
  if (!exists) {
    publicationNetwork = { ...publicationNetwork, links: [...publicationNetwork.links, { from, to }] };
    savePublicationNetwork();
    renderPublicationNetwork();
  }
}

function deleteSelectedPublication() {
  if (!selectedPublicationId) return;
  const current = getPublicationNode(selectedPublicationId);
  if (!current) return;
  if (!window.confirm(`Excluir o documento "${current.code}" da rede?`)) return;

  publicationNetwork = {
    nodes: publicationNetwork.nodes.filter((node) => node.id !== selectedPublicationId),
    links: publicationNetwork.links.filter((link) => link.from !== selectedPublicationId && link.to !== selectedPublicationId)
  };
  selectedPublicationId = publicationNetwork.nodes[0]?.id || null;
  savePublicationNetwork();
  syncPublicationPhysicsState();
  renderPublicationNetwork();
}

function resetPublicationLayout() {
  const defaultPositions = new Map(DEFAULT_PUBLICATION_NETWORK.nodes.map((node) => [node.id, node]));
  const total = Math.max(1, publicationNetwork.nodes.length);
  publicationNetwork = {
    ...publicationNetwork,
    nodes: publicationNetwork.nodes.map((node, index) => {
      const original = defaultPositions.get(node.id);
      if (original) return { ...node, x: original.x, y: original.y };
      const angle = (index / total) * Math.PI * 2;
      return {
        ...node,
        x: clampNumber(50 + Math.cos(angle) * 30, 8, 92),
        y: clampNumber(52 + Math.sin(angle) * 30, 10, 90)
      };
    })
  };
  savePublicationNetwork();
  syncPublicationPhysicsState();
  renderPublicationNetwork();
  startPublicationFloat();
}

function animatePublicationNetwork() {
  if (!el.publicationCanvas) return;
  if (publicationAnimationFrame) window.clearTimeout(publicationAnimationFrame);
  syncPublicationPhysicsState();
  el.publicationCanvas.classList.remove("is-animating");
  void el.publicationCanvas.offsetWidth;
  el.publicationCanvas.classList.add("is-animating");

  // O botao Animar aplica um pequeno impulso; a simulacao continua faz o amortecimento.
  publicationPhysicsNodes.forEach((physicsNode, nodeId) => {
    const seed = getPublicationNodeSeed(nodeId);
    physicsNode.vx += Math.sin(seed * 1.7) * 0.52;
    physicsNode.vy += Math.cos(seed * 1.3) * 0.52;
  });

  publicationAnimationFrame = window.setTimeout(() => {
    publicationAnimationFrame = null;
    el.publicationCanvas?.classList.remove("is-animating");
  }, 1200);
  startPublicationFloat();
}

function startPublicationFloat() {
  if (publicationFloatFrame) return;
  syncPublicationPhysicsState();
  publicationFloatLastTime = performance.now();

  const tick = (now) => {
    if (!document.getElementById("publicacoes")?.classList.contains("active")) {
      publicationFloatFrame = null;
      return;
    }

    const delta = Math.min(Math.max((now - publicationFloatLastTime) / 16.67, 0.35), 2.4);
    publicationFloatLastTime = now;
    stepPublicationPhysics(delta, now);
    applyPublicationNodeDomPositions();
    renderPublicationLinksOnly();
    publicationFloatFrame = requestAnimationFrame(tick);
  };

  publicationFloatFrame = requestAnimationFrame(tick);
}

function stopPublicationFloat() {
  if (!publicationFloatFrame) return;
  cancelAnimationFrame(publicationFloatFrame);
  publicationFloatFrame = null;
}

function syncPublicationPhysicsState() {
  const previousNodes = publicationPhysicsNodes;
  const nextNodes = new Map();

  publicationNetwork.nodes.forEach((node) => {
    const previous = previousNodes.get(node.id);
    nextNodes.set(node.id, {
      x: previous ? clampNumber(previous.x, 5, 95) : node.x,
      y: previous ? clampNumber(previous.y, 8, 92) : node.y,
      vx: previous?.vx || 0,
      vy: previous?.vy || 0,
      targetX: node.x,
      targetY: node.y
    });
  });

  publicationPhysicsNodes = nextNodes;
}

function stepPublicationPhysics(delta, now) {
  if (!publicationNetwork.nodes.length) return;

  const intensity = clampNumber(publicationConfig.intensity, 10, 100) / 100;
  const centerStrength = 0.0012 + intensity * 0.0016;
  const targetStrength = 0.006 + intensity * 0.006;
  const repulsionStrength = 7 + intensity * 9;
  const linkStrength = 0.009 + intensity * 0.007;
  const desiredLinkDistance = 22 + Math.min(publicationConfig.nodeSize, 90) * 0.08;
  const damping = Math.pow(0.88 - intensity * 0.025, delta);
  const driftStrength = 0.002 + intensity * 0.004;

  publicationNetwork.nodes.forEach((node) => {
    const physicsNode = publicationPhysicsNodes.get(node.id);
    if (!physicsNode) return;
    if (node.id === publicationDraggedNodeId) {
      physicsNode.x = node.x;
      physicsNode.y = node.y;
      physicsNode.targetX = node.x;
      physicsNode.targetY = node.y;
      physicsNode.vx = 0;
      physicsNode.vy = 0;
      return;
    }

    const seed = getPublicationNodeSeed(node.id);
    physicsNode.vx += ((physicsNode.targetX - physicsNode.x) * targetStrength + (50 - physicsNode.x) * centerStrength) * delta;
    physicsNode.vy += ((physicsNode.targetY - physicsNode.y) * targetStrength + (50 - physicsNode.y) * centerStrength) * delta;
    physicsNode.vx += Math.sin(now * 0.00055 + seed) * driftStrength * delta;
    physicsNode.vy += Math.cos(now * 0.00048 + seed * 1.4) * driftStrength * delta;
  });

  applyPublicationRepulsionForces(repulsionStrength, delta);

  publicationNetwork.links.forEach((link) => {
    const sourcePhysics = publicationPhysicsNodes.get(link.from);
    const targetPhysics = publicationPhysicsNodes.get(link.to);
    if (!sourcePhysics || !targetPhysics) return;

    const dx = targetPhysics.x - sourcePhysics.x;
    const dy = targetPhysics.y - sourcePhysics.y;
    const distance = Math.max(Math.hypot(dx, dy), 1);
    const spring = (distance - desiredLinkDistance) * linkStrength * delta;
    const forceX = (dx / distance) * spring;
    const forceY = (dy / distance) * spring;

    if (link.from !== publicationDraggedNodeId) {
      sourcePhysics.vx += forceX;
      sourcePhysics.vy += forceY;
    }
    if (link.to !== publicationDraggedNodeId) {
      targetPhysics.vx -= forceX;
      targetPhysics.vy -= forceY;
    }
  });

  publicationNetwork.nodes.forEach((node) => {
    const physicsNode = publicationPhysicsNodes.get(node.id);
    if (!physicsNode || node.id === publicationDraggedNodeId) return;

    physicsNode.vx *= damping;
    physicsNode.vy *= damping;
    physicsNode.x += physicsNode.vx * delta;
    physicsNode.y += physicsNode.vy * delta;

    if (physicsNode.x < 5 || physicsNode.x > 95) {
      physicsNode.x = clampNumber(physicsNode.x, 5, 95);
      physicsNode.vx *= -0.22;
    }
    if (physicsNode.y < 8 || physicsNode.y > 92) {
      physicsNode.y = clampNumber(physicsNode.y, 8, 92);
      physicsNode.vy *= -0.22;
    }
  });
}

// A repulsão entre pares de nós é a parte que mais custa da simulação: comparar
// todos contra todos (O(n²)) é inviável acima de algumas centenas de documentos
// (com 3000 nós isso seria 9 milhões de comparações a cada frame, 60x por
// segundo). Em vez disso, os nós são agrupados em uma grade espacial e cada um
// só é comparado com vizinhos próximos (O(n) na prática), já que a força cai
// com o quadrado da distância e é desprezível além de poucas células.
// A área útil do canvas (em % de posição) é de ~90x84; o tamanho de célula se
// adapta à quantidade de nós para manter uma densidade média por célula, o
// que mantém o custo por frame baixo tanto com 105 quanto com 3000+ nós.
const PUBLICATION_REPULSION_AREA = 90 * 84;
const PUBLICATION_REPULSION_TARGET_PER_CELL = 8;
const PUBLICATION_REPULSION_MIN_CELL_SIZE = 6;
const PUBLICATION_REPULSION_MAX_CELL_SIZE = 24;
const PUBLICATION_REPULSION_GRID_OFFSET = 1000;
const PUBLICATION_REPULSION_NEIGHBOR_OFFSETS = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
  [-1, 1]
];

function getPublicationRepulsionCellSize(nodeCount) {
  if (nodeCount <= 0) return PUBLICATION_REPULSION_MAX_CELL_SIZE;
  const idealSize = Math.sqrt((PUBLICATION_REPULSION_AREA * PUBLICATION_REPULSION_TARGET_PER_CELL) / nodeCount);
  return clampNumber(idealSize, PUBLICATION_REPULSION_MIN_CELL_SIZE, PUBLICATION_REPULSION_MAX_CELL_SIZE);
}

function buildPublicationRepulsionGrid(cellSize) {
  const grid = new Map();
  publicationNetwork.nodes.forEach((node) => {
    const physicsNode = publicationPhysicsNodes.get(node.id);
    if (!physicsNode) return;
    const cellX = Math.floor(physicsNode.x / cellSize) + PUBLICATION_REPULSION_GRID_OFFSET;
    const cellY = Math.floor(physicsNode.y / cellSize) + PUBLICATION_REPULSION_GRID_OFFSET;
    const key = cellX * 1000000 + cellY;
    if (!grid.has(key)) grid.set(key, { cellX, cellY, nodes: [] });
    grid.get(key).nodes.push(node);
  });
  return grid;
}

function applyPublicationRepulsionForce(current, other, repulsionStrength, delta) {
  const currentPhysics = publicationPhysicsNodes.get(current.id);
  const otherPhysics = publicationPhysicsNodes.get(other.id);
  if (!currentPhysics || !otherPhysics) return;

  const dx = currentPhysics.x - otherPhysics.x || 0.01;
  const dy = currentPhysics.y - otherPhysics.y || 0.01;
  const distance = Math.max(Math.hypot(dx, dy), 5);
  const repulsion = repulsionStrength / (distance * distance);
  const forceX = (dx / distance) * repulsion * delta;
  const forceY = (dy / distance) * repulsion * delta;

  if (current.id !== publicationDraggedNodeId) {
    currentPhysics.vx += forceX;
    currentPhysics.vy += forceY;
  }
  if (other.id !== publicationDraggedNodeId) {
    otherPhysics.vx -= forceX;
    otherPhysics.vy -= forceY;
  }
}

function applyPublicationRepulsionForces(repulsionStrength, delta) {
  const cellSize = getPublicationRepulsionCellSize(publicationNetwork.nodes.length);
  const grid = buildPublicationRepulsionGrid(cellSize);

  grid.forEach((cell) => {
    PUBLICATION_REPULSION_NEIGHBOR_OFFSETS.forEach(([offsetX, offsetY]) => {
      const neighborKey = (cell.cellX + offsetX) * 1000000 + (cell.cellY + offsetY);
      const neighbor = grid.get(neighborKey);
      if (!neighbor) return;
      const sameCell = offsetX === 0 && offsetY === 0;

      for (let index = 0; index < cell.nodes.length; index += 1) {
        const startIndex = sameCell ? index + 1 : 0;
        for (let otherIndex = startIndex; otherIndex < neighbor.nodes.length; otherIndex += 1) {
          applyPublicationRepulsionForce(cell.nodes[index], neighbor.nodes[otherIndex], repulsionStrength, delta);
        }
      }
    });
  });
}

function getPublicationDisplayPosition(node) {
  const physicsNode = publicationPhysicsNodes.get(node.id);
  if (!physicsNode) return { x: node.x, y: node.y };
  return {
    x: clampNumber(physicsNode.x, 4, 96),
    y: clampNumber(physicsNode.y, 7, 93)
  };
}

function getPublicationNodeSeed(id) {
  return String(id)
    .split("")
    .reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0) % 97;
}

// Chamada a cada frame de animação e a cada arraste: só reposiciona as linhas
// já existentes (criadas por rebuildPublicationLinkElements), sem tocar no DOM
// além de atualizar atributos. Com redes de milhares de documentos, recriar
// todas as linhas 60x por segundo travaria a página.
function renderPublicationLinksOnly() {
  if (!el.publicationCanvas || !el.publicationLinks) return;
  const rect = el.publicationCanvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  el.publicationLinks.setAttribute("viewBox", `0 0 ${width} ${height}`);

  publicationLinkElements.forEach((line, key) => {
    const [from, to] = key.split("::");
    const source = getPublicationNode(from);
    const target = getPublicationNode(to);
    if (!source || !target) return;
    updatePublicationLinkPosition(line, source, target, width, height);
  });
}

function applyPublicationNodeDomPositions() {
  Array.from(el.publicationNodes?.children || []).forEach((item) => {
    const node = getPublicationNode(item.dataset.publicationId);
    if (!node) return;
    const displayPosition = getPublicationDisplayPosition(node);
    item.style.left = `${displayPosition.x}%`;
    item.style.top = `${displayPosition.y}%`;
    item.classList.toggle("label-left", node.x > 66);
  });
}

function renderPublicationSelectors() {
  const options = publicationNetwork.nodes
    .map((node) => `<option value="${escapeHtml(node.id)}">${escapeHtml(node.code)} | ${escapeHtml(node.type)}</option>`)
    .join("");

  if (el.publicationSource) el.publicationSource.innerHTML = options;
  if (el.publicationTarget) el.publicationTarget.innerHTML = options;
  if (el.publicationLinkTo) {
    el.publicationLinkTo.innerHTML = `<option value="">Sem link inicial</option>${options}`;
  }

  if (selectedPublicationId) {
    if (el.publicationSource) el.publicationSource.value = selectedPublicationId;
    const firstTarget = publicationNetwork.nodes.find((node) => node.id !== selectedPublicationId);
    if (el.publicationTarget && firstTarget) el.publicationTarget.value = firstTarget.id;
  }
}

function renderPublicationInfoPanel() {
  if (!el.publicationInfoPanel) return;
  el.publicationInfoPanel.textContent = "";

  const selected = getPublicationNode(selectedPublicationId);
  if (!selected) {
    const empty = document.createElement("div");
    empty.className = "publication-info-empty";
    empty.textContent = "Clique em uma célula da rede para ver as informações.";
    el.publicationInfoPanel.appendChild(empty);
    return;
  }

  const linkedNodes = getLinkedPublicationNodes(selected.id);
  const linkedCodes = linkedNodes.map((node) => node.code).join(", ") || "Sem vínculos";
  const adjacentSectors = splitDocumentImportList(selected.adjacentSector);
  const relatedSectors = [...new Set([
    selected.sector,
    ...adjacentSectors,
    ...linkedNodes.map((node) => node.sector),
    ...linkedNodes.flatMap((node) => splitDocumentImportList(node.adjacentSector))
  ].filter(Boolean))];

  const card = document.createElement("article");
  card.className = "publication-info-card";

  const title = document.createElement("strong");
  title.textContent = selected.title;

  const subtitle = document.createElement("span");
  subtitle.textContent = `${selected.documento || selected.type} | ${selected.code}`;

  const fields = document.createElement("div");
  fields.className = "publication-info-fields";
  [
    ["Documento", selected.documento || selected.type],
    ["Código do documento", selected.code],
    ["Nome do documento", selected.title],
    ["Setor", selected.sector || "Publicações"],
    ["Setor adjacente", selected.adjacentSector || "-"],
    ["Desenvolvido por", selected.developedBy || "-"],
    ["Revisões", selected.revisions || "-"],
    ["Vínculos", linkedCodes],
    ["Impacto por setor", relatedSectors.join(", ") || "-"]
  ].forEach(([labelText, valueText]) => {
    const field = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = labelText;
    const value = document.createElement("b");
    value.textContent = valueText;
    field.append(label, value);
    fields.appendChild(field);
  });

  const impact = document.createElement("div");
  impact.className = "publication-impact-strip";
  impact.innerHTML = `
    <span>${linkedNodes.length}</span>
    <b>${linkedNodes.length === 1 ? "documento vinculado" : "documentos vinculados"}</b>
    <small>${relatedSectors.length} ${relatedSectors.length === 1 ? "setor relacionado" : "setores relacionados"}</small>
  `;

  card.append(title, subtitle, impact, fields);
  el.publicationInfoPanel.appendChild(card);
}

function getVisiblePublicationNodes() {
  const search = normalizeText(publicationConfig.search);
  return publicationNetwork.nodes.filter((node) => {
    if (!publicationConfig.filters[node.type]) return false;
    const haystack = normalizeText(`${node.type} ${node.code} ${node.title} ${node.documento} ${node.sector} ${node.adjacentSector} ${node.developedBy} ${node.revisions}`);
    return !search || haystack.includes(search);
  });
}

function getLinkedPublicationNodes(nodeId) {
  const linkedIds = new Set();
  publicationNetwork.links.forEach((link) => {
    if (link.from === nodeId) linkedIds.add(link.to);
    if (link.to === nodeId) linkedIds.add(link.from);
  });
  return publicationNetwork.nodes.filter((node) => linkedIds.has(node.id));
}

function getPublicationNode(nodeId) {
  return publicationNetwork.nodes.find((node) => node.id === nodeId) || null;
}

function getPublicationLinkClass(source, target) {
  if (source.id === selectedPublicationId || target.id === selectedPublicationId) return "selected";
  if (source.type === "FQ" || target.type === "FQ") return "fq-link";
  return "standard";
}

function clearPublicationForm() {
  if (el.publicationCode) el.publicationCode.value = "";
  if (el.publicationTitle) el.publicationTitle.value = "";
  if (el.publicationSector) el.publicationSector.value = "";
  if (el.publicationLinkTo) el.publicationLinkTo.value = "";
}

function loadStoredPublicationNetwork() {
  try {
    return normalizePublicationNetwork(JSON.parse(localStorage.getItem(PUBLICATION_NETWORK_KEY) || "null"));
  } catch {
    return normalizePublicationNetwork(DEFAULT_PUBLICATION_NETWORK);
  }
}

function savePublicationNetwork() {
  localStorage.setItem(PUBLICATION_NETWORK_KEY, JSON.stringify(publicationNetwork));
}

function loadStoredPublicationConfig() {
  try {
    return normalizePublicationConfig(JSON.parse(localStorage.getItem(PUBLICATION_CONFIG_KEY) || "null"));
  } catch {
    return normalizePublicationConfig(DEFAULT_PUBLICATION_CONFIG);
  }
}

function savePublicationConfig() {
  localStorage.setItem(PUBLICATION_CONFIG_KEY, JSON.stringify(publicationConfig));
}

function normalizePublicationNetwork(value) {
  const source = value && Array.isArray(value.nodes) ? value : DEFAULT_PUBLICATION_NETWORK;
  const nodes = source.nodes.map(normalizePublicationNode).filter(Boolean);
  return {
    nodes,
    links: normalizePublicationLinks(source.links, nodes)
  };
}

function normalizePublicationNode(node) {
  const type = normalizePublicationType(node?.type);
  const code = cleanTextLine(node?.code || "");
  const title = cleanTextLine(node?.title || "");
  if (!type || !code || !title) return null;

  return {
    id: cleanTextLine(node.id || slugifyAreaName(`${type}-${code}`)),
    type,
    code,
    title,
    documento: cleanTextLine(node.documento || node.document || type),
    sector: cleanTextLine(node.sector || "Publicações"),
    adjacentSector: cleanTextLine(node.adjacentSector || node.setorAdjacente || ""),
    developedBy: cleanTextLine(node.developedBy || node.desenvolvidoPor || ""),
    revisions: cleanTextLine(node.revisions || node.revisoes || node.revisões || ""),
    sourceFile: cleanTextLine(node.sourceFile || ""),
    sourceSheet: cleanTextLine(node.sourceSheet || ""),
    sourceRow: Number(node.sourceRow || 0),
    x: clampNumber(Number(node.x), 5, 95),
    y: clampNumber(Number(node.y), 8, 92)
  };
}

function normalizePublicationLinks(links, nodes) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const seen = new Set();
  return (Array.isArray(links) ? links : [])
    .map((link) => ({ from: String(link?.from || ""), to: String(link?.to || "") }))
    .filter((link) => link.from && link.to && link.from !== link.to && nodeIds.has(link.from) && nodeIds.has(link.to))
    .filter((link) => {
      const key = [link.from, link.to].sort().join(":");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizePublicationConfig(value) {
  const source = value && typeof value === "object" ? value : DEFAULT_PUBLICATION_CONFIG;
  return {
    intensity: clampNumber(Number(source.intensity), 40, 100),
    nodeSize: clampNumber(Number(source.nodeSize), 44, 86),
    lineWidth: clampNumber(Number(source.lineWidth), 1, 8),
    showLabels: source.showLabels !== false,
    search: cleanTextLine(source.search || ""),
    filters: {
      FQ: source.filters?.FQ !== false,
      IT: source.filters?.IT !== false,
      PRQ: source.filters?.PRQ !== false
    }
  };
}

function normalizePublicationType(type) {
  const normalized = normalizeText(type);
  return ["FQ", "IT", "PRQ"].includes(normalized) ? normalized : "FQ";
}

function uniquePublicationId(baseId) {
  let id = baseId || `documento-${Date.now()}`;
  let index = 2;
  while (publicationNetwork.nodes.some((node) => node.id === id)) {
    id = `${baseId}-${index}`;
    index += 1;
  }
  return id;
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(Math.max(numeric, min), max);
}

function renderAdminShell() {
  renderDynamicAreaNavigation();
  renderDynamicAreaTabs();
  renderAdminPanel();
  renderAdminChecklist();
  renderAdminHistory();
  renderDocumentImportEmptyState("Selecione um Excel para iniciar.");
}

function renderDynamicAreaNavigation() {
  if (!el.sidebarDynamicAreas) return;
  el.sidebarDynamicAreas.textContent = "";
}

function createFileSvgIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z");

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("points", "14 2 14 8 20 8");

  svg.append(path, polyline);
  return svg;
}

function renderDynamicAreaTabs() {
  if (!el.workspace) return;
  el.workspace.querySelectorAll(".dynamic-area-tab").forEach((section) => section.remove());
}

function createDynamicAreaWorkspace(area) {
  const config = normalizeAreaConfig(area.config);
  const shell = document.createElement("div");
  shell.className = "dynamic-area-workspace dynamic-preview";

  const dataCard = createDynamicDataCard(config);
  const mainCard = createDynamicMainCard(area, config);

  shell.append(dataCard, mainCard);
  return shell;
}

function createDynamicDataCard(config) {
  const card = document.createElement("article");
  card.className = "admin-panel dynamic-data-card";

  const heading = document.createElement("div");
  heading.className = "admin-panel-head";
  const label = document.createElement("span");
  label.textContent = "Entrada";
  const title = document.createElement("strong");
  title.textContent = getAreaDataSourceLabel(config.dataSource);
  heading.append(label, title);

  const list = document.createElement("div");
  list.className = "dynamic-chip-list";
  ["Arquivo", "Drive", "SQL"].forEach((item) => {
    const chip = document.createElement("span");
    chip.className = item.toLowerCase() === getAreaDataSourceMode(config.dataSource) ? "active" : "";
    chip.textContent = item;
    list.appendChild(chip);
  });

  card.append(heading, list);
  return card;
}

function createDynamicMainCard(area, config) {
  const card = document.createElement("article");
  card.className = "admin-panel dynamic-screen-card";

  const shell = document.createElement("div");
  shell.className = "dynamic-preview-shell";

  const osList = document.createElement("section");
  osList.className = "dynamic-list-panel";

  const title = document.createElement("strong");
  title.textContent = area.name;

  const search = document.createElement("div");
  search.className = "dynamic-search-pill";
  search.textContent = config.inputs[0] || "Filtro O.S.";

  const orders = ["ASP-0001/2026", "ASP-0002/2026", "ASP-0003/2026", "ASP-0004/2026"];
  const detail = document.createElement("section");
  detail.className = "dynamic-detail-card";

  orders.forEach((order, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dynamic-record-button";
    button.textContent = order;
    button.addEventListener("click", () => {
      osList.querySelectorAll(".dynamic-record-button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderDynamicDetail(detail, order, config);
    });
    osList.appendChild(button);
  });

  osList.prepend(search);
  osList.prepend(title);

  renderDynamicSummary(detail, orders, config);
  shell.append(osList, detail);
  card.appendChild(shell);
  return card;
}

function renderDynamicSummary(container, orders, config) {
  container.textContent = "";

  const title = document.createElement("strong");
  title.textContent = "Resumo";

  const outputGrid = document.createElement("div");
  outputGrid.className = "dynamic-output-grid";

  [
    ["Total de O.S.", String(orders.length)],
    ["Discrepâncias", "0 pendentes"],
    ["Fonte", getAreaDataSourceLabel(config.dataSource)],
    ["Campos", String(config.inputs.length + config.outputs.length + config.charts.length)]
  ].forEach(([labelText, valueText]) => {
    const item = document.createElement("div");
    item.className = "dynamic-output";
    const label = document.createElement("span");
    label.textContent = labelText;
    const value = document.createElement("strong");
    value.textContent = valueText;
    item.append(label, value);
    outputGrid.appendChild(item);
  });

  const chart = document.createElement("div");
  chart.className = "dynamic-chart-preview";
  const chartTitle = document.createElement("span");
  chartTitle.textContent = config.charts[0] || "O.S. por status";
  chart.appendChild(chartTitle);

  container.append(title, outputGrid, chart);
}

function renderDynamicDetail(container, order, config) {
  container.textContent = "";

  const title = document.createElement("strong");
  title.textContent = order;

  const outputGrid = document.createElement("div");
  outputGrid.className = "dynamic-output-grid";
  const outputs = config.outputs.length ? config.outputs : ["Número da O.S.", "Pendente", "Discrepâncias"];
  outputs.slice(0, 4).forEach((output, index) => {
    const item = document.createElement("div");
    item.className = "dynamic-output";
    const label = document.createElement("span");
    label.textContent = output;
    const value = document.createElement("strong");
    value.textContent = getDynamicOutputValue(output, order, index);
    item.append(label, value);
    outputGrid.appendChild(item);
  });

  const componentCard = document.createElement("div");
  componentCard.className = "dynamic-component-card";
  [
    ["Nome do componente", "Componente selecionado"],
    ["Empresa do componente", "HBR"],
    ["Revisão", "Aguardando"],
    ["Data da revisão", "-"]
  ].forEach(([labelText, valueText]) => {
    const row = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = labelText;
    const value = document.createElement("strong");
    value.textContent = valueText;
    row.append(label, value);
    componentCard.appendChild(row);
  });

  const obs = document.createElement("div");
  obs.className = "dynamic-obs-box";
  obs.textContent = "Obs:";

  container.append(title, outputGrid, componentCard, obs);
}

function getDynamicOutputValue(output, order, index) {
  const normalized = normalizeText(output);
  if (normalized.includes("NUMERO") || normalized.includes("O S") || normalized.includes("OS")) return order;
  if (normalized.includes("STATUS")) return "Pendente";
  if (normalized.includes("DISCREP")) return "-";
  if (normalized.includes("COMPONENT")) return "Componente selecionado";
  return index === 0 ? order : "-";
}

function createSpreadsheetFieldMap(fields) {
  return fields.reduce((map, field) => {
    map.set(normalizeSpreadsheetFieldName(field), field);
    return map;
  }, new Map());
}

function pickSpreadsheetField(fieldMap, aliases) {
  for (const alias of aliases) {
    const direct = fieldMap.get(normalizeSpreadsheetFieldName(alias));
    if (direct) return direct;
  }

  for (const [normalized, original] of fieldMap.entries()) {
    if (aliases.some((alias) => normalized.includes(normalizeSpreadsheetFieldName(alias)))) return original;
  }

  return "";
}

function normalizeSpreadsheetFieldName(value) {
  return normalizeText(value).replace(/[^A-Z0-9]+/g, " ").trim();
}

function getSpreadsheetRecordValue(record, field) {
  return field ? cleanTextLine(record?.[field] || "") : "";
}

function renderAdminPanel() {
  if (el.adminAreaCount) el.adminAreaCount.textContent = "5";
  renderAdminSiteTree();
  renderAdminAreaList();
  renderAdScopeSummary();
  renderAdminUsers();
}

function renderAdminUsers() {
  if (!el.adminUsersList) return;
  el.adminUsersList.textContent = "";

  if (!adminUsers.length) {
    const empty = document.createElement("div");
    empty.className = "admin-users-empty";
    empty.textContent = "Nenhum usuário registrado nesta lista ainda.";
    el.adminUsersList.appendChild(empty);
    return;
  }

  const users = [...adminUsers].sort((a, b) => new Date(b.ultimoOnlineISO || 0) - new Date(a.ultimoOnlineISO || 0));
  users.forEach((user) => {
    const row = document.createElement("article");
    row.className = "admin-user-row";

    const content = document.createElement("div");
    const email = document.createElement("strong");
    email.textContent = user.email || "Usuário sem e-mail";

    const meta = document.createElement("span");
    meta.textContent = user.ultimoOnline || "Sem registro de acesso";

    content.append(email, meta);

    const status = document.createElement("span");
    const isOnline = user.email === auth.currentUser?.email;
    status.className = `admin-user-status${isOnline ? " is-online" : ""}`;
    status.textContent = isOnline ? "online" : "registro";

    row.append(content, status);
    el.adminUsersList.appendChild(row);
  });
}

function renderAdminSiteTree() {
  if (!el.adminSiteTree) return;
  el.adminSiteTree.textContent = "";

  el.adminSiteTree.className = "site-map-tree admin-flow-map";
  const root = createFlowGroup("HBR", [
    createFlowNode("Sistema", "Raiz", "root"),
    createFlowNode("Usuário", "Login Firebase", "auth")
  ]);
  const quarantine = createFlowGroup("Qualidade", [
    createFlowNode("Lista atual", "Cards e filtros", "page"),
    createFlowNode("Dashboard", "Gráficos e indicadores", "page"),
    createFlowNode("Histórico", "Linha do tempo", "page"),
    createFlowNode("Itens", "Planilha FQ-067", "modal"),
    createFlowNode("Consulta RAB", "ANAC", "modal")
  ]);
  const admin = createFlowGroup("Admin", [
    createFlowNode("Mapa", "Ramificações", "tool"),
    createFlowNode("Entrada Excel", "Colunas e linhas", "tool"),
    createFlowNode("Publicações", "Rede técnica", "tool"),
    createFlowNode("Lembretes", "Checklist", "tool"),
    createFlowNode("Histórico", "Reversão", "tool")
  ]);
  const publications = createFlowGroup("Publicações", [
    createFlowNode("Rede técnica", "FQ, IT e PRQ", "page"),
    createFlowNode("Pesquisa de ADs", "Linhas e motores", "page"),
    createFlowNode("Notificações de AD", "Alertas por linha", "page"),
    createFlowNode("Relações", "Impacto por setor", "tool"),
    createFlowNode("Configuração", "Células e links", "tool"),
    createFlowNode("Relatórios AD", "Diário e semanal", "tool")
  ]);

  el.adminSiteTree.append(root, createFlowLine(), quarantine, createFlowLine(), publications, createFlowLine(), admin);
}

function createFlowGroup(title, nodes) {
  const group = document.createElement("section");
  group.className = "flow-group";

  const heading = document.createElement("strong");
  heading.textContent = title;

  const list = document.createElement("div");
  list.className = "flow-node-list";
  nodes.forEach((node) => list.appendChild(node));

  group.append(heading, list);
  return group;
}

function createFlowNode(title, description, type) {
  const node = document.createElement("article");
  node.className = `flow-node ${type}`;

  const marker = document.createElement("span");
  marker.className = "flow-node-marker";

  const content = document.createElement("div");
  const titleEl = document.createElement("strong");
  titleEl.textContent = title;

  const descriptionEl = document.createElement("span");
  descriptionEl.textContent = description;

  content.append(titleEl, descriptionEl);
  node.append(marker, content);
  return node;
}

function createFlowLine() {
  const line = document.createElement("span");
  line.className = "flow-line";
  return line;
}

function renderAdminAreaList() {
  if (!el.adminAreasList) return;
  el.adminAreasList.textContent = "";

  const quarantine = createAdminAreaCard({
    id: "quarentena",
    name: "Qualidade",
    description: "Controle atual de aeronaves em quarentena, itens, dashboard e histórico.",
    status: "Ativa",
    locked: true
  });
  const publications = createAdminAreaCard({
    id: "publicacoes",
    name: "Publicações",
    description: "Rede técnica de FQs, ITs e PRQs importada por Excel ou ajustada manualmente.",
    status: "Ativa",
    locked: true
  });
  const adSearch = createAdminAreaCard({
    id: "pesquisa-ads",
    name: "Pesquisa de ADs",
    description: "Monitoramento de ADs por linha operacional, motores do escopo, data e relatórios diário/semanal.",
    status: "Ativa",
    locked: true
  });
  const adNotifications = createAdminAreaCard({
    id: "notificacoes-ads",
    name: "Notificações de AD",
    description: "Segunda página de alertas gerados pela lista consolidada de ADs monitoradas.",
    status: "Ativa",
    locked: true
  });
  const importacao = createAdminAreaCard({
    id: "entrada-documentos",
    name: "Entrada de documentos",
    description: "Mapeamento de colunas e linhas do Excel para alimentar a rede técnica.",
    status: "Restrita",
    locked: true
  });

  el.adminAreasList.append(quarantine, publications, adSearch, adNotifications, importacao);
}

function createAdminAreaCard(area) {
  const card = document.createElement("article");
  card.className = "admin-area-card";

  const label = document.createElement("span");
  label.textContent = area.status;

  const title = document.createElement("strong");
  title.textContent = area.name;

  const description = document.createElement("p");
  description.textContent = area.description;

  const actions = document.createElement("div");
  actions.className = "admin-card-actions";

  if (!area.locked) {
    const editButton = createAdminIconButton("edit", "Editar área");
    editButton.addEventListener("click", () => editAdminArea(area.id));

    const deleteButton = createAdminIconButton("delete", "Excluir área");
    deleteButton.addEventListener("click", () => deleteAdminArea(area.id));

    actions.append(editButton, deleteButton);
  } else {
    const fixed = document.createElement("span");
    fixed.className = "admin-fixed-label";
    fixed.textContent = "Módulo fixo";
    actions.appendChild(fixed);
  }

  card.append(label, title, description, actions);
  return card;
}

function openAreaBuilder(area = null) {
  if (!el.adminAreaBuilderModal) return;
  areaBuilderMode = area ? "edit" : "create";
  editingAreaId = area?.id || null;
  resetAreaBuilderFields(area);
  el.adminAreaBuilderModal.hidden = false;
  updateAreaBuilderPreview();
  setTimeout(() => el.adminAreaName?.focus(), 0);
}

function closeAreaBuilder() {
  if (el.adminAreaBuilderModal) el.adminAreaBuilderModal.hidden = true;
  areaBuilderSelectedNode = null;
  areaBuilderPendingPointer = null;
}

function resetAreaBuilderFields(area = null) {
  const config = normalizeAreaConfig(area?.config);

  if (el.adminAreaBuilderTitle) el.adminAreaBuilderTitle.textContent = area ? "Editar área" : "Criar área";
  if (el.adminAreaBuilderSubmitBtn) el.adminAreaBuilderSubmitBtn.textContent = area ? "Salvar área" : "Criar área";
  if (el.adminAreaName) el.adminAreaName.value = area?.name || "";
  if (el.adminAreaDescription) el.adminAreaDescription.value = area?.description || "";
  if (el.adminAreaDataSource) el.adminAreaDataSource.value = config.dataSource;
  if (el.adminAreaDriveUrl) el.adminAreaDriveUrl.value = config.sourceDetails.driveUrl || "";
  if (el.adminAreaSqlQuery) el.adminAreaSqlQuery.value = config.sourceDetails.sqlQuery || "";
  if (el.adminAreaFileInput) el.adminAreaFileInput.value = "";
  if (el.adminAreaNewInput) el.adminAreaNewInput.value = "";
  if (el.adminAreaNewOutput) el.adminAreaNewOutput.value = "";
  if (el.adminAreaNewChart) el.adminAreaNewChart.value = "";

  areaBuilderComponents = {
    inputs: [...config.inputs],
    outputs: [...config.outputs],
    charts: [...config.charts]
  };
  areaBuilderLinks = [...config.links];
  areaBuilderSelectedNode = null;
  areaBuilderPendingPointer = null;
  areaBuilderFields = [...config.fields];
  areaBuilderRows = [];
  areaBuilderSourceDetails = { ...config.sourceDetails };
  areaBuilderNodePositions = { ...config.nodePositions };
  setAdminAreaMessage("", "info");
}

function updateAreaBuilderPreview() {
  updateAreaSourcePanels();
  updateAreaFieldInsights();

  const config = getAreaBuilderConfig();

  renderAreaBuilderSlot(el.areaPreviewInputs, config.inputs, "Nenhum input");
  renderAreaBuilderSlot(el.areaPreviewOutputs, config.outputs, "Nenhum output");
  renderAreaBuilderSlot(el.areaPreviewCharts, config.charts, "Nenhum gráfico");
  if (el.areaPreviewDataSource) el.areaPreviewDataSource.textContent = getAreaDataSourceLabel(config.dataSource);

  if (el.adminAreaLinkCanvas) {
    el.adminAreaLinkCanvas.textContent = "";
    el.adminAreaLinkCanvas.appendChild(createAreaLinkCanvas(config));
  }

  if (el.adminAreaCanvasStatus) {
    el.adminAreaCanvasStatus.textContent = `${config.links.length} ${config.links.length === 1 ? "link" : "links"}`;
  }

}

function renderAreaBuilderSlot(container, items, emptyText) {
  if (!container) return;
  container.textContent = "";

  if (!items.length) {
    const empty = document.createElement("span");
    empty.className = "slot-empty";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "slot-chip";
    const label = document.createElement("span");
    label.textContent = item;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "x";
    remove.setAttribute("aria-label", `Remover ${item}`);
    remove.addEventListener("click", () => removeAreaBuilderComponent(item));
    chip.append(label, remove);
    container.appendChild(chip);
  });
}

function addAreaBuilderComponent(type, typedValue = "") {
  const key = normalizeAreaComponentKey(type);
  if (!key) return;

  const labels = {
    inputs: "Novo input",
    outputs: "Novo output",
    charts: "Novo gráfico"
  };

  // O mesmo ponto de entrada alimenta o preview da tela e os nos do canvas.
  const rawValue = arguments.length > 1 ? typedValue : window.prompt(labels[key], "");
  const value = cleanTextLine(rawValue || "");
  if (!value) return;

  const exists = areaBuilderComponents[key].some((item) => normalizeText(item) === normalizeText(value));
  if (!exists) areaBuilderComponents[key] = [...areaBuilderComponents[key], value];
  updateAreaBuilderPreview();
}

function getAreaBuilderNameInput(type) {
  const key = normalizeAreaComponentKey(type);
  if (key === "inputs") return el.adminAreaNewInput;
  if (key === "outputs") return el.adminAreaNewOutput;
  if (key === "charts") return el.adminAreaNewChart;
  return null;
}

function removeAreaBuilderComponent(value) {
  const normalized = normalizeText(value);
  Object.keys(areaBuilderComponents).forEach((key) => {
    areaBuilderComponents[key] = areaBuilderComponents[key].filter((item) => normalizeText(item) !== normalized);
  });

  const removedIds = [
    `input:${slugifyAreaName(value)}`,
    `output:${slugifyAreaName(value)}`,
    `chart:${slugifyAreaName(value)}`
  ];
  areaBuilderLinks = areaBuilderLinks.filter((link) => !removedIds.includes(link.from) && !removedIds.includes(link.to));
  removedIds.forEach((id) => delete areaBuilderNodePositions[id]);
  updateAreaBuilderPreview();
}

function normalizeAreaComponentKey(type) {
  return ["inputs", "outputs", "charts"].includes(type) ? type : "";
}

function getAreaBuilderConfig() {
  const sourceDetails = {
    driveUrl: cleanTextLine(el.adminAreaDriveUrl?.value || ""),
    sqlQuery: cleanTextLine(el.adminAreaSqlQuery?.value || ""),
    fileName: el.adminAreaFileInput?.files?.[0]?.name || areaBuilderSourceDetails.fileName || "",
    rowCount: areaBuilderRows.length || Number(areaBuilderSourceDetails.rowCount || 0)
  };

  return normalizeAreaConfig({
    dataSource: el.adminAreaDataSource?.value || "excel-file",
    inputs: areaBuilderComponents.inputs,
    outputs: areaBuilderComponents.outputs,
    charts: areaBuilderComponents.charts,
    links: areaBuilderLinks,
    fields: areaBuilderFields,
    sourceDetails,
    nodePositions: areaBuilderNodePositions
  });
}

function normalizeAreaConfig(config = {}) {
  return {
    dataSource: AREA_DATA_SOURCE_LABELS[config.dataSource] ? config.dataSource : "excel-file",
    inputs: normalizeAreaList(config.inputs, []),
    outputs: normalizeAreaList(config.outputs, []),
    charts: normalizeAreaList(config.charts, []),
    links: normalizeAreaLinks(config.links),
    fields: normalizeAreaList(config.fields, []),
    nodePositions: normalizeAreaNodePositions(config.nodePositions),
    sourceDetails: {
      driveUrl: cleanTextLine(config.sourceDetails?.driveUrl || ""),
      sqlQuery: cleanTextLine(config.sourceDetails?.sqlQuery || ""),
      fileName: cleanTextLine(config.sourceDetails?.fileName || ""),
      rowCount: Number(config.sourceDetails?.rowCount || 0)
    }
  };
}

function normalizeAreaList(value, fallback) {
  if (Array.isArray(value)) {
    const cleaned = value.map(cleanTextLine).filter(Boolean);
    return cleaned.length ? cleaned : fallback;
  }
  const parsed = parseAreaLines(value);
  return parsed.length ? parsed : fallback;
}

function normalizeAreaNodePositions(value) {
  if (!value || typeof value !== "object") return {};
  return Object.entries(value).reduce((acc, [id, position]) => {
    const x = Number(position?.x);
    const y = Number(position?.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      acc[id] = {
        x: Math.min(Math.max(x, 2), 82),
        y: Math.min(Math.max(y, 2), 84)
      };
    }
    return acc;
  }, {});
}

function parseAreaLines(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map(cleanTextLine)
    .filter(Boolean);
}

function getAreaDataSourceLabel(value) {
  return AREA_DATA_SOURCE_LABELS[value] || AREA_DATA_SOURCE_LABELS["excel-file"];
}

function getAreaDataSourceMode(value) {
  if (value === "excel-drive") return "drive";
  if (value === "sql") return "sql";
  return "arquivo";
}

function normalizeAreaLinks(value) {
  if (Array.isArray(value)) {
    return value
      .map((link) => {
        if (typeof link === "string") {
          const [from, to] = link.split("->").map((item) => slugifyAreaName(item));
          return from && to ? { from, to } : null;
        }
        return link?.from && link?.to ? { from: String(link.from), to: String(link.to) } : null;
      })
      .filter(Boolean);
  }
  return [...DEFAULT_AREA_BUILDER_LINKS];
}

function updateAreaSourcePanels() {
  const source = el.adminAreaDataSource?.value || "excel-file";
  if (el.adminAreaFilePanel) el.adminAreaFilePanel.hidden = source !== "excel-file";
  if (el.adminAreaDrivePanel) el.adminAreaDrivePanel.hidden = source !== "excel-drive";
  if (el.adminAreaSqlPanel) el.adminAreaSqlPanel.hidden = source !== "sql";
}

function updateAreaFieldInsights() {
  const source = el.adminAreaDataSource?.value || "excel-file";
  if (source === "sql") {
    const sqlFields = parseSqlFields(el.adminAreaSqlQuery?.value || "");
    if (sqlFields.length) areaBuilderFields = sqlFields;
  }
}

async function handleAreaExcelFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const parsed = await readAreaSpreadsheet(file);
    areaBuilderFields = parsed.fields;
    areaBuilderRows = parsed.rows;
    areaBuilderSourceDetails = {
      ...areaBuilderSourceDetails,
      fileName: file.name,
      rowCount: parsed.rows.length
    };
    syncSpreadsheetFieldsToBuilder(parsed.fields);
    setAdminAreaMessage(`${parsed.fields.length} campos lidos de ${file.name}.`, "info");
    updateAreaBuilderPreview();
  } catch (error) {
    console.error(error);
    setAdminAreaMessage("Não foi possível ler o arquivo Excel.", "error");
  }
}

async function handleAreaDriveUrl() {
  const url = cleanTextLine(el.adminAreaDriveUrl?.value || "");
  if (!url) return;

  try {
    const parsed = await readAreaDriveData(url);
    if (!parsed.fields.length) return;

    areaBuilderFields = parsed.fields;
    areaBuilderRows = parsed.rows;
    areaBuilderSourceDetails = {
      ...areaBuilderSourceDetails,
      driveUrl: url,
      rowCount: parsed.rows.length
    };
    syncSpreadsheetFieldsToBuilder(parsed.fields);
    setAdminAreaMessage(`${parsed.fields.length} campos lidos do link.`, "info");
    updateAreaBuilderPreview();
  } catch (error) {
    console.warn(error);
    areaBuilderSourceDetails = { ...areaBuilderSourceDetails, driveUrl: url };
    setAdminAreaMessage("Link salvo. Para ler campos automaticamente, use um link público exportável.", "info");
  }
}

async function readAreaSpreadsheet(file) {
  const buffer = await file.arrayBuffer();

  if (!window.XLSX) throw new Error("Biblioteca XLSX indisponível.");

  return parseAreaWorkbook(buffer);
}

async function readAreaDriveData(url) {
  const exportUrl = normalizeDriveSpreadsheetUrl(url);
  const response = await fetch(exportUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("Link de planilha indisponível.");

  const buffer = await response.arrayBuffer();
  return parseAreaWorkbook(buffer);
}

function parseAreaWorkbook(buffer) {
  if (!window.XLSX) throw new Error("Biblioteca XLSX indisponível.");

  const workbook = window.XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const headerIndex = rows.findIndex((row) => row.some((cell) => cleanTextLine(cell)));
  const headerRow = rows[headerIndex] || [];
  const fields = (headerRow || [])
    .map((cell) => cleanTextLine(cell))
    .filter(Boolean);
  const dataRows = rows.slice(headerIndex + 1).filter((row) => row.some((cell) => cleanTextLine(cell)));
  const records = dataRows.map((row) => {
    return fields.reduce((record, field, index) => {
      record[field] = cleanTextLine(row[index]);
      return record;
    }, {});
  });

  return {
    sheetName,
    fields,
    rows: dataRows,
    records
  };
}

function normalizeDriveSpreadsheetUrl(url) {
  const value = String(url || "").trim();
  const sheetMatch = value.match(/\/spreadsheets\/d\/([^/]+)/);
  if (sheetMatch) return `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=xlsx`;

  const driveMatch = value.match(/\/file\/d\/([^/]+)/) || value.match(/[?&]id=([^&]+)/);
  if (driveMatch) return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;

  return value;
}

function syncSpreadsheetFieldsToBuilder(fields) {
  const cleanFields = fields.map(cleanTextLine).filter(Boolean);
  if (!cleanFields.length) return;

  if (shouldReplaceAreaBuilderList(areaBuilderComponents.inputs, ["Filtro O.S.", "Busca por componente"])) {
    areaBuilderComponents.inputs = cleanFields.slice(0, 4);
  }

  if (shouldReplaceAreaBuilderList(areaBuilderComponents.outputs, ["Número da O.S.", "Status", "Discrepâncias", "Detalhes do componente"])) {
    areaBuilderComponents.outputs = cleanFields.slice(0, 6);
  }

  if (shouldReplaceAreaBuilderList(areaBuilderComponents.charts, ["O.S. por status", "Pendencias por periodo"])) {
    areaBuilderComponents.charts = [`${cleanFields[0]} por status`, `${cleanFields[0]} por periodo`];
  }
}

function shouldReplaceAreaBuilderList(value, defaults) {
  const current = Array.isArray(value) ? value : [];
  return !current.length || current.join("|") === defaults.join("|");
}

function parseSqlFields(value) {
  const match = String(value || "").match(/select\s+(.+?)\s+from/i);
  if (!match) return [];
  const raw = match[1].trim();
  if (raw === "*") return [];
  return raw
    .split(",")
    .map((field) => cleanTextLine(field.replace(/\s+as\s+.+$/i, "")))
    .filter(Boolean);
}

function createAreaLinkCanvas(config) {
  const board = document.createElement("div");
  board.className = "area-link-board";

  const nodes = createAreaCanvasNodes(config);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  areaBuilderLinks = areaBuilderLinks.filter((link) => nodeMap.has(link.from) && nodeMap.has(link.to));

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "area-link-svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "areaArrow");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "6");
  marker.setAttribute("markerHeight", "6");
  marker.setAttribute("orient", "auto-start-reverse");
  const markerPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  markerPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  marker.appendChild(markerPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  const pathLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  pathLayer.setAttribute("class", "area-link-path-layer");
  svg.appendChild(pathLayer);

  const renderPaths = () => renderAreaCanvasPaths(pathLayer, nodeMap);

  board.appendChild(svg);

  board.addEventListener("pointermove", (event) => {
    if (!areaBuilderSelectedNode) return;
    const rect = board.getBoundingClientRect();
    areaBuilderPendingPointer = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100
    };
    renderPaths();
  });

  nodes.forEach((node) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `area-canvas-node ${node.type}${areaBuilderSelectedNode === node.id ? " selected" : ""}`;
    button.style.left = `${node.x}%`;
    button.style.top = `${node.y}%`;
    button.dataset.nodeId = node.id;
    const label = document.createElement("span");
    label.className = "area-canvas-label";
    label.textContent = node.label;
    const port = document.createElement("span");
    port.className = `area-canvas-port${areaBuilderSelectedNode === node.id ? " active" : ""}`;
    port.title = "Linkar bloco";
    port.addEventListener("pointerdown", (event) => event.stopPropagation());
    port.addEventListener("click", (event) => {
      event.stopPropagation();
      handleAreaCanvasPortClick(node.id);
    });
    button.append(label, port);
    button.addEventListener("pointerdown", (event) => startAreaCanvasDrag(event, board, button, node, renderPaths));
    board.appendChild(button);
  });

  renderPaths();
  return board;
}

function createAreaCanvasNodes(config) {
  const positions = { ...config.nodePositions, ...areaBuilderNodePositions };
  const withPosition = (node) => ({ ...node, ...(positions[node.id] || {}) });
  const nodes = [withPosition({ id: "source:entrada", label: getAreaDataSourceLabel(config.dataSource), type: "source", x: 6, y: 42 })];
  const inputs = config.inputs;
  const outputs = config.outputs;
  const charts = config.charts;

  // As posições iniciais mantêm as classes separadas; depois o usuário pode arrastar no canvas.
  inputs.forEach((label, index) => nodes.push(withPosition({ id: `input:${slugifyAreaName(label)}`, label, type: "input", x: 31, y: getAreaCanvasStackY(index, inputs.length, 12, 74) })));
  outputs.forEach((label, index) => nodes.push(withPosition({ id: `output:${slugifyAreaName(label)}`, label, type: "output", x: 58, y: getAreaCanvasStackY(index, outputs.length, 10, 54) })));
  charts.forEach((label, index) => nodes.push(withPosition({ id: `chart:${slugifyAreaName(label)}`, label, type: "chart", x: 58, y: getAreaCanvasStackY(index, charts.length, 66, 84) })));

  return nodes;
}

function getAreaCanvasStackY(index, total, start, end) {
  if (total <= 1) return start;
  const step = (end - start) / Math.max(total - 1, 1);
  return Math.min(Math.max(start + index * step, 2), 84);
}

function renderAreaCanvasPaths(pathLayer, nodeMap) {
  pathLayer.textContent = "";

  areaBuilderLinks.forEach((link) => {
    const from = nodeMap.get(link.from);
    const to = nodeMap.get(link.to);
    if (!from || !to) return;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const startX = from.x + 17;
    const startY = from.y + 7;
    const endX = to.x;
    const endY = to.y + 7;
    const curve = Math.max(8, Math.abs(endX - startX) / 2);

    path.setAttribute("d", `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`);
    path.setAttribute("class", "area-link-path");
    path.setAttribute("marker-end", "url(#areaArrow)");
    pathLayer.appendChild(path);
  });

  if (areaBuilderSelectedNode && areaBuilderPendingPointer) {
    const from = nodeMap.get(areaBuilderSelectedNode);
    if (from) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const startX = from.x + 17;
      const startY = from.y + 7;
      const endX = areaBuilderPendingPointer.x;
      const endY = areaBuilderPendingPointer.y;
      const curve = Math.max(8, Math.abs(endX - startX) / 2);
      path.setAttribute("d", `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`);
      path.setAttribute("class", "area-link-path pending");
      path.setAttribute("marker-end", "url(#areaArrow)");
      pathLayer.appendChild(path);
    }
  }
}

function startAreaCanvasDrag(event, board, button, node, renderPaths) {
  if (event.button !== 0) return;

  event.preventDefault();
  button.setPointerCapture?.(event.pointerId);
  const rect = board.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  const offsetX = event.clientX - buttonRect.left;
  const offsetY = event.clientY - buttonRect.top;
  let moved = false;

  const move = (moveEvent) => {
    const x = ((moveEvent.clientX - rect.left - offsetX) / rect.width) * 100;
    const y = ((moveEvent.clientY - rect.top - offsetY) / rect.height) * 100;
    node.x = Math.min(Math.max(x, 2), 82);
    node.y = Math.min(Math.max(y, 2), 84);
    areaBuilderNodePositions[node.id] = { x: node.x, y: node.y };
    button.style.left = `${node.x}%`;
    button.style.top = `${node.y}%`;
    moved = true;
    renderPaths();
  };

  const stop = () => {
    button.releasePointerCapture?.(event.pointerId);
    button.removeEventListener("pointermove", move);
    button.removeEventListener("pointerup", stop);
    button.removeEventListener("pointercancel", stop);
    button.dataset.dragged = moved ? "true" : "false";
  };

  button.addEventListener("pointermove", move);
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointercancel", stop);
}

function handleAreaCanvasPortClick(nodeId) {
  if (!areaBuilderSelectedNode) {
    areaBuilderSelectedNode = nodeId;
    areaBuilderPendingPointer = null;
    updateAreaBuilderPreview();
    return;
  }

  if (areaBuilderSelectedNode === nodeId) {
    areaBuilderSelectedNode = null;
    areaBuilderPendingPointer = null;
    updateAreaBuilderPreview();
    return;
  }

  const nextLink = { from: areaBuilderSelectedNode, to: nodeId };
  const exists = areaBuilderLinks.some((link) => link.from === nextLink.from && link.to === nextLink.to);
  if (!exists) areaBuilderLinks = [...areaBuilderLinks, nextLink];
  areaBuilderSelectedNode = null;
  areaBuilderPendingPointer = null;
  updateAreaBuilderPreview();
}

function handleCreateAdminArea(event) {
  event.preventDefault();
  const name = cleanTextLine(el.adminAreaName?.value || "");
  const description = cleanTextLine(el.adminAreaDescription?.value || "");
  const id = slugifyAreaName(name);
  const config = getAreaBuilderConfig();

  if (!name || !id) {
    setAdminAreaMessage("Informe o nome da área.", "error");
    return;
  }

  const alreadyExists = dynamicSiteAreas.some((area) => area.id === id && area.id !== editingAreaId)
    || ["tabela", "dashboard", "historico", "admin"].includes(id);
  if (alreadyExists) {
    setAdminAreaMessage("Essa área já existe.", "error");
    return;
  }

  if (areaBuilderMode === "edit" && editingAreaId) {
    const current = dynamicSiteAreas.find((area) => area.id === editingAreaId);
    const next = { ...current, id, name, description, config, updatedAt: new Date().toISOString() };
    dynamicSiteAreas = dynamicSiteAreas.map((area) => (area.id === editingAreaId ? next : area));
    saveStoredAdminAreas();
    recordAdminHistory("area:update", "Área editada", current, next);
    setAdminAreaMessage("Área editada.", "info");
  } else {
    const newArea = { id, name, description, config, createdAt: new Date().toISOString() };
    dynamicSiteAreas = [...dynamicSiteAreas, newArea];
    saveStoredAdminAreas();
    recordAdminHistory("area:create", "Área criada", null, newArea);
    setAdminAreaMessage("Área criada.", "info");
  }

  closeAreaBuilder();
  renderAdminShell();
}

function editAdminArea(areaId) {
  const current = dynamicSiteAreas.find((area) => area.id === areaId);
  if (!current) return;
  openAreaBuilder(current);
}

function deleteAdminArea(areaId) {
  const current = dynamicSiteAreas.find((area) => area.id === areaId);
  if (!current) return;

  if (!window.confirm(`Excluir a área "${current.name}"?`)) return;

  dynamicSiteAreas = dynamicSiteAreas.filter((area) => area.id !== areaId);
  saveStoredAdminAreas();
  recordAdminHistory("area:delete", "Área excluída", current, null);
  setAdminAreaMessage("Área excluída.", "info");
  renderAdminShell();
}

function setAdminAreaMessage(message, type = "info") {
  if (!el.adminAreaMessage) return;
  el.adminAreaMessage.textContent = message;
  el.adminAreaMessage.className = `edit-message ${type}`;
}

function handleCreateReminder(event) {
  event.preventDefault();
  const text = cleanTextLine(el.adminReminderText?.value || "");
  if (!text) return;

  const newReminder = { id: `reminder-${Date.now()}`, text, done: false };
  adminReminders = [...adminReminders, newReminder];
  saveStoredReminders();
  recordAdminHistory("reminder:create", "Lembrete criado", null, newReminder);
  if (el.adminReminderText) el.adminReminderText.value = "";
  renderAdminChecklist();
  renderAdminHistory();
}

function renderAdminChecklist() {
  if (!el.adminChecklist) return;
  el.adminChecklist.textContent = "";

  adminReminders.forEach((reminder, index) => {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "admin-reminder";
    input.value = String(index + 1);
    input.id = `admin-reminder-${reminder.id}`;
    input.checked = Boolean(reminder.done);
    input.addEventListener("change", () => {
      const before = { ...reminder };
      const after = { ...reminder, done: input.checked };
      adminReminders = adminReminders.map((item) => (
        item.id === reminder.id ? after : item
      ));
      saveStoredReminders();
      recordAdminHistory("reminder:update", "Lembrete atualizado", before, after);
      renderAdminHistory();
    });

    const label = document.createElement("label");
    label.htmlFor = input.id;
    label.textContent = reminder.text;

    const actions = document.createElement("div");
    actions.className = "reminder-actions";

    const editButton = createAdminIconButton("edit", "Editar lembrete");
    editButton.addEventListener("click", () => editAdminReminder(reminder.id));

    const deleteButton = createAdminIconButton("delete", "Excluir lembrete");
    deleteButton.addEventListener("click", () => deleteAdminReminder(reminder.id));

    actions.append(editButton, deleteButton);
    el.adminChecklist.append(input, label, actions);
  });
}

function createAdminIconButton(type, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `admin-icon-action ${type}`;
  button.setAttribute("aria-label", label);
  button.title = label;

  const icon = document.createElement("span");
  icon.className = `admin-action-icon ${type === "edit" ? "icon-pencil" : "icon-trash"}`;

  button.appendChild(icon);
  return button;
}

function editAdminReminder(reminderId) {
  const current = adminReminders.find((reminder) => reminder.id === reminderId);
  if (!current) return;

  const text = cleanTextLine(window.prompt("Editar lembrete", current.text) || "");
  if (!text) return;

  const next = { ...current, text, updatedAt: new Date().toISOString() };
  adminReminders = adminReminders.map((reminder) => (reminder.id === reminderId ? next : reminder));
  saveStoredReminders();
  recordAdminHistory("reminder:update", "Lembrete editado", current, next);
  renderAdminChecklist();
  renderAdminHistory();
}

function deleteAdminReminder(reminderId) {
  const current = adminReminders.find((reminder) => reminder.id === reminderId);
  if (!current) return;

  if (!window.confirm(`Excluir o lembrete "${current.text}"?`)) return;

  adminReminders = adminReminders.filter((reminder) => reminder.id !== reminderId);
  saveStoredReminders();
  recordAdminHistory("reminder:delete", "Lembrete excluído", current, null);
  renderAdminChecklist();
  renderAdminHistory();
}

function loadStoredAdminAreas() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADMIN_AREAS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((area) => area?.id && area?.name) : [];
  } catch {
    return [];
  }
}

function saveStoredAdminAreas() {
  localStorage.setItem(ADMIN_AREAS_KEY, JSON.stringify(dynamicSiteAreas));
}

function loadStoredReminders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADMIN_REMINDERS_KEY) || "null");
    return Array.isArray(parsed) ? parsed : DEFAULT_ADMIN_REMINDERS;
  } catch {
    return DEFAULT_ADMIN_REMINDERS;
  }
}

function saveStoredReminders() {
  localStorage.setItem(ADMIN_REMINDERS_KEY, JSON.stringify(adminReminders));
}

function loadStoredAdminHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADMIN_HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredAdminHistory() {
  localStorage.setItem(ADMIN_HISTORY_KEY, JSON.stringify(adminHistory));
}

function recordAdminHistory(action, label, before, after) {
  adminHistory = [
    {
      id: `history-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      action,
      label,
      before: cloneAdminState(before),
      after: cloneAdminState(after),
      user: auth.currentUser?.email || "admin",
      createdAt: new Date().toLocaleString("pt-BR"),
      reverted: false
    },
    ...adminHistory
  ].slice(0, 60);
  saveStoredAdminHistory();
}

function cloneAdminState(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function renderAdminHistory() {
  if (!el.adminHistoryList) return;
  el.adminHistoryList.textContent = "";

  if (!adminHistory.length) {
    const empty = document.createElement("div");
    empty.className = "admin-history-empty";
    empty.textContent = "Nenhuma alteracao administrativa registrada.";
    el.adminHistoryList.appendChild(empty);
    return;
  }

  adminHistory.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "admin-history-item";

    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = entry.label;

    const meta = document.createElement("span");
    meta.textContent = `${entry.createdAt} | ${entry.user}`;

    content.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "admin-history-actions";

    if (canRevertAdminHistory(entry)) {
      const revertButton = document.createElement("button");
      revertButton.type = "button";
      revertButton.className = "admin-mini-action";
      revertButton.textContent = "Reverter";
      revertButton.addEventListener("click", () => revertAdminHistoryEntry(entry.id));
      actions.appendChild(revertButton);
    } else {
      const status = document.createElement("span");
      status.className = "admin-revert-status";
      status.textContent = entry.reverted ? "Revertido" : "Registro";
      actions.appendChild(status);
    }

    item.append(content, actions);
    el.adminHistoryList.appendChild(item);
  });
}

function canRevertAdminHistory(entry) {
  return !entry.reverted && ["reminder:update", "reminder:delete"].includes(entry.action);
}

function revertAdminHistoryEntry(historyId) {
  const entry = adminHistory.find((item) => item.id === historyId);
  if (!entry || !canRevertAdminHistory(entry)) return;

  if (entry.action.startsWith("area:")) {
    revertAreaHistory(entry);
  }

  if (entry.action.startsWith("reminder:")) {
    revertReminderHistory(entry);
  }

  adminHistory = adminHistory.map((item) => (
    item.id === historyId ? { ...item, reverted: true } : item
  ));
  saveStoredAdminHistory();
  renderAdminShell();
}

function revertAreaHistory(entry) {
  if (entry.action === "area:update" && entry.before) {
    dynamicSiteAreas = dynamicSiteAreas.map((area) => (
      area.id === entry.after?.id || area.id === entry.before?.id ? entry.before : area
    ));
  }

  if (entry.action === "area:delete" && entry.before) {
    const exists = dynamicSiteAreas.some((area) => area.id === entry.before.id);
    if (!exists) dynamicSiteAreas = [...dynamicSiteAreas, entry.before];
  }

  saveStoredAdminAreas();
}

function revertReminderHistory(entry) {
  if (entry.action === "reminder:update" && entry.before) {
    adminReminders = adminReminders.map((reminder) => (
      reminder.id === entry.before.id ? entry.before : reminder
    ));
  }

  if (entry.action === "reminder:delete" && entry.before) {
    const exists = adminReminders.some((reminder) => reminder.id === entry.before.id);
    if (!exists) adminReminders = [...adminReminders, entry.before];
  }

  saveStoredReminders();
}

function getDynamicAreaTabId(areaId) {
  return `area-${areaId}`;
}

function slugifyAreaName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function adicionarItem(e) {
  e.preventDefault();

  if (![el.newPrefixo.value, el.newProtocolo.value, el.newSetor.value, el.newEngenharia.value, el.newStatus.value].every(Boolean)) {
    alert("Preencha tudo");
    return;
  }

  const prefixo = el.newPrefixo.value.trim().toUpperCase();
  const protocolo = el.newProtocolo.value.trim().toUpperCase();
  const sourceMeta = getQuarantineMeta(prefixo);
  // Quando o prefixo existe na planilha, a linha também fica salva junto do cadastro.
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
    // O mesmo card de edição agora atualiza os três parâmetros operacionais.
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
  const rab = item.prefixo || "RAB não informado";
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
  // O filtro principal é sempre o prefixo da aeronave, igual à coluna Prefixo da planilha.
  const prefixo = normalizePrefix(item.prefixo);
  const items = getQuarantineItems(prefixo);
  const aircraft = resolveAircraft(item, data.indexOf(item));
  const saidas = items.filter((part) => part.saida).length;

  if (el.itemsAircraftTitle) el.itemsAircraftTitle.textContent = prefixo || "RAB não informado";
  if (el.itemsAircraftMeta) {
    el.itemsAircraftMeta.textContent = `${getModelText(item, aircraft)} | ${items.length} itens | ${saidas} saídas`;
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

  if (el.rabInfoTitle) el.rabInfoTitle.textContent = prefixo || "Prefixo não informado";
  if (el.rabInfoSubtitle) el.rabInfoSubtitle.textContent = "Registro Aeronáutico Brasileiro";
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
  // A página oficial do RAB usa este endpoint para retornar a consulta por prefixo.
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
  if (!proxyResponse.ok) throw new Error("Consulta RAB indisponível");
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
  const proprietarios = collectTableColumnValues(doc.querySelector("#proprietario"), "Proprietário");
  const operadores = collectOperatorNames(doc.querySelector("#operador"));

  return {
    fabricante: getExactInfoValue(infoRows, "Fabricante"),
    fabricanteModelo: getExactInfoValue(infoRows, "Fabricante / Modelo"),
    modelo: getExactInfoValue(infoRows, "Modelo"),
    proprietario: joinUniqueValues(proprietarios),
    operador: joinUniqueValues(operadores),
    situacao: firstValue(
      getExactInfoValue(infoRows, "Situação da Aeronave"),
      getExactInfoValue(infoRows, "Situação de Aeronavegabilidade")
    ),
    cva: getExactInfoValue(infoRows, "Data de Validade do CVA"),
    voo: getExactInfoValue(infoRows, "Tipo de Voo Autorizado"),
    motivos: firstValue(
      getExactInfoValue(infoRows, "Motivo(s)"),
      getExactInfoValue(infoRows, "Motivo do Cancelamento"),
      getExactInfoValue(infoRows, "Motivo de Suspensão")
    ),
    ano: getExactInfoValue(infoRows, "Ano de Fabricação")
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
    proprietario: map.get(cleanRabLabel("Proprietário")) || "",
    operador: map.get(cleanRabLabel("Operador")) || "",
    situacao: firstValue(map.get(cleanRabLabel("Situação da Aeronave")), map.get(cleanRabLabel("Situação de Aeronavegabilidade"))),
    cva: map.get(cleanRabLabel("Data de Validade do CVA")) || "",
    voo: map.get(cleanRabLabel("Tipo de voo autorizado")) || "",
    motivos: firstValue(map.get(cleanRabLabel("Motivo(s)")), map.get(cleanRabLabel("Motivo do Cancelamento")), map.get(cleanRabLabel("Motivo de Suspensão"))),
    ano: map.get(cleanRabLabel("Ano de Fabricação")) || ""
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
      ["Proprietário", info.proprietario],
      ["Operador", info.operador],
      ["Ano de fabricação", info.ano],
      ["Situação aeronavegabilidade", info.situacao],
      ["Validade do CVA", info.cva],
      ["Tipo de voo autorizado", info.voo],
      ["Motivos de restrição", info.motivos]
    ].forEach(([label, value]) => el.rabInfoContent.appendChild(createRabInfoCard(label, value)));
  }
}

function renderRabError(prefixo) {
  if (el.rabInfoStatus) {
    el.rabInfoStatus.textContent = "Não foi possível carregar os dados automaticamente. Tente novamente em alguns instantes.";
    el.rabInfoStatus.className = "rab-info-status error";
  }
  if (el.rabInfoContent) {
    el.rabInfoContent.textContent = "";
    [
      ["Prefixo", prefixo || "-"],
      ["Consulta", "Sem retorno automatico"],
      ["Origem", "Registro Aeronáutico Brasileiro"]
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
  exit.textContent = part.saida ? `Saída ${part.saida}` : "Sem saída";

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
    createDetail("Saídas", sourceSaidas || "-")
  );

  const actions = document.createElement("div");
  actions.className = "aircraft-actions";

  const infoButton = document.createElement("button");
  infoButton.type = "button";
  infoButton.className = "card-action info";
  infoButton.textContent = "Informações";
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
  // Totais principais do dashboard usam a coluna Saída da planilha como fonte.
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
  meta.textContent = `${line.saidas} saídas de ${line.total} itens`;

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
  meta.textContent = `${item.total} itens | ${item.saidas} saídas`;

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

  // Os gráficos são recriados ao abrir o dashboard para refletir a planilha atual.
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
          { label: "Saídas", data: saidas, backgroundColor: colors, borderRadius: 4 },
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
        labels: ["Com saída", "Sem saída"],
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
  if (tab === "admin" && !adminUnlocked) {
    openAdminGate();
    return;
  }

  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.getElementById(tab)?.classList.add("active");
  document.querySelectorAll("[data-tab-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tabTarget === tab);
    button.classList.toggle("is-selected", button.dataset.tabTarget === tab);
  });
  if (tab === "dashboard") gerarGrafico();
  if (tab === "historico") renderHistorico();
  if (tab === "tabela") renderTable();
  if (tab === "adPesquisa") renderAdMonitor();
  if (tab === "adNotificacoes") renderAdNotifications();
  if (tab === "publicacoes") {
    renderPublicationNetwork();
    startPublicationFloat();
  } else {
    stopPublicationFloat();
  }
  if (tab === "admin") renderAdminPanel();
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
  // A planilha foi agrupada por prefixo para a busca ficar simples e rápida no navegador.
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
  const explicitModel = pickValue(item, ["modelo", "aeronave", "helicoptero", "helicóptero", "tipo"]);
  const explicitAircraft = explicitModel
    ? AIRCRAFT_LIBRARY.find((aircraft) => aircraft.aliases.some((alias) => normalizeText(explicitModel).includes(alias)))
    : null;

  // Prefixos EB/FAB e Segurança e Defesa sempre usam o brasão enviado.
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
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/email-already-in-use": "Esse email ja tem cadastro.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/network-request-failed": "Falha de rede. Confira a internet e tente de novo.",
    "auth/unauthorized-domain": "Domínio não autorizado no Firebase para login."
  };

  return messages[code] || err?.message || "Não foi possível fazer login.";
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
