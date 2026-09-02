"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate, formatPrice } from "@/lib/format";
import type { CompanyForecast } from "@/lib/types";

type Row = {
  date: string;
  close?: number;
  forecast?: number;
  lo?: number;
  hi?: number;
  band?: number;
};

export function ForecastChart({ quote }: { quote: CompanyForecast }) {
  const last = quote.history[quote.history.length - 1];
  const rows: Row[] = [
    ...quote.history.map((b) => ({ date: b.date, close: b.close })),
    {
      date: last.date,
      close: last.close,
      forecast: last.close,
      lo: last.close,
      hi: last.close,
      band: 0,
    },
    ...quote.forecast.map((p) => ({
      date: p.date,
      forecast: p.mean,
      lo: p.lo,
      hi: p.hi,
      band: p.hi - p.lo,
    })),
  ];

  return (
    <div className="h-[320px] w-full sm:h-[380px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="closeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--forecast-line)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--forecast-line)" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            minTickGap={28}
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0))}
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length || typeof label !== "string") return null;
              const row = payload[0]?.payload as Row;
              return (
                <div className="rounded-lg border border-white/10 bg-[#121820] px-3 py-2 text-xs shadow-xl">
                  <div className="mb-1 text-white/50">{formatDate(label)}</div>
                  {row.close != null && (
                    <div className="text-white">
                      Close <span className="font-medium">{formatPrice(row.close)}</span>
                    </div>
                  )}
                  {row.forecast != null && row.close == null && (
                    <>
                      <div className="text-sky-300">
                        Forecast <span className="font-medium">{formatPrice(row.forecast)}</span>
                      </div>
                      {row.lo != null && row.hi != null && (
                        <div className="text-white/50">
                          80% band {formatPrice(row.lo)} – {formatPrice(row.hi)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="close" stroke="none" fill="url(#closeFill)" />
          <Line
            type="monotone"
            dataKey="close"
            stroke="var(--chart-line)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          <Area type="monotone" dataKey="lo" stackId="band" stroke="none" fill="transparent" />
          <Area type="monotone" dataKey="band" stackId="band" stroke="none" fill="url(#bandFill)" />
          <Line
            type="monotone"
            dataKey="lo"
            stroke="var(--forecast-line)"
            strokeOpacity={0.35}
            strokeDasharray="4 4"
            strokeWidth={1}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="hi"
            stroke="var(--forecast-line)"
            strokeOpacity={0.35}
            strokeDasharray="4 4"
            strokeWidth={1}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="var(--forecast-line)"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
