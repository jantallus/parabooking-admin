"use client";
import Image from 'next/image';
import Link from 'next/link';

export default function EtePage() {
  const summerFlights = [
    { id: 1, title: "Vol Merle", duration: "6-10 min", price: "65€", img: "/merle.webp", desc: "Le baptême idéal pour les enfants ou les petits gabarits (-60kg)." },
    { id: 2, title: "Vol Loup", duration: "15 min", price: "90€", img: "/loup.webp", desc: "Le grand classique au départ du Crêt du Loup. Accessible à tous !" },
    { id: 3, title: "Vol Ascendance", duration: "30 min", price: "130€", img: "/ascendance.webp", desc: "Utilisez les courants thermiques pour gagner de l'altitude." },
    { id: 4, title: "Vol Prestige", duration: "1 heure", price: "170€", img: "/prestige.webp", desc: "Une heure de pur plaisir au-dessus de la chaîne des Aravis." }
  ];

  return (
    <main style={{ width: '100%', overflowX: 'hidden', position: 'relative' }}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ultraSmoothReveal {
          0% { opacity: 0; transform: translateY(100px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes shine { 100% { left: 125%; } }

        .hero-animation-block {
          will-change: transform, opacity;
          animation: ultraSmoothReveal 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* --- BOUTON HERO : FUSCHIA -> BLEU --- */
        .btn-hero-reserver {
          background-color: #f026b8 !important;
          color: white !important;
          border: 2px solid #f026b8 !important;
          padding: 22px 55px;
          border-radius: 50px;
          text-decoration: none !important;
          font-weight: 900;
          display: inline-block;
          font-size: 1.1rem;
          transition: all 0.4s ease !important;
          box-shadow: 0 10px 20px rgba(240, 38, 184, 0.3);
        }
        .btn-hero-reserver:hover {
          background-color: #1e40af !important;
          border-color: #1e40af !important;
          transform: translateY(-5px);
          box-shadow: 0 15px 30px rgba(30, 64, 175, 0.4);
        }

        /* --- BOUTON SHINE AVEC ICONE INFO --- */
        .btn-card-shine {
          position: relative; background-color: #f026b8; color: white; 
          padding: 14px; border-radius: 50px; text-decoration: none; 
          font-weight: 800; display: flex; align-items: center; justify-content: center;
          gap: 10px; overflow: hidden; transition: all 0.3s ease;
        }
        .btn-card-shine::after {
          content: ''; position: absolute; top: -50%; left: -75%; width: 50%; height: 200%;
          background: linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.4) 50%, rgba(255, 255, 255, 0) 100%);
          transform: rotate(25deg);
        }
        .btn-card-shine:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(240, 38, 184, 0.3); }
        .btn-card-shine:hover::after { animation: shine 0.75s forwards; }

        .content-section { display: flex; align-items: center; gap: 80px; max-width: 1400px; margin: 0 auto; padding: 100px 4vw; }
        .text-block h2 { color: #1e40af; font-size: 2.2rem; font-weight: 900; margin-bottom: 25px; }
        .text-block h3 { color: #1e40af; font-size: 1.6rem; font-weight: 800; margin-top: 40px; margin-bottom: 15px; }
        .text-block p { color: #475569; line-height: 1.8; font-size: 1.05rem; margin-bottom: 15px; }

        .image-container-ete {
          flex: 1; height: 650px; border-radius: 30px;
          position: relative; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }

        .grid-vols { display: grid; grid-template-columns: repeat(4, 1fr); gap: 25px; max-width: 1600px; margin: 0 auto; }
        .flight-card { transition: 0.4s; background: #f1f5f9; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
        .flight-card:hover { transform: translateY(-15px); box-shadow: 0 30px 60px rgba(0,0,0,0.2); }

        .duration-info {
          display: flex; align-items: center; gap: 8px;
          color: #1e40af; font-weight: 700; margin-bottom: 10px;
        }

        @media (max-width: 1024px) {
          .content-section { flex-direction: column; text-align: center; gap: 40px; }
          .grid-vols { grid-template-columns: repeat(2, 1fr) !important; }
          .image-container-ete { width: 100%; height: 400px; }
        }
      `}} />

      {/* --- SECTION 1 : HERO --- */}
      <section style={{ position: 'relative', width: '100%', height: '100vh', display: 'flex', alignItems: 'center', paddingLeft: '15vw', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <Image src="/ete-hero.webp" alt="Parapente Été" fill style={{ objectFit: 'cover' }} priority />
        </div>
        <div className="hero-animation-block" style={{ position: 'relative', zIndex: 10 }}>
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 3.8rem)', fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.1, maxWidth: '800px', textShadow: '0 4px 15px rgba(0,0,0,0.6)' }}>
            Le parapente en été à La Clusaz
          </h1>
          <div style={{ marginTop: '60px' }}>
            <Link href="/booking" className="btn-hero-reserver">Réserver un vol</Link>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: -5, left: 0, width: '100%', zIndex: 5, lineHeight: 0 }}>
          <img src="/montagnes.svg" alt="Montagnes" style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
      </section>

      {/* --- SECTION 2 : PRÉSENTATION TEXTE COMPLET + IMAGE DU COL DES ARAVIS --- */}
      <section style={{ backgroundColor: 'white' }}>
        <div className="content-section">
          
          <div data-reveal className="text-block" style={{ flex: 1.2 }}>
            <h2>Évadez-vous en altitude</h2>
            <p>
              Laissez-vous transporter par la magie et les sensations uniques d'un baptême de parapente ou d'un vol biplace à La Clusaz, l'écrin estival des majestueuses Alpes françaises. C'est la destination idéale pour tous ceux qui cherchent le grand frisson du vol libre sous le soleil !
            </p>

            <h3>La Clusaz, oasis de vert et de sérénité</h3>
            <p>
              En plein été, avec une vue imprenable sur des <strong>paysages verdoyants</strong> qui s’étendent à perte de vue, cette activité est une promesse de souvenirs inoubliables.
            </p>
            <p>
              La Clusaz est célèbre pour ses panoramas époustouflants sur les montagnes des Aravis. Un vol biplace en parapente est la meilleure façon d’apprécier ces merveilles naturelles en mode estival. Imaginez-vous <strong>flotter doucement au-dessus des cimes boisées gorgées de soleil</strong> et des <strong>vallées alpines fleuries</strong>, savourant l’air pur de la montagne. C’est une chance unique de voir la nature sous son plus bel angle estival.
            </p>
            <p>
              Votre vol offre une perspective aérienne exceptionnelle sur les <strong>lacs étincelants</strong> et les <strong>forêts denses</strong> baignés de lumière. En prenant de l’altitude, chaque détail prend vie, des nuances de vert éclatantes aux sentiers de randonnée qui serpentent dans la vallée.
            </p>

            <h3>En toute confiance avec des ailes expertes</h3>
            <p>
              À La Clusaz, les <strong>moniteurs diplômés</strong> de Fluide sont là pour vous faire vivre cette expérience sereinement. Ces professionnels certifiés sont des experts du vol, garantissant votre sécurité tout au long de cette escapade aérienne. Leur expertise vous permet de profiter pleinement du ciel bleu estival sans le moindre souci.
            </p>
            <p>
              Avant de prendre votre élan, le moniteur vous offre un <strong>briefing complet</strong> et détendu sous le soleil pour vous expliquer les étapes et répondre à toutes vos questions. Cette préparation est essentielle pour que vous vous sentiez parfaitement à l’aise et en confiance avant de vous élancer dans l’air chaud de l’été.
            </p>
          </div>

          <div data-reveal data-delay="200" className="image-container-ete">
            <Image src="/coldesaravis.webp" alt="Vue du Col des Aravis" fill style={{ objectFit: 'cover' }} />
          </div>

        </div>
      </section>

      {/* --- SECTION 3 : GRILLE DES VOLS --- */}
      <section style={{ padding: '0 4vw 140px', backgroundColor: 'white' }}>
        <div data-reveal style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1e40af' }}>Choisissez votre vol d'été</h2>
        </div>

        <div data-reveal data-delay="200" className="grid-vols">
          {summerFlights.map((flight) => (
            <div key={flight.id} className="flight-card">
              <div style={{ position: 'relative', height: '200px' }}>
                <Image src={flight.img} alt={flight.title} fill style={{ objectFit: 'cover' }} />
              </div>
              
              <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#1e40af', marginBottom: '10px' }}>{flight.title}</h3>
                
                <div className="duration-info">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>{flight.duration} de vol</span>
                </div>

                <div style={{ color: '#f026b8', fontWeight: 900, marginBottom: '15px', fontSize: '1.1rem' }}>
                  {flight.price}
                </div>
                
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px', flexGrow: 1, lineHeight: '1.5' }}>
                  {flight.desc}
                </p>
                
                <Link href="/booking" className="btn-card-shine">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  Plus d'infos
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}