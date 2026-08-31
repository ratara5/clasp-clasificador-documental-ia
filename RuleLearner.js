/**
 * ============================================================
 * RULELEARNER.GS
 * Aprendizaje a partir del feedback
 * ============================================================
 */


/**
 * Genera propuesta de nueva política.
 *
 * IMPORTANTE:
 * Esta función NO modifica producción.
 */
function generarPropuestaVersionada() {

  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);

  try {

    const production =
      getProductionPolicy();

    const feedback =
      obtenerFeedback();

    if (!feedback.length) {

      throw new Error(
        'No existe feedback humano.'
      );
    }


    const examples =
      obtenerEjemplosParaFeedback(
        feedback
      );


    const proposal =
      callGeminiRuleLearner(
        production.policy,
        feedback,
        examples
      );


    const policy =
      proposal.policy;


    // La IA NO puede modificar C1.
    policy.condition1 =
      production.policy.condition1;


    const version =
      savePolicyProposal(
        policy,
        proposal.justification,
        ''
      );


    guardarPatterns(
      version,
      proposal.patterns || []
    );


    Logger.log(
      `Nueva propuesta creada: ${version}`
    );


    return version;

  } finally {

    lock.releaseLock();
  }
}


/**
 * Obtiene ejemplos relevantes.
 */
function obtenerEjemplosParaFeedback(
  feedback
) {

  const interesting =
    feedback.filter(f =>
      [
        'APROBADO',
        'FALSO_POSITIVO',
        'OMITIDO_DEBIO_PASAR'
      ].includes(
        f.decision
      )
    );


  // Para MVP buscamos información
  // desde el Golden Dataset.
  const sheet =
    getControlSpreadsheet()
      .getSheetByName(
        'GOLDEN_DATASET'
      );


  if (sheet.getLastRow() < 2) {
    return [];
  }


  const rows =
    sheet
      .getDataRange()
      .getValues()
      .slice(1);


  const ids =
    new Set(
      interesting.map(
        f => f.record_id
      )
    );


  return rows
    .filter(row =>
      ids.has(row[0])
    )
    .map(row => ({

      record_id: row[0],

      data:
        JSON.parse(row[1]),

      expected_c2:
        row[2],

      source:
        row[3]
    }));
}


/**
 * Guarda patrones aprendidos.
 */
function guardarPatterns(
  version,
  patterns
) {

  const sheet =
    getControlSpreadsheet()
      .getSheetByName(
        'PATTERNS'
      );


  patterns.forEach(pattern => {

    sheet.appendRow([

      pattern.id,

      version,

      pattern.type,

      pattern.description,

      (pattern.evidenceIds || [])
        .join(','),

      pattern.confidence,

      'PROPOSED',

      new Date()
    ]);

  });
}


/**
 * Aprobar propuesta.
 */
function aprobarPropuesta(version) {

  // Primero comprobar backtest.
  const policy =
    getPolicyByVersion(
      version
    );

  if (
    policy.status !==
    'BACKTEST_OK'
  ) {

    throw new Error(
      'La propuesta todavía no tiene backtest aprobado.'
    );
  }


  promotePolicy(version);

  Logger.log(
    `Versión ${version} promovida a PRODUCCION.`
  );
}


/**
 * Rechazar propuesta.
 */
function rechazarPropuesta(version) {

  setPolicyStatus(
    version,
    'REJECTED'
  );
}
