import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import type { ExtractedExpenseItem } from '@/lib/types/database.types';

const VALID_CATEGORIES = [
  'Moradia',
  'Mercado',
  'Alimentação / Delivery',
  'Transporte',
  'Saúde',
  'Lazer',
  'Assinaturas',
  'Educação',
  'Compras',
  'Outros',
];

const EXPENSE_ARRAY_JSON_SCHEMA = {
  type: 'array',
  description: 'Lista de despesas financeiras extraídas da imagem, fatura, cupom fiscal ou print.',
  items: {
    type: 'object',
    properties: {
      descricao: {
        type: 'string',
        description: 'Nome do estabelecimento, produto, conta ou descrição clara do gasto.',
      },
      valor: {
        type: 'number',
        description: 'Valor numérico positivo da despesa em Reais (ex: 149.90).',
      },
      categoria: {
        type: 'string',
        description:
          'Categoria sugerida entre: Moradia, Mercado, Alimentação / Delivery, Transporte, Saúde, Lazer, Assinaturas, Educação, Compras, Outros.',
      },
      quem_pagou: {
        type: 'string',
        description:
          'Identificação do pagador se constar na imagem (ex: "USER_A" se mencionar Yan / Contas Yan, "USER_B" se mencionar Larissa / Contas Larissa, "SHARED" se for conta conjunta/casal, ou "PENDENTE" se não estiver claro).',
      },
      data: {
        type: 'string',
        description: 'Data da despesa no formato YYYY-MM-DD se visível na imagem.',
      },
    },
    required: ['descricao', 'valor', 'categoria', 'quem_pagou'],
  },
};

function normalizeCategory(rawCategory?: string): string {
  if (!rawCategory) return 'Outros';
  const cleaned = rawCategory.trim();
  const exact = VALID_CATEGORIES.find(
    (c) => c.toLowerCase() === cleaned.toLowerCase()
  );
  if (exact) return exact;

  const lower = cleaned.toLowerCase();
  if (lower.includes('mercad') || lower.includes('atacad') || lower.includes('hortifrut'))
    return 'Mercado';
  if (
    lower.includes('aliment') ||
    lower.includes('restaur') ||
    lower.includes('ifood') ||
    lower.includes('delivery') ||
    lower.includes('lanch') ||
    lower.includes('padaria')
  )
    return 'Alimentação / Delivery';
  if (
    lower.includes('morad') ||
    lower.includes('alug') ||
    lower.includes('condom') ||
    lower.includes('luz') ||
    lower.includes('energia') ||
    lower.includes('água') ||
    lower.includes('internet')
  )
    return 'Moradia';
  if (
    lower.includes('transp') ||
    lower.includes('uber') ||
    lower.includes('99') ||
    lower.includes('combust') ||
    lower.includes('posto') ||
    lower.includes('gasol')
  )
    return 'Transporte';
  if (
    lower.includes('saúd') ||
    lower.includes('saud') ||
    lower.includes('farm') ||
    lower.includes('drog') ||
    lower.includes('médic')
  )
    return 'Saúde';
  if (
    lower.includes('assinat') ||
    lower.includes('stream') ||
    lower.includes('netflix') ||
    lower.includes('spotify')
  )
    return 'Assinaturas';
  if (lower.includes('lazer') || lower.includes('cinema') || lower.includes('viag'))
    return 'Lazer';
  if (lower.includes('educa') || lower.includes('curso') || lower.includes('livro'))
    return 'Educação';
  if (lower.includes('compr') || lower.includes('loja') || lower.includes('shopping'))
    return 'Compras';

  return 'Outros';
}

function normalizePayer(rawPayer?: string, fileName?: string): string {
  const combined = `${rawPayer || ''} ${fileName || ''}`.toLowerCase();
  if (
    combined.includes('user_a') ||
    combined.includes('yan') ||
    combined.includes('contas yan') ||
    combined.includes('meu')
  ) {
    return 'USER_A';
  }
  if (
    combined.includes('user_b') ||
    combined.includes('larissa') ||
    combined.includes('contas larissa') ||
    combined.includes('esposa')
  ) {
    return 'USER_B';
  }
  if (
    combined.includes('shared') ||
    combined.includes('casal') ||
    combined.includes('dividid') ||
    combined.includes('compartilhad')
  ) {
    return 'SHARED';
  }
  return 'PENDENTE';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType, fileName } = body as {
      imageBase64?: string;
      mimeType?: string;
      fileName?: string;
    };

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Nenhuma imagem em base64 foi fornecida para leitura.' },
        { status: 400 }
      );
    }

    // Extrai o mime_type e o payload puro de base64 caso venha com prefixo data:image/...;base64,
    let cleanBase64 = imageBase64.trim();
    let resolvedMimeType = mimeType || 'image/jpeg';

    const dataUrlMatch = cleanBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (dataUrlMatch) {
      resolvedMimeType = dataUrlMatch[1];
      cleanBase64 = dataUrlMatch[2];
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const apiKey = process.env.GEMINI_API_KEY;

    // Fallback amigável caso GEMINI_API_KEY ainda não esteja configurada localmente
    if (!apiKey || apiKey.trim() === '') {
      const inferredPayer = normalizePayer('', fileName);
      const fallbackItems: ExtractedExpenseItem[] = [
        {
          descricao: 'Supermercado Extra (Extraído do Print)',
          valor: 248.9,
          categoria: 'Mercado',
          quem_pagou: inferredPayer,
          data: todayStr,
        },
        {
          descricao: 'iFood / Jantar Casal (Extraído do Print)',
          valor: 89.5,
          categoria: 'Alimentação / Delivery',
          quem_pagou: inferredPayer,
          data: todayStr,
        },
        {
          descricao: 'Farmácia Raia (Extraído do Print)',
          valor: 64.2,
          categoria: 'Saúde',
          quem_pagou: inferredPayer,
          data: todayStr,
        },
      ];

      return NextResponse.json({
        items: fallbackItems,
        modelUsed: 'gemini-3.8-flash (Simulação - GEMINI_API_KEY ausente)',
        usedSimulation: true,
        warning:
          'A variável GEMINI_API_KEY ainda não foi definida no ambiente. Foram gerados itens de rascunho simulados para testar o fluxo de revisão.',
      });
    }

    const client = new GoogleGenAI({ apiKey });

    const prompt = `Você é um assistente especialista em visão computacional financeira para o aplicativo de casal "Marçal Contas" (utilizadores: Yan e Larissa).
Analise cuidadosamente a imagem enviada (pode ser foto de cupom fiscal, print de fatura de cartão, print de extrato bancário ou anotação de contas).

Extraia TODAS as despesas visíveis na imagem e retorne ESTRITAMENTE um array JSON válido contendo objetos com as seguintes chaves:
- "descricao" (string): Nome do estabelecimento, produto ou descrição limpa da despesa.
- "valor" (number): Valor numérico positivo da despesa (ponto como separador decimal, ex: 125.50). Ignore saldos totais ou subtotais se as linhas individuais já estiverem listadas.
- "categoria" (string): Categoria mais adequada escolhida EXATAMENTE dentre: "Moradia", "Mercado", "Alimentação / Delivery", "Transporte", "Saúde", "Lazer", "Assinaturas", "Educação", "Compras", "Outros".
- "quem_pagou" (string):
  - Retorne "USER_A" se a imagem indicar que a conta/cartão pertence a "Yan", "Contas Yan", "Cartão Yan".
  - Retorne "USER_B" se a imagem indicar que a conta/cartão pertence a "Larissa", "Contas Larissa", "Cartão Larissa".
  - Retorne "SHARED" se a imagem indicar explicitamente despesa compartilhada/casal.
  - Retorne "PENDENTE" se a imagem não especificar quem pagou.
- "data" (string opcional, formato YYYY-MM-DD): Data da compra caso esteja visível na linha ou no cabeçalho do comprovante (se apenas dia/mês estiverem visíveis, assuma o ano de 2026; se não houver data, use "${todayStr}").`;

    const interaction = await client.interactions.create({
      model: 'gemini-3.8-flash',
      input: [
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'image',
          data: cleanBase64,
          mime_type: resolvedMimeType,
        },
      ],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: EXPENSE_ARRAY_JSON_SCHEMA,
      },
    });

    const rawText = interaction.output_text || '[]';
    const cleanedJson = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanedJson);
    } catch {
      return NextResponse.json(
        {
          error: 'A IA analisou a imagem mas retornou um formato JSON inesperado.',
          rawOutput: rawText,
        },
        { status: 422 }
      );
    }

    const rawArray = Array.isArray(parsed)
      ? parsed
      :parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).items)
      ? ((parsed as Record<string, unknown>).items as unknown[])
      : [];

    const items: ExtractedExpenseItem[] = rawArray
      .map((entry) => {
        const obj = (entry || {}) as Record<string, unknown>;
        const rawDesc = String(obj.descricao || obj.description || '').trim();
        const rawVal =
          typeof obj.valor === 'number'
            ? obj.valor
            : parseFloat(String(obj.valor || obj.amount || '0').replace(',', '.'));
        const rawCat = String(obj.categoria || obj.category || 'Outros');
        const rawPayer = String(obj.quem_pagou || obj.payer || '');
        const rawDate = String(obj.data || obj.date || todayStr).trim();

        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayStr;

        return {
          descricao: rawDesc || 'Despesa extraída via IA',
          valor: Math.abs(Number(rawVal.toFixed(2))),
          categoria: normalizeCategory(rawCat),
          quem_pagou: normalizePayer(rawPayer, fileName),
          data: validDate,
        };
      })
      .filter((item) => !isNaN(item.valor) && item.valor > 0);

    return NextResponse.json({
      items,
      modelUsed: 'gemini-3.8-flash',
      usedSimulation: false,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Erro inesperado ao processar a imagem com Gemini.';
    return NextResponse.json(
      { error: `Falha ao extrair despesas da imagem: ${message}` },
      { status: 500 }
    );
  }
}
