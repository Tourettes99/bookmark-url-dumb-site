import React from 'react';
import { ThemeProvider } from '@mui/material';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { theme } from './theme';
import Header from './components/Header';
import TokenGeneration from './pages/TokenGeneration';
import LinkManagement from './pages/LinkManagement';
import { DataProvider } from './context/DataContext';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <DataProvider>
        <Router>
          <Header />
          <Routes>
            <Route path="/" element={<TokenGeneration />} />
            <Route path="/manage" element={<LinkManagement />} />
          </Routes>
        </Router>
      </DataProvider>
    </ThemeProvider>
  );
}
