import type { PayerType } from '@/lib/types/database.types';

export interface ParsedStatementItem {
  expense_date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  category: string;
  payer_type?: PayerType;
}

/**
 * Classifica automaticamente a categoria da despesa a partir da descrição do extrato/fatura.
 */
export function inferExpenseCategory(description: string): string {
  const lower = description.toLowerCase();
  if (
    /ifood|rappi|uber\s*eats|restaurante|padaria|lanchonete|burger|pizza|cafe|bar|outback|mcdonalds|bk\b/.test(
      lower
    )
  ) {
    return 'Alimentação / Delivery';
  }
  if (/atacadao|assai|carrefour|pao de acucar|mercado|supermercado|hortifruti|extra|dia\b/.test(lower)) {
    return 'Mercado';
  }
  if (/uber|99app|99pop|posto|ipiranga|shell|petrobras|estacionamento|sem\s*parar|veloe|pedagio/.test(lower)) {
    return 'Transporte';
  }
  if (/aluguel|condominio|enel|light|cpfl|sabesp|agua|energia|luz|gas|internet|vivo|claro|tim|oi\b/.test(lower)) {
    return 'Moradia';
  }
  if (/drogasil|droga\s*raia|pacheco|farmacia|panvel|hospital|clinica|medico|exame|unimed|amil/.test(lower)) {
    return 'Saúde';
  }
  if (/netflix|spotify|amazon\s*prime|disney|hbo|max|youtube|apple\.com|google|chatgpt|steam|playstation|psn/.test(lower)) {
    return 'Assinaturas';
  }
  if (/cinema|ingresso|show|viagem|hotel|airbnb|latam|gol|azul|bar|parque/.test(lower)) {
    return 'Lazer';
  }
  if (/faculdade|curso|udemy|alura|escola|livro|livraria/.test(lower)) {
    return 'Educação';
  }
  if (/amazon|mercadolivre|mercado\s*livre|shopee|magalu|magazine|shein|aliex|kabum|casas\s*bahia|renner|zara/.test(lower)) {
    return 'Compras';
  }
  return 'Outros';
}

/**
 * Normaliza datas em formatos brasileiros (DD/MM/YYYY, DD/MM/YY, DD/MM, YYYY-MM-DD, YYYYMMDD)
 * para o padrão ISO YYYY-MM-DD.
 */
export function normalizeStatementDate(rawDate: string): string {
  const today = new Date();
  const currentYear = today.getFullYear();
  const cleaned = rawDate.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  // OFX YYYYMMDD...
  const ofxMatch = cleaned.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofxMatch) {
    return `${ofxMatch[1]}-${ofxMatch[2]}-${ofxMatch[3]}`;
  }

  // DD/MM/YYYY ou DD-MM-YYYY
  const dmyFull = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyFull) {
    const d = dmyFull[1].padStart(2, '0');
    const m = dmyFull[2].padStart(2, '0');
    return `${dmyFull[3]}-${m}-${d}`;
  }

  // DD/MM/YY
  const dmyShort = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (dmyShort) {
    const d = dmyShort[1].padStart(2, '0');
    const m = dmyShort[2].padStart(2, '0');
    return `20${dmyShort[3]}-${m}-${d}`;
  }

  // DD/MM (faturas de cartão costumam exibir apenas dia/mês)
  const dmOnly = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (dmOnly) {
    const d = dmOnly[1].padStart(2, '0');
    const m = dmOnly[2].padStart(2, '0');
    return `${currentYear}-${m}-${d}`;
  }

  return today.toISOString().split('T')[0];
}

/**
 * Converte strings monetárias brasileiras ou internacionais ("R$ 1.234,56", "-45,90", "120.50")
 * em número positivo válido.
 */
export function parseCurrencyAmount(rawAmount: string): number | null {
  if (!rawAmount) return null;
  const cleaned = rawAmount.replace(/[R$\s]/gi, '').trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  // Formato 1.234,56
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  }

  const value = parseFloat(normalized);
  if (isNaN(value) || value === 0) return null;
  return Number(Math.abs(value).toFixed(2));
}

/**
 * Parser de arquivos CSV (Nubank, Itaú, Inter, Bradesco, Santander, C6, XP, genéricos).
 * Suporta delimitadores `,` ou `;`.
 */
export function parseCSVStatement(content: string): ParsedStatementItem[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const splitRow = (row: string) =>
    row
      .split(delimiter)
      .map((cell) => cell.replace(/^["']|["']$/g, '').trim());

  const headerCols = splitRow(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = headerCols.some((c) =>
    /data|date|descri|title|historico|estabelecimento|valor|amount|value|quantia/.test(c)
  );

  const dateIdx = hasHeader
    ? headerCols.findIndex((c) => /data|date|dt/.test(c))
    : 0;
  const amountIdx = hasHeader
    ? headerCols.findIndex((c) => /valor|amount|value|quantia|preco/.test(c))
    : -1;
  const categoryIdx = hasHeader
    ? headerCols.findIndex((c) => /categoria|category/.test(c))
    : -1;
  const descIdx = hasHeader
    ? headerCols.findIndex((c) => /descri|title|historico|estabelecimento|lancamento|memo|nome/.test(c))
    : 1;

  const startRow = hasHeader ? 1 : 0;
  const results: ParsedStatementItem[] = [];

  for (let i = startRow; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    if (cols.length < 2) continue;

    const rawDate = cols[dateIdx >= 0 ? dateIdx : 0] || '';
    let rawAmount = '';
    if (amountIdx >= 0 && cols[amountIdx] !== undefined) {
      rawAmount = cols[amountIdx];
    } else {
      rawAmount = cols[cols.length - 1];
    }

    let rawDesc = '';
    if (descIdx >= 0 && cols[descIdx] !== undefined) {
      rawDesc = cols[descIdx];
    } else {
      rawDesc = cols.find((c, idx) => idx !== dateIdx && idx !== amountIdx) || 'Despesa Importada';
    }

    // Ignora linhas de pagamento de fatura recebido
    if (/pagamento\s+recebido|pagamento\s+de\s+fatura|saldo\s+anterior/i.test(rawDesc)) {
      continue;
    }

    const amount = parseCurrencyAmount(rawAmount);
    if (!amount || amount <= 0) continue;

    const expense_date = normalizeStatementDate(rawDate);
    const description = rawDesc.slice(0, 120);
    const explicitCat = categoryIdx >= 0 ? cols[categoryIdx] : '';
    const category = explicitCat
      ? inferExpenseCategory(`${explicitCat} ${description}`)
      : inferExpenseCategory(description);

    results.push({
      expense_date,
      description,
      amount,
      category,
    });
  }

  return results;
}

/**
 * Parser de arquivos OFX (Open Financial Exchange - Extratos e Faturas Bancárias).
 */
export function parseOFXStatement(content: string): ParsedStatementItem[] {
  const results: ParsedStatementItem[] = [];
  const blocks = content.split(/<STMTTRN>/i).slice(1);

  for (const block of blocks) {
    const trnBlock = block.split(/<\/STMTTRN>/i)[0] || block;

    const dtMatch = trnBlock.match(/<DTPOSTED>\s*([0-9]{8})/i);
    const amtMatch = trnBlock.match(/<TRNAMT>\s*([\-0-9.,]+)/i);
    const memoMatch =
      trnBlock.match(/<MEMO>\s*([^\r\n<]+)/i) ||
      trnBlock.match(/<NAME>\s*([^\r\n<]+)/i);

    if (!amtMatch) continue;
    const amount = parseCurrencyAmount(amtMatch[1]);
    if (!amount || amount <= 0) continue;

    const description = (memoMatch ? memoMatch[1].trim() : 'Lançamento OFX').slice(0, 120);
    if (/pagamento\s+recebido|pagamento\s+fatura/i.test(description)) {
      continue;
    }

    const expense_date = dtMatch
      ? normalizeStatementDate(dtMatch[1])
      : new Date().toISOString().split('T')[0];

    results.push({
      expense_date,
      description,
      amount,
      category: inferExpenseCategory(description),
    });
  }

  return results;
}

/**
 * Extrai lançamentos a partir de texto bruto de faturas PDF ou OCR de imagens (PNG/JPEG).
 * Reconhece linhas no formato:
 *   "15/10/2026  IFOOD *RESTAURANTE  R$ 89,90"
 *   "15/10       UBER *TRIP          34,50"
 */
export function parseRawTextLines(rawText: string): ParsedStatementItem[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 6);

  const results: ParsedStatementItem[] = [];
  const lineRegex =
    /^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{4}-\d{2}-\d{2})\s+(.+?)\s+(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+\.\d{2})$/i;

  for (const line of lines) {
    const match = line.match(lineRegex);
    if (!match) continue;

    const [, rawDate, rawDesc, rawAmt] = match;
    if (/pagamento\s+recebido|total\s+da\s+fatura|saldo\s+anterior/i.test(rawDesc)) {
      continue;
    }

    const amount = parseCurrencyAmount(rawAmt);
    if (!amount || amount <= 0) continue;

    const description = rawDesc.replace(/\s+/g, ' ').trim().slice(0, 120);
    results.push({
      expense_date: normalizeStatementDate(rawDate),
      description,
      amount,
      category: inferExpenseCategory(description),
    });
  }

  return results;
}
