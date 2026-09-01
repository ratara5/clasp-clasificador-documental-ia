/**
 * ============================================================
 * GMAILINGESTION.GS
 * Entrada de archivos desde Gmail
 * ============================================================
 */


/**
 * Función principal.
 *
 * Crear un activador basado en tiempo para esta función.
 */
function procesarCorreosEntrantes() {

  const lock =
    LockService.getScriptLock();

  if (!lock.tryLock(10000)) {

    console.log(
      'Otra ejecución está procesando.'
    );

    return;
  }

  try {

    const query =
      APP.GMAIL_QUERY;
    Logger.log(`query: ${query}`)

    const threads =
      GmailApp.search(query, 0, 20);

    const label =
      getOrCreateGmailLabel(
        APP.PROCESSED_LABEL
      );

    for (const thread of threads) {
      Logger.log(`thread: ${thread}`)
      const messages =
        thread.getMessages();

      for (const message of messages) {
        Logger.log(`message: ${message}`)
        const attachments =
          message.getAttachments();

        for (
          const attachment of attachments
        ) {

          const name =
            attachment.getName();

          if (
            !/\.xlsx?$/i.test(name)
          ) {
            continue;
          }

          const attachmentId =
            sha256(
              [
                message.getId(),
                name,
                attachment.getSize()
              ].join('|')
            );

          if (
            executionAlreadyExists(
              message.getId(),
              attachmentId
            )
          ) {

            continue;
          }

          procesarAdjunto(
            message,
            attachment,
            attachmentId
          );
        }
      }

      // No usamos "leído" como control lógico.
      // La etiqueta es solamente visual.
      thread.addLabel(label);
    }

  } finally {

    lock.releaseLock();
  }
}


/**
 * Procesa un adjunto.
 */
function procesarAdjunto(
  message,
  attachment,
  attachmentId
) {

  const executionId =
    'EXE-' + uuid();

  const startedAt =
    new Date();

  const policy =
    getProductionPolicy();

  registrarExecution({
    executionId,
    messageId: message.getId(),
    attachmentId,
    attachmentName: attachment.getName(),
    receivedAt: message.getDate(),
    startedAt,
    status: 'PROCESSING',
    policyVersion: policy.version
  });

  try {

    const resultado =
      procesarExcel(
        attachment,
        message.getId(),
        attachmentId,
        executionId,
        policy
      );

    const output =
      crearHojaDestino(
        resultado,
        attachment.getName(),
        executionId,
        policy.version
      );

    actualizarExecution(
      executionId,
      {
        status: 'PROCESSED',
        finishedAt: new Date(),
        outputSpreadsheetId: output.id
      }
    );

  } catch (error) {

    actualizarExecution(
      executionId,
      {
        status: 'FAILED',
        finishedAt: new Date(),
        error: error.stack || error.message
      }
    );

    throw error;
  }
}


/**
 * Determina si ya se procesó el adjunto.
 */
function executionAlreadyExists(
  messageId,
  attachmentId
) {

  const ss =
    getControlSpreadsheet();

  const sheet =
    ss.getSheetByName('EXECUTIONS');

  if (sheet.getLastRow() < 2) {
    return false;
  }

  const rows =
    sheet
      .getDataRange()
      .getValues()
      .slice(1);

  return rows.some(row =>
    row[1] === messageId &&
    row[2] === attachmentId &&
    (
      row[7] === 'PROCESSED' ||
      row[7] === 'PROCESSING'
    )
  );
}


/**
 * Registra ejecución.
 */
function registrarExecution(data) {

  const sheet =
    getControlSpreadsheet()
      .getSheetByName('EXECUTIONS');

  sheet.appendRow([
    data.executionId,
    data.messageId,
    data.attachmentId,
    data.attachmentName,
    data.receivedAt,
    data.startedAt,
    '',
    data.status,
    data.policyVersion,
    '',
    ''
  ]);
}


/**
 * Actualiza ejecución.
 */
function actualizarExecution(
  executionId,
  changes
) {

  const sheet =
    getControlSpreadsheet()
      .getSheetByName('EXECUTIONS');

  const data =
    sheet.getDataRange()
      .getValues();

  const index =
    data.findIndex(
      row => row[0] === executionId
    );

  if (index < 1) {
    throw new Error(
      `Execution ${executionId} no encontrada.`
    );
  }

  const rowNumber =
    index + 1;

  const mapping = {
    status: 8,
    finishedAt: 7,
    outputSpreadsheetId: 10, // 11?
    error: 11
  };

  if (changes.status !== undefined) {
    sheet
      .getRange(rowNumber, 8)
      .setValue(changes.status);
  }

  if (changes.finishedAt !== undefined) {
    sheet
      .getRange(rowNumber, 7)
      .setValue(changes.finishedAt);
  }

  if (changes.outputSpreadsheetId !== undefined) {
    sheet
      .getRange(rowNumber, 10)
      .setValue(changes.outputSpreadsheetId);
  }

  if (changes.error !== undefined) {
    sheet
      .getRange(rowNumber, 11)
      .setValue(changes.error);
  }
}


/**
 * Obtiene/crea label de Gmail.
 */
function getOrCreateGmailLabel(name) {

  return (
    GmailApp.getUserLabelByName(name) ||
    GmailApp.createLabel(name)
  );
}