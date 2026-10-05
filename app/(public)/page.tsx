"use client";
import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  const logoText = "fluide".split("");

  const summerFlights = [
    { id: 1, title: "Vol Merle", duration: "6-10 min", price: "65€", img: "/merle.webp", desc: "Baptême découverte pour les enfants ou -60kg." },
    { id: 2, title: "Vol Loup", duration: "15 min", price: "90€", img: "/loup.webp", desc: "Baptême de parapente pour tous (750m dénivelé)." },
    { id: 3, title: "Ascendance", duration: "30 min", price: "130€", img: "/ascendance.webp", desc: "Vol thermique au départ du Crêt du Loup." },
    { id: 4, title: "Prestige", duration: "1 heure", price: "170€", img: "/prestige.webp", desc: "Vol d'une heure pour pilotes en herbe ou passionnés." }
  ];

  return (
    <main style={{ width: '100%', overflowX: 'hidden', position: 'relative' }}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .title-underline { position: relative; display: inline-block; padding-bottom: 12px; }
        .title-underline::after { content: ''; position: absolute; bottom: 0; left: 50%; width: 0; height: 4px; background: #f026b8; transition: 0.4s; transform: translateX(-50%); }
        .section-vols:hover .title-underline::after { width: 120px; }

        .grid-vols { display: grid; grid-template-columns: repeat(4, 1fr); gap: 25px; max-width: 1600px; margin: 0 auto; }
        @media (max-width: 1024px) { .grid-vols { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 640px) { .grid-vols { grid-template-columns: 1fr !important; } }

        .flight-card { transition: 0.4s; background: #f1f5f9; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
        .flight-card:hover { transform: translateY(-15px); box-shadow: 0 30px 60px rgba(0,0,0,0.2); }

        .btn-shine {
          position: relative; overflow: hidden; background-color: #f026b8 !important;
          color: white !important; padding: 15px; border-radius: 50px; text-decoration: none;
          font-weight: 700; text-transform: uppercase; display: flex; align-items: center; justify-content: center;
          gap: 10px; transition: all 0.3s ease;
        }
        .btn-shine:hover { background-color: #d01d9e !important; letter-spacing: 1px; }
        .btn-shine:hover svg { transform: rotate(25deg) scale(1.1); }
        .btn-shine::after {
          content: ""; position: absolute; top: -50%; left: -60%; width: 20%; height: 200%;
          background: rgba(255, 255, 255, 0.4); transform: rotate(30deg);
        }
        .btn-shine:hover::after { left: 130%; transition: all 0.6s ease-in-out; }

        /* --- BOUTON HERO RÉGLÉ (Passage au Bleu) --- */
        .btn-hero-reserve {
          background-color: #f026b8 !important; color: white !important;
          border: 2px solid #f026b8 !important; transition: all 0.4s ease !important;
          padding: 22px 55px; border-radius: 50px; text-decoration: none; 
          font-weight: 900; text-transform: uppercase; display: inline-block;
          font-size: 1.1rem;
          box-shadow: 0 10px 20px rgba(240, 38, 184, 0.2);
        }
        .btn-hero-reserve:hover { 
          background-color: #1e40af !important; 
          border-color: #1e40af !important;
          color: white !important;
          transform: translateY(-5px);
          box-shadow: 0 15px 30px rgba(30, 64, 175, 0.4);
        }
      /* --- GESTION DU LOGO (BUREAU vs MOBILE) --- */
        @media (max-width: 768px) {
          .logo-desktop { display: none !important; }
          .logo-mobile { display: block !important; }
        }
        @media (min-width: 769px) {
          .logo-mobile { display: none !important; }
        }
        `}} />

      {/* --- HERO SECTION --- */}
      <section style={{ position: 'relative', width: '100%', height: '100vh', display: 'flex', alignItems: 'center', paddingLeft: '15vw', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <Image src="/hero-parapente.webp" alt="Hero" fill style={{ objectFit: 'cover' }} priority />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(15,23,42,0.9) 0%, rgba(30,64,175,0.2) 30%, transparent 70%)' }} />
        </div>

        <div style={{ position: 'relative', zIndex: 10 }}>
          <span style={{ color: 'white', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.8em', display: 'block', marginBottom: '40px' }}>Volez</span>
          {/* LOGO VERSION ORDINATEUR (Penché et décalé) */}
          <div className="logo-desktop" style={{ display: 'flex', alignItems: 'flex-end', gap: '-0.06em' }}>
            {logoText.map((char, i) => (
              <span key={i} style={{ display: 'inline-block', color: '#f026b8', fontWeight: 900, fontSize: '11vw', transform: `translateY(${-i * 15}px)`, textShadow: '2px 4px 15px rgba(0,0,0,0.3)' }}>{char}</span>
            ))}
          </div>

          {/* LOGO VERSION MOBILE (Droit et propre) */}
          <div className="logo-mobile" style={{ color: '#f026b8', fontWeight: 900, fontSize: '18vw', textShadow: '2px 4px 15px rgba(0,0,0,0.3)', marginTop: '20px' }}>
            fluide
          </div>
          <p style={{ color: 'white', fontSize: '1.6rem', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', marginTop: '80px' }}>"naturellement parapente"</p>
          
          <div style={{ marginTop: '60px' }}>
            <Link href="/booking" className="btn-hero-reserve">Réserver mon vol</Link>
          </div>
        </div>

       {/* --- BLOC MONTAGNES --- */}
<div style={{ 
  position: 'absolute', 
  bottom: '-5px', 
  left: 0, 
  width: '100%', 
  zIndex: 5, 
  lineHeight: 0 
}}>
  <img 
    src="/montagnes.svg" 
    alt="Montagnes" 
    style={{ width: '100%', height: 'auto', display: 'block' }} 
  />
</div>
      </section>

      {/* --- SECTION DES VOLS --- */}
      <section className="section-vols" style={{ padding: '100px 4vw 140px', backgroundColor: 'white' }}>
        <div data-reveal style={{ textAlign: 'center', marginBottom: '80px' }}>
          <h2 className="title-underline" style={{ fontSize: '3rem', fontWeight: 900, color: '#1e40af', textTransform: 'uppercase' }}>Choisir mon vol</h2>
        </div>
        <div data-reveal data-delay="200" className="grid-vols">
          {summerFlights.map((flight) => (
            <div key={flight.id} className="flight-card">
              <div style={{ position: 'relative', height: '200px' }}><Image src={flight.img} alt={flight.title} fill style={{ objectFit: 'cover' }} /></div>
              <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#1e40af', marginBottom: '10px' }}>{flight.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.85rem', fontWeight: 700, marginBottom: '5px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  {flight.duration}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f026b8', marginBottom: '15px' }}>{flight.price}</div>
                <p style={{ color: '#64748b', fontSize: '0.8rem', minHeight: '60px' }}>{flight.desc}</p>
                <Link href="/booking" className="btn-shine">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.4s ease' }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
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