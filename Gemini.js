/**
 * ============================================================
 * GEMINI.GS
 * Integración con Gemini
 * ============================================================
 */


/**
 * Clasifica casos ambiguos.
 */
function classifyAmbiguousWithAI(
  records,
  policy
) {

  if (!records.length) {
    return [];
  }

  const results = [];

  const batches =
    chunkArray(
      records,
      APP.AI_BATCH_SIZE
    );

  for (const batch of batches) {

    const batchResults =
      callGeminiClassifier(
        batch,
        policy
      );

    results.push(
      ...batchResults
    );
  }

  return results;
}


/**
 * Llamada al modelo.
 */
function callGeminiClassifier(
  records,
  policy
) {

  const apiKey =
    getGeminiApiKey();

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(APP.GEMINI_MODEL) +
    ':generateContent?key=' +
    encodeURIComponent(apiKey);


  const dataset =
    records.map(record => ({

      record_id:
        record.record_id,

      source_row:
        record.source_row,

      data:
        record.original
    }));


  const prompt = `
Eres un clasificador documental.

NO debes inventar información.

Tu tarea es decidir si cada registro ambiguo:
- pertenece a C2
- debe ir a REVIEW
- no pertenece a C2

IMPORTANTE:
C1 ya fue evaluada por un motor determinista.
No debes mover un registro a C1.

CONDICIÓN 2:

El registro puede pertenecer a C2 cuando:

1. No cumple C1.
2. Contiene información identificable como:
   - nombre
   - correo
   - email
   - mail
   - celular
3. Presenta alguna palabra clave o patrón semánticamente equivalente
   definido en la política.

POLÍTICA ACTUAL:

${JSON.stringify(policy, null, 2)}

REGLAS DE SEGURIDAD:

- No inventes nombres.
- No inventes correos.
- No inventes celulares.
- Si no existe un dato, devuelve cadena vacía.
- Si la evidencia es insuficiente, utiliza REVIEW.
- No consideres una coincidencia semántica suficiente si es demasiado débil.
- Explica brevemente la evidencia.

REGISTROS:

${JSON.stringify(dataset, null, 2)}
`;


  const schema = {

    type: 'object',

    properties: {

      results: {

        type: 'array',

        items: {

          type: 'object',

          properties: {

            record_id: {
              type: 'string'
            },

            decision: {
              type: 'string',
              enum: [
                'C2',
                'REVIEW',
                'NO_C2'
              ]
            },

            confidence: {
              type: 'number'
            },

            evidence: {
              type: 'array',
              items: {
                type: 'string'
              }
            },

            extracted: {

              type: 'object',

              properties: {

                nombre: {
                  type: 'string'
                },

                correo: {
                  type: 'string'
                },

                celular: {
                  type: 'string'
                }
              },

              required: [
                'nombre',
                'correo',
                'celular'
              ]
            }
          },

          required: [
            'record_id',
            'decision',
            'confidence',
            'evidence',
            'extracted'
          ]
        }
      }
    },

    required: [
      'results'
    ]
  };


  const payload = {

    contents: [
      {
        role: 'user',
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],

    generationConfig: {

      responseMimeType:
        'application/json',

      responseSchema:
        schema,

      temperature: 0.1
    }
  };


  const response =
    UrlFetchApp.fetch(
      url,
      {
        method: 'post',

        contentType:
          'application/json',

        headers: {
          'x-goog-api-key':
            apiKey
        },

        payload:
          JSON.stringify(payload),

        muteHttpExceptions:
          true
      }
    );


  const status =
    response.getResponseCode();

  const body =
    response.getContentText();


  if (status < 200 || status >= 300) {

    throw new Error(
      `Gemini HTTP ${status}: ${body}`
    );
  }


  const json =
    JSON.parse(body);


  const text =
    json
      .candidates[0]
      .content
      .parts
      .map(p => p.text || '')
      .join('');


  const parsed =
    JSON.parse(text);


  validateAIResults(
    parsed.results,
    records
  );


  return parsed.results;
}


/**
 * Validación posterior a Gemini.
 */
function validateAIResults(
  results,
  sourceRecords
) {

  const validIds =
    new Set(
      sourceRecords.map(
        r => r.record_id
      )
    );

  for (const result of results) {

    if (
      !validIds.has(
        result.record_id
      )
    ) {

      throw new Error(
        `Gemini devolvió record_id desconocido: ${result.record_id}`
      );
    }

    if (
      ![
        'C2',
        'REVIEW',
        'NO_C2'
      ].includes(
        result.decision
      )
    ) {

      throw new Error(
        `Decisión IA inválida: ${result.decision}`
      );
    }

    if (
      typeof result.confidence !==
      'number'
    ) {

      throw new Error(
        'Confidence inválido.'
      );
    }

    if (
      result.confidence < 0 ||
      result.confidence > 1
    ) {

      throw new Error(
        'Confidence fuera de rango.'
      );
    }
  }
}


/**
 * Agente que analiza feedback y propone nueva política.
 */
function callGeminiRuleLearner(
  productionPolicy,
  feedback,
  examples
) {

  const apiKey =
    getGeminiApiKey();

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(APP.GEMINI_MODEL) +
    ':generateContent?key=' +
    encodeURIComponent(apiKey);


  const prompt = `
Actúa como un arquitecto de reglas de clasificación documental.

Debes mejorar la CONDICIÓN 2.

POLÍTICA ACTUAL:

${JSON.stringify(
  productionPolicy,
  null,
  2
)}

FEEDBACK HUMANO:

${JSON.stringify(
  feedback,
  null,
  2
)}

EJEMPLOS:

${JSON.stringify(
  examples,
  null,
  2
)}

OBJETIVO:

Identificar patrones que permitan capturar falsos negativos
sin introducir falsos positivos innecesarios.

RESTRICCIONES:

1. No inventes características.
2. Cada patrón propuesto debe estar respaldado por ejemplos.
3. No bases una nueva regla exclusivamente en un único ejemplo
   salvo que el feedback humano lo haya indicado explícitamente.
4. No elimines reglas existentes salvo evidencia clara.
5. La propuesta debe ser reversible.
6. No modifiques C1.
7. No inventes datos personales.
8. Si no existe evidencia suficiente, devuelve una propuesta
   que no agregue nuevas reglas.

Devuelve una nueva política completa y una justificación.
`;


  const schema = {

    type: 'object',

    properties: {

      policy: {
        type: 'object'
      },

      justification: {
        type: 'string'
      },

      patterns: {

        type: 'array',

        items: {

          type: 'object',

          properties: {

            id: {
              type: 'string'
            },

            type: {
              type: 'string'
            },

            description: {
              type: 'string'
            },

            evidenceIds: {

              type: 'array',

              items: {
                type: 'string'
              }
            },

            confidence: {
              type: 'number'
            }
          },

          required: [
            'id',
            'type',
            'description',
            'evidenceIds',
            'confidence'
          ]
        }
      }
    },

    required: [
      'policy',
      'justification',
      'patterns'
    ]
  };


  const payload = {

    contents: [
      {
        role: 'user',
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],

    generationConfig: {

      responseMimeType:
        'application/json',

      responseSchema:
        schema,

      temperature: 0.1
    }
  };


  const response =
    UrlFetchApp.fetch(
      url,
      {
        method: 'post',
        contentType:
          'application/json',
        headers: {
          'x-goog-api-key':
            apiKey
        },
        payload:
          JSON.stringify(payload),
        muteHttpExceptions:
          true
      }
    );


  const status =
    response.getResponseCode();

  const body =
    response.getContentText();


  if (
    status < 200 ||
    status >= 300
  ) {

    throw new Error(
      `Gemini Rule Learner HTTP ${status}: ${body}`
    );
  }


  const json =
    JSON.parse(body);

  const text =
    json
      .candidates[0]
      .content
      .parts
      .map(p => p.text || '')
      .join('');

  return JSON.parse(text);
}
