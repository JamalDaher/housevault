import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);

if("serviceWorker" in navigator&&window.location.hostname === 'jamaldaher.github.io'){window.addEventListener("load",()=>{void navigator.serviceWorker.register("/housevault/sw.js",{scope:"/housevault/"}).catch(error=>console.warn("HouseVault offline support unavailable",error));});}
