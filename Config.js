/**
 * ============================================================
 * CONFIG.GS
 * Configuración central de la aplicación
 * ============================================================
 */
//// TODO: Modificar por expresión regular
const date = new Date();
date.setMonth(date.getMonth() - 1);
const month = date.toLocaleString('es-CO', { month: 'long' }).toUpperCase();


const APP = {
  CONTROL_SPREADSHEET_ID: '16ldOAj3bF_UkPcFKAJjfO1q-c7G84UMW_hZx0C9rTA0',

  // Carpeta opcional donde se almacenarán los originales.
  INPUT_FOLDER_ID: '1q7lZv241kBnyuQ2m3_-eseU6KRnHBY9B',

  // Carpeta opcional para resultados.
  OUTPUT_FOLDER_ID: '1CMipp1fy-H2PEP1fl4ds6rCeAGyimKlv',

  //// TODO: Validar que no se haya procesado ya
  // Gmail
  GMAIL_QUERY: `has:attachment (filename:"INSUMO ${month}.xls" OR filename:"INSUMO ${month}.xlsx")`,

  // Valor real esperado en columna D. // EN REALIDAD DEBE SER EN LA COLUMNA O
  TARGET_O_VALUE: 'Subrogación',

  // Nombre de las columnas según encabezado.
  // Si el XLS no tiene esos encabezados, se utilizan D/T por posición.
  O_HEADER_NAME: 'Culpabilidad', // EN REALIDAD DEBE SER EN LA COLUMA O
  T_HEADER_NAME: 'DescripcionHechos',

  // Posición 1-based de las columnas (fallback si no hay encabezado).
  CONDICION1_COLUMNA: 15,      // O
  CONDICION1_DATOS_COLUMNA: 20, // T

  // Contactos que se reconocen.
  CONTACT_TYPES: [
    'nombre',
    'correo',
    'celular',
    'email',
    'mail'
  ],

  // Condición 2 inicial.
  BASE_KEYWORDS: [
    'girar',
    'pegar',
    'detrás'
  ],

  // Modelo Gemini.
  // Verifica disponibilidad del modelo en tu proyecto/región.
  GEMINI_MODEL: 'gemini-2.5-flash',

  // Umbrales iniciales.
  AI_AUTO_THRESHOLD: 0.90,
  AI_REVIEW_THRESHOLD: 0.70,

  // Máximo de filas enviadas en una llamada a Gemini.
  AI_BATCH_SIZE: 25,

  // Etiqueta Gmail.
  PROCESSED_LABEL: 'CLASIFICADOR_IA_PROCESADO',

  // Versión inicial.
  INITIAL_POLICY_VERSION: '1.0.0'
};


/**
 * Obtiene una propiedad del proyecto.
 */
function getConfigProperty(name) {
  const value = PropertiesService
    .getScriptProperties()
    .getProperty(name);

  if (value === null) {
    throw new Error(
      `No existe la propiedad de configuración: ${name}`
    );
  }

  return value;
}


/**
 * Obtiene la API key de Gemini.
 *
 * NO colocar la API key en el código fuente.
 */
function getGeminiApiKey() {
  return getConfigProperty('GEMINI_API_KEY');
}


/**
 * Obtiene la Spreadsheet de control.
 */
function getControlSpreadsheet() {
  return SpreadsheetApp.openById(
    APP.CONTROL_SPREADSHEET_ID
  );
}


/**
 * Inicialización completa.
 *
 * Ejecutar manualmente una sola vez.
 */
function inicializarSistema() {

  const ss = getControlSpreadsheet();

  crearHojaSiNoExiste(
    ss,
    'CONFIG',
    [
      'PARAMETRO',
      'VALOR'
    ]
  );

  crearHojaSiNoExiste(
    ss,
    'RULE_VERSIONS',
    [
      'VERSION',
      'PARENT_VERSION',
      'CREATED_AT',
      'CREATED_BY',
      'STATUS',
      'POLICY_JSON',
      'JUSTIFICATION',
      'BACKTEST_ID',
      'PRECISION',
      'RECALL',
      'F1',
      'FNR'
    ]
  );

  crearHojaSiNoExiste(
    ss,
    'EXECUTIONS',
    [
      'EXECUTION_ID',
      'MESSAGE_ID',
      'ATTACHMENT_ID',
      'ATTACHMENT_NAME',
      'RECEIVED_AT',
      'STARTED_AT',
      'FINISHED_AT',
      'STATUS',
      'POLICY_VERSION',
      'OUTPUT_SPREADSHEET_ID',
      'ERROR'
    ]
  );

  crearHojaSiNoExiste(
    ss,
    'FEEDBACK',
    [
      'FEEDBACK_ID',
      'EXECUTION_ID',
      'RECORD_ID',
      'DECISION',
      'REASON_CODE',
      'COMMENT',
      'REVIEWER',
      'CREATED_AT'
    ]
  );

  crearHojaSiNoExiste(
    ss,
    'GOLDEN_DATASET',
    [
      'RECORD_ID',
      'DATA_JSON',
      'EXPECTED_C2',
      'SOURCE',
      'CREATED_AT'
    ]
  );

  crearHojaSiNoExiste(
    ss,
    'BACKTEST_RESULTS',
    [
      'BACKTEST_ID',
      'VERSION',
      'DATASET',
      'TP',
      'TN',
      'FP',
      'FN',
      'PRECISION',
      'RECALL',
      'F1',
      'FNR',
      'REVIEW_COUNT',
      'CREATED_AT'
    ]
  );

  crearHojaSiNoExiste(
    ss,
    'PATTERNS',
    [
      'PATTERN_ID',
      'VERSION',
      'TYPE',
      'DESCRIPTION',
      'EVIDENCE_IDS',
      'CONFIDENCE',
      'STATUS',
      'CREATED_AT'
    ]
  );

  // Crear versión inicial si no existe.
  asegurarPoliticaInicial(ss);

  Logger.log('Sistema inicializado correctamente.');
}


/**
 * Crea una hoja si no existe.
 */
function crearHojaSiNoExiste(ss, name, headers) {

  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers]);

    sheet.setFrozenRows(1);
  }

  return sheet;
}


/**
 * Garantiza que exista exactamente una versión inicial.
 */
function asegurarPoliticaInicial(ss) {

  const sheet = ss.getSheetByName('RULE_VERSIONS');

  if (sheet.getLastRow() > 1) {
    return;
  }

  const policy = {
    version: APP.INITIAL_POLICY_VERSION,

    condition1: {
      targetOValue: APP.TARGET_O_VALUE,
      requireContactInT: true
    },

    condition2: {
      contactTypes: APP.CONTACT_TYPES,
      keywords: APP.BASE_KEYWORDS,
      patterns: []
    },

    ai: {
      enabled: true,
      autoThreshold: APP.AI_AUTO_THRESHOLD,
      reviewThreshold: APP.AI_REVIEW_THRESHOLD
    }
  };

  sheet.appendRow([
    APP.INITIAL_POLICY_VERSION,
    '',
    new Date(),
    Session.getActiveUser().getEmail(),
    'PRODUCCION',
    JSON.stringify(policy),
    'Política inicial',
    '',
    '',
    '',
    '',
    ''
  ]);
}