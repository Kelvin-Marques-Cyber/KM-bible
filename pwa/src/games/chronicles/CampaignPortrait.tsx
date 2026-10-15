import type { ChronicleEpisode } from "./campaign-content";
/** Original vector pixel portrait; readers/visions use an archive emblem instead of a human witness. */
export default function CampaignPortrait({
  episode,
}: {
  episode: ChronicleEpisode;
}) {
  const human = episode.hero.includes("(ficção)"),
    cloth = ["#74969b", "#bd9978", "#8f9c77", "#9b90b1", "#c69078", "#6f9da5"][
      episode.saga
    ];
  return (
    <svg
      viewBox="0 0 40 44"
      className="ca-portrait"
      role="img"
      aria-label={
        human
          ? "Retrato da testemunha fictícia"
          : "Emblema do leitor da narrativa"
      }
      shapeRendering="crispEdges"
    >
      <rect width="40" height="44" fill="#172d35" />
      <path d="M0 38h40v6H0zM3 33h34v6H3z" fill="#304b4e" />
      {human ? (
        <>
          <path d="M7 44V31h6v-5h14v5h6v13z" fill={cloth} />
          <path d="M10 8h20v19H10z" fill="#b9876d" />
          <path d="M10 10h16v16H10z" fill="#dcb28d" />
          <path d="M8 8h24v7h-5V9H12v10H8zM12 5h16v5H12z" fill="#483d3c" />
          <path d="M7 9h5v22H7zM28 9h5v18h-5z" fill="#5c4b40" />
          <g className="ca-portrait-eyes">
            <path d="M13 17h3v3h-3zM23 17h3v3h-3z" fill="#263841" />
            <path d="M13 17h1v1h-1zM23 17h1v1h-1z" fill="#e7ddbe" />
          </g>
          <path d="M18 24h5v1h-5z" fill="#985f55" />
          <path d="M11 28h17v4H11zM9 31h3v10H9z" fill="#e6cd92" />
          <path d="M27 33h6v11h-6z" fill="#596b74" />
        </>
      ) : (
        <>
          <path d="M8 14h12v22H8zM21 14h11v22H21z" fill="#d5bf8e" />
          <path d="M10 12h9v22h-9zM22 12h8v22h-8z" fill="#eeddb5" />
          <path d="M19 13h3v25h-3zM10 36h20v2H10z" fill="#8b755a" />
          <path
            d="M12 18h5v1h-5zM12 22h5v1h-5zM24 18h4v1h-4zM24 22h4v1h-4z"
            fill="#8b8a73"
          />
          <path d="M19 3h3v6h-3zM16 6h9v2h-9z" fill="#e3c98c" />
        </>
      )}
      <path
        d="M0 0h40v2H0zM0 42h40v2H0zM0 0h2v44H0zM38 0h2v44h-2z"
        fill="#a68d62"
      />
    </svg>
  );
}
