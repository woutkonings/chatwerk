// The style guide at /styleguide: every token and component, with mock data for the live set features.
// It is a review page for the design. It has no connection to a room.
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { REACTIONS, type ChatEntry, type Reaction } from '../../../shared/protocol.ts';
import { AgentStatus } from '../components/AgentStatus.tsx';
import { AutopilotToggle } from '../components/AutopilotToggle.tsx';
import { ChatPanel } from '../components/ChatPanel.tsx';
import { CodeView } from '../components/CodeView.tsx';
import { EnergyMeter } from '../components/EnergyMeter.tsx';
import { Footer } from '../components/Footer.tsx';
import { HomeHero, NameForm } from '../components/HomeHero.tsx';
import { LayerCard } from '../components/LayerCard.tsx';
import { LayerGrid } from '../components/LayerGrid.tsx';
import { Logo, LogoMark, RobotRow, Wordmark } from '../components/Logo.tsx';
import { BandPanel, MixReport } from '../components/MixReport.tsx';
import { RoomTabs, type RoomView } from '../components/RoomTabs.tsx';
import { SetTimeline } from '../components/SetTimeline.tsx';
import { SuggestionBar, SuggestionChip } from '../components/SuggestionBar.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { Transport } from '../components/Transport.tsx';
import { VersionHistory } from '../components/VersionHistory.tsx';
import { changeLabel } from '../components/format.ts';
import {
  Badge, Button, ButtonLink, Chip, Disclosure, EmptyState, ExternalIcon, ICONS, IconButton, Input, Led, Meter, Notice,
  Panel, PauseIcon, PlayIcon, PlusIcon, ProgressBar, Readout, RoomIcon, SegmentedControl, SendIcon, Slider, Spinner,
  Switch, ToggleKey, UserChip, WaveIcon,
} from '../ui/index.ts';
import {
  AGENT_STATES, MOCK_CHAT, MOCK_ERRORS, MOCK_PHASE_START, MOCK_PREVIEWS, MOCK_REACTIONS, MOCK_REPORT, MOCK_START_CYCLE, MOCK_USERS,
  MOCK_IDEAS_ALL, MOCK_VERSIONS, mockChanges, mockSet, mockSong, mockSuggestions,
} from './mock.ts';
import './Styleguide.css';

const SECTIONS = [
  ['direction', 'Direction'], ['logo', 'Logo'], ['colour', 'Colour'], ['type', 'Typography'], ['space', 'Space and shape'], ['print', 'Print effects'],
  ['motion', 'Motion'], ['layout', 'Layers and breakpoints'], ['icons', 'Icons'], ['controls', 'Controls'],
  ['display', 'Display'], ['feedback', 'Feedback'], ['containers', 'Sections'], ['set', 'Live set'], ['ideas', 'Ideas'], ['room', 'Room'],
  ['pages', 'Pages'],
] as const;

export function Styleguide() {
  // The page loads lazily, so the browser cannot jump to a #section by itself.
  useEffect(() => {
    document.title = 'Style guide · Chatwerk';
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, []);
  return (
    <div className="sg">
      <header className="sg__header">
        <Logo size="sm" href="/" />
        <span className="sg__header-title">Flyer, the design system</span>
      </header>
      <div className="sg__layout">
        <nav className="sg__nav" aria-label="Style guide sections">
          <ol role="list">
            {SECTIONS.map(([id, title], i) => (
              <li key={id}><a href={`#${id}`}><span className="sg__nav-n">{String(i + 1).padStart(2, '0')}</span>{title}</a></li>
            ))}
          </ol>
        </nav>
        <main className="sg__main">
          <Direction />
          <LogoSection />
          <Colour />
          <Typography />
          <SpaceAndShape />
          <PrintEffects />
          <Motion />
          <LayersAndBreakpoints />
          <Icons />
          <Controls />
          <DisplayParts />
          <Feedback />
          <Containers />
          <LiveSet />
          <Ideas />
          <RoomParts />
          <Pages />
        </main>
      </div>
      <Footer />
    </div>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  const index = SECTIONS.findIndex(([key]) => key === id) + 1;
  return (
    <section id={id} className="sg-section" aria-labelledby={`${id}-title`}>
      <header className="sg-section__head">
        <span className="sg-section__n">{String(index).padStart(2, '0')}</span>
        <h2 id={`${id}-title`} className="sg-section__title">{title}</h2>
      </header>
      {intro && <p className="sg-section__intro">{intro}</p>}
      {children}
    </section>
  );
}

function Specimen({ label, children, wide, note }: { label: string; children: ReactNode; wide?: boolean; note?: ReactNode }) {
  return (
    <figure className={wide ? 'sg-specimen sg-specimen--wide' : 'sg-specimen'}>
      <figcaption className="t-label">{label}</figcaption>
      <div className="sg-specimen__body">{children}</div>
      {note && <p className="sg-specimen__note">{note}</p>}
    </figure>
  );
}

// ---------- Tokens ----------

function Direction() {
  return (
    <Section id="direction" title="A flyer in two inks" intro={<>
      The room reads like a club flyer, printed in riso blue and fluorescent pink on uncoated paper, with the calm of a
      Swiss studio sheet. One typeface, Bricolage Grotesque, in mixed case. Hierarchy comes from size and space, not from
      boxes. docs/design-system.md has the rules and the references.
    </>}>
      <div className="sg-grid sg-grid--3">
        <Principle n="01" title="Two inks">Everything is printed in blue on paper. Pink marks what is now: the current phase, the playhead, the energy, the ideas and the band.</Principle>
        <Principle n="02" title="Pink is rare">Pink fills are small and light. Pink text uses the deep pink ink, so it reads at AA. No large pink blocks.</Principle>
        <Principle n="03" title="Type does the work">Big numbers and names in bold, small muted labels in sentence case. No caps with letter-spacing, no mono labels.</Principle>
        <Principle n="04" title="Rules, not boxes">A strong blue rule opens a section; hairlines separate rows. Sections have no frame and no fill.</Principle>
        <Principle n="05" title="Show the music">A layer shows its notes of this bar (dots and a small piano roll), not a block of code. The code is behind a toggle.</Principle>
        <Principle n="06" title="Print, lightly">A faint paper grain and a halftone sun. Overprint only where two inks really meet.</Principle>
      </div>
    </Section>
  );
}

function LogoSection() {
  return (
    <Section id="logo" title="Logo" intro={<>
      Chatwerk is a pun on the pioneers of electronic music. The logo is an homage in our own drawing, not a copy of
      their logotype or artwork: a wordmark in our own dot-matrix letters (like an old computer display, and like the
      dot grids of the line-up), and a robot head from simple shapes. Four identical heads are the band.
    </>}>
      <Specimen label="Large: the wordmark with the unlit display dots, and the band" wide>
        <div className="sg-logo-large">
          <RobotRow size={64} />
          <Wordmark height={120} grid className="sg-logo-large__word" />
        </div>
      </Specimen>
      <div className="sg-grid sg-grid--3">
        <Specimen label="Small: the top bar (the letters print as pixels)">
          <Logo size="sm" />
          <Logo size="md" />
        </Specimen>
        <Specimen label="Favicon at 16 and 32 px (web/public/favicon.svg)">
          <div className="sg-row sg-row--end">
            <img src="/favicon.svg" width={16} height={16} alt="Favicon at 16 px" />
            <img src="/favicon.svg" width={32} height={32} alt="Favicon at 32 px" />
            <img src="/favicon.svg" width={64} height={64} alt="Favicon at 64 px" />
          </div>
        </Specimen>
        <Specimen label="The mark at every size">
          <div className="sg-row sg-row--end">
            {[16, 24, 32, 48, 96].map((size) => <LogoMark key={size} size={size} />)}
          </div>
        </Specimen>
        <Specimen label="On paper, two inks (the default)">
          <div className="sg-logo-tile"><LogoMark size={56} /><Wordmark height={30} /></div>
        </Specimen>
        <Specimen label="In one ink (blue), for one-colour print">
          <div className="sg-logo-tile"><LogoMark size={56} ink="blue" /><Wordmark height={30} ink="blue" /></div>
        </Specimen>
        <Specimen label="On the dark paper well">
          <div className="sg-logo-tile sg-logo-tile--sunken"><LogoMark size={56} /><Wordmark height={30} /></div>
        </Specimen>
      </div>
      <Specimen label="Rules" wide>
        <ul className="sg-rules-list">
          <li>Never redraw or trace the logotype or the cover art of the band that inspired the name. Our letters and our robot are our own.</li>
          <li>Keep at least one dot of space around the wordmark, and the full head with the antenna around the mark.</li>
          <li>"Chat" prints in blue, "werk" in pink. In one ink, both print in blue; never print the logo in pink only.</li>
          <li>From 48px height the letters are round display dots; below that they print as solid pixels. The unlit dots show only at large sizes. Below 16px, use the mark alone.</li>
        </ul>
      </Specimen>
    </Section>
  );
}

function Principle({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="sg-principle">
      <span className="sg-principle__n">{n}</span>
      <h3 className="sg-principle__title">{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function useTokenValues(tokens: string[]): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({});
  const key = tokens.join(',');
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    setValues(Object.fromEntries(key.split(',').map((token) => [token, style.getPropertyValue(token).trim()])));
  }, [key]);
  return values;
}

function Swatches({ title, tokens }: { title: string; tokens: string[] }) {
  const values = useTokenValues(tokens);
  return (
    <div className="sg-swatches">
      <h3 className="sg-swatches__title">{title}</h3>
      <ul role="list">
        {tokens.map((token) => (
          <li key={token} className="sg-swatch">
            <span className="sg-swatch__chip" style={{ background: `var(${token})` }} />
            <code>{token}</code>
            <span className="sg-swatch__value">{values[token]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Colour() {
  return (
    <Section id="colour" title="Colour" intro="Components use the semantic tokens only. A theme overrides the semantic layer; the primitives (the paper and the two inks) stay the same.">
      <div className="sg-grid sg-grid--2">
        <Swatches title="Paper" tokens={['--color-bg', '--color-bg-sunken', '--color-surface-2', '--color-surface-3']} />
        <Swatches title="Blue ink: text" tokens={['--color-text', '--color-text-secondary', '--color-text-muted', '--color-text-faint']} />
        <Swatches title="Blue ink: rules and actions" tokens={['--color-border', '--color-border-strong', '--color-action', '--color-action-hover', '--color-focus']} />
        <Swatches title="Pink ink: now, the band, warnings" tokens={['--color-accent', '--color-accent-fill', '--color-accent-soft', '--color-accent-wash', '--color-band', '--color-danger']} />
        <Swatches title="Energy 1 to 10 (the inks mix)" tokens={Array.from({ length: 10 }, (_, i) => `--color-energy-${i + 1}`)} />
      </div>
      <Specimen label="Contrast on the paper (WCAG)" wide note="The bright pink fill never carries text. Roles and idea kinds have no colour of their own in this theme: the name, the icon and the pattern identify them.">
        <table className="sg-table">
          <thead><tr><th>Token</th><th>Ratio</th><th>Use</th></tr></thead>
          <tbody>
            <tr><td><code>--color-text</code></td><td>6.6</td><td>Body text, values, rules</td></tr>
            <tr><td><code>--color-text-secondary</code></td><td>8.2</td><td>Strong text</td></tr>
            <tr><td><code>--color-text-muted</code></td><td>5.6</td><td>Labels, meta, hints (4.9 on the pink screen)</td></tr>
            <tr><td><code>--color-text-faint</code></td><td>2.7</td><td>Decoration and disabled only</td></tr>
            <tr><td><code>--color-accent</code></td><td>5.1</td><td>Now, the energy, the band (4.5 on the pink screen)</td></tr>
            <tr><td><code>--color-accent-fill</code></td><td>2.7</td><td>Fills and shapes only, never text</td></tr>
            <tr><td><code>--color-action-ink</code> on <code>--color-action</code></td><td>6.6</td><td>Text on a blue button</td></tr>
          </tbody>
        </table>
      </Specimen>
    </Section>
  );
}

const TYPE_SCALE = ['--text-xs', '--text-sm', '--text-md', '--text-lg', '--text-xl', '--text-2xl', '--text-3xl', '--text-4xl', '--text-5xl'];

function Typography() {
  const values = useTokenValues(TYPE_SCALE);
  return (
    <Section id="type" title="Typography" intro="One typeface: Bricolage Grotesque, a variable grotesque with optical sizes and a width axis. It is bundled with the app; there is no font CDN. Code uses the system monospace font.">
      <div className="sg-grid sg-grid--3">
        <Specimen label="Display: black 800, tight">
          <p className="t-display sg-type-display">Peak 132</p>
        </Specimen>
        <Specimen label="Body: regular and medium">
          <p className="sg-type-body">The band is working on it. Darker, more acid, and drop the kick for 8 bars.</p>
        </Specimen>
        <Specimen label="Labels and code">
          <p className="t-label">Bars left</p>
          <p className="sg-type-value">224</p>
          <code className="sg-type-code">n("0 3 7").lpf(800)</code>
        </Specimen>
      </div>
      <Specimen label="Type scale" wide>
        <ul role="list" className="sg-scale">
          {TYPE_SCALE.map((token) => (
            <li key={token}>
              <code>{token}</code>
              <span className="sg-scale__value">{values[token]}</span>
              <span style={{ fontSize: `var(${token})` }} className="sg-scale__sample">Dub techno at 124</span>
            </li>
          ))}
        </ul>
      </Specimen>
      <div className="sg-grid sg-grid--3">
        <Specimen label="Weights">
          {[400, 500, 600, 700, 800].map((weight) => <p key={weight} style={{ fontWeight: weight }}>{weight} Hypnotic groove</p>)}
        </Specimen>
        <Specimen label="Optical size (automatic)">
          <p style={{ fontSize: 'var(--text-sm)' }}>At 14px the letters open up for reading.</p>
          <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, letterSpacing: 'var(--tracking-display)', lineHeight: 1 }}>At 40px they tighten.</p>
        </Specimen>
        <Specimen label="Helpers">
          <p className="t-label">.t-label (small, muted, sentence case)</p>
          <p className="t-num">.t-num 0123456789</p>
          <p className="t-muted">.t-muted</p>
          <p className="t-display" style={{ fontSize: 'var(--text-2xl)' }}>.t-display</p>
        </Specimen>
      </div>
    </Section>
  );
}

function SpaceAndShape() {
  const space = ['--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-8', '--space-10', '--space-12', '--space-16', '--space-20', '--space-24'];
  const radius = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-pill'];
  const sizes = ['--size-control-sm', '--size-control-md', '--size-control-lg', '--size-touch', '--size-play'];
  const values = useTokenValues([...space, ...radius, ...sizes]);
  return (
    <Section id="space" title="Space and shape" intro="A 4px grid with generous steps: sections sit 48 to 64px apart. Controls are pills and circles; stickers have soft corners.">
      <div className="sg-grid sg-grid--2">
        <Specimen label="Spacing">
          <ul role="list" className="sg-space">
            {space.map((token) => (
              <li key={token}><code>{token}</code><span className="sg-space__value">{values[token]}</span><span className="sg-space__bar" style={{ width: `var(${token})` }} /></li>
            ))}
          </ul>
        </Specimen>
        <div className="sg-stack">
          <Specimen label="Radius">
            <div className="sg-row">
              {radius.map((token) => (
                <div key={token} className="sg-radius" style={{ borderRadius: `var(${token})` }}><code>{token.slice(9)}</code></div>
              ))}
            </div>
          </Specimen>
          <Specimen label="Control heights">
            <div className="sg-row sg-row--end">
              {sizes.map((token) => (
                <div key={token} className="sg-size" style={{ height: `var(${token})` }}><code>{token.slice(7)} {values[token]}</code></div>
              ))}
            </div>
          </Specimen>
          <Specimen label="Rules">
            <div className="sg-rules">
              <div style={{ borderTop: 'var(--rule-width) solid var(--color-border-strong)' }}>Section rule: 2px blue</div>
              <div style={{ borderTop: 'var(--border-width) solid var(--color-border)' }}>Row hairline: 1px light blue</div>
              <div style={{ borderTop: 'var(--rule-width) solid var(--color-band)' }}>Band rule: 2px pink ink</div>
            </div>
          </Specimen>
        </div>
      </div>
    </Section>
  );
}

function PrintEffects() {
  return (
    <Section id="print" title="Print effects" intro="Subtle on purpose: a paper grain on the whole page, a halftone screen of the pink ink, and overprint (multiply) only where two inks really meet.">
      <div className="sg-grid sg-grid--3">
        <Specimen label="--texture-grain (on the page)">
          <div className="sg-print sg-print--grain" />
        </Specimen>
        <Specimen label="--texture-halftone (the sun behind the phase)">
          <div className="sg-print"><span className="sg-print__sun" /><span className="sg-print__word">Peak</span></div>
        </Specimen>
        <Specimen label="--blend-overprint (where two inks cross)">
          <div className="sg-print">
            <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
              <circle cx="45" cy="40" r="32" fill="var(--color-text)" />
              <circle cx="75" cy="40" r="32" fill="var(--color-accent-fill)" style={{ mixBlendMode: 'multiply' }} />
            </svg>
          </div>
        </Specimen>
      </div>
    </Section>
  );
}

function Motion() {
  const [on, setOn] = useState(false);
  const durations = ['--duration-instant', '--duration-fast', '--duration-base', '--duration-slow'];
  const easings = ['--ease-out', '--ease-in-out', '--ease-linear'];
  const values = useTokenValues([...durations, ...easings]);
  return (
    <Section id="motion" title="Motion" intro="Short and functional. With prefers-reduced-motion, transitions stop, and the beat dots, pulses and the home demo stay still.">
      <Button size="sm" variant="secondary" onClick={() => setOn(!on)} icon={<PlayIcon size={12} />}>Run the motion</Button>
      <div className="sg-grid sg-grid--2">
        <Specimen label="Durations (with --ease-out)">
          {durations.map((token) => (
            <div key={token} className="sg-motion">
              <code>{token}</code><span className="sg-motion__value">{values[token]}</span>
              <span className="sg-motion__track"><span className="sg-motion__dot" style={{ transform: on ? 'translateX(160px)' : 'none', transition: `transform var(${token}) var(--ease-out)` }} /></span>
            </div>
          ))}
        </Specimen>
        <Specimen label="Easings (with --duration-slow)">
          {easings.map((token) => (
            <div key={token} className="sg-motion">
              <code>{token}</code><span className="sg-motion__value">{values[token]}</span>
              <span className="sg-motion__track"><span className="sg-motion__dot" style={{ transform: on ? 'translateX(160px)' : 'none', transition: `transform var(--duration-slow) var(${token})` }} /></span>
            </div>
          ))}
        </Specimen>
      </div>
    </Section>
  );
}

function LayersAndBreakpoints() {
  return (
    <Section id="layout" title="Layers and breakpoints">
      <div className="sg-grid sg-grid--2">
        <Specimen label="z-index">
          <table className="sg-table">
            <tbody>
              {[['--z-base', '0', 'Page'], ['--z-raised', '1', 'A sticky helper in the style guide'], ['--z-sticky', '10', 'Top bar, room tabs'],
                ['--z-overlay', '100', 'The inline invite field'], ['--z-toast', '200', 'Toasts (not used yet)']].map(([token, value, use]) => (
                <tr key={token}><td><code>{token}</code></td><td>{value}</td><td>{use}</td></tr>
              ))}
            </tbody>
          </table>
        </Specimen>
        <Specimen label="Breakpoints (literal values in media queries)">
          <table className="sg-table">
            <tbody>
              {[['sm', '480px', 'Large phone: forms keep one row'], ['md', '760px', 'Tablet: the transport and the set readouts in one row'],
                ['lg', '960px', 'The room gets the chat column; below it, tabs'], ['xl', '1280px', 'A wide stage: the band next to the deck (container query)']].map(([name, value, use]) => (
                <tr key={name}><td><code>--bp-{name}</code></td><td>{value}</td><td>{use}</td></tr>
              ))}
            </tbody>
          </table>
        </Specimen>
      </div>
    </Section>
  );
}

function Icons() {
  return (
    <Section id="icons" title="Icons" intro="Inline SVG on a 24px grid, 1.75px strokes with round ends. Decoration by default; give a title when an icon carries meaning alone. The reactions use drawn icons, not emoji.">
      <ul role="list" className="sg-icons">
        {Object.entries(ICONS).map(([name, Icon]) => (
          <li key={name}><Icon size={22} /><code>{name}</code></li>
        ))}
      </ul>
    </Section>
  );
}

// ---------- Components ----------

function Controls() {
  const [key, setKey] = useState({ mute: true, solo: false, accent: true, band: false });
  const [sw, setSw] = useState(true);
  const [segment, setSegment] = useState<'band' | 'room'>('band');
  const [volume, setVolume] = useState(0.8);
  const [text, setText] = useState('');
  return (
    <Section id="controls" title="Controls" intro="ui/: Button, ButtonLink, IconButton, ToggleKey, Switch, SegmentedControl, Slider, Input, Chip.">
      <Specimen label="Button: variants × sizes" wide>
        {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
          <div key={variant} className="sg-row">
            <code className="sg-row__label">{variant}</code>
            <Button variant={variant} size="sm">Small</Button>
            <Button variant={variant}>Medium</Button>
            <Button variant={variant} size="lg" icon={<PlusIcon size={16} />}>Large</Button>
            <Button variant={variant} disabled>Disabled</Button>
            <Button variant={variant} loading>Loading</Button>
          </div>
        ))}
      </Specimen>
      <div className="sg-grid sg-grid--3">
        <Specimen label="ButtonLink and IconButton">
          <div className="sg-row">
            <ButtonLink href="https://strudel.cc" target="_blank" rel="noopener noreferrer" size="sm" iconEnd={<ExternalIcon size={14} />}>Open in strudel.cc</ButtonLink>
            <IconButton label="Send" icon={<SendIcon />} variant="secondary" />
            <IconButton label="Add" icon={<PlusIcon />} />
            <IconButton label="Play" icon={<PlayIcon />} variant="primary" />
          </div>
        </Specimen>
        <Specimen label="ToggleKey (a round latching key)">
          <div className="sg-row">
            {(['mute', 'solo', 'accent', 'band'] as const).map((tone) => (
              <ToggleKey key={tone} tone={tone} pressed={key[tone]} onPressedChange={(pressed) => setKey({ ...key, [tone]: pressed })}
                label={`${tone} key`}>{tone[0].toUpperCase()}</ToggleKey>
            ))}
          </div>
        </Specimen>
        <Specimen label="Switch">
          <Switch checked={sw} onCheckedChange={setSw} label="Autopilot" description="With a description line." />
          <Switch checked={false} onCheckedChange={() => undefined} label="Disabled" disabled />
        </Specimen>
        <Specimen label="SegmentedControl">
          <SegmentedControl label="Send to" value={segment} onChange={setSegment}
            options={[{ value: 'band', label: 'To the band' }, { value: 'room', label: 'Room' }]} />
          <SegmentedControl size="sm" label="Size" value={segment} onChange={setSegment}
            options={[{ value: 'band', label: 'Small' }, { value: 'room', label: 'Size' }]} />
        </Specimen>
        <Specimen label="Slider (fader)">
          <Slider label="Volume" value={volume} onChange={setVolume} format={(value) => `${Math.round(value * 100)}`} />
          <Slider label="Volume" value={volume} onChange={setVolume} showLabel />
          <Slider label="Disabled" value={0.3} onChange={() => undefined} disabled />
        </Specimen>
        <Specimen label="Chip">
          <div className="sg-row sg-row--wrap">
            <Chip icon={<SendIcon size={14} />}>Add an acid line that builds slowly</Chip>
            <Chip selected>Selected</Chip>
            <Chip disabled>Disabled</Chip>
          </div>
        </Specimen>
      </div>
      <Specimen label="Input" wide>
        <div className="sg-grid sg-grid--3">
          <Input placeholder="Ask the band" value={text} onChange={(event) => setText(event.target.value)} aria-label="Demo input" />
          <Input leading={<RoomIcon />} mono placeholder="acid-bunker-x7k2" aria-label="Demo room" />
          <Input size="lg" placeholder="Large" aria-label="Demo large" />
          <Input invalid defaultValue="Not a room" aria-label="Demo invalid" />
          <Input readOnly mono size="sm" value="https://chatwerk.woutkonings.com/r/acid-bunker-x7k2" aria-label="Demo read only" />
          <Input disabled placeholder="Disabled" aria-label="Demo disabled" />
        </div>
      </Specimen>
    </Section>
  );
}

function DisplayParts() {
  return (
    <Section id="display" title="Display" intro="ui/: Badge, Led, Meter, ProgressBar, Readout, UserChip, Spinner.">
      <div className="sg-grid sg-grid--3">
        <Specimen label="Badge: tones × variants">
          {(['outline', 'soft', 'solid'] as const).map((variant) => (
            <div key={variant} className="sg-row sg-row--wrap">
              {(['neutral', 'accent', 'band', 'warn', 'danger'] as const).map((tone) => <Badge key={tone} tone={tone} variant={variant}>{tone}</Badge>)}
            </div>
          ))}
        </Specimen>
        <Specimen label="Led (status dot)">
          <div className="sg-row">
            {(['accent', 'band', 'warn', 'danger', 'off'] as const).map((tone) => <Led key={tone} tone={tone} label={tone} />)}
            <Led tone="band" pulse label="pulse" />
            <Led tone="accent" size="sm" label="small" />
          </div>
        </Specimen>
        <Specimen label="Meter">
          <Meter value={7} target={8.4} label="Energy" />
          <Meter value={4} label="Band tone" tone="band" size="sm" />
          <Meter value={null} label="No reading" size="sm" />
          <Meter value={12} max={16} segments={16} tone="accent" label="Accent, 16 segments" />
        </Specimen>
        <Specimen label="ProgressBar">
          <ProgressBar value={0.35} label="Demo progress" />
          <ProgressBar value={0.8} label="Pink ink" color="var(--color-accent)" />
        </Specimen>
        <Specimen label="Readout">
          <div className="sg-row">
            <Readout label="BPM" value={132} size="lg" />
            <Readout label="Key" value="F phrygian" />
            <Readout label="Target" value={8.4} tone="accent" />
            <Readout label="Swing" value={12} unit="%" size="sm" />
          </div>
        </Specimen>
        <Specimen label="UserChip and Spinner">
          <div className="sg-row sg-row--wrap">
            <UserChip name="Wout" you />
            <UserChip name="Mila" />
            <UserChip name="band" band />
            <UserChip name="Joris" compact />
            <Spinner size={14} label="Loading" />
          </div>
        </Specimen>
      </div>
    </Section>
  );
}

function Feedback() {
  const [shown, setShown] = useState(true);
  return (
    <Section id="feedback" title="Feedback" intro="ui/: Notice and EmptyState. Server notices show in the chat, above the composer.">
      <div className="sg-grid sg-grid--2">
        <Specimen label="Notice: tones">
          <div className="sg-stack">
            <Notice tone="info">The set moves to the Breakdown in 16 bars.</Notice>
            {shown ? <Notice tone="warn" onDismiss={() => setShown(false)}>You can send 6 messages per minute. Wait a moment.</Notice>
              : <Button size="sm" onClick={() => setShown(true)}>Show the notice again</Button>}
            <Notice tone="danger" title="Connection lost">The room reconnects by itself.</Notice>
            <Notice tone="band" title="The band">A new version lands on the next phrase.</Notice>
          </div>
        </Specimen>
        <Specimen label="EmptyState">
          <div className="sg-stack">
            <EmptyState icon={<WaveIcon size={20} />} title="The room is silent" actions={<Chip icon={<SendIcon size={14} />}>Start a dub techno groove</Chip>}>
              Ask the band for something.
            </EmptyState>
            <EmptyState size="sm" title="Nothing to hear yet">The band reports on the mix after the first song.</EmptyState>
          </div>
        </Specimen>
      </div>
    </Section>
  );
}

function Containers() {
  return (
    <Section id="containers" title="Sections" intro="ui/: Panel (a section with a rule on top: default, band; or a sunken well) and Disclosure (with a hairline, or plain).">
      <div className="sg-grid sg-grid--3">
        <Panel title="Panel" meta="meta" actions={<IconButton size="sm" label="Add" icon={<PlusIcon size={14} />} />}>A strong rule and a title. No box, no fill.</Panel>
        <Panel title="Sunken" tone="sunken">A well of darker paper, for code and displays.</Panel>
        <Panel title="Band" tone="band">The rule is pink: everything the band owns.</Panel>
      </div>
      <div className="sg-grid sg-grid--2">
        <Disclosure summary="Disclosure, panel" meta="3" defaultOpen>Content that opens and closes.</Disclosure>
        <Disclosure summary="Disclosure, plain" variant="plain">Content without a frame.</Disclosure>
      </div>
    </Section>
  );
}

// ---------- Live set (mock data on a simulated room clock) ----------

function useMockClock() {
  const [cycle, setCycle] = useState(MOCK_START_CYCLE);
  const [running, setRunning] = useState(true);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setCycle((value) => value + 0.5), 500);
    return () => {
      clearInterval(timer);
    };
  }, [running]);
  return { cycle, setCycle, running, setRunning };
}

function ClockControl({ clock }: { clock: ReturnType<typeof useMockClock> }) {
  return (
    <div className="sg-clock">
      <span className="t-label">Simulated room cycle</span>
      <IconButton variant="secondary" size="sm" label={clock.running ? 'Pause the clock' : 'Run the clock'}
        icon={clock.running ? <PauseIcon size={14} /> : <PlayIcon size={14} />} onClick={() => clock.setRunning(!clock.running)} />
      <Slider label="Room cycle" min={MOCK_PHASE_START - 512} max={MOCK_PHASE_START + 1100} step={1} value={Math.floor(clock.cycle)}
        onChange={clock.setCycle} format={(value) => `${value}`} className="sg-clock__slider" />
      <Button size="sm" variant="ghost" onClick={() => clock.setCycle(MOCK_START_CYCLE)}>Reset</Button>
    </div>
  );
}

// The phase index for a mock cycle on the default arc, so the timeline moves through the phases.
function mockSetAt(cycle: number) {
  const set = mockSet(0, 0);
  let start = 0;
  for (let i = 0; i < set.arc.length; i++) {
    if (cycle < start + set.arc[i].bars || i === set.arc.length - 1) return { ...set, index: i, phaseStart: start };
    start += set.arc[i].bars;
  }
  return set;
}

function LiveSet() {
  const clock = useMockClock();
  const [log, setLog] = useState<string[]>([]);
  const set = mockSetAt(clock.cycle);
  const onMove = useCallback((message: string) => setLog((lines) => [message, ...lines].slice(0, 3)), []);
  return (
    <Section id="set" title="Live set" intro="components/: SetTimeline, EnergyMeter, MixReport, BandPanel, AutopilotToggle, AgentStatus. Mock data on a simulated room clock.">
      <ClockControl clock={clock} />
      <Specimen label="SetTimeline: live (click a phase)" wide note={log.length ? <>Sent to the band: <strong>{log[0]}</strong></> : 'A click sends "Move the set to the <phase> now" to the band.'}>
        <SetTimeline set={set} cycle={clock.cycle} bpm={124} onMove={onMove} />
      </Specimen>
      <div className="sg-grid sg-grid--2">
        <Specimen label="SetTimeline: before the first song (set is null)">
          <SetTimeline set={null} cycle={0} bpm={124} />
        </Specimen>
        <Specimen label="SetTimeline: read only (disabled while offline)">
          <SetTimeline set={mockSet(6, 2000)} cycle={2100} bpm={128} onMove={onMove} disabled />
        </Specimen>
      </div>
      <div className="sg-grid sg-grid--3">
        <Specimen label="EnergyMeter: on target"><EnergyMeter energy={8} target={8.4} /></Specimen>
        <Specimen label="EnergyMeter: under"><EnergyMeter energy={4} target={7.2} /></Specimen>
        <Specimen label="EnergyMeter: over, no set"><EnergyMeter energy={9} target={null} /></Specimen>
      </div>
      <div className="sg-grid sg-grid--3">
        <BandPanel agent={AGENT_STATES[0]} autopilot onAutopilot={() => undefined} connected report={MOCK_REPORT} target={8.4} hasSong />
        <BandPanel agent={AGENT_STATES[2]} autopilot={false} onAutopilot={() => undefined} connected report={null} target={7.2} hasSong />
        <BandPanel agent={AGENT_STATES[1]} autopilot onAutopilot={() => undefined} connected={false} report={null} target={null} hasSong={false} />
      </div>
      <div className="sg-grid sg-grid--3">
        <Specimen label="AgentStatus">
          {AGENT_STATES.map((agent) => <AgentStatus key={agent.status} agent={agent} />)}
        </Specimen>
        <Specimen label="AutopilotToggle"><AutopilotDemo /></Specimen>
        <Specimen label="MixReport alone"><MixReport report={{ energy: 3, lines: ['Only a pad and a soft kick.'] }} target={3.5} hasSong /></Specimen>
      </div>
    </Section>
  );
}

function AutopilotDemo() {
  const [on, setOn] = useState(true);
  return <AutopilotToggle on={on} onChange={setOn} />;
}

// ---------- Ideas (suggestions) ----------

function Ideas() {
  // Instant mode: the room answers a click with a new version and a new round of ideas.
  const clock = useMockClock();
  const [version, setVersion] = useState(14);
  const [log, setLog] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ label: string; by: string; at: number } | null>(null);
  const instant = { ...mockSuggestions('instant', version), lastApplied: applied, cooldownUntil: applied ? applied.at + 4 : 0 };
  const apply = (id: string) => {
    const item = instant.items.find((idea) => idea.id === id);
    if (!item) return;
    setLog(`Wout applied the idea: ${item.label}`);
    // The room answers with a new version: the idea lands at the next phrase, and the cooldown starts.
    setTimeout(() => {
      setApplied({ label: item.label, by: 'Wout', at: Math.ceil((clock.cycle + 0.5) / 4) * 4 });
      setVersion((value) => value + 1);
    }, 600);
  };
  const other = { ...mockSuggestions('instant', 15), lastApplied: { label: 'Ghost notes on the hats', by: 'Mila', at: MOCK_START_CYCLE + 6 }, cooldownUntil: MOCK_START_CYCLE + 10 };

  // Vote mode: my vote adds one to the count.
  const [mineVotes, setMineVotes] = useState<Set<string>>(new Set());
  const base = mockSuggestions('vote', 20);
  const vote = { ...base, items: base.items.map((item) => ({ ...item, votes: item.votes + (mineVotes.has(item.id) ? 1 : 0) })) };
  const toggleVote = (id: string) => {
    const next = new Set(mineVotes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setMineVotes(next);
  };

  return (
    <Section id="ideas" title="Ideas" intro="components/: SuggestionBar and SuggestionChip. Code makes up to 4 ideas after every change; any listener plays one with a click. The kind shows as an icon and a word in pink ink.">
      <ClockControl clock={clock} />
      <Specimen label="SuggestionBar: instant mode (click an idea)" wide
        note={log ? <>System line in the chat: <strong>{log}</strong>. A new round of ideas arrives with the new version.</> : 'The clicked sticker shows "sending"; then a line counts down to the next phrase (on the simulated clock).'}>
        <SuggestionBar suggestions={instant} mineVotes={new Set()} onApply={apply} onVote={() => undefined} notice={null}
          cycle={clock.cycle} you="Wout" hasSong />
      </Specimen>
      <Specimen label="SuggestionBar: another listener's idea lands, cooldown" wide note="lastApplied and cooldownUntil come from the server, so every listener sees this. Reset the clock above to replay it.">
        <SuggestionBar suggestions={other} mineVotes={new Set()} onApply={() => undefined} onVote={() => undefined} notice={null}
          cycle={clock.cycle} you="Wout" hasSong />
      </Specimen>
      <Specimen label="SuggestionBar: vote mode (roadmap; click to vote)" wide note="Each chip shows votes / needed and my vote. The idea plays when it reaches the needed votes.">
        <SuggestionBar suggestions={vote} mineVotes={mineVotes} onApply={() => undefined} onVote={toggleVote} notice={null}
          cycle={clock.cycle} you="Wout" hasSong />
      </Specimen>
      <Specimen label="SuggestionChip: every kind" wide>
        <div className="sg-ideas">
          {MOCK_IDEAS_ALL.map((item) => <SuggestionChip key={item.id} item={item} mode="instant" needed={1} onClick={() => undefined} />)}
        </div>
      </Specimen>
      <div className="sg-grid sg-grid--3">
        <Specimen label="Chip: sending (after a click)">
          <SuggestionChip item={MOCK_IDEAS_ALL[0]} mode="instant" needed={1} landing disabled onClick={() => undefined} />
        </Specimen>
        <Specimen label="Chip: voted, 2 of 3">
          <SuggestionChip item={{ ...MOCK_IDEAS_ALL[2], votes: 2 }} mode="vote" needed={3} voted onClick={() => undefined} />
        </Specimen>
        <Specimen label="Chip: offline (disabled)">
          <SuggestionChip item={MOCK_IDEAS_ALL[4]} mode="instant" needed={1} disabled onClick={() => undefined} />
        </Specimen>
      </div>
      <div className="sg-grid sg-grid--2">
        <Specimen label="Empty: no ideas yet (suggestions is null, the room plays)">
          <SuggestionBar suggestions={null} mineVotes={new Set()} onApply={() => undefined} onVote={() => undefined} notice={null}
            cycle={0} hasSong />
        </Specimen>
        <Specimen label="Empty: no ideas for this version" note="Before the first song, the bar renders nothing.">
          <SuggestionBar suggestions={{ version: 3, mode: 'instant', items: [], needed: 1 }} mineVotes={new Set()} onApply={() => undefined}
            onVote={() => undefined} notice={null} cycle={0} hasSong />
        </Specimen>
      </div>
    </Section>
  );
}

// ---------- Room parts ----------

function RoomParts() {
  const clock = useMockClock();
  const song = mockSong(MOCK_START_CYCLE);
  const changes = mockChanges(MOCK_START_CYCLE);
  const [mutes, setMutes] = useState<Set<string>>(new Set(['pad']));
  const [solo, setSolo] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [mine, setMine] = useState<Set<string>>(new Set(['13:fire']));
  const [chat, setChat] = useState<ChatEntry[]>(MOCK_CHAT);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>('You can send 6 messages per minute. Wait a moment.');
  const [view, setView] = useState<RoomView>('stage');
  const getCycle = useCallback(() => performance.now() / 1000 / (60 / 132 * 4), []);
  const layers = song.layers;
  const cardCycle = clock.cycle; // the automations and transitions are relative to MOCK_START_CYCLE

  const react = (version: number, reaction: Reaction) => {
    const key = `${version}:${reaction}`;
    const next = new Set(mine);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setMine(next);
  };

  return (
    <Section id="room" title="Room" intro="components/: TopBar, RoomTabs, Transport, LayerCard, LayerGrid, AutomationBadge, CodeView, VersionHistory, ChatPanel.">
      <Specimen label="TopBar" wide>
        <div className="sg-frame"><TopBar roomId="acid-bunker-x7k2" status="open" users={MOCK_USERS} youId="u1" /></div>
        <div className="sg-frame"><TopBar roomId="acid-bunker-x7k2" status="connecting" users={MOCK_USERS.slice(0, 1)} youId="u1" /></div>
      </Specimen>
      <Specimen label="RoomTabs (phones only; shown here at any width)" wide>
        <div className="sg-frame sg-frame--tabs">
          <RoomTabs view={view} onView={setView} unread={3} playing={playing} starting={false} onTogglePlay={() => setPlaying(!playing)} phase="Peak" />
        </div>
      </Specimen>
      <Specimen label="Transport (the beat lights run on a fake clock)" wide>
        <Transport song={song} playing={playing} starting={false} onTogglePlay={() => setPlaying(!playing)} volume={volume} onVolume={setVolume} getCycle={getCycle} />
      </Specimen>
      <ClockControl clock={clock} />
      <Specimen label="LayerCard: a line of the line-up, in every state" wide note="hats: automation running. bass: automation in 3 bars. acid: filter sweep staged. stab: muted by the band. pad: muted for you. noise: an error. Try M, S and Code.">
        <div className="layer-grid__list">
          {layers.map((layer) => (
            <LayerCard key={layer.id} layer={layer} cycle={cardCycle} preview={MOCK_PREVIEWS[layer.id] ?? []} error={MOCK_ERRORS[layer.id as keyof typeof MOCK_ERRORS]}
              label={changeLabel(changes[layer.id], cardCycle)} muted={mutes.has(layer.id)} soloed={solo === layer.id}
              silenced={solo !== null && solo !== layer.id}
              onMute={() => setMutes((current) => { const next = new Set(current); if (next.has(layer.id)) next.delete(layer.id); else next.add(layer.id); return next; })}
              onSolo={() => setSolo(solo === layer.id ? null : layer.id)} />
          ))}
        </div>
      </Specimen>
      <Specimen label="LayerGrid: the line-up with previews from player.preview()" wide>
        <LayerGrid layers={layers.slice(0, 4)} errors={{}} changes={changes} cycle={cardCycle} mutes={new Set()} solo={null}
          onMute={() => undefined} onSolo={() => undefined} onSuggest={() => undefined} canSuggest getPreview={(id) => MOCK_PREVIEWS[id] ?? []} />
      </Specimen>
      <Specimen label="LayerGrid: empty room" wide>
        <LayerGrid layers={[]} errors={{}} changes={{}} cycle={0} mutes={new Set()} solo={null} onMute={() => undefined}
          onSolo={() => undefined} onSuggest={(text) => setChat((entries) => [...entries, { id: entries.length + 1, at: Date.now(), author: 'Wout', kind: 'user', text, toBand: true }])} canSuggest />
      </Specimen>
      <div className="sg-grid sg-grid--2">
        <div className="sg-stack">
          <CodeView song={song} defaultOpen />
          <VersionHistory versions={MOCK_VERSIONS} reactions={MOCK_REACTIONS} mine={mine} current={14} onReact={react} />
          <p className="sg-specimen__note">Reactions: {REACTIONS.join(', ')}. Your own reactions are lit.</p>
        </div>
        <div className="sg-chat">
          <ChatPanel chat={chat} you="Wout" agent={AGENT_STATES[2]} notice={notice} onDismissNotice={() => setNotice(null)}
            draft={draft} setDraft={setDraft} disabled={false}
            onSend={(text, toBand) => {
              const clean = text.trim();
              if (!clean) return;
              setChat((entries) => [...entries, { id: entries.length + 1, at: Date.now(), author: 'Wout', kind: 'user', text: clean, toBand }]);
              setDraft('');
            }} />
        </div>
      </div>
    </Section>
  );
}

function Pages() {
  return (
    <Section id="pages" title="Pages" intro="The home hero with the join form, and the name form that a new listener sees in a room.">
      <div className="sg-frame sg-frame--page"><HomeHero /></div>
      <div className="sg-frame sg-frame--page" style={{ '--frame-pad': 'var(--space-8)' } as CSSProperties}>
        <NameForm roomId="acid-bunker-x7k2" onDone={() => undefined} autoFocus={false} />
      </div>
    </Section>
  );
}
