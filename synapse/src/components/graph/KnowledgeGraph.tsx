"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { GraphData } from "@/lib/graph";

// react-force-graph relies on the DOM; load lazily on the client.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export function KnowledgeGraph({ data }: { data: GraphData }) {
  const formatted = useMemo(
    () => ({
      nodes: data.nodes.map((n) => ({
        id: n.id,
        name: n.label,
        kind: n.kind,
      })),
      links: data.links.map((l) => ({ source: l.source, target: l.target, weight: l.weight })),
    }),
    [data]
  );

  if (!data.nodes.length) {
    return (
      <div className="h-full grid place-items-center text-sm text-muted-foreground">
        Add a few sources and generate summaries to populate the graph.
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ForceGraph2D
        graphData={formatted}
        nodeRelSize={6}
        nodeAutoColorBy="kind"
        linkColor={() => "rgba(127,127,127,0.35)"}
        linkWidth={(l: any) => Math.min(1 + (l.weight ?? 1) * 0.6, 4)}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const label = node.name ?? node.id;
          const fontSize = 12 / globalScale;
          ctx.fillStyle = node.kind === "concept" ? "#a78bfa" : "#22d3ee";
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.kind === "concept" ? 4 : 6, 0, 2 * Math.PI);
          ctx.fill();
          ctx.font = `${fontSize}px system-ui`;
          ctx.fillStyle = "rgba(120,120,140,0.9)";
          ctx.fillText(label, node.x + 8, node.y + 4);
        }}
      />
    </div>
  );
}
