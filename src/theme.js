import { createTheme } from '@mui/material/styles';

export default createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#000000',
    },
    secondary: {
      main: '#FF4F00', // RAL 2005
    },
    text: {
      primary: '#e0e0e0',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          fontWeight: 'bold',
        },
      },
    },
  },
});
