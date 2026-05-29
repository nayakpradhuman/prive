import { useState, useEffect, useRef } from 'react';
import { Rive, EventType } from '@rive-app/webgl2';
import { RiveFileInfo, RiveViewModelInfo } from '../types';
import { Select } from './Select';

interface FiredEvent {
  id: number;
  name: string;
  type: string;
  props: Record<string, unknown>;
  ts: number;
}

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button className="tog" data-on={on ? '1' : '0'} onClick={onToggle} disabled={disabled} style={disabled ? { opacity: 0.4 } : {}}>
      <span className="tog-thumb" />
    </button>
  );
}

function Section({ label, sub, children, defaultOpen = true }: { label: string; sub?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="insp-section">
      <button className="insp-section-head" onClick={() => setOpen(o => !o)}>
        <svg className="insp-chevron" data-open={open ? '1' : '0'} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
        <span className="insp-section-label">{label}</span>
        {sub && <span className="insp-section-sub">{sub}</span>}
      </button>
      {open && <div className="insp-section-body">{children}</div>}
    </div>
  );
}

function NumberRow({ name, value, onChange, disabled, step = 1 }: {
  name: string; value: number; onChange: (v: number) => void; disabled?: boolean; step?: number;
}) {
  return (
    <div className="insp-row insp-row-num">
      <span className="insp-prop-name">{name}</span>
      <span className="insp-val-label">V</span>
      <input
        className="insp-num-field"
        type="number"
        value={value}
        step={step}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
      />
      <button className="insp-stepper" disabled={disabled} onClick={() => onChange(+(value - step).toFixed(6))}>−</button>
      <button className="insp-stepper" disabled={disabled} onClick={() => onChange(+(value + step).toFixed(6))}>+</button>
    </div>
  );
}

function argbToHex(argb: number): string {
  const u = argb >>> 0;
  const r = (u >> 16) & 0xff;
  const g = (u >> 8) & 0xff;
  const b = u & 0xff;
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

interface Props {
  info: RiveFileInfo;
  rive: Rive;
  selectedArtboard: string;
  selectedSM: string;
  onArtboardChange: (ab: string) => void;
  onSMChange: (sm: string) => void;
}

type ProbedProp = { name: string; type: string };

export function ControlsCard({ info, rive, selectedArtboard, selectedSM, onArtboardChange, onSMChange }: Props) {
  const [boolVals, setBoolVals] = useState<Record<string, boolean>>({});
  const [numVals, setNumVals] = useState<Record<string, number>>({});
  const [textVals, setTextVals] = useState<Record<string, string>>({});
  const [firedEvents, setFiredEvents] = useState<FiredEvent[]>([]);
  const counterRef = useRef(0);

  // ── Data (ViewModel) state ───────────────────────────────────────
  const [vmBindings, setVmBindings] = useState<Record<string, any>>({});
  // Probed props: direct-only (nested props are filtered out)
  const [vmProbedProps, setVmProbedProps] = useState<Record<string, ProbedProp[]>>({});
  const [vmPropVals, setVmPropVals] = useState<Record<string, Record<string, any>>>({});
  // Nested VM state: vmName → propName → ...
  const [vmNestedVMIs, setVmNestedVMIs] = useState<Record<string, Record<string, any>>>({});
  const [vmNestedProbedProps, setVmNestedProbedProps] = useState<Record<string, Record<string, ProbedProp[]>>>({});
  const [vmNestedPropVals, setVmNestedPropVals] = useState<Record<string, Record<string, Record<string, any>>>>({});

  const artboardSMs = info.stateMachinesByArtboard[selectedArtboard] ?? [];
  const animations = info.animationsByArtboard[selectedArtboard] ?? [];
  const definedEvents = info.eventsByArtboard?.[selectedArtboard] ?? [];
  const textRuns = info.textRunsByArtboard?.[selectedArtboard] ?? [];
  const inputKey = `${selectedArtboard}::${selectedSM}`;
  const inputs = info.inputsByStateMachine[inputKey] ?? [];
  const viewModels = info.viewModels ?? [];

  useEffect(() => {
    setBoolVals({});
    setNumVals({});
    setVmBindings({});
    setVmProbedProps({});
    setVmPropVals({});
    setVmNestedVMIs({});
    setVmNestedProbedProps({});
    setVmNestedPropVals({});
    setFiredEvents([]);
  }, [rive]);

  useEffect(() => {
    const handler = (e: any) => {
      const d = e?.data ?? e ?? {};
      setFiredEvents(prev => [
        { id: counterRef.current++, name: d.name ?? '(unknown)', type: d.type ?? 'general', props: d.properties ?? {}, ts: Date.now() },
        ...prev.slice(0, 49),
      ]);
    };
    rive.on(EventType.RiveEvent, handler);
    return () => rive.off(EventType.RiveEvent, handler);
  }, [rive]);

  // ── SM inputs ────────────────────────────────────────────────────
  const setBool = (name: string, val: boolean) => {
    setBoolVals(v => ({ ...v, [name]: val }));
    rive.stateMachineInputs(selectedSM)?.find(i => i.name === name && (i.value = val));
  };

  const setNum = (name: string, val: number) => {
    setNumVals(v => ({ ...v, [name]: val }));
    const inp = rive.stateMachineInputs(selectedSM)?.find(i => i.name === name);
    if (inp) inp.value = val;
  };

  const fireTrigger = (name: string) => {
    rive.stateMachineInputs(selectedSM)?.find(i => i.name === name)?.fire();
  };

  const setTextRun = (runName: string, val: string) => {
    setTextVals(v => ({ ...v, [runName]: val }));
    try { (rive as any).setTextRunValue(runName, val, selectedArtboard || undefined); } catch {}
  };

  // ── ViewModel binding ────────────────────────────────────────────

  // Try each typed accessor to discover a property's runtime type.
  // Must be done at bind time because the static DataType enum from WASM
  // is Emscripten-encoded and unreliable for string comparisons.
  const probeType = (vmi: any, name: string): string => {
    const checks: [string, () => any][] = [
      ['trigger',   () => vmi.trigger(name)],
      ['boolean',   () => vmi.boolean(name)],
      ['number',    () => vmi.number(name)],
      ['string',    () => vmi.string(name)],
      ['color',     () => vmi.color(name)],
      ['enumType',  () => vmi.enum(name)],
      ['list',      () => vmi.list(name)],
      ['viewModel', () => vmi.viewModel(name)],
    ];
    for (const [type, getter] of checks) {
      try { if (getter() !== null) return type; } catch {}
    }
    return 'unknown';
  };

  // Find which ViewModel definition a nested VMI corresponds to by scoring
  // how many of each VM def's property names probe as non-unknown.
  // We use hit-rate (hits/total) so smaller VMs don't lose to larger ones.
  const findMatchingVMDef = (nestedVmi: any): RiveViewModelInfo | null => {
    let best: RiveViewModelInfo | null = null;
    let bestRate = 0;
    for (const vmDef of viewModels) {
      if (vmDef.properties.length === 0) continue;
      let hits = 0;
      for (const p of vmDef.properties) {
        try { if (probeType(nestedVmi, p.name) !== 'unknown') hits++; } catch {}
      }
      const rate = hits / vmDef.properties.length;
      if (rate > bestRate) { bestRate = rate; best = vmDef; }
    }
    return bestRate > 0 ? best : null;
  };

  const readInitialVal = (vmi: any, name: string, type: string): any => {
    try {
      if (type === 'string')   return vmi.string(name)?.value ?? '';
      if (type === 'number')   return vmi.number(name)?.value ?? 0;
      if (type === 'boolean')  return vmi.boolean(name)?.value ?? false;
      if (type === 'color')    return vmi.color(name)?.value ?? 0xff000000;
      if (type === 'enumType') return vmi.enum(name)?.value ?? '';
    } catch {}
    return undefined;
  };

  const bindVM = (vm: RiveViewModelInfo, instName: string) => {
    try {
      const vmObj = (rive as any).viewModelByName(vm.name);
      if (!vmObj) return;
      const vmi = instName ? vmObj.instanceByName(instName) : vmObj.defaultInstance();
      if (!vmi) return;
      (rive as any).bindViewModelInstance(vmi);
      setVmBindings(prev => ({ ...prev, [vm.name]: vmi }));

      const nestedVMIs: Record<string, any> = {};
      const nestedProbedProps: Record<string, ProbedProp[]> = {};
      const nestedVals: Record<string, Record<string, any>> = {};
      // Collect all property names that belong to nested VMs so we can
      // filter them out of the parent's flat list.
      const nestedPropNames = new Set<string>();

      // First pass: probe all properties listed for this VM
      const allProbed: ProbedProp[] = [];
      for (const p of vm.properties) {
        const type = probeType(vmi, p.name);
        if (type === 'unknown') continue;
        allProbed.push({ name: p.name, type });

        if (type === 'viewModel') {
          try {
            const nestedVmi = vmi.viewModel(p.name);
            if (!nestedVmi) continue;
            const matchedDef = findMatchingVMDef(nestedVmi);
            if (!matchedDef) continue;

            nestedVMIs[p.name] = nestedVmi;
            const nProbed: ProbedProp[] = [];
            const nVals: Record<string, any> = {};

            for (const np of matchedDef.properties) {
              const nType = probeType(nestedVmi, np.name);
              if (nType === 'unknown') continue;
              nProbed.push({ name: np.name, type: nType });
              nestedPropNames.add(np.name);
              const initVal = readInitialVal(nestedVmi, np.name, nType);
              if (initVal !== undefined) nVals[np.name] = initVal;
            }
            nestedProbedProps[p.name] = nProbed;
            nestedVals[p.name] = nVals;
          } catch {}
        }
      }

      // Second pass: build direct-only prop list.
      // Keep viewModel-typed props (they become sub-sections) and any prop
      // whose name is NOT claimed by a nested VM.
      const directProbed = allProbed.filter(
        p => p.type === 'viewModel' || !nestedPropNames.has(p.name),
      );

      const vals: Record<string, any> = {};
      for (const p of directProbed) {
        if (p.type === 'viewModel') continue;
        const initVal = readInitialVal(vmi, p.name, p.type);
        if (initVal !== undefined) vals[p.name] = initVal;
      }

      setVmProbedProps(prev => ({ ...prev, [vm.name]: directProbed }));
      setVmPropVals(prev => ({ ...prev, [vm.name]: vals }));
      setVmNestedVMIs(prev => ({ ...prev, [vm.name]: nestedVMIs }));
      setVmNestedProbedProps(prev => ({ ...prev, [vm.name]: nestedProbedProps }));
      setVmNestedPropVals(prev => ({ ...prev, [vm.name]: nestedVals }));
    } catch {}
  };

  const setVMProp = (vmName: string, propName: string, dataType: string, value: any) => {
    setVmPropVals(prev => ({ ...prev, [vmName]: { ...(prev[vmName] ?? {}), [propName]: value } }));
    const vmi = vmBindings[vmName];
    if (!vmi) return;
    try {
      if (dataType === 'string')  { const p = vmi.string(propName); if (p) p.value = value; }
      if (dataType === 'number' || dataType === 'integer') { const p = vmi.number(propName); if (p) p.value = Number(value); }
      if (dataType === 'boolean') { const p = vmi.boolean(propName); if (p) p.value = value; }
      if (dataType === 'color') {
        const p = vmi.color(propName);
        if (p) { const [r, g, b] = hexToRgb(value); p.rgb(r, g, b); }
      }
      if (dataType === 'enumType') { const p = vmi.enum(propName); if (p) p.value = value; }
    } catch {}
  };

  const fireVMTrigger = (vmName: string, propName: string) => {
    const vmi = vmBindings[vmName];
    if (!vmi) return;
    try { vmi.trigger(propName)?.trigger(); } catch {}
  };

  const setNestedVMProp = (vmName: string, nestedKey: string, propName: string, dataType: string, value: any) => {
    setVmNestedPropVals(prev => ({
      ...prev,
      [vmName]: {
        ...(prev[vmName] ?? {}),
        [nestedKey]: { ...(prev[vmName]?.[nestedKey] ?? {}), [propName]: value },
      },
    }));
    const nestedVmi = vmNestedVMIs[vmName]?.[nestedKey];
    if (!nestedVmi) return;
    try {
      if (dataType === 'string')  { const p = nestedVmi.string(propName); if (p) p.value = value; }
      if (dataType === 'number' || dataType === 'integer') { const p = nestedVmi.number(propName); if (p) p.value = Number(value); }
      if (dataType === 'boolean') { const p = nestedVmi.boolean(propName); if (p) p.value = value; }
      if (dataType === 'color') {
        const p = nestedVmi.color(propName);
        if (p) { const [r, g, b] = hexToRgb(value); p.rgb(r, g, b); }
      }
      if (dataType === 'enumType') { const p = nestedVmi.enum(propName); if (p) p.value = value; }
    } catch {}
  };

  const fireNestedVMTrigger = (vmName: string, nestedKey: string, propName: string) => {
    const nestedVmi = vmNestedVMIs[vmName]?.[nestedKey];
    if (!nestedVmi) return;
    try { nestedVmi.trigger(propName)?.trigger(); } catch {}
  };

  const getEnumValues = (vmi: any, propName: string): string[] => {
    try { return vmi?.enum(propName)?.values ?? []; } catch { return []; }
  };

  // ── Prop editor renderers ─────────────────────────────────────────

  const renderPropRow = (
    prop: ProbedProp,
    val: any,
    onSet: (v: any) => void,
    onFire: () => void,
    enumVmi: any,
  ) => {
    const { name, type } = prop;

    if (type === 'trigger') {
      return (
        <div key={name} className="insp-row" onClick={onFire} style={{ cursor: 'pointer' }}>
          <span className="insp-prop-name">{name}</span>
          <span className="insp-type-label insp-type-trigger">trigger</span>
        </div>
      );
    }
    if (type === 'boolean') {
      const on = val ?? false;
      return (
        <div key={name} className="insp-row">
          <span className="insp-prop-name">{name}</span>
          <Toggle on={on} onToggle={() => onSet(!on)} />
        </div>
      );
    }
    if (type === 'number' || type === 'integer') {
      return (
        <NumberRow key={name} name={name} value={val ?? 0} step={type === 'integer' ? 1 : 0.01} onChange={onSet} />
      );
    }
    if (type === 'string') {
      return (
        <div key={name} className="insp-row insp-row-text">
          <span className="insp-prop-name">{name}</span>
          <input
            className="insp-text-input"
            type="text"
            value={val ?? ''}
            placeholder="value…"
            onChange={e => onSet(e.target.value)}
          />
        </div>
      );
    }
    if (type === 'color') {
      const hex = argbToHex(val ?? 0xff000000);
      return (
        <div key={name} className="insp-row">
          <span className="insp-prop-name">{name}</span>
          <div className="data-color-wrap">
            <input type="color" className="data-color-input" value={hex} onChange={e => onSet(e.target.value)} />
            <span className="data-color-hex">{hex}</span>
          </div>
        </div>
      );
    }
    if (type === 'enumType') {
      const enumVals = getEnumValues(enumVmi, name);
      const cur = val ?? '';
      return (
        <div key={name} className="insp-row">
          <span className="insp-prop-name">{name}</span>
          <select className="data-enum-select" value={cur} onChange={e => onSet(e.target.value)}>
            {enumVals.length === 0 && <option value={cur}>{cur || '—'}</option>}
            {enumVals.map((v: string) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      );
    }
    // list / image / artboard / unknown — readonly
    return (
      <div key={name} className="insp-row">
        <span className="insp-prop-name">{name}</span>
        <span className="insp-type-label">{type}</span>
      </div>
    );
  };

  const bools = inputs.filter(i => i.type === 'boolean');
  const nums = inputs.filter(i => i.type === 'number');
  const triggers = inputs.filter(i => i.type === 'trigger');
  const hasInputs = inputs.length > 0;

  return (
    <div className="card ctrl-card">
      <div className="ctrl-card-head">
        <span className="ctrl-card-title">Controls</span>
      </div>

      <div className="ctrl-scroll">
        {/* Artboard selector */}
        {info.artboards.length > 1 && (
          <div style={{ padding: '10px 14px 0' }}>
            <div className="sec-label" style={{ marginBottom: 6 }}>Artboard</div>
            <div className="artboard-chips">
              {info.artboards.map(ab => (
                <button key={ab} className="ab-chip" data-on={selectedArtboard === ab ? '1' : '0'} onClick={() => onArtboardChange(ab)}>
                  {ab}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── State Machine inputs ── */}
        {artboardSMs.length > 0 && (
          <Section label="State Machine">
            <div style={{ padding: '6px 14px 4px' }}>
              <Select
                value={selectedSM}
                options={artboardSMs.map(sm => ({ value: sm, label: sm }))}
                onChange={onSMChange}
              />
            </div>

            {hasInputs ? (
              <div className="insp-prop-list">
                {triggers.map(inp => (
                  <div key={inp.name} className="insp-row" onClick={() => fireTrigger(inp.name)} style={{ cursor: 'pointer' }}>
                    <span className="insp-prop-name">{inp.name}</span>
                    <span className="insp-type-label insp-type-trigger">trigger</span>
                  </div>
                ))}
                {bools.map(inp => {
                  const on = boolVals[inp.name] ?? (inp.defaultValue as boolean) ?? false;
                  return (
                    <div key={inp.name} className="insp-row">
                      <span className="insp-prop-name">{inp.name}</span>
                      <Toggle on={on} onToggle={() => setBool(inp.name, !on)} />
                    </div>
                  );
                })}
                {nums.map(inp => {
                  const val = numVals[inp.name] ?? (inp.defaultValue as number) ?? 0;
                  const def = (inp.defaultValue as number) ?? 0;
                  const step = def > 0 && def <= 1 ? 0.01 : 1;
                  return (
                    <NumberRow
                      key={inp.name}
                      name={inp.name}
                      value={val}
                      step={step}
                      onChange={v => setNum(inp.name, v)}
                    />
                  );
                })}
              </div>
            ) : (
              <span className="empty-label" style={{ padding: '6px 14px', display: 'block' }}>No inputs in "{selectedSM}".</span>
            )}
          </Section>
        )}

        {/* ── Animations ── */}
        {animations.length > 0 && (
          <Section label="Animations" defaultOpen={false}>
            <div className="insp-prop-list">
              {animations.map(a => (
                <div key={a} className="insp-row" onClick={() => rive.play(a)} style={{ cursor: 'pointer' }}>
                  <span className="insp-prop-name">{a}</span>
                  <span className="insp-type-label">play</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Text Runs ── */}
        {textRuns.length > 0 && (
          <Section label="Text Runs" defaultOpen={false}>
            <div className="insp-prop-list">
              {textRuns.map(runName => {
                const val = textVals[runName] ?? ((rive as any).getTextRunValue?.(runName, selectedArtboard || undefined) ?? '');
                return (
                  <div key={runName} className="insp-row insp-row-text">
                    <span className="insp-prop-name">{runName}</span>
                    <input
                      className="insp-text-input"
                      type="text"
                      value={val}
                      placeholder="value…"
                      onChange={e => setTextRun(runName, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── ViewModels (Data) ── */}
        {viewModels.map(vm => {
          const vmi = vmBindings[vm.name];
          const isBound = !!vmi;
          const probedProps = vmProbedProps[vm.name] ?? [];
          const directProps = probedProps.filter(p => p.type !== 'viewModel');
          const nestedVMProps = probedProps.filter(p => p.type === 'viewModel');
          const vals = vmPropVals[vm.name] ?? {};

          return (
            <Section key={vm.name} label="data" sub={vm.name}>
              {/* Instance selector + bind */}
              {!isBound && (
                <div style={{ padding: '6px 14px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {vm.instanceNames.length > 0 && (
                    <div className="artboard-chips">
                      {vm.instanceNames.map(n => (
                        <button key={n} className="ab-chip" onClick={() => bindVM(vm, n)}>{n}</button>
                      ))}
                    </div>
                  )}
                  <button className="data-bind-btn" onClick={() => bindVM(vm, '')}>
                    Bind {vm.instanceNames.length > 0 ? 'default' : 'instance'}
                  </button>
                </div>
              )}

              {isBound && (
                <>
                  {/* Direct (non-nested) props */}
                  {directProps.length > 0 && (
                    <div className="insp-prop-list">
                      {directProps.map(prop =>
                        renderPropRow(
                          prop,
                          vals[prop.name],
                          v => setVMProp(vm.name, prop.name, prop.type, v),
                          () => fireVMTrigger(vm.name, prop.name),
                          vmi,
                        ),
                      )}
                    </div>
                  )}

                  {/* Nested ViewModel sub-sections */}
                  {nestedVMProps.map(prop => {
                    const nestedVmi = vmNestedVMIs[vm.name]?.[prop.name];
                    const nestedProps = vmNestedProbedProps[vm.name]?.[prop.name] ?? [];
                    const nestedVals = vmNestedPropVals[vm.name]?.[prop.name] ?? {};

                    return (
                      <Section key={prop.name} label={prop.name} defaultOpen={true}>
                        {nestedProps.length > 0 ? (
                          <div className="insp-prop-list">
                            {nestedProps.map(np =>
                              renderPropRow(
                                np,
                                nestedVals[np.name],
                                v => setNestedVMProp(vm.name, prop.name, np.name, np.type, v),
                                () => fireNestedVMTrigger(vm.name, prop.name, np.name),
                                nestedVmi,
                              ),
                            )}
                          </div>
                        ) : (
                          <span className="empty-label" style={{ padding: '4px 14px', display: 'block' }}>No editable properties.</span>
                        )}
                      </Section>
                    );
                  })}
                </>
              )}
            </Section>
          );
        })}

        {/* ── Events ── */}
        <Section label="Events" defaultOpen={false}>
          {definedEvents.length > 0 && (
            <div className="insp-prop-list" style={{ borderBottom: '1px solid var(--line)', marginBottom: 6 }}>
              {definedEvents.map(ev => (
                <div key={ev.name} className="insp-row">
                  <span className="insp-prop-name">{ev.name}</span>
                  <span className="insp-type-label">{ev.type === 'openUrl' ? 'url' : 'event'}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: '0 14px 10px' }}>
            <div className="ev-log-head" style={{ marginBottom: 6 }}>
              <span className="insp-section-sub" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Live log</span>
              {firedEvents.length > 0 && (
                <button className="ev-clear-btn" onClick={() => setFiredEvents([])}>Clear</button>
              )}
            </div>
            {firedEvents.length === 0 ? (
              <span className="empty-label">No events yet. Interact with the animation.</span>
            ) : (
              <div className="ev-log">
                {firedEvents.map(ev => {
                  const propEntries = Object.entries(ev.props);
                  const time = new Date(ev.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  return (
                    <div key={ev.id} className="ev-log-row">
                      <span className="ev-log-time">{time}</span>
                      <span className="ev-log-name">{ev.name}</span>
                      {propEntries.length > 0 && (
                        <span className="ev-log-props">{propEntries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Section>

        {/* Empty state */}
        {artboardSMs.length === 0 && animations.length === 0 && textRuns.length === 0 && viewModels.length === 0 && (
          <span className="empty-label" style={{ padding: '16px 14px', display: 'block' }}>Nothing to control in this artboard.</span>
        )}
      </div>
    </div>
  );
}
