import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

type Focus = "cabin" | "gravity" | "falling" | "orbit";
const BLUE = "#73d1ff", GOLD = "#ffd17a";
const LABELS = {
  en: { earth: "Earth", gravity: "Gravity", motion: "Sideways motion", cabin: "Cabin", fall: "Free fall", scale: "Diagram · not to scale" },
  ru: { earth: "Земля", gravity: "Притяжение", motion: "Скорость по касательной", cabin: "Кабина", fall: "Свободное падение", scale: "Схема · не в масштабе" },
};

export function OrbitalFreefall({ focus, language = "en" }: { focus: Focus; language?: "en" | "ru" }) {
  const t = useCurrentFrame() / useVideoConfig().fps;
  const labels = LABELS[language];
  const exterior = focus === "gravity" || focus === "orbit";
  const angle = -Math.PI / 2 + t * 0.3;
  const radius = 370;
  const x = 540 + radius * Math.cos(angle), y = 800 + radius * Math.sin(angle);
  return <AbsoluteFill>
    <svg viewBox="0 0 1080 1920" width="100%" height="100%" fontFamily="Inter, Inter Cyrillic, sans-serif" fontWeight="700">
      <defs>
        <radialGradient id="orbit-bg"><stop stopColor="#183d54" /><stop offset="1" stopColor="#060e20" /></radialGradient>
        <radialGradient id="orbit-earth" cx="30%" cy="25%"><stop stopColor="#459cc3" /><stop offset="1" stopColor="#103751" /></radialGradient>
        <marker id="orbit-blue-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill={BLUE} /></marker>
        <marker id="orbit-gold-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill={GOLD} /></marker>
      </defs>
      <rect width="1080" height="1920" fill="url(#orbit-bg)" />
      {Array.from({length:110}, (_,i)=><circle key={i} cx={(i*173+41)%1080} cy={(i*307+29)%1920} r={i%3+0.7} fill="#d7eaff" opacity={0.12+i%4*0.06} />)}
      {exterior ? <>
        <circle cx="540" cy="800" r="264" fill={BLUE} opacity="0.1" />
        <circle cx="540" cy="800" r="250" fill="url(#orbit-earth)" />
        <g transform="translate(540 800) scale(2.4) translate(-460 -330)" fill="#62b596" opacity="0.85">
          <path d="M410 280 L438 267 L449 284 L473 278 L480 298 L462 309 L470 324 L444 332 L431 318 L417 320 Z M438 343 L465 341 L479 362 L461 396 L443 381 Z M493 281 L517 298 L522 325 L502 332 L490 318" />
        </g>
        <text x="540" y="840" textAnchor="middle" fill="white" fontSize="36">{labels.earth}</text>
        <circle cx="540" cy="800" r={radius} stroke={BLUE} strokeWidth="3" strokeDasharray="9 13" fill="none" opacity="0.4" />
        {focus === "orbit" ? <path d={`M540 430 A370 370 0 ${((t*0.3)%(Math.PI*2))>Math.PI?1:0} 1 ${x} ${y}`} stroke={GOLD} strokeWidth="6" fill="none" opacity="0.8" /> : null}
        <g transform={`translate(${x} ${y}) rotate(${angle*180/Math.PI+90})`}>
          <Station />
          <path d="M0 40 V160" stroke={BLUE} strokeWidth="6" markerEnd="url(#orbit-blue-arrow)" />
          {focus === "orbit" ? <path d="M48 0 H180" stroke={GOLD} strokeWidth="6" markerEnd="url(#orbit-gold-arrow)" /> : null}
        </g>
        <text x="50" y="350" fill={BLUE} fontSize="32">{labels.gravity}</text>
        {focus === "orbit" ? <text x="50" y="300" fill={GOLD} fontSize="32">{labels.motion}</text> : <>
          <text x="800" y="800" textAnchor="middle" fill={GOLD} fontSize="54">≈90%</text>
          <text x="800" y="845" textAnchor="middle" fill={GOLD} fontSize="26">g</text>
        </>}
      </> : <>
        <g transform={`translate(0 ${focus==='falling'?160*(1-Math.exp(-t/2.5)):0})`}>
          <rect x="60" y="470" width="960" height="560" rx="100" fill="#1b3d57" stroke="#6bacc7" strokeWidth="9" />
          <rect x="90" y="500" width="900" height="500" rx="75" fill="#0b1e31" stroke="#284e66" strokeWidth="3" />
          <circle cx="810" cy="680" r="100" fill="#143749" stroke="#68a3c1" strokeWidth="14" />
          <path d="M718 710 Q810 630 904 690" stroke={BLUE} strokeWidth="24" fill="none" opacity="0.35" />
          <g transform={`translate(440 ${715 + (focus==='cabin'?Math.sin(t*1.3)*15:0)}) rotate(${Math.sin(t*0.7)*5})`}><Astronaut /></g>
          <g transform={`translate(675 ${790 + (focus==='cabin'?Math.sin(t*1.3+1)*12:0)}) rotate(-16)`}>
            <path d="M-25 -34 H28 V24 Q0 44 -25 24 Z" fill={GOLD} /><path d="M28 -20 Q68 -22 60 10 Q50 26 28 13" fill="none" stroke={GOLD} strokeWidth="10" />
          </g>
          <text x="135" y="565" fill="#a4c6db" fontSize="30">{labels.cabin}</text>
          {focus==='falling' ? [440,675,955].map((ax)=><path key={ax} d={`M${ax} 870 v105`} stroke={BLUE} strokeWidth="6" markerEnd="url(#orbit-blue-arrow)" />):null}
        </g>
        {focus==='falling'?<text x="540" y="400" textAnchor="middle" fill={BLUE} fontSize="36">{labels.fall}</text>:null}
      </>}
      <text x="1045" y="1470" textAnchor="end" fill="#93adbf" fontSize="19">{labels.scale}</text>
    </svg>
  </AbsoluteFill>;
}

function Station() {
  return <g>
    <rect x="-115" y="-30" width="75" height="60" fill="#367aab" stroke={BLUE} strokeWidth="3" />
    <rect x="40" y="-30" width="75" height="60" fill="#367aab" stroke={BLUE} strokeWidth="3" />
    {[-95,-70,60,85].map((x)=><path key={x} d={`M${x} -30 v60`} stroke="#b8d8ef" opacity="0.5" />)}
    <rect x="-45" y="-7" width="90" height="14" fill="#d7e2e9" />
    <rect x="-27" y="-24" width="54" height="48" rx="13" fill="#e1e9ef" />
    <circle cx="0" cy="0" r="13" fill="#1e3d57" />
  </g>;
}
function Astronaut() {
  return <g stroke="#dae9f1" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round">
    <path d="M-20 40 L-52 100 L-83 112 M20 40 L55 87 L90 77 M-30 -20 L-86 -2 L-119 -27 M30 -20 L80 -46 L112 -20" fill="none" />
    <rect x="-42" y="-50" width="84" height="105" rx="25" fill="#dae9f1" strokeWidth="5" />
    <circle cy="-91" r="53" fill="#e1edf4" strokeWidth="8" /><rect x="-40" y="-116" width="80" height="48" rx="20" fill="#183f5b" strokeWidth="3" />
    <path d="M-23 -108 H10" stroke={BLUE} strokeWidth="5" /><rect x="-21" y="-20" width="42" height="28" rx="4" fill="#65889e" strokeWidth="2" />
  </g>;
}
