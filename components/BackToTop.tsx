"use client";
import { useEffect, useState } from 'react';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 800);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <span
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{
        display: 'inline-block',
        backgroundColor: hovered ? '#312783' : '#E6007E',
        width: '40px',
        height: '40px',
        borderRadius: '100%',
        position: 'fixed',
        bottom: '40px',
        right: '20px',
        cursor: 'pointer',
        zIndex: 1000,
        opacity: visible ? 1 : 0,
        visibility: visible ? 'visible' : 'hidden',
        transition: 'background-color 0.3s, opacity 0.5s, visibility 0.5s',
      }}
    >
      <img
        src="/backtotop.svg"
        alt="Retour en haut"
        style={{
          width: '17px',
          height: '17px',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </span>
  );
}
