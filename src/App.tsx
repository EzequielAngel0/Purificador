// src/App.tsx
import React from 'react';
import AppNavigator from './AppNavigator';
import ErrorBoundary from './components/ErrorBoundary';

const App: React.FC = () => (
  <ErrorBoundary>
    <AppNavigator />
  </ErrorBoundary>
);

export default App;
