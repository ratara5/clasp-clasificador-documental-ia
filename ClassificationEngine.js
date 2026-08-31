/**
 * ============================================================
 * CLASSIFICATIONENGINE.GS
 * Motor híbrido de clasificación
 * ============================================================
 */


/**
 * Clasifica todo el dataset.
 */
function clasificarDataset(
  records,
  productionPolicy
) {

  const sheet1 = [];
  const sheet2 = [];
  const review = [];

  const ambiguousForAI = [];

  for (const record of records) {

    // --------------------------------------------------------
    // CONDICIÓN 1
    // --------------------------------------------------------

    const c1 =
      evaluateCondition1(
        record,
        productionPolicy.policy
      );

    if (c1.pass) {

      sheet1.push(
        buildResult(
          record,
          'C1',
          c1.confidence,
          c1.evidence
        )
      );

      continue;
    }

    // --------------------------------------------------------
    // CONDICIÓN 2 DETERMINISTA
    // --------------------------------------------------------

    const c2 =
      evaluateCondition2Deterministic(
        record,
        productionPolicy.policy
      );

    if (c2.pass) {

      sheet2.push(
        buildResult(
          record,
          'C2_RULE',
          c2.confidence,
          c2.evidence
        )
      );

      continue;
    }

    // --------------------------------------------------------
    // CASO AMBIGUO → IA
    // --------------------------------------------------------

    if (
      productionPolicy.policy.ai &&
      productionPolicy.policy.ai.enabled
    ) {

      ambiguousForAI.push(record);

    } else {

      review.push(
        buildResult(
          record,
          'REVIEW',
          0.0,
          ['No cumple reglas deterministas']
        )
      );
    }
  }


  // ----------------------------------------------------------
  // IA
  // ----------------------------------------------------------

  const aiResults =
    classifyAmbiguousWithAI(
      ambiguousForAI,
      productionPolicy.policy
    );


  for (const result of aiResults) {

    if (
      result.decision === 'C2' &&
      result.confidence >=
        productionPolicy.policy.ai.autoThreshold
    ) {

      const record =
        ambiguousForAI.find(
          r =>
            r.record_id === result.record_id
        );

      sheet2.push(
        buildResult(
          record,
          'C2_AI',
          result.confidence,
          result.evidence,
          result.extracted
        )
      );

    } else {

      const record =
        ambiguousForAI.find(
          r =>
            r.record_id === result.record_id
        );

      review.push(
        buildResult(
          record,
          'REVIEW',
          result.confidence,
          result.evidence,
          result.extracted
        )
      );
    }
  }


  return {
    sheet1,
    sheet2,
    review
  };
}


/**
 * Condición 1.
 */
function evaluateCondition1(
  record,
  policy
) {

  const dValue =
    getColumnValue(
      record,
      APP.D_HEADER_NAME,
      4
    );

  const tValue =
    getColumnValue(
      record,
      APP.T_HEADER_NAME,
      20
    );

  const dMatches =
    normalizeText(dValue) ===
    normalizeText(
      policy.condition1.targetDValue
    );

  const contact =
    containsContactInformation(tValue);

  return {

    pass:
      dMatches && contact,

    confidence:
      dMatches && contact
        ? 1.0
        : 0.0,

    evidence: [
      dMatches
        ? 'D_MATCH'
        : 'D_NO_MATCH',

      contact
        ? 'CONTACT_IN_T'
        : 'NO_CONTACT_IN_T'
    ]
  };
}


/**
 * Condición 2 determinista.
 */
function evaluateCondition2Deterministic(
  record,
  policy
) {

  const text =
    record.searchableText;

  const contact =
    containsContactInformation(text);

  const keywords =
    policy.condition2.keywords || [];

  const keywordMatch =
    containsKeyword(
      text,
      keywords
    );

  // Excluir registros que ya deberían haber sido C1.
  const c1 =
    evaluateCondition1(
      record,
      policy
    );

  const pass =
    !c1.pass &&
    contact &&
    keywordMatch;

  return {

    pass,

    confidence:
      pass ? 1.0 : 0.0,

    evidence: [
      'NOT_C1',
      contact
        ? 'CONTACT_FOUND'
        : 'CONTACT_NOT_FOUND',
      keywordMatch
        ? 'KEYWORD_FOUND'
        : 'KEYWORD_NOT_FOUND'
    ]
  };
}


/**
 * Obtiene columna por nombre o posición.
 */
function getColumnValue(
  record,
  headerName,
  oneBasedPosition
) {

  if (
    record.original.hasOwnProperty(
      headerName
    )
  ) {

    return record.original[
      headerName
    ];
  }

  const values =
    Object.values(
      record.original
    );

  return values[
    oneBasedPosition - 1
  ] || '';
}


/**
 * Construye resultado.
 */
function buildResult(
  record,
  classification,
  confidence,
  evidence,
  extracted
) {

  const contacts =
    extracted ||
    extractContactData(
      record.searchableText
    );

  return {

    record_id:
      record.record_id,

    execution_id:
      record.execution_id,

    source_row:
      record.source_row,

    classification,

    confidence,

    evidence,

    nombre:
      contacts.nombre || '',

    correo:
      contacts.correo || '',

    celular:
      contacts.celular || '',

    datos_originales:
      record.original
  };
}
