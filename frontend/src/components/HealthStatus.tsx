import React from "react";

interface Props {
  status: string | null;
  error: string | null;
}

const HealthStatus: React.FC<Props> = ({ status, error }) => {
  if (error) {
    return <p style={{ color: "red" }}>Error: {error}</p>;
  }
  if (status === null) {
    return <p>Loading health…</p>;
  }
  return <p style={{ color: "green" }}>Backend health: {status}</p>;
};

export default HealthStatus;
