/**
 * ============================================================
 * OUTPUT.GS
 * Creación de resultados
 * ============================================================
 */


/**
 * Crea spreadsheet de salida.
 */
function crearHojaDestino(
  resultados,
  nombreOriginal,
  executionId,
  policyVersion
) {

  const safeName =
    nombreOriginal
      .replace(/\.[^.]+$/, '');

  const newSs =
    SpreadsheetApp.create(
      `Procesado_${safeName}_${executionId}`
    );


  if (APP.OUTPUT_FOLDER_ID) {

    const file =
      DriveApp.getFileById(
        newSs.getId()
      );

    const folder =
      DriveApp.getFolderById(
        APP.OUTPUT_FOLDER_ID
      );

    folder.addFile(file);

    // Evitar que permanezca además en My Drive raíz.
    try {
      DriveApp
        .getRootFolder()
        .removeFile(file);
    } catch (e) {}
  }


  // ----------------------------------------------------------
  // SHEET1
  // ----------------------------------------------------------

  const sheet1 =
    newSs.getSheets()[0];

  sheet1.setName('Sheet1');

  escribirResultados(
    sheet1,
    resultados.sheet1,
    policyVersion
  );


  // ----------------------------------------------------------
  // SHEET2
  // ----------------------------------------------------------

  const sheet2 =
    newSs.insertSheet(
      'Sheet2'
    );

  escribirResultados(
    sheet2,
    resultados.sheet2,
    policyVersion
  );


  // ----------------------------------------------------------
  // REVIEW
  // ----------------------------------------------------------

  const review =
    newSs.insertSheet(
      'REVIEW'
    );

  escribirResultados(
    review,
    resultados.review,
    policyVersion
  );


  // ----------------------------------------------------------
  // METADATA
  // ----------------------------------------------------------

  const metadata =
    newSs.insertSheet(
      'METADATA'
    );

  metadata
    .getRange(1, 1, 5, 2)
    .setValues([
      ['execution_id', executionId],
      ['policy_version', policyVersion],
      ['source_file', nombreOriginal],
      ['created_at', new Date()],
      ['spreadsheet_id', newSs.getId()]
    ]);


  return {
    id: newSs.getId(),
    url: newSs.getUrl()
  };
}


/**
 * Escribe resultados en bloque.
 */
function escribirResultados(
  sheet,
  items,
  policyVersion
) {

  const headers = [
    'record_id',
    'execution_id',
    'source_row',
    'classification',
    'confidence',
    'evidence',
    'nombre',
    'correo',
    'celular',
    'policy_version'
  ];


  if (!items || items.length === 0) {

    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([
        headers
      ]);

    sheet
      .getRange(2, 1)
      .setValue(
        'Sin registros.'
      );

    return;
  }


  const originalHeaders =
    Object.keys(
      items[0].datos_originales || {}
    );


  const finalHeaders = [
    ...headers,
    ...originalHeaders
  ];


  const rows =
    items.map(item => [

      item.record_id,

      item.execution_id,

      item.source_row,

      item.classification,

      item.confidence,

      (item.evidence || [])
        .join(' | '),

      item.nombre || '',

      item.correo || '',

      item.celular || '',

      policyVersion,

      ...originalHeaders.map(
        key =>
          item.datos_originales[key] || ''
      )
    ]);


  sheet
    .getRange(
      1,
      1,
      rows.length + 1,
      finalHeaders.length
    )
    .setValues([
      finalHeaders,
      ...rows
    ]);


  sheet.setFrozenRows(1);

  sheet
    .getRange(
      2,
      5,
      rows.length,
      1
    )
    .setNumberFormat('0.00');
}