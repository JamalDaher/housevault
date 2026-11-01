import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export function extractEquipmentId(raw: string): string | null {
 try { const url=new URL(raw); if(url.origin!==window.location.origin||!url.pathname.replace(/\/$/,"").endsWith("/housevault"))return null; return /^#item=([a-zA-Z0-9-]+)$/.exec(url.hash)?.[1]??null; } catch {return null;}
}
export default function EquipmentScanner({onScan,onClose}:{onScan:(id:string)=>void;onClose:()=>void}){
 const id=useId().replace(/:/g,"");const handled=useRef(false);const scanCallback=useRef(onScan);scanCallback.current=onScan;
 const [error,setError]=useState("");const [ready,setReady]=useState(false);
 useEffect(()=>{let disposed=false;const scanner=new Html5Qrcode(id,{verbose:false});
 void scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:220,height:220}},value=>{if(handled.current)return;const itemId=extractEquipmentId(value);if(!itemId){setError("Not a HouseVault equipment label.");return;}handled.current=true;scanCallback.current(itemId);},()=>{}).then(()=>{if(disposed){if(scanner.isScanning)void scanner.stop().catch(()=>undefined);}else setReady(true);}).catch(()=>{if(!disposed)setError("Camera unavailable. Allow camera permission for HouseVault in iPhone settings, then try again.");});
 return()=>{disposed=true;if(scanner.isScanning)void scanner.stop().catch(()=>undefined);};
 },[id]);
 return <div className="overlay" onClick={onClose}><div className="dialog equipment-scanner-dialog" role="dialog" aria-modal="true" aria-label="Scan equipment QR label" onClick={e=>e.stopPropagation()}><div className="dialog-title"><h2>Scan equipment label</h2><button type="button" onClick={onClose}>Close</button></div><p>Point your camera at a HouseVault equipment QR label.</p><div id={id} className="equipment-scanner-video"/>{!ready&&!error&&<p>Starting camera…</p>}{error&&<p role="alert">{error}</p>}<p className="qr-label-note">Only equipment in this device's local inventory can be opened.</p><button type="button" className="secondary" onClick={onClose}>Cancel</button></div></div>;
}
