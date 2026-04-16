import React from 'react'
import { Box } from '@mui/material'
import { keyframes } from '@mui/system'
import AMSplash from '../assets/splash.png'
import { useStatusStore } from '../store/store'

// Subtle breathing animation so the user reads the logo as "alive" while
// the background is still booting. Never goes so transparent that the
// black beneath shows through strongly — peak minimum is 0.82 opacity.
const breathe = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.60; }
`

/**
 * Root-level boot cover. Renders the AM splash full-screen on a black
 * background from the very first React frame, so Nav and other early
 * mounted components are never visible standalone before Carplay's own
 * BootScreen overlay attaches.
 *
 * Uses isPlugged (already exposed via useStatusStore) as the hide signal.
 * Carplay's inner BootScreen still uses its more precise local
 * videoReady (first-frame from Render.worker) to fade out — this outer
 * cover hides slightly earlier (on isPlugged) so the user gets the
 * actual CarPlay UI revealed in one fade rather than two.
 */
export default function BootCover() {
  const videoReady = useStatusStore((s) => s.videoReady)
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        bgcolor: '#000',
        opacity: isPlugged ? 0 : 1,
        transition: 'opacity 500ms ease',
        pointerEvents: isPlugged ? 'none' : 'auto',
      }}
    >
      <Box
        component="img"
        src={AMSplash}
        alt=""
        draggable={false}
        sx={{
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          userSelect: 'none',
          animation: `${breathe} 2s ease-in-out infinite`,
        }}
      />
    </Box>
  )
}
