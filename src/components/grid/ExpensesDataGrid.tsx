'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  colorSchemeDarkBlue,
  type ColDef,
  type CellValueChangedEvent,
  type ICellRendererParams,
  type RowClassParams,
} from 'ag-grid-community';
import type {
  Expense,
  ExtractedExpenseItem,
  PayerType,
} from '@/lib/types/database.types';
import {
  Plus,
  Trash2,
  Table2,
  FileUp,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  XCircle,
  CreditCard,
} from 'lucide-react';
import { formatBRL } from '@/components/dashboard/SummaryHeader';
import StatementImportModal from './StatementImportModal';
import PhotoPrintDropzone from './PhotoPrintDropzone';

ModuleRegistry.registerModules([AllCommunityModule]);

export const EXPENSE_CATEGORIES = [
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

export const YAN_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const LARISSA_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

export const PAYER_LABELS: Record<PayerType, string> = {
  USER_A: 'Yan (Eu)',
  USER_B: 'Larissa (Esposa)',
  SHARED: 'Dividido (Casal)',
};

const LABEL_TO_PAYER: Record<string, PayerType> = {
  'Yan (Eu)': 'USER_A',
  'Larissa (Esposa)': 'USER_B',
  'Dividido (Casal)': 'SHARED',
};

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Regra de Negócio: Data de Vencimento Fixa no dia 06 dos meses subsequentes.
 * Para a parcela `installmentIndex` (1 até N), calcula YYYY-MM-06 a partir do mês seguinte à data base.
 */
export function calculateSubsequentDay06Date(
  baseDateStr: string,
  installmentNumber: number
): string {
  const [yStr, mStr] = baseDateStr.split('-');
  const baseYear = parseInt(yStr, 10) || new Date().getFullYear();
  const baseMonthZeroIndexed = (parseInt(mStr, 10) || new Date().getMonth() + 1) - 1;

  const targetDate = new Date(
    Date.UTC(baseYear, baseMonthZeroIndexed + installmentNumber, 6)
  );
  const yyyy = targetDate.getUTCFullYear();
  const mm = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-06`;
}

interface ExpensesDataGridProps {
  expenses: Expense[];
  draftExpenses?: Expense[];
  onAddExpense: (newExpense: Omit<Expense, 'id' | 'created_at'>) => Promise<void> | void;
  onBatchAddExpenses?: (newExpenses: Omit<Expense, 'id' | 'created_at'>[]) => Promise<void>;
  onUpdateExpense: (updated: Expense) => Promise<void> | void;
  onDeleteExpense: (id: string) => Promise<void> | void;
  onAddDraftExpenses?: (items: ExtractedExpenseItem[]) => void;
  onSaveAllDrafts?: () => Promise<void>;
  onDiscardDrafts?: () => void;
  familyGroupId: string;
  currentUserId: string;
  activeRole?: 'USER_A' | 'USER_B';
  userAId?: string;
  userBId?: string;
}

const darkGridTheme = themeQuartz.withPart(colorSchemeDarkBlue).withParams({
  backgroundColor: '#090d16',
  headerBackgroundColor: '#0f172a',
  oddRowBackgroundColor: '#0b1120',
  rowHoverColor: '#1e293b',
  borderColor: '#1e293b',
  accentColor: '#10b981',
  fontFamily: 'inherit',
  fontSize: 13,
});

export default function ExpensesDataGrid({
  expenses,
  draftExpenses = [],
  onAddExpense,
  onBatchAddExpenses,
  onUpdateExpense,
  onDeleteExpense,
  onAddDraftExpenses,
  onSaveAllDrafts,
  onDiscardDrafts,
  familyGroupId,
  currentUserId,
  activeRole = 'USER_A',
  userAId = YAN_USER_ID,
  userBId = LARISSA_USER_ID,
}: ExpensesDataGridProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [newDate, setNewDate] = useState(todayStr);
  const [newDescription, setNewDescription] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newInstallments, setNewInstallments] = useState<number>(1);
  const [newCategory, setNewCategory] = useState('Mercado');
  const [newPayerType, setNewPayerType] = useState<PayerType>('SHARED');
  const [newDisbursedBy, setNewDisbursedBy] = useState<string>(
    activeRole === 'USER_B' ? userBId : userAId
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [installmentSuccessBanner, setInstallmentSuccessBanner] = useState<string | null>(
    null
  );
  const [submittingRow, setSubmittingRow] = useState(false);
  const [savingDrafts, setSavingDrafts] = useState(false);

  // Sincroniza o pagador padrão no formulário quando o utilizador troca entre Yan e Larissa no Header
  useEffect(() => {
    setNewDisbursedBy(activeRole === 'USER_B' ? userBId : userAId);
  }, [activeRole, userAId, userBId]);

  // Junta os itens em Rascunho (no topo da planilha) com as despesas salvas
  const combinedRows = useMemo(
    () => [...draftExpenses, ...expenses],
    [draftExpenses, expenses]
  );

  const draftsTotalAmount = useMemo(
    () => draftExpenses.reduce((acc, item) => acc + (Number(item.amount) || 0), 0),
    [draftExpenses]
  );

  // Preview dinâmico do valor de cada parcela quando Parcelas > 1
  const installmentPreview = useMemo(() => {
    const parsedTotal = parseFloat(newAmount.replace(',', '.'));
    if (newInstallments <= 1 || isNaN(parsedTotal) || parsedTotal <= 0) {
      return null;
    }
    const perInstallment = parsedTotal / newInstallments;
    const firstDueDate = calculateSubsequentDay06Date(newDate || todayStr, 1);
    const lastDueDate = calculateSubsequentDay06Date(
      newDate || todayStr,
      newInstallments
    );
    const formatPtBr = (iso: string) => {
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
    };
    return {
      perInstallment,
      firstDueFormatted: formatPtBr(firstDueDate),
      lastDueFormatted: formatPtBr(lastDueDate),
    };
  }, [newAmount, newInstallments, newDate, todayStr]);

  const isRealProfileId = (id?: string | null) =>
    Boolean(
      id &&
        id !== YAN_USER_ID &&
        id !== LARISSA_USER_ID &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setInstallmentSuccessBanner(null);

    const trimmedDesc = newDescription.trim();
    const numericAmount = parseFloat(newAmount.replace(',', '.'));
    const totalInstallments = Math.max(1, Math.min(48, Number(newInstallments) || 1));

    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      setValidationError('Por favor, selecione uma Data válida.');
      return;
    }
    if (!trimmedDesc) {
      setValidationError('Por favor, preencha a Descrição da despesa.');
      return;
    }
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setValidationError('Por favor, informe um Valor maior que R$ 0,00.');
      return;
    }
    if (!newCategory || !EXPENSE_CATEGORIES.includes(newCategory)) {
      setValidationError('Por favor, selecione uma Categoria válida.');
      return;
    }

    const candidatePayerId =
      newPayerType === 'USER_A'
        ? userAId
        : newPayerType === 'USER_B'
        ? userBId
        : newDisbursedBy;

    const resolvedPaidByUserId = isRealProfileId(candidatePayerId)
      ? candidatePayerId
      : isRealProfileId(currentUserId)
      ? currentUserId
      : candidatePayerId;

    const resolvedCreatedBy = isRealProfileId(currentUserId) ? currentUserId : null;

    setSubmittingRow(true);
    try {
      if (totalInstallments === 1) {
        // Compra à vista (1x): mantém a data informada e sem installment_group_id
        await onAddExpense({
          family_group_id: familyGroupId,
          expense_date: newDate,
          description: trimmedDesc,
          amount: Number(numericAmount.toFixed(2)),
          category: newCategory,
          payer_type: newPayerType,
          paid_by_user_id: resolvedPaidByUserId,
          created_by: resolvedCreatedBy,
          installment_group_id: null,
        });
      } else {
        // Compra Parcelada Manual (ex: R$ 1.000 em 5x -> 5 registros de R$ 200 no dia 06 dos próximos 5 meses)
        const sharedInstallmentGroupId = generateUUID();
        const totalCents = Math.round(numericAmount * 100);
        const baseInstallmentCents = Math.floor(totalCents / totalInstallments);
        const remainderCents = totalCents - baseInstallmentCents * totalInstallments;

        const generatedInstallments: Omit<Expense, 'id' | 'created_at'>[] = [];

        for (let i = 1; i <= totalInstallments; i++) {
          const itemCents =
            baseInstallmentCents + (i === 1 ? remainderCents : 0);
          const itemAmount = Number((itemCents / 100).toFixed(2));
          const dueDateDay06 = calculateSubsequentDay06Date(newDate, i);

          generatedInstallments.push({
            family_group_id: familyGroupId,
            expense_date: dueDateDay06,
            description: `${trimmedDesc} (${i}/${totalInstallments})`,
            amount: itemAmount,
            category: newCategory,
            payer_type: newPayerType,
            paid_by_user_id: resolvedPaidByUserId,
            created_by: resolvedCreatedBy,
            installment_group_id: sharedInstallmentGroupId,
          });
        }

        if (onBatchAddExpenses) {
          await onBatchAddExpenses(generatedInstallments);
        } else {
          for (const item of generatedInstallments) {
            await onAddExpense(item);
          }
        }

        setInstallmentSuccessBanner(
          `Compra parcelada criada! Foram gerados ${totalInstallments} lançamentos de ${formatBRL(
            numericAmount / totalInstallments
          )} com vencimento fixo no dia 06 dos próximos ${totalInstallments} meses.`
        );
      }

      setNewDescription('');
      setNewAmount('');
      setNewInstallments(1);
    } finally {
      setSubmittingRow(false);
    }
  };

  const handleSaveAllDraftsClick = async () => {
    if (!onSaveAllDrafts || draftExpenses.length === 0) return;
    setSavingDrafts(true);
    try {
      await onSaveAllDrafts();
    } finally {
      setSavingDrafts(false);
    }
  };

  // Alterna rapidamente o pagador ao clicar no badge dentro da planilha
  const cyclePayerType = (expense: Expense) => {
    const nextMap: Record<PayerType, PayerType> = {
      SHARED: 'USER_A',
      USER_A: 'USER_B',
      USER_B: 'SHARED',
    };
    const nextType = nextMap[expense.payer_type] || 'SHARED';
    const nextPaidBy =
      nextType === 'USER_A'
        ? userAId
        : nextType === 'USER_B'
        ? userBId
        : expense.paid_by_user_id || userAId;

    onUpdateExpense({
      ...expense,
      payer_type: nextType,
      paid_by_user_id: nextPaidBy,
      ai_payer_hint: nextType,
    });
  };

  const columnDefs = useMemo<ColDef<Expense>[]>(
    () => [
      {
        field: 'expense_date',
        headerName: 'Data / Venc.',
        editable: true,
        width: 140,
        sortable: true,
        filter: true,
        cellRenderer: (params: ICellRendererParams<Expense>) => {
          if (!params.data) return null;
          const raw = params.data.expense_date;
          const [y, m, d] = String(raw || '').split('-');
          const formatted = y && m && d ? `${d}/${m}/${y}` : raw;
          return (
            <div className="flex items-center gap-1.5">
              {params.data.is_draft && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  title="Rascunho extraído por IA — revise e clique em Salvar Tudo"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  Rascunho
                </span>
              )}
              <span>{formatted}</span>
            </div>
          );
        },
      },
      {
        field: 'description',
        headerName: 'Descrição',
        editable: true,
        flex: 1.5,
        minWidth: 210,
        sortable: true,
        filter: true,
        cellRenderer: (params: ICellRendererParams<Expense>) => {
          if (!params.data) return null;
          const hasGroup = Boolean(params.data.installment_group_id);
          return (
            <div className="flex items-center gap-2 truncate">
              <span
                className={
                  params.data.is_draft
                    ? 'font-semibold text-amber-100 truncate'
                    : 'text-slate-100 truncate'
                }
              >
                {params.data.description}
              </span>
              {hasGroup && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 shrink-0"
                  title={`Parcela vinculada (Group ID: ${params.data.installment_group_id})`}
                >
                  <CreditCard className="w-2.5 h-2.5" />
                  Venc. 06
                </span>
              )}
            </div>
          );
        },
      },
      {
        field: 'amount',
        headerName: 'Valor (R$)',
        editable: true,
        width: 140,
        sortable: true,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 0.01,
          precision: 2,
        },
        valueParser: (params) => {
          const parsed = parseFloat(String(params.newValue).replace(',', '.'));
          return isNaN(parsed) || parsed <= 0 ? params.oldValue : parsed;
        },
        valueFormatter: (params) => formatBRL(Number(params.value || 0)),
        cellClass: (params) =>
          params.data?.is_draft
            ? 'font-bold text-amber-300'
            : 'font-semibold text-emerald-300',
      },
      {
        field: 'category',
        headerName: 'Categoria',
        editable: true,
        width: 165,
        sortable: true,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: EXPENSE_CATEGORIES,
        },
      },
      {
        field: 'payer_type',
        headerName: 'Quem Pagou (Clique p/ trocar)',
        editable: true,
        width: 205,
        sortable: true,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Yan (Eu)', 'Larissa (Esposa)', 'Dividido (Casal)'],
        },
        valueGetter: (params) => {
          if (!params.data) return 'Dividido (Casal)';
          return PAYER_LABELS[params.data.payer_type] || 'Dividido (Casal)';
        },
        valueSetter: (params) => {
          const mapped = LABEL_TO_PAYER[String(params.newValue)];
          if (mapped && params.data) {
            const updated: Expense = {
              ...params.data,
              payer_type: mapped,
              ai_payer_hint: mapped,
              paid_by_user_id:
                mapped === 'USER_A'
                  ? userAId
                  : mapped === 'USER_B'
                  ? userBId
                  : params.data.paid_by_user_id || userAId,
            };
            onUpdateExpense(updated);
            return true;
          }
          return false;
        },
        cellRenderer: (params: ICellRendererParams<Expense>) => {
          if (!params.data) return null;
          const row = params.data;
          const isPendingAi = row.is_draft && row.ai_payer_hint === 'PENDENTE';
          const label = isPendingAi
            ? 'Pendente (Clique p/ definir)'
            : PAYER_LABELS[row.payer_type] || 'Dividido (Casal)';
          const isYan = !isPendingAi && row.payer_type === 'USER_A';
          const isLarissa = !isPendingAi && row.payer_type === 'USER_B';
          const badgeColors = isPendingAi
            ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30'
            : isYan
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
            : isLarissa
            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25'
            : 'bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/25';

          return (
            <button
              type="button"
              onClick={() => cyclePayerType(row)}
              title="Clique para alternar entre Dividido, Yan e Larissa"
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border transition cursor-pointer ${badgeColors}`}
            >
              {isPendingAi && '⏳ '}
              {isYan && '👤 '}
              {isLarissa && '👩‍❤️‍👨 '}
              {!isPendingAi && !isYan && !isLarissa && '🤝 '}
              {label}
            </button>
          );
        },
      },
      {
        field: 'paid_by_user_id',
        headerName: 'Desembolso (Splitwise)',
        editable: (params) => params.data?.payer_type === 'SHARED',
        width: 175,
        sortable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Pago por Yan', 'Pago por Larissa'],
        },
        valueGetter: (params) => {
          if (!params.data) return '';
          if (params.data.payer_type === 'USER_A') return 'Yan (Individual)';
          if (params.data.payer_type === 'USER_B') return 'Larissa (Individual)';
          return params.data.paid_by_user_id === userBId ? 'Pago por Larissa' : 'Pago por Yan';
        },
        valueSetter: (params) => {
          if (!params.data) return false;
          const nextPaidBy =
            params.newValue === 'Pago por Larissa' ? userBId : userAId;
          onUpdateExpense({
            ...params.data,
            paid_by_user_id: nextPaidBy,
          });
          return true;
        },
        cellClass: 'text-xs text-slate-300',
      },
      {
        headerName: 'Ações',
        width: 80,
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: (params: ICellRendererParams<Expense>) => {
          if (!params.data) return null;
          const id = params.data.id;
          return (
            <button
              type="button"
              onClick={() => onDeleteExpense(id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
              title={params.data.is_draft ? 'Remover rascunho' : 'Excluir despesa'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          );
        },
      },
    ],
    [onDeleteExpense, onUpdateExpense, userAId, userBId]
  );

  const handleCellValueChanged = (event: CellValueChangedEvent<Expense>) => {
    if (event.data) {
      onUpdateExpense({
        ...event.data,
        amount: Number(event.data.amount) || 0,
      });
    }
  };

  const getRowStyle = (params: RowClassParams<Expense>) => {
    if (params.data?.is_draft) {
      return {
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderLeft: '3px solid #f59e0b',
      };
    }
    return undefined;
  };

  return (
    <div className="space-y-4">
      {/* 1. Área de Dropzone & Botão "Importar Foto/Print" via Gemini Vision IA */}
      {onAddDraftExpenses && (
        <PhotoPrintDropzone
          onExtractedDrafts={(items) => {
            onAddDraftExpenses(items);
          }}
        />
      )}

      {/* 2. Barra de Revisão de Rascunhos IA ("Salvar Tudo" / "Descartar") */}
      {draftExpenses.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-amber-200">
                  {draftExpenses.length}{' '}
                  {draftExpenses.length === 1
                    ? 'item em Rascunho aguardando revisão'
                    : 'itens em Rascunho aguardando revisão'}
                </h4>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Total dos Rascunhos: {formatBRL(draftsTotalAmount)}
                </span>
              </div>
              <p className="text-xs text-amber-100/80 mt-0.5">
                Estes gastos foram extraídos da sua foto/print como lançamentos únicos do mês atual. Você pode ajustar a categoria, valor ou quem pagou diretamente na tabela abaixo e clicar em <strong>Salvar Tudo</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
            {onDiscardDrafts && (
              <button
                type="button"
                onClick={onDiscardDrafts}
                disabled={savingDrafts}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-slate-300 hover:text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <XCircle className="w-4 h-4" />
                Descartar Rascunhos
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveAllDraftsClick}
              disabled={savingDrafts}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md shadow-emerald-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              {savingDrafts
                ? 'Salvando no Supabase...'
                : `Salvar Tudo (${draftExpenses.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Alerta de Validação de Campos */}
      {validationError && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Confirmação de Geração de Parcelas com Vencimento Dia 06 */}
      {installmentSuccessBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{installmentSuccessBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setInstallmentSuccessBanner(null)}
            className="text-emerald-300 hover:text-white text-[11px] font-semibold"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Formulário Principal de Adição de Despesa (com Campo de Parcelas e Vencimento Dia 06) */}
      <form
        onSubmit={handleQuickAdd}
        noValidate
        className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Data da Compra <span className="text-emerald-400">*</span>
            </label>
            <input
              type="date"
              required
              value={newDate}
              onChange={(e) => {
                setNewDate(e.target.value);
                setValidationError(null);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Descrição <span className="text-emerald-400">*</span>
            </label>
            <input
              type="text"
              required
              value={newDescription}
              onChange={(e) => {
                setNewDescription(e.target.value);
                setValidationError(null);
              }}
              placeholder="Ex: Geladeira, Passagem, Supermercado..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Valor Total (R$) <span className="text-emerald-400">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={newAmount}
              onChange={(e) => {
                setNewAmount(e.target.value);
                setValidationError(null);
              }}
              placeholder="0,00"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-sky-300 mb-1">
              Parcelas
            </label>
            <select
              value={newInstallments}
              onChange={(e) => setNewInstallments(Number(e.target.value))}
              className="w-full px-2.5 py-2 bg-slate-950 border border-sky-500/40 rounded-xl text-xs text-white focus:outline-none focus:border-sky-400"
            >
              <option value={1}>1x (À vista)</option>
              {Array.from({ length: 23 }, (_, idx) => idx + 2).map((n) => (
                <option key={n} value={n}>
                  {n}x (Venc. dia 06)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Categoria <span className="text-emerald-400">*</span>
            </label>
            <select
              required
              value={newCategory}
              onChange={(e) => {
                setNewCategory(e.target.value);
                setValidationError(null);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Quem Pagou
            </label>
            <select
              value={newPayerType}
              onChange={(e) => setNewPayerType(e.target.value as PayerType)}
              className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="USER_A">Yan (Eu)</option>
              <option value="USER_B">Larissa (Esposa)</option>
              <option value="SHARED">Dividido (Casal)</option>
            </select>
          </div>

          <div className="flex gap-2">
            {newPayerType === 'SHARED' && (
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-sky-400 mb-1">
                  Pagador
                </label>
                <select
                  value={newDisbursedBy}
                  onChange={(e) => setNewDisbursedBy(e.target.value)}
                  className="w-full px-2 py-2 bg-slate-950 border border-sky-500/40 rounded-xl text-xs text-white focus:outline-none focus:border-sky-400"
                >
                  <option value={userAId}>Yan</option>
                  <option value={userBId}>Larissa</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={submittingRow}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 transition shrink-0 h-[34px] self-end w-full sm:w-auto shadow-md shadow-emerald-500/10"
              title="Inserir na Planilha"
            >
              <Plus className="w-4 h-4" />
              {submittingRow
                ? 'Salvando...'
                : newInstallments > 1
                ? `Gerar ${newInstallments}x`
                : 'Adicionar'}
            </button>
          </div>
        </div>

        {/* Resumo em Tempo Real quando Parcelas > 1x */}
        {installmentPreview && (
          <div className="px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs text-sky-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                Serão criados <strong>{newInstallments} registros</strong> de{' '}
                <strong className="text-emerald-300">
                  {formatBRL(installmentPreview.perInstallment)}
                </strong>{' '}
                (Ex: &quot;{newDescription.trim() || 'Compra'} (1/{newInstallments})&quot; até &quot;({newInstallments}/{newInstallments})&quot;)
              </span>
            </div>
            <span className="text-[11px] text-sky-300 font-medium">
              Vencimento fixo no <strong>dia 06</strong>: de{' '}
              {installmentPreview.firstDueFormatted} até{' '}
              {installmentPreview.lastDueFormatted}
            </span>
          </div>
        )}
      </form>

      {/* Container da Planilha AG Grid */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
        <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Table2 className="w-4 h-4 text-emerald-400" />
            Planilha de Gastos (Clique no badge &quot;Quem Pagou&quot; ou dê duplo clique em qualquer célula para editar)
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 font-semibold text-xs flex items-center gap-1.5 transition"
            >
              <FileUp className="w-3.5 h-3.5" />
              Importar Extrato (CSV/OFX/PDF)
            </button>

            <span className="text-[11px] text-slate-400">
              Exibindo {combinedRows.length}{' '}
              {combinedRows.length === 1 ? 'lançamento' : 'lançamentos'}
              {draftExpenses.length > 0 && ` (${draftExpenses.length} em rascunho)`}
            </span>
          </div>
        </div>

        <div style={{ width: '100%', height: 420 }}>
          <AgGridReact<Expense>
            theme={darkGridTheme}
            rowData={combinedRows}
            columnDefs={columnDefs}
            onCellValueChanged={handleCellValueChanged}
            getRowId={(params) => params.data.id}
            getRowStyle={getRowStyle}
            animateRows={true}
            singleClickEdit={false}
            stopEditingWhenCellsLoseFocus={true}
          />
        </div>
      </div>

      {/* Modal de Importação de Fatura / Extrato em Lote */}
      <StatementImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onConfirmBatchImport={async (items) => {
          if (onBatchAddExpenses) {
            await onBatchAddExpenses(items);
          } else {
            for (const item of items) {
              await onAddExpense(item);
            }
          }
        }}
        familyGroupId={familyGroupId}
        currentUserId={currentUserId}
        userAId={userAId}
        userBId={userBId}
      />
    </div>
  );
}
