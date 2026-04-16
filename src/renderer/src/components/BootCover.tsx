import React from 'react'
import { Box } from '@mui/material'
import AMSplash from '../assets/splash.png'
import { useVolumeStore } from '../store/volumeStore'

export default function BootCover() {
  const videoReady = useVolumeStore((s) => s.videoReady)
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
        }}
      />
    </Box>
  )
}
