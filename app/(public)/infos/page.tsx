"use client";
import NextLink from 'next/link';

export default function InfosPage() {
  return (
    <main style={{ width: '100%', overflowX: 'hidden', position: 'relative', backgroundColor: 'white' }}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ultraSmoothReveal {
          0% { opacity: 0; transform: translateY(100px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .hero-animation-block {
          will-change: transform, opacity;
          animation: ultraSmoothReveal 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          position: relative;
          z-index: 10;
        }

        /* --- HERO : HAUTEUR 70VH & DÉGRADÉ RADIAL --- */
        .hero-gradient-infos {
          background: radial-gradient(circle at center, #3b82f6 0%, #1e3a8a 50%, #4c1d95 100%);
          position: relative;
          width: 100%;
          height: 70vh;
          display: flex;
          align-items: center;
          color: white;
          text-align: left;
          padding-left: 15vw;
          overflow: hidden;
        }

        /* --- CONTENEUR DES MONTAGNES --- */
        .mountains-container {
          position: absolute;
          bottom: -5px;
          left: 0;
          width: 100%;
          z-index: 5;
          line-height: 0;
        }
        .mountains-container img { 
          width: 100%; 
          height: auto; 
          display: block; 
        }

        /* --- CARTES GRISÉES --- */
        .info-grid {
          max-width: 1200px;
          margin: -60px auto 100px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 30px;
          padding: 0 40px;
          position: relative;
          z-index: 20;
        }

        .info-card {
          background: #f1f5f9;
          border: 1px solid #e2e8f0; 
          padding: 40px;
          border-radius: 24px;
          transition: all 0.4s ease;
        }
        .info-card:hover { 
          transform: translateY(-10px); 
          background: #e2e8f0;
          border-color: #f026b8;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }

        .icon-box-modern {
          width: 55px; height: 55px;
          background: white; border-radius: 15px;
          display: flex; align-items: center; justify-content: center;
          color: #1e40af; margin-bottom: 25px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        }

        .info-card h3 { color: #1e40af; font-size: 1.4rem; font-weight: 800; margin-bottom: 15px; }
        .info-card p, .info-card ul { color: #475569; line-height: 1.6; font-size: 0.95rem; }

        .cta-box {
          max-width: 800px; margin: 0 auto 100px; text-align: center;
          background: #1e40af; padding: 60px; border-radius: 30px; color: white;
        }

        .btn-white {
          display: inline-block; background: white; color: #1e40af;
          padding: 18px 40px; border-radius: 50px; text-decoration: none;
          font-weight: 900; margin-top: 25px; transition: 0.3s;
        }
        .btn-white:hover { background: #f026b8; color: white; transform: scale(1.05); }

        @media (max-width: 1024px) {
          .hero-gradient-infos { height: 60vh; padding-left: 8vw; }
          .info-grid { grid-template-columns: 1fr; margin-top: 20px; }
        }
      `}} />

      {/* --- HERO --- */}
      <section className="hero-gradient-infos">
        <div className="hero-animation-block">
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 3.8rem)', fontWeight: 900, marginBottom: '15px', textShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
            Informations pratiques
          </h1>
          <p style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)', opacity: 0.95, fontWeight: 500, maxWidth: '700px' }}>
            Préparez votre envol avec l'équipe Fluide.
          </p>
        </div>
        
        {/* --- MISE À JOUR : TON NOUVEAU DESSIN ICI --- */}
        <div className="mountains-container">
          <img src="/montagnes.svg" alt="Montagnes Fluide Parapente" />
        </div>
      </section>

      {/* --- GRILLE D'INFOS (Identique) --- */}
      <section className="info-grid">
        <div data-reveal className="info-card">
          <div className="icon-box-modern">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.62 1.96V10a10 10 0 0 0 20 0V5.42a2 2 0 0 0-1.62-1.96Z"/><path d="M12 10V21"/></svg>
          </div>
          <h3>Tenue conseillée</h3>
          <p>Même en été, il fait frais en altitude !</p>
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            <li>Chaussures de sport fermées.</li>
            <li>Coupe-vent ou veste légère.</li>
            <li>Lunettes de soleil.</li>
          </ul>
        </div>

        <div data-reveal data-delay="100" className="info-card">
          <div className="icon-box-modern">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <h3>Le lieu de RDV</h3>
          <p>Au départ du télécabine du <strong>Crêt du Loup</strong> à La Clusaz.</p>
        </div>

        <div data-reveal data-delay="200" className="info-card">
          <div className="icon-box-modern">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <h3>Accessibilité</h3>
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            <li><strong>Âge :</strong> Dès 5 ans.</li>
            <li><strong>Poids :</strong> Entre 20kg et 110kg.</li>
          </ul>
        </div>
      </section>

      <section data-reveal className="cta-box">
        <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '15px' }}>Prêt pour le grand saut ?</h2>
        <NextLink href="/booking" className="btn-white">Réserver maintenant</NextLink>
      </section>
    </main>
  );
}