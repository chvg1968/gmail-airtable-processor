/**
 * Elimina la cabecera del mensaje reenviado ("---------- Forwarded message ---------")
 * y devuelve únicamente el cuerpo original. Si no se detecta sección reenviada
 * devuelve el texto sin modificar.
 */
export function stripForwardHeaders(body: string): string {
  const forwardMarker = "---------- Forwarded message ---------";
  const markerIndex = body.lastIndexOf(forwardMarker);
  if (markerIndex === -1) return body;

  // Buscar el doble salto de línea que separa cabeceras del contenido reenviado
  const headerEndIndex = body.indexOf("\n\n", markerIndex);
  if (headerEndIndex === -1) return body;

  return body.substring(headerEndIndex).trim();
}
