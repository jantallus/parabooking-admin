export default function PolitiqueConfidentialitePage() {
  return (
    <main style={{ width: '100%', overflowX: 'hidden', backgroundColor: '#fff' }}>

      <style dangerouslySetInnerHTML={{ __html: `
        .pc-rangee {
          width: 92%;
          max-width: 1240px;
          margin: 0 auto;
        }
        .pc-titre {
          padding: 60px 20px 50px;
        }
        .pc-titre h1 {
          color: #312783;
          font-size: 48px;
          font-weight: 700;
          margin: 0;
          line-height: 1.1;
        }
        .pc-content {
          padding: 0 20px 80px;
          max-width: 780px;
        }
        .pc-content h2 {
          color: #312783;
          font-size: 24px;
          font-weight: 700;
          margin: 40px 0 12px;
        }
        .pc-content p {
          color: #475569;
          font-size: 18px;
          line-height: 1.8;
          margin-bottom: 14px;
        }
        .pc-content ul {
          color: #475569;
          font-size: 18px;
          line-height: 1.8;
          margin: 0 0 14px 24px;
          padding: 0;
        }
        .pc-content li {
          margin-bottom: 6px;
        }
        .pc-content strong {
          color: #312783;
          font-weight: 700;
        }
        .pc-link {
          color: #E6007E;
          text-decoration: none;
          font-weight: 700;
        }
        .pc-link:hover {
          text-decoration: underline;
        }
        @media (max-width: 768px) {
          .pc-titre h1 { font-size: 32px; }
          .pc-titre { padding: 40px 20px 30px; }
          .pc-content { padding: 0 20px 60px; }
          .pc-content h2 { font-size: 20px; }
          .pc-content p, .pc-content ul { font-size: 16px; }
        }
      `}} />

      {/* Titre */}
      <section style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="pc-rangee">
          <div className="pc-titre">
            <h1>Politique de confidentialité</h1>
          </div>
        </div>
      </section>

      {/* Contenu */}
      <section>
        <div className="pc-rangee">
          <div className="pc-content">

            <p>
              Chez <strong>Fluide Parapente</strong>, nous prenons la protection de vos données personnelles au sérieux.
              Cette page vous explique, en toute transparence, quelles données nous collectons, pourquoi et pendant combien de temps.
            </p>

            <h2>Responsable du traitement</h2>
            <p>
              <strong>Fluide Parapente</strong> — La Clusaz, Haute-Savoie<br />
              <a href="mailto:contact@fluide-parapente.fr" className="pc-link">contact@fluide-parapente.fr</a> — +33(0)6 77 28 51 02
            </p>

            <h2>Données collectées</h2>
            <p>
              Lors d'une réservation de vol ou d'un achat de carte cadeau, nous collectons uniquement les informations
              nécessaires à la réalisation de la prestation :
            </p>
            <ul>
              <li>Nom et prénom</li>
              <li>Adresse email</li>
              <li>Numéro de téléphone</li>
            </ul>
            <p>
              Le paiement en ligne est traité par <strong>Stripe</strong>, qui dispose de sa propre politique de sécurité et
              de confidentialité. Nous ne stockons aucune donnée bancaire.
            </p>

            <h2>Finalité du traitement</h2>
            <p>Vos données sont utilisées <strong>exclusivement</strong> pour :</p>
            <ul>
              <li>confirmer et gérer votre réservation de vol ou votre bon cadeau ;</li>
              <li>vous contacter en cas de modification ou d'annulation liée aux conditions météorologiques.</li>
            </ul>
            <p>
              Nous n'utilisons pas vos données à des fins commerciales, publicitaires ou de prospection.
              Vos données ne sont jamais transmises à des tiers, à l'exception de Stripe pour le traitement du paiement.
            </p>

            <h2>Durée de conservation</h2>
            <p>
              Vos données sont conservées le temps nécessaire à la comptabilisation de la prestation —
              c'est-à-dire jusqu'à l'inscription du vol dans notre comptabilité — puis <strong>définitivement supprimées</strong>.
              Cette durée n'excède pas quelques semaines après la réalisation du vol ou l'utilisation du bon cadeau.
            </p>

            <h2>Vos droits</h2>
            <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
            <ul>
              <li><strong>Droit d'accès</strong> : obtenir une copie des données vous concernant ;</li>
              <li><strong>Droit de rectification</strong> : corriger des données inexactes ;</li>
              <li><strong>Droit à l'effacement</strong> : demander la suppression de vos données ;</li>
              <li><strong>Droit d'opposition</strong> : vous opposer à leur traitement.</li>
            </ul>
            <p>
              Pour exercer ces droits, contactez-nous à{' '}
              <a href="mailto:contact@fluide-parapente.fr" className="pc-link">contact@fluide-parapente.fr</a>.
              En cas de litige non résolu, vous pouvez saisir la{' '}
              <a href="https://www.cnil.fr" target="_blank" rel="noopener" className="pc-link">CNIL</a>.
            </p>

            <h2>Cookies</h2>
            <p>
              Ce site utilise uniquement les cookies strictement nécessaires à son fonctionnement (session de réservation, panier).
              Aucun cookie publicitaire ou de tracking n'est utilisé.
            </p>

          </div>
        </div>
      </section>

    </main>
  );
}
