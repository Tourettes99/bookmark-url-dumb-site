import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff4d00', // RAL 2005
    },
    secondary: {
      main: '#bdbdbd', // Light gray
    },
    background: {
      default: '#000000',
      paper: '#121212',
    },
    text: {
      primary: '#e0e0e0',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
});
