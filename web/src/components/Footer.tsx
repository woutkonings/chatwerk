// The notice and the credits: Strudel is AGPL-3.0, and some sample packs need attribution.
import './Footer.css';

export function Footer() {
  return (
    <footer className="footer">
      <details className="footer__credits">
        <summary>
          Chatwerk<span aria-hidden="true"> · </span>made with <a href="https://strudel.cc" target="_blank" rel="noopener noreferrer">Strudel</a>
          <span aria-hidden="true"> · </span>AGPL-3.0<span aria-hidden="true"> · </span>credits
        </summary>
        <ul>
          <li>Strudel, Copyright (C) Strudel contributors, licensed under the GNU AGPL-3.0-or-later. This app is free software under the same license.</li>
          <li>Salamander Grand Piano by Alexander Holm, CC-BY 3.0.</li>
          <li>Mridangam samples (github.com/yaxu/mrid), CC-BY-SA 4.0.</li>
          <li>VCSL (Versilian Community Sample Library) by Sam Gossner and contributors, CC0.</li>
          <li>uzu-drumkit (Unlicense), Dirt-Samples (TidalCycles) and tidal-drum-machines.</li>
          <li>The band is Claude Haiku by Anthropic. It can change only the music, never the page.</li>
          <li>Typeface: Bricolage Grotesque, Copyright 2022 The Bricolage Grotesque Project Authors (Atelier Triay), SIL Open Font License 1.1.</li>
        </ul>
      </details>
    </footer>
  );
}
