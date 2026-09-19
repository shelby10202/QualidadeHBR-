import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, deleteDoc, doc, updateDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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
const storage = getStorage(app);

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

// Carga inicial (851 não conformidades da planilha CONTROLE_DE_PAC.xlsx) usada só uma
// vez para semear o Firestore, e as listas de opções dos <select> do formulário.
const AUDIT_NC_SEED = window.AUDIT_NC_SEED || [];
const AUDIT_NC_OPTIONS = window.AUDIT_NC_OPTIONS || {
  clients: [], type: [], bases: [], status: [], step: [], riskAnalysis: [],
  recurrentInvestment: [], ncDept: [], ncSector: [], responsableSector: [],
  rootCauseCode: [], pacResponsibleName: [], auditType: []
};

// Modelos dos checklists de auditoria (CHKMNT-001, CHKMNT-003, CHKPNT-001, CHKFMA-001, CHKGRC-001).
// "spot": checklist de vistoria de setor (4 status: OK / NC / OM / N/A, com Linha/Slot e assinaturas).
// "grc": checklist de conformidade de registro por aeronave (3 status: OK / NOK / N/A).
const AUDIT_CHECKLIST_TEMPLATES = [
  {
    code: "CHKMNT-001",
    name: "Hangar de Manutenção",
    rev: "Rev.04",
    kind: "spot",
    ncDept: "Hangar de Manutenção",
    categories: [
      { name: "Segurança e Saúde", items: [
        { n: 1, text: "Colaboradores estão utilizando EPI adequados e sabem localizá-los?" },
        { n: 2, text: "Colaboradores sabem manusear e localizar todos os recipientes lava-olhos no hangar?" },
        { n: 3, text: "Os recipientes lava-olhos estão válidos conforme a etiqueta de inspeção e controle?" }
      ]},
      { name: "Infraestrutura, Organização e Limpeza", items: [
        { n: 4, text: "As instalações apresentam boas condições de organização, disposição, limpeza e conservação?" },
        { n: 5, text: "O layout do hangar está adequado, com distâncias mínimas entre aeronaves x equipamentos seguros?" },
        { n: 6, text: "O Hangar possui balizamento de segurança adequado?" },
        { n: 7, text: "A Iluminação do Hangar está adequada?" }
      ]},
      { name: "Identificação", items: [
        { n: 8, text: "Todos os artigos aeronáuticos presentes na oficina estão identificados com etiqueta conforme seu status de condição?" },
        { n: 9, text: "As etiquetas de identificação dos artigos aeronáuticos estão corretamente preenchidas?" },
        { n: 10, text: "Os químicos/inflamáveis estão corretamente identificados com a etiqueta do estoque?" },
        { n: 11, text: "Todas as caixas de armazenamento de materiais / peças estão identificadas corretamente?" }
      ]},
      { name: "Materiais / Artigos Aeronáuticos", items: [
        { n: 12, text: "Todos os materiais sujeitos a vida limite estão válidos e controlados?" },
        { n: 13, text: "As prateleiras/armários dedicados a aeronave em manutenção estão organizadas e corretamente identificadas, com segregação adequada dos materiais?" },
        { n: 14, text: "Os materiais dedicados a uma aeronave específica estão alocados na prateleira/armário correta desta aeronave?" },
        { n: 15, text: "Todos os materiais de aplicação presentes nas prateleiras/armários no slot da aeronave estão identificados e livres de objetos estranhos (F.O.D)?" },
        { n: 16, text: "Todos os componentes e peças removidos da aeronave para inspeção, estão armazenados e protegidos adequadamente na oficina?" },
        { n: 17, text: "Os artigos aeronáuticos condenados estão identificados com etiqueta vermelha, com formulário FQ-108 preenchido, e segregados na Quarentena (conforme aplicável)?" },
        { n: 18, text: "Todas as peças/químicos sobressalentes das aeronaves já entregues foram devolvidos ao Estoque?" }
      ]},
      { name: "Ferramentas", items: [
        { n: 19, text: "Os carrinhos de ferramentas estão organizados e limpos, com ferramentas posicionadas nos slots e sem objetos pessoais/suprimentos no carrinho?" },
        { n: 20, text: "Todas as ferramentas calibráveis estão válidas e com etiqueta de calibração legível e anexada a ferramenta?" }
      ]},
      { name: "Registros de Manutenção", items: [
        { n: 21, text: "Toda documentação da O.S está preenchida, assinada e carimbada corretamente?" }
      ]},
      { name: "Sistema Tendência", items: [
        { n: 22, text: "Inspetores, Mecânicos e Auxiliares estão apontados na aeronave e na tarefa em execução correta?" },
        { n: 23, text: "Todos os colaboradores estão com acesso ao Sistema Tendência e possuem cadastro?" },
        { n: 24, text: "Está sendo observado o registro da passagem de serviço na O.S?" }
      ]}
    ]
  },
  {
    code: "CHKMNT-003",
    name: "Oficinas de Componentes",
    rev: "Rev.01",
    kind: "spot",
    ncDept: "Oficinas de Componentes",
    categories: [
      { name: "Segurança e Saúde", items: [
        { n: 1, text: "Colaboradores estão utilizando EPI adequados e sabem localizá-los?" },
        { n: 2, text: "Colaboradores sabem manusear e localizar os recipientes lava-olhos na Oficina?" },
        { n: 3, text: "Os recipientes lava-olhos estão válidos conforme a etiqueta de inspeção e controle?" }
      ]},
      { name: "Infraestrutura, Organização e Limpeza", items: [
        { n: 4, text: "As instalações apresentam boas condições de organização, disposição, limpeza e conservação?" },
        { n: 5, text: "O layout da Oficina está adequado, com distâncias mínimas entre bancadas, máquinas e equipamentos segura?" },
        { n: 6, text: "A Oficina possui balizamento de segurança adequado?" },
        { n: 7, text: "A Iluminação da Oficina está adequada?" },
        { n: 8, text: "O controle de temperatura, umidade e pressão (FQ-042) está preenchido corretamente?" }
      ]},
      { name: "Identificação", items: [
        { n: 9, text: "Todos os artigos aeronáuticos presentes na oficina estão identificados com etiqueta conforme seu status de condição?" },
        { n: 10, text: "As etiquetas de identificação dos artigos aeronáuticos estão corretamente preenchidas?" },
        { n: 11, text: "Os químicos/inflamáveis estão corretamente identificados com a etiqueta do estoque?" }
      ]},
      { name: "Materiais / Artigos Aeronáuticos", items: [
        { n: 12, text: "Todos os materiais sujeitos a vida limite dentro da Oficina estão válidos e controlados?" },
        { n: 13, text: "Os artigos aeronáuticos estão segregados conforme seu status de condição? Artigos reparáveis (etiqueta amarela), artigos reparados (etiqueta verde) e artigos condenados (etiqueta vermelha)?" }
      ]},
      { name: "Ferramentas", items: [
        { n: 14, text: "Os formulários de Listagem de Ferramentas Calibráveis (FQ-076), Ferramentas Especiais (FQ-077) e Ferramentas Comuns (FQ-079) estão corretamente preenchidos e disponíveis?" },
        { n: 15, text: "O painel de ferramentas da Oficina, possui formulário de Layout e Inventário (FQ-003) preenchido corretamente e disponível?" },
        { n: 16, text: "O controle de entrada e saída de ferramentas da Oficina (FQ-040) está sendo efetuado corretamente?" },
        { n: 17, text: "Todas as ferramentas da Oficina estão identificadas, íntegras, organizadas e disponíveis?" },
        { n: 18, text: "Todas as ferramentas calibráveis estão válidas e com etiqueta de calibração legível e anexada a ferramenta?" }
      ]},
      { name: "Plano de Manutenção de Bancadas", items: [
        { n: 19, text: "Todos os Planos de Manutenção das Bancadas (FE-005) estão disponíveis e preenchidos corretamente?" }
      ]},
      { name: "Registros de Manutenção", items: [
        { n: 20, text: "O formulário de O.S (FQ-035) e todos os documentos da O.S estão corretamente preenchidos e disponíveis?" }
      ]},
      { name: "Sistema Tendência", items: [
        { n: 21, text: "Todos os colaboradores estão com acesso ao Sistema Tendência e possuem cadastro?" }
      ]}
    ]
  },
  {
    code: "CHKPNT-001",
    name: "Cabines de Pintura",
    rev: "Rev.02",
    kind: "spot",
    ncDept: "Cabines de Pintura",
    categories: [
      { name: "Identificação", items: [
        { n: 1, text: "Todos os componentes presentes na oficina estão identificados com etiqueta amarela (item reparável) e corretamente preenchidos?" },
        { n: 2, text: "As etiquetas de identificação dos artigos aeronáuticos estão corretamente preenchidas?" },
        { n: 3, text: "Todos os químicos e tintas presentes na oficina estão corretamente identificados com a etiqueta padrão do estoque HBR?" },
        { n: 4, text: "As bancadas de trabalho e as bandejas estão identificadas com o prefixo da aeronave em questão, evitando a destinação ou uso indevido dos itens (conforme aplicável)?" }
      ]},
      { name: "Materiais", items: [
        { n: 5, text: "Todos os químicos e tintas estão válidos e controlados?" }
      ]},
      { name: "Infraestrutura, Organização e Limpeza", items: [
        { n: 6, text: "As instalações apresentam boas condições de organização, disposição, limpeza e conservação?" },
        { n: 7, text: "A Iluminação da Oficina está adequada?" },
        { n: 8, text: "O controle de temperatura, umidade e pressão (FQ-042) está preenchido corretamente?" }
      ]},
      { name: "Segurança e Saúde", items: [
        { n: 9, text: "Colaboradores estão utilizando EPI adequados e sabem localizá-los?" },
        { n: 10, text: "Colaboradores sabem utilizar e localizar a estação de lava-olhos próximo a Oficina em caso de emergência?" }
      ]},
      { name: "Manutenção", items: [
        { n: 11, text: "A manutenção dos filtros de cada cabine de pintura está sendo realizada a cada 2 meses ou conforme necessário?" }
      ]},
      { name: "Sistema Tendência", items: [
        { n: 12, text: "Os colaboradores estão apontados corretamente na aeronave/componente em serviço e na tarefa específica em execução?" }
      ]}
    ]
  },
  {
    code: "CHKFMA-001",
    name: "F.M.A.",
    rev: "Rev.02",
    kind: "spot",
    ncDept: "F.M.A.",
    categories: [
      { name: "Segurança e Saúde", items: [
        { n: 1, text: "Colaboradores estão utilizando EPI adequados e sabem localizá-los?" },
        { n: 2, text: "Colaboradores sabem manusear e localizar os recipientes lava-olhos na Oficina?" },
        { n: 3, text: "Os recipientes lava-olhos estão válidos conforme a etiqueta de inspeção e controle?" },
        { n: 4, text: "A caixa de EPI disponível na área está em conformidade?" }
      ]},
      { name: "Infraestrutura, Organização e Limpeza", items: [
        { n: 5, text: "As instalações apresentam boas condições de organização, disposição, limpeza e conservação?" },
        { n: 6, text: "O layout da Oficina está adequado?" },
        { n: 7, text: "A Iluminação da Oficina está adequada?" }
      ]},
      { name: "Identificação", items: [
        { n: 8, text: "Todos os artigos aeronáuticos presentes na oficina estão identificados com etiqueta conforme seu status de condição (conforme aplicável)?" },
        { n: 9, text: "As etiquetas de identificação dos artigos aeronáuticos estão corretamente preenchidas?" },
        { n: 10, text: "Os químicos/inflamáveis estão corretamente identificados com a etiqueta do estoque?" }
      ]},
      { name: "Materiais / Artigos Aeronáuticos", items: [
        { n: 11, text: "Todos os materiais sujeitos a vida limite dentro da Oficina estão válidos e controlados?" },
        { n: 12, text: "Os artigos aeronáuticos estão segregados conforme seu status de condição? Artigos reparáveis (etiqueta amarela), artigos reparados (etiqueta verde) e artigos condenados (etiqueta vermelha)?" }
      ]},
      { name: "Ferramentas", items: [
        { n: 13, text: "Todas as ferramentas da Oficina estão identificadas, íntegras, organizadas e disponíveis?" },
        { n: 14, text: "Todas as ferramentas calibráveis estão válidas e com etiqueta de calibração legível e anexada a ferramenta?" }
      ]},
      { name: "Procedimentos Específicos", items: [
        { n: 15, text: "O procedimento \"POP FMA\", em sua última revisão, está sendo seguido pelos colaboradores? O procedimento em execução reflete o que está documentado?" },
        { n: 16, text: "O procedimento \"POP FMA – DEPARTAMENTO COMPOSTOS\", em sua última revisão, está sendo seguido pelos colaboradores? O procedimento em execução reflete o que está documentado?" }
      ]},
      { name: "Registros de Manutenção", items: [
        { n: 17, text: "O formulário de O.S (FP-050) e todos documentos da O.S estão corretamente preenchidos e disponíveis?" },
        { n: 18, text: "O formulário de O.S (FFMA-002 - COMPOSTOS) e todos documentos da O.S estão corretamente preenchidos e disponíveis?" }
      ]},
      { name: "Sistema Tendência", items: [
        { n: 19, text: "Todos os colaboradores estão com acesso ao Sistema Tendência e possuem cadastro?" }
      ]}
    ]
  },
  {
    code: "CHKGRC-001",
    name: "Gestão de Registro e Conformidade (GRC)",
    rev: "Rev.02",
    kind: "grc",
    ncDept: "Gestão de Registro e Conformidade",
    grcFields: [
      { key: "matricula", label: "Matrícula" },
      { key: "ordemServico", label: "Ordem de Serviço" },
      { key: "servico", label: "Serviço" },
      { key: "fabricante", label: "Fabricante" },
      { key: "modelo", label: "Modelo" },
      { key: "sn", label: "S/N" },
      { key: "motor", label: "Motor" },
      { key: "motorModelo", label: "Modelo do Motor" },
      { key: "motorSn", label: "S/N do Motor" },
      { key: "mecanico", label: "Mecânico" },
      { key: "inspetor", label: "Inspetor" },
      { key: "ctm", label: "CTM" }
    ],
    categories: [
      { name: "Verificação de Conformidade", items: [
        { n: 1, text: "Capa e Folha Rosto" },
        { n: 2, text: "Formulário Ordem de Serviço (O.S.) – FMNT-003" },
        { n: 3, text: "Lista / Ficha Discrepância" },
        { n: 4, text: "Ficha de Recebimento e Entrega de Aeronave" },
        { n: 5, text: "Mapa de Controle / Componentes" },
        { n: 6, text: "Lista de Grande Modificações, Reparos e itens Opcionais instalados na ocasião" },
        { n: 7, text: "Formulário de Certificado de Verificação de Aeronavegabilidade (CVA)" },
        { n: 8, text: "Relatório de Preservação - Célula / Motor(es)" },
        { n: 9, text: "Roteiro de Célula (Aeronave)" },
        { n: 10, text: "Roteiro de Motor(es)" },
        { n: 11, text: "Roteiro Componentes Instalados / Instruções Aeronavegabilidade Continua (ICA)" },
        { n: 12, text: "Diretrizes de Aeronavegabilidades (AD) / Boletins de Serviços (SB) / Fichas de Cumprimentos de DA (FCDA)" },
        { n: 13, text: "Log Card – Cópias / Removidos / Instalados / Atualizados" },
        { n: 14, text: "EASA Form1 / SegVoo 001 / SegVoo 003 / Certificados de Conformidade (CoC)" },
        { n: 15, text: "Ordem de Serviço (Relatório Tendência)" },
        { n: 16, text: "Ordem de Serviço (Relatório Cliente)" },
        { n: 17, text: "Etiquetas" }
      ]}
    ]
  }
];

function auditChecklistStatusOptions(kind) {
  return kind === "grc" ? ["OK", "NOK", "N/A"] : ["OK", "NC", "OM", "N/A"];
}

function auditChecklistFindingStatuses(kind) {
  // Quais status desse tipo de checklist geram um lançamento na área de Não Conformidades.
  return kind === "grc" ? ["NOK"] : ["NC", "OM"];
}

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
// IMPORTANTE: "https://ad.easa.europa.eu/search/<termo>" NÃO filtra por palavra-chave - o
// Safety Publications Tool (Drupal) ignora esse caminho e devolve a mesma listagem geral, então
// as URLs por termo que existiam aqui antes nunca traziam nada específico do escopo HBR (eram
// cópias repetidas da página 1). A varredura confiável é paginar a listagem geral (ordenada por
// mais recente) e deixar o filtro de escopo (hasAdScopeTerm) decidir o que é relevante.
const EASA_RESULT_PAGE_COUNT = 30;
const EASA_SCAN_URLS = Array.from(
  { length: EASA_RESULT_PAGE_COUNT },
  (_, index) => `https://ad.easa.europa.eu/search/advanced/result/page-${index + 1}/`
);
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

// Declarados aqui (e não perto de onde são usados, lá embaixo) porque initAdMonitor() já roda
// mais acima no arquivo, no carregamento inicial do módulo - const/let só existem depois da
// linha em que são declarados, então deixá-los perto do uso causava
// "ReferenceError: Cannot access ... before initialization" logo ao abrir a página.
const AD_AUTHORITY_KEYS = ["ANAC", "FAA", "EASA"];
const AD_LINE_CHART_COLORS = {
  AIRBUS: "#38bdf8",
  BELL: "#f97316",
  LEONARDO: "#a78bfa",
  ROBINSON: "#22c55e"
};
const AD_AUTHORITY_CHART_COLORS = { ANAC: "#38bdf8", FAA: "#f59e0b", EASA: "#22c55e" };

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
  adminApprovalsList: document.getElementById("adminApprovalsList"),
  adminApprovalsCount: document.getElementById("adminApprovalsCount"),
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
  adNotificationCritical: document.getElementById("adNotificationCritical"),
  adNotificationLinesActive: document.getElementById("adNotificationLinesActive"),
  adNotificationLineFilter: document.getElementById("adNotificationLineFilter"),
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
  workspace: document.querySelector(".workspace"),

  auditDashboardError: document.getElementById("audit_dashboard_error"),
  auditOpError: document.getElementById("audit_op_error"),

  auditCriarError: document.getElementById("audit_criar_error"),
  auditCriarStepLista: document.getElementById("auditCriarStepLista"),
  auditCriarStepForm: document.getElementById("auditCriarStepForm"),
  auditCriarStepPicker: document.getElementById("auditCriarStepPicker"),
  auditCriarStepFill: document.getElementById("auditCriarStepFill"),
  auditCriarSearch: document.getElementById("auditCriarSearch"),
  auditCriarNewBtn: document.getElementById("auditCriarNewBtn"),
  auditCriarOverview: document.getElementById("auditCriarOverview"),
  auditCriarOverviewPeriod: document.getElementById("auditCriarOverviewPeriod"),
  auditCriarOverviewNav: document.getElementById("auditCriarOverviewNav"),
  auditCriarOverviewStats: document.getElementById("auditCriarOverviewStats"),
  auditCriarOverviewSummary: document.getElementById("auditCriarOverviewSummary"),
  auditCriarOverviewChart: document.getElementById("auditCriarOverviewChart"),
  auditCriarOverviewChartEmpty: document.getElementById("auditCriarOverviewChartEmpty"),
  auditCriarFormBackBtn: document.getElementById("auditCriarFormBackBtn"),
  auditCriarForm: document.getElementById("auditCriarForm"),
  auditCriarNumero: document.getElementById("auditCriarNumero"),
  auditCriarBase: document.getElementById("auditCriarBase"),
  auditCriarDataInicio: document.getElementById("auditCriarDataInicio"),
  auditCriarDataFim: document.getElementById("auditCriarDataFim"),
  auditCriarTipo: document.getElementById("auditCriarTipo"),
  auditCriarCliente: document.getElementById("auditCriarCliente"),
  auditCriarStatus: document.getElementById("auditCriarStatus"),
  auditCriarAuditor: document.getElementById("auditCriarAuditor"),
  auditCriarAuditado: document.getElementById("auditCriarAuditado"),
  auditCriarEquipe: document.getElementById("auditCriarEquipe"),
  auditCriarObs1: document.getElementById("auditCriarObs1"),
  auditCriarObs2: document.getElementById("auditCriarObs2"),
  auditCriarNumColaboradores: document.getElementById("auditCriarNumColaboradores"),
  auditCriarNumAeronavesEo: document.getElementById("auditCriarNumAeronavesEo"),
  auditCriarNumAeronavesManut: document.getElementById("auditCriarNumAeronavesManut"),
  auditCriarObjetivo: document.getElementById("auditCriarObjetivo"),
  auditCriarEscopo: document.getElementById("auditCriarEscopo"),
  auditCriarFormMessage: document.getElementById("auditCriarFormMessage"),
  auditCriarCancelBtn: document.getElementById("auditCriarCancelBtn"),
  auditCriarSaveBtn: document.getElementById("auditCriarSaveBtn"),
  auditCriarPickerBackBtn: document.getElementById("auditCriarPickerBackBtn"),
  auditCriarPickerNumero: document.getElementById("auditCriarPickerNumero"),
  auditCriarPickerGrid: document.getElementById("auditCriarPickerGrid"),
  auditCriarPickerStatus: document.getElementById("auditCriarPickerStatus"),
  auditCriarReportBtn: document.getElementById("auditCriarReportBtn"),
  auditCriarResumo: document.getElementById("auditCriarResumo"),
  auditCriarObservacoesGerais: document.getElementById("auditCriarObservacoesGerais"),
  auditCriarSummarySaveBtn: document.getElementById("auditCriarSummarySaveBtn"),
  auditCriarSummaryMessage: document.getElementById("auditCriarSummaryMessage"),
  auditCriarPhotoInput: document.getElementById("auditCriarPhotoInput"),
  auditCriarPhotoMessage: document.getElementById("auditCriarPhotoMessage"),
  auditCriarPhotoGrid: document.getElementById("auditCriarPhotoGrid"),
  auditCriarFillBackBtn: document.getElementById("auditCriarFillBackBtn"),
  auditCriarFillContainer: document.getElementById("auditCriarFillContainer"),
  auditMetricTotal: document.getElementById("audit_metric_total"),
  auditMetricTotalCard: document.getElementById("audit_metric_total_card"),
  auditMetricAbertas: document.getElementById("audit_metric_abertas"),
  auditMetricAtrasadas: document.getElementById("audit_metric_atrasadas"),
  auditMetricConcluidas: document.getElementById("audit_metric_concluidas"),
  auditMetricReincidentes: document.getElementById("audit_metric_reincidentes"),
  auditMetricInvestimento: document.getElementById("audit_metric_investimento"),
  auditYearRange: document.getElementById("audit_year_range"),
  auditRankingSetor: document.getElementById("audit_ranking_setor"),
  auditRankingBase: document.getElementById("audit_ranking_base"),
  auditRankingCausa: document.getElementById("audit_ranking_causa"),

  auditOpCount: document.getElementById("audit_op_count"),
  auditSearch: document.getElementById("auditSearch"),
  auditNumberFilterSelect: document.getElementById("auditNumberFilter"),
  auditFilterChips: document.querySelectorAll("[data-audit-filter]"),
  auditNewBtn: document.getElementById("auditNewBtn"),
  auditTableBody: document.getElementById("audit_table_body"),
  auditEmptyState: document.getElementById("audit_empty_state"),

  auditNcModal: document.getElementById("auditNcModal"),
  auditNcForm: document.getElementById("auditNcForm"),
  auditNcModalTitle: document.getElementById("auditNcModalTitle"),
  auditNcCloseBtn: document.getElementById("auditNcCloseBtn"),
  auditNcCancelBtn: document.getElementById("auditNcCancelBtn"),
  auditNcSaveBtn: document.getElementById("auditNcSaveBtn"),
  auditNcDeleteBtn: document.getElementById("auditNcDeleteBtn"),
  auditNcEmitBtn: document.getElementById("auditNcEmitBtn"),
  auditNcPhotoUploadLabel: document.getElementById("auditNcPhotoUploadLabel"),
  auditNcPhotoInput: document.getElementById("auditNcPhotoInput"),
  auditNcPhotoMessage: document.getElementById("auditNcPhotoMessage"),
  auditNcPhotoGrid: document.getElementById("auditNcPhotoGrid"),
  auditNcMessage: document.getElementById("auditNcMessage"),
  auditNcDescription: document.getElementById("auditNcDescription"),
  auditNcAuditType: document.getElementById("auditNcAuditType"),
  auditNcClient: document.getElementById("auditNcClient"),
  auditNcAuditNumber: document.getElementById("auditNcAuditNumber"),
  auditNcType: document.getElementById("auditNcType"),
  auditNcNumber: document.getElementById("auditNcNumber"),
  auditNcBase: document.getElementById("auditNcBase"),
  auditNcStatus: document.getElementById("auditNcStatus"),
  auditNcStep: document.getElementById("auditNcStep"),
  auditNcRisk: document.getElementById("auditNcRisk"),
  auditNcRecurrent: document.getElementById("auditNcRecurrent"),
  auditNcInvestment: document.getElementById("auditNcInvestment"),
  auditNcDate: document.getElementById("auditNcDate"),
  auditNcDept: document.getElementById("auditNcDept"),
  auditNcSector: document.getElementById("auditNcSector"),
  auditNcResponsableSector: document.getElementById("auditNcResponsableSector"),
  auditNcRootCauseDescription: document.getElementById("auditNcRootCauseDescription"),
  auditNcRootCauseCode: document.getElementById("auditNcRootCauseCode"),
  auditNcResponsibleName: document.getElementById("auditNcResponsibleName"),
  auditNcDeadline: document.getElementById("auditNcDeadline"),
  auditNcExtension1: document.getElementById("auditNcExtension1"),
  auditNcExtension2: document.getElementById("auditNcExtension2"),
  auditNcClosureDate: document.getElementById("auditNcClosureDate"),
  auditNcHighlight: document.getElementById("auditNcHighlight")
};

let data = [];
let historicoGlobal = [];
let chart;
let chartPizza;
let adNotificationLineChart;
let adNotificationAuthorityChart;
let activeAircraftFilter = "all";
let editingItemId = null;
let activeModalItems = [];
let adminUnlocked = sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "true";
let dynamicSiteAreas = loadStoredAdminAreas();
let adminReminders = loadStoredReminders();
let adminHistory = loadStoredAdminHistory();
let adminUsers = [];

// ===================== Cargos e permissões por aba =====================
// Cada usuário pode acumular um ou mais cargos (guardados em usuarios/{uid}.cargos).
// "admin" sempre enxerga tudo. Uma conta sem o campo "cargos" definido ainda (criada
// antes deste sistema existir) mantém acesso total, para não travar quem já usava o site.
const CARGO_LIST = ["admin", "auditor", "pac", "publicacoes"];
const CARGO_LABELS = {
  admin: "Administrador",
  auditor: "Auditor",
  pac: "Responsável pela PAC",
  publicacoes: "Publicações e Engenharia"
};
// aba -> cargos que liberam acesso (além de "admin", que sempre tem acesso a tudo).
// A aba "admin" não entra aqui: ela continua protegida só pela senha do painel administrativo.
const TAB_CARGO_MAP = {
  tabela: ["admin"],
  dashboard: ["admin"],
  historico: ["admin"],
  publicacoes: ["admin", "publicacoes"],
  adPesquisa: ["admin", "publicacoes"],
  adNotificacoes: ["admin", "publicacoes"],
  auditoriaCriar: ["admin", "auditor"],
  auditoriaDashboard: ["admin", "auditor", "pac"],
  auditoriaOperacao: ["admin", "auditor"],
  auditoriaPac: ["admin", "pac"]
};
// null = ainda não carregado (não bloqueia nada, evita flash de tela vazia no login).
// "ALL" = conta antiga sem o campo "cargos" (compatibilidade: acesso total).
// array = cargos explicitamente atribuídos pelo admin.
let currentUserCargos = null;

function userCanAccessTab(tab) {
  const allowed = TAB_CARGO_MAP[tab];
  if (!allowed) return true;
  if (currentUserCargos === null || currentUserCargos === "ALL") return true;
  if (currentUserCargos.includes("admin")) return true;
  return allowed.some((cargo) => currentUserCargos.includes(cargo));
}

function firstAccessibleTab() {
  return Object.keys(TAB_CARGO_MAP).find((tab) => userCanAccessTab(tab)) || null;
}

async function loadCurrentUserCargos(user) {
  try {
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    const rawCargos = snap.exists() ? snap.data().cargos : undefined;
    currentUserCargos = Array.isArray(rawCargos) ? rawCargos : "ALL";
  } catch (err) {
    console.error("Não foi possível carregar os cargos do usuário; liberando acesso por precaução.", err);
    currentUserCargos = "ALL";
  }
}

function applyCargoVisibility() {
  let anyVisibleInGroup = new Map();

  document.querySelectorAll("[data-tab-target]").forEach((button) => {
    const tab = button.dataset.tabTarget;
    const allowed = userCanAccessTab(tab);
    button.hidden = !allowed;
    const group = button.closest(".gh-nav-group");
    if (group) anyVisibleInGroup.set(group, (anyVisibleInGroup.get(group) || false) || allowed);
  });

  document.querySelectorAll(".gh-nav-group").forEach((group) => {
    group.hidden = !anyVisibleInGroup.get(group);
  });

  const noAccessNotice = document.getElementById("noCargoNotice");
  const currentActiveTab = document.querySelector(".tab.active")?.id;
  if (currentActiveTab && TAB_CARGO_MAP[currentActiveTab] && !userCanAccessTab(currentActiveTab)) {
    const fallback = firstAccessibleTab();
    if (fallback) {
      window.showTab(fallback);
    } else {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      if (noAccessNotice) noAccessNotice.hidden = false;
      return;
    }
  }
  if (noAccessNotice) noAccessNotice.hidden = firstAccessibleTab() !== null;
}

let publicationNetwork = loadStoredPublicationNetwork();
let publicationConfig = loadStoredPublicationConfig();
let selectedPublicationId = publicationNetwork.nodes[0]?.id || null;
let publicationAnimationFrame = null;
let publicationFloatFrame = null;
let publicationFloatLastTime = 0;
let publicationDraggedNodeId = null;
let publicationPhysicsNodes = new Map();
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

let auditNcData = [];
let auditNcFilter = "all";
let auditNcSearchTerm = "";
let auditNcAuditNumberFilter = "";
let auditNcEditingId = null;
let auditNcModalPacMode = false;
let auditPacSearchTerm = "";
let auditPacFilter = "all";
// Campos "de identificação" da NC/OM que o cargo Responsável pela PAC não pode alterar
// (isso é papel de quem audita/registra). No modo PAC só ficam editáveis os campos do
// plano de ação em si: causa raiz, responsável, setor responsável, prazo, prorrogações,
// encerramento e observações.
const AUDIT_NC_PAC_LOCKED_FIELDS = [
  "description", "auditType", "client", "auditNumber", "type", "ncNumber", "base",
  "ncDate", "ncDept", "ncSector", "riskAnalysis", "recurrentNc", "needsInvestment"
];
let auditNcLoaded = false;
let auditNcLoadError = "";
let auditChart = null;
let auditStatusChart = null;
let auditRiskChart = null;

let auditoriasData = [];
let auditoriaChecklistsData = [];
let auditoriasLoaded = false;
let auditoriasLoadError = "";
let auditCriarSearchTerm = "";
let auditCriarCurrentAuditoria = null;
let auditCriarCurrentChecklist = null; // template object da checklist em preenchimento
let auditCriarCurrentValues = {}; // { itemN: { status, nota } }
let auditCriarCurrentGrcFields = {};
let auditCriarOverviewSelectedId = null;
let auditCriarOverviewChart = null;

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
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    try {
      await setDoc(
        doc(db, "usuarios", cred.user.uid),
        {
          email: cred.user.email || email,
          aprovado: false,
          cargos: [],
          criadoEm: new Date().toISOString()
        },
        { merge: true }
      );
    } catch (regErr) {
      console.error("Não foi possível registrar a solicitação de acesso.", regErr);
    }
    await auth.signOut();
    setLoginMessage("Conta criada! Aguarde um administrador aprovar seu acesso antes de entrar.", "success");
  } catch (err) {
    setLoginMessage(getAuthErrorMessage(err), "error");
  } finally {
    setLoginLoading(false);
  }
};

async function checkUserApproval(user) {
  try {
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    if (!snap.exists()) return true; // usuário antigo, sem esse campo ainda: não bloqueia
    return snap.data().aprovado !== false;
  } catch (err) {
    console.error("Não foi possível checar a aprovação do usuário; liberando acesso por precaução.", err);
    return true;
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    el.loginScreen.style.display = "flex";
    el.loaderScreen.style.display = "none";
    if (el.userEmail) el.userEmail.textContent = "";
    setLoginLoading(false);
    currentUserCargos = null;
    return;
  }

  el.loginScreen.style.display = "none";
  el.loaderScreen.style.display = "flex";

  const aprovado = await checkUserApproval(user);
  if (!aprovado) {
    await auth.signOut();
    el.loaderScreen.style.display = "none";
    el.loginScreen.style.display = "flex";
    setLoginMessage("Sua conta ainda não foi aprovada por um administrador. Aguarde a liberação do acesso.", "error");
    return;
  }

  setLoginMessage("", "info");
  if (el.userEmail) el.userEmail.textContent = user.email;
  await saveCurrentUserPresence(user);
  await loadCurrentUserCargos(user);
  applyCargoVisibility();
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

// ===== Auditoria (Plano de Ação Corretiva / não conformidades) =====
// Carregada sob demanda (só quando a aba de Auditoria é aberta pela primeira vez),
// para não pesar o login com 851 leituras que a maioria das sessões não vai usar.
// Na primeira vez que a coleção "nao_conformidades" estiver vazia, semeia o Firestore
// com os dados históricos da planilha (AUDIT_NC_SEED); depois disso tudo passa a vir
// só do Firestore, inclusive os itens antigos.
async function carregarAuditoriaNc() {
  if (auditNcLoaded) return;
  auditNcLoadError = "";

  if (!AUDIT_NC_SEED.length) {
    // window.AUDIT_NC_SEED não chegou a existir - o arquivo audit-data.js não foi
    // encontrado (nome/local errado) ou não terminou de carregar antes deste módulo.
    console.warn("AUDIT_NC_SEED está vazio: audit-data.js não carregou ou não tem dados.");
  }

  try {
    const snap = await getDocs(collection(db, "nao_conformidades"));
    if (snap.empty && AUDIT_NC_SEED.length) {
      await seedAuditNc();
      const reseeded = await getDocs(collection(db, "nao_conformidades"));
      auditNcData = reseeded.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
      auditNcData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    if (!auditNcData.length && !AUDIT_NC_SEED.length) {
      auditNcLoadError =
        "O arquivo audit-data.js não carregou (window.AUDIT_NC_SEED está vazio). Confira se o arquivo está na mesma pasta do index.html, com o nome exato \"audit-data.js\" (tudo minúsculo), e se o index.html tem a linha <script src=\"audit-data.js\"></script> antes do script.js.";
    }

    auditNcLoaded = true;
  } catch (err) {
    console.error("Erro ao carregar não conformidades da auditoria.", err);
    auditNcLoadError = `Não foi possível carregar os dados da auditoria: "${err?.message || err}". Provavelmente as regras de segurança do Firestore não liberam a coleção "nao_conformidades" — verifique no Console do Firebase (Firestore Database > Regras).`;
    auditNcData = [];
  }
}

async function seedAuditNc() {
  // O Firestore permite no máximo 500 operações por lote; 851 registros exigem 2 lotes.
  const chunkSize = 450;
  for (let i = 0; i < AUDIT_NC_SEED.length; i += chunkSize) {
    const chunk = AUDIT_NC_SEED.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((record) => {
      const { id, ...fields } = record;
      const ref = doc(collection(db, "nao_conformidades"));
      batch.set(ref, fields);
    });
    await batch.commit();
  }
}

async function addAuditNc(fields) {
  const ref = await addDoc(collection(db, "nao_conformidades"), fields);
  auditNcData.push({ id: ref.id, ...fields });
  return ref.id;
}

// Gera um número de NC/OM limpo e sequencial por auditoria (ex: NC001, NC002, OM001),
// em vez de embutir o número da auditoria ou o código do checklist no identificador.
function nextSequentialNcNumber(auditNumber, type) {
  const prefix = normalizeText(type || "") === "om" ? "OM" : "NC";
  let maxN = 0;
  auditNcData.forEach((item) => {
    if (item.auditNumber !== auditNumber) return;
    if (normalizeText(item.type || "") !== normalizeText(type || "")) return;
    const match = /^(?:NC|OM)\s*0*(\d+)$/i.exec(String(item.ncNumber || "").trim());
    if (match) maxN = Math.max(maxN, parseInt(match[1], 10));
  });
  return `${prefix}${String(maxN + 1).padStart(3, "0")}`;
}

async function updateAuditNcRecord(id, fields) {
  await updateDoc(doc(db, "nao_conformidades", id), fields);
  const idx = auditNcData.findIndex((item) => item.id === id);
  if (idx !== -1) auditNcData[idx] = { ...auditNcData[idx], ...fields };
}

async function deleteAuditNcRecord(id) {
  await deleteDoc(doc(db, "nao_conformidades", id));
  auditNcData = auditNcData.filter((item) => item.id !== id);
}

function populateAuditSelect(selectEl, options, { allowEmpty = true } = {}) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML =
    (allowEmpty ? `<option value="">Selecione...</option>` : "") +
    options.map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join("");
  if (current) selectEl.value = current;
}

function populateAuditFormOptions() {
  populateAuditSelect(el.auditNcAuditType, AUDIT_NC_OPTIONS.auditType);
  populateAuditSelect(el.auditNcClient, AUDIT_NC_OPTIONS.clients);
  populateAuditSelect(el.auditNcType, AUDIT_NC_OPTIONS.type);
  populateAuditSelect(el.auditNcBase, AUDIT_NC_OPTIONS.bases);
  populateAuditSelect(el.auditNcStatus, AUDIT_NC_OPTIONS.status);
  populateAuditSelect(el.auditNcStep, AUDIT_NC_OPTIONS.step);
  populateAuditSelect(el.auditNcRisk, AUDIT_NC_OPTIONS.riskAnalysis);
  populateAuditSelect(el.auditNcRecurrent, AUDIT_NC_OPTIONS.recurrentInvestment);
  populateAuditSelect(el.auditNcInvestment, AUDIT_NC_OPTIONS.recurrentInvestment);
  populateAuditSelect(el.auditNcDept, AUDIT_NC_OPTIONS.ncDept);
  populateAuditSelect(el.auditNcSector, AUDIT_NC_OPTIONS.ncSector);
  populateAuditSelect(el.auditNcResponsableSector, AUDIT_NC_OPTIONS.responsableSector);
  populateAuditSelect(el.auditNcRootCauseCode, AUDIT_NC_OPTIONS.rootCauseCode);
  populateAuditSelect(el.auditNcResponsibleName, AUDIT_NC_OPTIONS.pacResponsibleName);
}

function truncateText(value, max) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatAuditDate(value) {
  if (!value) return "-";
  const parts = String(value).split("-");
  if (parts.length !== 3) return escapeHtml(value);
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function formatAuditPeriod(dateStart, dateEnd) {
  if (!dateStart && !dateEnd) return "";
  if (dateStart && dateEnd && dateStart !== dateEnd) return `${formatAuditDate(dateStart)} a ${formatAuditDate(dateEnd)}`;
  return formatAuditDate(dateStart || dateEnd);
}

function formatAuditDateForDoc(value) {
  const formatted = formatAuditDate(value);
  return formatted === "-" ? "" : formatted;
}

const FQ071_TEMPLATE_URL = "fq071-template.docx";

function fq071LibsReady() {
  return typeof window.PizZip !== "undefined" && typeof window.docxtemplater !== "undefined";
}

function buildFq071Data(item) {
  const mark = (condition) => (condition ? "☒" : "☐");
  const typeNorm = normalizeText(item.type || "");
  const isClosed = item.status === "Done" || Boolean(item.ncClosureDate);
  const setorArea = [item.ncDept, item.ncSector]
    .map((v) => (v || "").trim())
    .filter((v) => v && normalizeText(v) !== "N/A")
    .join(" / ");

  return {
    ncDate: formatAuditDateForDoc(item.ncDate),
    ncNumber: item.ncNumber || "",
    auditNumber: item.auditNumber || "",
    setorArea: setorArea || item.ncDept || item.ncSector || "",
    description: item.description || "",
    riskAnalysis: item.riskAnalysis || "",
    deadline: formatAuditDateForDoc(item.deadline),
    extension1: item.extension1 || "",
    extension2: item.extension2 || "",
    rootCauseDescription: item.rootCauseDescription || "",
    rootCauseCode: item.rootCauseCode || "",
    pacResponsibleName: item.pacResponsibleName || "",
    responsableSector: item.responsableSector || "",
    marcaTipoNC: mark(typeNorm.startsWith("NC")),
    marcaTipoOM: mark(typeNorm === "OM"),
    marcaReincidenteSim: mark(item.recurrentNc === "Yes"),
    marcaReincidenteNao: mark(item.recurrentNc !== "Yes"),
    marcaEficazSim: "☐",
    marcaEficazNao: "☐",
    marcaNcFechada: mark(isClosed),
    marcaNcAberta: mark(!isClosed)
  };
}

async function emitFq071(item, triggerBtn) {
  if (!item) return;

  if (!fq071LibsReady()) {
    alert("As bibliotecas de geração de Word ainda não carregaram. Aguarde alguns segundos e tente novamente.");
    return;
  }

  if (triggerBtn) triggerBtn.disabled = true;
  try {
    const res = await fetch(FQ071_TEMPLATE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar ${FQ071_TEMPLATE_URL}`);
    const buffer = await res.arrayBuffer();

    const zip = new window.PizZip(buffer);
    const doc = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(buildFq071Data(item));

    const blob = doc.toBlob();
    const url = URL.createObjectURL(blob);
    const safeNc = String(item.ncNumber || "NC").replace(/[^\w-]+/g, "_");
    const a = document.createElement("a");
    a.href = url;
    a.download = `FQ-071_${safeNc}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (err) {
    console.error("Erro ao gerar FQ-071:", err);
    alert(
      `Não foi possível gerar o FQ-071: "${err?.message || err}". Confira se o arquivo "fq071-template.docx" está na mesma pasta do index.html.`
    );
  } finally {
    if (triggerBtn) triggerBtn.disabled = false;
  }
}

// ===================== FQ-073 - Relatório de Auditoria completo =====================

const FQ073_TEMPLATE_URL = "fq073-template.docx";

function fq073LibsReady() {
  return typeof window.PizZip !== "undefined" && typeof window.docxtemplater !== "undefined" && typeof window.ImageModule !== "undefined";
}

function classifyRiskBucket(text) {
  const n = normalizeText(text || "");
  if (!n) return null;
  if (n.includes("extrem")) return "extrema";
  if (n.includes("alt")) return "alta";
  if (n.includes("medi")) return "media";
  if (n.includes("baix")) return "baixa";
  return null;
}

async function fetchImageArrayBuffer(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.arrayBuffer();
  } catch (err) {
    console.error("Erro ao baixar foto para o relatório:", url, err);
    return null;
  }
}

async function buildFq073Data(auditoria) {
  const relatedNcs = auditNcData.filter((item) => item.auditNumber === auditoria.auditNumber);
  const ncsRaw = relatedNcs.filter((item) => normalizeText(item.type || "").startsWith("nc"));
  const omsRaw = relatedNcs.filter((item) => normalizeText(item.type || "") === "om");

  const ncs = ncsRaw.map((item, index) => {
    const setor = item.setorArea || [item.ncDept, item.ncSector].map((v) => (v || "").trim()).filter(Boolean).join(" / ");
    return {
      numero: String(index + 1).padStart(3, "0"),
      setorArea: `${setor || "-"}${item.ncNumber ? ` — Ref: ${item.ncNumber}` : ""}`,
      evidenciaObjetiva: item.description || "",
      requisito: item.requisito || "",
      avaliacaoRisco: item.riskAnalysis || "",
      prazo: formatAuditDateForDoc(item.deadline),
      _record: item
    };
  });

  const oms = omsRaw.map((item, index) => {
    const setor = item.setorArea || [item.ncDept, item.ncSector].map((v) => (v || "").trim()).filter(Boolean).join(" / ");
    const linhas = [`a) Setor/Área: ${setor || "-"}`, `b) Evidência Objetiva: ${item.description || ""}`];
    if (item.requisito) linhas.push(`c) Requisito: ${item.requisito}`);
    if (item.riskAnalysis) linhas.push(`d) Avaliação de Risco: ${item.riskAnalysis}`);
    if (item.deadline) linhas.push(`e) Prazo: ${formatAuditDateForDoc(item.deadline)}`);
    return {
      numero: String(index + 1).padStart(3, "0"),
      texto: linhas.join("\n"),
      _record: item
    };
  });

  const observacoesLines = (auditoria.observacoesGerais || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const observacoes = observacoesLines.map((texto, index) => ({ numero: String(index + 1).padStart(3, "0"), texto }));

  const criticidade = { baixa: 0, media: 0, alta: 0, extrema: 0 };
  ncsRaw.forEach((item) => {
    const bucket = classifyRiskBucket(item.riskAnalysis);
    if (bucket) criticidade[bucket] += 1;
  });

  const checklists = auditoriaChecklistsFor(auditoria.id);
  const relatorioConformidades = checklists.length
    ? checklists
        .map((c) => {
          const template = AUDIT_CHECKLIST_TEMPLATES.find((t) => t.code === c.checklistCode);
          const nome = template ? template.name : c.checklistCode;
          return `${c.checklistCode} – ${nome}: ${c.indiceConformidade ?? "-"}% de conformidade (OK: ${c.okCount ?? 0}, NC: ${c.ncCount ?? 0}, OM: ${c.omCount ?? 0}, N/A: ${c.naCount ?? 0})`;
        })
        .join("\n")
    : "Nenhum checklist de setor foi preenchido para esta auditoria até o momento.";

  // ---------- Photos: NC photos + general audit photos, pre-fetched as image bytes ----------
  const imageMap = {};
  const fotosAnexo = [];
  let photoCounter = 0;

  const addPhotoEntries = async (fotos, legendaPrefix) => {
    if (!fotos || !fotos.length) return;
    for (let i = 0; i < fotos.length; i += 1) {
      const foto = fotos[i];
      const buffer = await fetchImageArrayBuffer(foto.url);
      if (!buffer) continue;
      const key = `photo_${photoCounter++}`;
      imageMap[key] = buffer;
      fotosAnexo.push({ foto: key, legenda: `${legendaPrefix} — Foto ${i + 1}` });
    }
  };

  await addPhotoEntries(auditoria.fotos, `Auditoria ${auditoria.auditNumber || ""} (geral)`);
  for (const nc of ncs) {
    await addPhotoEntries(nc._record.fotos, `NC${nc.numero} (${nc._record.ncNumber || ""})`);
  }
  for (const om of oms) {
    await addPhotoEntries(om._record.fotos, `OM${om.numero} (${om._record.ncNumber || ""})`);
  }
  ncs.forEach((nc) => delete nc._record);
  oms.forEach((om) => delete om._record);

  const data = {
    auditNumber: auditoria.auditNumber || "",
    localidade: auditoria.base || "",
    periodo: formatAuditPeriod(auditoria.dateStart, auditoria.dateEnd) || "",
    objetivo: auditoria.objetivo || "",
    escopo: auditoria.escopo || "",
    tipoAuditoria: auditoria.auditType || "",
    auditores: auditoria.auditorResponsavel || "",
    observadores: [auditoria.observador1, auditoria.observador2].filter(Boolean).join(", "),
    equipeAuditada: auditoria.equipeAuditada || "",
    numColaboradores: auditoria.numColaboradores || "",
    numAeronavesEo: auditoria.numAeronavesEo || "",
    numAeronavesManut: auditoria.numAeronavesManut || "",
    totalNc: String(ncs.length),
    totalReincidentes: String(ncsRaw.filter((item) => item.recurrentNc === "Yes").length),
    totalOm: String(oms.length),
    totalObservacoes: String(observacoes.length),
    qtdeBaixa: String(criticidade.baixa),
    qtdeMedia: String(criticidade.media),
    qtdeAlta: String(criticidade.alta),
    qtdeExtrema: String(criticidade.extrema),
    resumoAuditoria: auditoria.resumoAuditoria || "",
    ncs,
    oms,
    observacoes,
    relatorioConformidades,
    elaboradoPorNome: auditoria.auditorResponsavel || auth.currentUser?.email || "",
    elaboradoPorData: formatAuditDateForDoc(new Date().toISOString().slice(0, 10)),
    fotosAnexo
  };

  return { data, imageMap };
}

async function emitFq073Report(auditoria, triggerBtn) {
  if (!auditoria) return;

  if (!fq073LibsReady()) {
    alert("As bibliotecas de geração de Word ainda não carregaram. Aguarde alguns segundos e tente novamente.");
    return;
  }

  if (triggerBtn) triggerBtn.disabled = true;
  const originalLabel = triggerBtn ? triggerBtn.textContent : "";
  if (triggerBtn) triggerBtn.textContent = "Gerando relatório...";

  try {
    // As NCs/OMs (coleção "nao_conformidades") são carregadas sob demanda só quando a aba
    // "NC e OM" é aberta. Se o usuário gera o relatório sem nunca ter aberto essa aba, os
    // dados ficam vazios em memória e o Parte II do FQ-073 sai em branco — por isso
    // garantimos o carregamento aqui antes de montar os dados do relatório.
    await carregarAuditoriaNc();
    if (auditNcLoadError) throw new Error(auditNcLoadError);

    const res = await fetch(FQ073_TEMPLATE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar ${FQ073_TEMPLATE_URL}`);
    const templateBuffer = await res.arrayBuffer();

    const { data, imageMap } = await buildFq073Data(auditoria);

    const imageModule = new window.ImageModule({
      centered: true,
      getImage: (tagValue) => imageMap[tagValue],
      getSize: () => [360, 270]
    });

    const zip = new window.PizZip(templateBuffer);
    const doc = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true, modules: [imageModule] });
    doc.render(data);

    const blob = doc.toBlob();
    const url = URL.createObjectURL(blob);
    const safeNumber = String(auditoria.auditNumber || "auditoria").replace(/[^\w-]+/g, "_");
    const a = document.createElement("a");
    a.href = url;
    a.download = `FQ-073_${safeNumber}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (err) {
    console.error("Erro ao gerar FQ-073:", err);
    alert(
      `Não foi possível gerar o Relatório de Auditoria: "${err?.message || err}". Confira se o arquivo "fq073-template.docx" está na mesma pasta do index.html, e se o Firebase Storage está com as regras/CORS liberados para as fotos.`
    );
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.textContent = originalLabel;
    }
  }
}

el.auditCriarReportBtn?.addEventListener("click", () => {
  if (!auditCriarCurrentAuditoria) return;
  emitFq073Report(auditCriarCurrentAuditoria, el.auditCriarReportBtn);
});

function auditStatusToneClass(status) {
  if (status === "Done") return "ok";
  if (status === "Late") return "critical";
  if (status === "Open") return "warning";
  return "empty";
}

function auditRiskToneClass(risk) {
  if (risk === "Low") return "ok";
  if (risk === "Medium") return "warning";
  if (risk === "High" || risk === "Extreme") return "critical";
  return "empty";
}

function filterAuditItems() {
  const term = normalizeText(auditNcSearchTerm);
  return auditNcData
    .filter((item) => {
      if (auditNcFilter !== "all" && item.status !== auditNcFilter) return false;
      if (auditNcAuditNumberFilter && item.auditNumber !== auditNcAuditNumberFilter) return false;
      if (!term) return true;
      const haystack = normalizeText(
        `${item.ncNumber || ""} ${item.description || ""} ${item.base || ""} ${item.ncDept || ""} ${item.ncSector || ""} ${item.pacResponsibleName || ""}`
      );
      return haystack.includes(term);
    })
    .sort((a, b) => String(b.ncDate || "").localeCompare(String(a.ncDate || "")));
}

function populateAuditNumberFilterOptions() {
  if (!el.auditNumberFilterSelect) return;
  const numbers = [...new Set(auditNcData.map((item) => item.auditNumber || "").filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { numeric: true })
  );
  const current = el.auditNumberFilterSelect.value;
  el.auditNumberFilterSelect.innerHTML =
    `<option value="">Todas as auditorias</option>` +
    numbers.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  if (numbers.includes(current)) el.auditNumberFilterSelect.value = current;
}

function renderAuditOperacao() {
  if (el.auditOpError) {
    if (auditNcLoadError) {
      el.auditOpError.textContent = auditNcLoadError;
      el.auditOpError.hidden = false;
    } else {
      el.auditOpError.hidden = true;
      el.auditOpError.textContent = "";
    }
  }

  if (el.auditOpCount) el.auditOpCount.textContent = auditNcData.length;
  populateAuditNumberFilterOptions();
  if (!el.auditTableBody) return;

  const items = filterAuditItems();

  if (!items.length) {
    el.auditTableBody.innerHTML = "";
    if (el.auditEmptyState) el.auditEmptyState.hidden = false;
    return;
  }
  if (el.auditEmptyState) el.auditEmptyState.hidden = true;

  el.auditTableBody.innerHTML = items
    .map(
      (item) => `
    <tr data-audit-id="${escapeHtml(item.id)}" class="audit-row">
      <td>${escapeHtml(item.ncNumber || "-")}</td>
      <td class="audit-td-desc">${escapeHtml(truncateText(item.description, 70))}</td>
      <td>${escapeHtml(item.base || "-")}</td>
      <td>${escapeHtml(item.ncDept || "-")}</td>
      <td><span class="audit-status-pill ${auditStatusToneClass(item.status)}">${escapeHtml(item.status || "-")}</span></td>
      <td><span class="audit-status-pill ${auditRiskToneClass(item.riskAnalysis)}">${escapeHtml(item.riskAnalysis || "-")}</span></td>
      <td>${formatAuditDate(item.deadline)}</td>
      <td>${escapeHtml(item.pacResponsibleName || "-")}</td>
      <td><button type="button" class="audit-row-emit-btn" data-emit-id="${escapeHtml(item.id)}" title="Emitir FQ-071 com os dados desta NC">FQ-071</button></td>
    </tr>
  `
    )
    .join("");

  el.auditTableBody.querySelectorAll("[data-audit-id]").forEach((row) => {
    row.addEventListener("click", () => openAuditNcModal(row.dataset.auditId));
  });

  el.auditTableBody.querySelectorAll("[data-emit-id]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const record = auditNcData.find((item) => item.id === btn.dataset.emitId);
      emitFq071(record, btn);
    });
  });
}

function auditFormFieldMap() {
  return {
    description: el.auditNcDescription,
    auditType: el.auditNcAuditType,
    client: el.auditNcClient,
    auditNumber: el.auditNcAuditNumber,
    type: el.auditNcType,
    ncNumber: el.auditNcNumber,
    base: el.auditNcBase,
    status: el.auditNcStatus,
    step: el.auditNcStep,
    riskAnalysis: el.auditNcRisk,
    recurrentNc: el.auditNcRecurrent,
    needsInvestment: el.auditNcInvestment,
    ncDate: el.auditNcDate,
    ncDept: el.auditNcDept,
    ncSector: el.auditNcSector,
    responsableSector: el.auditNcResponsableSector,
    rootCauseDescription: el.auditNcRootCauseDescription,
    rootCauseCode: el.auditNcRootCauseCode,
    pacResponsibleName: el.auditNcResponsibleName,
    deadline: el.auditNcDeadline,
    extension1: el.auditNcExtension1,
    extension2: el.auditNcExtension2,
    ncClosureDate: el.auditNcClosureDate,
    highlight: el.auditNcHighlight
  };
}

function openAuditNcModal(id, options = {}) {
  if (!el.auditNcModal) return;
  populateAuditFormOptions();
  auditNcEditingId = id || null;
  auditNcModalPacMode = Boolean(options.pacMode);
  const record = id ? auditNcData.find((item) => item.id === id) : null;
  const fields = auditFormFieldMap();

  Object.entries(fields).forEach(([key, input]) => {
    if (!input) return;
    input.value = record ? record[key] || "" : "";
    input.disabled = auditNcModalPacMode && AUDIT_NC_PAC_LOCKED_FIELDS.includes(key);
  });

  if (el.auditNcModalTitle) {
    el.auditNcModalTitle.textContent = record ? `Editar ${record.ncNumber || "não conformidade"}` : "Nova não conformidade";
  }
  if (el.auditNcDeleteBtn) el.auditNcDeleteBtn.hidden = !record || auditNcModalPacMode;
  if (el.auditNcEmitBtn) el.auditNcEmitBtn.hidden = !record;
  if (el.auditNcPhotoUploadLabel) el.auditNcPhotoUploadLabel.hidden = !record;
  if (el.auditNcPhotoMessage) el.auditNcPhotoMessage.textContent = record ? "" : "Salve a não conformidade antes de adicionar fotos.";
  renderAuditNcPhotoGrid(record);
  if (el.auditNcMessage) {
    el.auditNcMessage.textContent = auditNcModalPacMode
      ? "Modo Plano de Ação: os dados de identificação da NC/OM ficam bloqueados. Você pode atualizar causa raiz, responsável, setor responsável, prazo, prorrogações, encerramento e observações."
      : "";
  }
  el.auditNcModal.hidden = false;
}

function renderAuditNcPhotoGrid(record) {
  if (!el.auditNcPhotoGrid) return;
  const fotos = record?.fotos || [];
  el.auditNcPhotoGrid.innerHTML = "";
  if (!fotos.length) {
    el.auditNcPhotoGrid.innerHTML = `<p class="audit-photo-empty">${record ? "Nenhuma foto adicionada ainda." : ""}</p>`;
    return;
  }
  fotos.forEach((foto, index) => {
    const item = document.createElement("div");
    item.className = "audit-photo-item";
    item.innerHTML = `
      <img src="${escapeHtml(foto.url)}" alt="Foto da não conformidade" loading="lazy">
      <button type="button" class="audit-photo-remove" title="Remover foto">&times;</button>
    `;
    item.querySelector(".audit-photo-remove")?.addEventListener("click", () => removeAuditNcPhoto(index));
    el.auditNcPhotoGrid.appendChild(item);
  });
}

async function removeAuditNcPhoto(index) {
  if (!auditNcEditingId) return;
  const record = auditNcData.find((item) => item.id === auditNcEditingId);
  if (!record) return;
  const fotos = [...(record.fotos || [])];
  const [removed] = fotos.splice(index, 1);
  if (!removed) return;
  if (!confirm("Remover esta foto da não conformidade?")) return;
  try {
    await updateAuditNcRecord(auditNcEditingId, { fotos });
    await deletePhotoFromStorage(removed);
    renderAuditNcPhotoGrid(auditNcData.find((item) => item.id === auditNcEditingId));
  } catch (err) {
    console.error("Erro ao remover foto da NC.", err);
    alert(`Não foi possível remover a foto: "${err?.message || err}".`);
  }
}

el.auditNcPhotoInput?.addEventListener("change", async () => {
  if (!auditNcEditingId || !el.auditNcPhotoInput.files?.length) return;
  const record = auditNcData.find((item) => item.id === auditNcEditingId);
  const files = Array.from(el.auditNcPhotoInput.files);
  if (el.auditNcPhotoMessage) el.auditNcPhotoMessage.textContent = "Enviando fotos...";
  try {
    const uploaded = await uploadPhotosToStorage(files, `nao_conformidades/${auditNcEditingId}`);
    const fotos = [...(record?.fotos || []), ...uploaded];
    await updateAuditNcRecord(auditNcEditingId, { fotos });
    if (el.auditNcPhotoMessage) el.auditNcPhotoMessage.textContent = "";
    renderAuditNcPhotoGrid(auditNcData.find((item) => item.id === auditNcEditingId));
  } catch (err) {
    console.error("Erro ao enviar fotos da NC.", err);
    if (el.auditNcPhotoMessage) {
      el.auditNcPhotoMessage.textContent = `Não foi possível enviar as fotos: "${err?.message || err}". Verifique se o Firebase Storage está habilitado e com as regras liberadas.`;
    }
  } finally {
    el.auditNcPhotoInput.value = "";
  }
});

function closeAuditNcModal() {
  if (el.auditNcModal) el.auditNcModal.hidden = true;
  auditNcEditingId = null;
}

el.auditNewBtn?.addEventListener("click", () => openAuditNcModal(null));
el.auditNcCloseBtn?.addEventListener("click", closeAuditNcModal);
el.auditNcCancelBtn?.addEventListener("click", closeAuditNcModal);

el.auditNcForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fields = auditFormFieldMap();
  const payload = {};
  Object.entries(fields).forEach(([key, input]) => {
    if (input) payload[key] = input.value.trim();
  });
  payload.year = payload.ncDate ? payload.ncDate.slice(0, 4) : "";

  if (!payload.description || !payload.ncNumber) {
    if (el.auditNcMessage) el.auditNcMessage.textContent = "Preencha ao menos a descrição e o número da NC.";
    return;
  }

  if (el.auditNcSaveBtn) el.auditNcSaveBtn.disabled = true;
  try {
    if (auditNcEditingId) {
      await updateAuditNcRecord(auditNcEditingId, payload);
    } else {
      await addAuditNc(payload);
    }
    closeAuditNcModal();
    renderAuditOperacao();
    renderAuditoriaDashboard();
    renderAuditPac();
  } catch (err) {
    if (el.auditNcMessage) el.auditNcMessage.textContent = "Não foi possível salvar. Tente novamente.";
    console.error(err);
  } finally {
    if (el.auditNcSaveBtn) el.auditNcSaveBtn.disabled = false;
  }
});

el.auditNcDeleteBtn?.addEventListener("click", async () => {
  if (!auditNcEditingId) return;
  if (!confirm("Excluir esta não conformidade?")) return;
  try {
    await deleteAuditNcRecord(auditNcEditingId);
    closeAuditNcModal();
    renderAuditOperacao();
    renderAuditoriaDashboard();
    renderAuditPac();
  } catch (err) {
    console.error(err);
  }
});

el.auditNcEmitBtn?.addEventListener("click", () => {
  if (!auditNcEditingId) return;
  const record = auditNcData.find((item) => item.id === auditNcEditingId);
  emitFq071(record, el.auditNcEmitBtn);
});

el.auditSearch?.addEventListener("input", () => {
  auditNcSearchTerm = el.auditSearch.value || "";
  renderAuditOperacao();
});

el.auditNumberFilterSelect?.addEventListener("change", () => {
  auditNcAuditNumberFilter = el.auditNumberFilterSelect.value || "";
  renderAuditOperacao();
});

el.auditFilterChips?.forEach((chip) => {
  chip.addEventListener("click", () => {
    el.auditFilterChips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    auditNcFilter = chip.dataset.auditFilter;
    renderAuditOperacao();
  });
});

function auditGroupCount(items, field, { excludeNA = true } = {}) {
  const map = new Map();
  items.forEach((item) => {
    const key = String(item[field] || "").trim();
    if (!key || (excludeNA && key === "N/A")) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
}

function renderAuditRankingPanel(container, ranked, unitLabel) {
  if (!container) return;
  if (!ranked.length) {
    container.innerHTML = `<p class="ranking-empty">Sem dados suficientes ainda.</p>`;
    return;
  }
  container.innerHTML = ranked
    .map(
      ([label, count], index) => `
    <div class="ranking-row">
      <strong>${index + 1}. ${escapeHtml(label)}</strong>
      <span>${count} ${unitLabel}</span>
    </div>
  `
    )
    .join("");
}

function auditRiskColor(level) {
  return { Low: "#3fb950", Medium: "#d29922", High: "#f85149", Extreme: "#f85149", OM: "#8b949e" }[level] || "#58a6ff";
}

function renderAuditYearChart(items) {
  const canvas = document.getElementById("auditYearChart");
  if (!canvas || typeof Chart === "undefined") return;

  const counts = {};
  items.forEach((item) => {
    if (item.year) counts[item.year] = (counts[item.year] || 0) + 1;
  });
  const years = Object.keys(counts).sort();

  if (auditChart) auditChart.destroy();
  auditChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: years,
      datasets: [{ label: "Não conformidades", data: years.map((y) => counts[y]), backgroundColor: "#58a6ff", borderRadius: 4 }]
    },
    options: {
      maintainAspectRatio: false,
      resizeDelay: 120,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#a1a1aa" }, grid: { color: "rgba(255, 255, 255, 0.06)" } },
        y: { beginAtZero: true, ticks: { color: "#a1a1aa" }, grid: { color: "rgba(255, 255, 255, 0.06)" } }
      }
    }
  });

  if (el.auditYearRange && years.length) {
    el.auditYearRange.textContent = years.length > 1 ? `${years[0]} - ${years[years.length - 1]}` : years[0];
  }
}

function renderAuditStatusChart(counts) {
  const canvas = document.getElementById("auditStatusChart");
  if (!canvas || typeof Chart === "undefined") return;

  if (auditStatusChart) auditStatusChart.destroy();
  auditStatusChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Abertas", "Atrasadas", "Concluídas"],
      datasets: [{ data: [counts.abertas, counts.atrasadas, counts.concluidas], backgroundColor: ["#d29922", "#f85149", "#3fb950"], borderWidth: 0 }]
    },
    options: {
      cutout: "68%",
      maintainAspectRatio: false,
      resizeDelay: 120,
      plugins: { legend: { position: "bottom", labels: { color: "#e5e7eb" } } }
    }
  });
}

function renderAuditRiskChart(items) {
  const canvas = document.getElementById("auditRiskChart");
  if (!canvas || typeof Chart === "undefined") return;

  const order = ["Low", "Medium", "High", "Extreme", "OM"];
  const counts = {};
  items.forEach((item) => {
    if (item.riskAnalysis) counts[item.riskAnalysis] = (counts[item.riskAnalysis] || 0) + 1;
  });
  const labels = order.filter((level) => counts[level]);

  if (auditRiskChart) auditRiskChart.destroy();
  auditRiskChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{ data: labels.map((level) => counts[level]), backgroundColor: labels.map(auditRiskColor), borderRadius: 4 }]
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      resizeDelay: 120,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { color: "#a1a1aa" }, grid: { color: "rgba(255, 255, 255, 0.06)" } },
        y: { ticks: { color: "#a1a1aa" }, grid: { display: false } }
      }
    }
  });
}

function renderAuditoriaDashboard() {
  if (el.auditDashboardError) {
    if (auditNcLoadError) {
      el.auditDashboardError.textContent = auditNcLoadError;
      el.auditDashboardError.hidden = false;
    } else {
      el.auditDashboardError.hidden = true;
      el.auditDashboardError.textContent = "";
    }
  }

  const items = auditNcData;
  const total = items.length;
  const atrasadas = items.filter((item) => item.status === "Late").length;
  const abertas = items.filter((item) => item.status === "Open").length;
  const concluidas = items.filter((item) => item.status === "Done").length;
  const reincidentes = items.filter((item) => item.recurrentNc === "Yes").length;
  const investimento = items.filter((item) => item.needsInvestment === "Yes").length;

  if (el.auditMetricTotal) el.auditMetricTotal.textContent = total;
  if (el.auditMetricTotalCard) el.auditMetricTotalCard.textContent = total;
  if (el.auditMetricAbertas) el.auditMetricAbertas.textContent = abertas + atrasadas;
  if (el.auditMetricAtrasadas) el.auditMetricAtrasadas.textContent = atrasadas;
  if (el.auditMetricConcluidas) el.auditMetricConcluidas.textContent = concluidas;
  if (el.auditMetricReincidentes) el.auditMetricReincidentes.textContent = reincidentes;
  if (el.auditMetricInvestimento) el.auditMetricInvestimento.textContent = investimento;

  renderAuditRankingPanel(el.auditRankingSetor, auditGroupCount(items, "ncDept"), "não conformidades");
  renderAuditRankingPanel(el.auditRankingBase, auditGroupCount(items, "base", { excludeNA: false }), "não conformidades");
  renderAuditRankingPanel(el.auditRankingCausa, auditGroupCount(items, "rootCauseCode"), "ocorrências");

  renderAuditYearChart(items);
  renderAuditStatusChart({ abertas, atrasadas, concluidas });
  renderAuditRiskChart(items);
}

async function openAuditoriaDashboardTab() {
  await carregarAuditoriaNc();
  renderAuditoriaDashboard();
}

async function openAuditoriaOperacaoTab() {
  await carregarAuditoriaNc();
  renderAuditOperacao();
}

// ===================== Plano de Ação (PAC) — visualização e atualização =====================
// Reaproveita os mesmos dados e o mesmo modal de edição da aba "NC e OM", mas em uma página
// separada, sem o botão de criar nova NC/OM e sem excluir: o cargo "Responsável pela PAC"
// só acompanha e atualiza o plano de ação das não conformidades já registradas.

async function openAuditoriaPacTab() {
  await carregarAuditoriaNc();
  renderAuditPac();
}

function filterAuditPacItems() {
  const term = normalizeText(auditPacSearchTerm);
  return auditNcData
    .filter((item) => {
      if (auditPacFilter !== "all" && item.status !== auditPacFilter) return false;
      if (!term) return true;
      const haystack = normalizeText(
        `${item.ncNumber || ""} ${item.description || ""} ${item.ncDept || ""} ${item.ncSector || ""} ${item.pacResponsibleName || ""}`
      );
      return haystack.includes(term);
    })
    .sort((a, b) => String(b.ncDate || "").localeCompare(String(a.ncDate || "")));
}

function renderAuditPac() {
  const errorEl = document.getElementById("audit_pac_error");
  if (errorEl) {
    if (auditNcLoadError) {
      errorEl.textContent = auditNcLoadError;
      errorEl.hidden = false;
    } else {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
  }

  const countEl = document.getElementById("audit_pac_count");
  if (countEl) countEl.textContent = auditNcData.length;

  const tbody = document.getElementById("audit_pac_table_body");
  const emptyState = document.getElementById("audit_pac_empty_state");
  if (!tbody) return;

  const items = filterAuditPacItems();

  if (!items.length) {
    tbody.innerHTML = "";
    if (emptyState) emptyState.hidden = false;
    return;
  }
  if (emptyState) emptyState.hidden = true;

  tbody.innerHTML = items
    .map(
      (item) => `
    <tr data-audit-pac-id="${escapeHtml(item.id)}" class="audit-row">
      <td>${escapeHtml(item.ncNumber || "-")}</td>
      <td class="audit-td-desc">${escapeHtml(truncateText(item.description, 70))}</td>
      <td>${escapeHtml(item.ncDept || item.ncSector || "-")}</td>
      <td><span class="audit-status-pill ${auditStatusToneClass(item.status)}">${escapeHtml(item.status || "-")}</span></td>
      <td>${formatAuditDate(item.deadline)}</td>
      <td>${escapeHtml(item.pacResponsibleName || "-")}</td>
      <td><button type="button" class="audit-row-emit-btn" data-pac-emit-id="${escapeHtml(item.id)}" title="Emitir FQ-071 com os dados desta NC">FQ-071</button></td>
    </tr>
  `
    )
    .join("");

  tbody.querySelectorAll("[data-audit-pac-id]").forEach((row) => {
    row.addEventListener("click", () => openAuditNcModal(row.dataset.auditPacId, { pacMode: true }));
  });

  tbody.querySelectorAll("[data-pac-emit-id]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const record = auditNcData.find((item) => item.id === btn.dataset.pacEmitId);
      emitFq071(record, btn);
    });
  });
}

document.getElementById("auditPacSearch")?.addEventListener("input", (event) => {
  auditPacSearchTerm = event.target.value || "";
  renderAuditPac();
});

document.querySelectorAll("[data-audit-pac-filter]").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("[data-audit-pac-filter]").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    auditPacFilter = chip.dataset.auditPacFilter;
    renderAuditPac();
  });
});

// ===================== Criar Auditoria (checklists de setor -> NCs) =====================

async function carregarAuditorias() {
  if (auditoriasLoaded) return;
  auditoriasLoadError = "";
  try {
    const [auditoriasSnap, checklistsSnap] = await Promise.all([
      getDocs(collection(db, "auditorias")),
      getDocs(collection(db, "auditoria_checklists"))
    ]);
    auditoriasData = auditoriasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    auditoriaChecklistsData = checklistsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    auditoriasLoaded = true;
  } catch (err) {
    console.error("Erro ao carregar auditorias.", err);
    auditoriasLoadError = `Não foi possível carregar as auditorias: "${err?.message || err}". Provavelmente as regras de segurança do Firestore não liberam as coleções "auditorias" e "auditoria_checklists" — verifique no Console do Firebase (Firestore Database > Regras).`;
    auditoriasData = [];
    auditoriaChecklistsData = [];
  }
}

async function openAuditoriaCriarTab() {
  await carregarAuditorias();
  if (el.auditCriarError) {
    if (auditoriasLoadError) {
      el.auditCriarError.textContent = auditoriasLoadError;
      el.auditCriarError.hidden = false;
    } else {
      el.auditCriarError.hidden = true;
      el.auditCriarError.textContent = "";
    }
  }
  populateAuditCriarFormOptions();
  showAuditCriarStep("lista");
  renderAuditCriarLista();
}

function showAuditCriarStep(step) {
  if (el.auditCriarStepLista) el.auditCriarStepLista.hidden = step !== "lista";
  if (el.auditCriarStepForm) el.auditCriarStepForm.hidden = step !== "form";
  if (el.auditCriarStepPicker) el.auditCriarStepPicker.hidden = step !== "picker";
  if (el.auditCriarStepFill) el.auditCriarStepFill.hidden = step !== "fill";
}

function populateAuditCriarFormOptions() {
  const fill = (select, options) => {
    if (!select) return;
    const current = select.value;
    select.innerHTML =
      `<option value="">Selecione...</option>` + options.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
    if (options.includes(current)) select.value = current;
  };
  fill(el.auditCriarBase, AUDIT_NC_OPTIONS.bases || []);
  fill(el.auditCriarTipo, AUDIT_NC_OPTIONS.auditType || []);
  fill(el.auditCriarCliente, AUDIT_NC_OPTIONS.clients || []);
}

function auditoriaChecklistsFor(auditoriaId) {
  return auditoriaChecklistsData.filter((c) => c.auditoriaId === auditoriaId);
}

// ===== Resumo estilo "GitHub Pulse": lista de auditorias à esquerda + painel de resumo à direita =====
function renderAuditCriarOverview() {
  if (!el.auditCriarOverviewNav) return;

  const allList = [...auditoriasData].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  if (!allList.length) {
    if (el.auditCriarOverview) el.auditCriarOverview.hidden = true;
    return;
  }
  if (el.auditCriarOverview) el.auditCriarOverview.hidden = false;

  const term = normalizeText(auditCriarSearchTerm);
  const list = allList.filter((a) => {
    if (!term) return true;
    const haystack = normalizeText(`${a.auditNumber || ""} ${a.base || ""} ${a.auditType || ""} ${a.client || ""}`);
    return haystack.includes(term);
  });

  if (el.auditCriarOverviewPeriod) {
    el.auditCriarOverviewPeriod.textContent = term
      ? `${list.length} auditoria${list.length === 1 ? "" : "s"} encontrada${list.length === 1 ? "" : "s"}`
      : `${list.length} auditoria${list.length === 1 ? "" : "s"} no total`;
  }

  if (!list.length) {
    el.auditCriarOverviewNav.innerHTML = `<p class="audit-criar-overview-nav-empty">Nenhuma auditoria encontrada para essa busca.</p>`;
    if (el.auditCriarOverviewStats) el.auditCriarOverviewStats.innerHTML = "";
    if (el.auditCriarOverviewSummary) el.auditCriarOverviewSummary.textContent = "";
    const wrap = el.auditCriarOverviewChart?.parentElement;
    if (wrap) wrap.hidden = true;
    if (el.auditCriarOverviewChartEmpty) el.auditCriarOverviewChartEmpty.hidden = true;
    if (auditCriarOverviewChart) {
      auditCriarOverviewChart.destroy();
      auditCriarOverviewChart = null;
    }
    return;
  }

  if (!auditCriarOverviewSelectedId || !list.some((a) => a.id === auditCriarOverviewSelectedId)) {
    auditCriarOverviewSelectedId = list[0].id;
  }

  el.auditCriarOverviewNav.innerHTML = "";
  list.forEach((auditoria) => {
    const status = auditoria.status || "Em Progresso";
    const isActive = auditoria.id === auditCriarOverviewSelectedId;
    const item = document.createElement("div");
    item.className = `audit-criar-overview-nav-item${isActive ? " active" : ""}`;
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    item.innerHTML = `
      <div class="audit-criar-overview-nav-row">
        <button type="button" class="audit-criar-overview-nav-title" title="Abrir esta auditoria">${escapeHtml(auditoria.auditNumber || "Sem número")}</button>
        <button type="button" class="audit-criar-overview-nav-delete" title="Excluir auditoria">&times;</button>
      </div>
      <span class="audit-criar-overview-nav-meta">
        <span class="audit-status-pill ${auditoriaStatusToneClass(status)}">${escapeHtml(status)}</span>
        <span class="audit-criar-overview-nav-period">${escapeHtml(formatAuditPeriod(auditoria.dateStart, auditoria.dateEnd) || "-")}</span>
      </span>
    `;
    const select = () => {
      auditCriarOverviewSelectedId = auditoria.id;
      renderAuditCriarOverview();
    };
    item.addEventListener("click", select);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
    item.querySelector(".audit-criar-overview-nav-title")?.addEventListener("click", (event) => {
      event.stopPropagation();
      openAuditCriarPicker(auditoria);
    });
    item.querySelector(".audit-criar-overview-nav-delete")?.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteAuditoria(auditoria);
    });
    el.auditCriarOverviewNav.appendChild(item);
  });

  const selected = list.find((a) => a.id === auditCriarOverviewSelectedId) || list[0];
  renderAuditCriarOverviewDetail(selected);
}

function renderAuditCriarOverviewDetail(auditoria) {
  if (!auditoria) return;
  const checklists = auditoriaChecklistsFor(auditoria.id);
  const totalChecklists = checklists.length;
  const totalTemplates = AUDIT_CHECKLIST_TEMPLATES.length;
  const ncTotal = checklists.reduce((sum, c) => sum + (c.ncCount || 0), 0);
  const omTotal = checklists.reduce((sum, c) => sum + (c.omCount || 0), 0);
  const mediaConformidade = totalChecklists
    ? Math.round(checklists.reduce((sum, c) => sum + (c.indiceConformidade || 0), 0) / totalChecklists)
    : 0;

  if (el.auditCriarOverviewStats) {
    el.auditCriarOverviewStats.innerHTML = `
      <div class="audit-criar-overview-stat">
        <strong>${totalChecklists}/${totalTemplates}</strong>
        <span>Checklists preenchidos</span>
      </div>
      <div class="audit-criar-overview-stat">
        <strong>${mediaConformidade}%</strong>
        <span>Índice de conformidade médio</span>
      </div>
      <div class="audit-criar-overview-stat">
        <strong>${ncTotal}</strong>
        <span>Não conformidades</span>
      </div>
      <div class="audit-criar-overview-stat">
        <strong>${omTotal}</strong>
        <span>Oportunidades de melhoria</span>
      </div>
    `;
  }

  if (el.auditCriarOverviewSummary) {
    const periodo = formatAuditPeriod(auditoria.dateStart, auditoria.dateEnd) || "-";
    const status = auditoria.status || "Em Progresso";
    const numero = escapeHtml(auditoria.auditNumber || "sem número");
    let summary;
    if (!totalChecklists) {
      summary = `A auditoria <strong>${numero}</strong> (${escapeHtml(periodo)}) ainda não tem nenhum checklist preenchido.`;
    } else {
      summary = `Na auditoria <strong>${numero}</strong> (${escapeHtml(periodo)}), <strong>${totalChecklists}</strong> checklist${
        totalChecklists === 1 ? "" : "s"
      } de setor ${totalChecklists === 1 ? "foi preenchido" : "foram preenchidos"}, com índice de conformidade médio de <strong>${mediaConformidade}%</strong>. Foram identificadas <strong>${ncTotal}</strong> não conformidade${
        ncTotal === 1 ? "" : "s"
      } e <strong>${omTotal}</strong> oportunidade${omTotal === 1 ? "" : "s"} de melhoria. Status atual: <strong>${escapeHtml(status)}</strong>.`;
    }
    el.auditCriarOverviewSummary.innerHTML = summary;
  }

  renderAuditCriarOverviewChart(checklists);
}

function renderAuditCriarOverviewChart(checklists) {
  const canvas = el.auditCriarOverviewChart;
  if (!canvas || typeof Chart === "undefined") return;
  const wrap = canvas.parentElement;

  if (!checklists.length) {
    if (auditCriarOverviewChart) {
      auditCriarOverviewChart.destroy();
      auditCriarOverviewChart = null;
    }
    if (wrap) wrap.hidden = true;
    if (el.auditCriarOverviewChartEmpty) el.auditCriarOverviewChartEmpty.hidden = false;
    return;
  }
  if (wrap) wrap.hidden = false;
  if (el.auditCriarOverviewChartEmpty) el.auditCriarOverviewChartEmpty.hidden = true;

  const labels = checklists.map((c) => c.checklistCode || "-");
  const ncData = checklists.map((c) => c.ncCount || 0);
  const omData = checklists.map((c) => c.omCount || 0);

  if (auditCriarOverviewChart) auditCriarOverviewChart.destroy();
  auditCriarOverviewChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "NC", data: ncData, backgroundColor: "#f85149", borderRadius: 4 },
        { label: "OM", data: omData, backgroundColor: "#d29922", borderRadius: 4 }
      ]
    },
    options: {
      maintainAspectRatio: false,
      resizeDelay: 120,
      plugins: { legend: { position: "bottom", labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: { color: "#a1a1aa" }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: "#a1a1aa", precision: 0 }, grid: { color: "rgba(255, 255, 255, 0.06)" } }
      }
    }
  });
}

function renderAuditCriarLista() {
  renderAuditCriarOverview();
}

async function deleteAuditoria(auditoria) {
  const relatedChecklists = auditoriaChecklistsFor(auditoria.id);
  const warn = relatedChecklists.length
    ? `Esta auditoria tem ${relatedChecklists.length} checklist(s) preenchido(s), que também serão excluídos. As não conformidades já geradas em NC e OM NÃO serão apagadas. `
    : "";
  const confirmed = confirm(`${warn}Tem certeza que deseja excluir a auditoria "${auditoria.auditNumber || "Sem número"}"? Esta ação não pode ser desfeita.`);
  if (!confirmed) return;

  try {
    await Promise.all(relatedChecklists.map((c) => deleteDoc(doc(db, "auditoria_checklists", c.id))));
    await deleteDoc(doc(db, "auditorias", auditoria.id));
    auditoriaChecklistsData = auditoriaChecklistsData.filter((c) => c.auditoriaId !== auditoria.id);
    auditoriasData = auditoriasData.filter((a) => a.id !== auditoria.id);
    renderAuditCriarLista();
  } catch (err) {
    console.error("Erro ao excluir auditoria.", err);
    alert(`Não foi possível excluir a auditoria: "${err?.message || err}".`);
  }
}

function openAuditCriarForm() {
  if (el.auditCriarForm) el.auditCriarForm.reset();
  if (el.auditCriarFormMessage) el.auditCriarFormMessage.textContent = "";
  const todayStr = new Date().toISOString().slice(0, 10);
  if (el.auditCriarDataInicio) {
    el.auditCriarDataInicio.min = todayStr;
    el.auditCriarDataInicio.value = todayStr;
  }
  if (el.auditCriarDataFim) {
    el.auditCriarDataFim.min = todayStr;
    el.auditCriarDataFim.value = todayStr;
  }
  if (el.auditCriarStatus) el.auditCriarStatus.value = "Em Progresso";
  populateAuditCriarFormOptions();
  showAuditCriarStep("form");
}

function auditoriaStatusToneClass(status) {
  if (status === "Concluída") return "ok";
  if (status === "Cancelada") return "critical";
  return "warning";
}

function openAuditCriarPicker(auditoria) {
  auditCriarCurrentAuditoria = auditoria;
  if (el.auditCriarPickerNumero) {
    const periodo = formatAuditPeriod(auditoria.dateStart, auditoria.dateEnd);
    el.auditCriarPickerNumero.textContent = `Auditoria ${auditoria.auditNumber || ""} — ${auditoria.base || ""}${periodo ? ` — ${periodo}` : ""}`;
  }
  if (el.auditCriarPickerStatus) el.auditCriarPickerStatus.value = auditoria.status || "Em Progresso";
  if (el.auditCriarResumo) el.auditCriarResumo.value = auditoria.resumoAuditoria || "";
  if (el.auditCriarObservacoesGerais) el.auditCriarObservacoesGerais.value = auditoria.observacoesGerais || "";
  if (el.auditCriarSummaryMessage) el.auditCriarSummaryMessage.textContent = "";
  if (el.auditCriarPhotoMessage) el.auditCriarPhotoMessage.textContent = "";
  renderAuditCriarPickerGrid();
  renderAuditCriarPhotoGrid();
  showAuditCriarStep("picker");
}

el.auditCriarSummarySaveBtn?.addEventListener("click", async () => {
  if (!auditCriarCurrentAuditoria) return;
  const resumoAuditoria = el.auditCriarResumo?.value.trim() || "";
  const observacoesGerais = el.auditCriarObservacoesGerais?.value.trim() || "";
  if (el.auditCriarSummarySaveBtn) el.auditCriarSummarySaveBtn.disabled = true;
  if (el.auditCriarSummaryMessage) el.auditCriarSummaryMessage.textContent = "Salvando...";
  try {
    await updateDoc(doc(db, "auditorias", auditCriarCurrentAuditoria.id), { resumoAuditoria, observacoesGerais });
    auditCriarCurrentAuditoria.resumoAuditoria = resumoAuditoria;
    auditCriarCurrentAuditoria.observacoesGerais = observacoesGerais;
    const idx = auditoriasData.findIndex((a) => a.id === auditCriarCurrentAuditoria.id);
    if (idx !== -1) auditoriasData[idx] = { ...auditoriasData[idx], resumoAuditoria, observacoesGerais };
    if (el.auditCriarSummaryMessage) el.auditCriarSummaryMessage.textContent = "Salvo.";
  } catch (err) {
    console.error("Erro ao salvar resumo/observações.", err);
    if (el.auditCriarSummaryMessage) {
      el.auditCriarSummaryMessage.textContent = `Não foi possível salvar: "${err?.message || err}".`;
    }
  } finally {
    if (el.auditCriarSummarySaveBtn) el.auditCriarSummarySaveBtn.disabled = false;
  }
});

async function uploadPhotosToStorage(files, pathPrefix) {
  const uploaded = [];
  for (const file of files) {
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const path = `${pathPrefix}/${safeName}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    uploaded.push({ url, path, name: file.name });
  }
  return uploaded;
}

async function deletePhotoFromStorage(photo) {
  if (!photo?.path) return;
  try {
    await deleteObject(storageRef(storage, photo.path));
  } catch (err) {
    console.error("Erro ao excluir foto do Storage.", err);
  }
}

function renderAuditCriarPhotoGrid() {
  if (!el.auditCriarPhotoGrid || !auditCriarCurrentAuditoria) return;
  const fotos = auditCriarCurrentAuditoria.fotos || [];
  el.auditCriarPhotoGrid.innerHTML = "";
  if (!fotos.length) {
    el.auditCriarPhotoGrid.innerHTML = `<p class="audit-photo-empty">Nenhuma foto adicionada ainda.</p>`;
    return;
  }
  fotos.forEach((foto, index) => {
    const item = document.createElement("div");
    item.className = "audit-photo-item";
    item.innerHTML = `
      <img src="${escapeHtml(foto.url)}" alt="Foto da auditoria" loading="lazy">
      <button type="button" class="audit-photo-remove" title="Remover foto">&times;</button>
    `;
    item.querySelector(".audit-photo-remove")?.addEventListener("click", () => removeAuditPhoto(index));
    el.auditCriarPhotoGrid.appendChild(item);
  });
}

async function removeAuditPhoto(index) {
  if (!auditCriarCurrentAuditoria) return;
  const fotos = [...(auditCriarCurrentAuditoria.fotos || [])];
  const [removed] = fotos.splice(index, 1);
  if (!removed) return;
  if (!confirm("Remover esta foto da auditoria?")) return;
  try {
    await updateDoc(doc(db, "auditorias", auditCriarCurrentAuditoria.id), { fotos });
    await deletePhotoFromStorage(removed);
    auditCriarCurrentAuditoria.fotos = fotos;
    const idx = auditoriasData.findIndex((a) => a.id === auditCriarCurrentAuditoria.id);
    if (idx !== -1) auditoriasData[idx] = { ...auditoriasData[idx], fotos };
    renderAuditCriarPhotoGrid();
  } catch (err) {
    console.error("Erro ao remover foto.", err);
    alert(`Não foi possível remover a foto: "${err?.message || err}".`);
  }
}

el.auditCriarPhotoInput?.addEventListener("change", async () => {
  if (!auditCriarCurrentAuditoria || !el.auditCriarPhotoInput.files?.length) return;
  const files = Array.from(el.auditCriarPhotoInput.files);
  if (el.auditCriarPhotoMessage) el.auditCriarPhotoMessage.textContent = "Enviando fotos...";
  try {
    const uploaded = await uploadPhotosToStorage(files, `auditorias/${auditCriarCurrentAuditoria.id}`);
    const fotos = [...(auditCriarCurrentAuditoria.fotos || []), ...uploaded];
    await updateDoc(doc(db, "auditorias", auditCriarCurrentAuditoria.id), { fotos });
    auditCriarCurrentAuditoria.fotos = fotos;
    const idx = auditoriasData.findIndex((a) => a.id === auditCriarCurrentAuditoria.id);
    if (idx !== -1) auditoriasData[idx] = { ...auditoriasData[idx], fotos };
    if (el.auditCriarPhotoMessage) el.auditCriarPhotoMessage.textContent = "";
    renderAuditCriarPhotoGrid();
  } catch (err) {
    console.error("Erro ao enviar fotos.", err);
    if (el.auditCriarPhotoMessage) {
      el.auditCriarPhotoMessage.textContent = `Não foi possível enviar as fotos: "${err?.message || err}". Verifique se o Firebase Storage está habilitado e com as regras liberadas.`;
    }
  } finally {
    el.auditCriarPhotoInput.value = "";
  }
});

el.auditCriarPickerStatus?.addEventListener("change", async () => {
  if (!auditCriarCurrentAuditoria) return;
  const newStatus = el.auditCriarPickerStatus.value;
  try {
    await updateDoc(doc(db, "auditorias", auditCriarCurrentAuditoria.id), { status: newStatus });
    auditCriarCurrentAuditoria.status = newStatus;
    const idx = auditoriasData.findIndex((a) => a.id === auditCriarCurrentAuditoria.id);
    if (idx !== -1) auditoriasData[idx] = { ...auditoriasData[idx], status: newStatus };
  } catch (err) {
    console.error("Erro ao atualizar status da auditoria.", err);
    alert(`Não foi possível atualizar o status: "${err?.message || err}".`);
  }
});

function renderAuditCriarPickerGrid() {
  if (!el.auditCriarPickerGrid || !auditCriarCurrentAuditoria) return;
  const done = auditoriaChecklistsFor(auditCriarCurrentAuditoria.id);

  el.auditCriarPickerGrid.innerHTML = "";
  AUDIT_CHECKLIST_TEMPLATES.forEach((template) => {
    const existing = done.find((c) => c.checklistCode === template.code);
    const card = document.createElement("article");
    card.className = `audit-checklist-card${existing ? " is-done" : ""}`;
    const totalItems = template.categories.reduce((sum, cat) => sum + cat.items.length, 0);
    card.innerHTML = `
      <div class="audit-checklist-card-head">
        <strong>${escapeHtml(template.name)}</strong>
        <span class="audit-status-pill ${existing ? "ok" : "empty"}">${existing ? "Concluído" : "Pendente"}</span>
      </div>
      <span class="audit-checklist-card-meta">${escapeHtml(template.code)} &bull; ${escapeHtml(template.rev)} &bull; ${totalItems} itens</span>
      ${existing ? `<span class="audit-checklist-card-meta">Índice de conformidade: ${existing.indiceConformidade ?? "-"}%</span>` : ""}
    `;
    card.addEventListener("click", () => openAuditCriarFill(template, existing || null));
    el.auditCriarPickerGrid.appendChild(card);
  });
}

function auditCriarToneClass(status) {
  if (status === "OK") return "ok";
  if (status === "NC" || status === "NOK") return "critical";
  if (status === "OM") return "warning";
  return "empty";
}

function openAuditCriarFill(template, existingChecklist) {
  auditCriarCurrentChecklist = template;
  auditCriarCurrentValues = {};
  auditCriarCurrentGrcFields = {};

  if (existingChecklist) {
    (existingChecklist.items || []).forEach((it) => {
      auditCriarCurrentValues[it.n] = {
        status: it.status || "",
        nota: it.nota || "",
        fotos: it.fotos || [],
        setorArea: it.setorArea || "",
        requisito: it.requisito || "",
        avaliacaoRisco: it.avaliacaoRisco || "",
        prazo: it.prazo || ""
      };
    });
    auditCriarCurrentGrcFields = { ...(existingChecklist.grcFields || {}) };
  }

  renderAuditCriarFillForm(existingChecklist || null);
  showAuditCriarStep("fill");
}

function renderAuditCriarFillForm(existingChecklist) {
  if (!el.auditCriarFillContainer || !auditCriarCurrentChecklist) return;
  const template = auditCriarCurrentChecklist;
  const readOnly = Boolean(existingChecklist);
  const statusOptions = auditChecklistStatusOptions(template.kind);

  const grcFieldsHtml =
    template.kind === "grc"
      ? `<div class="audit-nc-grid audit-criar-grc-fields">
          ${template.grcFields
            .map(
              (f) => `
            <label class="edit-field">
              <span>${escapeHtml(f.label)}</span>
              <input class="input-custom audit-criar-grc-input" data-grc-key="${escapeHtml(f.key)}" value="${escapeHtml(auditCriarCurrentGrcFields[f.key] || "")}" ${readOnly ? "disabled" : ""}>
            </label>`
            )
            .join("")}
        </div>`
      : `<label class="edit-field audit-field-wide">
          <span>Linha/Slot</span>
          <input id="auditCriarLinhaSlot" class="input-custom" value="${escapeHtml(auditCriarCurrentGrcFields.linhaSlot || "")}" ${readOnly ? "disabled" : ""}>
        </label>`;

  const itemsHtml = template.categories
    .map(
      (cat) => `
      <div class="audit-criar-category">
        <h3>${escapeHtml(cat.name)}</h3>
        ${cat.items
          .map((item) => {
            const current = auditCriarCurrentValues[item.n] || { status: "", nota: "", fotos: [], setorArea: undefined, requisito: undefined, avaliacaoRisco: "", prazo: "" };
            const currentFotos = current.fotos || [];
            const itemIsFinding = ["", ...auditChecklistFindingStatuses(template.kind)].includes(current.status);
            const defaultSetorArea = [template.ncDept, cat.name].filter(Boolean).join(" / ");
            const riscoOptions = ["Baixa", "Média", "Alta", "Extrema"];
            const findingFieldsTopHtml = `
              <div class="audit-nc-grid audit-criar-item-finding-fields" ${itemIsFinding ? "" : "hidden"}>
                <label class="edit-field audit-field-wide">
                  <span>a) Setor/Área</span>
                  <input class="input-custom audit-criar-item-setor" value="${escapeHtml(current.setorArea ?? defaultSetorArea)}" ${readOnly ? "disabled" : ""}>
                </label>
              </div>`;
            const findingFieldsBottomHtml = `
              <div class="audit-nc-grid audit-criar-item-finding-fields" ${itemIsFinding ? "" : "hidden"}>
                <label class="edit-field audit-field-wide">
                  <span>c) Requisito</span>
                  <textarea class="input-custom audit-criar-item-requisito" rows="2" ${readOnly ? "disabled" : ""}>${escapeHtml(current.requisito ?? item.text)}</textarea>
                </label>
                <label class="edit-field">
                  <span>d) Avaliação de Risco</span>
                  <select class="input-custom audit-criar-item-risco" ${readOnly ? "disabled" : ""}>
                    <option value="">Selecione...</option>
                    ${riscoOptions
                      .map((opt) => `<option value="${opt}" ${current.avaliacaoRisco === opt ? "selected" : ""}>${opt}</option>`)
                      .join("")}
                  </select>
                </label>
                <label class="edit-field">
                  <span>e) Prazo</span>
                  <input type="date" class="input-custom audit-criar-item-prazo" value="${escapeHtml(current.prazo || "")}" ${readOnly ? "disabled" : ""}>
                </label>
              </div>`;
            const showPhotosBlock = !readOnly || currentFotos.length > 0;
            const photosHtml = showPhotosBlock
              ? `
              <div class="audit-criar-item-photos" ${itemIsFinding ? "" : "hidden"}>
                <div class="audit-criar-item-photos-head">
                  <span class="audit-criar-item-photos-title">Fotos do item</span>
                  ${
                    readOnly
                      ? ""
                      : `<label class="audit-photo-upload-btn audit-photo-upload-btn-sm">+ Fotos<input type="file" class="audit-criar-item-photo-input" accept="image/*" multiple hidden></label>`
                  }
                </div>
                <div class="audit-photo-grid audit-photo-grid-sm" data-item-photo-grid>
                  ${currentFotos
                    .map(
                      (foto, idx) => `
                    <div class="audit-photo-item" data-photo-index="${idx}">
                      <img src="${escapeHtml(foto.url)}" alt="Foto do item" loading="lazy">
                      ${readOnly ? "" : `<button type="button" class="audit-photo-remove" title="Remover foto">&times;</button>`}
                    </div>`
                    )
                    .join("")}
                </div>
                <p class="audit-criar-item-photo-message"></p>
              </div>`
              : "";
            return `
            <div class="audit-criar-item" data-item-n="${item.n}">
              <div class="audit-criar-item-text"><strong>${item.n}.</strong> ${escapeHtml(item.text)}</div>
              <div class="audit-criar-item-status">
                ${statusOptions
                  .map(
                    (opt) => `
                  <button type="button" class="audit-criar-status-btn ${auditCriarToneClass(opt)}${current.status === opt ? " active" : ""}"
                    data-status-value="${opt}" ${readOnly ? "disabled" : ""}>${opt}</button>`
                  )
                  .join("")}
              </div>
              ${findingFieldsTopHtml}
              <label class="edit-field audit-field-wide audit-criar-item-nota-label" ${itemIsFinding ? "" : "hidden"}>
                <span>b) Evidência Objetiva</span>
                <textarea class="input-custom audit-criar-item-nota" placeholder="Descreva a evidência objetiva encontrada (obrigatório para ${auditChecklistFindingStatuses(template.kind).join(" e ")})"
                  ${readOnly ? "disabled" : ""}>${escapeHtml(current.nota || "")}</textarea>
              </label>
              ${findingFieldsBottomHtml}
              ${photosHtml}
            </div>`;
          })
          .join("")}
      </div>`
    )
    .join("");

  const footerHtml =
    template.kind === "spot"
      ? `
      <label class="edit-field audit-field-wide">
        <span>Anotações</span>
        <textarea id="auditCriarAnotacoes" class="input-custom" rows="3" ${readOnly ? "disabled" : ""}>${escapeHtml(existingChecklist?.observacoes || "")}</textarea>
      </label>
      <label class="edit-field audit-field-wide">
        <span>Itens identificados dentro do prazo de tratativa de auditorias anteriores</span>
        <textarea id="auditCriarPrazoAnterior" class="input-custom" rows="2" ${readOnly ? "disabled" : ""}>${escapeHtml(existingChecklist?.itensAnterioresPrazo || "")}</textarea>
      </label>
      <label class="edit-field audit-field-wide">
        <span>Itens identificados fora do escopo da auditoria spot</span>
        <textarea id="auditCriarForaEscopo" class="input-custom" rows="2" ${readOnly ? "disabled" : ""}>${escapeHtml(existingChecklist?.itensForaEscopo || "")}</textarea>
      </label>
      <div class="audit-nc-grid">
        <label class="edit-field"><span>Auditor Responsável</span><input id="auditCriarAssAuditor" class="input-custom" value="${escapeHtml(existingChecklist?.assinaturas?.auditor || auditCriarCurrentAuditoria?.auditorResponsavel || "")}" ${readOnly ? "disabled" : ""}></label>
        <label class="edit-field"><span>Auditado Responsável</span><input id="auditCriarAssAuditado" class="input-custom" value="${escapeHtml(existingChecklist?.assinaturas?.auditado || auditCriarCurrentAuditoria?.auditadoResponsavel || "")}" ${readOnly ? "disabled" : ""}></label>
        <label class="edit-field"><span>Observador 1</span><input id="auditCriarAssObs1" class="input-custom" value="${escapeHtml(existingChecklist?.assinaturas?.observador1 || auditCriarCurrentAuditoria?.observador1 || "")}" ${readOnly ? "disabled" : ""}></label>
        <label class="edit-field"><span>Observador 2</span><input id="auditCriarAssObs2" class="input-custom" value="${escapeHtml(existingChecklist?.assinaturas?.observador2 || auditCriarCurrentAuditoria?.observador2 || "")}" ${readOnly ? "disabled" : ""}></label>
      </div>`
      : `
      <label class="edit-field audit-field-wide">
        <span>Observações</span>
        <textarea id="auditCriarAnotacoes" class="input-custom" rows="3" ${readOnly ? "disabled" : ""}>${escapeHtml(existingChecklist?.observacoes || "")}</textarea>
      </label>
      <label class="edit-field"><span>Assinatura do Executor</span><input id="auditCriarAssAuditor" class="input-custom" value="${escapeHtml(existingChecklist?.assinaturas?.auditor || "")}" ${readOnly ? "disabled" : ""}></label>`;

  el.auditCriarFillContainer.innerHTML = `
    <div class="page-heading">
      <div>
        <p class="eyebrow">${escapeHtml(template.code)} &bull; ${escapeHtml(template.rev)}</p>
        <h1>${escapeHtml(template.name)}</h1>
      </div>
      ${existingChecklist ? `<span class="audit-status-pill ok">Concluído &bull; índice ${existingChecklist.indiceConformidade ?? "-"}%</span>` : ""}
    </div>
    ${
      existingChecklist
        ? `<div class="audit-criar-readonly-banner">Este checklist já foi concluído para esta auditoria e está em modo somente leitura. Cada checklist só pode ser preenchido uma vez por auditoria.</div>`
        : ""
    }
    <form id="auditCriarFillForm" class="audit-nc-form audit-criar-fill-form">
      ${grcFieldsHtml}
      <div class="audit-criar-items">${itemsHtml}</div>
      ${footerHtml}
      <p id="auditCriarFillMessage" class="edit-message"></p>
      <div class="edit-actions">
        ${readOnly ? "" : `<button type="submit" id="auditCriarFillSaveBtn" class="modal-action">Concluir checklist</button>`}
      </div>
    </form>
  `;

  if (readOnly) return;

  el.auditCriarFillContainer.querySelectorAll(".audit-criar-item").forEach((itemEl) => {
    const n = Number(itemEl.dataset.itemN);
    const notaEl = itemEl.querySelector(".audit-criar-item-nota");
    const notaLabelEl = itemEl.querySelector(".audit-criar-item-nota-label");
    const findingFieldsEls = itemEl.querySelectorAll(".audit-criar-item-finding-fields");
    const photosBlockEl = itemEl.querySelector(".audit-criar-item-photos");
    const photoInputEl = itemEl.querySelector(".audit-criar-item-photo-input");
    const photoGridEl = itemEl.querySelector("[data-item-photo-grid]");
    const photoMsgEl = itemEl.querySelector(".audit-criar-item-photo-message");
    const setorEl = itemEl.querySelector(".audit-criar-item-setor");
    const requisitoEl = itemEl.querySelector(".audit-criar-item-requisito");
    const riscoEl = itemEl.querySelector(".audit-criar-item-risco");
    const prazoEl = itemEl.querySelector(".audit-criar-item-prazo");

    const renderItemPhotoGrid = () => {
      if (!photoGridEl) return;
      const fotos = auditCriarCurrentValues[n]?.fotos || [];
      photoGridEl.innerHTML = "";
      fotos.forEach((foto, idx) => {
        const div = document.createElement("div");
        div.className = "audit-photo-item";
        div.innerHTML = `
          <img src="${escapeHtml(foto.url)}" alt="Foto do item" loading="lazy">
          <button type="button" class="audit-photo-remove" title="Remover foto">&times;</button>
        `;
        div.querySelector(".audit-photo-remove")?.addEventListener("click", async () => {
          const fotosAtuais = [...(auditCriarCurrentValues[n]?.fotos || [])];
          const [removed] = fotosAtuais.splice(idx, 1);
          if (!removed) return;
          auditCriarCurrentValues[n] = { ...(auditCriarCurrentValues[n] || {}), fotos: fotosAtuais };
          renderItemPhotoGrid();
          await deletePhotoFromStorage(removed);
        });
        photoGridEl.appendChild(div);
      });
    };

    photoInputEl?.addEventListener("change", async () => {
      if (!photoInputEl.files?.length) return;
      const files = Array.from(photoInputEl.files);
      if (photoMsgEl) photoMsgEl.textContent = "Enviando fotos...";
      try {
        const uploaded = await uploadPhotosToStorage(
          files,
          `auditorias/${auditCriarCurrentAuditoria?.id || "sem-auditoria"}/checklist_items/${template.code}/${n}`
        );
        auditCriarCurrentValues[n] = {
          ...(auditCriarCurrentValues[n] || {}),
          fotos: [...(auditCriarCurrentValues[n]?.fotos || []), ...uploaded]
        };
        if (photoMsgEl) photoMsgEl.textContent = "";
        renderItemPhotoGrid();
      } catch (err) {
        console.error("Erro ao enviar fotos do item.", err);
        if (photoMsgEl) {
          photoMsgEl.textContent = `Não foi possível enviar as fotos: "${err?.message || err}".`;
        }
      } finally {
        photoInputEl.value = "";
      }
    });

    itemEl.querySelectorAll(".audit-criar-status-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.statusValue;
        itemEl.querySelectorAll(".audit-criar-status-btn").forEach((b) => b.classList.toggle("active", b === btn));
        auditCriarCurrentValues[n] = { ...(auditCriarCurrentValues[n] || {}), status: value };
        const needsNota = auditChecklistFindingStatuses(template.kind).includes(value);
        if (notaLabelEl) notaLabelEl.hidden = !needsNota;
        findingFieldsEls.forEach((fieldEl) => {
          fieldEl.hidden = !needsNota;
        });
        if (photosBlockEl) photosBlockEl.hidden = !needsNota;
      });
    });
    if (notaEl) {
      notaEl.addEventListener("input", () => {
        auditCriarCurrentValues[n] = { ...(auditCriarCurrentValues[n] || {}), nota: notaEl.value };
      });
    }
    if (setorEl) {
      setorEl.addEventListener("input", () => {
        auditCriarCurrentValues[n] = { ...(auditCriarCurrentValues[n] || {}), setorArea: setorEl.value };
      });
    }
    if (requisitoEl) {
      requisitoEl.addEventListener("input", () => {
        auditCriarCurrentValues[n] = { ...(auditCriarCurrentValues[n] || {}), requisito: requisitoEl.value };
      });
    }
    if (riscoEl) {
      riscoEl.addEventListener("change", () => {
        auditCriarCurrentValues[n] = { ...(auditCriarCurrentValues[n] || {}), avaliacaoRisco: riscoEl.value };
      });
    }
    if (prazoEl) {
      prazoEl.addEventListener("input", () => {
        auditCriarCurrentValues[n] = { ...(auditCriarCurrentValues[n] || {}), prazo: prazoEl.value };
      });
    }
  });

  document.getElementById("auditCriarFillForm")?.addEventListener("submit", handleAuditCriarFillSubmit);
}

async function handleAuditCriarFillSubmit(event) {
  event.preventDefault();
  const template = auditCriarCurrentChecklist;
  const auditoria = auditCriarCurrentAuditoria;
  if (!template || !auditoria) return;

  const msgEl = document.getElementById("auditCriarFillMessage");
  const setMsg = (text) => {
    if (msgEl) msgEl.textContent = text;
  };

  const allItems = template.categories.flatMap((cat) => cat.items.map((item) => ({ ...item, categoria: cat.name })));
  const missing = allItems.filter((item) => !auditCriarCurrentValues[item.n]?.status);
  if (missing.length) {
    setMsg(`Marque o status de todos os itens (faltam ${missing.length}).`);
    return;
  }

  const findingStatuses = auditChecklistFindingStatuses(template.kind);
  const missingNota = allItems.filter(
    (item) => findingStatuses.includes(auditCriarCurrentValues[item.n]?.status) && !auditCriarCurrentValues[item.n]?.nota?.trim()
  );
  if (missingNota.length) {
    setMsg(`Preencha a observação dos itens marcados como ${findingStatuses.join("/")} (item ${missingNota[0].n}).`);
    return;
  }

  if (template.kind === "grc") {
    el.auditCriarFillContainer.querySelectorAll(".audit-criar-grc-input").forEach((input) => {
      auditCriarCurrentGrcFields[input.dataset.grcKey] = input.value.trim();
    });
  } else {
    auditCriarCurrentGrcFields.linhaSlot = document.getElementById("auditCriarLinhaSlot")?.value.trim() || "";
  }

  const saveBtn = document.getElementById("auditCriarFillSaveBtn");
  if (saveBtn) saveBtn.disabled = true;
  setMsg("Salvando checklist...");

  try {
    const okCount = allItems.filter((item) => auditCriarCurrentValues[item.n].status === "OK").length;
    const omCount = allItems.filter((item) => auditCriarCurrentValues[item.n].status === "OM").length;
    const ncCount = allItems.filter((item) => ["NC", "NOK"].includes(auditCriarCurrentValues[item.n].status)).length;
    const naCount = allItems.filter((item) => auditCriarCurrentValues[item.n].status === "N/A").length;
    const applicable = allItems.length - naCount;
    const indiceConformidade = applicable > 0 ? Math.round((okCount / applicable) * 100) : 0;

    const items = allItems.map((item) => ({
      n: item.n,
      categoria: item.categoria,
      descricao: item.text,
      status: auditCriarCurrentValues[item.n].status,
      nota: auditCriarCurrentValues[item.n].nota || "",
      fotos: auditCriarCurrentValues[item.n].fotos || [],
      setorArea: auditCriarCurrentValues[item.n].setorArea || "",
      requisito: auditCriarCurrentValues[item.n].requisito || "",
      avaliacaoRisco: auditCriarCurrentValues[item.n].avaliacaoRisco || "",
      prazo: auditCriarCurrentValues[item.n].prazo || ""
    }));

    const checklistPayload = {
      auditoriaId: auditoria.id,
      auditNumber: auditoria.auditNumber || "",
      checklistCode: template.code,
      checklistName: template.name,
      items,
      grcFields: template.kind === "grc" ? { ...auditCriarCurrentGrcFields } : {},
      observacoes: document.getElementById("auditCriarAnotacoes")?.value.trim() || "",
      itensAnterioresPrazo: document.getElementById("auditCriarPrazoAnterior")?.value.trim() || "",
      itensForaEscopo: document.getElementById("auditCriarForaEscopo")?.value.trim() || "",
      assinaturas: {
        auditor: document.getElementById("auditCriarAssAuditor")?.value.trim() || "",
        auditado: document.getElementById("auditCriarAssAuditado")?.value.trim() || "",
        observador1: document.getElementById("auditCriarAssObs1")?.value.trim() || "",
        observador2: document.getElementById("auditCriarAssObs2")?.value.trim() || ""
      },
      okCount,
      omCount,
      ncCount,
      naCount,
      indiceConformidade,
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.email || ""
    };

    const ref = await addDoc(collection(db, "auditoria_checklists"), checklistPayload);
    auditoriaChecklistsData.push({ id: ref.id, ...checklistPayload });

    const findings = allItems.filter((item) => findingStatuses.includes(auditCriarCurrentValues[item.n].status));
    for (const item of findings) {
      const value = auditCriarCurrentValues[item.n];
      const type = value.status === "NOK" ? "NC" : value.status;
      const ncNumber = nextSequentialNcNumber(auditoria.auditNumber || "", type);
      await addAuditNc({
        description: value.nota ? `${item.text} — Nota do auditor: ${value.nota}` : item.text,
        auditType: auditoria.auditType || "",
        client: auditoria.client || "",
        auditNumber: auditoria.auditNumber || "",
        type,
        ncNumber,
        requisito: value.requisito || item.text,
        setorArea: value.setorArea || "",
        fotos: value.fotos || [],
        sourceChecklistCode: template.code,
        sourceItemN: item.n,
        base: auditoria.base || "",
        status: "Open",
        step: "Open",
        riskAnalysis: value.avaliacaoRisco || "",
        recurrentNc: "No",
        needsInvestment: "No",
        ncDate: auditoria.dateStart || "",
        year: (auditoria.dateStart || "").slice(0, 4),
        ncDept: template.ncDept,
        ncSector: item.categoria,
        responsableSector: "",
        rootCauseDescription: "",
        rootCauseCode: "",
        pacResponsibleName: "",
        deadline: value.prazo || "",
        extension1: "",
        extension2: "",
        ncClosureDate: "",
        highlight: ""
      });
    }

    setMsg("");
    alert(
      findings.length
        ? `Checklist concluído! ${findings.length} não conformidade(s)/oportunidade(s) foram criadas em NC e OM.`
        : "Checklist concluído! Nenhum item fora de conformidade."
    );
    openAuditCriarPicker(auditoria);
  } catch (err) {
    console.error("Erro ao salvar checklist.", err);
    setMsg(`Não foi possível salvar o checklist: "${err?.message || err}".`);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

el.auditCriarSearch?.addEventListener("input", () => {
  auditCriarSearchTerm = el.auditCriarSearch.value || "";
  renderAuditCriarLista();
});

el.auditCriarNewBtn?.addEventListener("click", openAuditCriarForm);
el.auditCriarFormBackBtn?.addEventListener("click", () => showAuditCriarStep("lista"));
el.auditCriarCancelBtn?.addEventListener("click", () => showAuditCriarStep("lista"));
el.auditCriarPickerBackBtn?.addEventListener("click", () => {
  renderAuditCriarLista();
  showAuditCriarStep("lista");
});
el.auditCriarFillBackBtn?.addEventListener("click", () => {
  renderAuditCriarPickerGrid();
  showAuditCriarStep("picker");
});

el.auditCriarDataInicio?.addEventListener("change", () => {
  if (el.auditCriarDataFim && el.auditCriarDataInicio.value) {
    el.auditCriarDataFim.min = el.auditCriarDataInicio.value;
    if (el.auditCriarDataFim.value && el.auditCriarDataFim.value < el.auditCriarDataInicio.value) {
      el.auditCriarDataFim.value = el.auditCriarDataInicio.value;
    }
  }
});

el.auditCriarForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const setFormMsg = (text) => {
    if (el.auditCriarFormMessage) el.auditCriarFormMessage.textContent = text;
  };

  const auditNumber = el.auditCriarNumero.value.trim();
  if (!auditNumber) {
    setFormMsg("Informe o N° da auditoria.");
    return;
  }

  const dataInicio = el.auditCriarDataInicio?.value || "";
  const dataFim = el.auditCriarDataFim?.value || "";
  const todayStr = new Date().toISOString().slice(0, 10);

  if (!dataInicio || !dataFim) {
    setFormMsg("Informe a data inicial e a data final do período da auditoria.");
    return;
  }
  if (dataInicio < todayStr || dataFim < todayStr) {
    setFormMsg("Não é possível usar datas anteriores a hoje no período da auditoria.");
    return;
  }
  if (dataFim < dataInicio) {
    setFormMsg("A data final não pode ser anterior à data inicial.");
    return;
  }

  if (el.auditCriarSaveBtn) el.auditCriarSaveBtn.disabled = true;
  setFormMsg("Criando auditoria...");

  try {
    const payload = {
      auditNumber,
      base: el.auditCriarBase.value || "",
      dateStart: dataInicio,
      dateEnd: dataFim,
      auditType: el.auditCriarTipo.value || "",
      client: el.auditCriarCliente.value || "",
      status: el.auditCriarStatus?.value || "Em Progresso",
      auditorResponsavel: el.auditCriarAuditor.value.trim(),
      auditadoResponsavel: el.auditCriarAuditado.value.trim(),
      equipeAuditada: el.auditCriarEquipe?.value.trim() || "",
      observador1: el.auditCriarObs1.value.trim(),
      observador2: el.auditCriarObs2.value.trim(),
      numColaboradores: el.auditCriarNumColaboradores?.value || "",
      numAeronavesEo: el.auditCriarNumAeronavesEo?.value || "",
      numAeronavesManut: el.auditCriarNumAeronavesManut?.value || "",
      objetivo: el.auditCriarObjetivo?.value.trim() || "",
      escopo: el.auditCriarEscopo?.value.trim() || "",
      fotos: [],
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.email || ""
    };
    const ref = await addDoc(collection(db, "auditorias"), payload);
    const auditoria = { id: ref.id, ...payload };
    auditoriasData.push(auditoria);
    openAuditCriarPicker(auditoria);
  } catch (err) {
    console.error("Erro ao criar auditoria.", err);
    setFormMsg(`Não foi possível criar a auditoria: "${err?.message || err}".`);
  } finally {
    if (el.auditCriarSaveBtn) el.auditCriarSaveBtn.disabled = false;
  }
});

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
el.adNotificationLineFilter?.addEventListener("change", renderAdMiniAlertList);
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

// ===================== Painel Admin: navegação estilo "GitHub Settings" =====================
// Um painel por vez à direita, escolhido pela navegação à esquerda (em vez dos módulos
// todos empilhados de uma vez). Os botões já existem no HTML, então os listeners são
// ligados uma única vez aqui.
function showAdminPanelSection(key) {
  document.querySelectorAll(".admin-panel[data-admin-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.adminPanel === key);
  });
  document.querySelectorAll("[data-admin-panel-target]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.adminPanelTarget === key);
  });
}

document.querySelectorAll("[data-admin-panel-target]").forEach((btn) => {
  btn.addEventListener("click", () => showAdminPanelSection(btn.dataset.adminPanelTarget));
});

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

  nodes.forEach((source) => {
    const sourceAdjacent = splitDocumentImportList(source.adjacentSector).map(normalizeSpreadsheetFieldName);
    const sourceSector = normalizeSpreadsheetFieldName(source.sector);

    nodes.forEach((target) => {
      if (source.id === target.id) return;

      const targetSector = normalizeSpreadsheetFieldName(target.sector);
      const targetAdjacent = splitDocumentImportList(target.adjacentSector).map(normalizeSpreadsheetFieldName);

      if (sourceAdjacent.includes(targetSector) || targetAdjacent.includes(sourceSector)) {
        addLink(source.id, target.id);
      }
    });
  });

  if (!links.length) {
    const bySector = nodes.reduce((map, node) => {
      const key = normalizeSpreadsheetFieldName(node.sector || "Publicações");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(node);
      return map;
    }, new Map());

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

// Preencha com a URL do endpoint AWS (saída "ApiEndpoint" do "sam deploy") quando o
// backend de pesquisa de ADs for migrado para AWS Lambda. Enquanto estiver vazia, o
// site continua usando a Cloud Function do Firebase em "/api/run-ad-search" (ou o
// fallback de leitura pelo navegador, se nenhum dos dois responder).
const AWS_AD_SEARCH_ENDPOINT = "";

async function runAdBackendSearch() {
  if (!["http:", "https:"].includes(window.location.protocol)) return null;

  if (AWS_AD_SEARCH_ENDPOINT) {
    const awsResult = await callAdSearchEndpoint(AWS_AD_SEARCH_ENDPOINT);
    if (awsResult) return awsResult;
  }

  return callAdSearchEndpoint("/api/run-ad-search");
}

async function callAdSearchEndpoint(url) {
  try {
    const response = await fetch(url, {
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
    params.set("per_page", "100");
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

// Mesma extração baseada em tabela real (<table>/<tr>/<td>) usada no backend: mais confiável
// que cortar a página inteira em linhas de texto e adivinhar onde cada registro começa, e evita
// que o número da DA da ANAC (que tem formato de data) seja confundido com uma data real.
// Ver o comentário equivalente em functions/index.js para o raciocínio completo.
function extractAdTableRows(html) {
  const rows = [];
  const trRegex = /<tr\b[\s\S]*?<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(html))) {
    const cells = [];
    let cellMatch;
    cellRegex.lastIndex = 0;
    while ((cellMatch = cellRegex.exec(trMatch[0]))) {
      const cellText = cleanTextLine(stripAdHtml(cellMatch[1]));
      if (cellText) cells.push(cellText);
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function createAdFindingFromRow(authority, cells, pageUrl) {
  const numberIdx = cells.findIndex((cell) => isAdDocumentNumberLine(cell));
  if (numberIdx === -1) return null;
  const number = getAdDocumentNumber(cells[numberIdx]);
  if (!number) return null;

  const fullRowText = cells.join(" | ");
  if (!hasAdScopeTerm(fullRowText)) return null;

  const otherCells = cells.filter((_, idx) => idx !== numberIdx);
  const rowDates = otherCells.flatMap((cell) => getAdDates(cell));
  const isLabelCell = (cell) => /^(AD|PAD|SIB|SD|EAD|DA|EU|US|BR|EASA|FAA|ANAC)$/i.test(cell);
  const subject = cleanTextLine(
    otherCells
      .filter((cell) => cell.length > 3 && !isLabelCell(cell) && !getAdDates(cell).length)
      .sort((a, b) => b.length - a.length)[0] || ""
  );

  if (authority === "EASA") {
    const type = cells.some((cell) => /^PAD$/i.test(cell)) || /^\d{2}-\d{3}$/.test(number)
      ? "PAD"
      : cells.some((cell) => /^SIB$/i.test(cell))
        ? "SIB"
        : cells.some((cell) => /^SD$/i.test(cell))
          ? "SD"
          : "AD";
    const finalSubject = subject || "Safety Publication";

    return normalizeAdFinding({
      id: `easa-${normalizeAdKey(number)}`,
      authority: "EASA",
      number,
      type,
      issueDate: rowDates[0] || "",
      effectiveDate: rowDates[1] || "",
      holder: inferAdHolder(fullRowText),
      model: inferAdModel(fullRowText),
      subject: finalSubject,
      match: buildAdScopeMatch(fullRowText),
      status: type === "PAD" ? "Novo para análise" : "Aplicável ao escopo",
      sourceUrl: `https://ad.easa.europa.eu/ad/${encodeURIComponent(number)}`,
      identified: `Publicação EASA relacionada a ${finalSubject}.`,
      treatment: type === "PAD"
        ? "Acompanhar consulta da proposta e preparar avaliação de impacto para Publicações e Qualidade."
        : "Verificar efetividade, aplicabilidade por modelo e ação mandatória antes de liberar tratativa interna."
    });
  }

  const finalSubject = subject || "Diretriz de Aeronavegabilidade";

  return normalizeAdFinding({
    id: `anac-${normalizeAdKey(number)}`,
    authority: "ANAC",
    number,
    type: "DA",
    issueDate: rowDates[0] || "",
    effectiveDate: rowDates[1] || "",
    holder: inferAdHolder(fullRowText),
    model: inferAdModel(fullRowText),
    subject: finalSubject,
    match: buildAdScopeMatch(fullRowText),
    status: "Aplicável ao escopo",
    sourceUrl: pageUrl,
    identified: `DA brasileira com termo compatível com o escopo da EO HBR: ${finalSubject}.`,
    treatment: "Validar aplicabilidade e registrar cumprimento conforme texto oficial da ANAC."
  });
}

function extractEasaAdFindings(html, pageUrl) {
  const rows = extractAdTableRows(html).filter((cells) => cells.some((cell) => isAdDocumentNumberLine(cell)));
  if (rows.length) {
    return rows.map((cells) => createAdFindingFromRow("EASA", cells, pageUrl)).filter(Boolean);
  }

  // Reserva: se a página não tiver uma <table> reconhecível, volta para a heurística antiga.
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
  if (normalizeText(stripAdHtml(html)).includes("NAO EXISTE DA")) return [];

  const rows = extractAdTableRows(html).filter((cells) => cells.some((cell) => isAdDocumentNumberLine(cell)));
  if (rows.length) {
    return rows.map((cells) => createAdFindingFromRow("ANAC", cells, pageUrl)).filter(Boolean);
  }

  // Reserva: se a página não tiver uma <table> reconhecível, volta para a heurística antiga.
  return splitAdPublicationBlocks(stripAdHtml(html))
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

// Dashboard de notificações: KPIs + gráficos ficam aqui (dados agregados, ignoram o filtro da
// mini lista); a mini lista (renderAdMiniAlertList) é quem aplica o filtro simples por linha.
function renderAdNotifications() {
  if (!el.adNotificationsList) return;

  const findings = adMonitorState.findings || [];
  const mandatoryCount = findings.filter((finding) => !isProposedAdType(finding.type)).length;
  const proposalCount = findings.length - mandatoryCount;
  const criticalCount = findings.filter((finding) => getAdNotificationPriority(finding).tone === "critical").length;

  const lineDistribution = AD_LINE_FILTERS.map((line) => ({
    key: line.key,
    label: line.label,
    count: findings.filter((finding) => getAdLineMatches(finding).some((match) => match.key === line.key)).length
  }));
  const activeLinesCount = lineDistribution.filter((line) => line.count > 0).length;

  const authorityDistribution = AD_AUTHORITY_KEYS.map((authority) => ({
    key: authority,
    count: findings.filter((finding) => String(finding.authority || "").toUpperCase() === authority).length
  }));

  if (el.adNotificationTotal) el.adNotificationTotal.textContent = String(findings.length);
  if (el.adNotificationMandatory) el.adNotificationMandatory.textContent = String(mandatoryCount);
  if (el.adNotificationProposal) el.adNotificationProposal.textContent = String(proposalCount);
  if (el.adNotificationCritical) el.adNotificationCritical.textContent = String(criticalCount);
  if (el.adNotificationLinesActive) el.adNotificationLinesActive.textContent = String(activeLinesCount);

  renderAdNotificationCharts(lineDistribution, authorityDistribution);
  renderAdMiniAlertList();
}

// Mesmos gráficos de barra/rosca do Dashboard principal (gerarGrafico), mesma paleta e mesmas
// opções de eixo/legenda - só muda o dado, para não sair do padrão visual já usado no site.
function renderAdNotificationCharts(lineDistribution, authorityDistribution) {
  if (typeof Chart === "undefined") return;
  if (adNotificationLineChart) adNotificationLineChart.destroy();
  if (adNotificationAuthorityChart) adNotificationAuthorityChart.destroy();

  const lineCanvas = document.getElementById("adNotificationLineChart");
  if (lineCanvas) {
    adNotificationLineChart = new Chart(lineCanvas, {
      type: "bar",
      data: {
        labels: lineDistribution.map((line) => line.label),
        datasets: [{
          label: "Alertas",
          data: lineDistribution.map((line) => line.count),
          backgroundColor: lineDistribution.map((line) => AD_LINE_CHART_COLORS[line.key] || "#94a3b8"),
          borderRadius: 4
        }]
      },
      options: {
        maintainAspectRatio: false,
        resizeDelay: 120,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#a1a1aa" }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: "#a1a1aa", precision: 0 }, grid: { color: "rgba(255, 255, 255, 0.06)" } }
        }
      }
    });
  }

  const authorityCanvas = document.getElementById("adNotificationAuthorityChart");
  if (authorityCanvas) {
    adNotificationAuthorityChart = new Chart(authorityCanvas, {
      type: "doughnut",
      data: {
        labels: authorityDistribution.map((item) => item.key),
        datasets: [{
          data: authorityDistribution.map((item) => item.count),
          backgroundColor: authorityDistribution.map((item) => AD_AUTHORITY_CHART_COLORS[item.key] || "#94a3b8"),
          borderWidth: 0
        }]
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

// Mini lista de alertas: versão compacta do card de notificação, com um único filtro simples
// (linha da EO HBR). Limitada aos 20 mais recentes para continuar "mini" - a lista completa
// já existe na aba Pesquisa de ADs.
function renderAdMiniAlertList() {
  if (!el.adNotificationsList) return;
  el.adNotificationsList.textContent = "";

  const line = el.adNotificationLineFilter?.value || "all";
  const filtered = filterAndSortAdFindings({ search: "", line, sort: "newest" });

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "ad-empty";
    empty.textContent = "Nenhuma notificação de AD para o filtro atual.";
    el.adNotificationsList.appendChild(empty);
    return;
  }

  const visible = filtered.slice(0, 20);
  visible.forEach((finding) => {
    const priority = getAdNotificationPriority(finding);
    const card = document.createElement("article");
    card.className = `ad-notification-card mini ${priority.tone}`;
    card.innerHTML = `
      <div class="ad-notification-main">
        <div class="ad-result-meta">
          <b class="ad-notification-priority ${priority.tone}">${escapeHtml(priority.label)}</b>
          <b class="ad-authority-pill ${escapeHtml(finding.authority.toLowerCase())}">${escapeHtml(finding.authority)}</b>
          <span>${escapeHtml(formatAdDate(finding.issueDate))}</span>
        </div>
        <strong>${escapeHtml(finding.number)} | ${escapeHtml(finding.subject || "Diretriz de Aeronavegabilidade")}</strong>
      </div>
      <button type="button" class="modal-action secondary" data-ad-notification-report="${escapeHtml(finding.id)}">Ver relatório</button>
    `;
    card.querySelector("[data-ad-notification-report]")?.addEventListener("click", () => openAdDetail(finding.id));
    el.adNotificationsList.appendChild(card);
  });

  if (filtered.length > visible.length) {
    const note = document.createElement("p");
    note.className = "ad-mini-list-note";
    note.textContent = `Mostrando os ${visible.length} mais recentes de ${filtered.length}. Veja a lista completa em "Pesquisa de ADs".`;
    el.adNotificationsList.appendChild(note);
  }
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
        ${buildAdAiAnalysisHtml(finding)}
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

// Mostra a análise da IA (gerada no backend - ver aws-lambda/README.md) quando o achado
// já tiver esse campo. Enquanto o backend de IA não estiver ligado, finding.aiAnalysis
// não existe e essa seção simplesmente não aparece - não quebra nada no site atual.
const AD_AI_URGENCY_LABELS = { baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica" };
const AD_AI_URGENCY_TONE = { baixa: "ok", media: "warning", alta: "warning", critica: "critical" };

function buildAdAiAnalysisHtml(finding) {
  const analysis = finding.aiAnalysis;
  if (!analysis) return "";

  if (analysis.error) {
    return `
      <section class="ad-detail-grid-full ad-ai-analysis">
        <span>Análise de IA</span>
        <p>Não foi possível gerar a análise automática desta AD (${escapeHtml(analysis.error)}). O restante do relatório acima segue confiável, é só a camada de IA que falhou nesta execução.</p>
      </section>
    `;
  }

  const urgencyLabel = AD_AI_URGENCY_LABELS[analysis.urgency] || "Não avaliada";
  const urgencyTone = AD_AI_URGENCY_TONE[analysis.urgency] || "warning";
  const applicableLabel = analysis.applicable === true ? "Aplicável à frota HBR" : analysis.applicable === false ? "Não aplicável à frota HBR" : "Aplicabilidade não avaliada";

  return `
    <section class="ad-detail-grid-full ad-ai-analysis">
      <span>Análise de IA</span>
      <div class="ad-detail-summary">
        <b class="ad-status-pill ${urgencyTone}">Urgência: ${escapeHtml(urgencyLabel)}</b>
        <b class="ad-status-pill ${analysis.applicable === false ? "empty" : "ok"}">${escapeHtml(applicableLabel)}</b>
      </div>
      ${analysis.summary ? `<p>${escapeHtml(analysis.summary)}</p>` : ""}
      ${analysis.recommendedAction ? `<p><strong>Ação recomendada:</strong> ${escapeHtml(analysis.recommendedAction)}</p>` : ""}
      ${analysis.reasoning ? `<p class="ad-detail-note">${escapeHtml(analysis.reasoning)}</p>` : ""}
    </section>
  `;
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

  el.publicationLinks.textContent = "";
  el.publicationLinks.setAttribute("viewBox", `0 0 ${width} ${height}`);
  links.forEach((link) => drawPublicationLink(link, width, height));

  el.publicationNodes.textContent = "";
  visibleNodes.forEach((node) => el.publicationNodes.appendChild(createPublicationNodeElement(node)));

  renderPublicationSelectors();
  renderPublicationInfoPanel();
}

function drawPublicationLink(link, width, height) {
  const source = getPublicationNode(link.from);
  const target = getPublicationNode(link.to);
  if (!source || !target) return;
  const sourcePosition = getPublicationDisplayPosition(source);
  const targetPosition = getPublicationDisplayPosition(target);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", String((sourcePosition.x / 100) * width));
  line.setAttribute("y1", String((sourcePosition.y / 100) * height));
  line.setAttribute("x2", String((targetPosition.x / 100) * width));
  line.setAttribute("y2", String((targetPosition.y / 100) * height));
  line.setAttribute("stroke-width", String(publicationConfig.lineWidth));
  line.setAttribute("class", getPublicationLinkClass(source, target));
  el.publicationLinks.appendChild(line);
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

  for (let index = 0; index < publicationNetwork.nodes.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < publicationNetwork.nodes.length; otherIndex += 1) {
      const current = publicationNetwork.nodes[index];
      const other = publicationNetwork.nodes[otherIndex];
      const currentPhysics = publicationPhysicsNodes.get(current.id);
      const otherPhysics = publicationPhysicsNodes.get(other.id);
      if (!currentPhysics || !otherPhysics) continue;

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
  }

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

function renderPublicationLinksOnly() {
  if (!el.publicationCanvas || !el.publicationLinks) return;
  const visibleIds = new Set(getVisiblePublicationNodes().map((node) => node.id));
  const rect = el.publicationCanvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  el.publicationLinks.textContent = "";
  el.publicationLinks.setAttribute("viewBox", `0 0 ${width} ${height}`);
  publicationNetwork.links
    .filter((link) => visibleIds.has(link.from) && visibleIds.has(link.to))
    .forEach((link) => drawPublicationLink(link, width, height));
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
  renderAdminApprovals();
  renderAdminUsers();
}

async function approveAdminUser(uid) {
  try {
    await updateDoc(doc(db, "usuarios", uid), { aprovado: true, aprovadoEm: new Date().toISOString() });
    await carregarUsuariosAdmin();
    renderAdminApprovals();
    renderAdminUsers();
  } catch (err) {
    console.error("Não foi possível aprovar o usuário.", err);
    alert("Não foi possível aprovar este usuário. Verifique as regras do Firestore.");
  }
}

async function rejectAdminUser(uid) {
  if (!confirm("Recusar o acesso deste usuário? Ele continuará sem conseguir entrar no site.")) return;
  try {
    await updateDoc(doc(db, "usuarios", uid), { aprovado: false, recusado: true, recusadoEm: new Date().toISOString() });
    await carregarUsuariosAdmin();
    renderAdminApprovals();
    renderAdminUsers();
  } catch (err) {
    console.error("Não foi possível recusar o usuário.", err);
    alert("Não foi possível recusar este usuário. Verifique as regras do Firestore.");
  }
}

function renderAdminApprovals() {
  if (!el.adminApprovalsList) return;
  el.adminApprovalsList.textContent = "";

  const pending = adminUsers
    .filter((user) => user.aprovado === false && !user.recusado)
    .sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));

  if (el.adminApprovalsCount) {
    el.adminApprovalsCount.textContent = pending.length === 1 ? "1 pendente" : `${pending.length} pendentes`;
  }

  if (!pending.length) {
    const empty = document.createElement("div");
    empty.className = "admin-users-empty";
    empty.textContent = "Nenhuma solicitação de acesso pendente.";
    el.adminApprovalsList.appendChild(empty);
    return;
  }

  pending.forEach((user) => {
    const row = document.createElement("article");
    row.className = "admin-approval-row";

    const content = document.createElement("div");
    const email = document.createElement("strong");
    email.textContent = user.email || "Usuário sem e-mail";
    const meta = document.createElement("span");
    meta.textContent = user.criadoEm ? `Solicitado em ${formatAuditDate(user.criadoEm.slice(0, 10))}` : "Data não registrada";
    content.append(email, meta);

    const actions = document.createElement("div");
    actions.className = "admin-approval-actions";

    const approveBtn = document.createElement("button");
    approveBtn.type = "button";
    approveBtn.className = "modal-action";
    approveBtn.textContent = "Aprovar";
    approveBtn.addEventListener("click", () => approveAdminUser(user.id));

    const rejectBtn = document.createElement("button");
    rejectBtn.type = "button";
    rejectBtn.className = "modal-action secondary audit-delete-btn";
    rejectBtn.textContent = "Recusar";
    rejectBtn.addEventListener("click", () => rejectAdminUser(user.id));

    actions.append(approveBtn, rejectBtn);
    row.append(content, actions);
    el.adminApprovalsList.appendChild(row);
  });
}

function renderAdminUsers() {
  if (!el.adminUsersList) return;
  el.adminUsersList.textContent = "";

  const knownUsers = adminUsers.filter((user) => user.aprovado !== false);

  if (!knownUsers.length) {
    const empty = document.createElement("div");
    empty.className = "admin-users-empty";
    empty.textContent = "Nenhum usuário registrado nesta lista ainda.";
    el.adminUsersList.appendChild(empty);
    return;
  }

  const users = [...knownUsers].sort((a, b) => new Date(b.ultimoOnlineISO || 0) - new Date(a.ultimoOnlineISO || 0));
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

    const cargosBlock = document.createElement("div");
    cargosBlock.className = "admin-user-cargos";

    const isLegacyAllAccess = user.cargos === undefined;
    const currentCargos = Array.isArray(user.cargos) ? user.cargos : [];

    if (isLegacyAllAccess) {
      const legacyNote = document.createElement("span");
      legacyNote.className = "admin-user-cargos-legacy";
      legacyNote.textContent = "Conta antiga: acesso total até um cargo ser marcado abaixo.";
      cargosBlock.appendChild(legacyNote);
    }

    CARGO_LIST.forEach((cargo) => {
      const optionId = `cargo_${user.id}_${cargo}`;
      const wrap = document.createElement("label");
      wrap.className = "uv-checkbox admin-user-cargo-option";
      wrap.setAttribute("for", optionId);

      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = optionId;
      input.checked = currentCargos.includes(cargo);
      input.addEventListener("change", () => {
        const wasChecked = !input.checked;
        const next = new Set(currentCargos);
        if (input.checked) next.add(cargo);
        else next.delete(cargo);
        updateUserCargos(user.id, [...next], {
          onError: (message) => {
            // Reverte a marcação na tela, já que a gravação no Firestore falhou:
            // sem isso a caixinha ficaria marcada mesmo sem ter sido salva de verdade.
            input.checked = wasChecked;
            if (cargosError) {
              cargosError.hidden = false;
              cargosError.textContent = `Não salvou: ${message}`;
            }
          },
          onSuccess: () => {
            if (cargosError) cargosError.hidden = true;
          }
        });
      });

      const box = document.createElement("span");
      box.className = "uv-checkbox-box";
      box.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 9 17 20 6"></polyline></svg>';

      const labelText = document.createElement("span");
      labelText.className = "uv-checkbox-label";
      labelText.textContent = CARGO_LABELS[cargo];

      wrap.append(input, box, labelText);
      cargosBlock.appendChild(wrap);
    });

    const cargosError = document.createElement("span");
    cargosError.className = "admin-user-cargos-error";
    cargosError.hidden = true;
    cargosBlock.appendChild(cargosError);

    row.appendChild(cargosBlock);
    el.adminUsersList.appendChild(row);
  });
}

async function updateUserCargos(uid, cargos, { onError, onSuccess } = {}) {
  try {
    await updateDoc(doc(db, "usuarios", uid), { cargos });
    const idx = adminUsers.findIndex((item) => item.id === uid);
    if (idx !== -1) adminUsers[idx] = { ...adminUsers[idx], cargos };
    if (auth.currentUser?.uid === uid) {
      currentUserCargos = cargos;
      applyCargoVisibility();
    }
    if (onSuccess) onSuccess();
  } catch (err) {
    console.error("Não foi possível atualizar os cargos deste usuário.", err);
    const message = err?.message || String(err);
    if (onError) onError(message);
    alert(`Não foi possível salvar os cargos: "${message}". Provavelmente as Regras de Segurança do Firestore ainda não foram atualizadas — veja o arquivo firestore.rules.`);
  }
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

let gerarGraficoRetryCount = 0;

function gerarGrafico() {
  if (typeof Chart === "undefined") {
    // Em algumas redes o CDN do Chart.js demora ou falha para carregar; em vez de
    // desistir e deixar a área do gráfico em branco para sempre, tentamos de novo
    // por alguns segundos (o index.html também carrega um CDN alternativo se o
    // principal falhar).
    if (gerarGraficoRetryCount < 40) {
      gerarGraficoRetryCount++;
      setTimeout(gerarGrafico, 250);
    } else {
      console.warn("Chart.js não carregou; os gráficos do Dashboard ficaram indisponíveis.");
      const chartFrame = document.getElementById("grafico")?.closest(".chart-frame");
      const donutFrame = document.getElementById("graficoPizza")?.closest(".donut-frame");
      const msg = "Não foi possível carregar a biblioteca de gráficos. Verifique sua conexão e recarregue a página.";
      if (chartFrame) chartFrame.innerHTML = `<p class="chart-fallback-msg">${msg}</p>`;
      if (donutFrame) donutFrame.innerHTML = `<p class="chart-fallback-msg">${msg}</p>`;
    }
    return;
  }
  gerarGraficoRetryCount = 0;
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

  // Trava de segurança: mesmo que algo tente abrir uma aba pelo nome (não só pelo clique
  // no menu, que já fica escondido), o cargo do usuário é checado de novo aqui.
  if (TAB_CARGO_MAP[tab] && currentUserCargos !== null && !userCanAccessTab(tab)) {
    return;
  }

  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.getElementById(tab)?.classList.add("active");
  document.querySelectorAll("[data-tab-target]").forEach((button) => {
    const isCurrent = button.dataset.tabTarget === tab;
    button.classList.toggle("active", isCurrent);
    button.classList.toggle("is-selected", isCurrent);
    if (isCurrent) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
  if (tab === "dashboard") gerarGrafico();
  if (tab === "historico") renderHistorico();
  if (tab === "tabela") renderTable();
  if (tab === "adPesquisa") renderAdMonitor();
  if (tab === "adNotificacoes") renderAdNotifications();
  if (tab === "auditoriaDashboard") openAuditoriaDashboardTab();
  if (tab === "auditoriaOperacao") openAuditoriaOperacaoTab();
  if (tab === "auditoriaCriar") openAuditoriaCriarTab();
  if (tab === "auditoriaPac") openAuditoriaPacTab();
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