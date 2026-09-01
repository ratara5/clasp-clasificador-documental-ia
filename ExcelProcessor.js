/**
 * ============================================================
 * EXCELPROCESSOR.GS
 * Conversión XLS/XLSX y normalización
 * ============================================================
 */


/**
 * Procesa el XLS completo.
 */
function procesarExcel(
  attachment,
  messageId,
  attachmentId,
  executionId,
  productionPolicy
) {

  const tempFile =
    convertirExcelAGoogleSheet(
      attachment
    );

  try {

    const { records } =
      leerRegistrosDeExcel(
        tempFile.id,
        messageId,
        attachmentId,
        executionId
      );

    return clasificarDataset(
      records,
      productionPolicy
    );

  } finally {

    // Eliminar temporal.
    try {
      DriveApp
        .getFileById(tempFile.id)
        .setTrashed(true);
    } catch (e) {
      console.log(
        'No se pudo eliminar temporal: ' +
        e.message
      );
    }
  }
}


/**
 * Convierte Excel a Google Sheets.
 *
 * Drive API v3:
 * Drive.Files.create()
 */
function convertirExcelAGoogleSheet(
  attachment
) {

  const blob =
    attachment.copyBlob();

  const resource = {
    name:
      `TEMP_${Date.now()}_${attachment.getName()}`,
    mimeType:
      'application/vnd.google-apps.spreadsheet'
  };

  return Drive.Files.create(
    resource,
    blob,
    {
      fields: 'id,name,mimeType'
    }
  );
}


/**
 * Normaliza una fila.
 */
function normalizeRecord(
  headers,
  row,
  sourceRow,
  messageId,
  attachmentId,
  executionId
) {

  const original = {};

  headers.forEach(
    (header, index) => {

      original[header] =
        row[index] === undefined
          ? ''
          : row[index];
    }
  );

  const recordId =
    generateRecordId(
      messageId,
      attachmentId,
      sourceRow,
      row
    );

  return {

    record_id: recordId,

    execution_id: executionId,

    source_row: sourceRow,

    source_message_id: messageId,

    source_attachment_id:
      attachmentId,

    original,

    searchableText:
      row
        .map(value =>
          String(value || '')
        )
        .join(' | '),

    // Contenido de la columna T (índice 19, 1-based 20).
    // Fuente autoritativa para extracción de datos de contacto.
    searchableTextT:
      String(row[APP.CONDICION1_DATOS_COLUMNA - 1] || '')
  };
}


/**
 * Convierte y lee los registros de un archivo XLS ya convertido.
 *
 * Reutilizable por cualquier orquestador (con o sin IA).
 * Devuelve headers y registros normalizados.
 */
function leerRegistrosDeExcel(
  tempFileId,
  messageId,
  attachmentId,
  executionId
) {

  const ss =
    SpreadsheetApp.openById(
      tempFileId
    );

  const sourceSheet =
    ss.getSheets()[0];

  const values =
    sourceSheet
      .getDataRange()
      .getValues();

  if (values.length < 2) {

    throw new Error(
      'El archivo no contiene registros.'
    );
  }

  const headers =
    values[0].map(
      (value, index) =>
        value ||
        `COL_${index + 1}`
    );

  const rows =
    values.slice(1);

  const records =
    rows.map(
      (row, index) =>
        normalizeRecord(
          headers,
          row,
          index + 2,
          messageId,
          attachmentId,
          executionId
        )
    );

  return {
    headers,
    records
  };
}