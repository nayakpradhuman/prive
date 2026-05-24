import { useState, useEffect, useRef } from 'react';
import { Rive, EventType } from '@rive-app/webgl2';
import { RiveFileInfo } from '../types';
import { Select } from './Select';

type CtrlTab = 'anim' | 'sm' | 'text' | 'events';

interface FiredEvent {
  id: number;
  name: string;
  type: string;
  props: Record<string, unknown>;
  ts: number;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button className="tog" data-on={on ? '1' : '0'} onClick={onToggle}>
      <span className="tog-thumb" />
    </button>
  );
}

interface Props {
  info: RiveFileInfo;
  rive: Rive;
  selectedArtboard: string;
  selectedSM: string;
  onArtboardChange: (ab: string) => void;
  onSMChange: (sm: string) => void;
}

export function ControlsCard({ info, rive, selectedArtboard, selectedSM, onArtboardChange, onSMChange }: Props) {
  const [boolVals, setBoolVals] = useState<Record<string, boolean>>({});
  const [numVals, setNumVals] = useState<Record<string, number>>({});
  const [textVals, setTextVals] = useState<Record<string, string>>({});
  const [firedEvents, setFiredEvents] = useState<FiredEvent[]>([]);
  const counterRef = useRef(0);

  const artboardSMs = info.stateMachinesByArtboard[selectedArtboard] ?? [];
  const animations = info.animationsByArtboard[selectedArtboard] ?? [];
  const definedEvents = info.eventsByArtboard?.[selectedArtboard] ?? [];
  const textRuns = info.textRunsByArtboard?.[selectedArtboard] ?? [];
  const inputKey = `${selectedArtboard}::${selectedSM}`;
  const inputs = info.inputsByStateMachine[inputKey] ?? [];

  const hasSM = artboardSMs.length > 0;
  const hasAnim = animations.length > 0;
  const hasText = textRuns.length > 0;

  const availableTabs: CtrlTab[] = [
    ...(hasSM ? ['sm' as CtrlTab] : []),
    ...(hasAnim ? ['anim' as CtrlTab] : []),
    ...(hasText ? ['text' as CtrlTab] : []),
    'events',
  ];

  const [tab, setTab] = useState<CtrlTab>(availableTabs[0] ?? 'events');

  // When artboard changes, switch to first available tab if current is no longer valid
  useEffect(() => {
    if (!availableTabs.includes(tab)) setTab(availableTabs[0] ?? 'events');
  }, [selectedArtboard]);

  // Subscribe to Rive events
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

  const bools = inputs.filter(i => i.type === 'boolean');
  const nums = inputs.filter(i => i.type === 'number');
  const triggers = inputs.filter(i => i.type === 'trigger');

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

  const TAB_LABELS: Record<CtrlTab, string> = {
    sm: 'State Machine',
    anim: 'Animations',
    text: 'Text',
    events: 'Events',
  };

  return (
    <div className="card ctrl-card">
      <div className="ctrl-card-head">
        <span className="ctrl-card-title">Controls</span>
      </div>

      <div className="ctrl-scroll">
        {/* Artboard selector */}
        {info.artboards.length > 1 && (
          <div>
            <div className="sec-label">Artboard</div>
            <div className="artboard-chips">
              {info.artboards.map(ab => (
                <button key={ab} className="ab-chip" data-on={selectedArtboard === ab ? '1' : '0'} onClick={() => onArtboardChange(ab)}>
                  {ab}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab switcher — only rendered tabs that have content */}
        <div className="ctrl-tabs">
          {availableTabs.map(t => (
            <button key={t} className="ctrl-tab" data-on={tab === t ? '1' : '0'} onClick={() => setTab(t)}>
              {TAB_LABELS[t]}
              {t === 'events' && firedEvents.length > 0 && (
                <span className="ctrl-ev-badge">{firedEvents.length > 9 ? '9+' : firedEvents.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Animations tab ── */}
        {tab === 'anim' && (
          <div className="anim-grid">
            {animations.map(a => (
              <button key={a} className="anim-btn" onClick={() => rive.play(a)}>{a}</button>
            ))}
          </div>
        )}

        {/* ── State Machine tab ── */}
        {tab === 'sm' && (
          <div className="sm-section">
            <div>
              <div className="sec-label">State Machine</div>
              <Select
                value={selectedSM}
                options={artboardSMs.map(sm => ({ value: sm, label: sm }))}
                onChange={onSMChange}
              />
            </div>

            {triggers.length > 0 && (
              <div className="inp-group">
                <div className="inp-group-label">Triggers</div>
                <div className="inp-grid">
                  {triggers.map(inp => (
                    <button key={inp.name} className="trig-btn" onClick={() => fireTrigger(inp.name)}>{inp.name}</button>
                  ))}
                </div>
              </div>
            )}

            {bools.length > 0 && (
              <div className="inp-group">
                <div className="inp-group-label">Booleans</div>
                {bools.map(inp => {
                  const on = boolVals[inp.name] ?? (inp.defaultValue as boolean) ?? false;
                  return (
                    <div key={inp.name} className="bool-row">
                      <span className="ibadge ib-b">B</span>
                      <span className="inp-label">{inp.name}</span>
                      <Toggle on={on} onToggle={() => setBool(inp.name, !on)} />
                    </div>
                  );
                })}
              </div>
            )}

            {nums.length > 0 && (
              <div className="inp-group">
                <div className="inp-group-label">Numbers</div>
                {nums.map(inp => {
                  const val = numVals[inp.name] ?? (inp.defaultValue as number) ?? 0;
                  const def = (inp.defaultValue as number) ?? 0;
                  // Infer a sensible slider range from the default value
                  const sliderMax = def > 0 && def <= 1 ? 1 : def > 100 ? Math.ceil(def / 100) * 100 : 100;
                  const sliderStep = sliderMax <= 1 ? 0.01 : 1;
                  return (
                    <div key={inp.name}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span className="ibadge ib-n">N</span>
                        <span className="num-row-label">{inp.name}</span>
                        <span className="num-range-hint">0 – {sliderMax}</span>
                      </div>
                      <div className="num-inp-row">
                        <input className="num-sl" type="range" min={0} max={sliderMax} step={sliderStep}
                          value={Math.min(Math.max(val, 0), sliderMax)}
                          onChange={e => setNum(inp.name, Number(e.target.value))} />
                        <input className="num-field" type="number" step={sliderStep} value={val}
                          onChange={e => setNum(inp.name, Number(e.target.value))} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {inputs.length === 0 && (
              <span className="empty-label">No inputs in "{selectedSM}".</span>
            )}
          </div>
        )}

        {/* ── Text Runs tab ── */}
        {tab === 'text' && (
          <div className="sm-section">
            <div className="inp-group">
              <div className="inp-group-label">Text Runs</div>
              {textRuns.map(runName => {
                const val = textVals[runName] ?? ((rive as any).getTextRunValue?.(runName, selectedArtboard || undefined) ?? '');
                return (
                  <div key={runName} className="text-run-row">
                    <div className="text-run-header">
                      <span className="ibadge ib-txt">T</span>
                      <span className="inp-label">{runName}</span>
                    </div>
                    <input
                      className="text-run-input"
                      type="text"
                      value={val}
                      placeholder="Enter text value…"
                      onChange={e => setTextRun(runName, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
            <p className="text-run-hint">Changes update the canvas live via <code>setTextRunValue</code>.</p>
          </div>
        )}

        {/* ── Events tab ── */}
        {tab === 'events' && (
          <div className="sm-section">
            {definedEvents.length > 0 && (
              <div className="inp-group">
                <div className="inp-group-label">Defined Events</div>
                {definedEvents.map(ev => (
                  <div key={ev.name} className="ev-def-row">
                    <span className={`ibadge ${ev.type === 'openUrl' ? 'ib-ev-url' : 'ib-ev'}`}>
                      {ev.type === 'openUrl' ? 'URL' : 'E'}
                    </span>
                    <span className="inp-label">{ev.name}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="inp-group">
              <div className="ev-log-head">
                <div className="inp-group-label" style={{ margin: 0 }}>Live Log</div>
                {firedEvents.length > 0 && (
                  <button className="ev-clear-btn" onClick={() => setFiredEvents([])}>Clear</button>
                )}
              </div>
              {firedEvents.length === 0 ? (
                <span className="empty-label">No events fired yet. Interact with the animation.</span>
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
                          <span className="ev-log-props">
                            {propEntries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {definedEvents.length === 0 && firedEvents.length === 0 && (
              <span className="empty-label">No Rive events defined in this artboard.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
