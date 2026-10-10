"use client";

import {
  FamilyGraph, calculateRelationship, computeHidden, computeLayout, relationshipLabelUz,
  type LayoutNode,
} from "@shajara/genealogy";
import Link from "next/link";
import {
  useCallback, useEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent,
} from "react";

export interface TreePerson {
  id: string;
  firstName: string;
  lastName: string | null;
  gender: string;
  birthDate: string | null;
  deathDate: string | null;
  isLiving: boolean;
}
export interface TreeProps {
  familyId: string;
  persons: TreePerson[];
  parentChild: { id: string; parentId: string; childId: string }[];
  marriages: { id: string; personAId: string; personBId: string }[];
  selfId: string | null;
}

type View = { x: number; y: number; k: number };
type Size = { w: number; h: number };

const MIN_K = 0.03;
const MAX_K = 2.5;
const VIRTUALIZE_ABOVE = 250; // render only cards inside the viewport for big trees
const clamp = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

function zoomAt(v: View, factor: number, sx: number, sy: number): View {
  const k = clamp(v.k * factor);
  const f = k / v.k;
  return { k, x: sx - (sx - v.x) * f, y: sy - (sy - v.y) * f };
}
function centerOn(n: LayoutNode, size: Size, k: number): View {
  return { k, x: size.w / 2 - (n.x + n.w / 2) * k, y: size.h / 2 - (n.y + n.h / 2) * k };
}
function fit(b: { minX: number; minY: number; maxX: number; maxY: number }, size: Size): View {
  const w = Math.max(1, b.maxX - b.minX), h = Math.max(1, b.maxY - b.minY);
  const k = clamp(Math.min((size.w - 48) / w, (size.h - 48) / h, 1));
  return { k, x: size.w / 2 - ((b.minX + b.maxX) / 2) * k, y: size.h / 2 - ((b.minY + b.maxY) / 2) * k };
}

const fullName = (p: TreePerson) => `${p.firstName}${p.lastName ? " " + p.lastName : ""}`;
const years = (p: TreePerson) => `${p.birthDate?.slice(0, 4) ?? "?"} — ${p.deathDate?.slice(0, 4) ?? (p.isLiving ? "" : "?")}`;
const initials = (p: TreePerson) => `${p.firstName[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase();
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const GENDER_LABEL: Record<string, string> = { MALE: "Erkak", FEMALE: "Ayol", OTHER: "Boshqa", UNKNOWN: "" };

export function FamilyTree({ familyId, persons, parentChild, marriages, selfId }: TreeProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const initialized = useRef(false);

  const people = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const fullGraph = useMemo(() => new FamilyGraph(parentChild, marriages), [parentChild, marriages]);

  const layout = useMemo(() => {
    const hidden = computeHidden(collapsed, parentChild, marriages);
    const visible = persons.filter((p) => !hidden.has(p.id));
    return computeLayout(
      visible.map((p) => ({ id: p.id, gender: p.gender, birthYear: p.birthDate ? Number(p.birthDate.slice(0, 4)) : null })),
      parentChild, marriages,
    );
  }, [persons, parentChild, marriages, collapsed]);

  // --- size tracking ---
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // --- initial view: small trees fit entirely, big trees center on the user ---
  useEffect(() => {
    if (initialized.current || size.w === 0 || layout.nodes.length === 0) return;
    initialized.current = true;
    const self = selfId ? layout.byId.get(selfId) : undefined;
    setView(layout.nodes.length > 40 && self ? centerOn(self, size, 0.8) : fit(layout.bounds, size));
    if (selfId && people.has(selfId)) setSelectedId(selfId);
  }, [size, layout, selfId, people]);

  // --- wheel zoom (non-passive so the page does not scroll) ---
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView((v) => zoomAt(v, factor, e.clientX - rect.left, e.clientY - rect.top));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // --- pan (1 pointer) and pinch (2 pointers) ---
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const pinch = useRef<number | null>(null);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = 0;
    pinch.current = null;
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      const dx = cur.x - prev.x, dy = cur.y - prev.y;
      moved.current += Math.abs(dx) + Math.abs(dy);
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (pts.length === 2) {
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      moved.current += 10;
      if (pinch.current !== null && pinch.current > 0) {
        const rect = svgRef.current!.getBoundingClientRect();
        const factor = dist / pinch.current;
        setView((v) => zoomAt(v, factor, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top));
      }
      pinch.current = dist;
    }
  };
  const onPointerEnd = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
  };

  // --- actions ---
  const zoomBy = useCallback((factor: number) => setView((v) => zoomAt(v, factor, size.w / 2, size.h / 2)), [size]);
  const fitAll = useCallback(() => setView(fit(layout.bounds, size)), [layout, size]);
  const focusOn = useCallback((id: string) => {
    const n = layout.byId.get(id);
    if (n) setView((v) => centerOn(n, size, Math.max(v.k, 0.8)));
    setSelectedId(id);
  }, [layout, size]);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen?.();
  };
  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "+" || e.key === "=") zoomBy(1.25);
    else if (e.key === "-") zoomBy(0.8);
    else if (e.key === "0") fitAll();
    else if (e.key === "ArrowLeft") setView((v) => ({ ...v, x: v.x + 60 }));
    else if (e.key === "ArrowRight") setView((v) => ({ ...v, x: v.x - 60 }));
    else if (e.key === "ArrowUp") setView((v) => ({ ...v, y: v.y + 60 }));
    else if (e.key === "ArrowDown") setView((v) => ({ ...v, y: v.y - 60 }));
    else return;
    e.preventDefault();
  };

  // --- search ---
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as TreePerson[];
    return persons.filter((p) => fullName(p).toLowerCase().includes(q));
  }, [query, persons]);
  const matchIds = useMemo(() => new Set(matches.map((m) => m.id)), [matches]);
  const submitSearch = () => {
    const first = matches.find((m) => layout.byId.has(m.id)) ?? matches[0];
    if (first) {
      // reveal if hidden by a collapsed branch
      if (!layout.byId.has(first.id)) setCollapsed(new Set());
      setTimeout(() => focusOn(first.id), 0);
    }
  };

  // --- visible slice (virtualization) ---
  const virtualize = layout.nodes.length > VIRTUALIZE_ABOVE;
  const margin = 200;
  const vx0 = (-view.x) / view.k - margin, vy0 = (-view.y) / view.k - margin;
  const vx1 = (size.w - view.x) / view.k + margin, vy1 = (size.h - view.y) / view.k + margin;
  const nodes = virtualize ? layout.nodes.filter((n) => n.x + n.w >= vx0 && n.x <= vx1 && n.y + n.h >= vy0 && n.y <= vy1) : layout.nodes;
  const links = virtualize ? layout.links.filter((l) => l.maxX >= vx0 && l.minX <= vx1 && l.maxY >= vy0 && l.minY <= vy1) : layout.links;
  const marriageLinks = virtualize ? layout.marriageLinks.filter((m) => m.x2 >= vx0 && m.x1 <= vx1 && m.y >= vy0 && m.y <= vy1) : layout.marriageLinks;
  const detail = view.k >= 0.35; // zoomed far out: draw plain boxes only

  // --- selected person details ---
  const selected = selectedId ? people.get(selectedId) : undefined;
  const info = useMemo(() => {
    if (!selected) return null;
    const lp = (id: string) => {
      const p = people.get(id);
      return p ? { id, gender: p.gender, birthYear: p.birthDate ? Number(p.birthDate.slice(0, 4)) : null } : undefined;
    };
    const names = (ids: string[]) => ids.map((id) => people.get(id)).filter((p): p is TreePerson => !!p).map(fullName).join(", ") || "—";
    let relation: string | null = null;
    if (selfId && selfId !== selected.id && people.has(selfId)) {
      const rel = calculateRelationship(fullGraph, selfId, selected.id);
      relation = relationshipLabelUz(rel, lp(selfId)!, lp(selected.id)!, lp);
    }
    return {
      relation,
      parents: names(fullGraph.parentsOf(selected.id)),
      spouses: names(fullGraph.spousesOf(selected.id)),
      children: names(fullGraph.childrenOf(selected.id)),
    };
  }, [selected, selfId, people, fullGraph]);

  if (persons.length === 0) {
    return (
      <div className="card centered-card">
        <p>Shajarangiz hali bo‘sh.</p>
        <Link className="btn btn-primary" href={`/families/${familyId}`}>Birinchi qarindoshni qo‘shing</Link>
      </div>
    );
  }

  return (
    <div>
      <div ref={wrapRef} className={`tree-wrap${fullscreen ? " is-fullscreen" : ""}`} tabIndex={0} onKeyDown={onKeyDown}>
        <div className="tree-toolbar" role="toolbar" aria-label="Daraxt boshqaruvi">
          <input
            type="search" value={query} placeholder="Qidirish…" aria-label="Odamni qidirish"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); }}
          />
          <button type="button" className="btn btn-secondary btn-tool" onClick={() => zoomBy(1.25)} aria-label="Kattalashtirish">+</button>
          <button type="button" className="btn btn-secondary btn-tool" onClick={() => zoomBy(0.8)} aria-label="Kichraytirish">−</button>
          <button type="button" className="btn btn-secondary btn-tool" onClick={fitAll}>Hammasi</button>
          {selfId && layout.byId.has(selfId) ? (
            <button type="button" className="btn btn-secondary btn-tool" onClick={() => focusOn(selfId)}>Men</button>
          ) : null}
          <button type="button" className="btn btn-secondary btn-tool" onClick={toggleFullscreen}>{fullscreen ? "Chiqish" : "To‘liq ekran"}</button>
        </div>
        {query.trim() ? <p className="tree-hint" role="status">{matches.length} ta topildi (Enter — borish)</p> : null}

        <svg
          ref={svgRef} className="tree-svg" role="group" aria-label="Oila daraxti"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd} onPointerLeave={onPointerEnd}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {links.map((l) => <path key={`${l.childId}-${l.parentIds.join("")}`} d={l.path} className="tree-link" />)}
            {marriageLinks.map((m) => <line key={`${m.aId}-${m.bId}`} x1={m.x1} x2={m.x2} y1={m.y} y2={m.y} className="tree-marriage" />)}
            {nodes.map((n) => {
              const p = people.get(n.id);
              if (!p) return null;
              const hasChildren = fullGraph.childrenOf(n.id).length > 0;
              const isSel = n.id === selectedId;
              const cls = `tree-card${isSel ? " is-selected" : ""}${matchIds.has(n.id) ? " is-match" : ""}${n.id === selfId ? " is-self" : ""}${p.isLiving ? "" : " is-deceased"}`;
              const select = () => { if (moved.current < 5) setSelectedId(n.id); };
              return (
                <g key={n.id} transform={`translate(${n.x} ${n.y})`} className={cls}
                  role="button" tabIndex={0} aria-label={`${fullName(p)}, ${years(p)}`} aria-pressed={isSel}
                  onClick={select}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(n.id); } }}>
                  <rect width={n.w} height={n.h} rx={12} className="tree-card-bg" />
                  {detail ? (
                    <>
                      <circle cx={34} cy={n.h / 2} r={24} className="tree-avatar" />
                      <text x={34} y={n.h / 2 + 5} textAnchor="middle" className="tree-initials">{initials(p)}</text>
                      <text x={68} y={n.h / 2 - 8} className="tree-name">{truncate(fullName(p), 16)}</text>
                      <text x={68} y={n.h / 2 + 12} className="tree-years">{years(p)}</text>
                      <text x={68} y={n.h / 2 + 30} className="tree-meta">{GENDER_LABEL[p.gender] ?? ""}</text>
                      {hasChildren ? (
                        <g transform={`translate(${n.w / 2} ${n.h})`} className="tree-toggle" role="button" tabIndex={0}
                          aria-label={collapsed.has(n.id) ? "Avlodlarni ochish" : "Avlodlarni yig‘ish"}
                          onClick={(e) => { e.stopPropagation(); toggleCollapse(n.id); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggleCollapse(n.id); } }}>
                          <circle r={11} />
                          <text y={5} textAnchor="middle">{collapsed.has(n.id) ? "+" : "−"}</text>
                        </g>
                      ) : null}
                    </>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
        <p className="tree-hint tree-count">{layout.nodes.length} ta odam · {layout.generations} avlod</p>
      </div>

      {selected && info ? (
        <section className="card section" aria-live="polite" aria-labelledby="sel-title">
          <h2 id="sel-title">{fullName(selected)}</h2>
          <p className="muted">{years(selected)}{selected.isLiving ? "" : " · vafot etgan"}</p>
          <dl className="detail">
            {info.relation ? (<><dt>Siz uchun</dt><dd>{info.relation}</dd></>) : null}
            <dt>Ota-onasi</dt><dd>{info.parents}</dd>
            <dt>Turmush o‘rtog‘i</dt><dd>{info.spouses}</dd>
            <dt>Farzandlari</dt><dd>{info.children}</dd>
          </dl>
          <button type="button" className="btn btn-secondary" onClick={() => focusOn(selected.id)}>Markazga olish</button>
        </section>
      ) : null}
    </div>
  );
}
