'use client';

import React, { useRef, useState } from 'react';
import type { Expense, PayerType } from '@/lib/types/database.types';
import {
  parseRawTextLines,
  type ParsedStatementItem,
} from '@/lib/parsers/statementParser';
import { EXPENSE_CATEGORIES } from './ExpensesDataGrid';
import { formatBRL } from '@/components/dashboard/SummaryHeader';
import {
  FileUp,
  X,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Trash2,
  Plus,
  Loader2,
  ClipboardPaste,
} from 'lucide-react';

interface StatementImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmBatchImport: (expensesToInsert: Omit<Expense, 'id' | 'created_at'>[]) => Promise<void>;
  familyGroupId: string;
  currentUserId: string;
  userAId: string;
  userBId: string;
}

export default function StatementImportModal({
  isOpen,
  onClose,
  onConfirmBatchImport,
  familyGroupId,
  currentUserId,
  userAId,
  userBId,
}: StatementImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedStatementItem[]>([]);
  const [defaultPayerType, setDefaultPayerType] = useState<PayerType>('SHARED');
  const [defaultDisbursedBy, setDefaultDisbursedBy] = useState<string>(userAId);
  const [uploading, setUploading] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [fileNameLabel, setFileNameLabel] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isRealUuid = (id?: string | null) =>
    Boolean(
      id &&
        id !== 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' &&
        id !== 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setUploading(true);
    setFileNameLabel(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/import-statement', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        setErrorMsg(data.error || 'Não foi possível ler o arquivo enviado.');
      } else {
        setParsedItems(data.items || []);
      }
    } catch (err) {
      setErrorMsg('Falha ao processar o arquivo: ' + String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;
    const extracted = parseRawTextLines(pastedText);
    if (extracted.length === 0) {
      setErrorMsg(
        'Nenhuma linha no formato "DD/MM/AAAA Descrição Valor" foi reconhecida. Verifique o texto colado.'
      );
      return;
    }
    setErrorMsg(null);
    setParsedItems((prev) => [...prev, ...extracted]);
    setPastedText('');
    setShowPasteArea(false);
  };

  const handleUpdateItem = (index: number, patch: Partial<ParsedStatementItem>) => {
    setParsedItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  };

  const handleRemoveItem = (index: number) => {
    setParsedItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddBlankRow = () => {
    setParsedItems((prev) => [
      ...prev,
      {
        expense_date: new Date().toISOString().split('T')[0],
        description: 'Novo item da fatura',
        amount: 50.0,
        category: 'Compras',
      },
    ]);
  };

  const handleConfirmImport = async () => {
    if (parsedItems.length === 0) return;
    setSavingBatch(true);
    try {
      const candidatePayerId =
        defaultPayerType === 'USER_A'
          ? userAId
          : defaultPayerType === 'USER_B'
          ? userBId
          : defaultDisbursedBy;

      const resolvedPaidByUserId = isRealUuid(candidatePayerId)
        ? candidatePayerId
        : isRealUuid(currentUserId)
        ? currentUserId
        : null;

      const batchPayload: Omit<Expense, 'id' | 'created_at'>[] = parsedItems.map((item) => ({
        family_group_id: familyGroupId,
        expense_date: item.expense_date,
        description: item.description.trim() || 'Despesa Importada',
        amount: Number(item.amount) || 0,
        category: item.category || 'Outros',
        payer_type: item.payer_type || defaultPayerType,
        paid_by_user_id: resolvedPaidByUserId,
        created_by: isRealUuid(currentUserId) ? currentUserId : null,
      }));

      await onConfirmBatchImport(batchPayload);
      setParsedItems([]);
      setFileNameLabel(null);
      onClose();
    } finally {
      setSavingBatch(false);
    }
  };

  const totalPreviewAmount = parsedItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Importar Fatura ou Extrato (CSV / OFX / PDF / PNG / JPEG)
              </h2>
              <p className="text-xs text-slate-400">
                Faça upload da fatura do cartão ou extrato bancário para lançar automaticamente no
                seu Grupo Familiar.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Área de Upload + Configuração de Quem Pagou */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="lg:col-span-7 p-5 rounded-2xl border-2 border-dashed border-slate-700 hover:border-sky-500/60 bg-slate-950/60 cursor-pointer transition flex flex-col items-center justify-center text-center space-y-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.ofx,.pdf,.png,.jpg,.jpeg,text/csv,application/pdf,image/png,image/jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
              {uploading ? (
                <div className="flex items-center gap-2 text-sky-400 text-sm font-semibold py-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Lendo e extraindo lançamentos do arquivo...
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 text-sky-400">
                    <FileSpreadsheet className="w-6 h-6" />
                    <FileText className="w-6 h-6 text-emerald-400" />
                    <ImageIcon className="w-6 h-6 text-purple-400" />
                  </div>
                  <span className="text-xs font-bold text-white">
                    {fileNameLabel
                      ? `Arquivo carregado: ${fileNameLabel} (Clique para trocar)`
                      : 'Clique para selecionar um arquivo CSV, OFX, PDF, PNG ou JPEG'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Compatível com Nubank, Itaú, Inter, Bradesco, Santander, C6 e faturas em geral
                  </span>
                </>
              )}
            </div>

            {/* Configuração Padrão do Lote */}
            <div className="lg:col-span-5 p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Atribuir Fatura Importada para:
                </label>
                <select
                  value={defaultPayerType}
                  onChange={(e) => setDefaultPayerType(e.target.value as PayerType)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="SHARED">🤝 Dividido (Casal)</option>
                  <option value="USER_A">👤 Yan (Eu)</option>
                  <option value="USER_B">👩‍❤️‍👨 Larissa (Esposa)</option>
                </select>
              </div>

              {defaultPayerType === 'SHARED' && (
                <div>
                  <label className="block text-[11px] font-medium text-sky-400 mb-1">
                    Quem pagou esta fatura no banco? (Splitwise)
                  </label>
                  <select
                    value={defaultDisbursedBy}
                    onChange={(e) => setDefaultDisbursedBy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-sky-500/40 rounded-xl text-xs text-white focus:outline-none"
                  >
                    <option value={userAId}>Pago por Yan</option>
                    <option value={userBId}>Pago por Larissa</option>
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowPasteArea((v) => !v)}
                className="text-[11px] text-sky-400 hover:underline flex items-center gap-1.5 pt-1"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                {showPasteArea
                  ? 'Ocultar caixa de colagem de texto'
                  : 'Ou cole linhas copiadas de um PDF/fatura aqui'}
              </button>
            </div>
          </div>

          {/* Caixa opcional para colar texto copiado direto de PDF */}
          {showPasteArea && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Cole abaixo as linhas da fatura (Ex: <code>15/10/2026 IFOOD *REST 89,90</code>):
              </label>
              <textarea
                rows={3}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={'10/10/2026 SUPERMERCADO ATACADAO 450,00\n12/10/2026 UBER *TRIP 28,90'}
                className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={handleParsePastedText}
                className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition"
              >
                Extrair Linhas do Texto
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Tabela de Pré-Visualização e Edição dos Itens Extraídos */}
          {parsedItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-200">
                  {parsedItems.length}{' '}
                  {parsedItems.length === 1
                    ? 'lançamento identificado'
                    : 'lançamentos identificados'}{' '}
                  • Total: <strong className="text-emerald-400">{formatBRL(totalPreviewAmount)}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleAddBlankRow}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar linha manual
                </button>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-[290px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-950 text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Descrição</th>
                      <th className="py-2.5 px-3">Valor (R$)</th>
                      <th className="py-2.5 px-3">Categoria</th>
                      <th className="py-2.5 px-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 bg-slate-900/60">
                    {parsedItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-2">
                          <input
                            type="date"
                            value={item.expense_date}
                            onChange={(e) =>
                              handleUpdateItem(idx, { expense_date: e.target.value })
                            }
                            className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) =>
                              handleUpdateItem(idx, { description: e.target.value })
                            }
                            className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.amount}
                            onChange={(e) =>
                              handleUpdateItem(idx, {
                                amount: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-28 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-emerald-300"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={item.category}
                            onChange={(e) =>
                              handleUpdateItem(idx, { category: e.target.value })
                            }
                            className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                          >
                            {EXPENSE_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400"
                            title="Remover item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={parsedItems.length === 0 || savingBatch}
            onClick={handleConfirmImport}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-500/20"
          >
            {savingBatch ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando na Planilha...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Inserir {parsedItems.length} Gastos na Planilha
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
