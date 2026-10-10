// The Chatwerk logo: an homage to the electronic pioneers, in our own drawing.
// The wordmark is set in our own 5 by 7 dot-matrix letters, like the display of an old computer; "Chat" prints
// in blue and "werk" in pink. The mark is a small robot head from simple shapes; four of them make the band.
import { cx } from '../ui/index.ts';
import './Logo.css';

// The letters on a grid of 5 columns and 7 rows ("#" is a lit dot). The baseline is the last row.
const GLYPHS: Record<string, string[]> = {
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  h: ['#....', '#....', '#.##.', '##..#', '#...#', '#...#', '#...#'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
};

const WORD = 'Chatwerk';
const SPLIT = 4; // "Chat" | "werk"
const COLUMNS = WORD.length * 6 - 1; // 5 columns per letter and 1 column between letters
const ROWS = 7;

// Every dot of the wordmark, once.
const DOTS = [...WORD].flatMap((char, letter) =>
  GLYPHS[char].flatMap((row, y) => [...row].map((cell, x) => ({ x: letter * 6 + x, y, on: cell === '#', second: letter >= SPLIT }))),
);

export type LogoInk = 'two' | 'blue';

// The dot-matrix wordmark. From 48px height the letters print as round display dots; below that they print as
// solid pixels (squares that touch), so the word stays readable in the top bar.
// `grid` also prints the unlit dots, like a display that is switched on (large sizes only).
export function Wordmark({ height = 20, ink = 'two', grid = false, className }: { height?: number; ink?: LogoInk; grid?: boolean; className?: string }) {
  const pixels = height < 48;
  return (
    <svg className={cx('wordmark', className)} data-ink={ink} viewBox={`0 0 ${COLUMNS} ${ROWS}`} height={height}
      width={(height * COLUMNS) / ROWS} role="img" aria-label="Chatwerk" focusable="false">
      {DOTS.filter((dot) => dot.on || (grid && !pixels)).map((dot) => {
        const className = !dot.on ? 'wordmark__off' : dot.second ? 'wordmark__werk' : 'wordmark__chat';
        return pixels
          ? <rect key={`${dot.x}-${dot.y}`} x={dot.x - 0.01} y={dot.y - 0.01} width={1.02} height={1.02} className={className} />
          : <circle key={`${dot.x}-${dot.y}`} cx={dot.x + 0.5} cy={dot.y + 0.5} r={dot.on ? 0.43 : 0.16} className={className} />;
      })}
    </svg>
  );
}

// The mark: a robot head. A blue screen, two paper eyes, a pink mouth and a pink antenna dot.
// In one ink, the pink parts print in blue.
export function LogoMark({ size = 24, ink = 'two', title }: { size?: number; ink?: LogoInk; title?: string }) {
  return (
    <svg className="logo-mark" data-ink={ink} width={size} height={size} viewBox="0 0 32 32" focusable="false"
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect className="logo-mark__stem" x="15" y="3.5" width="2" height="5" />
      <circle className="logo-mark__pink" cx="16" cy="3.5" r="2.6" />
      <rect className="logo-mark__head" x="4" y="8" width="24" height="21" rx="5" />
      <rect className="logo-mark__eye" x="9" y="13.5" width="5" height="5" rx="1.2" />
      <rect className="logo-mark__eye" x="18" y="13.5" width="5" height="5" rx="1.2" />
      <rect className="logo-mark__pink" x="10" y="22" width="12" height="3" rx="1.5" />
    </svg>
  );
}

// The band: four identical heads in a row.
export function RobotRow({ size = 40, ink = 'two' }: { size?: number; ink?: LogoInk }) {
  return (
    <span className="robot-row" role="img" aria-label="The band: four robots">
      {[0, 1, 2, 3].map((i) => <LogoMark key={i} size={size} ink={ink} />)}
    </span>
  );
}

export function Logo({ size = 'md', href, showMark = true }: { size?: 'sm' | 'md' | 'hero'; href?: string; showMark?: boolean }) {
  const height = size === 'hero' ? 96 : size === 'md' ? 28 : 19;
  const content = (
    <>
      {showMark && <LogoMark size={size === 'hero' ? 104 : size === 'md' ? 36 : 26} />}
      <Wordmark height={height} />
    </>
  );
  const className = cx('logo', `logo--${size}`);
  return href ? <a className={className} href={href} aria-label="Chatwerk, home">{content}</a> : <span className={className}>{content}</span>;
}
