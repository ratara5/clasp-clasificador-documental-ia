/**
 * ============================================================
 * FEEDBACK.GS
 * Retroalimentación humana
 * ============================================================
 */


/**
 * Registra feedback humano.
 *
 * decision:
 *
 * APROBADO
 * FALSO_POSITIVO
 * OMITIDO_DEBIO_PASAR
 */
function registrarFeedback(
  executionId,
  recordId,
  decision,
  reasonCode,
  comment
) {

  const allowed = [
    'APROBADO',
    'FALSO_POSITIVO',
    'OMITIDO_DEBIO_PASAR'
  ];

  if (!allowed.includes(decision)) {

    throw new Error(
      `Decisión inválida: ${decision}`
    );
  }


  const ss =
    getControlSpreadsheet();

  const sheet =
    ss.getSheetByName(
      'FEEDBACK'
    );


  sheet.appendRow([
    'FDB-' + uuid(),
    executionId,
    recordId,
    decision,
    reasonCode || '',
    comment || '',
    Session.getActiveUser().getEmail(),
    new Date()
  ]);
}


/**
 * Lee feedback.
 */
function obtenerFeedback() {

  const sheet =
    getControlSpreadsheet()
      .getSheetByName(
        'FEEDBACK'
      );

  if (sheet.getLastRow() < 2) {
    return [];
  }

  const rows =
    sheet
      .getDataRange()
      .getValues()
      .slice(1);

  return rows.map(row => ({

    feedback_id: row[0],

    execution_id: row[1],

    record_id: row[2],

    decision: row[3],

    reason_code: row[4],

    comment: row[5],

    reviewer: row[6],

    created_at: row[7]
  }));
}


/**
 * Función de ejemplo para probar feedback.
 */
function ejemploFeedback() {

  registrarFeedback(
    'EXE-XXXXX',
    'REC-XXXXX',
    'OMITIDO_DEBIO_PASAR',
    'SEMANTIC_VARIANT',
    'El registro utiliza una variante de la palabra clave.'
  );
}