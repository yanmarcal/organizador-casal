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
} from 'ag-grid-community';
import type { Expense, PayerType } from '@/lib/types/database.types';
import { Plus, Trash2, Table2, FileUp, AlertCircle } from 'lucide-react';
import { formatBRL } from '@/components/dashboard/SummaryHeader';
import StatementImportModal from './StatementImportModal';

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

interface ExpensesDataGridProps {
  expenses: Expense[];
  onAddExpense: (newExpense: Omit<Expense, 'id' | 'created_at'>) => Promise<void> | void;
  onBatchAddExpenses?: (newExpenses: Omit<Expense, 'id' | 'created_at'>[]) => Promise<void>;
  onUpdateExpense: (updated: Expense) => Promise<void> | void;
  onDeleteExpense: (id: string) => Promise<void> | void;
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
  onAddExpense,
  onBatchAddExpenses,
  onUpdateExpense,
  onDeleteExpense,
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
  const [newCategory, setNewCategory] = useState('Mercado');
  const [newPayerType, setNewPayerType] = useState<PayerType>('SHARED');
  const [newDisbursedBy, setNewDisbursedBy] = useState<string>(
    activeRole === 'USER_B' ? userBId : userAId
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submittingRow, setSubmittingRow] = useState(false);

  // Sincroniza o pagador padrão no formulário quando o utilizador troca entre Yan e Larissa no Header
  useEffect(() => {
    setNewDisbursedBy(activeRole === 'USER_B' ? userBId : userAId);
  }, [activeRole, userAId, userBId]);

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

    const trimmedDesc = newDescription.trim();
    const numericAmount = parseFloat(newAmount.replace(',', '.'));

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

    setSubmittingRow(true);
    try {
      await onAddExpense({
        family_group_id: familyGroupId,
        expense_date: newDate,
        description: trimmedDesc,
        amount: Number(numericAmount.toFixed(2)),
        category: newCategory,
        payer_type: newPayerType,
        paid_by_user_id: resolvedPaidByUserId,
        created_by: isRealProfileId(currentUserId) ? currentUserId : null,
      });

      setNewDescription('');
      setNewAmount('');
    } finally {
      setSubmittingRow(false);
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
    });
  };

  const columnDefs = useMemo<ColDef<Expense>[]>(
    () => [
      {
        field: 'expense_date',
        headerName: 'Data',
        editable: true,
        width: 125,
        sortable: true,
        filter: true,
        valueFormatter: (params) => {
          if (!params.value) return '';
          const [y, m, d] = String(params.value).split('-');
          return y && m && d ? `${d}/${m}/${y}` : params.value;
        },
      },
      {
        field: 'description',
        headerName: 'Descrição',
        editable: true,
        flex: 1.5,
        minWidth: 180,
        sortable: true,
        filter: true,
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
        cellClass: 'font-semibold text-emerald-300',
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
        width: 195,
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
          const label = PAYER_LABELS[row.payer_type] || 'Dividido (Casal)';
          const isYan = row.payer_type === 'USER_A';
          const isLarissa = row.payer_type === 'USER_B';
          const badgeColors = isYan
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
              {isYan && '👤 '}
              {isLarissa && '👩‍❤️‍👨 '}
              {!isYan && !isLarissa && '🤝 '}
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
              title="Excluir despesa"
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

  return (
    <div className="space-y-4">
      {/* Alerta de Validação de Campos */}
      {validationError && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Formulário Rápido de Adição de Despesa com Validação */}
      <form
        onSubmit={handleQuickAdd}
        noValidate
        className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 items-end"
      >
        <div>
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
            Data <span className="text-emerald-400">*</span>
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
            placeholder="Ex: Supermercado, Conta de Luz, Jantar..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
            Valor (R$) <span className="text-emerald-400">*</span>
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
            {submittingRow ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
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
              Importar Fatura (CSV/OFX/PDF/PNG/JPEG)
            </button>

            <span className="text-[11px] text-slate-400">
              Exibindo {expenses.length} {expenses.length === 1 ? 'lançamento' : 'lançamentos'}
            </span>
          </div>
        </div>

        <div style={{ width: '100%', height: 420 }}>
          <AgGridReact<Expense>
            theme={darkGridTheme}
            rowData={expenses}
            columnDefs={columnDefs}
            onCellValueChanged={handleCellValueChanged}
            getRowId={(params) => params.data.id}
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
