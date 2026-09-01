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
 * Celular colombiano:
 * - Empieza por 3 (rango móvil completo 3xx).
 * - Total 10 dígitos.
 *
 * Formatos aceptados:
 *   3001234567, 300 1234567, 300 123 4567, 300-123-4567
 */
const CELULAR_REGEX = /(?<!\d)3(?:[\d\s().\-]{0,2}\d){9}(?!\d)/g;


/**
 * Normaliza separadores de un posible celular
 * conservando solo dígitos contiguos.
 */
function limpiarCelular(text) {
  return String(text).replace(/[\s().\-]/g, '');
}


/**
 * Determina si un valor parece un celular colombiano.
 */
function isPhone(value) {

  if (!value) {
    return false;
  }

  return /^3\d{9}$/.test(
    limpiarCelular(value)
  );
}


/**
 * Extrae todos los celulares colombianos de un texto.
 *
 * Opera sobre el texto original (sin limpiar) para respetar
 * los límites de palabra, tolerando separadores (espacio,
 * guion, punto) entre dígitos. Devuelve cadenas de 10 dígitos.
 */
function extractPhones(text) {

  if (!text) {
    return [];
  }

  const found =
    String(text).match(
      CELULAR_REGEX
    ) || [];

  const resultados = found.map(
    cadena => limpiarCelular(cadena)
  );

  return resultados.filter(
    (value, index, self) =>
      self.indexOf(value) === index &&
      /^3\d{9}$/.test(value)
  );
}


/**
 * Extrae todos los nombres propios de un texto.
 *
 * Heurística: secuencias de 1+ tokens con inicial mayúscula,
 * excluyendo emojis, números, emails, celulares y tokens
 * que ya fueron consumidos como datos de contacto.
 */
function extractNames(text) {

  if (!text) {
    return [];
  }

  const filtrado = String(text)
    .replace(/[.,;:()]/g, ' | ')
    .replace(/[^\w\sÁÉÍÓÚÜÑáéíóúüñ|]/g, ' ')
    .replace(/\d{2,}/g, ' ')
    .replace(CELULAR_REGEX, ' ')
    .replace(/\b\w+@\w+\.\w+\b/g, ' ');

  const tokens =
    filtrado.match(
      /\b[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]*)*/g
    ) || [];

  const STOP = new Set([
    'Descripcion',
    'Hechos',
    'Nombre',
    'Correo',
    'Celular',
    'Telefono',
    'Teléfono',
    'Email',
    'Mail',
    'Cliente',
    'Importante',
    'Registro',
    'Sr',
    'Sra',
    'Señor',
    'Señora',
    'Dr',
    'Dra',
    'Favor',
    'Hola',
    'Buenas',
    'Buenos',
    'Dias',
    'Día',
    'Tardes',
    'Noches'
  ]);

  const nombres = tokens
    .map(token => token.trim())
    .filter(token => {
      const words = token.split(/\s+/);
      return words.length >= 1 && !STOP.has(words[0]);
    });

  return nombres.filter(
    (value, index) =>
      nombres.indexOf(value) === index
  );
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
 * Extrae todos los contactos (nombre/correo/celular)
 * de un texto, uniendo múltiples coincidencias con ", ".
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
    result.correo =
      emails.join(', ');
  }

  const phones = extractPhones(text);

  if (phones.length) {
    result.celular =
      phones.join(', ');
  }

  const names = extractNames(text);

  if (names.length) {
    result.nombre =
      names.join(', ');
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
