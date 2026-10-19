'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { GoalPriceHistory } from '@/lib/types/database.types';
import { formatBRL } from '@/components/dashboard/SummaryHeader';

interface PriceHistoryChartProps {
  history: GoalPriceHistory[];
  targetPrice: number;
}

export default function PriceHistoryChart({ history, targetPrice }: PriceHistoryChartProps) {
  const chartData = history.map((item) => {
    const dateObj = new Date(item.recorded_at);
    const formattedDate = dateObj.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    return {
      id: item.id,
      date: formattedDate,
      fullDate: dateObj.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      price: Number(item.recorded_price),
      store: item.source_store,
      target: targetPrice,
    };
  });

  const allValues = [...chartData.map((d) => d.price), targetPrice];
  const minVal = Math.floor(Math.min(...allValues) * 0.92);
  const maxVal = Math.ceil(Math.max(...allValues) * 1.06);

  return (
    <div className="w-full h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 20, right: 24, left: 12, bottom: 8 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

          <XAxis
            dataKey="date"
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#1e293b' }}
          />

          <YAxis
            domain={[minVal, maxVal]}
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#1e293b' }}
            tickFormatter={(val) => `R$ ${val}`}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderColor: '#334155',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#f8fafc',
            }}
            formatter={(value: number) => [formatBRL(value), 'Preço Registrado']}
            labelFormatter={(label, payload) => {
              if (payload && payload.length > 0) {
                const row = payload[0].payload;
                return `${row.fullDate} • ${row.store}`;
              }
              return String(label);
            }}
          />

          {/* Linha de Referência do Preço Alvo definido pelo casal */}
          <ReferenceLine
            y={targetPrice}
            stroke="#10b981"
            strokeDasharray="6 4"
            strokeWidth={2}
            label={{
              value: `Preço Alvo: ${formatBRL(targetPrice)}`,
              position: 'insideTopRight',
              fill: '#34d399',
              fontSize: 12,
              fontWeight: 700,
            }}
          />

          <Area
            type="monotone"
            dataKey="price"
            stroke="#38bdf8"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#priceGradient)"
            activeDot={{ r: 6, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
