/**
 * ============================================================
 * WEBAPPROVAL.GS
 * Interfaz de aprobación
 * ============================================================
 */


/**
 * Web App.
 */
function doGet(e) {

  const version =
    e &&
    e.parameter &&
    e.parameter.version
      ? e.parameter.version
      : '';


  const template =
    HtmlService.createTemplateFromFile(
      'Approval'
    );


  template.version =
    version;


  return template
    .evaluate()
    .setTitle(
      'Aprobación de política IA'
    );
}


/**
 * Aprobar desde interfaz.
 */
function webApprove(version) {

  aprobarPropuesta(version);

  return {
    success: true,
    version
  };
}


/**
 * Rechazar desde interfaz.
 */
function webReject(version) {

  rechazarPropuesta(version);

  return {
    success: true,
    version
  };
}