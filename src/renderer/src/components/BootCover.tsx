import React from 'react'
import { Box } from '@mui/material'
import AMSplash from '../assets/splash.png'
import { useStatusStore } from '../store/store'

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
  const isPlugged = useStatusStore((s) => s.isPlugged)
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
        }}
      />
    </Box>
  )
}
