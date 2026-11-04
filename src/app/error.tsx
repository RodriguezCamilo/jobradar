"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-screen">
      <h1>No pudimos cargar Job Radar.</h1>
      <p>Revisá la conexión y volvé a intentar.</p>
      <button className="primary" onClick={reset}>
        Reintentar
      </button>
    </main>
  );
}
