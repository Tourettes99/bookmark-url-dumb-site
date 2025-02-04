import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { 
  CssBaseline, 
  Container, 
  Box, 
  Drawer,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Typography,
  useMediaQuery,
  Divider,
  CircularProgress
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import TokenGenerator from './components/TokenGenerator';
import UrlForm from './components/UrlForm';
import UrlList from './components/UrlList';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff9b00', // RAL 2005 bright orange
    },
    background: {
      default: '#000000',
      paper: '#121212',
    },
    text: {
      primary: '#d3d3d3', // light gray
      secondary: '#a0a0a0',
    },
  },
});

const drawerWidth = 240;

function App() {
  const [token, setToken] = useState(() => {
    // Try to get token from localStorage
    return localStorage.getItem('currentToken') || '';
  });
  const [urls, setUrls] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Save token to localStorage when it changes
  useEffect(() => {
    if (token) {
      localStorage.setItem('currentToken', token);
    } else {
      localStorage.removeItem('currentToken');
    }
  }, [token]);

  // Load URLs when token changes
  useEffect(() => {
    const fetchUrls = async () => {
      if (!token) {
        setUrls([]);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/.netlify/functions/getUrls?token=${token}`);
        if (!response.ok) throw new Error('Failed to fetch URLs');
        
        const data = await response.json();
        if (Array.isArray(data)) {
          setUrls(data);
        } else if (data.error) {
          console.error('Error fetching URLs:', data.error);
          setUrls([]);
        }
      } catch (error) {
        console.error('Error fetching URLs:', error);
        setUrls([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUrls();
  }, [token]);

  const pinnedUrls = urls.filter(url => url.pinned);

  const drawer = (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ color: theme.palette.primary.main, mb: 2 }}>
        Pinned URLs
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <List>
        {pinnedUrls.map((url) => (
          <ListItem key={url.id} sx={{ pl: 0, pr: 0 }}>
            <ListItemText
              primary={
                <a
                  href={url.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ 
                    color: theme.palette.primary.main,
                    textDecoration: 'none',
                    wordBreak: 'break-all'
                  }}
                >
                  {url.title || url.url}
                </a>
              }
              secondary={url.category}
            />
          </ListItem>
        ))}
        {pinnedUrls.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No pinned URLs yet
          </Typography>
        )}
      </List>
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        {isMobile && (
          <IconButton
            color="primary"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1200 }}
          >
            <MenuIcon />
          </IconButton>
        )}
        
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better mobile performance
          }}
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              backgroundColor: theme.palette.background.paper,
              borderRight: `1px solid ${theme.palette.divider}`,
            },
          }}
        >
          {drawer}
        </Drawer>
        
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            ml: { sm: `${drawerWidth}px` },
          }}
        >
          <Container maxWidth="md">
            <Box sx={{ my: 4 }}>
              <h1 style={{ color: theme.palette.text.primary }}>Teach Mode Dumber</h1>
              
              {/* Quick Guide */}
              <Box sx={{ 
                mb: 4, 
                p: 2, 
                borderRadius: 1,
                border: `1px solid ${theme.palette.primary.main}`,
                backgroundColor: theme.palette.background.paper 
              }}>
                <Typography variant="h6" sx={{ color: theme.palette.primary.main, mb: 2 }}>
                  Quick Guide
                </Typography>
                <Typography variant="body1" component="div">
                  <ol style={{ margin: 0, paddingLeft: '20px' }}>
                    <li>Generate a token below or enter an existing one to access your URLs</li>
                    <li>Add URLs using the form - include categories and hashtags to organize them</li>
                    <li>Pin important URLs to see them in the sidebar</li>
                    <li>Use the same token on other devices to sync your URLs</li>
                  </ol>
                </Typography>
              </Box>

              <TokenGenerator token={token} setToken={setToken} />
              <UrlForm token={token} urls={urls} setUrls={setUrls} />
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <UrlList urls={urls} setUrls={setUrls} token={token} />
              )}
            </Box>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
