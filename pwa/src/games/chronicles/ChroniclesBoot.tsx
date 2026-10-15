import './game-boot.css';

/** Shared by the lazy entry and save loading so the PWA never flashes a page spinner. */
export default function ChroniclesBoot() {
  return <div className="cr-boot" role="status" aria-label="Carregando Crônicas da Aliança">
    <div className="cr-boot-landscape" aria-hidden="true" />
    <div className="cr-boot-mark" aria-hidden="true">✦</div>
    <span className="cr-boot-kicker">UMA JORNADA ENTRE TESTEMUNHOS</span>
    <h2>Crônicas<span>da Aliança</span></h2>
    <p>Abrindo o livro da jornada<span aria-hidden="true">…</span></p>
  </div>;
}
