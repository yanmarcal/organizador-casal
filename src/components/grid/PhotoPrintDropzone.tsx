'use client';

import React, { useRef, useState } from 'react';
import {
  Camera,
  UploadCloud,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import type { ExtractedExpenseItem } from '@/lib/types/database.types';

interface PhotoPrintDropzoneProps {
  onExtractedDrafts: (items: ExtractedExpenseItem[], meta?: { warning?: string; modelUsed?: string }) => void;
}

export default function PhotoPrintDropzone({
  onExtractedDrafts,
}: PhotoPrintDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    message: string;
    warning?: string;
  } | null>(null);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Falha ao converter imagem para base64.'));
        }
      };
      reader.onerror = () => reject(new Error('Erro na leitura do arquivo de imagem.'));
      reader.readAsDataURL(file);
    });

  const processImageFile = async (file: File) => {
    setErrorMsg(null);
    setStatusBanner(null);

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const lowerName = file.name.toLowerCase();
    const isAllowedExt =
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.webp');

    if (!validTypes.includes(file.type) && !isAllowedExt) {
      setErrorMsg('Formato inválido. Envie apenas imagens PNG ou JPG/JPEG.');
      return;
    }

    setIsLoading(true);
    setSelectedFileName(file.name);

    try {
      const base64DataUrl = await fileToBase64(file);
      setPreviewUrl(base64DataUrl);

      const response = await fetch('/api/extract-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64DataUrl,
          mimeType: file.type || 'image/jpeg',
          fileName: file.name,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Erro ao analisar a imagem com IA.');
      }

      const extracted: ExtractedExpenseItem[] = Array.isArray(data.items)
        ? data.items
        : [];

      if (extracted.length === 0) {
        setErrorMsg(
          'Nenhuma despesa foi identificada nesta imagem. Tente um print ou foto mais nítida.'
        );
        return;
      }

      onExtractedDrafts(extracted, {
        warning: data.warning,
        modelUsed: data.modelUsed,
      });

      setStatusBanner({
        message: `${extracted.length} ${
          extracted.length === 1 ? 'despesa extraída' : 'despesas extraídas'
        } e adicionada(s) como Rascunho na planilha abaixo! Revise e clique em "Salvar Tudo".`,
        warning: data.warning,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Erro ao processar imagem na API de Visão Computacional.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const clearPreview = () => {
    setPreviewUrl(null);
    setSelectedFileName(null);
    setErrorMsg(null);
    setStatusBanner(null);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-r from-violet-950/40 via-slate-900/90 to-emerald-950/30 border border-violet-500/30 p-4 shadow-lg">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Descrição da Funcionalidade Killer */}
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white">
                Leitura Inteligente de Faturas &amp; Prints via IA
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30">
                Gemini Vision
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Envie um print do app do banco, nota fiscal ou lista (&quot;Contas Yan&quot; / &quot;Larissa&quot;). A IA extrai os itens como{' '}
              <span className="text-amber-300 font-semibold">Rascunho</span> direto na planilha para você revisar antes de salvar.
            </p>
          </div>
        </div>

        {/* Dropzone / Botão "Importar Foto/Print" */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed px-4 py-3 transition flex items-center gap-3 min-w-[270px] justify-center ${
            isDragging
              ? 'border-violet-400 bg-violet-500/20'
              : 'border-violet-500/40 hover:border-violet-400 bg-slate-950/70 hover:bg-slate-900/90'
          } ${isLoading ? 'opacity-75 pointer-events-none' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            className="hidden"
          />

          {isLoading ? (
            <div className="flex items-center gap-2.5 text-violet-300 text-xs font-semibold py-0.5">
              <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
              <span>Analisando imagem com Gemini IA...</span>
            </div>
          ) : (
            <>
              <div className="p-2 rounded-lg bg-violet-500/20 text-violet-300">
                <Camera className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold text-white flex items-center gap-1.5">
                  Importar Foto/Print
                  <UploadCloud className="w-3.5 h-3.5 text-violet-300" />
                </span>
                <span className="block text-[11px] text-slate-400">
                  Arraste ou clique (PNG, JPG)
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Preview da Imagem + Mensagens de Status / Aviso */}
      {(previewUrl || errorMsg || statusBanner) && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {previewUrl && (
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Preview do print enviado"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-xs">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-violet-400" />
                  <span className="truncate max-w-[200px]">
                    {selectedFileName || 'Imagem enviada'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearPreview}
                  className="text-[11px] text-slate-400 hover:text-rose-400 inline-flex items-center gap-1 mt-0.5"
                >
                  <X className="w-3 h-3" /> Limpar imagem
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 w-full">
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {statusBanner && (
              <div className="space-y-1.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{statusBanner.message}</span>
                </div>
                {statusBanner.warning && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{statusBanner.warning}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
