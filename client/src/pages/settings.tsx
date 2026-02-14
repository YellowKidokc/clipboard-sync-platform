import { useState } from "react";

export default function SettingsPage(): JSX.Element {
  const [apiUrl, setApiUrl] = useState(localStorage.getItem("apiUrl") ?? "http://localhost:5000");

  return (
    <main style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
      <h1>Settings</h1>
      <label style={{ display: "block", marginTop: 12 }}>
        API URL
        <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} style={{ display: "block", width: "100%", marginTop: 4 }} />
      </label>
      <button
        style={{ marginTop: 10 }}
        onClick={() => {
          localStorage.setItem("apiUrl", apiUrl);
          window.location.reload();
        }}
      >
        Save
      </button>
    </main>
  );
}
