/**
 * ============================================================
 * PROCESSNOIA.GS
 * Flujo end-to-end de clasificación determinista (sin IA)
 * ============================================================
 */


/**
 * Punto de entrada por activador de tiempo (Gmail → output).
 *
 * Crea un activador basado en tiempo para esta función.
 */
function procesarCorreosEntrantesSinIA() {

  const lock =
    LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    console.log('Otra ejecución sin IA está procesando.');
    return;
  }

  try {
    const threads =
      GmailApp.search(APP.GMAIL_QUERY, 0, 20);

    const label =
      getOrCreateGmailLabel(APP.PROCESSED_LABEL);

    for (const thread of threads) {
      for (const message of thread.getMessages()) {
        for (const attachment of message.getAttachments()) {

          const name = attachment.getName();

          if (!/\.xlsx?$/i.test(name)) {
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

          procesarAdjuntoSinIA(
            message,
            attachment,
            attachmentId
          );
        }
      }

      thread.addLabel(label);
    }
  } finally {
    lock.releaseLock();
  }
}


/**
 * Procesa un adjunto de punta a punta (sin IA).
 */
function procesarAdjuntoSinIA(
  message,
  attachment,
  attachmentId
) {

  const executionId =
    'EXE-NS-' + uuid();

  const startedAt =
    new Date();

  registrarExecution({
    executionId,
    messageId: message.getId(),
    attachmentId,
    attachmentName: attachment.getName(),
    receivedAt: message.getDate(),
    startedAt,
    status: 'PROCESSING',
    policyVersion: 'SIN_IA'
  });

  try {

    const tempFile =
      convertirExcelAGoogleSheet(attachment);

    try {

      const { records } =
        leerRegistrosDeExcel(
          tempFile.id,
          message.getId(),
          attachmentId,
          executionId
        );

      const resultado =
        procesarSinIA(records);

      const output =
        crearHojaDestino(
          resultado,
          attachment.getName(),
          executionId,
          'SIN_IA'
        );

      actualizarExecution(
        executionId,
        {
          status: 'PROCESSED',
          finishedAt: new Date(),
          outputSpreadsheetId: output.id
        }
      );

    } finally {

      try {
        DriveApp
          .getFileById(tempFile.id)
          .setTrashed(true);
      } catch (e) {
        console.log(
          'No se pudo eliminar temporal: ' + e.message
        );
      }
    }

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
 * Clasifica registros deterministas (reutiliza Util.js).
 *
 * - sheet1: cumple C1 (columna O = valor + contacto en T)
 * - sheet2: cumple C2 (no C1 + contacto + palabra clave)
 *
 * Produce el shape esperado por Output.escribirResultados.
 */
function procesarSinIA(records) {

  const resultado = {
    sheet1: [],
    sheet2: []
  };

  records.forEach(record => {

    const original = record.original;

    const valorO =
      normalizeText(
        getColumnValue(
          record,
          APP.O_HEADER_NAME,
          APP.CONDICION1_COLUMNA
        )
      );

    const valorT =
      normalizeText(
        getColumnValue(
          record,
          APP.T_HEADER_NAME,
          APP.CONDICION1_DATOS_COLUMNA
        )
      );

    const cumpleC1 =
      valorO === normalizeText(APP.TARGET_O_VALUE) &&
      containsContactInformation(valorT);

    // Los datos de contacto se extraen de la columna T.
    const datosExtraidos =
      extractContactData(
        record.searchableTextT
      );

    const tieneTipoDato =
      datosExtraidos.nombre !== '' ||
      datosExtraidos.correo !== '' ||
      datosExtraidos.celular !== '';

    const tienePalabraClave =
      containsKeyword(
        record.searchableText,
        APP.BASE_KEYWORDS
      );

    const cumpleC2 =
      !cumpleC1 &&
      tieneTipoDato &&
      tienePalabraClave;

    if (!cumpleC1 && !cumpleC2) {
      return;
    }

    const base = {
      record_id: record.record_id,
      execution_id: record.execution_id,
      source_row: record.source_row,
      classification: cumpleC1 ? 'C1' : 'C2_SIN_IA',
      confidence: 1.0,
      evidence: cumpleC1
        ? ['DETERMINISTA_C1']
        : ['DETERMINISTA_C2'],
      nombre: datosExtraidos.nombre,
      correo: datosExtraidos.correo,
      celular: datosExtraidos.celular,
      datos_originales: original
    };

    if (cumpleC1) {
      resultado.sheet1.push(base);
    } else {
      resultado.sheet2.push(base);
    }
  });

  return resultado;
}
