// The notice and the credits: Strudel is AGPL-3.0, and some sample packs need attribution.
export function Footer() {
  return (
    <footer className="footer">
      <details>
        <summary>
          Made with <a href="https://strudel.cc" target="_blank" rel="noopener noreferrer">Strudel</a> · AGPL-3.0 ·
          credits
        </summary>
        <ul>
          <li>Strudel, Copyright (C) Strudel contributors, licensed under the GNU AGPL-3.0-or-later. This app is free software under the same license.</li>
          <li>Salamander Grand Piano by Alexander Holm, CC-BY 3.0.</li>
          <li>Mridangam samples (github.com/yaxu/mrid), CC-BY-SA 4.0.</li>
          <li>VCSL (Versilian Community Sample Library) by Sam Gossner and contributors, CC0.</li>
          <li>uzu-drumkit (Unlicense), Dirt-Samples (TidalCycles) and tidal-drum-machines.</li>
          <li>The band is Claude Haiku by Anthropic. It can change only the music, never the page.</li>
        </ul>
      </details>
    </footer>
  );
}
