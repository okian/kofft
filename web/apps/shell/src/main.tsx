import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { DesignProvider } from "./DesignContext";
import { DesignToggle } from "./DesignToggle";
import { DesignLayout } from "./DesignLayout";
import "./ui/animation-durations.css"; // sets --anim-duration

/** Text displayed in the header for all themes. */
const HEADER_TEXT = "Kofft" as const;
/** Footer copyright notice shared across layouts. */
const FOOTER_TEXT = "© Kofft" as const;

/**
 * Hosts the micro-frontend by mounting the remote module
 * into a div once the component is committed to the DOM.
 * The effect runs only once and guards against missing mounts.
 */
function RemoteContainer() {
  useEffect(() => {
    // @ts-ignore - remote provided at runtime by federation
    import("mf_spectrogram/remote").then((remote: any) => {
      const el = document.getElementById("remote");
      if (el && remote?.mount) remote.mount(el);
    });
  }, []);
  return <div id="remote" />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DesignProvider>
      <DesignToggle />
      <DesignLayout
        header={<div>{HEADER_TEXT}</div>}
        footer={<div>{FOOTER_TEXT}</div>}
      >
        <RemoteContainer />
      </DesignLayout>
    </DesignProvider>
  </React.StrictMode>,
);
