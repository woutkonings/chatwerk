// The home page: start a new room or join one by name, and a demo of how a live set runs.
import { Footer } from './components/Footer.tsx';
import { HomeHero, SetPreview } from './components/HomeHero.tsx';

export function Home() {
  return (
    <div className="page home">
      <main className="page__main home__main">
        <HomeHero />
        <SetPreview />
      </main>
      <Footer />
    </div>
  );
}
