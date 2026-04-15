import React, { useEffect, useState } from 'react'
import { Box, Typography, LinearProgress } from '@mui/material'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import {
  STREAM_LABEL,
  MAX_GAIN,
  useVolumeStore,
} from '../store/volumeStore'

/**
 * Top-centre volume pill. Appears when the user adjusts volume or mutes,
 * holds for 3 s, then fades out. Context-aware label derived from the
 * currently active stream type (Music / Navigation / Call / Audio).
 */
export default function VolumeOSD() {
  const osd = useVolumeStore((s) => s.osd)
  const hideOsd = useVolumeStore((s) => s.hideOsd)

  // Fade state: enter shortly after osd is set, exit when hideAt reached.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!osd) {
      setVisible(false)
      return
    }
    // Show on next frame so transition fires.
    const showT = requestAnimationFrame(() => setVisible(true))
    const ms = Math.max(0, osd.hideAt - Date.now())
    const hideT = window.setTimeout(() => {
      setVisible(false)
      // Let the fade-out finish before clearing the state.
      window.setTimeout(hideOsd, 500)
    }, ms)
    return () => {
      cancelAnimationFrame(showT)
      window.clearTimeout(hideT)
    }
  }, [osd?.seq, hideOsd])

  if (!osd) return null

  const percent = Math.round(osd.rawValue * 100 / MAX_GAIN)
  const label = STREAM_LABEL[osd.type]

  return (
    <Box
      sx={{
        position: 'fixed',
        top: '3vh',
        left: '50%',
        transform: `translate(-50%, ${visible ? '0' : '-10px'})`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 400ms ease, transform 400ms ease',
        zIndex: 10000,
        minWidth: '30vw',
        maxWidth: '60vw',
        px: 3,
        py: 1.5,
        borderRadius: 999,
        bgcolor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        color: '#fff',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {osd.muted ? (
        <VolumeOffIcon sx={{ fontSize: 28 }} />
      ) : (
        <VolumeUpIcon sx={{ fontSize: 28 }} />
      )}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography
          variant="caption"
          sx={{
            letterSpacing: 2,
            textTransform: 'uppercase',
            opacity: 0.7,
            fontSize: '0.75rem',
          }}
        >
          {label}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, osd.value * 100)}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.15)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              bgcolor: osd.muted ? '#888' : '#fff',
              transition: 'transform 200ms ease',
            },
          }}
        />
      </Box>
      <Typography
        sx={{
          minWidth: '3.5rem',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          fontSize: '1rem',
          fontWeight: 500,
        }}
      >
        {osd.muted ? 'MUTE' : `${percent}%`}
      </Typography>
    </Box>
  )
}
