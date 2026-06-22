"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { STATUSES } from "./mock-data";

const CustomLabel = (props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number | string;
}) => {
  const { x = 0, y = 0, width = 0, height = 0, value } = props;
  return (
    <text
      x={x + width + 8}
      y={y + height / 2 + 1}
      fill="#94a3b8"
      fontSize={11}
      dominantBaseline="middle"
    >
      {value}
    </text>
  );
};

interface Props {
  mode: "count" | "area";
}

export function ParcelBarChart({ mode }: Props) {
  const data = [...STATUSES]
    .sort((a, b) => (mode === "count" ? b.count - a.count : b.area - a.area))
    .map((s) => ({ ...s, value: mode === "count" ? s.count : s.area }));

  return (
    <ResponsiveContainer width="100%" height={data.length * 38 + 20}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 2, right: 56, left: 0, bottom: 2 }}
        barSize={12}
      >
        <XAxis type="number" scale="log" domain={["auto", "auto"]} hide />
        <YAxis
          type="category"
          dataKey="label"
          width={138}
          tick={{ fill: "#64748b", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            color: "#2d3748",
            fontSize: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
          formatter={(v) => [
            mode === "count" ? `${v} ш` : `${Number(v).toLocaleString()} м²`,
            "",
          ]}
          labelStyle={{ color: "#94a3b8", marginBottom: 2 }}
          cursor={{ fill: "#f8fafc" }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} label={<CustomLabel />}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
