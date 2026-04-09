import AppRouter from './routes/AppRouter';
import { ToastProvider } from './components/Toast';
import './App.css';

function App() {
  console.log('🔄 App component rendering');
  return (
    <ToastProvider>
      <AppRouter />
    </ToastProvider>
  );
}

export default App;