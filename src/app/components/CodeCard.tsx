import { useState } from 'react';
import { RiveFileInfo, DiscussionThread, CodeFramework, RiveViewModelInfo } from '../types';
import { Align, RiveFit } from '../types';
import { Select } from './Select';

const ALIGN_MAP: Record<Align, string> = {
  tl: 'Alignment.topLeft',    tc: 'Alignment.topCenter',    tr: 'Alignment.topRight',
  ml: 'Alignment.centerLeft', mc: 'Alignment.center',       mr: 'Alignment.centerRight',
  bl: 'Alignment.bottomLeft', bc: 'Alignment.bottomCenter', br: 'Alignment.bottomRight',
};
const FLUTTER_FIT_MAP: Record<RiveFit, string> = {
  contain: 'BoxFit.contain', cover: 'BoxFit.cover', fill: 'BoxFit.fill',
  fitWidth: 'BoxFit.fitWidth', fitHeight: 'BoxFit.fitHeight', none: 'BoxFit.none',
};
const SWIFT_ALIGN_MAP: Record<Align, string> = {
  tl: 'topLeft', tc: 'topCenter', tr: 'topRight',
  ml: 'centerLeft', mc: 'center', mr: 'centerRight',
  bl: 'bottomLeft', bc: 'bottomCenter', br: 'bottomRight',
};
const KOTLIN_ALIGN_MAP: Record<Align, string> = {
  tl: 'TOP_LEFT', tc: 'TOP_CENTER', tr: 'TOP_RIGHT',
  ml: 'CENTER_LEFT', mc: 'CENTER', mr: 'CENTER_RIGHT',
  bl: 'BOTTOM_LEFT', bc: 'BOTTOM_CENTER', br: 'BOTTOM_RIGHT',
};

const FIT_OPTS: { value: RiveFit; label: string }[] = [
  { value: 'contain',   label: 'Contain'    },
  { value: 'cover',     label: 'Cover'      },
  { value: 'fill',      label: 'Fill'       },
  { value: 'fitWidth',  label: 'Fit Width'  },
  { value: 'fitHeight', label: 'Fit Height' },
  { value: 'none',      label: 'None'       },
];

function getSMNote(threads: DiscussionThread[], ab: string, sm: string): string {
  return threads.find(t => t.entityType === 'sm' && t.entityKey === `${ab}::${sm}`)?.annotationText ?? '';
}
function getInputNote(threads: DiscussionThread[], sm: string, input: string): string {
  return threads.find(t => t.entityType === 'input' && (t.entityKey === `${sm}::${input}` || t.entityKey === input))?.annotationText ?? '';
}
function toCamel(s: string) {
  return s.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^[A-Z]/, c => c.toLowerCase());
}
function toPascal(s: string) { const c = toCamel(s); return c.charAt(0).toUpperCase() + c.slice(1); }
function esc(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── ViewModel prop access code per framework ─────────────────────

function vmPropJS(prop: { name: string; dataType: string }, prefix = 'vmi') {
  const n = prop.name;
  switch (prop.dataType) {
    case 'number':
    case 'integer':  return `${prefix}.number('${n}').value = 0;`;
    case 'boolean':  return `${prefix}.boolean('${n}').value = true;`;
    case 'string':   return `${prefix}.string('${n}').value = 'your text';`;
    case 'trigger':  return `${prefix}.trigger('${n}').trigger();`;
    case 'color':    return `${prefix}.color('${n}').rgb(255, 0, 0);`;
    case 'enumType': return `${prefix}.enum('${n}').value = 'EnumValue';`;
    case 'viewModel':return `// ${prefix}.replaceViewModel('${n}', otherInstance);`;
    case 'list':     return `// ${prefix}.list('${n}').addInstance(itemInstance);`;
    default:         return `// ${prefix} — '${n}' (${prop.dataType})`;
  }
}

function vmPropFlutter(prop: { name: string; dataType: string }, prefix = 'vmi') {
  const n = prop.name;
  switch (prop.dataType) {
    case 'number':
    case 'integer':  return `${prefix}?.number('${n}')?.value = 0;`;
    case 'boolean':  return `${prefix}?.boolean('${n}')?.value = true;`;
    case 'string':   return `${prefix}?.string('${n}')?.value = 'your text';`;
    case 'trigger':  return `${prefix}?.trigger('${n}')?.trigger();`;
    case 'color':    return `${prefix}?.color('${n}')?.rgb(255, 0, 0);`;
    case 'enumType': return `${prefix}?.enum('${n}')?.value = 'EnumValue';`;
    default:         return `// ${prefix} — '${n}' (${prop.dataType})`;
  }
}

function vmPropSwift(prop: { name: string; dataType: string }, prefix = 'vmi') {
  const n = prop.name;
  switch (prop.dataType) {
    case 'number':
    case 'integer':  return `${prefix}?.number("${n}")?.value = 0`;
    case 'boolean':  return `${prefix}?.boolean("${n}")?.value = true`;
    case 'string':   return `${prefix}?.string("${n}")?.value = "your text"`;
    case 'trigger':  return `${prefix}?.trigger("${n}")?.trigger()`;
    case 'color':    return `${prefix}?.color("${n}")?.rgb(r: 255, g: 0, b: 0)`;
    case 'enumType': return `${prefix}?.enum("${n}")?.value = "EnumValue"`;
    default:         return `// ${prefix} — "${n}" (${prop.dataType})`;
  }
}

function vmPropKotlin(prop: { name: string; dataType: string }, prefix = 'vmi') {
  const n = prop.name;
  switch (prop.dataType) {
    case 'number':
    case 'integer':  return `${prefix}?.number("${n}")?.value = 0f`;
    case 'boolean':  return `${prefix}?.boolean("${n}")?.value = true`;
    case 'string':   return `${prefix}?.string("${n}")?.value = "your text"`;
    case 'trigger':  return `${prefix}?.trigger("${n}")?.trigger()`;
    case 'color':    return `${prefix}?.color("${n}")?.rgb(255, 0, 0)`;
    case 'enumType': return `${prefix}?.enum("${n}")?.value = "EnumValue"`;
    default:         return `// ${prefix} — "${n}" (${prop.dataType})`;
  }
}

// ── React ────────────────────────────────────────────────────────

function genReact(
  info: RiveFileInfo, ab: string, sm: string,
  threads: DiscussionThread[], showAnn: boolean,
  events: boolean, responsive: boolean, includeVM: boolean,
  fit: RiveFit, align: Align,
): string {
  const inputs = info.inputsByStateMachine[`${ab}::${sm}`] ?? [];
  const textRuns = info.textRunsByArtboard?.[ab] ?? [];
  const animations = info.animationsByArtboard?.[ab] ?? [];
  const viewModels = info.viewModels ?? [];
  const bools = inputs.filter(i => i.type === 'boolean');
  const nums  = inputs.filter(i => i.type === 'number');
  const trigs = inputs.filter(i => i.type === 'trigger');
  const smNote = showAnn ? getSMNote(threads, ab, sm) : '';

  const hasInputs = inputs.length > 0;
  const hasText   = textRuns.length > 0;
  const hasSM     = !!sm;
  const hasAnimOnly = !hasSM && animations.length > 0;
  const hasVMs    = includeVM && viewModels.length > 0;

  const specLine = `// — Prive spec —————————————————————————————————————————\n// File: ${info.fileName}${ab ? `  ·  Artboard: ${ab}` : ''}${sm ? `  ·  SM: ${sm}` : hasAnimOnly ? `  ·  Animation: ${animations[0]}` : ''}\n//\n// ——————————————————————————————————————————————————————`;

  const hooks = hasInputs
    ? inputs.map(i => `  const ${toCamel(i.name)} = useStateMachineInput(rive, '${sm}', '${i.name}');`).join('\n')
    : '';

  const inputUI = [
    ...trigs.map(i => {
      const note = showAnn ? getInputNote(threads, sm, i.name) : '';
      return `      {/* ${i.name}${note ? ` — ${note}` : ''} */}\n      <button onClick={() => ${toCamel(i.name)}?.fire()}>${i.name}</button>`;
    }),
    ...bools.map(i => {
      const note = showAnn ? getInputNote(threads, sm, i.name) : '';
      return `      {/* ${i.name}${note ? ` — ${note}` : ''} */}\n      <input type="checkbox" onChange={e => ${toCamel(i.name)} && (${toCamel(i.name)}.value = e.target.checked)} />`;
    }),
    ...nums.map(i => {
      const note = showAnn ? getInputNote(threads, sm, i.name) : '';
      return `      {/* ${i.name}${note ? ` — ${note}` : ''} */}\n      <input type="range" min={0} max={100} onChange={e => ${toCamel(i.name)} && (${toCamel(i.name)}.value = +e.target.value)} />`;
    }),
  ].join('\n\n');

  // Text runs — actual API call in useEffect
  const textRunEffect = hasText
    ? `\n  // Text runs — call after rive loads to update dynamic text\n  useEffect(() => {\n    if (!rive) return;\n${textRuns.map(r => `    rive.setTextRunValue('${r}', 'your text here'${ab ? `, '${ab}'` : ''});`).join('\n')}\n  }, [rive]);`
    : '';

  // Events
  const eventsEffect = events
    ? `\n  useEffect(() => {\n    if (!rive) return;\n    const onEvent = (e: any) => {\n      const { name, type, properties } = e.data ?? {};\n      console.log('Rive event:', name, '|', type, properties ?? '');\n    };\n    rive.on(EventType.RiveEvent, onEvent);\n    return () => rive.off(EventType.RiveEvent, onEvent);\n  }, [rive]);`
    : '';

  // Responsive
  const responsiveEffect = responsive
    ? `\n  useEffect(() => {\n    if (!rive) return;\n    const el = document.querySelector('.rive-wrap') as HTMLElement;\n    if (!el) return;\n    const ro = new ResizeObserver(() => rive.resizeDrawingSurfaceToCanvas());\n    ro.observe(el);\n    return () => ro.disconnect();\n  }, [rive]);`
    : '';

  // ViewModels — one useEffect per VM
  const vmEffects = hasVMs
    ? viewModels.map(vm => {
        const instLine = vm.instanceNames.length > 0
          ? `    // Named instances: ${vm.instanceNames.map(n => `'${n}'`).join(', ')}\n    const vmi = vm?.instanceByName('${vm.instanceNames[0]}') ?? vm?.defaultInstance();`
          : `    const vmi = vm?.defaultInstance();`;
        const propLines = vm.properties.length > 0
          ? '\n    if (!vmi) return;\n    rive.bindViewModelInstance(vmi);\n    // Mutate data props to drive the animation:\n' +
            vm.properties.map(p => `    // ${vmPropJS(p, 'vmi')}`).join('\n')
          : '\n    if (!vmi) return;\n    rive.bindViewModelInstance(vmi);';
        return `\n  // ViewModel: '${vm.name}'\n  useEffect(() => {\n    if (!rive) return;\n    const vm = (rive as any).viewModelByName('${vm.name}');\n${instLine}${propLines}\n  }, [rive]);`;
      }).join('\n')
    : '';

  const needsUseEffect = events || responsive || hasText || hasVMs;
  const extraImports   = needsUseEffect ? ', useEffect' : '';
  const layoutStr = `\n    layout: new Layout({\n      fit: Fit.${fit},\n      alignment: ${ALIGN_MAP[align]},\n    }),`;
  const smOrAnim = hasSM
    ? `\n    stateMachines: '${sm}',`
    : hasAnimOnly ? `\n    animations: '${animations[0]}',` : '';

  return `${specLine}

import { useRive${hasInputs ? ', useStateMachineInput' : ''}${extraImports}, Layout, Fit, Alignment } from '@rive-app/react-webgl2';${events ? `\nimport { EventType } from '@rive-app/webgl2';` : ''}
${smNote ? `\n// ${smNote}\n` : ''}
export default function RiveAnimation() {
  const { rive, RiveComponent } = useRive({
    src: '${info.fileName}',${ab ? `\n    artboard: '${ab}',` : ''}${smOrAnim}${layoutStr}
    autoplay: true,
  });
${hooks ? '\n' + hooks + '\n' : ''}${textRunEffect}${eventsEffect}${responsiveEffect}${vmEffects}
  return (
    <div${responsive ? ' className="rive-wrap" style={{ width: \'100%\', aspectRatio: \'1\' }}' : ''}>
      <RiveComponent style={{ width: ${responsive ? "'100%'" : '400'}, height: ${responsive ? "'100%'" : '400'} }} />
${inputUI ? '\n' + inputUI + '\n    ' : '    '}
    </div>
  );
}`;
}

// ── React Native ─────────────────────────────────────────────────

function genReactNative(
  info: RiveFileInfo, ab: string, sm: string,
  threads: DiscussionThread[], showAnn: boolean,
  events: boolean, responsive: boolean, includeVM: boolean,
  fit: RiveFit, align: Align,
): string {
  const inputs = info.inputsByStateMachine[`${ab}::${sm}`] ?? [];
  const textRuns = info.textRunsByArtboard?.[ab] ?? [];
  const animations = info.animationsByArtboard?.[ab] ?? [];
  const viewModels = info.viewModels ?? [];
  const bools = inputs.filter(i => i.type === 'boolean');
  const nums  = inputs.filter(i => i.type === 'number');
  const trigs = inputs.filter(i => i.type === 'trigger');
  const smNote = showAnn ? getSMNote(threads, ab, sm) : '';
  const hasSM      = !!sm;
  const hasAnimOnly = !hasSM && animations.length > 0;
  const hasInputs  = inputs.length > 0;
  const hasText    = textRuns.length > 0;
  const hasVMs     = includeVM && viewModels.length > 0;

  const specLine = `// — Prive spec —————————————————————————————————————————\n// File: ${info.fileName}${ab ? `  ·  Artboard: ${ab}` : ''}${sm ? `  ·  SM: ${sm}` : hasAnimOnly ? `  ·  Animation: ${animations[0]}` : ''}\n//\n// ——————————————————————————————————————————————————————`;

  // Collect which ViewModel property hooks are needed
  const allProps = viewModels.flatMap(vm => vm.properties);
  const vmHooks = hasVMs ? Array.from(new Set([
    'useViewModelInstance',
    ...(allProps.some(p => p.dataType === 'number' || p.dataType === 'integer') ? ['useRiveNumber'] : []),
    ...(allProps.some(p => p.dataType === 'boolean')  ? ['useRiveBoolean'] : []),
    ...(allProps.some(p => p.dataType === 'string')   ? ['useRiveString']  : []),
    ...(allProps.some(p => p.dataType === 'trigger')  ? ['useRiveTrigger'] : []),
    ...(allProps.some(p => p.dataType === 'color')    ? ['useRiveColor']   : []),
    ...(allProps.some(p => p.dataType === 'enumType') ? ['useRiveEnum']    : []),
  ])) : [];

  // Ref-based access is needed for SM inputs, text runs, or events when no VMs
  const needsRef = (hasInputs && !hasVMs) || hasText || events;
  const needsEffect = hasText || events;
  const extraHooks = [
    ...(needsRef ? ['useRive'] : []),
    ...vmHooks,
  ];

  const importLine = `import { RiveView, useRiveFile, Fit, Alignment${extraHooks.length ? ', ' + extraHooks.join(', ') : ''} } from '@rive-app/react-native';`;

  // SM inputs via ref (legacy — for files without ViewModels)
  const refSetup = needsRef ? `\n  const { riveViewRef, setHybridRef } = useRive();` : '';

  const inputHandlers = hasInputs && !hasVMs ? '\n' + [
    ...trigs.map(i => {
      const note = showAnn ? getInputNote(threads, sm, i.name) : '';
      return `  const fire${toPascal(i.name)} = () =>\n    riveViewRef?.fireState('${sm}', '${i.name}');${note ? ` // ${note}` : ''}`;
    }),
    ...bools.map(i => {
      const note = showAnn ? getInputNote(threads, sm, i.name) : '';
      return `  const set${toPascal(i.name)} = (v: boolean) =>\n    riveViewRef?.setInputState('${sm}', '${i.name}', v);${note ? ` // ${note}` : ''}`;
    }),
    ...nums.map(i => {
      const note = showAnn ? getInputNote(threads, sm, i.name) : '';
      return `  const set${toPascal(i.name)} = (v: number) =>\n    riveViewRef?.setInputState('${sm}', '${i.name}', v);${note ? ` // ${note}` : ''}`;
    }),
  ].join('\n') : '';

  const textRunEffect = hasText
    ? `\n\n  // Text runs\n  useEffect(() => {\n${textRuns.map(r => `    riveViewRef?.setTextRunValue('${r}', 'your text here');`).join('\n')}\n  }, [riveViewRef]);`
    : '';

  const eventsEffect = events
    ? `\n\n  // Events\n  useEffect(() => {\n    if (!riveViewRef) return;\n    riveViewRef.onEventListener((event: any) => {\n      console.log('Rive event:', event.name);\n    });\n    return () => riveViewRef.removeEventListeners?.();\n  }, [riveViewRef]);`
    : '';

  // ViewModel sections using the new data-binding hooks
  const vmSections = hasVMs
    ? '\n' + viewModels.map(vm => {
        const vn = toCamel(vm.name);
        const instArg = vm.instanceNames.length > 0
          ? `{ instanceName: '${vm.instanceNames[0]}' }`
          : '{}';
        const propHooks = vm.properties
          .map(p => {
            const pn = toCamel(p.name);
            const Pn = toPascal(p.name);
            const dt = p.dataType;
            if (dt === 'trigger')
              return `  const { trigger: ${pn} } = useRiveTrigger('${p.name}', ${vn}Instance);`;
            if (dt === 'number' || dt === 'integer')
              return `  const { value: ${pn}, setValue: set${Pn} } = useRiveNumber('${p.name}', ${vn}Instance);`;
            if (dt === 'boolean')
              return `  const { value: ${pn}, setValue: set${Pn} } = useRiveBoolean('${p.name}', ${vn}Instance);`;
            if (dt === 'string')
              return `  const { value: ${pn}, setValue: set${Pn} } = useRiveString('${p.name}', ${vn}Instance);`;
            if (dt === 'color')
              return `  const { value: ${pn}, setValue: set${Pn} } = useRiveColor('${p.name}', ${vn}Instance);`;
            if (dt === 'enumType')
              return `  const { value: ${pn}, setValue: set${Pn} } = useRiveEnum('${p.name}', ${vn}Instance);`;
            return `  // ${vn}Instance.${pn} — ${dt} (not yet directly bindable)`;
          })
          .join('\n');
        return `\n  // ViewModel: '${vm.name}'\n  const { instance: ${vn}Instance } = useViewModelInstance(riveFile, ${instArg});\n${propHooks}`;
      }).join('\n')
    : '';

  const smOrAnim = hasSM
    ? `\n        stateMachineName="${sm}"`
    : hasAnimOnly ? `\n        animationName="${animations[0]}"` : '';

  const refProp = needsRef ? `\n        ref={setHybridRef}` : '';

  return `${specLine}

import React${needsEffect ? ', { useEffect }' : ''} from 'react';
import { View, StyleSheet${hasInputs && !hasVMs ? ', TouchableOpacity, Text' : ''} } from 'react-native';
${importLine}
${smNote ? `\n// ${smNote}\n` : ''}
export default function RiveAnimation() {
  const { riveFile } = useRiveFile(require('./assets/${info.fileName}'));${refSetup}${inputHandlers}${vmSections}${textRunEffect}${eventsEffect}

  return (
    <View style={styles.container}>
      <RiveView
        file={riveFile}${ab ? `\n        artboardName="${ab}"` : ''}${smOrAnim}
        fit={Fit.${fit}}
        alignment={${ALIGN_MAP[align]}}
        autoPlay${refProp}
        style={styles.rive}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1${`${responsive ? '' : ", alignItems: 'center', justifyContent: 'center'"}`} },
  rive: ${responsive ? "{ flex: 1, width: '100%' }" : '{ width: 400, height: 400 }'},
});`;
}

// ── Vanilla JS ───────────────────────────────────────────────────

function genJS(
  info: RiveFileInfo, ab: string, sm: string,
  threads: DiscussionThread[], showAnn: boolean,
  events: boolean, responsive: boolean, includeVM: boolean,
  fit: RiveFit, align: Align,
): string {
  const inputs = info.inputsByStateMachine[`${ab}::${sm}`] ?? [];
  const textRuns = info.textRunsByArtboard?.[ab] ?? [];
  const animations = info.animationsByArtboard?.[ab] ?? [];
  const viewModels = info.viewModels ?? [];
  const smNote = showAnn ? getSMNote(threads, ab, sm) : '';
  const hasSM = !!sm;
  const hasAnimOnly = !hasSM && animations.length > 0;
  const hasVMs = includeVM && viewModels.length > 0;

  const specLine = `// — Prive spec —————————————————————————————————————————\n// File: ${info.fileName}${ab ? `  ·  Artboard: ${ab}` : ''}${sm ? `  ·  SM: ${sm}` : hasAnimOnly ? `  ·  Animation: ${animations[0]}` : ''}\n//\n// ——————————————————————————————————————————————————————`;

  const inputVars = inputs.map(i => `    const ${toCamel(i.name)} = inputs.find(i => i.name === '${i.name}');`).join('\n');
  const inputUsage = inputs.map(i => {
    const note = showAnn ? getInputNote(threads, sm, i.name) : '';
    if (i.type === 'boolean') return `    // ${i.name}${note ? ` — ${note}` : ''}\n    ${toCamel(i.name)}.value = true;`;
    if (i.type === 'number')  return `    // ${i.name}${note ? ` — ${note}` : ''}\n    ${toCamel(i.name)}.value = 50;`;
    return `    // ${i.name}${note ? ` — ${note}` : ''}\n    ${toCamel(i.name)}.fire();`;
  }).join('\n\n');

  const textRunLines = textRuns.length > 0
    ? `\n\n    // Text runs — update dynamic text\n${textRuns.map(r => `    r.setTextRunValue('${r}', 'your text here'${ab ? `, '${ab}'` : ''});`).join('\n')}`
    : '';

  const eventsStr = events
    ? `\n\n    r.on(EventType.RiveEvent, e => {\n      const { name, type, properties } = e.data ?? {};\n      console.log('Rive event:', name, '|', type, properties ?? '');\n    });`
    : '';

  const vmLines = hasVMs
    ? '\n\n' + viewModels.map(vm => {
        const instLine = vm.instanceNames.length > 0
          ? `    // Named instances: ${vm.instanceNames.map(n => `'${n}'`).join(', ')}\n    const ${toCamel(vm.name)}Vmi = ${toCamel(vm.name)}Vm?.instanceByName('${vm.instanceNames[0]}') ?? ${toCamel(vm.name)}Vm?.defaultInstance();`
          : `    const ${toCamel(vm.name)}Vmi = ${toCamel(vm.name)}Vm?.defaultInstance();`;
        const propLines = vm.properties.length > 0
          ? `\n    if (${toCamel(vm.name)}Vmi) {\n      r.bindViewModelInstance(${toCamel(vm.name)}Vmi);\n      // Mutate data props to drive the animation:\n` +
            vm.properties.map(p => `      // ${vmPropJS(p, `${toCamel(vm.name)}Vmi`)}`).join('\n') + '\n    }'
          : `\n    if (${toCamel(vm.name)}Vmi) r.bindViewModelInstance(${toCamel(vm.name)}Vmi);`;
        return `    // ViewModel: '${vm.name}'\n    const ${toCamel(vm.name)}Vm = r.viewModelByName('${vm.name}');\n${instLine}${propLines}`;
      }).join('\n\n')
    : '';

  const smOrAnim = hasSM
    ? `\n  stateMachines: '${sm}',`
    : hasAnimOnly ? `\n  animations: '${animations[0]}',` : '';

  const responsiveStr = responsive ? `\nnew ResizeObserver(() => r.resizeDrawingSurfaceToCanvas()).observe(canvas);` : '';

  return `${specLine}

import { Rive, Layout, Fit, Alignment${events ? ', EventType' : ''} } from '@rive-app/webgl2';
${smNote ? `\n// ${smNote}\n` : ''}
const canvas = document.getElementById('canvas');
const r = new Rive({
  src: '${info.fileName}',${ab ? `\n  artboard: '${ab}',` : ''}${smOrAnim}
  layout: new Layout({
    fit: Fit.${fit},
    alignment: ${ALIGN_MAP[align]},
  }),
  canvas,
  autoplay: true,
  onLoad: () => {${inputs.length ? `\n    const inputs = r.stateMachineInputs('${sm}');\n${inputVars}\n\n${inputUsage}` : ''}${textRunLines}${eventsStr}${vmLines}
  },
});${responsiveStr}`;
}

// ── HTML (CDN) ───────────────────────────────────────────────────

function genHTML(
  info: RiveFileInfo, ab: string, sm: string,
  threads: DiscussionThread[], showAnn: boolean,
  events: boolean, responsive: boolean, includeVM: boolean,
  fit: RiveFit, align: Align,
): string {
  const inputs = info.inputsByStateMachine[`${ab}::${sm}`] ?? [];
  const textRuns = info.textRunsByArtboard?.[ab] ?? [];
  const animations = info.animationsByArtboard?.[ab] ?? [];
  const viewModels = info.viewModels ?? [];
  const smNote = showAnn ? getSMNote(threads, ab, sm) : '';
  const hasSM = !!sm;
  const hasAnimOnly = !hasSM && animations.length > 0;
  const hasVMs = includeVM && viewModels.length > 0;
  const specComment = `<!-- Prive spec ————————————————————————————————————\n     File: ${info.fileName}${ab ? `  ·  Artboard: ${ab}` : ''}${sm ? `  ·  SM: ${sm}` : hasAnimOnly ? `  ·  Animation: ${animations[0]}` : ''}${smNote ? `\n     ${smNote}` : ''}\n     ——————————————————————————————————————————————— -->`;

  const inputVars = inputs.map(i => {
    const note = showAnn ? getInputNote(threads, sm, i.name) : '';
    return `      const ${toCamel(i.name)} = inputs.find(i => i.name === '${i.name}');${note ? ` // ${note}` : ''}`;
  }).join('\n');

  const textRunLines = textRuns.length > 0
    ? `\n\n        // Text runs\n${textRuns.map(r => `        r.setTextRunValue('${r}', 'your text here'${ab ? `, '${ab}'` : ''});`).join('\n')}`
    : '';

  const eventsStr = events
    ? `\n\n        r.on(rive.EventType.RiveEvent, function(e) {\n          var d = e.data || {};\n          console.log('Rive event:', d.name, '|', d.type, d.properties || '');\n        });`
    : '';

  const vmLines = hasVMs
    ? '\n\n' + viewModels.map(vm => {
        const vn = toCamel(vm.name);
        const instLine = vm.instanceNames.length > 0
          ? `        var ${vn}Vmi = ${vn}Vm.instanceByName('${vm.instanceNames[0]}') || ${vn}Vm.defaultInstance();`
          : `        var ${vn}Vmi = ${vn}Vm.defaultInstance();`;
        const propLines = vm.properties.map(p => `        // ${vmPropJS(p, `${vn}Vmi`)}`).join('\n');
        return `        // ViewModel: '${vm.name}'\n        var ${vn}Vm = r.viewModelByName('${vm.name}');\n${instLine}\n        if (${vn}Vmi) {\n          r.bindViewModelInstance(${vn}Vmi);\n          // Mutate data props to drive the animation:\n${propLines}\n        }`;
      }).join('\n\n')
    : '';

  const smOrAnim = hasSM
    ? `\n      stateMachines: '${sm}',`
    : hasAnimOnly ? `\n      animations: '${animations[0]}',` : '';

  const responsiveStyle = responsive
    ? `\n  <style>\n    #canvas { display: block; width: 100%; aspect-ratio: 1 / 1; height: auto; }\n  </style>`
    : '';
  const responsiveObserver = responsive
    ? `\n    new ResizeObserver(function() { r.resizeDrawingSurfaceToCanvas(); }).observe(canvas);`
    : '';

  return `${specComment}
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">${responsiveStyle}
</head>
<body>
  <canvas id="canvas"${responsive ? '' : ' width="400" height="400"'}></canvas>
  <script src="https://unpkg.com/@rive-app/webgl2@latest/rive.js"></script>
  <script>
    var canvas = document.getElementById('canvas');
    var r = new rive.Rive({
      src: '${info.fileName}',${ab ? `\n      artboard: '${ab}',` : ''}${smOrAnim}
      layout: new rive.Layout({
        fit: rive.Fit.${fit},
        alignment: rive.${ALIGN_MAP[align]},
      }),
      canvas: canvas,
      autoplay: true,
      onLoad: function() {${inputs.length ? `\n        var inputs = r.stateMachineInputs('${sm}');\n${inputVars}` : ''}${textRunLines}${eventsStr}${vmLines}
      },
    });${responsiveObserver}
  </script>
</body>
</html>`;
}

// ── Flutter ──────────────────────────────────────────────────────

function genFlutter(
  info: RiveFileInfo, ab: string, sm: string,
  threads: DiscussionThread[], showAnn: boolean,
  events: boolean, responsive: boolean, includeVM: boolean,
  fit: RiveFit, align: Align,
): string {
  const inputs = info.inputsByStateMachine[`${ab}::${sm}`] ?? [];
  const textRuns = info.textRunsByArtboard?.[ab] ?? [];
  const animations = info.animationsByArtboard?.[ab] ?? [];
  const viewModels = info.viewModels ?? [];
  const bools = inputs.filter(i => i.type === 'boolean');
  const nums  = inputs.filter(i => i.type === 'number');
  const trigs = inputs.filter(i => i.type === 'trigger');
  const smNote = showAnn ? getSMNote(threads, ab, sm) : '';
  const hasSM = !!sm;
  const hasAnimOnly = !hasSM && animations.length > 0;
  const hasVMs = includeVM && viewModels.length > 0;
  const name = toPascal(info.fileName.replace(/\.riv$/i, '').replace(/[^a-zA-Z0-9]/g, '_'));
  const specLine = `// — Prive spec —————————————————————————————————————————\n// File: ${info.fileName}${ab ? `  ·  Artboard: ${ab}` : ''}${sm ? `  ·  SM: ${sm}` : hasAnimOnly ? `  ·  Animation: ${animations[0]}` : ''}\n//\n// ——————————————————————————————————————————————————————`;

  const fields = [
    ...bools.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `  SMIBool? ${toCamel(i.name)};${note ? ` // ${note}` : ''}`; }),
    ...nums.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `  SMINumber? ${toCamel(i.name)};${note ? ` // ${note}` : ''}`; }),
    ...trigs.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `  SMITrigger? ${toCamel(i.name)};${note ? ` // ${note}` : ''}`; }),
  ].join('\n');

  const vmFields = hasVMs
    ? viewModels.map(vm => `  ViewModelInstance? ${toCamel(vm.name)}Instance;`).join('\n')
    : '';

  const assigns = [
    ...bools.map(i => `    ${toCamel(i.name)} = ctrl.findInput<bool>('${i.name}') as SMIBool;`),
    ...nums.map(i => `    ${toCamel(i.name)} = ctrl.findInput<double>('${i.name}') as SMINumber;`),
    ...trigs.map(i => `    ${toCamel(i.name)} = ctrl.findInput<void>('${i.name}') as SMITrigger;`),
  ].join('\n');

  const textRunLines = textRuns.length > 0
    ? `\n    // Text runs — update dynamic text\n${textRuns.map(r => `    artboard.setTextRunValue('${r}', 'your text here');`).join('\n')}`
    : '';

  const eventsStr = events
    ? `\n\n    ctrl?.addEventListener(onStateChange: (String sm, String state) {\n      debugPrint('State: \$sm → \$state');\n    });`
    : '';

  const vmLines = hasVMs
    ? '\n\n    // ViewModels — data binding\n' + viewModels.map(vm => {
        const vn = toCamel(vm.name);
        const instLine = vm.instanceNames.length > 0
          ? `    final ${vn}Vm = riveFile.viewModelByName('${vm.name}');\n    ${vn}Instance = ${vn}Vm?.instanceByName('${vm.instanceNames[0]}') ?? ${vn}Vm?.defaultInstance(riveFile);`
          : `    final ${vn}Vm = riveFile.viewModelByName('${vm.name}');\n    ${vn}Instance = ${vn}Vm?.defaultInstance(riveFile);`;
        const propLines = vm.properties.map(p => `    // ${vmPropFlutter(p, `${vn}Instance`)}`).join('\n');
        return `    // ViewModel: '${vm.name}'\n${instLine}\n    if (${vn}Instance != null) {\n      artboard.addViewModelInstance(${vn}Instance!);\n      // Mutate data props to drive the animation:\n${propLines}\n    }`;
      }).join('\n\n')
    : '';

  const smSection = hasSM
    ? `\n    final ctrl = StateMachineController.fromArtboard(artboard, '${sm}');\n    if (ctrl == null) return;\n    artboard.addController(ctrl);\n${assigns}${textRunLines}${eventsStr}${vmLines}`
    : hasAnimOnly
      ? `\n    final ctrl = SimpleAnimation('${animations[0]}');\n    artboard.addController(ctrl);${textRunLines}${vmLines}`
      : `${textRunLines}${vmLines}`;

  const allFields = [fields, vmFields].filter(Boolean).join('\n');

  return `${specLine}

import 'package:flutter/material.dart';
import 'package:rive/rive.dart';
${smNote ? `\n// ${smNote}\n` : ''}
class ${name}Animation extends StatefulWidget {
  const ${name}Animation({super.key});
  @override State<${name}Animation> createState() => _${name}State();
}

class _${name}State extends State<${name}Animation> {
${allFields || '  // No inputs or ViewModels defined'}
${hasVMs ? '  late RiveFile riveFile;\n' : ''}
  void _onInit(Artboard artboard) {${smSection}
  }

  @override
  Widget build(BuildContext context) {
    final animation = RiveAnimation.asset(
      'assets/${info.fileName}',${ab ? `\n      artboard: '${ab}',` : ''}${hasSM ? `\n      stateMachines: const ['${sm}'],` : hasAnimOnly ? `\n      animations: const ['${animations[0]}'],` : ''}
      fit: ${FLUTTER_FIT_MAP[fit]},
      alignment: ${FLUTTER_FIT_MAP[align] ? FLUTTER_FIT_MAP[align] : 'Alignment.center'},
      onInit: _onInit,
    );
    return ${responsive
      ? 'SizedBox.expand(child: animation);'
      : 'SizedBox(width: 400, height: 400, child: animation);'}
  }
}`;
}

// ── Swift ────────────────────────────────────────────────────────

function genSwift(
  info: RiveFileInfo, ab: string, sm: string,
  threads: DiscussionThread[], showAnn: boolean,
  events: boolean, responsive: boolean, includeVM: boolean,
  fit: RiveFit, align: Align,
): string {
  const inputs = info.inputsByStateMachine[`${ab}::${sm}`] ?? [];
  const textRuns = info.textRunsByArtboard?.[ab] ?? [];
  const animations = info.animationsByArtboard?.[ab] ?? [];
  const viewModels = info.viewModels ?? [];
  const bools = inputs.filter(i => i.type === 'boolean');
  const nums  = inputs.filter(i => i.type === 'number');
  const trigs = inputs.filter(i => i.type === 'trigger');
  const smNote = showAnn ? getSMNote(threads, ab, sm) : '';
  const hasSM = !!sm;
  const hasAnimOnly = !hasSM && animations.length > 0;
  const hasVMs = includeVM && viewModels.length > 0;
  const assetName = info.fileName.replace(/\.riv$/i, '');
  const specLine = `// — Prive spec —————————————————————————————————————————\n// File: ${info.fileName}${ab ? `  ·  Artboard: ${ab}` : ''}${sm ? `  ·  SM: ${sm}` : hasAnimOnly ? `  ·  Animation: ${animations[0]}` : ''}\n//\n// ——————————————————————————————————————————————————————`;

  const inputLines = [
    ...bools.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `    ${note ? `// ${note}\n    ` : ''}rvm.setInput("${i.name}", value: true)`; }),
    ...nums.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `    ${note ? `// ${note}\n    ` : ''}rvm.setInput("${i.name}", value: 50.0)`; }),
    ...trigs.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `    ${note ? `// ${note}\n    ` : ''}rvm.triggerInput("${i.name}")`; }),
  ].join('\n');

  const textRunLines = textRuns.length > 0
    ? `\n    // Text runs\n${textRuns.map(r => `    rvm.setTextRun("${r}", textValue: "your text here")`).join('\n')}`
    : '';

  const eventsStr = events
    ? `\n    rvm.on(.stateChange) { machine, state in\n      print("State: \\(machine) → \\(state)")\n    }\n    rvm.on(.riveEvent) { event in\n      print("Rive event:", event.name)\n    }`
    : '';

  const vmLines = hasVMs
    ? '\n\n    // ViewModels — data binding\n' + viewModels.map(vm => {
        const vn = toCamel(vm.name);
        const instLine = vm.instanceNames.length > 0
          ? `    let ${vn}Vm = rvm.riveModel?.file?.viewModelByName("${vm.name}")\n    let ${vn}Vmi = ${vn}Vm?.instanceByName("${vm.instanceNames[0]}") ?? ${vn}Vm?.defaultInstance()`
          : `    let ${vn}Vm = rvm.riveModel?.file?.viewModelByName("${vm.name}")\n    let ${vn}Vmi = ${vn}Vm?.defaultInstance()`;
        const propLines = vm.properties.map(p => `    // ${vmPropSwift(p, `${vn}Vmi`)}`).join('\n');
        return `    // ViewModel: '${vm.name}'\n${instLine}\n    if let ${vn}Vmi {\n      rvm.riveModel?.artboard?.bindViewModelInstance(${vn}Vmi)\n      // Mutate data props to drive the animation:\n${propLines}\n    }`;
      }).join('\n\n')
    : '';

  const hasConfigure = inputs.length > 0 || events || textRuns.length > 0 || hasVMs;

  return `${specLine}

import SwiftUI
import RiveRuntime
${smNote ? `\n// ${smNote}\n` : ''}
struct ContentView: View {
  @StateObject private var rvm = RiveViewModel(
    fileName: "${assetName}",${ab ? `\n    artboardName: "${ab}",` : ''}${hasSM ? `\n    stateMachineName: "${sm}",` : hasAnimOnly ? `\n    animationName: "${animations[0]}",` : ''}
    fit: .${fit},
    alignment: .${SWIFT_ALIGN_MAP[align]}
  )

  var body: some View {
    rvm.view()
      ${responsive ? '.frame(maxWidth: .infinity, maxHeight: .infinity)' : '.frame(width: 400, height: 400)'}${hasConfigure ? `\n      .onAppear { configure() }` : ''}
  }
${hasConfigure ? `\n  private func configure() {\n${inputLines}${textRunLines}${eventsStr}${vmLines}\n  }` : ''}
}`;
}

// ── Kotlin ───────────────────────────────────────────────────────

function genKotlin(
  info: RiveFileInfo, ab: string, sm: string,
  threads: DiscussionThread[], showAnn: boolean,
  events: boolean, responsive: boolean, includeVM: boolean,
  fit: RiveFit, align: Align,
): string {
  const inputs = info.inputsByStateMachine[`${ab}::${sm}`] ?? [];
  const textRuns = info.textRunsByArtboard?.[ab] ?? [];
  const animations = info.animationsByArtboard?.[ab] ?? [];
  const viewModels = info.viewModels ?? [];
  const bools = inputs.filter(i => i.type === 'boolean');
  const nums  = inputs.filter(i => i.type === 'number');
  const trigs = inputs.filter(i => i.type === 'trigger');
  const smNote = showAnn ? getSMNote(threads, ab, sm) : '';
  const hasSM = !!sm;
  const hasAnimOnly = !hasSM && animations.length > 0;
  const hasVMs = includeVM && viewModels.length > 0;
  const assetName = info.fileName.replace(/\.riv$/i, '').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  const specLine = `// — Prive spec —————————————————————————————————————————\n// File: ${info.fileName}${ab ? `  ·  Artboard: ${ab}` : ''}${sm ? `  ·  SM: ${sm}` : hasAnimOnly ? `  ·  Animation: ${animations[0]}` : ''}\n//\n// ——————————————————————————————————————————————————————`;

  const inputLines = [
    ...bools.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `    ${note ? `// ${note}\n    ` : ''}riveView.setBooleanState("${sm}", "${i.name}", true)`; }),
    ...nums.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `    ${note ? `// ${note}\n    ` : ''}riveView.setNumberState("${sm}", "${i.name}", 50f)`; }),
    ...trigs.map(i => { const note = showAnn ? getInputNote(threads, sm, i.name) : ''; return `    ${note ? `// ${note}\n    ` : ''}riveView.fireState("${sm}", "${i.name}")`; }),
  ].join('\n');

  const textRunLines = textRuns.length > 0
    ? `\n\n    // Text runs\n${textRuns.map(r => `    riveView.setTextRunValue("${r}", "your text here"${ab ? `, "${ab}"` : ''})`).join('\n')}`
    : '';

  const eventsStr = events
    ? `\n\n    riveView.addEventListener(object : RiveFileController.Listener {\n      override fun notifyPlay(animation: PlayableInstance) = Unit\n      override fun notifyPause(animation: PlayableInstance) = Unit\n      override fun notifyStop(animation: PlayableInstance) = Unit\n      override fun notifyLoop(animation: PlayableInstance) = Unit\n      override fun notifyStateChanged(sm: String, state: String) {\n        Log.d("Rive", "State: \$sm → \$state")\n      }\n    })`
    : '';

  const vmLines = hasVMs
    ? '\n\n    // ViewModels — data binding\n' + viewModels.map(vm => {
        const vn = toCamel(vm.name);
        const instLine = vm.instanceNames.length > 0
          ? `    val ${vn}Vmi = ${vn}Vm?.instanceByName("${vm.instanceNames[0]}") ?: ${vn}Vm?.defaultInstance(file)`
          : `    val ${vn}Vmi = ${vn}Vm?.defaultInstance(file)`;
        const propLines = vm.properties.map(p => `    // ${vmPropKotlin(p, `${vn}Vmi`)}`).join('\n');
        return `    // ViewModel: '${vm.name}'\n    val file = riveView.controller.file ?: return\n    val ${vn}Vm = file.viewModelByName("${vm.name}")\n${instLine}\n    ${vn}Vmi?.let { vmi ->\n      riveView.controller.artboard?.bindViewModelInstance(vmi)\n      // Mutate data props to drive the animation:\n${propLines}\n    }`;
      }).join('\n\n')
    : '';

  const smOrAnim = hasSM
    ? `\n      stateMachineName = "${sm}",`
    : hasAnimOnly ? `\n      animationName = "${animations[0]}",` : '';

  const responsiveKotlin = responsive
    ? `\n    // Fill the parent container — set match_parent in your XML layout, or:\n    riveView.layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)`
    : '';

  return `${specLine}

import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import androidx.appcompat.app.AppCompatActivity
import app.rive.runtime.kotlin.RiveAnimationView${events ? `\nimport app.rive.runtime.kotlin.core.PlayableInstance\nimport app.rive.runtime.kotlin.core.RiveFileController` : ''}
${smNote ? `\n// ${smNote}\n` : ''}
class MainActivity : AppCompatActivity() {
  private lateinit var riveView: RiveAnimationView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    riveView = findViewById(R.id.rive_view)
    riveView.setRiveResource(
      R.raw.${assetName},${ab ? `\n      artboardName = "${ab}",` : ''}${smOrAnim}
      fit = Fit.${fit.toUpperCase()},
      alignment = Alignment.${KOTLIN_ALIGN_MAP[align]}
    )${responsiveKotlin}
${inputLines ? '\n' + inputLines : ''}${textRunLines}${eventsStr}${vmLines}
  }
}`;
}

// ── Syntax highlighter ───────────────────────────────────────────

function highlightLine(raw: string, lang: CodeFramework): string {
  let s = esc(raw);
  s = s.replace(/(\/\/[^<]*)$/, '<span class="t-c">$1</span>');
  s = s.replace(/(&#39;[^<]*?&#39;|&quot;[^<]*?&quot;)/g, '<span class="t-s">$1</span>');
  if (lang === 'react' || lang === 'rn' || lang === 'js' || lang === 'html') {
    s = s.replace(/\b(import|export|from|const|let|var|function|return|default|new|if|else|async|await|type|class|extends)\b/g, '<span class="t-k">$1</span>');
    s = s.replace(/\b(useRive|useRiveFile|useStateMachineInput|useViewModelInstance|useRiveNumber|useRiveBoolean|useRiveString|useRiveTrigger|useRiveColor|useRiveEnum|useEffect|useCallback|RiveView|RiveComponent|Rive|EventType|useState|useRef|Layout|Fit|Alignment|StyleSheet|View)\b/g, '<span class="t-n">$1</span>');
  } else if (lang === 'flutter') {
    s = s.replace(/\b(import|class|extends|void|final|const|return|if|null|true|false|async|await|super|this|override|String|bool|double|int|late)\b/g, '<span class="t-k">$1</span>');
    s = s.replace(/\b(StateMachineController|SimpleAnimation|RiveAnimation|SMIBool|SMINumber|SMITrigger|Artboard|BuildContext|Widget|State|ViewModelInstance|RiveFile)\b/g, '<span class="t-n">$1</span>');
  } else if (lang === 'swift') {
    s = s.replace(/\b(import|struct|class|var|let|func|private|return|if|true|false|nil|guard)\b/g, '<span class="t-k">$1</span>');
    s = s.replace(/\b(RiveViewModel|View|StateObject|ContentView|SwiftUI|RiveRuntime)\b/g, '<span class="t-n">$1</span>');
  } else if (lang === 'kotlin') {
    s = s.replace(/\b(import|class|override|fun|val|var|private|lateinit|super|object|true|false|null|return|if|else|let)\b/g, '<span class="t-k">$1</span>');
    s = s.replace(/\b(AppCompatActivity|RiveAnimationView|Bundle|Log|RiveFileController|PlayableInstance)\b/g, '<span class="t-n">$1</span>');
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

const FRAMEWORKS: { key: CodeFramework; label: string; pkg: string; installLabel: string; installCmd: string | null }[] = [
  { key: 'react',   label: 'React',         pkg: '@rive-app/react-webgl2', installLabel: 'npm',    installCmd: 'npm i @rive-app/react-webgl2' },
  { key: 'rn',      label: 'React Native',  pkg: '@rive-app/react-native', installLabel: 'npm',    installCmd: 'npm i @rive-app/react-native react-native-nitro-modules' },
  { key: 'js',      label: 'Vanilla JS',    pkg: '@rive-app/webgl2',       installLabel: 'npm',    installCmd: 'npm i @rive-app/webgl2' },
  { key: 'flutter', label: 'Flutter',       pkg: 'rive',                   installLabel: 'pub',    installCmd: 'flutter pub add rive' },
  { key: 'swift',   label: 'Swift',         pkg: 'rive-ios',               installLabel: 'SPM',    installCmd: 'https://github.com/rive-app/rive-ios' },
  { key: 'kotlin',  label: 'Kotlin',        pkg: 'rive-android',           installLabel: 'gradle', installCmd: "implementation('app.rive.runtime.kotlin:core:+')" },
  { key: 'html',    label: 'HTML',          pkg: 'CDN',                    installLabel: 'CDN',    installCmd: null },
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
  const [includeVM, setIncludeVM] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedPkg, setCopiedPkg] = useState(false);

  const hasVMs = (info.viewModels ?? []).length > 0;
  const currentFW = FRAMEWORKS.find(f => f.key === fw)!;
  const supportsResponsive = true;

  const code =
    fw === 'react'   ? genReact(info, selectedArtboard, selectedSM, threads, showAnnotations, events, responsive, includeVM, fit, align)                  :
    fw === 'rn'      ? genReactNative(info, selectedArtboard, selectedSM, threads, showAnnotations, events, responsive, includeVM, fit, align)             :
    fw === 'js'      ? genJS(info, selectedArtboard, selectedSM, threads, showAnnotations, events, responsive, includeVM, fit, align)                      :
    fw === 'flutter' ? genFlutter(info, selectedArtboard, selectedSM, threads, showAnnotations, events, responsive, includeVM, fit, align)                 :
    fw === 'swift'   ? genSwift(info, selectedArtboard, selectedSM, threads, showAnnotations, events, responsive, includeVM, fit, align)                   :
    fw === 'kotlin'  ? genKotlin(info, selectedArtboard, selectedSM, threads, showAnnotations, events, responsive, includeVM, fit, align)                  :
                       genHTML(info, selectedArtboard, selectedSM, threads, showAnnotations, events, responsive, includeVM, fit, align);

  const fname =
    fw === 'react'   ? 'RiveAnimation.tsx'       :
    fw === 'rn'      ? 'RiveAnimation.native.tsx' :
    fw === 'js'      ? 'animation.js'            :
    fw === 'flutter' ? 'rive_animation.dart'     :
    fw === 'swift'   ? 'ContentView.swift'       :
    fw === 'kotlin'  ? 'MainActivity.kt'         :
                       'index.html';

  const langLabel =
    fw === 'react'   ? 'TSX'  :
    fw === 'rn'      ? 'TSX'  :
    fw === 'js'      ? 'JS'   :
    fw === 'flutter' ? 'DART' :
    fw === 'swift'   ? 'SWIFT':
    fw === 'kotlin'  ? 'KT'   :
                       'HTML';

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const copyPkg = async () => {
    const cmd = currentFW.installCmd;
    if (!cmd) return;
    await navigator.clipboard.writeText(cmd);
    setCopiedPkg(true);
    setTimeout(() => setCopiedPkg(false), 1800);
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

      {/* Install command bar — mirrors how Rive docs always lead with the install step */}
      {currentFW.installCmd ? (
        <div className="code-install-bar">
          <span className="code-install-label">{currentFW.installLabel}</span>
          <code className="code-install-cmd">$ {currentFW.installCmd}</code>
          <button
            className="code-install-copy"
            data-copied={copiedPkg ? '1' : '0'}
            onClick={copyPkg}
            title="Copy install command"
          >
            {copiedPkg ? '✓ copied' : 'copy'}
          </button>
        </div>
      ) : (
        <div className="code-install-bar code-install-cdn">
          <span className="code-install-label">CDN</span>
          <code className="code-install-cmd">No install needed — script tag included in the snippet below</code>
        </div>
      )}

      <div className="code-toolbar">
        <button className="code-opt" data-on={showAnnotations ? '1' : '0'} onClick={() => setShowAnnotations(v => !v)}>
          Annotations
        </button>
        <button className="code-opt" data-on={events ? '1' : '0'} onClick={() => setEvents(v => !v)}>
          Events
        </button>
        {supportsResponsive && (
          <button className="code-opt" data-on={responsive ? '1' : '0'} onClick={() => setResponsive(v => !v)}>
            Responsive
          </button>
        )}
        {hasVMs && (
          <button className="code-opt" data-on={includeVM ? '1' : '0'} onClick={() => setIncludeVM(v => !v)}>
            ViewModels
          </button>
        )}
        <Select
          value={fit}
          options={FIT_OPTS}
          onChange={v => onFitChange(v as RiveFit)}
          title="Fit mode"
        />
      </div>

      <div className="code-fn-bar">
        <span className={`code-lang-tag code-lang-${fw}`}>{langLabel}</span>
        <span className="code-fname">{fname}</span>
        <div className="code-fn-actions">
          <button className="code-dl-btn" onClick={download} title="Download file">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button className="code-copy-btn" onClick={copy}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <CodeBlock code={code} lang={fw} />
    </div>
  );
}
