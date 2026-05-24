import { useState } from 'react';
import { RiveFileInfo, DiscussionThread, CodeFramework } from '../types';
import { Align, RiveFit } from '../types';
import { Select } from './Select';

// 9-dot grid → Rive Alignment enum
const ALIGN_MAP: Record<Align, string> = {
  tl: 'Alignment.topLeft',    tc: 'Alignment.topCenter',    tr: 'Alignment.topRight',
  ml: 'Alignment.centerLeft', mc: 'Alignment.center',       mr: 'Alignment.centerRight',
  bl: 'Alignment.bottomLeft', bc: 'Alignment.bottomCenter', br: 'Alignment.bottomRight',
};

// Flutter uses a different set
const FLUTTER_ALIGN_MAP: Record<Align, string> = {
  tl: 'Alignment.topLeft',    tc: 'Alignment.topCenter',    tr: 'Alignment.topRight',
  ml: 'Alignment.centerLeft', mc: 'Alignment.center',       mr: 'Alignment.centerRight',
  bl: 'Alignment.bottomLeft', bc: 'Alignment.bottomCenter', br: 'Alignment.bottomRight',
};
const FLUTTER_FIT_MAP: Record<RiveFit, string> = {
  contain: 'BoxFit.contain', cover: 'BoxFit.cover', fill: 'BoxFit.fill',
  fitWidth: 'BoxFit.fitWidth', fitHeight: 'BoxFit.fitHeight', none: 'BoxFit.none',
};

const FIT_OPTS: { value: RiveFit; label: string }[] = [
  { value: 'contain',   label: 'Contain'    },
  { value: 'cover',     label: 'Cover'      },
  { value: 'fill',      label: 'Fill'       },
  { value: 'fitWidth',  label: 'Fit Width'  },
  { value: 'fitHeight', label: 'Fit Height' },
  { value: 'none',      label: 'None'       },
];


// Derive annotation text from discussion threads
function getSMNote(threads: DiscussionThread[], ab: string, sm: string): string {
  return threads.find(t => t.entityType === 'sm' && t.entityKey === `${ab}::${sm}`)?.annotationText ?? '';
}
function getInputNote(threads: DiscussionThread[], sm: string, input: string): string {
  return threads.find(t => t.entityType === 'input' && (t.entityKey === `${sm}::${input}` || t.entityKey === input))?.annotationText ?? '';
}

function toCamel(s: string) {
  return s.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^[A-Z]/, c => c.toLowerCase());
}
function toPascal(s: string) {
  const c = toCamel(s);
  return c.charAt(0).toUpperCase() + c.slice(1);
}
function esc(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Code generators ──────────────────────────────────────────────

function genReact(info: RiveFileInfo, ab: string, sm: string, threads: DiscussionThread[], showAnn: boolean, events: boolean, responsive: boolean, fit: RiveFit, align: Align): string {
  const inputs = info.inputsByStateMachine[`${ab}::${sm}`] ?? [];
  const textRuns = info.textRunsByArtboard?.[ab] ?? [];
  const bools = inputs.filter(i => i.type === 'boolean');
  const nums = inputs.filter(i => i.type === 'number');
  const trigs = inputs.filter(i => i.type === 'trigger');
  const hasInputs = inputs.length > 0;
  const smNote = showAnn ? getSMNote(threads, ab, sm) : '';
  const specLine = `// — Prive spec —————————————————————————————————————————\n// File: ${info.fileName}${sm ? `  ·  State machine: ${sm}` : ''}\n//\n// ——————————————————————————————————————————————————————`;

  const hooks = inputs.map(i => `  const ${toCamel(i.name)} = useStateMachineInput(rive, '${sm}', '${i.name}');`).join('\n');

  const usageParts = [
    ...bools.map(i => {
      const note = showAnn ? getInputNote(threads, sm, i.name) : '';
      return `      {/* ${i.name}${note ? ` — ${note}` : ''} */}\n      <input type="checkbox" onChange={e => ${toCamel(i.name)} && (${toCamel(i.name)}.value = e.target.checked)} />`;
    }),
    ...nums.map(i => {
      const note = showAnn ? getInputNote(threads, sm, i.name) : '';
      return `      {/* ${i.name}${note ? ` — ${note}` : ''} */}\n      <input type="range" min={0} max={100} onChange={e => ${toCamel(i.name)} && (${toCamel(i.name)}.value = +e.target.value)} />`;
    }),
    ...trigs.map(i => {
      const note = showAnn ? getInputNote(threads, sm, i.name) : '';
      return `      {/* ${i.name}${note ? ` — ${note}` : ''} */}\n      <button onClick={() => ${toCamel(i.name)}?.fire()}>${i.name}</button>`;
    }),
  ].join('\n\n');

  const textRunsStr = textRuns.length > 0
    ? `\n  // Text runs — update dynamic text in the animation\n${textRuns.map(r => `  // rive?.setTextRunValue('${r}', 'your text here');`).join('\n')}`
    : '';

  const eventsStr = events ? `\n  useEffect(() => {\n    if (!rive) return;\n    const onRiveEvent = (e: any) => {\n      const { name, type, properties } = e.data ?? {};\n      console.log('Rive event:', name, '|', type, properties ?? '');\n    };\n    rive.on(EventType.RiveEvent, onRiveEvent);\n    return () => rive.off(EventType.RiveEvent, onRiveEvent);\n  }, [rive]);` : '';
  const responsiveStr = responsive ? `\n  useEffect(() => {\n    if (!rive) return;\n    const el = document.querySelector('.rive-wrap') as HTMLElement;\n    if (!el) return;\n    const ro = new ResizeObserver(() => rive.resizeDrawingSurfaceToCanvas());\n    ro.observe(el);\n    return () => ro.disconnect();\n  }, [rive]);` : '';

  const needsUseEffect = events || responsive;
  const extras = needsUseEffect ? ', useEffect' : '';
  const layoutImports = `, Layout, Fit, Alignment`;
  const layoutStr = `\n    layout: new Layout({\n      fit: Fit.${fit},\n      alignment: ${ALIGN_MAP[align]},\n    }),`;

  return `${specLine}

import { useRive${hasInputs ? ', useStateMachineInput' : ''}${extras}${layoutImports} } from '@rive-app/react-webgl2';${events ? `\nimport { EventType } from '@rive-app/webgl2';` : ''}
${smNote ? `\n// ${smNote}\n` : ''}
export default function RiveAnimation() {
  const { rive, RiveComponent } = useRive({
    src: '${info.fileName}',${ab ? `\n    artboard: '${ab}',` : ''}${sm ? `\n    stateMachines: '${sm}',` : ''}${layoutStr}
    autoplay: true,
  });
${hasInputs ? '\n' + hooks + '\n' : ''}${textRunsStr ? textRunsStr + '\n' : ''}${eventsStr ? eventsStr + '\n' : ''}${responsiveStr ? responsiveStr + '\n' : ''}
  return (
    <div${responsive ? ' className="rive-wrap" style={{ width: \'100%\', aspectRatio: \'1\' }}' : ''}>
      <RiveComponent style={{ width: ${responsive ? "'100%'" : '400'}, height: ${responsive ? "'100%'" : '400'} }} />
${usageParts ? '\n' + usageParts + '\n    ' : '    '}
    </div>
  );
}`;
}

function genJS(info: RiveFileInfo, ab: string, sm: string, threads: DiscussionThread[], showAnn: boolean, events: boolean, responsive: boolean, fit: RiveFit, align: Align): string {
  const inputs = info.inputsByStateMachine[`${ab}::${sm}`] ?? [];
  const textRuns = info.textRunsByArtboard?.[ab] ?? [];
  const smNote = showAnn ? getSMNote(threads, ab, sm) : '';
  const specLine = `// — Prive spec —————————————————————————————————————————\n// File: ${info.fileName}${sm ? `  ·  State machine: ${sm}` : ''}\n//\n// ——————————————————————————————————————————————————————`;
  const vars = inputs.map(i => `    const ${toCamel(i.name)} = inputs.find(i => i.name === '${i.name}');`).join('\n');
  const usage = inputs.map(i => {
    const note = showAnn ? getInputNote(threads, sm, i.name) : '';
    if (i.type === 'boolean') return `    // ${i.name}${note ? ` — ${note}` : ''}\n    ${toCamel(i.name)}.value = true;`;
    if (i.type === 'number') return `    // ${i.name}${note ? ` — ${note}` : ''}\n    ${toCamel(i.name)}.value = 50;`;
    return `    // ${i.name}${note ? ` — ${note}` : ''}\n    ${toCamel(i.name)}.fire();`;
  }).join('\n\n');

  const textRunsStr = textRuns.length > 0
    ? `\n    // Text runs — update dynamic text\n${textRuns.map(r => `    // r.setTextRunValue('${r}', 'your text here');`).join('\n')}`
    : '';
  const eventsStr = events ? `\n    r.on(EventType.RiveEvent, e => {\n      const { name, type, properties } = e.data ?? {};\n      console.log('Rive event:', name, '|', type, properties ?? '');\n    });` : '';
  const responsiveStr = responsive ? `\nnew ResizeObserver(() => r.resizeDrawingSurfaceToCanvas()).observe(canvas);\n` : '';
  const layoutStr = `\n  layout: new Layout({\n    fit: Fit.${fit},\n    alignment: ${ALIGN_MAP[align]},\n  }),`;

  return `${specLine}

import { Rive, Layout, Fit, Alignment${events ? ', EventType' : ''} } from '@rive-app/webgl2';
${smNote ? `\n// ${smNote}\n` : ''}
const canvas = document.getElementById('canvas');
const r = new Rive({
  src: '${info.fileName}',${ab ? `\n  artboard: '${ab}',` : ''}${sm ? `\n  stateMachines: '${sm}',` : ''}${layoutStr}
  canvas,
  autoplay: true,
  onLoad: () => {${inputs.length ? `\n    const inputs = r.stateMachineInputs('${sm}');\n${vars}\n\n${usage}` : ''}${textRunsStr}${eventsStr}
  },
});${responsiveStr}`;
}

function genHTML(info: RiveFileInfo, ab: string, sm: string, threads: DiscussionThread[], showAnn: boolean, events: boolean, fit: RiveFit, align: Align): string {
  const inputs = info.inputsByStateMachine[`${ab}::${sm}`] ?? [];
  const textRuns = info.textRunsByArtboard?.[ab] ?? [];
  const smNote = showAnn ? getSMNote(threads, ab, sm) : '';
  const specComment = `<!-- Prive spec ————————————————————————————————————\n     File: ${info.fileName}${sm ? `  ·  State machine: ${sm}` : ''}${smNote ? `\n     ${smNote}` : ''}\n     ——————————————————————————————————————————————— -->`;

  const vars = inputs.map(i => {
    const note = showAnn ? getInputNote(threads, sm, i.name) : '';
    return `      const ${toCamel(i.name)} = inputs.find(i => i.name === '${i.name}');${note ? ` // ${note}` : ''}`;
  }).join('\n');

  const textRunsStr = textRuns.length > 0
    ? `\n\n        // Text runs — update dynamic text\n${textRuns.map(r => `        // r.setTextRunValue('${r}', 'your text here');`).join('\n')}`
    : '';

  const eventsStr = events
    ? `\n\n        r.on(rive.EventType.RiveEvent, function(e) {\n          var d = e.data || {};\n          console.log('Rive event:', d.name, '|', d.type, d.properties || '');\n        });`
    : '';

  return `${specComment}
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body>
  <canvas id="canvas" width="400" height="400"></canvas>
  <script src="https://unpkg.com/@rive-app/webgl2@latest/rive.js"></script>
  <script>
    var r = new rive.Rive({
      src: '${info.fileName}',${ab ? `\n      artboard: '${ab}',` : ''}${sm ? `\n      stateMachines: '${sm}',` : ''}
      layout: new rive.Layout({
        fit: rive.Fit.${fit},
        alignment: rive.${ALIGN_MAP[align]},
      }),
      canvas: document.getElementById('canvas'),
      autoplay: true,
      onLoad: function() {${inputs.length ? `\n        var inputs = r.stateMachineInputs('${sm}');\n${vars}` : ''}${textRunsStr}${eventsStr}
      },
    });
  </script>
</body>
</html>`;
}

function genFlutter(info: RiveFileInfo, ab: string, sm: string, threads: DiscussionThread[], showAnn: boolean, fit: RiveFit, align: Align): string {
  const inputs = info.inputsByStateMachine[`${ab}::${sm}`] ?? [];
  const bools = inputs.filter(i => i.type === 'boolean');
  const nums = inputs.filter(i => i.type === 'number');
  const trigs = inputs.filter(i => i.type === 'trigger');
  const smNote = showAnn ? getSMNote(threads, ab, sm) : '';
  const specLine = `// — Prive spec —————————————————————————————————————————\n// File: ${info.fileName}${sm ? `  ·  State machine: ${sm}` : ''}\n//\n// ——————————————————————————————————————————————————————`;
  const name = toPascal(info.fileName.replace(/\.riv$/i, '').replace(/[^a-zA-Z0-9]/g, '_'));

  const fields = [
    ...bools.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `  SMIBool? ${toCamel(i.name)};${note ? ` // ${note}` : ''}`; }),
    ...nums.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `  SMINumber? ${toCamel(i.name)};${note ? ` // ${note}` : ''}`; }),
    ...trigs.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `  SMITrigger? ${toCamel(i.name)};${note ? ` // ${note}` : ''}`; }),
  ].join('\n');

  const assigns = [
    ...bools.map(i => `    ${toCamel(i.name)} = ctrl.findInput<bool>('${i.name}') as SMIBool;`),
    ...nums.map(i => `    ${toCamel(i.name)} = ctrl.findInput<double>('${i.name}') as SMINumber;`),
    ...trigs.map(i => `    ${toCamel(i.name)} = ctrl.findInput<void>('${i.name}') as SMITrigger;`),
  ].join('\n');

  return `${specLine}

import 'package:flutter/material.dart';
import 'package:rive/rive.dart';
${smNote ? `\n// ${smNote}\n` : ''}
class ${name}Animation extends StatefulWidget {
  const ${name}Animation({super.key});
  @override State<${name}Animation> createState() => _${name}State();
}

class _${name}State extends State<${name}Animation> {
${fields || '  // No inputs defined'}

  void _onInit(Artboard artboard) {${sm ? `
    final ctrl = StateMachineController.fromArtboard(artboard, '${sm}');
    if (ctrl == null) return;
    artboard.addController(ctrl);
${assigns}` : ''}
  }

  @override
  Widget build(BuildContext context) {
    return RiveAnimation.asset(
      'assets/${info.fileName}',${ab ? `\n      artboard: '${ab}',` : ''}${sm ? `\n      stateMachines: const ['${sm}'],` : ''}
      fit: ${FLUTTER_FIT_MAP[fit]},
      alignment: ${FLUTTER_ALIGN_MAP[align]},
      onInit: _onInit,
    );
  }
}`;
}

function genSwift(info: RiveFileInfo, ab: string, sm: string, threads: DiscussionThread[], showAnn: boolean, events: boolean, fit: RiveFit, align: Align): string {
  const inputs = info.inputsByStateMachine[`${ab}::${sm}`] ?? [];
  const bools = inputs.filter(i => i.type === 'boolean');
  const nums = inputs.filter(i => i.type === 'number');
  const trigs = inputs.filter(i => i.type === 'trigger');
  const smNote = showAnn ? getSMNote(threads, ab, sm) : '';
  const specLine = `// — Prive spec —————————————————————————————————————————\n// File: ${info.fileName}${sm ? `  ·  State machine: ${sm}` : ''}\n//\n// ——————————————————————————————————————————————————————`;
  const assetName = info.fileName.replace(/\.riv$/i, '');

  const inputLines = [
    ...bools.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `    // ${i.name}${note ? ` — ${note}` : ''}\n    rvm.setInput("${i.name}", value: true)`; }),
    ...nums.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `    // ${i.name}${note ? ` — ${note}` : ''}\n    rvm.setInput("${i.name}", value: 50.0)`; }),
    ...trigs.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `    // ${i.name}${note ? ` — ${note}` : ''}\n    rvm.triggerInput("${i.name}")`; }),
  ].join('\n');

  const eventsStr = events ? `\n    rvm.on(.stateChange) { machine, state in\n      print("State: \\(machine) → \\(state)")\n    }\n    rvm.on(.play) { print("Playing") }\n    rvm.on(.pause) { print("Paused") }` : '';

  return `${specLine}

import SwiftUI
import RiveRuntime
${smNote ? `\n// ${smNote}\n` : ''}
struct ContentView: View {
  @StateObject private var rvm = RiveViewModel(
    fileName: "${assetName}",${ab ? `\n    artboardName: "${ab}",` : ''}${sm ? `\n    stateMachineName: "${sm}",` : ''}
    fit: .${fit},
    alignment: .${align === 'mc' ? 'center' : align === 'tl' ? 'topLeft' : align === 'tc' ? 'topCenter' : align === 'tr' ? 'topRight' : align === 'ml' ? 'centerLeft' : align === 'mr' ? 'centerRight' : align === 'bl' ? 'bottomLeft' : align === 'bc' ? 'bottomCenter' : 'bottomRight'}
  )

  var body: some View {
    rvm.view()
      .frame(width: 400, height: 400)${inputs.length || events ? `\n      .onAppear { configure() }` : ''}
  }
${inputs.length || events ? `\n  private func configure() {\n${inputLines}${eventsStr}\n  }` : ''}
}`;
}

function genKotlin(info: RiveFileInfo, ab: string, sm: string, threads: DiscussionThread[], showAnn: boolean, events: boolean, fit: RiveFit, align: Align): string {
  const inputs = info.inputsByStateMachine[`${ab}::${sm}`] ?? [];
  const bools = inputs.filter(i => i.type === 'boolean');
  const nums = inputs.filter(i => i.type === 'number');
  const trigs = inputs.filter(i => i.type === 'trigger');
  const smNote = showAnn ? getSMNote(threads, ab, sm) : '';
  const specLine = `// — Prive spec —————————————————————————————————————————\n// File: ${info.fileName}${sm ? `  ·  State machine: ${sm}` : ''}\n//\n// ——————————————————————————————————————————————————————`;
  const assetName = info.fileName.replace(/\.riv$/i, '').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

  const inputLines = [
    ...bools.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `    ${note ? `// ${note}\n    ` : ''}riveView.setBooleanState("${sm}", "${i.name}", true)`; }),
    ...nums.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `    ${note ? `// ${note}\n    ` : ''}riveView.setNumberState("${sm}", "${i.name}", 50f)`; }),
    ...trigs.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `    ${note ? `// ${note}\n    ` : ''}riveView.fireState("${sm}", "${i.name}")`; }),
  ].join('\n');

  const eventsStr = events ? `\n    riveView.addEventListener(object : RiveEventListener {\n      override fun notifyPlay(animation: PlayableInstance) = Unit\n      override fun notifyPause(animation: PlayableInstance) = Unit\n      override fun notifyStateChanged(sm: String, state: String) {\n        Log.d("Rive", "State: \$sm → \$state")\n      }\n    })` : '';

  return `${specLine}

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import app.rive.runtime.kotlin.RiveAnimationView${events ? `\nimport app.rive.runtime.kotlin.core.PlayableInstance\nimport app.rive.runtime.kotlin.core.RiveEventListener\nimport android.util.Log` : ''}
${smNote ? `\n// ${smNote}\n` : ''}
class MainActivity : AppCompatActivity() {
  private lateinit var riveView: RiveAnimationView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    riveView = findViewById(R.id.rive_view)
    riveView.setRiveResource(
      R.raw.${assetName},${ab ? `\n      artboardName = "${ab}",` : ''}${sm ? `\n      stateMachineName = "${sm}",` : ''}
      fit = Fit.${fit.toUpperCase()},
      alignment = Alignment.${ALIGN_MAP[align].replace('Alignment.', '').replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '')}
    )
${inputLines ? '\n' + inputLines : ''}${eventsStr}
  }
}`;
}

// ── Syntax highlighter ───────────────────────────────────────────

function highlightLine(raw: string, lang: CodeFramework): string {
  let s = esc(raw);
  s = s.replace(/(\/\/[^<]*)$/, '<span class="t-c">$1</span>');
  s = s.replace(/(&#39;[^<]*?&#39;|&quot;[^<]*?&quot;)/g, '<span class="t-s">$1</span>');
  if (lang === 'react' || lang === 'js' || lang === 'html') {
    s = s.replace(/\b(import|export|from|const|let|var|function|return|default|new|if|else|async|await|type|class|extends)\b/g, '<span class="t-k">$1</span>');
    s = s.replace(/\b(useRive|useStateMachineInput|useEffect|useCallback|Rive|EventType|useState|useRef)\b/g, '<span class="t-n">$1</span>');
  } else if (lang === 'flutter') {
    s = s.replace(/\b(import|class|extends|void|final|const|return|if|null|true|false|async|await|super|this|override|String|bool|double|int)\b/g, '<span class="t-k">$1</span>');
    s = s.replace(/\b(StateMachineController|RiveAnimation|SMIBool|SMINumber|SMITrigger|Artboard|BuildContext|Widget|State)\b/g, '<span class="t-n">$1</span>');
  } else if (lang === 'swift') {
    s = s.replace(/\b(import|struct|class|var|let|func|private|return|if|true|false|nil)\b/g, '<span class="t-k">$1</span>');
    s = s.replace(/\b(RiveViewModel|View|StateObject|ContentView)\b/g, '<span class="t-n">$1</span>');
  } else if (lang === 'kotlin') {
    s = s.replace(/\b(import|class|override|fun|val|var|private|lateinit|super|object|true|false|null|return|if|else)\b/g, '<span class="t-k">$1</span>');
    s = s.replace(/\b(AppCompatActivity|RiveAnimationView|Bundle|Log|RiveEventListener|PlayableInstance)\b/g, '<span class="t-n">$1</span>');
  }
  s = s.replace(/(?<![&#;\w])(\d+(?:\.\d+)?f?)(?!\w)/g, '<span class="t-n">$1</span>');
  return s;
}

function CodeBlock({ code, lang }: { code: string; lang: CodeFramework }) {
  const lines = code.split('\n');
  return (
    <div className="code-area">
      <pre className="code-pre">
        {lines.map((line, i) => (
          <div key={i} className="ln">
            <span className="ln-n">{i + 1}</span>
            <span className="ln-b" dangerouslySetInnerHTML={{ __html: highlightLine(line, lang) }} />
          </div>
        ))}
      </pre>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────

const FRAMEWORKS: { key: CodeFramework; label: string; pkg: string }[] = [
  { key: 'react',   label: 'React',      pkg: '@rive-app/react-webgl2' },
  { key: 'js',      label: 'Vanilla JS', pkg: '@rive-app/webgl2'       },
  { key: 'flutter', label: 'Flutter',    pkg: 'rive'                   },
  { key: 'swift',   label: 'Swift',      pkg: 'rive-ios'               },
  { key: 'kotlin',  label: 'Kotlin',     pkg: 'rive-android'           },
  { key: 'html',    label: 'HTML',       pkg: 'CDN'                    },
];

interface Props {
  info: RiveFileInfo;
  selectedArtboard: string;
  selectedSM: string;
  threads: DiscussionThread[];
  align: Align;
  fit: RiveFit;
  onFitChange: (f: RiveFit) => void;
}

export function CodeCard({ info, selectedArtboard, selectedSM, threads, align, fit, onFitChange }: Props) {
  const [fw, setFw] = useState<CodeFramework>('react');
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [events, setEvents] = useState(false);
  const [responsive, setResponsive] = useState(false);
  const [copied, setCopied] = useState(false);

  const supportsAnnotations = true;
  const supportsEvents = fw !== 'flutter';
  const supportsResponsive = fw === 'react' || fw === 'js';

  const code =
    fw === 'react'   ? genReact(info, selectedArtboard, selectedSM, threads, showAnnotations, events, responsive, fit, align)   :
    fw === 'js'      ? genJS(info, selectedArtboard, selectedSM, threads, showAnnotations, events, responsive, fit, align)      :
    fw === 'flutter' ? genFlutter(info, selectedArtboard, selectedSM, threads, showAnnotations, fit, align)                     :
    fw === 'swift'   ? genSwift(info, selectedArtboard, selectedSM, threads, showAnnotations, events, fit, align)               :
    fw === 'kotlin'  ? genKotlin(info, selectedArtboard, selectedSM, threads, showAnnotations, events, fit, align)              :
                       genHTML(info, selectedArtboard, selectedSM, threads, showAnnotations, events, fit, align);

  const fname =
    fw === 'react'   ? 'RiveAnimation.tsx'     :
    fw === 'js'      ? 'animation.js'          :
    fw === 'flutter' ? 'rive_animation.dart'   :
    fw === 'swift'   ? 'ContentView.swift'     :
    fw === 'kotlin'  ? 'MainActivity.kt'       :
                       'index.html';

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
    a.download = fname;
    a.click();
  };

  return (
    <div className="card code-card">
      <div className="card-head">
        <div className="card-title">Code</div>
        <div className="card-sub">Ready-to-use snippet — generated from your file, not boilerplate.</div>
      </div>

      <div className="fw-tabs">
        {FRAMEWORKS.map(f => (
          <button key={f.key} className="fw-tab" data-on={fw === f.key ? '1' : '0'} onClick={() => setFw(f.key)}>
            {f.label}
            <span className="fw-pkg">{f.pkg}</span>
          </button>
        ))}
      </div>

      <div className="code-toolbar">
        {supportsAnnotations && (
          <button className="code-opt" data-on={showAnnotations ? '1' : '0'} onClick={() => setShowAnnotations(v => !v)}>
            Annotations
          </button>
        )}
        {supportsEvents && (
          <button className="code-opt" data-on={events ? '1' : '0'} onClick={() => setEvents(v => !v)}>
            Events
          </button>
        )}
        {supportsResponsive && (
          <button className="code-opt" data-on={responsive ? '1' : '0'} onClick={() => setResponsive(v => !v)}>
            Responsive
          </button>
        )}
        <Select
          value={fit}
          options={FIT_OPTS}
          onChange={v => onFitChange(v as RiveFit)}
          title="Fit mode"
        />
        <button className="code-dl-btn" onClick={download} title="Download">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button className="code-copy-btn" onClick={copy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      <div className="code-fn-bar">
        <span className="code-fname">{fname}</span>
      </div>

      <CodeBlock code={code} lang={fw} />
    </div>
  );
}
