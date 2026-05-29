import { useEffect, useRef, useCallback, useState } from 'react';
import { Rive, StateMachineInputType, EventType, Layout, Fit, Alignment } from '@rive-app/webgl2';
import { RiveFileInfo, RiveInputInfo, RiveEventInfo, RiveViewModelInfo } from '../types';

const ALIGN_MAP: Record<string, Alignment> = {
  tl: Alignment.TopLeft,    tc: Alignment.TopCenter,    tr: Alignment.TopRight,
  ml: Alignment.CenterLeft, mc: Alignment.Center,       mr: Alignment.CenterRight,
  bl: Alignment.BottomLeft, bc: Alignment.BottomCenter, br: Alignment.BottomRight,
};

const FIT_MAP: Record<string, Fit> = {
  contain: Fit.Contain, cover: Fit.Cover, fill: Fit.Fill,
  fitWidth: Fit.FitWidth, fitHeight: Fit.FitHeight, none: Fit.None,
};

interface Props {
  buffer: ArrayBuffer;
  artboard: string;
  stateMachine: string;
  align?: string;
  fit?: string;
  onInfoExtracted: (info: Omit<RiveFileInfo, 'fileName' | 'fileSize'>) => void;
  onRiveReady: (rive: Rive) => void;
  bgColor: string;
}

export function RiveCanvas({ buffer, artboard, stateMachine, align = 'mc', fit = 'contain', onInfoExtracted, onRiveReady, bgColor }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const riveRef = useRef<Rive | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (riveRef.current) {
      try { riveRef.current.cleanup(); } catch {}
      riveRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !buffer) return;
    cleanup();
    setIsLoading(true);
    setError(null);

    const bufferCopy = buffer.slice(0);

    const r = new Rive({
      buffer: bufferCopy,
      canvas: canvasRef.current,
      artboard: artboard || undefined,
      // Only pass stateMachine if it is non-empty; empty string causes the
      // "not found, falling back" warning from the Rive runtime.
      stateMachines: stateMachine || undefined,
      autoplay: true,
      onLoad: () => {
        setIsLoading(false);

        const contents = r.contents;
        const allArtboards = contents?.artboards ?? [];

        const artboards = allArtboards.map((a) => a.name);

        // Per-artboard maps — never mix SMs across artboards.
        const stateMachinesByArtboard: Record<string, string[]> = {};
        const animationsByArtboard: Record<string, string[]> = {};
        const inputsByStateMachine: Record<string, RiveInputInfo[]> = {};
        const eventsByArtboard: Record<string, RiveEventInfo[]> = {};
        const textRunsByArtboard: Record<string, string[]> = {};

        for (const ab of allArtboards) {
          stateMachinesByArtboard[ab.name] = (ab.stateMachines ?? []).map((sm) => sm.name);
          animationsByArtboard[ab.name] = ab.animations ?? [];
          // 131 = RiveEventType.OpenUrl in the Rive runtime
          eventsByArtboard[ab.name] = (ab.events ?? []).map((e: any) => ({
            name: e.name,
            type: (e.type === 131 ? 'openUrl' : 'general') as RiveEventInfo['type'],
          }));
          // Text runs: available in runtime >= 2.x via ab.textRuns
          const rawRuns: any[] = (ab as any).textRuns ?? [];
          textRunsByArtboard[ab.name] = rawRuns.map((t: any) => t.name ?? t).filter(Boolean);

          for (const sm of ab.stateMachines ?? []) {
            // Store inputs keyed by "artboardName::smName" to avoid collisions
            // when two artboards have a SM with the same name.
            const key = `${ab.name}::${sm.name}`;
            inputsByStateMachine[key] = (sm.inputs ?? []).map((inp) => {
              let type: RiveInputInfo['type'] = 'trigger';
              let defaultValue: number | boolean | undefined;
              if (inp.type === StateMachineInputType.Boolean) {
                type = 'boolean';
                defaultValue = inp.initialValue as boolean | undefined;
              } else if (inp.type === StateMachineInputType.Number) {
                type = 'number';
                defaultValue = inp.initialValue as number | undefined;
              }
              return { name: inp.name, type, defaultValue };
            });
          }
        }

        // Extract ViewModels (data binding — replaces inputs in future)
        // ViewModel.properties returns raw WASM enum objects for `type`; probe
        // by name below to get reliable string type names (done at bind time in
        // ControlsCard). Here we only record property names for code generation.
        const viewModels: RiveViewModelInfo[] = [];
        const vmCount = r.viewModelCount ?? 0;
        for (let vi = 0; vi < vmCount; vi++) {
          const vm = r.viewModelByIndex(vi);
          if (!vm) continue;
          // Resolve raw WASM DataType enum → string name.
          // The type field may be an Emscripten enum object or a string depending
          // on the runtime version. We normalise via all known approaches.
          const DTYPE_NUMERIC: Record<number, string> = {
            0:'none',1:'string',2:'number',3:'boolean',
            4:'color',5:'list',6:'enumType',7:'trigger',
            8:'viewModel',9:'integer',10:'listIndex',11:'image',12:'artboard',
          };
          const KNOWN_STRINGS = new Set(Object.values(DTYPE_NUMERIC));
          const resolveType = (raw: any): string => {
            if (typeof raw === 'string' && KNOWN_STRINGS.has(raw)) return raw;
            if (typeof raw === 'number') return DTYPE_NUMERIC[raw] ?? 'unknown';
            if (raw && typeof raw === 'object') {
              if (typeof raw.value === 'number') return DTYPE_NUMERIC[raw.value] ?? 'unknown';
              const s = String(raw);
              if (KNOWN_STRINGS.has(s)) return s;
            }
            return 'unknown';
          };
          viewModels.push({
            name: vm.name,
            instanceCount: vm.instanceCount ?? 0,
            instanceNames: (vm as any).instanceNames ?? [],
            properties: ((vm as any).properties ?? []).map((p: any) => ({
              name: p.name,
              dataType: resolveType(p.type),
            })),
          });
        }

        onInfoExtracted({ artboards, stateMachinesByArtboard, animationsByArtboard, inputsByStateMachine, eventsByArtboard, textRunsByArtboard, viewModels });
        onRiveReady(r);
        r.resizeDrawingSurfaceToCanvas();
      },
      onLoadError: () => {
        setIsLoading(false);
        setError('Failed to load Rive file. Make sure it is a valid .riv file.');
      },
    });

    riveRef.current = r;

    const observer = new ResizeObserver(() => {
      riveRef.current?.resizeDrawingSurfaceToCanvas();
    });
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [buffer, artboard, stateMachine]);

  // Apply layout changes live without remounting
  useEffect(() => {
    if (!riveRef.current) return;
    riveRef.current.layout = new Layout({
      fit: FIT_MAP[fit] ?? Fit.Contain,
      alignment: ALIGN_MAP[align] ?? Alignment.Center,
    });
  }, [align, fit]);

  useEffect(() => () => cleanup(), []);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      {isLoading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 10 }}>
          <div className="spinner" />
          <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>Loading…</span>
        </div>
      )}
      {error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <p className="stage-err">{error}</p>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', opacity: isLoading || error ? 0 : 1 }} />
    </div>
  );
}
