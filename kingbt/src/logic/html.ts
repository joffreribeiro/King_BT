/** Escape e validação para montar HTML de relatório/PDF com dados que o usuário digita (nomes, local, grupo...). */

/** Escapa <, >, &, " e ' para o texto não virar tag nem fechar atributo. */
export function esc(t: string | number | null | undefined): string {
  return String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Cor vinda de dados do usuário, usada dentro de style="...": só aceita #RGB, #RRGGBB ou #RRGGBBAA; senão, o padrão. */
export function safeColor(c: unknown, fallback = '#555555'): string {
  return typeof c === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(c) ? c : fallback;
}
