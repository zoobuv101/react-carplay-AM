// Drop-in dark theme for react-carplay's MUI ThemeProvider.
// Place at: src/renderer/src/theme/astonDark.ts

import { createTheme } from '@mui/material/styles';

export const astonDark = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#000000',
      paper: '#000000',
    },
    text: {
      primary: '#ffffff',
      secondary: '#bbbbbb',
    },
    primary: {
      main: '#ffffff',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#000000',
          margin: 0,
          overflow: 'hidden',
        },
        html: {
          backgroundColor: '#000000',
        },
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        root: { color: '#ffffff' },
      },
    },
  },
});
