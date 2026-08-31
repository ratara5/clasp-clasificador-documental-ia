/**
 * ============================================================
 * UTILS.GS
 * Funciones generales
 * ============================================================
 */


/**
 * Genera un ID único.
 */
function uuid() {
  return Utilities.getUuid();
}


/**
 * Normaliza texto.
 */
function normalizeText(value) {

  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}


/**
 * Escapa una cadena para regex.
 */
function escapeRegex(value) {

  return String(value)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


/**
 * Determina si algo parece un correo.
 */
function isEmail(value) {

  if (!value) {
    return false;
  }

  const text = String(value).trim();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(text);
}


/**
 * Extrae correos de un texto.
 */
function extractEmails(text) {

  if (!text) {
    return [];
  }

  const matches = String(text).match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
  );

  return matches || [];
}


/**
 * Determina si un texto parece teléfono.
 *
 * Esta versión es deliberadamente conservadora.
 * Ajustar según los datos reales.
 */
function isPhone(value) {

  if (!value) {
    return false;
  }

  const digits = String(value).replace(/\D/g, '');

  return (
    digits.length >= 7 &&
    digits.length <= 15
  );
}


/**
 * Extrae posibles teléfonos.
 */
function extractPhones(text) {

  if (!text) {
    return [];
  }

  const matches = String(text).match(
    /(?:\+?\d[\d\s().-]{6,}\d)/g
  );

  return matches || [];
}


/**
 * Heurística básica de nombre.
 *
 * No pretende resolver casos lingüísticos complejos.
 * Es un filtro inicial.
 */
function looksLikeName(value) {

  if (!value) {
    return false;
  }

  const text = String(value).trim();

  if (text.length < 3 || text.length > 100) {
    return false;
  }

  if (isEmail(text) || isPhone(text)) {
    return false;
  }

  return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.' -]+$/.test(text);
}


/**
 * Extrae nombre/correo/celular de un texto.
 */
function extractContactData(text) {

  const result = {
    nombre: '',
    correo: '',
    celular: ''
  };

  if (!text) {
    return result;
  }

  const emails = extractEmails(text);

  if (emails.length) {
    result.correo = emails[0];
  }

  const phones = extractPhones(text);

  if (phones.length) {
    result.celular = phones[0].trim();
  }

  return result;
}


/**
 * Determina si un texto contiene alguna palabra clave.
 */
function containsKeyword(text, keywords) {

  const normalized = normalizeText(text);

  return keywords.some(keyword =>
    normalized.includes(
      normalizeText(keyword)
    )
  );
}


/**
 * Determina si un texto contiene información de contacto.
 */
function containsContactInformation(text) {

  if (!text) {
    return false;
  }

  if (extractEmails(text).length > 0) {
    return true;
  }

  if (extractPhones(text).length > 0) {
    return true;
  }

  // Buscar palabras que puedan indicar campos.
  const normalized = normalizeText(text);

  const labels = [
    'nombre',
    'correo',
    'email',
    'mail',
    'celular',
    'telefono',
    'teléfono'
  ];

  return labels.some(x =>
    normalized.includes(x)
  );
}


/**
 * SHA-256 para crear firma estable del registro.
 */
function sha256(text) {

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text),
    Utilities.Charset.UTF_8
  );

  return digest
    .map(byte => {
      const value = byte < 0 ? byte + 256 : byte;
      return ('0' + value.toString(16)).slice(-2);
    })
    .join('');
}


/**
 * Genera record_id.
 */
function generateRecordId(
  messageId,
  attachmentId,
  rowNumber,
  row
) {

  const signature = sha256(
    JSON.stringify(row)
  );

  return (
    'REC-' +
    sha256(
      [
        messageId,
        attachmentId,
        rowNumber,
        signature
      ].join('|')
    ).substring(0, 24)
  );
}


/**
 * Divide array en lotes.
 */
function chunkArray(array, size) {

  const result = [];

  for (let i = 0; i < array.length; i += size) {
    result.push(
      array.slice(i, i + size)
    );
  }

  return result;
}


/**
 * Convierte número de columna 1-based a letra.
 */
function columnToLetter(column) {

  let temp;
  let letter = '';

  while (column > 0) {

    temp = (column - 1) % 26;

    letter = String.fromCharCode(
      temp + 65
    ) + letter;

    column =
      (column - temp - 1) / 26;
  }

  return letter;
}
