import React from 'react'
import { Box } from '@mui/material'
import { keyframes } from '@mui/system'
import AMSplash from '../assets/splash.png'
import { useStatusStore } from '../store/store'

// Subtle breathing animation so the user reads the logo as "alive" while
// the background is still booting. 0.60 min opacity gives clear motion
// without the black beneath showing through too strongly.
const breathe = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.60; }
`

/**
 * Root-level boot cover. Renders the AM splash full-screen on a black
 * background from the very first React frame so Nav and other early
 * mounted components never appear standalone before Carplay's inner
 * BootScreen attaches.
 *
 * Hides on useStatusStore.videoReady — set by Carplay when the render
 * worker confirms the first CarPlay video frame has been drawn. Both
 * this outer cover and Carplay's inner overlay fade together so the
 * breathing animation runs uninterrupted right up to the moment the
 * CarPlay UI is revealed.
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
        opacity: videoReady ? 0 : 1,
        transition: 'opacity 500ms ease',
        pointerEvents: videoReady ? 'none' : 'auto',
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
