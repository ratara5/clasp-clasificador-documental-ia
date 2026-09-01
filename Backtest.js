/**
 * ============================================================
 * BACKTEST.GS
 * Evaluación de políticas
 * ============================================================
 */


/**
 * Ejecuta backtest de una versión.
 */
function ejecutarBacktest(
  version,
  datasetName
) {

  const policy =
    getPolicyByVersion(
      version
    );


  const dataset =
    obtenerGoldenDataset();


  if (!dataset.length) {

    throw new Error(
      'GOLDEN_DATASET está vacío.'
    );
  }


  let TP = 0;
  let TN = 0;
  let FP = 0;
  let FN = 0;
  let REVIEW = 0;


  for (
    const item of dataset
  ) {

    const record =
      construirRecordDesdeGolden(
        item
      );


    const deterministic =
      evaluateCondition2Deterministic(
        record,
        policy.policy
      );


    let predicted;


    if (deterministic.pass) {

      predicted = true;

    } else {

      // Para un backtest reproducible,
      // los casos no deterministas se consideran
      // REVIEW en esta primera versión.
      predicted = false;

      REVIEW++;
    }


    const expected =
      item.expected_c2;


    if (
      predicted === true &&
      expected === true
    ) {

      TP++;

    } else if (
      predicted === false &&
      expected === false
    ) {

      TN++;

    } else if (
      predicted === true &&
      expected === false
    ) {

      FP++;

    } else if (
      predicted === false &&
      expected === true
    ) {

      FN++;
    }
  }


  const precision =
    TP + FP === 0
      ? 0
      : TP / (TP + FP);


  const recall =
    TP + FN === 0
      ? 0
      : TP / (TP + FN);


  const f1 =
    precision + recall === 0
      ? 0
      : (
          2 *
          precision *
          recall
        ) /
        (
          precision +
          recall
        );


  const fnr =
    TP + FN === 0
      ? 0
      : FN / (TP + FN);


  const backtestId =
    'BT-' + uuid();


  const sheet =
    getControlSpreadsheet()
      .getSheetByName(
        'BACKTEST_RESULTS'
      );


  sheet.appendRow([

    backtestId,

    version,

    datasetName || 'GOLDEN_DATASET',

    TP,

    TN,

    FP,

    FN,

    precision,

    recall,

    f1,

    fnr,

    REVIEW,

    new Date()
  ]);


  actualizarMetricasVersion(
    version,
    backtestId,
    precision,
    recall,
    f1,
    fnr
  );


  // Regla mínima de promoción.
  const minimumPrecision =
    0.90;

  const minimumRecall =
    0.85;


  if (
    precision >= minimumPrecision &&
    recall >= minimumRecall
  ) {

    setPolicyStatus(
      version,
      'BACKTEST_OK'
    );

  } else {

    setPolicyStatus(
      version,
      'BACKTEST_FAILED'
    );
  }


  return {

    backtestId,

    version,

    TP,

    TN,

    FP,

    FN,

    precision,

    recall,

    f1,

    fnr,

    review: REVIEW
  };
}


/**
 * Obtiene Golden Dataset.
 */
function obtenerGoldenDataset() {

  const sheet =
    getControlSpreadsheet()
      .getSheetByName(
        'GOLDEN_DATASET'
      );


  if (sheet.getLastRow() < 2) {
    return [];
  }


  return sheet
    .getDataRange()
    .getValues()
    .slice(1)
    .map(row => ({

      record_id:
        row[0],

      data:
        JSON.parse(row[1]),

      expected_c2:
        row[2] === true ||
        String(row[2]).toUpperCase()
          === 'TRUE',

      source:
        row[3],

      created_at:
        row[4]
    }));
}


/**
 * Construye registro.
 */
function construirRecordDesdeGolden(
  item
) {

  const original =
    item.data;


  return {

    record_id:
      item.record_id,

    execution_id:
      'GOLDEN',

    source_row:
      0,

    original,

    searchableText:
      Object.values(original)
        .map(v => String(v || ''))
        .join(' | '),

    // Columna T por posición (consistent with produccion).
    searchableTextT:
      String(
        Object.values(original)[
          APP.CONDICION1_DATOS_COLUMNA - 1
        ] || ''
      )
  };
}


/**
 * Actualiza métricas de versión.
 */
function actualizarMetricasVersion(
  version,
  backtestId,
  precision,
  recall,
  f1,
  fnr
) {

  const sheet =
    getControlSpreadsheet()
      .getSheetByName(
        'RULE_VERSIONS'
      );


  const values =
    sheet
      .getDataRange()
      .getValues();


  const index =
    values.findIndex(
      row =>
        row[0] === version
    );


  if (index < 1) {
    throw new Error(
      `Versión ${version} no encontrada.`
    );
  }


  const row =
    index + 1;


  sheet
    .getRange(row, 8, 1, 5)
    .setValues([[
      backtestId,
      precision,
      recall,
      f1,
      fnr
    ]]);
}
