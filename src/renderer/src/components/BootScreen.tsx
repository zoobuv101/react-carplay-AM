// Drop-in dark boot screen with centred AM logo + subtle progress dot.
// Place at: src/renderer/src/components/BootScreen.tsx
//
// Render this whenever the upstream "searching for dongle / phone" state
// would otherwise be visible. The wrapping App should swap it in like:
//
//   {connectionState !== 'streaming' ? <BootScreen status={connectionState}/> : <Carplay/>}

import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import amLogo from '../assets/AM.png';

export type BootStatus =
  | 'starting'
  | 'searching-dongle'
  | 'searching-phone'
  | 'pairing'
  | 'connecting'
  | string;

const STATUS_TEXT: Record<string, string> = {
  'starting': '',
  'searching-dongle': 'Looking for adapter…',
  'searching-phone': 'Waiting for phone…',
  'pairing': 'Pairing…',
  'connecting': 'Connecting…',
};

export default function BootScreen({ status = 'starting' }: { status?: BootStatus }) {
  const label = STATUS_TEXT[status] ?? '';
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        userSelect: 'none',
      }}
    >
      <Box
        component="img"
        src={amLogo}
        alt="AM"
        draggable={false}
        sx={{
          maxWidth: '60vw',
          maxHeight: '50vh',
          objectFit: 'contain',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '12vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          opacity: 0.75,
        }}
      >
        <CircularProgress size={28} thickness={3} />
        {label && (
          <Typography variant="body2" sx={{ color: '#bbb', letterSpacing: 1 }}>
            {label}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
