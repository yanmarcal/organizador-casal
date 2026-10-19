'use client';

import React, { useMemo, useState } from 'react';
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
import { Plus, Trash2, Table2 } from 'lucide-react';
import { formatBRL } from '@/components/dashboard/SummaryHeader';

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
  onAddExpense: (newExpense: Omit<Expense, 'id' | 'created_at'>) => void;
  onUpdateExpense: (updated: Expense) => void;
  onDeleteExpense: (id: string) => void;
  familyGroupId: string;
  currentUserId: string;
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
  onUpdateExpense,
  onDeleteExpense,
  familyGroupId,
  currentUserId,
  userAId = YAN_USER_ID,
  userBId = LARISSA_USER_ID,
}: ExpensesDataGridProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [newDate, setNewDate] = useState(todayStr);
  const [newDescription, setNewDescription] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('Mercado');
  const [newPayerType, setNewPayerType] = useState<PayerType>('SHARED');
  const [newDisbursedBy, setNewDisbursedBy] = useState<string>(
    currentUserId === userBId ? userBId : userAId
  );

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(newAmount.replace(',', '.'));
    if (!newDescription.trim() || isNaN(numericAmount) || numericAmount <= 0) {
      return;
    }

    const resolvedPaidByUserId =
      newPayerType === 'USER_A'
        ? userAId
        : newPayerType === 'USER_B'
        ? userBId
        : newDisbursedBy;

    onAddExpense({
      family_group_id: familyGroupId,
      expense_date: newDate || todayStr,
      description: newDescription.trim(),
      amount: numericAmount,
      category: newCategory,
      payer_type: newPayerType,
      paid_by_user_id: resolvedPaidByUserId,
      created_by: currentUserId,
    });

    setNewDescription('');
    setNewAmount('');
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
          min: 0,
          precision: 2,
        },
        valueParser: (params) => {
          const parsed = parseFloat(String(params.newValue).replace(',', '.'));
          return isNaN(parsed) ? params.oldValue : parsed;
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
        headerName: 'Quem Pagou',
        editable: true,
        width: 185,
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
            params.data.payer_type = mapped;
            if (mapped === 'USER_A') params.data.paid_by_user_id = userAId;
            if (mapped === 'USER_B') params.data.paid_by_user_id = userBId;
            return true;
          }
          return false;
        },
        cellRenderer: (params: ICellRendererParams<Expense>) => {
          const label = params.value as string;
          const isYan = label.startsWith('Yan');
          const isLarissa = label.startsWith('Larissa');
          const badgeColors = isYan
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            : isLarissa
            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
            : 'bg-sky-500/15 text-sky-300 border-sky-500/30';

          return (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColors}`}
            >
              {isYan && '👤 '}
              {isLarissa && '👩‍❤️‍👨 '}
              {!isYan && !isLarissa && '🤝 '}
              {label}
            </span>
          );
        },
      },
      {
        field: 'paid_by_user_id',
        headerName: 'Usuário Pagador (ID)',
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
          params.data.paid_by_user_id =
            params.newValue === 'Pago por Larissa' ? userBId : userAId;
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
    [onDeleteExpense, userAId, userBId]
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
      {/* Formulário Rápido de Adição de Despesa */}
      <form
        onSubmit={handleQuickAdd}
        className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 items-end"
      >
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Data</label>
          <input
            type="date"
            required
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Descrição</label>
          <input
            type="text"
            required
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Ex: Supermercado, Conta de Luz, Jantar..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="0,00"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Categoria</label>
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
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
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Quem Pagou</label>
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
                Pagador (ID)
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
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 transition shrink-0 h-[34px] self-end w-full sm:w-auto"
            title="Inserir na Planilha"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </form>

      {/* Container da Planilha AG Grid */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Table2 className="w-4 h-4 text-emerald-400" />
            Planilha de Gastos (Duplo clique em qualquer célula para editar diretamente)
          </div>
          <span className="text-[11px] text-slate-400">
            Exibindo {expenses.length} {expenses.length === 1 ? 'lançamento' : 'lançamentos'}
          </span>
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
    </div>
  );
}
