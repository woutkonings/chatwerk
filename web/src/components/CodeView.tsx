// The song as Strudel code (read only), with the layer labels in pink ink, and "Open in strudel.cc".
import { useRef, useState } from 'react';
import type { Song } from '../../../shared/schema.ts';
import { strudelUrl, toStrudelCode } from '../../../shared/song.ts';
import { Button, ButtonLink, CheckIcon, CopyIcon, Disclosure, ExternalIcon } from '../ui/index.ts';
import './CodeView.css';

const LABEL_LINE = /^(_?)([a-z][a-z0-9]*): (.*)$/;

export function CodeView({ song, defaultOpen = false }: { song: Song; defaultOpen?: boolean }) {
  const code = toStrudelCode(song);
  const pre = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const ids = new Set(song.layers.map((layer) => layer.id));

  // Without a clipboard (plain http), select the code so the user can copy it by hand.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const selection = getSelection();
      if (pre.current && selection) selection.selectAllChildren(pre.current);
    }
  };

  return (
    <Disclosure className="code-view" summary="Strudel code" meta={`${song.layers.length} layers`} defaultOpen={defaultOpen}>
      <pre ref={pre} className="code-view__code">
        {code.split('\n').map((line, i) => {
          const match = LABEL_LINE.exec(line);
          const known = match !== null && ids.has(match[2]);
          return (
            <span key={i} className="code-view__line">
              {match && known ? (
                <>
                  <span className="code-view__label">{match[1]}{match[2]}:</span>{' '}{match[3]}
                </>
              ) : line}
              {'\n'}
            </span>
          );
        })}
      </pre>
      <div className="code-view__actions">
        <ButtonLink href={strudelUrl(song)} target="_blank" rel="noopener noreferrer" size="sm" iconEnd={<ExternalIcon size={14} />}>
          Open in strudel.cc
        </ButtonLink>
        <Button size="sm" variant="ghost" icon={copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />} onClick={copy}>
          {copied ? 'Copied' : 'Copy code'}
        </Button>
      </div>
    </Disclosure>
  );
}
