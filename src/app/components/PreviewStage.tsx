import { useRef, useState } from 'react';
import { Rive } from '@rive-app/webgl2';
import { RiveFileInfo } from '../types';
import { RiveCanvas } from './RiveCanvas';
import { BgMode, RiveFit } from '../types';

function isRiveBinary(buf: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buf, 0, 4);
  return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x56 && bytes[3] === 0x45;
}

interface Props {
  buffer: ArrayBuffer | null;
  artboard: string;
  stateMachine: string;
  bgMode: BgMode;
  align: string;
  fit: RiveFit;
  fileKey: string;
  onInfoExtracted: (info: Omit<RiveFileInfo, 'fileName' | 'fileSize'>) => void;
  onRiveReady: (r: Rive) => void;
  onFile: (f: File, buf: ArrayBuffer) => void;
}

export function PreviewStage({ buffer, artboard, stateMachine, bgMode, align, fit, fileKey, onInfoExtracted, onRiveReady, onFile }: Props) {
  const [dragging, setDragging] = useState(false);
  const [dropError, setDropError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (f: File) => {
    setDropError('');
    const buf = await f.arrayBuffer();
    if (!isRiveBinary(buf)) {
      setDropError('Not a valid .riv file.');
      return;
    }
    onFile(f, buf);
  };

  const bgClass = bgMode === 'white' ? ' bg-white' : bgMode === 'black' ? ' bg-black' : '';

  return (
    <>
      <div
        className={`preview-stage${bgClass}${dragging ? ' hovering' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) load(f); else setDropError(''); }}
        onClick={() => !buffer && inputRef.current?.click()}
      >
        {buffer ? (
          <RiveCanvas
            key={fileKey}
            buffer={buffer}
            artboard={artboard}
            stateMachine={stateMachine}
            align={align}
            fit={fit}
            onInfoExtracted={onInfoExtracted}
            onRiveReady={onRiveReady}
            bgColor="transparent"
          />
        ) : (
          <div className="stage-prompt">
            {dropError
              ? <p className="stage-err">{dropError}</p>
              : <div className="spinner" />
            }
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept=".riv" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); }} />
    </>
  );
}
