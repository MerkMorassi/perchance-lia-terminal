import React, { useEffect, useRef } from 'react';

interface ThermodynamicOverlayProps {
  overlayType: 'none' | 'thermodynamic' | 'coherence' | 'entropy_density' | 'shield_harmonics';
  anomalySimulated?: boolean;
  className?: string;
}

export const ThermodynamicOverlay: React.FC<ThermodynamicOverlayProps> = ({
  overlayType,
  anomalySimulated = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (overlayType === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;
    let time = 0;

    const render = () => {
      time += 0.03;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Create animated thermodynamic wave heatmaps
      const gradient = ctx.createRadialGradient(
        width / 2 + Math.sin(time) * 30,
        height / 2 + Math.cos(time * 0.8) * 20,
        20,
        width / 2,
        height / 2,
        width * 0.45
      );

      if (anomalySimulated) {
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.25)'); // subtle red
        gradient.addColorStop(0.5, 'rgba(234, 179, 8, 0.12)'); // subtle yellow
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (overlayType === 'thermodynamic' || overlayType === 'entropy_density') {
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.18)'); // subtle blue
        gradient.addColorStop(0.5, 'rgba(34, 197, 94, 0.08)'); // subtle green
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (overlayType === 'coherence') {
        gradient.addColorStop(0, 'rgba(34, 197, 94, 0.18)'); // subtle green
        gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.08)'); // subtle blue
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.15)'); // subtle blue
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Draw contour isolines
      ctx.strokeStyle = anomalySimulated ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.12)';
      ctx.lineWidth = 1;

      for (let r = 50; r < Math.min(width, height) / 2; r += 40) {
        ctx.beginPath();
        const pulse = Math.sin(time + r * 0.05) * 8;
        ctx.arc(width / 2, height / 2, r + pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [overlayType, anomalySimulated]);

  if (overlayType === 'none') return null;

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={500}
      className={`absolute inset-0 w-full h-full pointer-events-none mix-blend-screen rounded-lg ${className}`}
    />
  );
};
