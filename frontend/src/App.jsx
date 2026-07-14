import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./contexts/AuthContext"; // Import your provider!

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;