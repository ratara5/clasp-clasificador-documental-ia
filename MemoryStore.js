/**
 * ============================================================
 * MEMORYSTORE.GS
 * Políticas versionadas y memoria
 * ============================================================
 */


/**
 * Obtiene la política actualmente en producción.
 *
 * IMPORTANTE:
 * Debe existir exactamente una versión PRODUCCION.
 */
function getProductionPolicy() {

  const ss = getControlSpreadsheet();

  const sheet =
    ss.getSheetByName('RULE_VERSIONS');

  const values =
    sheet.getDataRange().getValues();

  const rows = values.slice(1);

  const production =
    rows.filter(row =>
      row[4] === 'PRODUCCION'
    );

  if (production.length === 0) {

    throw new Error(
      'ERROR CRÍTICO: no existe una política PRODUCCION.'
    );
  }

  if (production.length > 1) {

    throw new Error(
      'ERROR CRÍTICO: existen múltiples políticas PRODUCCION.'
    );
  }

  return {
    version: production[0][0],
    parentVersion: production[0][1],
    createdAt: production[0][2],
    createdBy: production[0][3],
    status: production[0][4],
    policy: JSON.parse(production[0][5])
  };
}


/**
 * Obtiene una versión específica.
 */
function getPolicyByVersion(version) {

  const ss = getControlSpreadsheet();

  const sheet =
    ss.getSheetByName('RULE_VERSIONS');

  const rows =
    sheet.getDataRange()
      .getValues()
      .slice(1);

  const row =
    rows.find(r => r[0] === version);

  if (!row) {
    throw new Error(
      `No existe la versión ${version}`
    );
  }

  return {
    version: row[0],
    parentVersion: row[1],
    createdAt: row[2],
    createdBy: row[3],
    status: row[4],
    policy: JSON.parse(row[5])
  };
}


/**
 * Guarda una propuesta.
 */
function savePolicyProposal(
  policy,
  justification,
  backtestId
) {

  const ss = getControlSpreadsheet();

  const sheet =
    ss.getSheetByName('RULE_VERSIONS');

  const production =
    getProductionPolicy();

  const nextVersion =
    calculateNextVersion(
      production.version
    );

  policy.version = nextVersion;

  sheet.appendRow([
    nextVersion,
    production.version,
    new Date(),
    Session.getActiveUser().getEmail(),
    'PROPUESTA_PENDIENTE',
    JSON.stringify(policy),
    justification || '',
    backtestId || '',
    '',
    '',
    '',
    ''
  ]);

  return nextVersion;
}


/**
 * Incrementa minor.
 *
 * 1.0.0 → 1.1.0
 */
function calculateNextVersion(version) {

  const parts =
    String(version)
      .split('.')
      .map(Number);

  const major = parts[0] || 1;
  const minor = (parts[1] || 0) + 1;

  return `${major}.${minor}.0`;
}


/**
 * Cambia estado de una propuesta.
 *
 * Para PRODUCCION se valida que solo quede una activa.
 */
function setPolicyStatus(
  version,
  newStatus
) {

  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);

  try {

    const ss = getControlSpreadsheet();

    const sheet =
      ss.getSheetByName('RULE_VERSIONS');

    const data =
      sheet.getDataRange().getValues();

    let found = false;

    for (let i = 1; i < data.length; i++) {

      if (data[i][0] === version) {

        sheet
          .getRange(i + 1, 5)
          .setValue(newStatus);

        found = true;
      }
    }

    if (!found) {
      throw new Error(
        `Versión ${version} no encontrada.`
      );
    }

    if (newStatus === 'PRODUCCION') {

      // Primero poner todas las demás en ARCHIVED.
      for (let i = 1; i < data.length; i++) {

        if (
          data[i][0] !== version &&
          data[i][4] === 'PRODUCCION'
        ) {

          sheet
            .getRange(i + 1, 5)
            .setValue('ARCHIVED');
        }
      }
    }

    SpreadsheetApp.flush();

  } finally {

    lock.releaseLock();
  }
}


/**
 * Promueve una versión.
 */
function promotePolicy(version) {

  const policy =
    getPolicyByVersion(version);

  if (
    policy.status !== 'PROPUESTA_PENDIENTE' &&
    policy.status !== 'BACKTEST_OK'
  ) {

    throw new Error(
      'Solo se puede promover una propuesta validada.'
    );
  }

  setPolicyStatus(
    version,
    'PRODUCCION'
  );
}
