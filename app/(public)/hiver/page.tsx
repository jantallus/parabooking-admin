"use client";
import Image from 'next/image';
import Link from 'next/link';

export default function HiverPage() {
  const winterFlights = [
    { 
      id: 1, 
      title: "Vol et baptême parapente – Beauregard", 
      drop: "500m", 
      price: "65€", 
      img: "/beauregard-winter.jpg", 
      desc: "Volez au-dessus de La Clusaz et offrez-vous un moment inoubliable ! Option sensation offerte.",
      btnText: "Infos et réservation"
    },
    { 
      id: 2, 
      title: "Vol et baptême parapente – Crêt du Loup", 
      drop: "800m", 
      price: "85€", 
      img: "/loup-winter.jpg", 
      desc: "Volez au-dessus de La Clusaz et offrez-vous un moment inoubliable !",
      btnText: "Infos et réservation"
    },
    { 
      id: 3, 
      title: "Vol et baptême parapente – L’Aiguille", 
      drop: "1200m", 
      price: "149€", 
      img: "/aiguille-winter.jpg", 
      desc: "Un vol pour les skieurs expérimentés. Réservation par téléphone.",
      btnText: "Informations"
    }
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

        /* --- BOUTON SHINE AVEC ICONE --- */
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

        /* --- SECTION CONTENU --- */
        .content-section {
          display: flex; align-items: center; gap: 80px;
          max-width: 1400px; margin: 0 auto; padding: 100px 4vw;
        }
        .text-block h2 { color: #1e40af; font-size: 2.2rem; font-weight: 900; margin-bottom: 25px; }
        .text-block h3 { color: #1e40af; font-size: 1.6rem; font-weight: 800; margin-top: 40px; margin-bottom: 15px; }
        .text-block p { color: #475569; line-height: 1.8; font-size: 1.05rem; margin-bottom: 15px; }

        .image-container-hiver {
          flex: 1; height: 650px; border-radius: 30px;
          position: relative; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }

        /* --- GRILLE DES VOLS --- */
        .grid-vols-hiver { 
          display: grid; 
          grid-template-columns: repeat(3, 1fr); 
          gap: 35px; 
          max-width: 1300px; 
          margin: 0 auto; 
        }
        .flight-card { 
          transition: 0.4s; background: #f1f5f9; border-radius: 20px; 
          overflow: hidden; display: flex; flex-direction: column; 
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }
        .flight-card:hover { transform: translateY(-15px); box-shadow: 0 30px 60px rgba(0,0,0,0.15); }

        .drop-info {
          display: flex; align-items: center; gap: 8px;
          color: #1e40af; font-weight: 700; margin-bottom: 10px;
        }

        @media (max-width: 1024px) {
          .content-section { flex-direction: column; text-align: center; gap: 40px; }
          .image-container-hiver { width: 100%; height: 400px; }
          .grid-vols-hiver { grid-template-columns: 1fr; max-width: 500px; }
        }
      `}} />

      {/* --- SECTION 1 : HERO --- */}
      <section style={{ position: 'relative', width: '100%', height: '100vh', display: 'flex', alignItems: 'center', paddingLeft: '15vw', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <Image src="/hhero.jpg" alt="Parapente Hiver" fill style={{ objectFit: 'cover' }} priority />
        </div>
        <div className="hero-animation-block" style={{ position: 'relative', zIndex: 10 }}>
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 3.8rem)', fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.1, maxWidth: '800px', textShadow: '0 4px 15px rgba(0,0,0,0.6)' }}>
            Baptême parapente et vol biplace en hiver à La Clusaz
          </h1>
          <div style={{ marginTop: '60px' }}>
            <Link href="/booking" className="btn-hero-reserver">Réserver un vol</Link>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: -5, left: 0, width: '100%', zIndex: 5, lineHeight: 0 }}>
          <img src="/montagnes.svg" alt="Montagnes" style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
      </section>

      {/* --- SECTION 2 : PRÉSENTATION TEXTE HIVER + IMAGE --- */}
      <section style={{ backgroundColor: 'white' }}>
        <div className="content-section">
          
          <div data-reveal className="text-block" style={{ flex: 1.2 }}>
            <h2>L'hiver, une saison idéale pour le parapente à La Clusaz</h2>
            
            <h3>Décollage à ski : un supplément de fun</h3>
            <p>
              Lorsqu’elle endosse son manteau de neige, La Clusaz devient un terrain de jeu féérique. Si vous cherchez à combiner sports d’hiver et vol en parapente, le <strong>décollage à ski</strong> est l’option parfaite. Equipé de skis, vous glissez sur une pente douce avant de vous lancer dans les airs. Les émotions sont décuplées grâce à cette façon originale de démarrer le vol.
            </p>
            <p>
              Ce type de décollage offre une transition fluide entre le ski et le vol, rendant l’expérience doublement excitante. Les amateurs de glisse seront ravis de prolonger leur plaisir en s’élançant depuis les pistes enneigées !
            </p>

            <h3>Vue imprenable sur les massifs enneigés</h3>
            <p>
              En hiver, les sommets des Aravis recouverts de neige offrent un spectacle incroyable. Le contraste entre la blancheur éclatante des pics et le ciel bleu est saisissant. Depuis votre parapente, vous aurez l’impression de flotter dans un décor de carte postale.
            </p>
            <p>
              Les températures froides ne sont pas un obstacle lorsque vous êtes bien équipé. Les sensations sont différentes mais tout aussi plaisantes qu’en été, voire plus intenses grâce au panorama hivernal unique.
            </p>
          </div>

          {/* PHOTO RÉELLE INTÉGRÉE ICI */}
          <div data-reveal data-delay="200" className="image-container-hiver">
            <Image 
              src="/hhero2.webp" 
              alt="Décollage à ski à La Clusaz" 
              fill 
              style={{ objectFit: 'cover' }} 
            />
          </div>

        </div>
      </section>

      {/* --- SECTION 3 : GRILLE DES VOLS --- */}
      <section style={{ padding: '0 4vw 140px', backgroundColor: 'white' }}>
        <div data-reveal style={{ textAlign: 'center', marginBottom: '80px' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1e40af' }}>Nos vols d'hiver</h2>
        </div>

        <div data-reveal data-delay="200" className="grid-vols-hiver">
          {winterFlights.map((flight) => (
            <div key={flight.id} className="flight-card">
              <div style={{ position: 'relative', height: '230px' }}>
                <Image src={flight.img} alt={flight.title} fill style={{ objectFit: 'cover' }} />
              </div>
              
              <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1e40af', marginBottom: '15px', lineHeight: '1.3' }}>
                  {flight.title}
                </h3>
                
                <div className="drop-info">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
                  <span>{flight.drop} de dénivelé</span>
                </div>

                <div style={{ color: '#f026b8', fontWeight: 900, fontSize: '1.2rem', marginBottom: '20px' }}>
                  À partir de {flight.price}
                </div>
                
                <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '30px', flexGrow: 1, lineHeight: '1.6' }}>
                  {flight.desc}
                </p>
                
                <Link href={flight.id === 3 ? "tel:0600000000" : "/booking"} className="btn-card-shine">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  {flight.btnText}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}