import { useEffect, useState } from "react";
import HealthStatus from "./components/HealthStatus";
import { fetchHealth } from "./api/client";

function App() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealth()
      .then((data) => setStatus(data.status))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main>
      <h1>Starter App</h1>
      <HealthStatus status={status} error={error} />
    </main>
  );
}

export default App;
